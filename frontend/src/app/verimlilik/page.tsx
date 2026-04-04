'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/lib/AuthContext';
import {
    getVerimlilik,
    postAiInsight,
    type VerimlilikProductType,
    type VerimlilikResponse,
} from '@/lib/api';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Gauge, Loader2, RefreshCcw, Sparkles, Download, HelpCircle, X } from 'lucide-react';

function toExclusiveEndIso(dayStr: string): string {
    const d = new Date(dayStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}

function startOfDayIso(dayStr: string): string {
    const d = new Date(dayStr + 'T00:00:00');
    return d.toISOString();
}

export default function VerimlilikPage() {
    const { isAdmin } = useAuth();
    const [productType, setProductType] = useState<VerimlilikProductType>('DAMPER');
    const [fromDay, setFromDay] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    });
    const [toDay, setToDay] = useState(() => new Date().toISOString().slice(0, 10));
    const [data, setData] = useState<VerimlilikResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiText, setAiText] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const fromIso = startOfDayIso(fromDay);
            const toIso = toExclusiveEndIso(toDay);
            const res = await getVerimlilik(productType, fromIso, toIso);
            setData(res);
            setAiText(null);
            setAiError(null);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Veri yüklenemedi');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [productType, fromDay, toDay]);

    useEffect(() => {
        load();
    }, [load]);

    const chartData = useMemo(() => {
        if (!data?.steps) return [];
        return data.steps.map(s => ({
            name: s.label,
            secilen: s.current,
            onceki: s.previous,
        }));
    }, [data]);

    const downloadCsv = () => {
        if (!data?.steps?.length) return;
        const sep = ';';
        const headers = [
            'Bolum',
            'Adet',
            'Onceki',
            'Fark',
            'Hedef',
            'Sapma',
            'NormSaat',
            'Mesai',
            'TopSaat',
            'Verim',
        ];
        const lines = [headers.join(sep)];
        for (const row of data.steps) {
            lines.push(
                [
                    `"${(row.label || '').replace(/"/g, '""')}"`,
                    row.current,
                    row.previous,
                    row.delta,
                    row.targetInPeriod ?? '',
                    row.targetVariance ?? '',
                    row.capacityNormalHours ?? '',
                    row.capacityOvertimeHours ?? '',
                    row.capacityTotalHours ?? '',
                    row.efficiency ?? '',
                ].join(sep)
            );
        }
        const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `verimlilik-${productType}-${fromDay}-${toDay}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const runAi = async () => {
        try {
            setAiLoading(true);
            setAiError(null);
            const fromIso = startOfDayIso(fromDay);
            const toIso = toExclusiveEndIso(toDay);
            const { text } = await postAiInsight({ type: productType, from: fromIso, to: toIso });
            setAiText(text);
        } catch (e) {
            setAiError(e instanceof Error ? e.message : 'AI özeti alınamadı');
            setAiText(null);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <AuthGuard>
            <>
            <Sidebar />
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
                        <div>
                            <h1 className="header-title">
                                <Gauge size={32} style={{ display: 'inline', marginRight: '12px' }} />
                                Verimlilik
                            </h1>
                            <p className="header-subtitle">
                                Üretime girişi kayıtlı yeni damper, dorse ve şasilerde bölüm tamamlanma adetleri
                                (Son kontrol / muayene / teslimat damperde; dorse son kontrol hariç; şaside tüm ana
                                bölümler).
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <button type="button" className="btn btn-primary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <RefreshCcw size={16} /> Yenile
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setShowHelp(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                title="Bu sayfa nasıl çalışır?"
                            >
                                <HelpCircle size={16} /> Yardım
                            </button>
                            {data && !loading && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={downloadCsv}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Download size={16} /> CSV indir
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={runAi}
                                    disabled={aiLoading}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    AI özeti
                                </button>
                            )}
                        </div>
                    </div>

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
                            Başlangıç
                            <input
                                type="date"
                                value={fromDay}
                                onChange={e => setFromDay(e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)' }}
                            />
                        </label>
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--muted)' }}>
                            Bitiş
                            <input
                                type="date"
                                value={toDay}
                                onChange={e => setToDay(e.target.value)}
                                style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)' }}
                            />
                        </label>
                    </div>
                </header>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
                        <Loader2 size={40} className="animate-spin" />
                    </div>
                ) : error ? (
                    <div className="card" style={{ padding: '24px', color: '#b91c1c' }}>
                        {error}
                    </div>
                ) : data ? (
                    <>
                        <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', fontSize: '14px', color: 'var(--muted)' }}>
                            <strong style={{ color: 'var(--foreground, #0f172a)' }}>T0 kaydı olan ürün sayısı:</strong>{' '}
                            {data.trackedProductCountWithT0}. Önceki dönem:{' '}
                            {new Date(data.previousFrom).toLocaleDateString('tr-TR')} —{' '}
                            {new Date(data.previousTo).toLocaleDateString('tr-TR')} (aynı uzunluk).
                            {data.scheduleDefaults && (
                                <div style={{ marginTop: '10px', fontSize: '13px' }}>
                                    <strong style={{ color: '#334155' }}>Çalışma varsayımı:</strong> Haftada{' '}
                                    {data.scheduleDefaults.workDaysPerWeek} gün, günde {data.scheduleDefaults.netHoursPerDay} net
                                    saat → kişi başı {data.scheduleDefaults.hoursPerPersonWeek} saat. Kapasite girmek için{' '}
                                    <Link href="/kapasite" style={{ color: 'var(--primary, #022347)', fontWeight: 600 }}>
                                        Bölüm kapasitesi
                                    </Link>
                                    .
                                </div>
                            )}
                            <div style={{ marginTop: '8px', fontSize: '13px' }}>
                                Grafikteki adetler, seçilen aralıkta tamamlanan bölüm olaylarının{' '}
                                <code>adet</code> toplamıdır. Kapasite ve hedef değerleri, aralığa denk gelen haftalar için
                                orantılı toplanır. Hedef, Bölüm kapasitesi sayfasındaki &quot;Hedef adet&quot; alanından
                                girilir. Eski kayıtlar (T0 yok) bu raporda yer almaz; ürün veritabanındaki kayıtlar
                                silinmez.
                            </div>
                        </div>

                        {isAdmin && (aiText || aiError) && (
                            <div
                                className="card"
                                style={{
                                    padding: '16px 20px',
                                    marginBottom: '16px',
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                    borderLeft: '4px solid #6366f1',
                                }}
                            >
                                <div style={{ fontWeight: 700, marginBottom: '8px', color: '#312e81' }}>AI özeti (karar desteği)</div>
                                {aiError && <div style={{ color: '#b91c1c' }}>{aiError}</div>}
                                {aiText && <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{aiText}</div>}
                            </div>
                        )}

                        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 700 }}>Dönem karşılaştırması</h3>
                            <div style={{ width: '100%', height: 380 }}>
                                <ResponsiveContainer>
                                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={80} />
                                        <YAxis allowDecimals={false} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar dataKey="secilen" name="Seçilen dönem" fill="#022347" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="onceki" name="Önceki dönem" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="card" style={{ padding: '0', overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1100px' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(2,35,71,0.06)', textAlign: 'left' }}>
                                        <th style={{ padding: '12px 16px' }}>Bölüm</th>
                                        <th style={{ padding: '12px 16px' }}>Adet</th>
                                        <th style={{ padding: '12px 16px' }}>Önceki</th>
                                        <th style={{ padding: '12px 16px' }}>Fark</th>
                                        <th style={{ padding: '12px 16px' }}>Δ%</th>
                                        <th style={{ padding: '12px 16px' }} title="Dönemle örtüşen haftaların hedef toplamı">
                                            Hedef
                                        </th>
                                        <th style={{ padding: '12px 16px' }} title="Gerçekleşen − hedef">
                                            Sapma
                                        </th>
                                        <th style={{ padding: '12px 16px' }} title="Ortalama kişi (kapasite girildiyse)">Kişi~</th>
                                        <th style={{ padding: '12px 16px' }}>Norm. saat</th>
                                        <th style={{ padding: '12px 16px' }}>Mesai</th>
                                        <th style={{ padding: '12px 16px' }}>Top. saat</th>
                                        <th style={{ padding: '12px 16px' }} title="Tamamlanan adet / toplam saat">Verim</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.steps.map(row => (
                                        <tr key={row.mainStepKey} style={{ borderTop: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 500 }}>{row.label}</td>
                                            <td style={{ padding: '12px 16px' }}>{row.current}</td>
                                            <td style={{ padding: '12px 16px' }}>{row.previous}</td>
                                            <td style={{ padding: '12px 16px', color: row.delta >= 0 ? '#059669' : '#dc2626' }}>
                                                {row.delta >= 0 ? '+' : ''}
                                                {row.delta}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.deltaPercent === null && row.previous === 0 && row.current > 0
                                                    ? '—'
                                                    : row.deltaPercent !== null
                                                      ? `${row.deltaPercent}%`
                                                      : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.targetInPeriod != null ? row.targetInPeriod : '—'}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '12px 16px',
                                                    color:
                                                        row.targetVariance == null
                                                            ? undefined
                                                            : row.targetVariance >= 0
                                                              ? '#059669'
                                                              : '#dc2626',
                                                }}
                                            >
                                                {row.targetVariance != null
                                                    ? `${row.targetVariance >= 0 ? '+' : ''}${row.targetVariance}`
                                                    : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.avgHeadcountInPeriod != null ? row.avgHeadcountInPeriod : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.capacityNormalHours != null ? row.capacityNormalHours : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.capacityOvertimeHours != null ? row.capacityOvertimeHours : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.capacityTotalHours != null ? row.capacityTotalHours : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {row.efficiency != null ? row.efficiency.toLocaleString('tr-TR', { maximumFractionDigits: 4 }) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {showHelp && (
                            <div
                                role="dialog"
                                aria-modal="true"
                                style={{
                                    position: 'fixed',
                                    inset: 0,
                                    background: 'rgba(15,23,42,0.45)',
                                    zIndex: 1000,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '16px',
                                }}
                                onClick={() => setShowHelp(false)}
                            >
                                <div
                                    className="card"
                                    style={{
                                        maxWidth: '520px',
                                        width: '100%',
                                        padding: '24px',
                                        position: 'relative',
                                        fontSize: '14px',
                                        lineHeight: 1.55,
                                        color: '#334155',
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        aria-label="Kapat"
                                        onClick={() => setShowHelp(false)}
                                        style={{
                                            position: 'absolute',
                                            top: '12px',
                                            right: '12px',
                                            border: 'none',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            color: '#64748b',
                                        }}
                                    >
                                        <X size={22} />
                                    </button>
                                    <h3 style={{ margin: '0 0 12px', fontSize: '17px', color: '#0f172a' }}>Verimlilik nasıl okunur?</h3>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        <li style={{ marginBottom: '8px' }}>
                                            Sadece üretime giriş tarihi (T0) kayıtlı ürünlerin bölüm tamamlanma olayları sayılır.
                                        </li>
                                        <li style={{ marginBottom: '8px' }}>
                                            Kapasite ve hedef, seçtiğiniz tarih aralığına düşen haftalar için orantılı hesaplanır;
                                            çok haftalı aralıklarda değerler otomatik birleşir.
                                        </li>
                                        <li style={{ marginBottom: '8px' }}>
                                            Hedef girmediyseniz &quot;Hedef&quot; ve &quot;Sapma&quot; sütunları boş kalır; bu normaldir.
                                        </li>
                                        <li>CSV, tabloyu Excel ile paylaşmak içindir (UTF-8, noktalı virgül ayraçlı).</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </main>
            </>
        </AuthGuard>
    );
}
