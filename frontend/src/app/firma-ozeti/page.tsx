'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getCompanySummary, type CompanySummary } from '@/lib/api';

export default function FirmaOzeti() {
    const [companies, setCompanies] = useState<CompanySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
    const [expandedVariant, setExpandedVariant] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const data = await getCompanySummary();
                setCompanies(data);
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const getStatusBadge = (status: string) => {
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

    if (loading) {
        return (
            <>
                <Sidebar />
                <main className="main-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
                            <div style={{ color: 'var(--muted)' }}>Yükleniyor...</div>
                        </div>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Sidebar />
            <main className="main-content">
                <header className="header">
                    <div>
                        <h1 className="header-title">Firma Özeti</h1>
                        <p className="header-subtitle">Firmalara göre sipariş ve üretim durumu özeti</p>
                    </div>
                </header>

                {/* Company Cards */}
                <div>
                    {companies.map((company) => {
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
                                        {/* Variants Section */}
                                        {company.variants.length > 1 && (
                                            <div className="step-group">
                                                <div className="step-group-title">SİPARİŞ DETAYI ({company.variants.length} adet)</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                                                    {company.variants.map((variant) => (
                                                        <div
                                                            key={variant.name}
                                                            style={{
                                                                background: 'var(--secondary)',
                                                                padding: '12px 16px',
                                                                borderRadius: '8px',
                                                                cursor: 'pointer',
                                                                border: expandedVariant === variant.name ? '2px solid var(--primary)' : '1px solid var(--border)'
                                                            }}
                                                            onClick={() => setExpandedVariant(expandedVariant === variant.name ? null : variant.name)}
                                                        >
                                                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>{variant.name}</div>

                                                            <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
                                                                <span className="badge badge-success">{variant.tamamlanan}</span>
                                                                <span className="badge badge-warning">{variant.devamEden}</span>
                                                                <span className="badge badge-danger">{variant.baslamayan}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* M³ Groups Section */}
                                        {company.m3Groups && company.m3Groups.length > 0 && (
                                            <div className="step-group" style={{ marginTop: '16px' }}>
                                                <div className="step-group-title">M³ GRUPLARI</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                                                    {company.m3Groups.map((m3Group) => (
                                                        <div
                                                            key={m3Group.m3}
                                                            style={{
                                                                background: 'var(--secondary)',
                                                                padding: '12px 16px',
                                                                borderRadius: '8px',
                                                                border: '1px solid var(--border)'
                                                            }}
                                                        >
                                                            <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--accent)', marginBottom: '6px' }}>{m3Group.m3.toFixed(1)} M³</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>{m3Group.count} adet</div>
                                                            <div style={{ display: 'flex', gap: '4px', fontSize: '11px' }}>
                                                                <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>{m3Group.tamamlanan}</span>
                                                                <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>{m3Group.devamEden}</span>
                                                                <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px' }}>{m3Group.baslamayan}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Dampers Table */}
                                        <div className="step-group" style={{ marginTop: '16px' }}>
                                            <div className="step-group-title">
                                                DAMPER ADİM DURUMU
                                                {expandedVariant && (
                                                    <span style={{ marginLeft: '12px', color: 'var(--primary)', fontSize: '12px' }}>
                                                        (Filtre: {expandedVariant})
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setExpandedVariant(null); }}
                                                            style={{
                                                                marginLeft: '8px',
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'var(--muted)',
                                                                cursor: 'pointer'
                                                            }}
                                                        >✕</button>
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ overflowX: 'auto' }}>
                                                <table style={{ width: '100%', marginTop: '8px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ textAlign: 'left' }}>İmalat No</th>
                                                            <th style={{ textAlign: 'left' }}>Müşteri</th>
                                                            <th>İlerleme</th>
                                                            <th>Kesim</th>
                                                            <th>Şasi</th>
                                                            <th>Ön Haz.</th>
                                                            <th>Montaj</th>
                                                            <th>Hidrolik</th>
                                                            <th>Boya</th>
                                                            <th>Taml.</th>
                                                            <th>S.Kon.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {company.dampers
                                                            .filter(d => !expandedVariant || d.musteri === expandedVariant)
                                                            .map((damper) => (
                                                                <tr key={damper.id}>
                                                                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{damper.imalatNo}</td>
                                                                    <td style={{ fontSize: '12px' }}>{damper.musteri}</td>
                                                                    <td style={{ textAlign: 'center' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                                            <div className="progress-bar" style={{ width: '50px', height: '6px' }}>
                                                                                <div className="progress-bar-fill" style={{ width: `${damper.progress}%` }}></div>
                                                                            </div>
                                                                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{damper.progress}%</span>
                                                                        </div>
                                                                    </td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.kesimBukumStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.sasiBitisStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.onHazirlikStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.montajStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.hidrolikStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.boyaBitisStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.tamamlamaBitisStatus)}</td>
                                                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.sonKontrolStatus)}</td>
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div style={{
                    marginTop: '24px',
                    padding: '16px 20px',
                    background: 'var(--card)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    gap: '24px',
                    flexWrap: 'wrap'
                }}>
                    <span style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 500 }}>Durum Göstergeleri:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-success">✓</span>
                        <span style={{ fontSize: '12px' }}>Tamamlandı</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-warning">⟳</span>
                        <span style={{ fontSize: '12px' }}>Devam Ediyor</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-danger">✗</span>
                        <span style={{ fontSize: '12px' }}>Başlamadı</span>
                    </div>
                </div>
            </main>
        </>
    );
}
