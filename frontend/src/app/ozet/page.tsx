'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getDampersSummary, getDorsesSummary, type DamperSummary, type DorseSummary } from '@/lib/api';

export default function OzetSayfasi() {
    const [productType, setProductType] = useState<'DAMPER' | 'DORSE'>('DAMPER');
    const [dampers, setDampers] = useState<DamperSummary[]>([]);
    const [dorses, setDorses] = useState<DorseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                if (productType === 'DAMPER') {
                    const data = await getDampersSummary();
                    setDampers(data);
                } else {
                    const data = await getDorsesSummary();
                    setDorses(data);
                }
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [productType]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'TAMAMLANDI':
            case 'YAPILDI':
                return <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>✓</span>;
            case 'DEVAM EDİYOR':
                return <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>⟳</span>;
            case 'BAŞLAMADI':
                return <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px' }}>✗</span>;
            case 'YOK':
            case 'MUAYENE YOK':
                return <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>-</span>;
            default:
                return <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>{status}</span>;
        }
    };

    const filteredItems = (productType === 'DAMPER' ? dampers : dorses).filter((d: any) =>
        searchTerm === '' ||
        d.musteri.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.imalatNo.toString().includes(searchTerm)
    );

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
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 className="header-title">Özet Görünüm</h1>
                            <p className="header-subtitle">Tüm {productType === 'DAMPER' ? 'damper' : 'dorse'} imalat süreçlerinin özet durumu</p>
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

                {/* Search */}
                <div style={{ marginBottom: '24px' }}>
                    <input
                        type="text"
                        placeholder="İmalat No veya Müşteri ara..."
                        className="input"
                        style={{ maxWidth: '300px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Summary Table */}
                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ position: 'sticky', left: 0, background: 'var(--secondary)', zIndex: 10 }}>İmalat No</th>
                                <th style={{ position: 'sticky', left: '80px', background: 'var(--secondary)', zIndex: 10 }}>Müşteri</th>
                                <th>{productType === 'DAMPER' ? 'Araç' : 'Çekici'}</th>
                                {productType === 'DAMPER' && <th>Tip</th>}
                                {productType === 'DORSE' && <th>Şasi No</th>}
                                <th>{productType === 'DAMPER' ? 'Malzeme' : 'Kalınlık'}</th>
                                <th>M³</th>
                                <th style={{ textAlign: 'center' }}>Kesim Büküm</th>
                                <th style={{ textAlign: 'center' }}>Şasi Bitiş</th>
                                <th style={{ textAlign: 'center' }}>Ön Hazırlık</th>
                                <th style={{ textAlign: 'center' }}>Montaj</th>
                                <th style={{ textAlign: 'center' }}>Hidrolik</th>
                                <th style={{ textAlign: 'center' }}>{productType === 'DAMPER' ? 'Boya Bitiş' : 'Boya'}</th>
                                <th style={{ textAlign: 'center' }}>Tamamlama</th>
                                <th style={{ textAlign: 'center' }}>Son Kontrol</th>
                                <th style={{ textAlign: 'center' }}>{productType === 'DAMPER' ? 'Kurum' : 'AKM-TSE'}</th>
                                <th style={{ textAlign: 'center' }}>DMO</th>
                                <th style={{ textAlign: 'center' }}>Teslimat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.map((item: any) => (
                                <tr key={item.id}>
                                    <td style={{
                                        fontWeight: 600,
                                        color: 'var(--primary)',
                                        position: 'sticky',
                                        left: 0,
                                        background: 'var(--card)',
                                        zIndex: 5
                                    }}>
                                        {item.imalatNo}
                                    </td>
                                    <td style={{
                                        position: 'sticky',
                                        left: '80px',
                                        background: 'var(--card)',
                                        zIndex: 5,
                                        maxWidth: '150px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.musteri}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: (productType === 'DAMPER' ? item.aracGeldiMi : item.cekiciGeldiMi) ? 'var(--success)' : 'var(--danger)'
                                            }}></div>
                                            <span style={{ fontSize: '12px' }}>
                                                {productType === 'DAMPER' ? (item.aracMarka || '-') : (item.cekiciGeldiMi ? 'Fabrikada' : '-')}
                                            </span>
                                        </div>
                                    </td>
                                    {productType === 'DAMPER' && (
                                        <td>
                                            <span style={{
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                color: 'var(--primary)',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px'
                                            }}>
                                                {item.tip}
                                            </span>
                                        </td>
                                    )}
                                    {productType === 'DORSE' && (
                                        <td style={{ fontSize: '12px' }}>{item.sasiNo || '-'}</td>
                                    )}
                                    <td style={{ fontSize: '12px' }}>
                                        {productType === 'DAMPER' ? item.malzemeCinsi : item.kalinlik}
                                    </td>
                                    <td style={{ fontSize: '12px' }}>{item.m3}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.kesimBukum)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.sasiBitis)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.onHazirlik)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.montaj)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.hidrolik)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.boyaBitis)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.tamamlamaBitis)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.sonKontrol)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.kurumMuayenesi)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.dmoMuayenesi)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(item.teslimat)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                        <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 6px' }}>✓</span>
                        <span style={{ fontSize: '12px' }}>Tamamlandı</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-warning" style={{ fontSize: '10px', padding: '2px 6px' }}>⟳</span>
                        <span style={{ fontSize: '12px' }}>Devam Ediyor</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-danger" style={{ fontSize: '10px', padding: '2px 6px' }}>✗</span>
                        <span style={{ fontSize: '12px' }}>Başlamadı</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>-</span>
                        <span style={{ fontSize: '12px' }}>Yok / Muayene Yok</span>
                    </div>
                </div>
            </main>
        </>
    );
}
