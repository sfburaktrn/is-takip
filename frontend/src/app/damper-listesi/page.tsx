'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import { getDampers, getDropdowns, createDamper, updateDamper, deleteDamper, type Damper, type Dropdowns, STEP_GROUPS } from '@/lib/api';

export default function DamperListesi() {
    const [dampers, setDampers] = useState<Damper[]>([]);
    const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTip, setFilterTip] = useState('');
    const [sortBy, setSortBy] = useState<'progress-asc' | 'progress-desc' | 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | null>(null);
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
        branda: false,
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [dampersData, dropdownsData] = await Promise.all([
                getDampers(),
                getDropdowns()
            ]);
            setDampers(dampersData);
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

    const handleStepToggle = async (damperId: number, stepKey: string, currentValue: boolean) => {
        try {
            const updated = await updateDamper(damperId, { [stepKey]: !currentValue });
            setDampers(prev => prev.map(d => d.id === damperId ? updated : d));
        } catch (error) {
            console.error('Error updating step:', error);
        }
    };

    const handleAddDamper = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createDamper({
                imalatNo: parseInt(formData.imalatNo),
                musteri: formData.musteri,
                aracGeldiMi: formData.aracGeldiMi,
                aracMarka: formData.aracMarka || null,
                model: formData.model || null,
                tip: formData.tip,
                malzemeCinsi: formData.malzemeCinsi,
                m3: formData.m3 ? parseFloat(formData.m3) : null,
                adet: parseInt(formData.adet) || 1,
                branda: formData.branda,
                brandaMontaji: formData.branda,
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
                branda: false,
            });
            loadData();
        } catch (error) {
            console.error('Error creating damper:', error);
            alert('Damper oluşturulurken hata oluştu');
        }
    };

    // Filter and sort dampers
    const sortedDampers = useMemo(() => {
        let result = dampers.filter(d => {
            const matchesSearch = searchTerm === '' ||
                d.musteri.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.imalatNo?.toString().includes(searchTerm);
            const matchesTip = filterTip === '' || d.tip === filterTip;
            return matchesSearch && matchesTip;
        });

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

        return result;
    }, [dampers, searchTerm, filterTip, sortBy, calculateProgress]);

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
                        <h1 className="header-title">Damper Listesi</h1>
                        <p className="header-subtitle">Tüm damper imalat süreçlerini görüntüleyin ve yönetin</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        ➕ Yeni Damper Ekle
                    </button>
                </header>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                    <input
                        type="text"
                        placeholder="İmalat No veya Müşteri ara..."
                        className="input"
                        style={{ maxWidth: '300px' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                        className="select"
                        style={{ maxWidth: '200px' }}
                        value={filterTip}
                        onChange={(e) => setFilterTip(e.target.value)}
                    >
                        <option value="">Tüm Tipler</option>
                        {dropdowns?.tip.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    {/* Sıralama Butonları */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
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
                            📊 % {sortBy === 'progress-asc' ? '↑' : sortBy === 'progress-desc' ? '↓' : ''}
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
                            🔤 {sortBy === 'name-asc' ? 'A→Z' : sortBy === 'name-desc' ? 'Z→A' : 'İsim'}
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
                            📅 {sortBy === 'date-desc' ? 'Yeni' : sortBy === 'date-asc' ? 'Eski' : 'Tarih'}
                        </button>

                        {sortBy && (
                            <button
                                className="btn"
                                style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--danger)' }}
                                onClick={() => setSortBy(null)}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* Damper Cards */}
                <div style={{ marginTop: '20px' }}>
                    {sortedDampers.map((damper) => {
                        const progress = calculateProgress(damper);
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
                                    {(() => {
                                        const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                        return <div>{getStatusBadge(overallStatus)}</div>;
                                    })()}
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
                                        {/* Bilgi Kartları (Araç Durumu & Tarih) */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                            gap: '12px',
                                            marginBottom: '20px',
                                            paddingBottom: '20px',
                                            borderBottom: '1px solid var(--border)'
                                        }}>
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
                                                position: 'relative'
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
                                                        width: 'auto',
                                                        maxWidth: '40px', // Sadece ikon görünsün diye daralttım, üzerine gelince açılabilir veya ikon koyabiliriz. Ama şimdilik standart input.
                                                        border: '1px solid var(--border)',
                                                        background: 'var(--bg)',
                                                        color: 'transparent' // Tarihi gizle, sadece takvim ikonu kalsın
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
                                                <div style={{ position: 'absolute', right: '35px', pointerEvents: 'none', fontSize: '16px' }}>📅</div>
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
                                                                        onClick={() => handleStepToggle(damper.id, step.key, isCompleted)}
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
                                                    <span className="step-item-label">Branda Montajı</span>
                                                    <div
                                                        className={`step-toggle ${damper.brandaMontaji ? 'active' : ''}`}
                                                        onClick={() => handleStepToggle(damper.id, 'brandaMontaji', damper.brandaMontaji)}
                                                    ></div>
                                                </div>
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
                                                        onClick={() => handleStepToggle(damper.id, 'teslimat', damper.teslimat)}
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
                    })}
                </div>

                {/* Add Modal */}
                {showAddModal && (
                    <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Yeni Damper Ekle</h2>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
                            </div>
                            <form onSubmit={handleAddDamper}>
                                <div className="modal-body">
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label className="form-label">İmalat No *</label>
                                            <input
                                                type="number"
                                                className="input"
                                                required
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
                                            <label className="form-label">Branda *</label>
                                            <select
                                                className="select"
                                                value={formData.branda ? 'VAR' : 'YOK'}
                                                onChange={(e) => setFormData(prev => ({ ...prev, branda: e.target.value === 'VAR' }))}
                                            >
                                                <option value="YOK">YOK</option>
                                                <option value="VAR">VAR</option>
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
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                        İptal
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        Damper Ekle
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
