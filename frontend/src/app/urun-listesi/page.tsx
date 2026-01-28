'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import {
    getStats,
    getDampers,
    getDorses,
    getDropdowns,
    createDamper,
    createDorse,
    updateDamper,
    updateDorse,
    deleteDamper,
    deleteDorse,
    type Stats,
    type Damper,
    type Dorse,
    type Dropdowns,
    STEP_GROUPS,
    DORSE_STEP_GROUPS
} from '@/lib/api';


type ProductType = 'DAMPER' | 'DORSE';

function UrunListesiContent() {
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const [stats, setStats] = useState<Stats | null>(null);
    const [dampers, setDampers] = useState<Damper[]>([]);
    const [dorses, setDorses] = useState<Dorse[]>([]);
    const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'progress-asc' | 'progress-desc' | 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | null>(null);

    // Damper Form State
    const [formData, setFormData] = useState({
        imalatNo: '',
        musteri: '',
        aracGeldiMi: false,
        aracMarka: '',
        model: '',
        tip: '',
        malzemeCinsi: '',
        m3: '',
        adet: '1',
    });

    // Dorse Form State
    const [dorseFormData, setDorseFormData] = useState({
        imalatNo: '',
        musteri: '',
        dorseGeldiMi: false,
        dingil: '',
        lastik: '',
        tampon: '',
        sacCinsi: '',
        m3: '',
        adet: '1',
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [statsData, dampersData, dorsesData, dropdownsData] = await Promise.all([
                getStats(),
                getDampers(),
                getDorses(),
                getDropdowns()
            ]);
            setStats(statsData);
            setDampers(dampersData);
            setDorses(dorsesData);
            setDropdowns(dropdownsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }

    const getStatusBadge = (status: string | undefined) => {
        if (!status) return <span className="badge badge-muted">-</span>;

        switch (status) {
            case 'TAMAMLANDI':
            case 'YAPILDI':
                return <span className="badge badge-success">{status}</span>;
            case 'DEVAM EDİYOR':
                return <span className="badge badge-warning">{status}</span>;
            case 'BAŞLAMADI':
                return <span className="badge badge-danger">{status}</span>;
            default:
                return <span className="badge badge-muted">{status}</span>;
        }
    };

    const calculateProgress = (damper: Damper): number => {
        const steps = [
            damper.plazmaProgrami, damper.sacMalzemeKontrolu, damper.plazmaKesim,
            damper.damperSasiPlazmaKesim, damper.presBukum, damper.aracBraket,
            damper.damperSasi, damper.sasiYukleme, damper.milAltKutuk, damper.taban,
            damper.yan, damper.onGogus, damper.arkaKapak, damper.yuklemeMalzemesi,
            damper.damperKurulmasi, damper.damperKaynak, damper.sasiKapakSiperlik,
            damper.yukleme, damper.hidrolik, damper.boyaHazirlik, damper.boya,
            damper.elektrik, damper.hava, damper.tamamlama, damper.sonKontrol, damper.teslimat
        ];
        const completed = steps.filter(Boolean).length;
        return Math.round((completed / steps.length) * 100);
    };

    const calculateDorseProgress = (dorse: Dorse): number => {
        const steps = [
            dorse.plazmaProgrami, dorse.sacMalzemeKontrolu, dorse.plazmaKesim,
            dorse.presBukum, dorse.dorseSasi,
            dorse.milAltKutuk, dorse.taban, dorse.yan, dorse.onGogus, dorse.arkaKapak, dorse.yuklemeMalzemesi,
            dorse.dorseKurulmasi, dorse.dorseKaynak, dorse.kapakSiperlik, dorse.yukleme, dorse.hidrolik,
            dorse.boyaHazirlik, dorse.dorseSasiBoyama,
            dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.cekiciElektrik, dorse.cekiciHidrolik, dorse.aracKontrolBypassAyari,
            dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat, dorse.teslimat
        ];
        let completed = steps.filter(Boolean).length;
        if (dorse.akmTseMuayenesi === 'YAPILDI') completed++;
        if (dorse.dmoMuayenesi === 'YAPILDI') completed++;

        return Math.round((completed / (steps.length + 2)) * 100);
    };

    const getDamperStatus = (damper: Damper): string => {
        // All step fields to check
        const allSteps = [
            damper.plazmaProgrami, damper.sacMalzemeKontrolu, damper.plazmaKesim,
            damper.damperSasiPlazmaKesim, damper.presBukum, damper.aracBraket,
            damper.damperSasi, damper.sasiYukleme, damper.milAltKutuk, damper.taban,
            damper.yan, damper.onGogus, damper.arkaKapak, damper.yuklemeMalzemesi,
            damper.damperKurulmasi, damper.damperKaynak, damper.sasiKapakSiperlik,
            damper.yukleme, damper.hidrolik, damper.boyaHazirlik, damper.boya,
            damper.elektrik, damper.hava, damper.tamamlama, damper.sonKontrol, damper.teslimat
        ];

        const completedSteps = allSteps.filter(Boolean).length;
        const totalSteps = allSteps.length;

        if (completedSteps === totalSteps) {
            return 'tamamlanan';
        } else if (completedSteps === 0) {
            return 'baslamayan';
        } else {
            return 'devamEden';
        }
    };

    const getDorseStatus = (dorse: Dorse): string => {
        const allSteps = [
            dorse.plazmaProgrami, dorse.sacMalzemeKontrolu, dorse.plazmaKesim,
            dorse.presBukum, dorse.dorseSasi,
            dorse.milAltKutuk, dorse.taban, dorse.yan, dorse.onGogus, dorse.arkaKapak, dorse.yuklemeMalzemesi,
            dorse.dorseKurulmasi, dorse.dorseKaynak, dorse.kapakSiperlik, dorse.yukleme, dorse.hidrolik,
            dorse.boyaHazirlik, dorse.dorseSasiBoyama,
            dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.cekiciElektrik, dorse.cekiciHidrolik, dorse.aracKontrolBypassAyari,
            dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat, dorse.teslimat
        ];

        const completedSteps = allSteps.filter(Boolean).length;
        let extraCompleted = 0;
        if (dorse.akmTseMuayenesi === 'YAPILDI') extraCompleted++;
        if (dorse.dmoMuayenesi === 'YAPILDI') extraCompleted++;

        const totalSteps = allSteps.length + 2;

        if (completedSteps + extraCompleted === totalSteps) {
            return 'tamamlanan';
        } else if (completedSteps + extraCompleted === 0) {
            return 'baslamayan';
        } else {
            return 'devamEden';
        }
    };

    const handleStepToggle = async (id: number, stepKey: string, currentValue: boolean, type: ProductType) => {
        try {
            if (type === 'DAMPER') {
                const updated = await updateDamper(id, { [stepKey]: !currentValue });
                setDampers(prev => prev.map(d => d.id === id ? updated : d));
            } else {
                const updated = await updateDorse(id, { [stepKey]: !currentValue });
                setDorses(prev => prev.map(d => d.id === id ? updated : d));
            }
        } catch (error) {
            console.error('Error updating step:', error);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (productType === 'DAMPER') {
            const quantity = parseInt(formData.adet) || 1;
            try {
                await createDamper({
                    imalatNo: formData.imalatNo ? parseInt(formData.imalatNo) : 0,
                    musteri: formData.musteri,
                    aracGeldiMi: formData.aracGeldiMi,
                    aracMarka: formData.aracMarka || null,
                    model: formData.model || null,
                    tip: formData.tip,
                    malzemeCinsi: formData.malzemeCinsi,
                    m3: formData.m3 ? parseFloat(formData.m3) : null,
                    adet: quantity,
                });
                setShowAddModal(false);
                setFormData({
                    imalatNo: '',
                    musteri: '',
                    aracGeldiMi: false,
                    aracMarka: '',
                    model: '',
                    tip: '',
                    malzemeCinsi: '',
                    m3: '',
                    adet: '1',
                });
                loadData();
                if (quantity > 1) {
                    alert(`${quantity} adet damper başarıyla oluşturuldu!\n(${formData.musteri} 1 - ${formData.musteri} ${quantity})`);
                }
            } catch (error) {
                console.error('Error creating damper:', error);
                alert('Damper oluşturulurken hata oluştu');
            }
        } else {
            // Dorse Creation
            const quantity = parseInt(dorseFormData.adet) || 1;
            try {
                await createDorse({
                    imalatNo: dorseFormData.imalatNo ? parseInt(dorseFormData.imalatNo) : 0,
                    musteri: dorseFormData.musteri,
                    dorseGeldiMi: dorseFormData.dorseGeldiMi,
                    dingil: dorseFormData.dingil || null,
                    lastik: dorseFormData.lastik || null,
                    tampon: dorseFormData.tampon || null,
                    sacCinsi: dorseFormData.sacCinsi,
                    m3: dorseFormData.m3 ? parseFloat(dorseFormData.m3) : null,
                    adet: quantity,
                });
                setShowAddModal(false);
                setDorseFormData({
                    imalatNo: '',
                    musteri: '',
                    dorseGeldiMi: false,
                    dingil: '',
                    lastik: '',
                    tampon: '',
                    sacCinsi: '',
                    m3: '',
                    adet: '1',
                });
                loadData();
                if (quantity > 1) {
                    alert(`${quantity} adet dorse başarıyla oluşturuldu!`);
                }
            } catch (error) {
                console.error('Error creating dorse:', error);
                alert('Dorse oluşturulurken hata oluştu');
            }
        }
    };

    // Filter and sort dampers
    const sortedDampers = useMemo(() => {
        const result = statusFilter
            ? dampers.filter(d => getDamperStatus(d) === statusFilter)
            : [...dampers];

        if (sortBy) {
            result.sort((a, b) => {
                switch (sortBy) {
                    case 'progress-asc':
                        return calculateProgress(a) - calculateProgress(b);
                    case 'progress-desc':
                        return calculateProgress(b) - calculateProgress(a);
                    case 'name-asc':
                        return a.musteri.localeCompare(b.musteri, 'tr');
                    case 'name-desc':
                        return b.musteri.localeCompare(a.musteri, 'tr');
                    case 'date-asc':
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    case 'date-desc':
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    default:
                        return 0;
                }
            });
        }

        return statusFilter || sortBy ? result : result.slice(0, 50); // Increased limit as this is the main list
    }, [dampers, statusFilter, sortBy]);

    // Filter and sort dorses
    const sortedDorses = useMemo(() => {
        const result = statusFilter
            ? dorses.filter(d => getDorseStatus(d) === statusFilter)
            : [...dorses];

        if (sortBy) {
            result.sort((a, b) => {
                switch (sortBy) {
                    case 'progress-asc':
                        return calculateDorseProgress(a) - calculateDorseProgress(b);
                    case 'progress-desc':
                        return calculateDorseProgress(b) - calculateDorseProgress(a);
                    case 'name-asc':
                        return a.musteri.localeCompare(b.musteri, 'tr');
                    case 'name-desc':
                        return b.musteri.localeCompare(a.musteri, 'tr');
                    case 'date-asc':
                        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                    case 'date-desc':
                        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                    default:
                        return 0;
                }
            });
        }

        return statusFilter || sortBy ? result : result.slice(0, 50); // Increased limit
    }, [dorses, statusFilter, sortBy]);

    const currentStats = useMemo(() => {
        if (productType === 'DAMPER') return stats;

        // Calculate Dorse stats client-side
        return {
            total: dorses.length,
            tamamlanan: dorses.filter(d => getDorseStatus(d) === 'tamamlanan').length,
            devamEden: dorses.filter(d => getDorseStatus(d) === 'devamEden').length,
            baslamayan: dorses.filter(d => getDorseStatus(d) === 'baslamayan').length
        };
    }, [productType, stats, dorses]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Yükleniyor...</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <Sidebar />
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 className="header-title">Ürün Listesi</h1>
                            <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : 'Dorse'} imalat süreçlerini görüntüleyin ve yönetin</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                            ➕ Yeni {productType === 'DAMPER' ? 'Damper' : 'Dorse'} Ekle
                        </button>
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

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div
                        className="stat-card"
                        style={{ cursor: 'pointer', border: statusFilter === null ? '2px solid var(--primary)' : undefined }}
                        onClick={() => setStatusFilter(null)}
                    >
                        <div className="stat-icon blue">📦</div>
                        <div>
                            <div className="stat-value">{currentStats?.total || 0}</div>
                            <div className="stat-label">Toplam {productType === 'DAMPER' ? 'Damper' : 'Dorse'}</div>
                        </div>
                    </div>
                    <div
                        className="stat-card"
                        style={{ cursor: 'pointer', border: statusFilter === 'tamamlanan' ? '2px solid var(--success)' : undefined }}
                        onClick={() => setStatusFilter(statusFilter === 'tamamlanan' ? null : 'tamamlanan')}
                    >
                        <div className="stat-icon green">✅</div>
                        <div>
                            <div className="stat-value">{currentStats?.tamamlanan || 0}</div>
                            <div className="stat-label">Tamamlanan</div>
                        </div>
                    </div>
                    <div
                        className="stat-card"
                        style={{ cursor: 'pointer', border: statusFilter === 'devamEden' ? '2px solid var(--warning)' : undefined }}
                        onClick={() => setStatusFilter(statusFilter === 'devamEden' ? null : 'devamEden')}
                    >
                        <div className="stat-icon yellow">🔄</div>
                        <div>
                            <div className="stat-value">{currentStats?.devamEden || 0}</div>
                            <div className="stat-label">Devam Eden</div>
                        </div>
                    </div>
                    <div
                        className="stat-card"
                        style={{ cursor: 'pointer', border: statusFilter === 'baslamayan' ? '2px solid var(--danger)' : undefined }}
                        onClick={() => setStatusFilter(statusFilter === 'baslamayan' ? null : 'baslamayan')}
                    >
                        <div className="stat-icon red">⏸️</div>
                        <div>
                            <div className="stat-value">{currentStats?.baslamayan || 0}</div>
                            <div className="stat-label">Başlamayan</div>
                        </div>
                    </div>
                </div>

                {/* Dampers List */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                            {statusFilter === 'tamamlanan' && `✅ Tamamlanan ${productType === 'DAMPER' ? 'Damperler' : 'Dorseler'}`}
                            {statusFilter === 'devamEden' && `🔄 Devam Eden ${productType === 'DAMPER' ? 'Damperler' : 'Dorseler'}`}
                            {statusFilter === 'baslamayan' && `⏸️ Başlamayan ${productType === 'DAMPER' ? 'Damperler' : 'Dorseler'}`}
                            {!statusFilter && `Tüm ${productType === 'DAMPER' ? 'Damperler' : 'Dorseler'}`}
                        </h2>
                        {statusFilter && (
                            <button className="btn btn-secondary" onClick={() => setStatusFilter(null)}>
                                ✕ Filtreyi Kaldır
                            </button>
                        )}
                    </div>

                    {/* Sıralama Butonları */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '20px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--muted)', alignSelf: 'center', marginRight: '4px' }}>Sırala:</span>

                        {/* Tamamlama % */}
                        <button
                            className={`btn btn-secondary`}
                            style={{
                                fontSize: '12px',
                                padding: '6px 12px',
                                background: sortBy?.startsWith('progress') ? 'var(--primary)' : undefined,
                                color: sortBy?.startsWith('progress') ? 'white' : undefined
                            }}
                            onClick={() => {
                                if (sortBy === 'progress-asc') setSortBy('progress-desc');
                                else if (sortBy === 'progress-desc') setSortBy(null);
                                else setSortBy('progress-asc');
                            }}
                        >
                            📊 Tamamlama % {sortBy === 'progress-asc' ? '↑' : sortBy === 'progress-desc' ? '↓' : ''}
                        </button>

                        {/* İsim */}
                        <button
                            className={`btn btn-secondary`}
                            style={{
                                fontSize: '12px',
                                padding: '6px 12px',
                                background: sortBy?.startsWith('name') ? 'var(--primary)' : undefined,
                                color: sortBy?.startsWith('name') ? 'white' : undefined
                            }}
                            onClick={() => {
                                if (sortBy === 'name-asc') setSortBy('name-desc');
                                else if (sortBy === 'name-desc') setSortBy(null);
                                else setSortBy('name-asc');
                            }}
                        >
                            🔤 İsim {sortBy === 'name-asc' ? 'A→Z' : sortBy === 'name-desc' ? 'Z→A' : ''}
                        </button>

                        {/* Tarih */}
                        <button
                            className={`btn btn-secondary`}
                            style={{
                                fontSize: '12px',
                                padding: '6px 12px',
                                background: sortBy?.startsWith('date') ? 'var(--primary)' : undefined,
                                color: sortBy?.startsWith('date') ? 'white' : undefined
                            }}
                            onClick={() => {
                                if (sortBy === 'date-desc') setSortBy('date-asc');
                                else if (sortBy === 'date-asc') setSortBy(null);
                                else setSortBy('date-desc');
                            }}
                        >
                            📅 Tarih {sortBy === 'date-desc' ? 'Yeni→Eski' : sortBy === 'date-asc' ? 'Eski→Yeni' : ''}
                        </button>

                        {sortBy && (
                            <button
                                className="btn"
                                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--danger)' }}
                                onClick={() => setSortBy(null)}
                            >
                                ✕ Sıralamayı Kaldır
                            </button>
                        )}
                    </div>

                    {productType === 'DAMPER' ? (
                        sortedDampers.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Bu kategoride damper bulunamadı
                            </div>
                        ) : (
                            sortedDampers.map((damper) => {
                                const progress = calculateProgress(damper);
                                const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                const isExpanded = expandedId === damper.id;

                                return (
                                    <div key={damper.id} className="damper-card">
                                        <div
                                            className="damper-card-header"
                                            onClick={() => setExpandedId(isExpanded ? null : damper.id)}
                                        >
                                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>#{damper.imalatNo}</div>
                                            <div style={{ fontWeight: 500 }}>{damper.musteri}</div>
                                            <div>
                                                <span style={{
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    color: 'var(--primary)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px'
                                                }}>
                                                    {damper.tip}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                                {damper.malzemeCinsi} | {damper.m3} M³
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="progress-bar" style={{ width: '100%', maxWidth: '80px' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '35px' }}>{progress}%</span>
                                            </div>
                                            <div>{getStatusBadge(overallStatus)}</div>
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: damper.aracGeldiMi ? 'var(--success)' : 'var(--danger)'
                                            }} title={damper.aracGeldiMi ? 'Araç Geldi' : 'Araç Gelmedi'}></div>
                                            <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</div>
                                        </div>

                                        {isExpanded && (
                                            <div className="damper-card-body">
                                                {/* Araç Geldi Mi */}
                                                {/* Bilgi Kartları (İmalat No, Araç Durumu & Tarih) */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                    gap: '12px',
                                                    marginBottom: '20px',
                                                    paddingBottom: '20px',
                                                    borderBottom: '1px solid var(--border)'
                                                }}>
                                                    {/* İmalat No - Düzenlenebilir */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: !damper.imalatNo ? '2px solid var(--warning)' : '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: !damper.imalatNo ? 'var(--warning)' : 'var(--foreground)' }}>
                                                                {damper.imalatNo ?? 'Girilmedi'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            className="input"
                                                            style={{
                                                                width: '100px',
                                                                padding: '6px 10px',
                                                                fontSize: '13px',
                                                                textAlign: 'center',
                                                                height: '34px'
                                                            }}
                                                            placeholder="İmalat No"
                                                            value={damper.imalatNo ?? ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => {
                                                                const newImalatNo = e.target.value ? parseInt(e.target.value) : null;
                                                                const updated = await updateDamper(damper.id, { imalatNo: newImalatNo });
                                                                setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Şasi No - Düzenlenebilir */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ŞASİ NO</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: damper.sasiNo ? 'var(--foreground)' : 'var(--muted)' }}>
                                                                {damper.sasiNo || 'Girilmedi'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            style={{
                                                                width: '120px',
                                                                padding: '6px 10px',
                                                                fontSize: '13px',
                                                                height: '34px'
                                                            }}
                                                            placeholder="Şasi No"
                                                            value={damper.sasiNo || ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => {
                                                                const newSasiNo = e.target.value;
                                                                const updated = await updateDamper(damper.id, { sasiNo: newSasiNo });
                                                                setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Araç Durumu */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ARAÇ DURUMU</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                {damper.aracGeldiMi ? 'Araç Fabrikada' : 'Araç Gelmedi'}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`step-toggle ${damper.aracGeldiMi ? 'active' : ''}`}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const updated = await updateDamper(damper.id, { aracGeldiMi: !damper.aracGeldiMi });
                                                                setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                            }}
                                                            style={{ transform: 'scale(1.1)' }}
                                                            title="Değiştirmek için tıklayın"
                                                        ></div>
                                                    </div>

                                                    {/* Adet (Quantity) */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADET</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                {damper.adet || 1}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input
                                                                type="number"
                                                                className="input"
                                                                min="1"
                                                                style={{
                                                                    width: '60px',
                                                                    padding: '4px 8px',
                                                                    fontSize: '13px',
                                                                    textAlign: 'center',
                                                                    height: '32px'
                                                                }}
                                                                value={damper.adet || 1}
                                                                onChange={async (e) => {
                                                                    const newAdet = parseInt(e.target.value);
                                                                    if (newAdet > 0) {
                                                                        const updated = await updateDamper(damper.id, { adet: newAdet });
                                                                        setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Tarih/Saat */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px',
                                                        position: 'relative' // İkon konumlandırma için
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>OLUŞTURULMA TARİHİ</div>
                                                            <div style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                                                                {damper.createdAt ? new Date(damper.createdAt).toLocaleString('tr-TR', {
                                                                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                }) : '-'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="datetime-local"
                                                            className="input"
                                                            style={{
                                                                padding: '4px 8px',
                                                                fontSize: '12px',
                                                                width: '40px', // Sadece ikon için
                                                                height: '30px',
                                                                border: '1px solid var(--border)',
                                                                background: 'var(--bg)',
                                                                color: 'transparent',
                                                                cursor: 'pointer',
                                                                opacity: 0, // Tamamen görünmez yap, ama tıklanabilir olsun (custom icon altında)
                                                                position: 'absolute',
                                                                right: '16px',
                                                                zIndex: 10
                                                            }}
                                                            title="Tarihi Düzenle"
                                                            onChange={async (e) => {
                                                                if (e.target.value) {
                                                                    const updated = await updateDamper(damper.id, {
                                                                        createdAt: new Date(e.target.value).toISOString()
                                                                    });
                                                                    setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                                }
                                                            }}
                                                        />
                                                        <div style={{ fontSize: '20px', cursor: 'pointer' }}>📅</div>
                                                    </div>
                                                </div>

                                                {STEP_GROUPS.map((group) => {
                                                    const status = damper[group.statusKey as keyof Damper] as string;
                                                    return (
                                                        <div key={group.key} className="step-group">
                                                            <div className="step-group-title">
                                                                {group.name}
                                                                {getStatusBadge(status)}
                                                            </div>
                                                            <div className="step-items">
                                                                {group.subSteps.map((step) => {
                                                                    const isCompleted = damper[step.key as keyof Damper] as boolean;
                                                                    return (
                                                                        <div key={step.key} className="step-item">
                                                                            <span className="step-item-label">{step.label}</span>
                                                                            <div
                                                                                className={`step-toggle ${isCompleted ? 'active' : ''}`}
                                                                                onClick={() => handleStepToggle(damper.id, step.key, isCompleted, 'DAMPER')}
                                                                            ></div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Muayene ve Teslimat */}
                                                <div className="step-group">
                                                    <div className="step-group-title">MUAYENE & TESLİMAT</div>
                                                    <div className="step-items">
                                                        <div className="step-item">
                                                            <span className="step-item-label">Kurum Muayenesi</span>
                                                            <select
                                                                className="select"
                                                                style={{ width: '120px', padding: '6px 10px', fontSize: '12px' }}
                                                                value={damper.kurumMuayenesi}
                                                                onChange={async (e) => {
                                                                    const updated = await updateDamper(damper.id, { kurumMuayenesi: e.target.value });
                                                                    setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                                }}
                                                            >
                                                                {dropdowns?.kurumMuayenesi.map(v => (
                                                                    <option key={v} value={v}>{v}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="step-item">
                                                            <span className="step-item-label">DMO Muayenesi</span>
                                                            <select
                                                                className="select"
                                                                style={{ width: '140px', padding: '6px 10px', fontSize: '12px' }}
                                                                value={damper.dmoMuayenesi}
                                                                onChange={async (e) => {
                                                                    const updated = await updateDamper(damper.id, { dmoMuayenesi: e.target.value });
                                                                    setDampers(prev => prev.map(d => d.id === damper.id ? updated : d));
                                                                }}
                                                            >
                                                                {dropdowns?.dmoMuayenesi.map(v => (
                                                                    <option key={v} value={v}>{v}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="step-item">
                                                            <span className="step-item-label">Teslimat</span>
                                                            <div
                                                                className={`step-toggle ${damper.teslimat ? 'active' : ''}`}
                                                                onClick={() => handleStepToggle(damper.id, 'teslimat', damper.teslimat, 'DAMPER')}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Delete Button */}
                                                <div style={{
                                                    marginTop: '20px',
                                                    paddingTop: '16px',
                                                    borderTop: '1px solid var(--border)',
                                                    display: 'flex',
                                                    justifyContent: 'flex-end'
                                                }}>
                                                    <button
                                                        className="btn"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            color: 'var(--danger)',
                                                            border: '1px solid var(--danger)'
                                                        }}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`"${damper.musteri}" - İmalat No: ${damper.imalatNo}\n\nBu damperi silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) {
                                                                try {
                                                                    await deleteDamper(damper.id);
                                                                    setDampers(prev => prev.filter(d => d.id !== damper.id));
                                                                    setExpandedId(null);
                                                                    loadData(); // Refresh stats
                                                                } catch (error) {
                                                                    console.error('Error deleting damper:', error);
                                                                    alert('Damper silinirken hata oluştu');
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        🗑️ Damperi Sil
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )
                    ) : (
                        sortedDorses.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Bu kategoride dorse bulunamadı
                            </div>
                        ) : (
                            sortedDorses.map((dorse) => {
                                const progress = calculateDorseProgress(dorse);
                                const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                const isExpanded = expandedId === dorse.id;

                                return (
                                    <div key={dorse.id} className="damper-card">
                                        <div
                                            className="damper-card-header"
                                            onClick={() => setExpandedId(isExpanded ? null : dorse.id)}
                                        >
                                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>#{dorse.imalatNo}</div>
                                            <div style={{ fontWeight: 500 }}>{dorse.musteri}</div>
                                            <div>
                                                <span style={{
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    color: 'var(--primary)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px'
                                                }}>
                                                    {dorse.sacCinsi}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                                {dorse.dingil} | {dorse.m3} M³
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="progress-bar" style={{ width: '100%', maxWidth: '80px' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '35px' }}>{progress}%</span>
                                            </div>
                                            <div>{getStatusBadge(overallStatus)}</div>
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: dorse.dorseGeldiMi ? 'var(--success)' : 'var(--danger)'
                                            }} title={dorse.dorseGeldiMi ? 'Dorse Geldi' : 'Dorse Gelmedi'}></div>
                                            <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</div>
                                        </div>

                                        {isExpanded && (
                                            <div className="damper-card-body">
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                    gap: '12px',
                                                    marginBottom: '20px',
                                                    paddingBottom: '20px',
                                                    borderBottom: '1px solid var(--border)'
                                                }}>
                                                    {/* İmalat No */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: !dorse.imalatNo ? '2px solid var(--warning)' : '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: !dorse.imalatNo ? 'var(--warning)' : 'var(--foreground)' }}>
                                                                {dorse.imalatNo ?? 'Girilmedi'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="number"
                                                            className="input"
                                                            style={{ width: '100px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', height: '34px' }}
                                                            placeholder="İmalat No"
                                                            value={dorse.imalatNo ?? ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => {
                                                                const newImalatNo = e.target.value ? parseInt(e.target.value) : null;
                                                                const updated = await updateDorse(dorse.id, { imalatNo: newImalatNo });
                                                                setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Dorse Durumu */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>DORSE DURUMU</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                {dorse.dorseGeldiMi ? 'Dorse Fabrikada' : 'Dorse Gelmedi'}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`step-toggle ${dorse.dorseGeldiMi ? 'active' : ''}`}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const updated = await updateDorse(dorse.id, { dorseGeldiMi: !dorse.dorseGeldiMi });
                                                                setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                            }}
                                                            style={{ transform: 'scale(1.1)' }}
                                                            title="Değiştirmek için tıklayın"
                                                        ></div>
                                                    </div>

                                                    {/* Adet */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADET</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                {dorse.adet || 1}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <input
                                                                type="number"
                                                                className="input"
                                                                min="1"
                                                                style={{ width: '60px', padding: '4px 8px', fontSize: '13px', textAlign: 'center', height: '32px' }}
                                                                value={dorse.adet || 1}
                                                                onChange={async (e) => {
                                                                    const newAdet = parseInt(e.target.value);
                                                                    if (newAdet > 0) {
                                                                        const updated = await updateDorse(dorse.id, { adet: newAdet });
                                                                        setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                                    }
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Tarih */}
                                                    <div style={{
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '12px 16px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '12px',
                                                        position: 'relative'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>OLUŞTURULMA TARİHİ</div>
                                                            <div style={{ fontSize: '13px', color: 'var(--foreground)' }}>
                                                                {dorse.createdAt ? new Date(dorse.createdAt).toLocaleString('tr-TR', {
                                                                    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                                                }) : '-'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="datetime-local"
                                                            className="input"
                                                            style={{ padding: '4px 8px', fontSize: '12px', width: '40px', height: '30px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'transparent', cursor: 'pointer', opacity: 0, position: 'absolute', right: '16px', zIndex: 10 }}
                                                            title="Tarihi Düzenle"
                                                            onChange={async (e) => {
                                                                if (e.target.value) {
                                                                    const updated = await updateDorse(dorse.id, {
                                                                        createdAt: new Date(e.target.value).toISOString()
                                                                    });
                                                                    setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                                }
                                                            }}
                                                        />
                                                        <div style={{ fontSize: '20px', cursor: 'pointer' }}>📅</div>
                                                    </div>
                                                </div>

                                                {/* Dorse Steps */}
                                                {DORSE_STEP_GROUPS.map((group) => {
                                                    return (
                                                        <div key={group.key} className="step-group">
                                                            <div className="step-group-title">
                                                                {group.name}
                                                            </div>
                                                            <div className="step-items">
                                                                {group.subSteps.map((step) => {
                                                                    const isCompleted = dorse[step.key as keyof Dorse] as boolean;
                                                                    return (
                                                                        <div key={step.key} className="step-item">
                                                                            <span className="step-item-label">{step.label}</span>
                                                                            <div
                                                                                className={`step-toggle ${isCompleted ? 'active' : ''}`}
                                                                                onClick={() => handleStepToggle(dorse.id, step.key, isCompleted, 'DORSE')}
                                                                            ></div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Delete Button */}
                                                <div style={{
                                                    marginTop: '20px',
                                                    paddingTop: '16px',
                                                    borderTop: '1px solid var(--border)',
                                                    display: 'flex',
                                                    justifyContent: 'flex-end'
                                                }}>
                                                    <button
                                                        className="btn"
                                                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm(`"${dorse.musteri}" - İmalat No: ${dorse.imalatNo}\n\nBu dorseyi silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) {
                                                                try {
                                                                    await deleteDorse(dorse.id);
                                                                    setDorses(prev => prev.filter(d => d.id !== dorse.id));
                                                                    setExpandedId(null);
                                                                    loadData();
                                                                } catch (error) {
                                                                    console.error('Error deleting dorse:', error);
                                                                    alert('Dorse silinirken hata oluştu');
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        🗑️ Dorseyi Sil
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )
                    )}
                </div>

                {/* Add Modal */}
                {showAddModal && (
                    <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Yeni {productType === 'DAMPER' ? 'Damper' : 'Dorse'} Ekle</h2>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
                            </div>
                            <form onSubmit={handleCreate}>
                                <div className="modal-body">
                                    {productType === 'DAMPER' ? (
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label className="form-label">İmalat No <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(sonra doldurulabilir)</span></label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    placeholder="Sonra doldurulacak..."
                                                    value={formData.imalatNo}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, imalatNo: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Müşteri *</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    required
                                                    value={formData.musteri}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, musteri: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Araç Geldi Mi *</label>
                                                <select
                                                    className="select"
                                                    value={formData.aracGeldiMi ? 'EVET' : 'HAYIR'}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, aracGeldiMi: e.target.value === 'EVET' }))}
                                                >
                                                    <option value="HAYIR">HAYIR</option>
                                                    <option value="EVET">EVET</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Araç Marka</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: FORD, MERCEDES..."
                                                    value={formData.aracMarka}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, aracMarka: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Model</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: 3545 D, 3345 K..."
                                                    value={formData.model}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Tip *</label>
                                                <select
                                                    className="select"
                                                    required
                                                    value={formData.tip}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, tip: e.target.value }))}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    {dropdowns?.tip.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Malzeme Cinsi *</label>
                                                <select
                                                    className="select"
                                                    required
                                                    value={formData.malzemeCinsi}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, malzemeCinsi: e.target.value }))}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    {dropdowns?.malzemeCinsi.map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">M³</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    step="0.1"
                                                    value={formData.m3}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, m3: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Adet *</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    required
                                                    min="1"
                                                    value={formData.adet}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, adet: e.target.value }))}
                                                />
                                                {parseInt(formData.adet) > 1 && (
                                                    <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>
                                                        💡 {formData.adet} ayrı damper oluşturulacak: {formData.musteri || 'Firma'} 1, {formData.musteri || 'Firma'} 2, ... {formData.musteri || 'Firma'} {formData.adet}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        // DORSE FORM fields
                                        <div className="form-grid">
                                            <div className="form-group">
                                                <label className="form-label">İmalat No <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(sonra doldurulabilir)</span></label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    placeholder="Sonra doldurulacak..."
                                                    value={dorseFormData.imalatNo}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, imalatNo: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Müşteri *</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    required
                                                    value={dorseFormData.musteri}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, musteri: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Dorse Geldi Mi *</label>
                                                <select
                                                    className="select"
                                                    value={dorseFormData.dorseGeldiMi ? 'EVET' : 'HAYIR'}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, dorseGeldiMi: e.target.value === 'EVET' }))}
                                                >
                                                    <option value="HAYIR">HAYIR</option>
                                                    <option value="EVET">EVET</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Dingil</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: PIRLANTA..."
                                                    value={dorseFormData.dingil}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, dingil: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Lastik</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: BRIDGESTONE..."
                                                    value={dorseFormData.lastik}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, lastik: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Tampon</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: ..."
                                                    value={dorseFormData.tampon}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, tampon: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Sac Cinsi</label>
                                                <select
                                                    className="select"
                                                    value={dorseFormData.sacCinsi}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, sacCinsi: e.target.value }))}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    <option value="HARDOX">HARDOX</option>
                                                    <option value="MC 700">MC 700</option>
                                                    <option value="ST 37">ST 37</option>
                                                    <option value="ST 52">ST 52</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">M³</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    step="0.1"
                                                    value={dorseFormData.m3}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, m3: e.target.value }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Adet *</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    required
                                                    min="1"
                                                    value={dorseFormData.adet}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, adet: e.target.value }))}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                        İptal
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        {productType === 'DAMPER' ? 'Damper Ekle' : 'Dorse Ekle'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
}

export default function UrunListesiPage() {
    return (
        <AuthGuard>
            <UrunListesiContent />
        </AuthGuard>
    );
}
