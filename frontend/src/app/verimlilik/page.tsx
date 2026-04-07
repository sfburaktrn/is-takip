'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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

function cell(label: string, value: ReactNode) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="font-medium text-slate-900 text-sm tabular-nums">{value}</div>
        </div>
    );
}

function VerimlilikStepMobileCard({ row }: { row: VerimlilikResponse['steps'][number] }) {
    const deltaPct =
        row.deltaPercent === null && row.previous === 0 && row.current > 0
            ? '—'
            : row.deltaPercent !== null
              ? `${row.deltaPercent}%`
              : '—';
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2 mb-3">{row.label}</div>
            <div className="grid grid-cols-2 gap-3">
                {cell('Adet', row.current)}
                {cell('Önceki', row.previous)}
                {cell(
                    'Fark',
                    <span className={row.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {row.delta >= 0 ? '+' : ''}
                        {row.delta}
                    </span>
                )}
                {cell('Δ%', deltaPct)}
                {cell('Hedef', row.targetInPeriod != null ? row.targetInPeriod : '—')}
                {cell(
                    'Sapma',
                    row.targetVariance != null ? (
                        <span className={row.targetVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {row.targetVariance >= 0 ? '+' : ''}
                            {row.targetVariance}
                        </span>
                    ) : (
                        '—'
                    )
                )}
                {cell('Kişi~', row.avgHeadcountInPeriod != null ? row.avgHeadcountInPeriod : '—')}
                {cell('Norm. saat', row.capacityNormalHours != null ? row.capacityNormalHours : '—')}
                {cell('Mesai', row.capacityOvertimeHours != null ? row.capacityOvertimeHours : '—')}
                {cell('Top. saat', row.capacityTotalHours != null ? row.capacityTotalHours : '—')}
                {cell(
                    'Verim',
                    row.efficiency != null
                        ? row.efficiency.toLocaleString('tr-TR', { maximumFractionDigits: 4 })
                        : '—'
                )}
            </div>
        </div>
    );
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
            <main className="main-content analytics-page">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col lg:flex-row w-full justify-between items-stretch lg:items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="header-title">
                                <Gauge size={32} className="inline mr-2 sm:mr-3 align-middle shrink-0" />
                                Verimlilik
                            </h1>
                            <p className="header-subtitle max-w-3xl">
                                Üretime girişi kayıtlı yeni damper, dorse ve şasilerde bölüm tamamlanma adetleri
                                (Son kontrol / muayene / teslimat damperde; dorse son kontrol hariç; şaside tüm ana
                                bölümler).
                            </p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2 w-full lg:w-auto shrink-0">
                            <button
                                type="button"
                                className="btn btn-primary analytics-touch-target justify-center text-sm px-3 sm:px-4"
                                onClick={load}
                            >
                                <RefreshCcw size={16} className="shrink-0" /> <span className="truncate">Yenile</span>
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary analytics-touch-target justify-center text-sm px-3 sm:px-4"
                                onClick={() => setShowHelp(true)}
                                title="Bu sayfa nasıl çalışır?"
                            >
                                <HelpCircle size={16} className="shrink-0" /> Yardım
                            </button>
                            {data && !loading && (
                                <button
                                    type="button"
                                    className="btn btn-secondary analytics-touch-target justify-center text-sm px-3 sm:px-4 col-span-2 sm:col-span-1"
                                    onClick={downloadCsv}
                                >
                                    <Download size={16} className="shrink-0" /> CSV
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    type="button"
                                    className="btn btn-secondary analytics-touch-target justify-center text-sm px-3 sm:px-4 col-span-2 sm:col-span-1"
                                    onClick={runAi}
                                    disabled={aiLoading}
                                >
                                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    AI
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-end w-full">
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
                        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0 sm:max-w-md">
                            <label className="flex flex-col gap-1 text-xs text-slate-500 min-w-0">
                                Başlangıç
                                <input
                                    type="date"
                                    value={fromDay}
                                    onChange={e => setFromDay(e.target.value)}
                                    className="min-h-11 px-2 sm:px-3 rounded-lg border border-slate-200 text-sm w-full bg-white"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-xs text-slate-500 min-w-0">
                                Bitiş
                                <input
                                    type="date"
                                    value={toDay}
                                    onChange={e => setToDay(e.target.value)}
                                    className="min-h-11 px-2 sm:px-3 rounded-lg border border-slate-200 text-sm w-full bg-white"
                                />
                            </label>
                        </div>
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
                        <div className="card p-4 sm:p-5 mb-4 text-sm text-slate-600 leading-relaxed">
                            <strong className="text-slate-900">T0 kaydı olan ürün sayısı:</strong>{' '}
                            {data.trackedProductCountWithT0}. Önceki dönem:{' '}
                            {new Date(data.previousFrom).toLocaleDateString('tr-TR')} —{' '}
                            {new Date(data.previousTo).toLocaleDateString('tr-TR')} (aynı uzunluk).
                            {data.scheduleDefaults && (
                                <div className="mt-2.5 text-xs sm:text-[13px]">
                                    <strong className="text-slate-700">Çalışma varsayımı:</strong> Haftada{' '}
                                    {data.scheduleDefaults.workDaysPerWeek} gün, günde {data.scheduleDefaults.netHoursPerDay} net
                                    saat → kişi başı {data.scheduleDefaults.hoursPerPersonWeek} saat. Kapasite:{' '}
                                    <Link href="/kapasite" className="text-[var(--primary)] font-semibold underline-offset-2 hover:underline">
                                        Bölüm kapasitesi
                                    </Link>
                                    .
                                </div>
                            )}
                            <div className="mt-2 text-xs sm:text-[13px] hidden sm:block">
                                Grafikteki adetler, seçilen aralıkta tamamlanan bölüm olaylarının{' '}
                                <code className="text-xs bg-slate-100 px-1 rounded">adet</code> toplamıdır. Kapasite ve hedef,
                                aralığa denk haftalar için orantılı toplanır. T0 olmayan kayıtlar raporda yoktur.
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

                        <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
                            <h3 className="mb-3 sm:mb-4 text-base font-bold text-slate-900">Dönem karşılaştırması</h3>
                            <div className="w-full h-[260px] sm:h-[320px] md:h-[380px] min-h-[220px] -mx-1 sm:mx-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 9 }}
                                            interval={0}
                                            angle={-35}
                                            textAnchor="end"
                                            height={72}
                                        />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
                                        <Tooltip contentStyle={{ fontSize: 12 }} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="secilen" name="Seçilen dönem" fill="#022347" radius={[3, 3, 0, 0]} maxBarSize={28} />
                                        <Bar dataKey="onceki" name="Önceki dönem" fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={28} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="md:hidden space-y-3 pb-6">
                            {data.steps.map(row => (
                                <VerimlilikStepMobileCard key={row.mainStepKey} row={row} />
                            ))}
                        </div>

                        <div className="card hidden md:block p-0 overflow-x-auto">
                            <table className="w-full border-collapse text-xs lg:text-[13px] min-w-[1000px]">
                                <thead>
                                    <tr className="bg-[rgba(2,35,71,0.06)] text-left">
                                        <th className="p-2 lg:p-3 xl:px-4 sticky left-0 bg-slate-100/95 z-[1] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Bölüm</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Adet</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Önceki</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Fark</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Δ%</th>
                                        <th className="p-2 lg:p-3 xl:px-4" title="Dönemle örtüşen haftaların hedef toplamı">
                                            Hedef
                                        </th>
                                        <th className="p-2 lg:p-3 xl:px-4" title="Gerçekleşen − hedef">
                                            Sapma
                                        </th>
                                        <th className="p-2 lg:p-3 xl:px-4" title="Ortalama kişi (kapasite girildiyse)">Kişi~</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Norm. saat</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Mesai</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Top. saat</th>
                                        <th className="p-2 lg:p-3 xl:px-4" title="Tamamlanan adet / toplam saat">Verim</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.steps.map(row => (
                                        <tr key={row.mainStepKey} className="border-t border-slate-200">
                                            <td className="p-2 lg:p-3 xl:px-4 font-medium sticky left-0 bg-white z-[1] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">{row.label}</td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">{row.current}</td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">{row.previous}</td>
                                            <td className={`p-2 lg:p-3 xl:px-4 tabular-nums ${row.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {row.delta >= 0 ? '+' : ''}
                                                {row.delta}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
                                                {row.deltaPercent === null && row.previous === 0 && row.current > 0
                                                    ? '—'
                                                    : row.deltaPercent !== null
                                                      ? `${row.deltaPercent}%`
                                                      : '—'}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
                                                {row.targetInPeriod != null ? row.targetInPeriod : '—'}
                                            </td>
                                            <td
                                                className={`p-2 lg:p-3 xl:px-4 tabular-nums ${
                                                    row.targetVariance == null
                                                        ? ''
                                                        : row.targetVariance >= 0
                                                          ? 'text-emerald-600'
                                                          : 'text-red-600'
                                                }`}
                                            >
                                                {row.targetVariance != null
                                                    ? `${row.targetVariance >= 0 ? '+' : ''}${row.targetVariance}`
                                                    : '—'}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
                                                {row.avgHeadcountInPeriod != null ? row.avgHeadcountInPeriod : '—'}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
                                                {row.capacityNormalHours != null ? row.capacityNormalHours : '—'}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
                                                {row.capacityOvertimeHours != null ? row.capacityOvertimeHours : '—'}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
                                                {row.capacityTotalHours != null ? row.capacityTotalHours : '—'}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 tabular-nums">
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
                                    className="card max-h-[85vh] overflow-y-auto w-full max-w-[520px] p-5 sm:p-6 relative text-sm leading-relaxed text-slate-600"
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
