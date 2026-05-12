'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { getDampersSummary, getDorsesSummary, type DamperSummary, type DorseSummary } from '@/lib/api';

export default function OzetSayfasi() {
    const [productType, setProductType] = useState<'DAMPER' | 'DORSE'>('DAMPER');
    const [dampers, setDampers] = useState<DamperSummary[]>([]);
    const [dorses, setDorses] = useState<DorseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const tableScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = tableScrollRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) return;
            if (el.scrollWidth <= el.clientWidth) return;
            if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
            const atStart = el.scrollLeft <= 0;
            const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
            if (e.deltaY < 0 && atStart) return;
            if (e.deltaY > 0 && atEnd) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

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
                return <span className="badge badge-success status-badge-mini">✓</span>;
            case 'DEVAM EDİYOR':
                return <span className="badge badge-warning status-badge-mini">⟳</span>;
            case 'BAŞLAMADI':
                return <span className="badge badge-danger status-badge-mini">✗</span>;
            case 'YOK':
            case 'MUAYENE YOK':
                return <span className="badge badge-muted status-badge-mini">-</span>;
            default:
                return <span className="badge badge-muted status-badge-mini">{status}</span>;
        }
    };

    const filteredDampers = dampers.filter(
        (d) =>
            searchTerm === '' ||
            d.musteri.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.imalatNo.toString().includes(searchTerm)
    );
    const filteredDorses = dorses.filter(
        (d) =>
            searchTerm === '' ||
            d.musteri.toLowerCase().includes(searchTerm.toLowerCase()) ||
            d.imalatNo.toString().includes(searchTerm)
    );

    if (loading) {
        return (
            <AuthGuard>
            <>
                <Sidebar />
                <main className="main-content apple-app-page">
                    <div className="apple-canvas">
                        <OzunluLoading variant="inline" />
                    </div>
                </main>
            </>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
        <>
            <Sidebar />
            <main className="main-content apple-app-page">
                <div className="apple-canvas">
                <header className="header header--stack">
                    <div className="dashboard-header-row header-row-full">
                        <div>
                            <h1 className="header-title">Özet Görünüm</h1>
                            <p className="header-subtitle">Tüm {productType === 'DAMPER' ? 'damper' : 'dorse'} imalat süreçlerinin özet durumu</p>
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

                {/* Search */}
                <div className="summary-search-block">
                    <input
                        type="text"
                        placeholder="İmalat No veya Müşteri ara..."
                        className="input summary-search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Summary Table */}
                <div className="summary-table-wrap">
                    <div className="summary-table-hint">
                        <ChevronsLeftRight className="summary-table-hint-icon" size={18} strokeWidth={2} aria-hidden />
                        <span>
                            <strong>Tüm süreç sütunları</strong> sağda. Tablonun üzerindeyken dikey tekerleği
                            yatay kaydırma olarak kullanabilirsiniz; ayrıca <kbd>Shift</kbd> + tekerlek veya (mobilde)
                            iki parmakla yatay kaydırın. İmalat no ve müşteri sütunları sabit kalır.
                        </span>
                    </div>
                    <div
                        ref={tableScrollRef}
                        className="summary-table-scroll"
                        tabIndex={0}
                        role="region"
                        aria-label="Özet tablo, yatay kaydırılabilir"
                    >
                        <table className="summary-ozet-table">
                        <thead>
                            <tr>
                                <th className="sticky-left sticky-left--no">İmalat No</th>
                                <th className="sticky-left sticky-left--musteri">Müşteri</th>
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
                            {productType === 'DAMPER'
                                ? filteredDampers.map((item) => (
                                    <tr key={item.id}>
                                        <td className="sticky-left sticky-left--no">{item.imalatNo}</td>
                                        <td className="sticky-left sticky-left--musteri">{item.musteri}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: item.aracGeldiMi ? 'var(--success)' : 'var(--danger)'
                                                }}></div>
                                                <span style={{ fontSize: '12px' }}>
                                                    {item.aracMarka || '-'}
                                                </span>
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
                                                {item.tip}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{item.malzemeCinsi}</td>
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
                                ))
                                : filteredDorses.map((item) => (
                                    <tr key={item.id}>
                                        <td className="sticky-left sticky-left--no">{item.imalatNo}</td>
                                        <td className="sticky-left sticky-left--musteri">{item.musteri}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <div style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: item.cekiciGeldiMi ? 'var(--success)' : 'var(--danger)'
                                                }}></div>
                                                <span style={{ fontSize: '12px' }}>
                                                    {item.cekiciGeldiMi ? 'Fabrikada' : '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                {item.sasiNo && (
                                                    <div style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                                                        {item.sasiNo}
                                                    </div>
                                                )}
                                                {item.sasi && (
                                                    <div style={{
                                                        fontSize: '11px',
                                                        color: 'var(--primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        background: 'rgba(99, 102, 241, 0.05)',
                                                        padding: '3px 8px',
                                                        borderRadius: '6px',
                                                        width: 'fit-content',
                                                        border: '1px solid rgba(99, 102, 241, 0.1)'
                                                    }}>
                                                        <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>🔗 {item.sasi.musteri}</span>
                                                        <div style={{ width: '1px', height: '12px', background: 'var(--primary)', opacity: 0.3 }}></div>
                                                        <span style={{ opacity: 0.8, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                                            {item.sasi.sasiNo ? `#${item.sasi.sasiNo}` : (item.sasi.imalatNo ? `#${item.sasi.imalatNo}` : '')}
                                                        </span>
                                                    </div>
                                                )}
                                                {!item.sasiNo && !item.sasi && <span style={{ color: 'var(--muted)' }}>-</span>}
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{item.kalinlik}</td>
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
                </div>

                {/* Legend */}
                <div className="summary-legend">
                    <span className="summary-legend-title">Durum Göstergeleri:</span>
                    <div className="summary-legend-item">
                        <span className="badge badge-success status-badge-mini">✓</span>
                        <span className="summary-legend-item-text">Tamamlandı</span>
                    </div>
                    <div className="summary-legend-item">
                        <span className="badge badge-warning status-badge-mini">⟳</span>
                        <span className="summary-legend-item-text">Devam Ediyor</span>
                    </div>
                    <div className="summary-legend-item">
                        <span className="badge badge-danger status-badge-mini">✗</span>
                        <span className="summary-legend-item-text">Başlamadı</span>
                    </div>
                    <div className="summary-legend-item">
                        <span className="badge badge-muted status-badge-mini">-</span>
                        <span className="summary-legend-item-text">Yok / Muayene Yok</span>
                    </div>
                </div>
                </div>
            </main>
        </>
        </AuthGuard>
    );
}
