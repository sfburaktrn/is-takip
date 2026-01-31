'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getStats, type Stats, type StepStats, API_URL, getSasis } from '@/lib/api';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

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

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

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
    const pieChartData = stats ? [
        { name: 'Tamamlanan', value: stats.tamamlanan, color: '#10b981' },
        { name: 'Devam Eden', value: stats.devamEden, color: '#f59e0b' },
        { name: 'Başlamayan', value: stats.baslamayan, color: '#ef4444' },
    ] : [];

    // Stock vs Customer data for SASI
    const stockChartData = stats && productType === 'SASI' ? [
        { name: 'Müşteri', value: stats.musteriSasiCount || 0, color: '#4f46e5' },
        { name: 'Stok', value: stats.stokSasiCount || 0, color: '#f59e0b' },
    ] : [];

    return (
        <>
            <Sidebar />
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 className="header-title">📈 Analiz</h1>
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
                                🔄 Yenile
                            </button>
                        </div>
                    </div>

                    {/* Product Toggle */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
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
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                            <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon blue">📦</div>
                                <div>
                                    <div className="stat-value">{stats?.total || 0}</div>
                                    <div className="stat-label">Toplam {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'}</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon green">✅</div>
                                <div>
                                    <div className="stat-value">{stats?.tamamlanan || 0}</div>
                                    <div className="stat-label">Tamamlanan</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon yellow">🔄</div>
                                <div>
                                    <div className="stat-value">{stats?.devamEden || 0}</div>
                                    <div className="stat-label">Devam Eden</div>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon red">⏸️</div>
                                <div>
                                    <div className="stat-value">{stats?.baslamayan || 0}</div>
                                    <div className="stat-label">Başlamayan</div>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginTop: '24px' }}>
                            {/* Pie Chart - Status Distribution */}
                            <div className="card" style={{ padding: '20px' }}>
                                <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Durum Dağılımı</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={pieChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {pieChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
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
                            <div className="card" style={{ padding: '20px' }}>
                                <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Firma Dağılımı (Top 8)</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={companyDist}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            dataKey="count"
                                            label={({ name, payload }) => `${name}: ${payload?.count || 0}`}
                                        >
                                            {companyDist.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bar Chart - Step Completion */}
                        <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
                                {productType === 'SASI' ? 'Stok ve Müşteri Şasileri Tamamlanma Durumu' : 'Aşama Bazlı Tamamlanma Durumu'}
                            </h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: 'var(--muted)' }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={80}
                                    />
                                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted)' }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="tamamlandi" name="Tamamlandı" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="devamEdiyor" name="Devam Ediyor" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="baslamadi" name="Başlanmadı" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* M3 Based Charts */}
                        {productType !== 'SASI' && Object.keys(m3StepStats).length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--foreground)' }}>📦 M³ Bazlı İlerleme Durumları</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px' }}>
                                    {Object.entries(m3StepStats)
                                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                                        .map(([m3, stats]) => (
                                            <div key={m3} className="card" style={{ padding: '20px' }}>
                                                <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>{m3} M³</h3>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={getChartData(stats)} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                                        <XAxis
                                                            dataKey="name"
                                                            tick={{ fontSize: 10, fill: 'var(--muted)' }}
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={60}
                                                        />
                                                        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                                                        <Tooltip
                                                            contentStyle={{
                                                                background: 'var(--card)',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: '8px'
                                                            }}
                                                        />
                                                        <Legend />
                                                        <Bar dataKey="tamamlandi" name="Tamamlandı" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="devamEdiyor" name="Devam Ediyor" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                                                        <Bar dataKey="baslamadi" name="Başlanmadı" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Quick Stats Table */}
                        <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Genel Aşama Detayları</h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>Aşama</th>
                                            <th style={{ textAlign: 'center', color: '#ef4444' }}>Başlanmadı</th>
                                            <th style={{ textAlign: 'center', color: '#f59e0b' }}>Devam Ediyor</th>
                                            <th style={{ textAlign: 'center', color: '#10b981' }}>Tamamlandı</th>
                                            <th style={{ textAlign: 'left', width: '200px' }}>İlerleme</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {barChartData.map((row) => {
                                            const total = row.baslamadi + row.devamEdiyor + row.tamamlandi;
                                            const tamamlandiPct = total > 0 ? Math.round((row.tamamlandi / total) * 100) : 0;
                                            const devamPct = total > 0 ? Math.round((row.devamEdiyor / total) * 100) : 0;
                                            return (
                                                <tr key={row.name}>
                                                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                                                    <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{row.baslamadi}</td>
                                                    <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>{row.devamEdiyor}</td>
                                                    <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 600 }}>{row.tamamlandi}</td>
                                                    <td>
                                                        <div className="progress-bar" style={{ height: '8px', display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${tamamlandiPct}%`, background: '#10b981' }}></div>
                                                            <div style={{ width: `${devamPct}%`, background: '#f59e0b' }}></div>
                                                            <div style={{ flex: 1, background: '#ef4444' }}></div>
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
                        {productType !== 'SASI' && Object.keys(m3StepStats).length > 0 && (
                            <div style={{ marginTop: '32px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--foreground)' }}>📋 M³ Bazlı Aşama Detayları</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '20px' }}>
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
                        )}

                        {/* Today's Activity - Report Format */}
                        <div className="card" style={{ padding: '20px', marginTop: '20px' }}>
                            <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                📋 Günlük Rapor - {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                <span className="badge badge-primary" style={{ fontSize: '12px' }}>{recentActivity.length} kayıt</span>
                            </h3>
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
                                                    gap: '12px',
                                                    padding: '10px 14px',
                                                    background: 'var(--secondary)',
                                                    borderRadius: '8px',
                                                    borderLeft: '3px solid var(--primary)'
                                                }}
                                            >
                                                <div style={{
                                                    minWidth: '45px',
                                                    fontWeight: 600,
                                                    color: 'var(--primary)',
                                                    fontSize: '13px'
                                                }}>
                                                    {time}
                                                </div>
                                                <div style={{ flex: 1, fontSize: '13px' }}>
                                                    <span style={{ fontWeight: 600 }}>{activity.musteri}</span>
                                                    <span style={{ color: 'var(--muted)' }}>'nda </span>
                                                    {activity.completedSubSteps && activity.completedSubSteps.length > 0 ? (
                                                        <span>{activity.completedSubSteps.join(', ')}</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>iş sürecinde</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
                                    <div>Bugün henüz iş kaydı yok</div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main >
        </>
    );
}
