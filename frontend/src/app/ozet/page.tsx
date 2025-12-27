'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { getDampersSummary, type DamperSummary } from '@/lib/api';

export default function OzetSayfasi() {
    const [dampers, setDampers] = useState<DamperSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function loadData() {
            try {
                const data = await getDampersSummary();
                setDampers(data);
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
            case 'YOK':
            case 'MUAYENE YOK':
                return <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>-</span>;
            default:
                return <span className="badge badge-muted" style={{ fontSize: '10px', padding: '2px 6px' }}>{status}</span>;
        }
    };

    const filteredDampers = dampers.filter(d =>
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
                <header className="header">
                    <div>
                        <h1 className="header-title">Özet Görünüm</h1>
                        <p className="header-subtitle">Tüm damper imalat süreçlerinin özet durumu</p>
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
                                <th>Araç</th>
                                <th>Tip</th>
                                <th>Malzeme</th>
                                <th>M³</th>
                                <th style={{ textAlign: 'center' }}>Kesim Büküm</th>
                                <th style={{ textAlign: 'center' }}>Şasi Bitiş</th>
                                <th style={{ textAlign: 'center' }}>Ön Hazırlık</th>
                                <th style={{ textAlign: 'center' }}>Montaj</th>
                                <th style={{ textAlign: 'center' }}>Hidrolik</th>
                                <th style={{ textAlign: 'center' }}>Boya Bitiş</th>
                                <th style={{ textAlign: 'center' }}>Tamamlama</th>
                                <th style={{ textAlign: 'center' }}>Son Kontrol</th>
                                <th style={{ textAlign: 'center' }}>Kurum</th>
                                <th style={{ textAlign: 'center' }}>DMO</th>
                                <th style={{ textAlign: 'center' }}>Teslimat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDampers.map((damper) => (
                                <tr key={damper.id}>
                                    <td style={{
                                        fontWeight: 600,
                                        color: 'var(--primary)',
                                        position: 'sticky',
                                        left: 0,
                                        background: 'var(--card)',
                                        zIndex: 5
                                    }}>
                                        {damper.imalatNo}
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
                                        {damper.musteri}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: damper.aracGeldiMi ? 'var(--success)' : 'var(--danger)'
                                            }}></div>
                                            <span style={{ fontSize: '12px' }}>{damper.aracMarka || '-'}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{
                                            background: 'rgba(99, 102, 241, 0.1)',
                                            color: 'var(--primary)',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px'
                                        }}>
                                            {damper.tip}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '12px' }}>{damper.malzemeCinsi}</td>
                                    <td style={{ fontSize: '12px' }}>{damper.m3}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.kesimBukum)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.sasiBitis)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.onHazirlik)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.montaj)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.hidrolik)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.boyaBitis)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.tamamlamaBitis)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.sonKontrol)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.kurumMuayenesi)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.dmoMuayenesi)}</td>
                                    <td style={{ textAlign: 'center' }}>{getStatusBadge(damper.teslimat)}</td>
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
