'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { getStats, type Stats, type StepStats, type Sasi, API_URL, apiFetch, getSasis } from '@/lib/api';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import {
    LineChart as LineChartIcon,
    RefreshCcw,
    Package,
    CheckCircle,
    PauseCircle,
    Inbox,
    Clock,
    Gauge,
    Hash,
} from 'lucide-react';

interface CompanyDist {
    name: string;
    count: number;
    [key: string]: string | number;
}

interface RecentActivity {
    id: number;
    imalatNo: number;
    musteri: string;
    updatedAt: string;
    kesimBukumStatus: string;
    montajStatus: string;
    boyaBitisStatus: string;
    teslimatStatus: string;
    completedSubSteps: string[];
}

/** "Adım adı (Aşama)" biçimini ayrıştırır. */
function parseActivityStep(raw: string): { label: string; phase: string | null } {
    const trimmed = raw.trim();
    const open = trimmed.lastIndexOf('(');
    const close = trimmed.lastIndexOf(')');
    if (open > 0 && close > open && close === trimmed.length - 1) {
        const label = trimmed.slice(0, open).trim();
        const phase = trimmed.slice(open + 1, close).trim();
        if (label && phase) return { label, phase };
    }
    return { label: trimmed, phase: null };
}

const DAILY_PHASE_ORDER: string[] = [
    'Kesim-Büküm',
    'Şasi Bitiş',
    'Ön Hazırlık',
    'Montaj',
    'Hidrolik',
    'Boya',
    'Boya Bitiş',
    'Çekici',
    'Tamamlama',
    'Tamamlama Bitiş',
    'Son Kontrol',
    'Kurum Muay.',
    'Kurum Muayenesi',
    'DMO Muay.',
    'DMO Muayenesi',
    'Teslimat',
];

function phaseSortKey(phase: string): number {
    const i = DAILY_PHASE_ORDER.indexOf(phase);
    return i >= 0 ? i : 999;
}

function groupStepsByPhase(steps: string[]): { phase: string; labels: string[] }[] {
    const map = new Map<string, string[]>();
    for (const raw of steps) {
        const { label, phase } = parseActivityStep(raw);
        const key = phase ?? 'Genel';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(label);
    }
    return [...map.entries()]
        .map(([phase, labels]) => ({ phase, labels: [...new Set(labels)] }))
        .sort((a, b) => {
            const da = phaseSortKey(a.phase);
            const db = phaseSortKey(b.phase);
            if (da !== db) return da - db;
            return a.phase.localeCompare(b.phase, 'tr');
        });
}

/** İnsanî okunuş: "A, B ve C" */
function joinTurkishNatural(parts: string[]): string {
    const p = parts.map((s) => s.trim()).filter(Boolean);
    if (p.length === 0) return '';
    if (p.length === 1) return p[0];
    if (p.length === 2) return `${p[0]} ve ${p[1]}`;
    return `${p.slice(0, -1).join(', ')} ve ${p[p.length - 1]}`;
}

/**
 * "ARNAVUTKÖY BELEDİYESİ 2" gibi kayıtlarda sondaki boşluk + tam sayıyı araç sırası sayar;
 * isimde sayı yoksa tüm metin müşteri adı olarak kalır.
 */
function splitMusteriArac(musteri: string): { base: string; aracNo: number | null } {
    const t = musteri.trim();
    const m = t.match(/^(.+?)\s+(\d+)$/);
    if (!m) return { base: t, aracNo: null };
    const base = m[1].trim();
    const aracNo = Number.parseInt(m[2], 10);
    if (!base || Number.isNaN(aracNo)) return { base: t, aracNo: null };
    return { base, aracNo };
}

/** Günlük özet cümlesi: müşteri / N. araç iyelik + yer eki */
function dailySummaryMusteriClause(base: string, aracNo: number | null): string {
    if (aracNo == null) return `${base} müşterisinde`;
    return `${base} müşterisinin ${aracNo}. aracında`;
}

type ProductType = 'DAMPER' | 'DORSE' | 'SASI';

