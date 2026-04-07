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

type KapasiteRowProps = {
    r: CapacityWeekRow;
    hoursPerPerson: number;
    savingKey: string | null;
    updateRow: (mainStepKey: string, patch: Partial<CapacityWeekRow>) => void;
    applyStandardHours: (mainStepKey: string) => void;
    saveRow: (mainStepKey: string) => Promise<void>;
    clearRow: (mainStepKey: string) => Promise<void>;
    saveTargetRow: (mainStepKey: string) => Promise<void>;
    clearTargetRow: (mainStepKey: string) => Promise<void>;
};

function KapasiteMobileCard(p: KapasiteRowProps) {
    const { r, hoursPerPerson, savingKey, updateRow, applyStandardHours, saveRow, clearRow, saveTargetRow, clearTargetRow } = p;
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5 max-lg:space-y-6 max-lg:py-6">
            <div className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-3 max-lg:pb-4">{r.label}</div>
            <label className="block text-xs text-slate-500">
                Kişi sayısı
                <input
                    type="number"
                    min={0}
                    value={r.headcount}
                    onChange={e => updateRow(r.mainStepKey, { headcount: parseInt(e.target.value, 10) || 0 })}
                    className="mt-1 w-full min-h-11 px-3 rounded-lg border border-slate-200 text-base"
                />
            </label>
            <div>
                <label className="block text-xs text-slate-500 mb-1">Normal saat (toplam)</label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={r.normalHours}
                        onChange={e => updateRow(r.mainStepKey, { normalHours: parseFloat(e.target.value) || 0 })}
                        className="w-full sm:max-w-[140px] min-h-11 px-3 rounded-lg border border-slate-200 text-base"
                    />
                    <button
                        type="button"
                        className="btn btn-secondary text-xs py-2.5 px-3 analytics-touch-target shrink-0"
                        onClick={() => applyStandardHours(r.mainStepKey)}
                        title={`Kişi × ${hoursPerPerson} saat`}
                    >
                        <Sparkles size={14} className="inline mr-1" />
                        {hoursPerPerson}h/kişi
                    </button>
                </div>
            </div>
            <label className="block text-xs text-slate-500">
                Mesai saat
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={r.overtimeHours}
                    onChange={e => updateRow(r.mainStepKey, { overtimeHours: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full min-h-11 px-3 rounded-lg border border-slate-200 text-base"
                />
            </label>
            <div>
                <label className="block text-xs text-slate-500 mb-1">Hedef adet</label>
                <div className="flex flex-wrap gap-2 items-center">
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={r.targetCount}
                        onChange={e => updateRow(r.mainStepKey, { targetCount: parseInt(e.target.value, 10) || 0 })}
                        className="min-h-11 w-24 px-3 rounded-lg border border-slate-200 text-base"
                    />
                    <button
                        type="button"
                        className="btn btn-secondary text-xs py-2.5 px-3 flex-1 min-w-[120px] sm:flex-none analytics-touch-target"
                        disabled={savingKey === `t-${r.mainStepKey}`}
                        onClick={() => saveTargetRow(r.mainStepKey)}
                    >
                        {savingKey === `t-${r.mainStepKey}` ? <Loader2 size={14} className="animate-spin" /> : null}
                        Hedef kaydet
                    </button>
                    <button
                        type="button"
                        title="Hedefi sil"
                        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white"
                        disabled={savingKey === `t-${r.mainStepKey}`}
                        onClick={() => clearTargetRow(r.mainStepKey)}
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-4 mt-1 border-t border-slate-100 max-lg:pt-5 max-lg:gap-3">
                <button
                    type="button"
                    className="btn btn-primary flex-1 min-w-[140px] analytics-touch-target justify-center py-2.5"
                    disabled={savingKey === r.mainStepKey}
                    onClick={() => saveRow(r.mainStepKey)}
                >
                    {savingKey === r.mainStepKey ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Kaydet
                </button>
                <button
                    type="button"
                    className="btn btn-secondary flex-1 min-w-[100px] analytics-touch-target justify-center py-2.5"
                    disabled={savingKey === r.mainStepKey}
                    onClick={() => clearRow(r.mainStepKey)}
                >
                    <Trash2 size={16} /> Sil
                </button>
            </div>
        </div>
    );
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
            <main className="main-content analytics-page">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col lg:flex-row w-full justify-between items-stretch lg:items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="header-title">
                                <Users size={32} className="inline mr-2 sm:mr-3 align-middle shrink-0" />
                                Bölüm kapasitesi
                            </h1>
                            <p className="header-subtitle max-w-3xl">
                                Haftalık kişi sayısı, çalışma saatleri ve isteğe bağlı hedef adet — Verimlilik
                                raporunda verim ve hedef sapması bu verilerle hesaplanır.
                            </p>
                        </div>
                        <Link
                            href="/verimlilik"
                            className="btn btn-secondary analytics-touch-target justify-center shrink-0 w-full lg:w-auto inline-flex items-center gap-2"
                        >
                            <Gauge size={18} />
                            Verimlilik raporu
                        </Link>
                    </div>

                    <div className="card p-3 sm:p-4 text-xs sm:text-[13px] text-slate-600 max-w-full lg:max-w-[960px] leading-relaxed max-lg:mb-2">
                        <strong className="text-slate-700">Varsayılan çalışma:</strong> Pazartesi–Cumartesi 09:00–17:30
                        (TR), 12:30–13:30 mola → kişi başı haftalık <strong>{hoursPerPerson}</strong> net saat. Mesaiyi
                        ayrı girin; normal saati değiştirmek için hücreyi düzenleyin veya &quot;{hoursPerPerson}h/kişi&quot; ile
                        kişi sayısından doldurun.
                        {scheduleDesc && <span className="block mt-2 text-[11px] sm:text-xs text-slate-500">{scheduleDesc}</span>}
                    </div>
                </header>

                {message && (
                    <div
                        className="max-lg:mb-6 mb-4 rounded-lg px-4 py-3"
                        style={{
                            background: message.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                            color: message.type === 'ok' ? '#166534' : '#991b1b',
                        }}
                    >
                        {message.text}
                    </div>
                )}

                <div className="card p-4 sm:p-5 mb-6 sm:mb-5 max-lg:mb-8">
                    <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-end">
                        <div className="flex gap-1 sm:gap-2 bg-[var(--card)] p-1 rounded-lg border border-slate-200/80 w-full sm:w-auto justify-between sm:justify-start">
                            {(['DAMPER', 'DORSE', 'SASI'] as const).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setProductType(t)}
                                    className={`analytics-touch-target flex-1 sm:flex-none rounded-md px-3 sm:px-4 text-sm font-medium transition-colors ${
                                        productType === t
                                            ? 'bg-[var(--primary)] text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {t === 'DAMPER' ? 'Damper' : t === 'DORSE' ? 'Dorse' : 'Şasi'}
                                </button>
                            ))}
                        </div>
                        <label className="flex flex-col gap-1 text-xs text-slate-500 flex-1 min-w-[200px]">
                            Hafta (takvim; Pazartesiye hizalanır)
                            <input
                                type="date"
                                value={weekInput}
                                onChange={e => setWeekInput(e.target.value)}
                                className="min-h-11 px-3 rounded-lg border border-slate-200 text-base w-full max-w-xs bg-white"
                            />
                        </label>
                        <div className="text-sm text-slate-600 py-1 sm:pb-2">
                            Kayıt haftası: <strong className="text-slate-900">{weekStart}</strong>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
                        <Loader2 className="animate-spin" size={40} />
                    </div>
                ) : (
                    <>
                        <div className="lg:hidden flex flex-col gap-6 sm:gap-8 pb-10 pt-1">
                            {rows.map(r => (
                                <KapasiteMobileCard
                                    key={r.mainStepKey}
                                    r={r}
                                    hoursPerPerson={hoursPerPerson}
                                    savingKey={savingKey}
                                    updateRow={updateRow}
                                    applyStandardHours={applyStandardHours}
                                    saveRow={saveRow}
                                    clearRow={clearRow}
                                    saveTargetRow={saveTargetRow}
                                    clearTargetRow={clearTargetRow}
                                />
                            ))}
                        </div>
                        <div className="card hidden lg:block p-0 overflow-x-auto">
                        <table className="w-full border-collapse text-sm min-w-[720px]">
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
                    </>
                )}
            </main>
        </AuthGuard>
    );
}
