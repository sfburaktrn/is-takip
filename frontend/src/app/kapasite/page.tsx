'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import {
    getCapacityWeek,
    putCapacityWeek,
    deleteCapacityWeek,
    putCapacityTarget,
    deleteCapacityTarget,
    getCapacityDefaults,
    type VerimlilikProductType,
    type CapacityWeekRow,
} from '@/lib/api';
import { Users, Loader2, Save, Trash2, Sparkles, Gauge } from 'lucide-react';

function mondayOfDateInput(isoDay: string): string {
    const d = new Date(isoDay + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}

export default function KapasitePage() {
    const [productType, setProductType] = useState<VerimlilikProductType>('DAMPER');
    const [weekInput, setWeekInput] = useState(() => mondayOfDateInput(new Date().toISOString().slice(0, 10)));
    const [rows, setRows] = useState<CapacityWeekRow[]>([]);
    const [hoursPerPerson, setHoursPerPerson] = useState(45);
    const [scheduleDesc, setScheduleDesc] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const weekStart = useMemo(() => mondayOfDateInput(weekInput), [weekInput]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setMessage(null);
            const [defs, data] = await Promise.all([getCapacityDefaults(), getCapacityWeek(productType, weekStart)]);
            setHoursPerPerson(data.hoursPerPersonWeek);
            setScheduleDesc(defs.description);
            setRows(data.rows.map(r => ({ ...r, targetCount: r.targetCount ?? 0 })));
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Yüklenemedi' });
        } finally {
            setLoading(false);
        }
    }, [productType, weekStart]);

    useEffect(() => {
        load();
    }, [load]);

    const updateRow = (mainStepKey: string, patch: Partial<CapacityWeekRow>) => {
        setRows(prev => prev.map(r => (r.mainStepKey === mainStepKey ? { ...r, ...patch } : r)));
    };

    const applyStandardHours = (mainStepKey: string) => {
        const r = rows.find(x => x.mainStepKey === mainStepKey);
        if (!r) return;
        const nh = r.headcount * hoursPerPerson;
        updateRow(mainStepKey, { normalHours: nh });
    };

    const saveRow = async (mainStepKey: string) => {
        const r = rows.find(x => x.mainStepKey === mainStepKey);
        if (!r) return;
        try {
            setSavingKey(mainStepKey);
            setMessage(null);
            await putCapacityWeek({
                productType,
                weekStart,
                mainStepKey,
                headcount: r.headcount,
                normalHours: r.normalHours,
                overtimeHours: r.overtimeHours,
            });
            setMessage({ type: 'ok', text: `${r.label} kaydedildi` });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Kayıt hatası' });
        } finally {
            setSavingKey(null);
        }
    };

    const clearRow = async (mainStepKey: string) => {
        if (!confirm('Bu bölümün kapasite kaydını silmek istiyor musunuz?')) return;
        try {
            setSavingKey(mainStepKey);
            await deleteCapacityWeek(productType, weekStart, mainStepKey);
            updateRow(mainStepKey, { headcount: 0, normalHours: 0, overtimeHours: 0 });
            setMessage({ type: 'ok', text: 'Satır temizlendi' });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Silinemedi' });
        } finally {
            setSavingKey(null);
        }
    };

    const saveTargetRow = async (mainStepKey: string) => {
        const r = rows.find(x => x.mainStepKey === mainStepKey);
        if (!r) return;
        try {
            setSavingKey(`t-${mainStepKey}`);
            setMessage(null);
            await putCapacityTarget({
                productType,
                weekStart,
                mainStepKey,
                targetCount: r.targetCount,
            });
            setMessage({ type: 'ok', text: `${r.label} hedefi kaydedildi` });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Hedef kaydı hatası' });
        } finally {
            setSavingKey(null);
        }
    };

    const clearTargetRow = async (mainStepKey: string) => {
        if (!confirm('Bu bölümün haftalık hedef kaydını silmek istiyor musunuz?')) return;
        try {
            setSavingKey(`t-${mainStepKey}`);
            await deleteCapacityTarget(productType, weekStart, mainStepKey);
            updateRow(mainStepKey, { targetCount: 0 });
            setMessage({ type: 'ok', text: 'Hedef temizlendi' });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Hedef silinemedi' });
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <AuthGuard requireAdmin>
            <Sidebar />
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
                        <div>
                            <h1 className="header-title">
                                <Users size={32} style={{ display: 'inline', marginRight: '12px' }} />
                                Bölüm kapasitesi
                            </h1>
                            <p className="header-subtitle">
                                Haftalık kişi sayısı, çalışma saatleri ve isteğe bağlı hedef adet — Verimlilik
                                raporunda verim ve hedef sapması bu verilerle hesaplanır.
                            </p>
                        </div>
                        <Link href="/verimlilik" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Gauge size={18} />
                            Verimlilik raporu
                        </Link>
                    </div>

                    <div
                        className="card"
                        style={{
                            padding: '14px 18px',
                            fontSize: '13px',
                            color: 'var(--muted)',
                            maxWidth: '960px',
                            lineHeight: 1.55,
                        }}
                    >
                        <strong style={{ color: '#334155' }}>Varsayılan çalışma:</strong> Pazartesi–Cumartesi 09:00–17:30
                        (TR), 12:30–13:30 mola → kişi başı haftalık <strong>{hoursPerPerson}</strong> net saat. Mesaiyi
                        ayrı girin; normal saati değiştirmek için hücreyi düzenleyin veya &quot;{hoursPerPerson}h/kişi&quot; ile
                        kişi sayısından doldurun.
                        {scheduleDesc && (
                            <span style={{ display: 'block', marginTop: '8px', fontSize: '12px' }}>{scheduleDesc}</span>
                        )}
                    </div>
                </header>

                {message && (
                    <div
                        style={{
                            padding: '12px 16px',
                            marginBottom: '16px',
                            borderRadius: '8px',
                            background: message.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: message.type === 'ok' ? '#166534' : '#991b1b',
                        }}
                    >
                        {message.text}
                    </div>
                )}

                <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: '8px', background: 'var(--card-bg)', padding: '4px', borderRadius: '8px' }}>
                            {(['DAMPER', 'DORSE', 'SASI'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setProductType(t)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: productType === t ? 'var(--primary)' : 'transparent',
                                        color: productType === t ? 'white' : 'var(--muted)',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                    }}
                                >
                                    {t === 'DAMPER' ? 'Damper' : t === 'DORSE' ? 'Dorse' : 'Şasi'}
                                </button>
                            ))}
                        </div>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--muted)' }}>
                            Hafta (takvimden gün seçin; Pazartesiye hizalanır)
                            <input
                                type="date"
                                value={weekInput}
                                onChange={e => setWeekInput(e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                            />
                        </label>
                        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                            Kayıt haftası: <strong>{weekStart}</strong>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 className="animate-spin" size={40} />
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '720px' }}>
                            <thead>
                                <tr style={{ background: 'rgba(2,35,71,0.06)', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px' }}>Bölüm</th>
                                    <th style={{ padding: '12px 16px' }}>Kişi</th>
                                    <th style={{ padding: '12px 16px' }}>Normal saat (toplam)</th>
                                    <th style={{ padding: '12px 16px' }}>Mesai saat</th>
                                    <th style={{ padding: '12px 16px' }} title="Haftalık tamamlanması hedeflenen adet (Verimlilik)">
                                        Hedef adet
                                    </th>
                                    <th style={{ padding: '12px 16px' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.mainStepKey} style={{ borderTop: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>{r.label}</td>
                                        <td style={{ padding: '8px 16px' }}>
                                            <input
                                                type="number"
                                                min={0}
                                                value={r.headcount}
                                                onChange={e => updateRow(r.mainStepKey, { headcount: parseInt(e.target.value, 10) || 0 })}
                                                style={{ width: '72px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 16px' }}>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={r.normalHours}
                                                onChange={e =>
                                                    updateRow(r.mainStepKey, { normalHours: parseFloat(e.target.value) || 0 })
                                                }
                                                style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ marginLeft: '8px', fontSize: '11px', padding: '4px 8px' }}
                                                onClick={() => applyStandardHours(r.mainStepKey)}
                                                title={`Kişi × ${hoursPerPerson} saat`}
                                            >
                                                <Sparkles size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                                {hoursPerPerson}h/kişi
                                            </button>
                                        </td>
                                        <td style={{ padding: '8px 16px' }}>
                                            <input
                                                type="number"
                                                min={0}
                                                step={0.5}
                                                value={r.overtimeHours}
                                                onChange={e =>
                                                    updateRow(r.mainStepKey, { overtimeHours: parseFloat(e.target.value) || 0 })
                                                }
                                                style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                            />
                                        </td>
                                        <td style={{ padding: '8px 16px' }}>
                                            <input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={r.targetCount}
                                                onChange={e =>
                                                    updateRow(r.mainStepKey, { targetCount: parseInt(e.target.value, 10) || 0 })
                                                }
                                                style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                style={{ marginLeft: '6px', fontSize: '11px', padding: '4px 8px' }}
                                                disabled={savingKey === `t-${r.mainStepKey}`}
                                                onClick={() => saveTargetRow(r.mainStepKey)}
                                            >
                                                {savingKey === `t-${r.mainStepKey}` ? <Loader2 size={12} className="animate-spin" /> : null}
                                                Hedef kaydet
                                            </button>
                                            <button
                                                type="button"
                                                title="Hedefi sil"
                                                style={{
                                                    marginLeft: '4px',
                                                    padding: '4px 8px',
                                                    background: 'transparent',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                }}
                                                disabled={savingKey === `t-${r.mainStepKey}`}
                                                onClick={() => clearTargetRow(r.mainStepKey)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                        <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}
                                                disabled={savingKey === r.mainStepKey}
                                                onClick={() => saveRow(r.mainStepKey)}
                                            >
                                                {savingKey === r.mainStepKey ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                Kaydet
                                            </button>
                                            <button
                                                type="button"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '6px 10px',
                                                    background: 'transparent',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                }}
                                                disabled={savingKey === r.mainStepKey}
                                                onClick={() => clearRow(r.mainStepKey)}
                                            >
                                                <Trash2 size={14} /> Sil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </AuthGuard>
    );
}