const COLORS = {
    primary: 'var(--primary)',
    secondary: 'var(--foreground-secondary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    info: 'var(--control-fill)',
    grid: 'var(--border)',
    charts: [
        'var(--primary)',
        'var(--foreground-secondary)',
        'var(--success)',
        'var(--warning)',
        'var(--danger)',
        'var(--accent)',
    ],
};

type TooltipEntry = { name?: string; value?: string | number; color?: string };

function CustomTooltip({
    active,
    payload,
    label
}: {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
}) {
    if (active && payload && payload.length) {
        return (
            <div className="chart-tooltip">
                <p className="chart-tooltip__label">{label}</p>
                {payload.map((entry, index: number) => (
                    <div key={index} className="chart-tooltip__row">
                        <div className="chart-tooltip__dot" style={{ backgroundColor: entry.color }} />
                        <span className="chart-tooltip__name">{entry.name}:</span>
                        <span className="chart-tooltip__value">{entry.value}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
}

type SasiBarRow = { name: string; baslamadi: number; devamEdiyor: number; tamamlandi: number; total: number };

export default function Analiz() {
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const [stats, setStats] = useState<Stats | null>(null);
    const [stepStats, setStepStats] = useState<StepStats | null>(null);
    const [m3StepStats, setM3StepStats] = useState<Record<string, StepStats>>({});
    const [companyDist, setCompanyDist] = useState<CompanyDist[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [sasiBarData, setSasiBarData] = useState<SasiBarRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            // Add timestamp to prevent caching
            const timestamp = Date.now();
            const fetchOptions = { cache: 'no-store' as const, credentials: 'include' as const };

            // Build query param
            const query = `?type=${productType}&t=${timestamp}`;

            const [statsData, stepStatsRes, companyDistRes, activityRes] = await Promise.all([
                getStats(productType),
                apiFetch(`${API_URL}/analytics/step-stats${query}`, fetchOptions).then(r => r.json()),
                apiFetch(`${API_URL}/analytics/company-distribution${query}`, fetchOptions).then(r => r.json()),
                apiFetch(`${API_URL}/analytics/recent-activity${query}`, fetchOptions).then(r => r.json())
            ]);

            if (productType === 'SASI') {
                const sasis = await getSasis();
                const sasiSteps = [
                    // Kesim
                    'plazmaProgrami', 'sacMalzemeKontrolu', 'plazmaKesim', 'presBukum',
                    // On Hazirlik
                    'lenjorenMontaji', 'robotKaynagi',
                    // Montaj
                    'saseFiksturCatim', 'kaynak', 'dingilMontaji', 'genelKaynak', 'tesisatCubugu', 'mekanikAyak', 'korukMontaji', 'lastikMontaji'
                ];

                const customerStats = { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 };
                const stockStats = { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 };

                type SasiAggKey = 'baslamadi' | 'devamEdiyor' | 'tamamlandi';
                sasis.forEach((s: Sasi) => {
                    const completedCount = sasiSteps.filter(step => s[step as keyof Sasi] === true).length;
                    let status: SasiAggKey = 'devamEdiyor';
                    if (completedCount === 0) status = 'baslamadi';
                    else if (completedCount === sasiSteps.length) status = 'tamamlandi';

                    const isStock = s.musteri && s.musteri.toLowerCase().startsWith('stok');
                    const target = isStock ? stockStats : customerStats;

                    target[status]++;
                    target.total++;
                });

                setSasiBarData([
                    { name: 'Müşteri Şasileri', ...customerStats },
                    { name: 'Stok Şasileri', ...stockStats }
                ]);
            }

            console.log('Activity refreshed:', activityRes);
            setStats(statsData);
            setStepStats(stepStatsRes.total);
            setM3StepStats(stepStatsRes.byM3 || {});
            setCompanyDist(companyDistRes);
            setRecentActivity(activityRes);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error loading analytics data:', error);
        } finally {
            setLoading(false);
        }
    }, [productType]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    // Helper to default non-existent stats
    type StepAgg = { baslamadi?: number; devamEdiyor?: number; tamamlandi?: number; total?: number };
    const getStat = (stat: StepAgg | null | undefined) =>
        stat ?? { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 };

    // Helper to prepare chart data
    const getChartData = (s: StepStats | null) => {
        if (!s) return [];

        if (productType === 'DORSE') {
            return [
                { name: 'Kesim-Büküm', ...getStat(s.kesimBukum) },
                { name: 'Ön Hazırlık', ...getStat(s.onHazirlik) },
                { name: 'Montaj', ...getStat(s.montaj) },
                { name: 'Boya', ...getStat(s.boya) },
                { name: 'Tamamlama', ...getStat(s.tamamlama) },
                { name: 'Son Kontrol', ...getStat(s.sonKontrol) },
                { name: 'Kurum Muay.', ...getStat(s.kurumMuayenesi) },
                { name: 'DMO Muay.', ...getStat(s.dmoMuayenesi) },
                { name: 'Teslimat', ...getStat(s.teslimat) },
            ];
        }

        if (productType === 'SASI') {
            return [
                { name: 'Kesim-Büküm', ...getStat(s.kesimBukum) },
                { name: 'Ön Hazırlık', ...getStat(s.onHazirlik) },
                { name: 'Montaj', ...getStat(s.montaj) },
            ];
        }

        // DAMPER
        return [
            { name: 'Kesim-Büküm', ...getStat(s.kesimBukum) },
            { name: 'Şasi Bitiş', ...getStat(s.sasiBitis) },
            { name: 'Ön Hazırlık', ...getStat(s.onHazirlik) },
            { name: 'Montaj', ...getStat(s.montaj) },
            { name: 'Hidrolik', ...getStat(s.hidrolik) },
            { name: 'Boya', ...getStat(s.boyaBitis) },
            { name: 'Tamamlama', ...getStat(s.tamamlamaBitis) },
            { name: 'Son Kontrol', ...getStat(s.sonKontrol) },
            { name: 'Kurum Muay.', ...getStat(s.kurumMuayenesi) },
            { name: 'DMO Muay.', ...getStat(s.dmoMuayenesi) },
            { name: 'Teslimat', ...getStat(s.teslimat) },
        ];
    };

    const barChartData = productType === 'SASI' ? sasiBarData : getChartData(stepStats);

    // Pie chart data for status distribution
    // Pie chart data for status distribution
    const pieChartData = stats ? [
        { name: 'Tamamlanan', value: stats.tamamlanan, color: COLORS.success },
        { name: 'Devam Eden', value: stats.devamEden, color: COLORS.warning },
        { name: 'Başlamayan', value: stats.baslamayan, color: COLORS.danger },
    ] : [];

    // Stock vs Customer data for SASI
    const stockChartData = stats && productType === 'SASI' ? [
        { name: 'Müşteri', value: stats.musteriSasiCount || 0, color: COLORS.primary },
        { name: 'Stok', value: stats.stokSasiCount || 0, color: COLORS.warning },
    ] : [];

    const dailyReportSummaryText = useMemo(() => {
        if (recentActivity.length === 0) return '';

        const firmaSirasi: string[] = [];
        const seen = new Set<string>();
        for (const a of recentActivity) {
            const f = (a.musteri || '').trim();
            if (!f || seen.has(f)) continue;
            seen.add(f);
            firmaSirasi.push(f);
        }

        const maxFirmShow = 4;
        const shown = firmaSirasi.slice(0, maxFirmShow);
        const kalanFirma = firmaSirasi.length - shown.length;

        const firmaCümlesi = (firma: string): string => {
            const { base, aracNo } = splitMusteriArac(firma);
            const müşteriÖn = dailySummaryMusteriClause(base, aracNo);

            const rawSteps: string[] = [];
            for (const a of recentActivity) {
                if ((a.musteri || '').trim() !== firma) continue;
                for (const raw of a.completedSubSteps || []) {
                    rawSteps.push(raw);
                }
            }

            if (rawSteps.length === 0) {
                return `${müşteriÖn} güncelleme var, ancak tamamlanan adım satırı henüz listelenmiyor`;
            }

            const groups = groupStepsByPhase(rawSteps);
            const fazParçaları = groups.map((g) => {
                const labelsSorted = [...g.labels].sort((a, b) => a.localeCompare(b, 'tr'));
                const etiketMetin = joinTurkishNatural(labelsSorted);
                return `${g.phase} tarafında ${etiketMetin}`;
            });

            const adımÖzeti = fazParçaları.join('; ');
            return `${müşteriÖn} bugün ${adımÖzeti} tamamlanmış görünüyor`;
        };

        const parçalar = shown.map(firmaCümlesi);
        if (parçalar.length === 0) {
            return 'Bugün bu listede firma bazında adım özeti oluşturulamadı.';
        }

        let metin = parçalar.map((p) => (p.endsWith('.') ? p : `${p}.`)).join(' ');

        if (kalanFirma > 0) {
            metin += ` Ayrıca listede ${kalanFirma} müşteri daha var; bu özet yalnızca ilk ${maxFirmShow} müşteri için tüm adımları listeler.`;
        }

        return `Bugünkü tabloya göre ${metin}`;
    }, [recentActivity]);

    return (
        <AuthGuard>
        <>
            <Sidebar />
            <main className="main-content apple-app-page">
                <div className="apple-canvas">
                <header className="header header--stack">
                    <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
                        <div>
                            <h1 className="header-title">
                                <LineChartIcon size={32} className="page-title-leading-icon" /> Analiz
                            </h1>
                            <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'} üretim verileri ve istatistikler</p>
                        </div>
                        <div className="header-toolbar">
                            <span className="header-meta">
                                Son güncelleme: {isMounted ? lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                            </span>
                            <button className="btn btn-primary btn--row" onClick={loadData}>
                                <RefreshCcw size={16} /> Yenile
                            </button>
                        </div>
                    </div>

                    {/* Product Toggle */}
                    <div className="apple-segmented">
                        <button
                            type="button"
                            className={`apple-segmented-btn ${productType === 'DAMPER' ? 'is-active-brand' : ''}`}
                            onClick={() => setProductType('DAMPER')}
                        >
                            Damperler
                        </button>
                        <button
                            type="button"
                            className={`apple-segmented-btn ${productType === 'DORSE' ? 'is-active-brand' : ''}`}
                            onClick={() => setProductType('DORSE')}
                        >
                            Dorseler
                        </button>
                        <button
                            type="button"
                            className={`apple-segmented-btn ${productType === 'SASI' ? 'is-active-brand' : ''}`}
                            onClick={() => setProductType('SASI')}
                        >
                            Şasiler
                        </button>
                    </div>

                    <Link href="/verimlilik" className="card apple-link-card">
                        <Gauge size={22} className="apple-link-card__icon" />
                        <div>
                            <div className="apple-link-card__title">Verimlilik sayfası</div>
                            <div className="apple-link-card__desc">
                                Bu sayfa anlık durumu gösterir. Üretime girişi kayıtlı ürünlerde bölüm tamamlanma
                                trendi, kapasite ve (isteğe bağlı) AI özeti için Verimlilik&apos;e geçin.
                            </div>
                        </div>
                    </Link>
                </header>

                {loading ? (
                    <OzunluLoading variant="inline" />
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="stats-grid">
                            <div className="stat-card stat-card--accent-primary">
                                <div className="analiz-stat-icon analiz-stat-icon--primary">
                                    <Package size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value stat-value--default">{stats?.total || 0}</div>
                                    <div className="stat-label stat-label--default">Toplam {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'}</div>
                                </div>
                            </div>
                            <div className="stat-card stat-card--accent-success">
                                <div className="analiz-stat-icon analiz-stat-icon--success">
                                    <CheckCircle size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value stat-value--default">{stats?.tamamlanan || 0}</div>
                                    <div className="stat-label stat-label--default">Tamamlanan</div>
                                </div>
                            </div>
                            <div className="stat-card stat-card--accent-warning">
                                <div className="analiz-stat-icon analiz-stat-icon--warning">
                                    <RefreshCcw size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value stat-value--default">{stats?.devamEden || 0}</div>
                                    <div className="stat-label stat-label--default">Devam Eden</div>
                                </div>
                            </div>
                            <div className="stat-card stat-card--accent-danger">
                                <div className="analiz-stat-icon analiz-stat-icon--danger">
                                    <PauseCircle size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value stat-value--default">{stats?.baslamayan || 0}</div>
                                    <div className="stat-label stat-label--default">Başlamayan</div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="analiz-grid-charts">
                            {/* Status Distribution - Donut Chart */}
                            <div className="card analiz-card-pad analiz-card-col">
                                <div className="analiz-card-head">
                                    <h3 className="analiz-card-title">Durum Dağılımı</h3>
                                    <p className="analiz-card-desc">Genel üretim durumu özeti</p>
                                </div>
                                <div className="analiz-chart-center">
                                    <PieChart width={200} height={200}>
                                        <Pie
                                            data={pieChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={5}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                    </PieChart>
                                </div>
                                <div className="analiz-chart-center analiz-chart-center--wrap">
                                    {pieChartData.map((entry, index) => (
                                        <div key={index} className="analiz-legend-pill">
                                            <div className="analiz-legend-dot" style={{ backgroundColor: entry.color }} />
                                            <span className="analiz-legend-name">{entry.name}</span>
                                            <span className="analiz-legend-value" style={{ color: entry.color }}>{entry.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Stock vs Customer Chart - SASI Only */}
                            {productType === 'SASI' && (
                                <div className="card analiz-card-pad--20">
                                    <h3 className="analiz-card-title analiz-card-title--mb16">Stok / Müşteri Dağılımı</h3>
                                    <div className="analiz-chart-center">
                                        <PieChart width={250} height={250}>
                                            <Pie
                                                data={stockChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={90}
                                                paddingAngle={5}
                                                dataKey="value"
                                                label={({ name, value }) => `${name}: ${value}`}
                                            >
                                                {stockChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend />
                                        </PieChart>
                                    </div>
                                </div>
                            )}

                            {/* Pie Chart - Company Distribution */}
                            <div className="card analiz-card-pad analiz-card-col analiz-card-col--fill">
                                <div className="analiz-card-head">
                                    <h3 className="analiz-card-title">Firma Dağılımı</h3>
                                    <p className="analiz-card-desc">En yüksek hacimli 8 firma</p>
                                </div>
                                <div className="analiz-chart-center">
                                    <PieChart width={200} height={200}>
                                        <Pie
                                            data={companyDist}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={2}
                                            dataKey="count"
                                            stroke="none"
                                        >
                                            {(productType === 'SASI' ? stockChartData : companyDist).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={(entry.color as string) || COLORS.charts[index % COLORS.charts.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </div>
                            </div>
                        </div>

                        {/* Bar Chart - Step Completion */}
                        {/* Bar Chart - Step Completion (Horizontal) */}
                        <div className="card analiz-card-pad analiz-card-mt">
                            <div className="analiz-card-head analiz-card-head--lg flex justify-between items-end">
                                <div>
                                    <h3 className="analiz-card-title">
                                        {productType === 'SASI' ? 'Şasi Tamamlanma Durumu' : 'Aşama Bazlı İlerleme'}
                                    </h3>
                                    <p className="analiz-card-desc">Üretim aşamalarındaki yoğunluk analizi</p>
                                </div>
                            </div>
                            <div className="analiz-bar-scroll">
                                <BarChart
                                    layout="vertical"
                                    width={350}
                                    height={300}
                                    data={barChartData}
                                    margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                                    barSize={20}
                                    barGap={4}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--foreground-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis
                                        dataKey="name"
                                        type="category"
                                        tick={{ fontSize: 11, fill: 'var(--foreground-secondary)', fontWeight: 500 }}
                                        width={100}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(2, 35, 71, 0.03)' }} />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        iconType="circle"
                                        iconSize={8}
                                        wrapperStyle={{ paddingBottom: '10px' }}
                                    />
                                    <Bar dataKey="tamamlandi" name="Tamamlandı" stackId="a" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                    <Bar dataKey="devamEdiyor" name="Devam Ediyor" stackId="a" fill={COLORS.warning} radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="baslamadi" name="Başlanmadı" stackId="a" fill={COLORS.danger} radius={[0, 0, 0, 0]} />
                                </BarChart>
                            </div>
                        </div>

                        {/* M3 Based Charts */}
                        {productType !== 'SASI' && Object.keys(m3StepStats).length > 0 && (
                            <div className="analiz-card-mt--32">
                                <h2 className="analiz-section-title">
                                    <Package size={20} /> M³ Bazlı İlerleme Durumları
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {Object.entries(m3StepStats)
                                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                                        .map(([m3, stats]) => (
                                            <div key={m3} className="card analiz-m3-card">
                                                <h3 className="analiz-m3-title">{m3} M³ İlerleme</h3>
                                                <div className="analiz-bar-scroll">
                                                    <BarChart
                                                        layout="vertical"
                                                        width={320}
                                                        height={280}
                                                        data={getChartData(stats)}
                                                        margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
                                                        barSize={18}
                                                        barGap={2}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} />
                                                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--foreground-secondary)' }} axisLine={false} tickLine={false} />
                                                        <YAxis
                                                            dataKey="name"
                                                            type="category"
                                                            tick={{ fontSize: 10, fill: 'var(--foreground-secondary)', fontWeight: 500 }}
                                                            width={90}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(2, 35, 71, 0.03)' }} />
                                                        <Legend verticalAlign="top" align="right" iconType="circle" iconSize={6} />
                                                        <Bar dataKey="tamamlandi" name="Tamamlandı" stackId="a" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                                        <Bar dataKey="devamEdiyor" name="Devam Ediyor" stackId="a" fill={COLORS.warning} radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="baslamadi" name="Başlanmadı" stackId="a" fill={COLORS.danger} radius={[0, 0, 0, 0]} />
                                                    </BarChart>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Stats Table */}
                        {/* Quick Stats Table */}
                        <div className="card analiz-card-pad analiz-card-mt">
                            <h3 className="analiz-m3-title">Genel Aşama Detayları</h3>
                            <div className="analiz-table-scroll">
                                <table className="analiz-table-steps">
                                    <thead>
                                        <tr>
                                            <th className="analiz-th analiz-th--left">Aşama</th>
                                            <th className="analiz-th analiz-th--center analiz-th--danger">Başlanmadı</th>
                                            <th className="analiz-th analiz-th--center analiz-th--warning">Devam Ediyor</th>
                                            <th className="analiz-th analiz-th--center analiz-th--success">Tamamlandı</th>
                                            <th className="analiz-th analiz-th--progress">İlerleme</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {barChartData.map((row) => {
                                            const b = row.baslamadi ?? 0;
                                            const d = row.devamEdiyor ?? 0;
                                            const t = row.tamamlandi ?? 0;
                                            const total = b + d + t;
                                            const tamamlandiPct = total > 0 ? Math.round((t / total) * 100) : 0;
                                            const devamPct = total > 0 ? Math.round((d / total) * 100) : 0;
                                            return (
                                                <tr key={row.name} className="analiz-tr-surface">
                                                    <td className="analiz-td analiz-td--name">{row.name}</td>
                                                    <td className="analiz-td analiz-td--center analiz-td--danger">{b}</td>
                                                    <td className="analiz-td analiz-td--center analiz-td--warning">{d}</td>
                                                    <td className="analiz-td analiz-td--center analiz-td--success">{t}</td>
                                                    <td className="analiz-td analiz-td--end">
                                                        <div className="analiz-progress-track">
                                                            <div style={{ width: `${tamamlandiPct}%`, background: COLORS.success }}></div>
                                                            <div style={{ width: `${devamPct}%`, background: COLORS.warning }}></div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* M3 Based Stats Table */}
                        {
                            productType !== 'SASI' && Object.keys(m3StepStats).length > 0 && (
                                <div className="analiz-card-mt--32">
                                    <h2 className="analiz-section-title">
                                        <Package size={20} /> M³ Bazlı Aşama Detayları
                                    </h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {Object.entries(m3StepStats)
                                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                                            .map(([m3, stats]) => (
                                                <div key={m3} className="card analiz-m3-card--sm">
                                                    <h3 className="analiz-m3-title--sm">{m3} M³</h3>
                                                    <div className="analiz-table-scroll">
                                                        <table className="analiz-table-compact">
                                                            <thead>
                                                                <tr>
                                                                    <th className="analiz-th analiz-th--left">Aşama</th>
                                                                    <th className="analiz-th analiz-th--center analiz-th--danger">Başl.</th>
                                                                    <th className="analiz-th analiz-th--center analiz-th--warning">Devam</th>
                                                                    <th className="analiz-th analiz-th--center analiz-th--success">Tamam</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {getChartData(stats).map((row) => (
                                                                    <tr key={row.name}>
                                                                        <td className="analiz-td-name-sm">{row.name}</td>
                                                                        <td className="analiz-td-num-sm analiz-td--danger">{row.baslamadi}</td>
                                                                        <td className="analiz-td-num-sm analiz-td--warning">{row.devamEdiyor}</td>
                                                                        <td className="analiz-td-num-sm analiz-td--success">{row.tamamlandi}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )
                        }

                        {/* Günlük rapor — okunabilir adım listesi + özet */}
                        <div className="card analiz-card-pad analiz-card-mt">
                            <div className="analiz-activity-head">
                                <h3 className="analiz-activity-title">
                                    <Clock size={20} className="text-primary" /> Günlük Rapor
                                    <span className="analiz-activity-date">
                                        {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </h3>
                                <span className="badge analiz-activity-badge">{recentActivity.length} kayıt</span>
                            </div>

                            {recentActivity.length > 0 ? (
                                <>
                                    <div className="analiz-daily-list">
                                        {recentActivity.map((activity) => {
                                            const time = new Date(activity.updatedAt).toLocaleTimeString('tr-TR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            });
                                            const phaseGroups = groupStepsByPhase(activity.completedSubSteps || []);
                                            const { base: musteriBase, aracNo } = splitMusteriArac(activity.musteri || '');

                                            return (
                                                <article key={activity.id} className="analiz-daily-card">
                                                    <div className="analiz-daily-card__head">
                                                        <time className="analiz-daily-time" dateTime={activity.updatedAt}>
                                                            {time}
                                                        </time>
                                                        <div className="analiz-daily-head-meta">
                                                            <span className="analiz-daily-imalat">
                                                                <Hash size={13} strokeWidth={2.25} aria-hidden />
                                                                İmalat {activity.imalatNo}
                                                            </span>
                                                            <div className="analiz-daily-musteri-row">
                                                                <span className="analiz-daily-musteri analiz-daily-musteri-name">
                                                                    {musteriBase}
                                                                </span>
                                                                {aracNo != null ? (
                                                                    <span className="analiz-daily-arac-badge">
                                                                        {aracNo}. aracı
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {phaseGroups.length > 0 ? (
                                                        <div className="analiz-daily-phases">
                                                            {phaseGroups.map((g) => (
                                                                <section key={`${activity.id}-${g.phase}`} className="analiz-daily-phase">
                                                                    <h4 className="analiz-daily-phase-title">{g.phase}</h4>
                                                                    <ul className="analiz-daily-step-ul">
                                                                        {g.labels.map((lbl, idx) => (
                                                                            <li key={`${g.phase}-${idx}-${lbl}`} className="analiz-daily-step-li">
                                                                                {lbl}
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </section>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="analiz-daily-empty-steps">
                                                            Bu kayıt için henüz adım listesi yok veya güncelleme sürüyor.
                                                        </p>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                    {dailyReportSummaryText ? (
                                        <p className="analiz-daily-summary" role="status">
                                            {dailyReportSummaryText}
                                        </p>
                                    ) : null}
                                </>
                            ) : (
                                <div className="analiz-empty">
                                    <div className="analiz-empty-icon">
                                        <Inbox size={48} strokeWidth={1.5} />
                                    </div>
                                    <div className="analiz-empty-text">Bugün henüz iş kaydı girilmedi</div>
                                </div>
                            )}
                        </div>
                    </>
                )
                }
                </div>
            </main>
        </>
        </AuthGuard>
    );
}
