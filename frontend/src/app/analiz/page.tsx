'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getStats, type Stats, type StepStats, API_URL, getSasis } from '@/lib/api';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
    LineChart as LineChartIcon,
    RefreshCcw,
    Package,
    CheckCircle,
    PauseCircle,
    Loader2,
    Inbox,
    Clock
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

type ProductType = 'DAMPER' | 'DORSE' | 'SASI';

const COLORS = {
    primary: '#022347',
    secondary: '#64748B',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    grid: '#E2E8F0',
    charts: ['#022347', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1']
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                backgroundColor: 'white',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                minWidth: '150px'
            }}>
                <p style={{ fontWeight: 600, color: '#1E293B', marginBottom: '8px', fontSize: '14px' }}>{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
                        <span style={{ fontSize: '12px', color: '#64748B' }}>{entry.name}:</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginLeft: 'auto' }}>
                            {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function Analiz() {
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const [stats, setStats] = useState<Stats | null>(null);
    const [stepStats, setStepStats] = useState<StepStats | null>(null);
    const [m3StepStats, setM3StepStats] = useState<Record<string, StepStats>>({});
    const [companyDist, setCompanyDist] = useState<CompanyDist[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [sasiBarData, setSasiBarData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            // Add timestamp to prevent caching
            const timestamp = Date.now();
            const fetchOptions = { cache: 'no-store' as const, credentials: 'include' as const };

            // Build query param
            const query = `?type=${productType}&t=${timestamp}`;

            const [statsData, stepStatsRes, companyDistRes, activityRes] = await Promise.all([
                getStats(productType),
                fetch(`${API_URL}/analytics/step-stats${query}`, fetchOptions).then(r => r.json()),
                fetch(`${API_URL}/analytics/company-distribution${query}`, fetchOptions).then(r => r.json()),
                fetch(`${API_URL}/analytics/recent-activity${query}`, fetchOptions).then(r => r.json())
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

                sasis.forEach((s: any) => {
                    const completedCount = sasiSteps.filter(step => s[step] === true).length;
                    let status = 'devamEdiyor';
                    if (completedCount === 0) status = 'baslamadi';
                    else if (completedCount === sasiSteps.length) status = 'tamamlandi';

                    const isStock = s.musteri && s.musteri.toLowerCase().startsWith('stok');
                    const target = isStock ? stockStats : customerStats;

                    // @ts-ignore
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
    };

    useEffect(() => {
        loadData();
    }, [productType]);

    // Helper to default non-existent stats
    const getStat = (stat: any) => stat || { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 };

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

    return (
        <>
            <Sidebar />
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
                        <div>
                            <h1 className="header-title"><LineChartIcon size={32} style={{ display: 'inline', marginRight: '12px' }} /> Analiz</h1>
                            <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'} üretim verileri ve istatistikler</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                Son güncelleme: {isMounted ? lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                            </span>
                            <button
                                className="btn btn-primary"
                                onClick={loadData}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <RefreshCcw size={16} /> Yenile
                            </button>
                        </div>
                    </div>

                    {/* Product Toggle */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                        <button
                            type="button"
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: productType === 'DAMPER' ? 'var(--primary)' : 'transparent',
                                color: productType === 'DAMPER' ? 'white' : 'var(--muted)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setProductType('DAMPER')}
                        >
                            Damperler
                        </button>
                        <button
                            type="button"
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: productType === 'DORSE' ? 'var(--primary)' : 'transparent',
                                color: productType === 'DORSE' ? 'white' : 'var(--muted)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setProductType('DORSE')}
                        >
                            Dorseler
                        </button>
                        <button
                            type="button"
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                border: 'none',
                                background: productType === 'SASI' ? 'var(--primary)' : 'transparent',
                                color: productType === 'SASI' ? 'white' : 'var(--muted)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setProductType('SASI')}
                        >
                            Şasiler
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><Loader2 size={48} className="animate-spin" /></div>
                            <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="stats-grid">
                            <div className="stat-card" style={{ borderLeft: `4px solid ${COLORS.primary}` }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Package size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B' }}>{stats?.total || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B' }}>Toplam {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'}</div>
                                </div>
                            </div>
                            <div className="stat-card" style={{ borderLeft: `4px solid ${COLORS.success}` }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <CheckCircle size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B' }}>{stats?.tamamlanan || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B' }}>Tamamlanan</div>
                                </div>
                            </div>
                            <div className="stat-card" style={{ borderLeft: `4px solid ${COLORS.warning}` }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <RefreshCcw size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B' }}>{stats?.devamEden || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B' }}>Devam Eden</div>
                                </div>
                            </div>
                            <div className="stat-card" style={{ borderLeft: `4px solid ${COLORS.danger}` }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', color: COLORS.danger,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <PauseCircle size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B' }}>{stats?.baslamayan || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B' }}>Başlamayan</div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginTop: '24px' }}>
                            {/* Status Distribution - Donut Chart */}
                            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>Durum Dağılımı</h3>
                                    <p style={{ fontSize: '12px', color: '#64748B' }}>Genel üretim durumu özeti</p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <PieChart>
                                            <Pie
                                                data={pieChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
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
                                    </ResponsiveContainer>
                                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                        {pieChartData.map((entry, index) => (
                                            <div key={index} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                backgroundColor: 'rgba(0,0,0,0.02)',
                                                borderRadius: '20px',
                                                border: '1px solid #E2E8F0'
                                            }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }} />
                                                <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>{entry.name}</span>
                                                <span style={{ fontSize: '13px', fontWeight: 700, color: entry.color, marginLeft: '2px' }}>{entry.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Stock vs Customer Chart - SASI Only */}
                            {productType === 'SASI' && (
                                <div className="card" style={{ padding: '20px' }}>
                                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Stok / Müşteri Dağılımı</h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie
                                                data={stockChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
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
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Pie Chart - Company Distribution */}
                            <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>Firma Dağılımı</h3>
                                    <p style={{ fontSize: '12px', color: '#64748B' }}>En yüksek hacimli 8 firma</p>
                                </div>
                                <div style={{ height: '280px' }}>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie
                                                data={companyDist}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="count"
                                                stroke="none"
                                            >
                                                {companyDist.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS.charts[index % COLORS.charts.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend
                                                layout="vertical"
                                                verticalAlign="middle"
                                                align="right"
                                                iconType="circle"
                                                iconSize={8}
                                                wrapperStyle={{ fontSize: '11px', color: '#475569' }}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Bar Chart - Step Completion */}
                        {/* Bar Chart - Step Completion (Horizontal) */}
                        <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
                            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>
                                        {productType === 'SASI' ? 'Şasi Tamamlanma Durumu' : 'Aşama Bazlı İlerleme'}
                                    </h3>
                                    <p style={{ fontSize: '12px', color: '#64748B' }}>Üretim aşamalarındaki yoğunluk analizi</p>
                                </div>
                            </div>
                            <div style={{ width: '100%', height: '400px', minHeight: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={barChartData}
                                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                                        barSize={24}
                                        barGap={4}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} />
                                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
                                            width={70}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(2, 35, 71, 0.03)' }} />
                                        <Legend
                                            verticalAlign="top"
                                            align="right"
                                            iconType="circle"
                                            iconSize={8}
                                            wrapperStyle={{ paddingBottom: '20px' }}
                                        />
                                        <Bar dataKey="tamamlandi" name="Tamamlandı" stackId="a" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="devamEdiyor" name="Devam Ediyor" stackId="a" fill={COLORS.warning} radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="baslamadi" name="Başlanmadı" stackId="a" fill={COLORS.danger} radius={[0, 0, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* M3 Based Charts */}
                        {productType !== 'SASI' && Object.keys(m3StepStats).length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Package size={20} /> M³ Bazlı İlerleme Durumları
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                    {Object.entries(m3StepStats)
                                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                                        .map(([m3, stats]) => (
                                            <div key={m3} className="card" style={{ padding: '24px' }}>
                                                <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>{m3} M³ İlerleme</h3>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart
                                                        layout="vertical"
                                                        data={getChartData(stats)}
                                                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                                                        barSize={20}
                                                        barGap={2}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} />
                                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                                        <YAxis
                                                            dataKey="name"
                                                            type="category"
                                                            tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
                                                            width={65}
                                                            axisLine={false}
                                                            tickLine={false}
                                                        />
                                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(2, 35, 71, 0.03)' }} />
                                                        <Legend verticalAlign="top" align="right" iconType="circle" iconSize={6} />
                                                        <Bar dataKey="tamamlandi" name="Tamamlandı" stackId="a" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                                        <Bar dataKey="devamEdiyor" name="Devam Ediyor" stackId="a" fill={COLORS.warning} radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="baslamadi" name="Başlanmadı" stackId="a" fill={COLORS.danger} radius={[0, 0, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Stats Table */}
                        {/* Quick Stats Table */}
                        <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
                            <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 700, color: '#1E293B' }}>Genel Aşama Detayları</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left', padding: '8px', color: '#64748B', fontSize: '12px', fontWeight: 600 }}>Aşama</th>
                                            <th style={{ textAlign: 'center', padding: '8px', color: COLORS.danger, fontSize: '12px', fontWeight: 600 }}>Başlanmadı</th>
                                            <th style={{ textAlign: 'center', padding: '8px', color: COLORS.warning, fontSize: '12px', fontWeight: 600 }}>Devam Ediyor</th>
                                            <th style={{ textAlign: 'center', padding: '8px', color: COLORS.success, fontSize: '12px', fontWeight: 600 }}>Tamamlandı</th>
                                            <th style={{ textAlign: 'left', width: '200px', padding: '8px', color: '#64748B', fontSize: '12px', fontWeight: 600 }}>İlerleme</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {barChartData.map((row) => {
                                            const total = row.baslamadi + row.devamEdiyor + row.tamamlandi;
                                            const tamamlandiPct = total > 0 ? Math.round((row.tamamlandi / total) * 100) : 0;
                                            const devamPct = total > 0 ? Math.round((row.devamEdiyor / total) * 100) : 0;
                                            return (
                                                <tr key={row.name} style={{ backgroundColor: '#F8FAFC' }}>
                                                    <td style={{ padding: '12px', fontWeight: 500, color: '#1E293B', borderRadius: '8px 0 0 8px' }}>{row.name}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px', color: COLORS.danger, fontWeight: 600 }}>{row.baslamadi}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px', color: COLORS.warning, fontWeight: 600 }}>{row.devamEdiyor}</td>
                                                    <td style={{ textAlign: 'center', padding: '12px', color: COLORS.success, fontWeight: 600 }}>{row.tamamlandi}</td>
                                                    <td style={{ padding: '12px', borderRadius: '0 8px 8px 0' }}>
                                                        <div className="progress-bar" style={{ height: '6px', display: 'flex', borderRadius: '3px', overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
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
                                <div style={{ marginTop: '32px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Package size={20} /> M³ Bazlı Aşama Detayları
                                    </h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {Object.entries(m3StepStats)
                                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                                            .map(([m3, stats]) => (
                                                <div key={m3} className="card" style={{ padding: '20px' }}>
                                                    <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>{m3} M³</h3>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table style={{ width: '100%' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ textAlign: 'left', fontSize: '12px' }}>Aşama</th>
                                                                    <th style={{ textAlign: 'center', color: '#ef4444', fontSize: '12px' }}>Başl.</th>
                                                                    <th style={{ textAlign: 'center', color: '#f59e0b', fontSize: '12px' }}>Devam</th>
                                                                    <th style={{ textAlign: 'center', color: '#10b981', fontSize: '12px' }}>Tamam</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {getChartData(stats).map((row) => (
                                                                    <tr key={row.name}>
                                                                        <td style={{ fontWeight: 500, fontSize: '12px' }}>{row.name}</td>
                                                                        <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600, fontSize: '12px' }}>{row.baslamadi}</td>
                                                                        <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600, fontSize: '12px' }}>{row.devamEdiyor}</td>
                                                                        <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600, fontSize: '12px' }}>{row.tamamlandi}</td>
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

                        {/* Today's Activity - Report Format */}
                        {/* Today's Activity - Report Format */}
                        <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={20} className="text-primary" /> Günlük Rapor
                                    <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748B' }}>
                                        {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </h3>
                                <span className="badge" style={{
                                    backgroundColor: COLORS.primary, color: 'white', fontSize: '12px',
                                    padding: '4px 10px', borderRadius: '20px'
                                }}>
                                    {recentActivity.length} kayıt
                                </span>
                            </div>

                            {recentActivity.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {recentActivity.map((activity) => {
                                        const time = new Date(activity.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div
                                                key={activity.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '16px',
                                                    padding: '12px 16px',
                                                    backgroundColor: '#F8FAFC',
                                                    borderRadius: '8px',
                                                    border: '1px solid #E2E8F0',
                                                    borderLeft: `3px solid ${COLORS.primary}`
                                                }}
                                            >
                                                <div style={{
                                                    minWidth: '50px',
                                                    fontWeight: 600,
                                                    color: COLORS.primary,
                                                    fontSize: '13px',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    {time}
                                                </div>
                                                <div style={{ flex: 1, fontSize: '13px', color: '#334155' }}>
                                                    <span style={{ fontWeight: 700, color: '#0F172A' }}>{activity.musteri}</span>
                                                    <span style={{ color: '#64748B' }}> — </span>
                                                    {activity.completedSubSteps && activity.completedSubSteps.length > 0 ? (
                                                        <span>{activity.completedSubSteps.join(', ')}</span>
                                                    ) : (
                                                        <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>işlem yapılıyor...</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                                    <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                                        <Inbox size={48} strokeWidth={1.5} />
                                    </div>
                                    <div style={{ fontSize: '14px' }}>Bugün henüz iş kaydı girilmedi</div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main >
        </>
    );
}
