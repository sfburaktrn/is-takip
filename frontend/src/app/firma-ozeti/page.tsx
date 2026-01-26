'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getCompanySummary, deleteCompanyM3Group, type CompanySummary } from '@/lib/api';

type ProductType = 'DAMPER' | 'DORSE';

export default function FirmaOzeti() {
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const [companies, setCompanies] = useState<CompanySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await getCompanySummary(productType);
            setCompanies(data);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [productType]);

    const handleDeleteM3Group = async (companyName: string, m3: number) => {
        if (!confirm(`${companyName} firmasına ait ${m3} m³ grubunu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
            return;
        }

        try {
            await deleteCompanyM3Group(companyName, m3);
            await loadData(); // Reload data to reflect changes
        } catch (error) {
            console.error('Error deleting M3 group:', error);
            alert('Silme işlemi başarısız oldu.');
        }
    };

    const getStatusBadge = (status: string | undefined) => {
        if (!status) return <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>-</span>;
        switch (status) {
            case 'TAMAMLANDI':
            case 'YAPILDI':
                return <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>✓</span>;
            case 'DEVAM EDİYOR':
                return <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>⟳</span>;
            case 'BAŞLAMADI':
                return <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px' }}>✗</span>;
            default:
                return <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>-</span>;
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
        <>
            <Sidebar />
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 className="header-title">Firma Özeti</h1>
                            <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : 'Dorse'} sipariş ve üretim durumu özeti</p>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="🔍 Firma ara..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    width: '250px',
                                    paddingLeft: '12px',
                                    paddingRight: searchQuery ? '36px' : '12px'
                                }}
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--muted)',
                                        fontSize: '16px'
                                    }}
                                >✕</button>
                            )}
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
                    </div>
                </header>

                {/* Loading State */}
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                            <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
                        </div>
                    </div>
                ) : (
                    /* Company Cards */
                    <div>
                        {companies.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Bu kategoride veri bulunamadı
                            </div>
                        ) : (
                            companies
                                .filter(c => c.baseCompany.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map((company) => {
                                    const isExpanded = expandedCompany === company.baseCompany;
                                    const completionRate = Math.round((company.tamamlanan / company.totalOrders) * 100) || 0;

                                    return (
                                        <div key={company.baseCompany} className="damper-card" style={{ marginBottom: '16px' }}>
                                            <div
                                                className="damper-card-header"
                                                onClick={() => setExpandedCompany(isExpanded ? null : company.baseCompany)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--foreground)' }}>
                                                    🏢 {company.baseCompany}
                                                </div>
                                                <div style={{
                                                    background: 'var(--primary)',
                                                    color: 'white',
                                                    padding: '4px 12px',
                                                    borderRadius: '20px',
                                                    fontSize: '13px',
                                                    fontWeight: 600
                                                }}>
                                                    {company.totalOrders} Sipariş
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <span className="badge badge-success">{company.tamamlanan} ✓</span>
                                                    <span className="badge badge-warning">{company.devamEden} ⟳</span>
                                                    <span className="badge badge-danger">{company.baslamayan} ✗</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="progress-bar" style={{ width: '100px' }}>
                                                        <div className="progress-bar-fill" style={{ width: `${completionRate}%` }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{completionRate}%</span>
                                                </div>
                                                <div style={{
                                                    fontSize: '20px',
                                                    transition: 'transform 0.3s',
                                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)'
                                                }}>▼</div>
                                            </div>

                                            {isExpanded && (
                                                <div className="damper-card-body">
                                                    {/* Renk Lejantı */}
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', fontSize: '11px', marginBottom: '16px', padding: '0 8px' }}>
                                                        <span style={{ color: '#ef4444' }}>🔴 Başlanmadı</span>
                                                        <span style={{ color: '#f59e0b' }}>🟡 Devam</span>
                                                        <span style={{ color: '#10b981' }}>🟢 Tamam</span>
                                                    </div>

                                                    {/* M3 Grupları Döngüsü */}
                                                    {company.m3Groups.map((m3Group) => (
                                                        <div key={m3Group.m3} className="step-group" style={{ marginBottom: '24px', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                                                            {/* Başlık */}
                                                            <div className="step-group-title" style={{ background: 'var(--secondary)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                                                                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--foreground)' }}>
                                                                    {m3Group.m3} M³ <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: '13px' }}>({m3Group.count} Adet)</span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDeleteM3Group(company.baseCompany, m3Group.m3);
                                                                        }}
                                                                        title="Bu grubu sil"
                                                                        style={{
                                                                            background: '#fee2e2',
                                                                            border: '1px solid #ef4444',
                                                                            color: '#ef4444',
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
                                                                                // @ts-expect-error - Dynamic key access
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
                                                                                                    <span style={{ color: '#ef4444' }}>{stat.baslamadi || 0}</span>/
                                                                                                    <span style={{ color: '#f59e0b' }}>{stat.devamEdiyor || 0}</span>/
                                                                                                    <span style={{ color: '#10b981' }}>{stat.tamamlandi || 0}</span>
                                                                                                </div>
                                                                                                <div className="progress-bar" style={{ height: '3px', marginTop: '4px', display: 'flex', borderRadius: '2px', overflow: 'hidden' }}>
                                                                                                    <div style={{ width: `${tamamlandiPct}%`, background: '#10b981' }}></div>
                                                                                                    <div style={{ width: `${devamPct}%`, background: '#f59e0b' }}></div>
                                                                                                    <div style={{ flex: 1, background: '#ef4444' }}></div>
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
                                                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
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
                                                                                                // @ts-expect-error - Dynamic key access
                                                                                                <td key={col.key} style={{ textAlign: 'center' }}>
                                                                                                    {/* @ts-expect-error */}
                                                                                                    {getStatusBadge(item[col.statusKey] || item[col.key])}
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
                <div style={{ marginTop: '24px', padding: '16px', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)' }}>Durum Göstergeleri:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="badge badge-success">✓</span> <span style={{ fontSize: '12px' }}>Tamamlandı</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="badge badge-warning">⟳</span> <span style={{ fontSize: '12px' }}>Devam Ediyor</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span className="badge badge-danger">✗</span> <span style={{ fontSize: '12px' }}>Başlamadı</span></div>
                </div>
            </main >
        </>
    );
}
