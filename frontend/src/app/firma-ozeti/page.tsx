'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, ChevronDown, CheckCircle2, RefreshCw, XCircle, Search, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { getCompanySummary, deleteCompanyM3Group, type CompanySummary } from '@/lib/api';

type ProductType = 'DAMPER' | 'DORSE';

export default function FirmaOzeti() {
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const [companies, setCompanies] = useState<CompanySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCompanySummary(productType);
            setCompanies(data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }, [productType]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const handleDeleteM3Group = async (companyName: string, m3: string) => {
        if (!confirm(`${companyName} firmasına ait ${m3} m³ grubunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
            return;
        }

        try {
            await deleteCompanyM3Group(companyName, m3, productType);
            await loadData(); // Reload data to reflect changes
        } catch (error) {
            console.error('Error deleting M3 group:', error);
            alert('Silme işlemi başarısız oldu.');
        }
    };

    const getStatusBadge = (status: string | undefined) => {
        if (!status) return <span className="badge badge-muted status-badge-mini">-</span>;
        switch (status) {
            case 'TAMAMLANDI':
            case 'YAPILDI':
                return <span className="badge badge-success status-badge-mini">✓</span>;
            case 'DEVAM EDİYOR':
                return <span className="badge badge-warning status-badge-mini">⟳</span>;
            case 'BAŞLAMADI':
                return <span className="badge badge-danger status-badge-mini">✗</span>;
            default:
                return <span className="badge badge-muted status-badge-mini">-</span>;
        }
    };

    const getColumns = () => {
        if (productType === 'DORSE') {
            return [
                { key: 'kesimBukum', label: 'Kesim-Büküm', statusKey: 'kesimBukumStatus' },
                { key: 'onHazirlik', label: 'Ön Hazırlık', statusKey: 'onHazirlikStatus' },
                { key: 'montaj', label: 'Montaj', statusKey: 'montajStatus' },
                { key: 'boya', label: 'Boya', statusKey: 'boyaStatus' },
                { key: 'tamamlama', label: 'Tamamlama', statusKey: 'tamamlamaStatus' },
                { key: 'sonKontrol', label: 'Son Kontrol', statusKey: 'sonKontrolStatus' },
                { key: 'kurumMuayenesi', label: 'Kurum Muay.', statusKey: 'kurumMuayenesi' }, // Directly from item for table
                { key: 'dmoMuayenesi', label: 'DMO Muay.', statusKey: 'dmoMuayenesi' },
                { key: 'teslimat', label: 'Teslimat', statusKey: 'teslimatStatus' }
            ];
        }
        return [
            { key: 'kesimBukum', label: 'Kesim-Büküm', statusKey: 'kesimBukumStatus' },
            { key: 'sasiBitis', label: 'Şasi Bitiş', statusKey: 'sasiBitisStatus' },
            { key: 'onHazirlik', label: 'Ön Hazırlık', statusKey: 'onHazirlikStatus' },
            { key: 'montaj', label: 'Montaj', statusKey: 'montajStatus' },
            { key: 'hidrolik', label: 'Hidrolik', statusKey: 'hidrolikStatus' },
            { key: 'boyaBitis', label: 'Boya Bitiş', statusKey: 'boyaBitisStatus' },
            { key: 'tamamlamaBitis', label: 'Tamamlama', statusKey: 'tamamlamaBitisStatus' },
            { key: 'sonKontrol', label: 'Son Kontrol', statusKey: 'sonKontrolStatus' },
            { key: 'kurumMuayenesi', label: 'Kurum Muay.', statusKey: 'kurumMuayenesi' },
            { key: 'dmoMuayenesi', label: 'DMO Muay.', statusKey: 'dmoMuayenesi' },
            { key: 'teslimat', label: 'Teslimat', statusKey: 'teslimatStatus' }
        ];
    };

    const columns = getColumns();

    return (
        <AuthGuard>
        <>
            <Sidebar />
            <main className="main-content apple-app-page">
                <div className="apple-canvas">
                <header className="header header--stack">
                    <div className="dashboard-header-row header-row-full">
                        <div>
                            <h1 className="header-title">Firma Özeti</h1>
                            <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : 'Dorse'} sipariş ve üretim durumu özeti</p>
                        </div>

                        <div className={`fo-search${searchQuery ? ' fo-search--has-value' : ''}`}>
                            <Search className="fo-search__icon" size={18} strokeWidth={1.75} aria-hidden />
                            <input
                                type="search"
                                className="fo-search__input"
                                placeholder="Firma ara…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Firma ara"
                                autoComplete="off"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="fo-search__clear"
                                    aria-label="Aramayı temizle"
                                >
                                    <X size={15} strokeWidth={2.25} aria-hidden />
                                </button>
                            ) : null}
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
                    </div>
                </header>

                {/* Loading State */}
                {loading ? (
                    <OzunluLoading variant="inline" />
                ) : (
                    <div className="fo-list">
                        {companies.length === 0 ? (
                            <div className="fo-empty">Bu kategoride veri bulunamadı</div>
                        ) : (
                            companies
                                .filter(c => c.baseCompany.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((company) => {
                                    const isExpanded = expandedCompany === company.baseCompany;
                                    const completionRate = Math.round((company.tamamlanan / company.totalOrders) * 100) || 0;

                                    return (
                                        <div
                                            key={company.baseCompany}
                                            className={`fo-card${isExpanded ? ' fo-card--expanded' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="fo-card__header"
                                                onClick={() => setExpandedCompany(isExpanded ? null : company.baseCompany)}
                                                aria-expanded={isExpanded}
                                            >
                                                <div className="fo-card__brand">
                                                    <div className="fo-card__icon" aria-hidden>
                                                        <Building2 size={22} strokeWidth={2} />
                                                    </div>
                                                    <div className="fo-card__titles">
                                                        <div className="fo-card__eyebrow">Firma</div>
                                                        <div className="fo-card__name">{company.baseCompany}</div>
                                                    </div>
                                                </div>
                                                <span className="fo-chip-orders">{company.totalOrders} Sipariş</span>
                                                <div className="fo-metrics">
                                                    <span className="fo-metric fo-metric--ok">
                                                        <CheckCircle2 size={15} strokeWidth={2.25} aria-hidden />
                                                        {company.tamamlanan}
                                                    </span>
                                                    <span className="fo-metric fo-metric--mid">
                                                        <RefreshCw size={15} strokeWidth={2.25} aria-hidden />
                                                        {company.devamEden}
                                                    </span>
                                                    <span className="fo-metric fo-metric--bad">
                                                        <XCircle size={15} strokeWidth={2.25} aria-hidden />
                                                        {company.baslamayan}
                                                    </span>
                                                </div>
                                                <div className="fo-progress">
                                                    <div className="fo-progress__track" aria-hidden>
                                                        <div
                                                            className="fo-progress__fill"
                                                            style={{ width: `${completionRate}%` }}
                                                        />
                                                    </div>
                                                    <span className="fo-progress__pct">{completionRate}%</span>
                                                </div>
                                                <ChevronDown className="fo-chevron" size={22} strokeWidth={2} aria-hidden />
                                            </button>

                                            {isExpanded && (
                                                <div className="fo-card__body">
                                                    {/* Renk Lejantı */}
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', fontSize: '11px', marginBottom: '16px', padding: '0 8px' }}>
                                                        <span style={{ color: 'var(--danger)' }}>🔴 Başlanmadı</span>
                                                        <span style={{ color: 'var(--warning)' }}>🟡 Devam</span>
                                                        <span style={{ color: 'var(--success)' }}>🟢 Tamam</span>
                                                    </div>

                                                    {/* M3 Grupları Döngüsü */}
                                                    {company.m3Groups.map((m3Group) => (
                                                        <div key={m3Group.m3} className="step-group" style={{ marginBottom: '24px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                                            {/* Başlık */}
                                                            <div className="step-group-title" style={{ background: 'var(--secondary)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                                                                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--foreground)' }}>
                                                                    {m3Group.m3} M³ <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '13px' }}>({m3Group.count} Adet)</span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteM3Group(company.baseCompany, m3Group.m3);
                                                                        }}
                                                                        title="Bu grubu sil"
                                                                        style={{
                                                                            background: 'color-mix(in srgb, var(--danger) 14%, var(--card))',
                                                                            border: '1px solid var(--danger)',
                                                                            color: 'var(--danger)',
                                                                            borderRadius: '4px',
                                                                            padding: '4px 8px',
                                                                            cursor: 'pointer',
                                                                            fontSize: '12px',
                                                                            marginRight: '8px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '4px'
                                                                        }}
                                                                    >
                                                                        🗑️ Sil
                                                                    </button>
                                                                    <span className="badge badge-success" style={{ fontSize: '11px' }}>{m3Group.tamamlanan} ✓</span>
                                                                    <span className="badge badge-warning" style={{ fontSize: '11px' }}>{m3Group.devamEden} ⟳</span>
                                                                    <span className="badge badge-danger" style={{ fontSize: '11px' }}>{m3Group.baslamayan} ✗</span>
                                                                </div>
                                                            </div>

                                                            <div style={{ padding: '16px' }}>
                                                                {/* Step Stats Grid */}
                                                                {m3Group.stepStats && (
                                                                    <div style={{ marginBottom: '20px' }}>
                                                                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Aşama Durumları</div>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                                                                            {columns.map(step => {
                                                                                const stat = m3Group.stepStats[step.key] || { baslamadi: 0, devamEdiyor: 0, tamamlandi: 0, total: 0 };
                                                                                const total = stat.total || 0;
                                                                                const tamamlandiPct = total > 0 ? (stat.tamamlandi / total) * 100 : 0;
                                                                                const devamPct = total > 0 ? (stat.devamEdiyor / total) * 100 : 0;
                                                                                return (
                                                                                    <div key={step.key} style={{ background: 'var(--background)', padding: '8px', borderRadius: '6px', textAlign: 'center', border: '1px solid var(--border)' }}>
                                                                                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '2px', fontWeight: 500 }}>{step.label}</div>
                                                                                        {total > 0 ? (
                                                                                            <>
                                                                                                <div style={{ fontSize: '13px', fontWeight: 700, display: 'flex', justifyContent: 'center', gap: '2px' }}>
                                                                                                    <span style={{ color: 'var(--danger)' }}>{stat.baslamadi || 0}</span>/
                                                                                                    <span style={{ color: 'var(--warning)' }}>{stat.devamEdiyor || 0}</span>/
                                                                                                    <span style={{ color: 'var(--success)' }}>{stat.tamamlandi || 0}</span>
                                                                                                </div>
                                                                                                <div className="progress-bar" style={{ height: '3px', marginTop: '4px', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
                                                                                                    <div style={{ width: `${tamamlandiPct}%`, background: 'var(--success)' }}></div>
                                                                                                    <div style={{ width: `${devamPct}%`, background: 'var(--warning)' }}></div>
                                                                                                    <div style={{ flex: 1, background: 'var(--danger)' }}></div>
                                                                                                </div>
                                                                                            </>
                                                                                        ) : (
                                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Veri Yok</div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Damper Table */}
                                                                <div>
                                                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{productType === 'DAMPER' ? 'Damper' : 'Dorse'} Listesi</div>
                                                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                                                                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                                                            <thead>
                                                                                <tr style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                                                                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>İmalat No</th>
                                                                                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Müşteri</th>
                                                                                    {columns.map(col => (
                                                                                        <th key={col.key} style={{ padding: '8px 12px', textAlign: 'center' }}>
                                                                                            {col.label.replace(' (Ön Hazırlık)', '').replace(' Bitiş', '')}
                                                                                        </th>
                                                                                    ))}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {company.dampers
                                                                                    .filter(d => d.m3 === m3Group.m3)
                                                                                    .map((item) => (
                                                                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                                                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>{item.imalatNo || '-'}</td>
                                                                                            <td style={{ padding: '8px 12px' }}>{item.musteri}</td>
                                                                                            {columns.map(col => (
                                                                                                <td key={col.key} style={{ textAlign: 'center' }}>
                                                                                                    {getStatusBadge(
                                                                                                        (() => {
                                                                                                            const raw = item[col.statusKey] ?? item[col.key];
                                                                                                            return raw !== undefined && raw !== null ? String(raw) : undefined;
                                                                                                        })()
                                                                                                    )}
                                                                                                </td>
                                                                                            ))}
                                                                                        </tr>
                                                                                    ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                        )}
                    </div>
                )}

                {/* Footer Legend */}
                <div className="summary-legend">
                    <span className="summary-legend-title">Durum Göstergeleri:</span>
                    <div className="summary-legend-item"><span className="badge badge-success status-badge-mini">✓</span> <span className="summary-legend-item-text">Tamamlandı</span></div>
                    <div className="summary-legend-item"><span className="badge badge-warning status-badge-mini">⟳</span> <span className="summary-legend-item-text">Devam Ediyor</span></div>
                    <div className="summary-legend-item"><span className="badge badge-danger status-badge-mini">✗</span> <span className="summary-legend-item-text">Başlamadı</span></div>
                </div>
                </div>
            </main>
        </>
        </AuthGuard>
    );
}
