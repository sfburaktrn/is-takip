'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import {
    Package,
    CheckCircle,
    RefreshCcw,
    PauseCircle,
    Plus,
    Link as LinkIcon,
    User,
    Search,
    Trash2,
    Calendar,
    Truck,
    Lightbulb,
    ArrowUp,
    ArrowDown,
    LineChart,
    Type
} from 'lucide-react';

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
    type Sasi,
    type Dropdowns,
    STEP_GROUPS,
    DORSE_STEP_GROUPS,
    SASI_STEP_GROUPS,
    getSasis,
    createSasi,
    updateSasi,
    deleteSasi
} from '@/lib/api'; // Correct import path assumption? It was '@/lib/api' in view_file.

type ProductType = 'DAMPER' | 'DORSE' | 'SASI';

function UrunListesiContent() {
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const [stats, setStats] = useState<Stats | null>(null);
    const [dampers, setDampers] = useState<Damper[]>([]);
    const [dorses, setDorses] = useState<Dorse[]>([]);
    const [sasis, setSasis] = useState<Sasi[]>([]);
    const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);

    const COLORS = {
        primary: '#022347',
        secondary: '#64748B',
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        grid: '#E2E8F0'
    };
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [sasiFilter, setSasiFilter] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'progress-asc' | 'progress-desc' | 'name-asc' | 'name-desc' | 'date-asc' | 'date-desc' | null>(null);

    // Sasi Link Modal State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [activeDorseForLink, setActiveDorseForLink] = useState<Dorse | null>(null);
    const [linkFilter, setLinkFilter] = useState<'hepsi' | 'stok' | 'musteri'>('hepsi');
    const [linkSearchTerm, setLinkSearchTerm] = useState('');
    const [availableSasis, setAvailableSasis] = useState<Sasi[]>([]);
    const [linkLoading, setLinkLoading] = useState(false);

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
    // Dorse Form State
    const [dorseFormData, setDorseFormData] = useState({
        imalatNo: '',
        musteri: '',
        cekiciGeldiMi: false,
        dingil: '',
        lastik: '',
        tampon: '',
        kalinlik: '',
        m3: '',
        adet: '1',
        sasiId: '',
    });

    // Sasi Form State
    const [sasiFormData, setSasiFormData] = useState({
        imalatNo: '',
        musteri: '',
        sasiNo: '',
        tampon: '',
        dingil: '',
        adet: '1',
        isStok: true,
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [damperStats, dorseStats, sasiStats, dampersData, dorsesData, sasisData, dropdownsData] = await Promise.all([
                getStats('DAMPER'),
                getStats('DORSE'),
                getStats('SASI'),
                getDampers(),
                getDorses(),
                getSasis(),
                getDropdowns()
            ]);
            setStats(productType === 'DAMPER' ? damperStats : productType === 'DORSE' ? dorseStats : sasiStats);
            setDampers(dampersData);
            setDorses(dorsesData);
            setSasis(sasisData);
            setDropdowns(dropdownsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    }

    // Refresh stats when product type changes
    useEffect(() => {
        async function updateStats() {
            const s = await getStats(productType);
            setStats(s);
        }
        updateStats();
    }, [productType]);

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
            dorse.cekiciElektrik, dorse.cekiciHidrolik,
            dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.aracKontrolBypassAyari,
            dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat, dorse.teslimat
        ];
        const completed = steps.filter(Boolean).length;
        // akmTseMuayenesi and dmoMuayenesi are excluded - they don't block completion
        return Math.round((completed / steps.length) * 100);
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
            dorse.cekiciElektrik, dorse.cekiciHidrolik,
            dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.aracKontrolBypassAyari,
            dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat, dorse.teslimat
        ];

        const completedSteps = allSteps.filter(Boolean).length;
        // akmTseMuayenesi and dmoMuayenesi are excluded - they don't block completion
        const totalSteps = allSteps.length;

        if (completedSteps === totalSteps) {
            return 'tamamlanan';
        } else if (completedSteps === 0) {
            return 'baslamayan';
        } else {
            return 'devamEden';
        }
    };

    const calculateSasiProgress = (sasi: Sasi): number => {
        const allSteps: boolean[] = [];
        SASI_STEP_GROUPS.forEach(group => {
            group.subSteps.forEach(step => {
                // @ts-ignore
                allSteps.push(sasi[step.key]);
            });
        });

        const completed = allSteps.filter(Boolean).length;
        const total = allSteps.length;
        return total === 0 ? 0 : Math.round((completed / total) * 100);
    };

    const getSasiStatus = (sasi: Sasi): string => {
        const allSteps: boolean[] = [];
        SASI_STEP_GROUPS.forEach(group => {
            group.subSteps.forEach(step => {
                // @ts-ignore
                allSteps.push(sasi[step.key]);
            });
        });

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

    const handleLinkSasi = async (dorseId: number, sasiId: number) => {
        try {
            setLinkLoading(true);
            const { linkSasi } = await import('@/lib/api');
            const updatedDorse = await linkSasi(dorseId, sasiId);
            setDorses(prev => prev.map(d => d.id === dorseId ? updatedDorse : d));
            setShowLinkModal(false);
            loadData(); // Refresh stats and list
        } catch (error) {
            console.error('Error linking sasi:', error);
            alert('Şasi bağlanırken hata oluştu');
        } finally {
            setLinkLoading(false);
        }
    };

    const openLinkModal = async (dorse: Dorse) => {
        try {
            setActiveDorseForLink(dorse);
            const { getSasis } = await import('@/lib/api');
            const unlinkedSasis = await getSasis(true);
            setAvailableSasis(unlinkedSasis);
            setShowLinkModal(true);
        } catch (error) {
            console.error('Error fetching unlinked sasis:', error);
        }
    };

    const handleStepToggle = async (id: number, stepKey: string, currentValue: boolean, type: ProductType) => {
        try {
            if (type === 'DAMPER') {
                const updated = await updateDamper(id, { [stepKey]: !currentValue });
                setDampers(prev => prev.map(d => d.id === id ? updated : d));
            } else if (type === 'DORSE') {
                const updated = await updateDorse(id, { [stepKey]: !currentValue });
                setDorses(prev => prev.map(d => d.id === id ? updated : d));
            } else {
                const updated = await updateSasi(id, { [stepKey]: !currentValue });
                setSasis(prev => prev.map(s => s.id === id ? updated : s));
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
        } else if (productType === 'SASI') {
            // Sasi Creation
            const quantity = parseInt(sasiFormData.adet) || 1;
            try {
                await createSasi({
                    imalatNo: sasiFormData.imalatNo ? parseInt(sasiFormData.imalatNo) : null,
                    musteri: sasiFormData.isStok ? 'Stok' : sasiFormData.musteri,
                    sasiNo: sasiFormData.sasiNo || null,
                    tampon: sasiFormData.tampon || null,
                    dingil: sasiFormData.dingil || null,
                    adet: quantity,
                });
                setShowAddModal(false);
                setSasiFormData({
                    imalatNo: '',
                    musteri: '',
                    sasiNo: '',
                    tampon: '',
                    dingil: '',
                    adet: '1',
                    isStok: true,
                });
                loadData();
                if (quantity > 1) {
                    alert(`${quantity} adet şasi başarıyla oluşturuldu!`);
                }
            } catch (error) {
                console.error('Error creating sasi:', error);
                alert('Şasi oluşturulurken hata oluştu');
            }
        } else {
            // Dorse Creation
            const quantity = parseInt(dorseFormData.adet) || 1;
            try {
                await createDorse({
                    imalatNo: dorseFormData.imalatNo ? parseInt(dorseFormData.imalatNo) : 0,
                    musteri: dorseFormData.musteri,
                    cekiciGeldiMi: dorseFormData.cekiciGeldiMi,
                    dingil: dorseFormData.dingil || null,
                    lastik: dorseFormData.lastik || null,
                    tampon: dorseFormData.tampon || null,
                    kalinlik: dorseFormData.kalinlik,
                    m3: dorseFormData.m3 ? parseFloat(dorseFormData.m3) : null,
                    adet: quantity,
                    sasiId: dorseFormData.sasiId ? parseInt(dorseFormData.sasiId) : null,
                });
                setShowAddModal(false);
                setDorseFormData({
                    imalatNo: '',
                    musteri: '',
                    cekiciGeldiMi: false,
                    dingil: '',
                    lastik: '',
                    tampon: '',
                    kalinlik: '',
                    m3: '',
                    adet: '1',
                    sasiId: '',
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
        let result = [...dampers];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(d =>
                (d.musteri || '').toLowerCase().includes(lowerTerm) ||
                (d.aracMarka || '').toLowerCase().includes(lowerTerm) ||
                (d.model || '').toLowerCase().includes(lowerTerm) ||
                (d.imalatNo || '').toString().includes(lowerTerm)
            );
        }

        if (statusFilter) {
            result = result.filter(d => getDamperStatus(d) === statusFilter);
        }

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

        return statusFilter || sortBy || searchTerm ? result : result.slice(0, 50); // Increased limit as this is the main list
    }, [dampers, statusFilter, sortBy, searchTerm]);

    // Filter and sort dorses
    const sortedDorses = useMemo(() => {
        let result = [...dorses];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(d =>
                (d.musteri || '').toLowerCase().includes(lowerTerm) ||
                (d.imalatNo || '').toString().includes(lowerTerm)
            );
        }

        if (statusFilter) {
            result = result.filter(d => getDorseStatus(d) === statusFilter);
        }

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

        return statusFilter || sortBy || searchTerm ? result : result.slice(0, 50); // Increased limit
    }, [dorses, statusFilter, sortBy, searchTerm]);

    // Filter and sort sasis
    const sortedSasis = useMemo(() => {
        let result = [...sasis];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(s =>
                (s.musteri || '').toLowerCase().includes(lowerTerm) ||
                (s.sasiNo || '').toLowerCase().includes(lowerTerm) ||
                (s.imalatNo || '').toString().includes(lowerTerm)
            );
        }

        if (statusFilter) {
            if (statusFilter === 'tamamlanan') {
                result = result.filter(s => getSasiStatus(s) === 'tamamlanan');
            } else if (statusFilter === 'devamEden') {
                result = result.filter(s => getSasiStatus(s) === 'devamEden');
            } else if (statusFilter === 'baslamayan') {
                result = result.filter(s => getSasiStatus(s) === 'baslamayan');
            } else if (statusFilter === 'bosStok') {
                result = result.filter(s => (s.musteri || '').toLowerCase().startsWith('stok') && !(s as any).isLinked);
            } else if (statusFilter === 'tamamlananStok') {
                result = result.filter(s => (s.musteri || '').toLowerCase().startsWith('stok') && getSasiStatus(s) === 'tamamlanan');
            } else if (statusFilter === 'devamEdenStok') {
                result = result.filter(s => (s.musteri || '').toLowerCase().startsWith('stok') && getSasiStatus(s) === 'devamEden');
            } else if (statusFilter === 'bosMusteri') {
                result = result.filter(s => !(s.musteri || '').toLowerCase().startsWith('stok') && !(s as any).isLinked);
            } else if (statusFilter === 'tamamlananMusteri') {
                result = result.filter(s => !(s.musteri || '').toLowerCase().startsWith('stok') && getSasiStatus(s) === 'tamamlanan');
            } else if (statusFilter === 'devamEdenMusteri') {
                result = result.filter(s => !(s.musteri || '').toLowerCase().startsWith('stok') && getSasiStatus(s) === 'devamEden');
            }
        }

        if (sasiFilter) {
            result = result.filter(s => {
                if (sasiFilter === 'Kırma-BPW') return s.tampon === 'Kırma Tampon' && s.dingil === 'BPW';
                if (sasiFilter === 'Kırma-TRAX') return s.tampon === 'Kırma Tampon' && s.dingil === 'TRAX';
                if (sasiFilter === 'Sabit-TRAX') return s.tampon === 'Sabit Tampon' && s.dingil === 'TRAX';
                if (sasiFilter === 'Sabit-BPW') return s.tampon === 'Sabit Tampon' && s.dingil === 'BPW';
                return true;
            });
        }

        if (sortBy) {
            result.sort((a, b) => {
                switch (sortBy) {
                    case 'progress-asc':
                        return calculateSasiProgress(a) - calculateSasiProgress(b);
                    case 'progress-desc':
                        return calculateSasiProgress(b) - calculateSasiProgress(a);
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

        return statusFilter || sortBy || sasiFilter || searchTerm ? result : result.slice(0, 50);
    }, [sasis, statusFilter, sortBy, sasiFilter, searchTerm]);

    const currentStats = useMemo(() => {
        if (productType === 'DAMPER') return stats;

        if (productType === 'SASI') {
            return {
                total: sasis.length,
                tamamlanan: sasis.filter(s => getSasiStatus(s) === 'tamamlanan').length,
                devamEden: sasis.filter(s => getSasiStatus(s) === 'devamEden').length,
                baslamayan: sasis.filter(s => getSasiStatus(s) === 'baslamayan').length
            };
        }

        // Calculate Dorse stats client-side
        return {
            total: dorses.length,
            tamamlanan: dorses.filter(d => getDorseStatus(d) === 'tamamlanan').length,
            devamEden: dorses.filter(d => getDorseStatus(d) === 'devamEden').length,
            baslamayan: dorses.filter(d => getDorseStatus(d) === 'baslamayan').length
        };
    }, [productType, stats, dorses, sasis]);

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
                            <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'} imalat süreçlerini görüntüleyin ve yönetin</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                            <Plus size={18} /> Yeni {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'} Ekle
                        </button>
                    </div>

                    {/* Product Toggle & Search */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
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

                        <div style={{ position: 'relative', flex: '1 1 300px', minWidth: '250px', maxWidth: '400px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: COLORS.secondary }} />
                            <input
                                type="text"
                                placeholder={`${productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'} Ara...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px 10px 10px 40px',
                                    borderRadius: '8px',
                                    border: `1px solid ${COLORS.grid}`,
                                    fontSize: '14px',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    backgroundColor: 'white',
                                    color: 'var(--foreground)'
                                }}
                                onFocus={(e) => e.target.style.borderColor = COLORS.primary}
                                onBlur={(e) => e.target.style.borderColor = COLORS.grid}
                            />
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                {/* Stats Grid */}
                {productType === 'SASI' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'stretch', marginBottom: '24px' }}>

                        {/* 1. GENEL DURUM (Sol) - 2 Kart */}
                        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div
                                style={{
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${COLORS.primary}`,
                                    borderTop: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                    borderRight: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                    borderBottom: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setStatusFilter(null)}
                            >
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Package size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.total || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Toplam Şasi</div>
                                </div>
                            </div>
                            <div
                                style={{
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${COLORS.success}`,
                                    borderTop: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                    borderRight: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                    borderBottom: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setStatusFilter(statusFilter === 'tamamlanan' ? null : 'tamamlanan')}
                            >
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <CheckCircle size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.tamamlanan || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Tamamlanan</div>
                                </div>
                            </div>
                        </div>

                        {/* 2. GENEL DURUM (Sağ) - 2 Kart */}
                        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div
                                style={{
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${COLORS.warning}`,
                                    borderTop: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                    borderRight: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                    borderBottom: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setStatusFilter(statusFilter === 'devamEden' ? null : 'devamEden')}
                            >
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <RefreshCcw size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.devamEden || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Devam Eden</div>
                                </div>
                            </div>
                            <div
                                style={{
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${COLORS.danger}`,
                                    borderTop: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid #E2E8F0',
                                    borderRight: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid #E2E8F0',
                                    borderBottom: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid #E2E8F0',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    backgroundColor: 'white',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                                    transition: 'all 0.2s'
                                }}
                                onClick={() => setStatusFilter(statusFilter === 'baslamayan' ? null : 'baslamayan')}
                            >
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', color: COLORS.danger,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <PauseCircle size={24} strokeWidth={2} />
                                </div>
                                <div>
                                    <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.baslamayan || 0}</div>
                                    <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Başlamayan</div>
                                </div>
                            </div>
                        </div>

                        {/* 3. STOK ŞASİLER GRUBU - 3 Kart */}
                        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', height: '20px' }}>STOK ŞASİLER</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${COLORS.primary}`,
                                        borderTop: statusFilter === 'bosStok' ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                        borderRight: statusFilter === 'bosStok' ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                        borderBottom: statusFilter === 'bosStok' ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setStatusFilter(statusFilter === 'bosStok' ? null : 'bosStok')}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Package size={18} />
                                    </div>
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.primary, fontWeight: 700 }}>{stats?.stokSasiCount || 0}</div>
                                        <div className="stat-label" style={{ fontSize: '11px', color: '#64748B' }}>Boş Stok</div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${COLORS.success}`,
                                        borderTop: statusFilter === 'tamamlananStok' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                        borderRight: statusFilter === 'tamamlananStok' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                        borderBottom: statusFilter === 'tamamlananStok' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setStatusFilter(statusFilter === 'tamamlananStok' ? null : 'tamamlananStok')}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <CheckCircle size={18} />
                                    </div>
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.success, fontWeight: 700 }}>{stats?.tamamlananStok || 0}</div>
                                        <div className="stat-label" style={{ fontSize: '11px', color: '#64748B' }}>Bitmiş Stok</div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${COLORS.warning}`,
                                        borderTop: statusFilter === 'devamEdenStok' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                        borderRight: statusFilter === 'devamEdenStok' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                        borderBottom: statusFilter === 'devamEdenStok' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setStatusFilter(statusFilter === 'devamEdenStok' ? null : 'devamEdenStok')}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <RefreshCcw size={18} />
                                    </div>
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.warning, fontWeight: 700 }}>{stats?.devamEdenStok || 0}</div>
                                        <div className="stat-label" style={{ fontSize: '11px', color: '#64748B' }}>Devam Eden</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. MÜŞTERİ ŞASİLER GRUBU - 3 Kart */}
                        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', height: '20px' }}>MÜŞTERİ ŞASİLER</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${COLORS.info}`,
                                        borderTop: statusFilter === 'bosMusteri' ? `2px solid ${COLORS.info}` : '1px solid #E2E8F0',
                                        borderRight: statusFilter === 'bosMusteri' ? `2px solid ${COLORS.info}` : '1px solid #E2E8F0',
                                        borderBottom: statusFilter === 'bosMusteri' ? `2px solid ${COLORS.info}` : '1px solid #E2E8F0',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setStatusFilter(statusFilter === 'bosMusteri' ? null : 'bosMusteri')}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: 'rgba(59, 130, 246, 0.1)', color: COLORS.info,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.info, fontWeight: 700 }}>{stats?.musteriSasiCount || 0}</div>
                                        <div className="stat-label" style={{ fontSize: '11px', color: '#64748B' }}>Boş Müşteri</div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${COLORS.success}`,
                                        borderTop: statusFilter === 'tamamlananMusteri' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                        borderRight: statusFilter === 'tamamlananMusteri' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                        borderBottom: statusFilter === 'tamamlananMusteri' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setStatusFilter(statusFilter === 'tamamlananMusteri' ? null : 'tamamlananMusteri')}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <CheckCircle size={18} />
                                    </div>
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.success, fontWeight: 700 }}>{stats?.tamamlananMusteri || 0}</div>
                                        <div className="stat-label" style={{ fontSize: '11px', color: '#64748B' }}>Bitmiş Müşteri</div>
                                    </div>
                                </div>
                                <div
                                    style={{
                                        cursor: 'pointer',
                                        borderLeft: `4px solid ${COLORS.warning}`,
                                        borderTop: statusFilter === 'devamEdenMusteri' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                        borderRight: statusFilter === 'devamEdenMusteri' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                        borderBottom: statusFilter === 'devamEdenMusteri' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                        borderRadius: '12px',
                                        padding: '12px',
                                        backgroundColor: 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => setStatusFilter(statusFilter === 'devamEdenMusteri' ? null : 'devamEdenMusteri')}
                                >
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <RefreshCcw size={18} />
                                    </div>
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.warning, fontWeight: 700 }}>{stats?.devamEdenMusteri || 0}</div>
                                        <div className="stat-label" style={{ fontSize: '11px', color: '#64748B' }}>Devam Eden</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="stats-grid" style={{
                        gridTemplateColumns: 'repeat(4, 1fr)'
                    }}>
                        <div
                            style={{
                                cursor: 'pointer',
                                borderLeft: `4px solid ${COLORS.primary}`,
                                borderTop: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                borderRight: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                borderBottom: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '16px',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex', alignItems: 'center', gap: '16px',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setStatusFilter(null)}
                        >
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Package size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.total || 0}</div>
                                <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Toplam {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'}</div>
                            </div>
                        </div>

                        <div
                            style={{
                                cursor: 'pointer',
                                borderLeft: `4px solid ${COLORS.success}`,
                                borderTop: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                borderRight: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                borderBottom: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '16px',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex', alignItems: 'center', gap: '16px',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setStatusFilter(statusFilter === 'tamamlanan' ? null : 'tamamlanan')}
                        >
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <CheckCircle size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.tamamlanan || 0}</div>
                                <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Tamamlanan</div>
                            </div>
                        </div>
                        <div
                            style={{
                                cursor: 'pointer',
                                borderLeft: `4px solid ${COLORS.warning}`,
                                borderTop: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                borderRight: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                borderBottom: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '16px',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex', alignItems: 'center', gap: '16px',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setStatusFilter(statusFilter === 'devamEden' ? null : 'devamEden')}
                        >
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <RefreshCcw size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.devamEden || 0}</div>
                                <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Devam Eden</div>
                            </div>
                        </div>
                        <div
                            style={{
                                cursor: 'pointer',
                                borderLeft: `4px solid ${COLORS.danger}`,
                                borderTop: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid #E2E8F0',
                                borderRight: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid #E2E8F0',
                                borderBottom: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid #E2E8F0',
                                borderRadius: '12px',
                                padding: '16px',
                                backgroundColor: 'white',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                display: 'flex', alignItems: 'center', gap: '16px',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => setStatusFilter(statusFilter === 'baslamayan' ? null : 'baslamayan')}
                        >
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: COLORS.danger,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <PauseCircle size={24} strokeWidth={2} />
                            </div>
                            <div>
                                <div className="stat-value" style={{ color: '#1E293B', fontSize: '24px', fontWeight: 700 }}>{currentStats?.baslamayan || 0}</div>
                                <div className="stat-label" style={{ color: '#64748B', fontSize: '14px' }}>Başlamayan</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dampers List */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                            {statusFilter === 'tamamlanan' && `✅ Tamamlanan ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : 'Şasiler'}`}
                            {statusFilter === 'devamEden' && `🔄 Devam Eden ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : 'Şasiler'}`}
                            {statusFilter === 'baslamayan' && `⏸️ Başlamayan ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : 'Şasiler'}`}
                            {!statusFilter && `Tüm ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : 'Şasiler'}`}
                        </h2>
                        {statusFilter && (
                            <button className="btn btn-secondary" onClick={() => setStatusFilter(null)}>
                                ✕ Filtreyi Kaldır
                            </button>
                        )}
                    </div>

                    {/* Sasi Filters */}
                    {productType === 'SASI' && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            <button
                                className={`btn btn-secondary`}
                                style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    background: sasiFilter === 'Kırma-BPW' ? 'var(--primary)' : undefined,
                                    color: sasiFilter === 'Kırma-BPW' ? 'white' : undefined,
                                    border: sasiFilter === 'Kırma-BPW' ? 'none' : undefined
                                }}
                                onClick={() => setSasiFilter(sasiFilter === 'Kırma-BPW' ? null : 'Kırma-BPW')}
                            >
                                Kırma-BPW
                            </button>
                            <button
                                className={`btn btn-secondary`}
                                style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    background: sasiFilter === 'Kırma-TRAX' ? 'var(--primary)' : undefined,
                                    color: sasiFilter === 'Kırma-TRAX' ? 'white' : undefined,
                                    border: sasiFilter === 'Kırma-TRAX' ? 'none' : undefined
                                }}
                                onClick={() => setSasiFilter(sasiFilter === 'Kırma-TRAX' ? null : 'Kırma-TRAX')}
                            >
                                Kırma-TRAX
                            </button>
                            <button
                                className={`btn btn-secondary`}
                                style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    background: sasiFilter === 'Sabit-TRAX' ? 'var(--primary)' : undefined,
                                    color: sasiFilter === 'Sabit-TRAX' ? 'white' : undefined,
                                    border: sasiFilter === 'Sabit-TRAX' ? 'none' : undefined
                                }}
                                onClick={() => setSasiFilter(sasiFilter === 'Sabit-TRAX' ? null : 'Sabit-TRAX')}
                            >
                                Sabit-TRAX
                            </button>
                            <button
                                className={`btn btn-secondary`}
                                style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    background: sasiFilter === 'Sabit-BPW' ? 'var(--primary)' : undefined,
                                    color: sasiFilter === 'Sabit-BPW' ? 'white' : undefined,
                                    border: sasiFilter === 'Sabit-BPW' ? 'none' : undefined
                                }}
                                onClick={() => setSasiFilter(sasiFilter === 'Sabit-BPW' ? null : 'Sabit-BPW')}
                            >
                                Sabit-BPW
                            </button>
                            {sasiFilter && (
                                <button className="btn btn-secondary" onClick={() => setSasiFilter(null)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    ✕ Filtreyi Kaldır
                                </button>
                            )}
                        </div>
                    )}

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
                            <LineChart size={16} /> Tamamlama % {sortBy === 'progress-asc' ? <ArrowUp size={14} /> : sortBy === 'progress-desc' ? <ArrowDown size={14} /> : ''}
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
                            <Type size={16} /> İsim {sortBy === 'name-asc' ? 'A→Z' : sortBy === 'name-desc' ? 'Z→A' : ''}
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
                            <Calendar size={16} /> Tarih {sortBy === 'date-desc' ? 'Yeni→Eski' : sortBy === 'date-asc' ? 'Eski→Yeni' : ''}
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
                                                        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                            <Calendar size={20} />
                                                        </div>
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
                                                        <Trash2 size={16} /> Damperi Sil
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );

                            })
                        )
                    ) : productType === 'SASI' ? (
                        sortedSasis.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Bu kategoride şasi bulunamadı
                            </div>
                        ) : (
                            sortedSasis.map((sasi) => {
                                const progress = calculateSasiProgress(sasi);
                                let overallStatus = getSasiStatus(sasi);
                                overallStatus = overallStatus === 'tamamlanan' ? 'TAMAMLANDI' : overallStatus === 'baslamayan' ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                const isExpanded = expandedId === sasi.id;

                                return (
                                    <div key={sasi.id} className="damper-card">
                                        {/* Header */}
                                        <div
                                            className="damper-card-header"
                                            onClick={() => setExpandedId(isExpanded ? null : sasi.id)}
                                        >
                                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>#{sasi.imalatNo}</div>
                                            <div style={{ fontWeight: 500 }}>{sasi.musteri}</div>
                                            <div>
                                                <span style={{
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    color: 'var(--primary)',
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px'
                                                }}>
                                                    {sasi.tampon || '-'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                                                {sasi.sasiNo || '-'} | {sasi.dingil || '-'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="progress-bar" style={{ width: '100%', maxWidth: '80px' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '35px' }}>{progress}%</span>
                                            </div>
                                            <div>{getStatusBadge(overallStatus)}</div>
                                            <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</div>
                                        </div>

                                        {/* Body */}
                                        {isExpanded && (
                                            <div className="damper-card-body">
                                                {/* Info Cards */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                    gap: '12px',
                                                    marginBottom: '20px',
                                                    paddingBottom: '20px',
                                                    borderBottom: '1px solid var(--border)'
                                                }}>

                                                    {/* IMALAT NO */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ŞASİ NO</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{sasi.imalatNo}</div>
                                                        </div>
                                                        <input type="number" className="input" style={{ width: '80px', padding: '4px', fontSize: '13px', textAlign: 'center' }} value={sasi.imalatNo || ''} onChange={async (e) => {
                                                            const val = e.target.value ? parseInt(e.target.value) : null;
                                                            const updated = await updateSasi(sasi.id, { imalatNo: val });
                                                            setSasis(prev => prev.map(s => s.id === sasi.id ? updated : s));
                                                        }} onClick={e => e.stopPropagation()} />
                                                    </div>


                                                    {/* MÜŞTERİ (Editable) */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>MÜŞTERİ / İSİM</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{sasi.musteri}</div>
                                                        </div>
                                                        <input type="text" className="input" style={{ width: '120px', padding: '4px', fontSize: '13px' }} value={sasi.musteri || ''} onChange={async (e) => {
                                                            const updated = await updateSasi(sasi.id, { musteri: e.target.value });
                                                            setSasis(prev => prev.map(s => s.id === sasi.id ? updated : s));
                                                        }} onClick={e => e.stopPropagation()} placeholder="İsim Giriniz" />
                                                    </div>

                                                    {/* TAMPON */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TAMPON</div>
                                                        <select className="select" style={{ width: '100%', padding: '4px', fontSize: '13px', background: 'var(--card-bg-secondary)', border: 'none', color: 'var(--foreground)' }} value={sasi.tampon || ''} onChange={async (e) => {
                                                            const updated = await updateSasi(sasi.id, { tampon: e.target.value });
                                                            setSasis(prev => prev.map(s => s.id === sasi.id ? updated : s));
                                                        }} onClick={e => e.stopPropagation()}>
                                                            <option style={{ color: 'black' }} value="">Seçiniz</option>
                                                            <option style={{ color: 'black' }} value="Kırma Tampon">KIRMA</option>
                                                            <option style={{ color: 'black' }} value="Sabit Tampon">SABİT</option>
                                                        </select>
                                                    </div>

                                                    {/* DINGIL */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>DİNGİL</div>
                                                        <select className="select" style={{ width: '100%', padding: '4px', fontSize: '13px', background: 'var(--card-bg-secondary)', border: 'none', color: 'var(--foreground)' }} value={sasi.dingil || ''} onChange={async (e) => {
                                                            const updated = await updateSasi(sasi.id, { dingil: e.target.value });
                                                            setSasis(prev => prev.map(s => s.id === sasi.id ? updated : s));
                                                        }} onClick={e => e.stopPropagation()}>
                                                            <option style={{ color: 'black' }} value="">Seçiniz</option>
                                                            <option style={{ color: 'black' }} value="TRAX">TRAX</option>
                                                            <option style={{ color: 'black' }} value="BPW">BPW</option>
                                                        </select>
                                                    </div>

                                                    {/* TARİH */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TARİH</div>
                                                            <div style={{ fontSize: '13px' }}>{sasi.createdAt ? new Date(sasi.createdAt).toLocaleDateString() : '-'}</div>
                                                        </div>
                                                        <input type="date" className="input" style={{ width: '110px', padding: '4px', fontSize: '12px' }} onChange={async (e) => {
                                                            if (e.target.value) {
                                                                const updated = await updateSasi(sasi.id, { createdAt: new Date(e.target.value).toISOString() });
                                                                setSasis(prev => prev.map(s => s.id === sasi.id ? updated : s));
                                                            }
                                                        }} onClick={e => e.stopPropagation()} />
                                                    </div>

                                                </div>

                                                {/* Steps */}
                                                {SASI_STEP_GROUPS.map((group) => {
                                                    const status = sasi[group.statusKey as keyof Sasi] as string;
                                                    return (
                                                        <div key={group.key} className="step-group">
                                                            <div className="step-group-title">
                                                                {group.name}
                                                                {getStatusBadge(status)}
                                                            </div>
                                                            <div className="step-items">
                                                                {group.subSteps.map((step) => {
                                                                    const isCompleted = sasi[step.key as keyof Sasi] as boolean;
                                                                    return (
                                                                        <div key={step.key} className="step-item">
                                                                            <span className="step-item-label">{step.label}</span>
                                                                            <div
                                                                                className={`step-toggle ${isCompleted ? 'active' : ''}`}
                                                                                onClick={() => handleStepToggle(sasi.id, step.key, isCompleted, 'SASI')}
                                                                            ></div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* Delete */}
                                                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }} onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Sasi #${sasi.imalatNo} silinecek. Emin misiniz?`)) {
                                                            await deleteSasi(sasi.id);
                                                            setSasis(prev => prev.filter(s => s.id !== sasi.id));
                                                            loadData();
                                                        }
                                                    }}><Trash2 size={16} /> Şasiyi Sil</button>
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
                                                    {dorse.kalinlik}
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
                                                background: dorse.cekiciGeldiMi ? 'var(--success)' : 'var(--danger)'
                                            }} title={dorse.cekiciGeldiMi ? 'Çekici Geldi' : 'Çekici Gelmedi'}></div>
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

                                                    {/* Şasi No */}
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
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: !dorse.sasiNo ? 'var(--muted)' : 'var(--foreground)' }}>
                                                                {dorse.sasiNo ?? 'Girilmedi'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            style={{ width: '100px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', height: '34px' }}
                                                            placeholder="Şasi No"
                                                            value={dorse.sasiNo ?? ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => {
                                                                const newSasiNo = e.target.value;
                                                                const updated = await updateDorse(dorse.id, { sasiNo: newSasiNo });
                                                                setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Kalınlık */}
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>KALINLIK</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: !dorse.kalinlik ? 'var(--muted)' : 'var(--foreground)' }}>
                                                                {dorse.kalinlik ?? 'Girilmedi'}
                                                            </div>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="input"
                                                            style={{ width: '100px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', height: '34px' }}
                                                            placeholder="Kalınlık"
                                                            value={dorse.kalinlik ?? ''}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={async (e) => {
                                                                const newKalinlik = e.target.value;
                                                                const updated = await updateDorse(dorse.id, { kalinlik: newKalinlik });
                                                                setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Şasi Bağlantısı */}
                                                    <div style={{
                                                        gridColumn: '1 / -1',
                                                        background: 'var(--card-bg-secondary)',
                                                        padding: '16px',
                                                        borderRadius: '12px',
                                                        border: '1px dashed var(--primary)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        marginBottom: '12px'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Truck size={24} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>ŞASİ BAĞLANTISI</div>
                                                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>
                                                                    {dorse.sasi ? (
                                                                        <span>#{dorse.sasi.imalatNo} - {dorse.sasi.musteri} ({dorse.sasi.sasiNo})</span>
                                                                    ) : (
                                                                        <span style={{ color: 'var(--muted)' }}>Şasi bağlı değil</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn btn-primary"
                                                            onClick={(e) => { e.stopPropagation(); openLinkModal(dorse); }}
                                                            style={{ fontSize: '13px', padding: '8px 16px' }}
                                                        >
                                                            {dorse.sasi ? <><LinkIcon size={14} /> Şasiyi Değiştir</> : <><LinkIcon size={14} /> Şasi Bağla</>}
                                                        </button>
                                                    </div>

                                                    {/* Çekici Durumu */}
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ÇEKİCİ DURUMU</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                {dorse.cekiciGeldiMi ? 'Çekici Fabrikada' : 'Çekici Gelmedi'}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`step-toggle ${dorse.cekiciGeldiMi ? 'active' : ''}`}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                const updated = await updateDorse(dorse.id, { cekiciGeldiMi: !dorse.cekiciGeldiMi });
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
                                                        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                            <Calendar size={20} />
                                                        </div>
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
                                                                    // Handle non-boolean steps (Dropdowns)
                                                                    if (step.key === 'akmTseMuayenesi' || step.key === 'dmoMuayenesi') {
                                                                        const currentValue = dorse[step.key as keyof Dorse] as string;
                                                                        const options = step.key === 'akmTseMuayenesi' ? dropdowns?.kurumMuayenesi : dropdowns?.dmoMuayenesi;

                                                                        return (
                                                                            <div key={step.key} className="step-item">
                                                                                <span className="step-item-label">{step.label}</span>
                                                                                <select
                                                                                    className="select"
                                                                                    style={{ width: '130px', padding: '4px 8px', fontSize: '12px' }}
                                                                                    value={currentValue || ''}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    onChange={async (e) => {
                                                                                        const updated = await updateDorse(dorse.id, { [step.key]: e.target.value });
                                                                                        setDorses(prev => prev.map(d => d.id === dorse.id ? updated : d));
                                                                                    }}
                                                                                >
                                                                                    <option value="">Seçiniz</option>
                                                                                    {options?.map(v => (
                                                                                        <option key={v} value={v}>{v}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Handle boolean steps (Toggles)
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
                                                        <Trash2 size={16} /> Dorseyi Sil
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
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Lightbulb size={18} /> {formData.adet} ayrı damper oluşturulacak: {formData.musteri || 'Firma'} 1, {formData.musteri || 'Firma'} 2, ... {formData.musteri || 'Firma'} {formData.adet}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : productType === 'DORSE' ? (
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
                                                <label className="form-label">Şasi Bağla <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(Opsiyonel)</span></label>
                                                <select
                                                    className="select"
                                                    value={dorseFormData.sasiId}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, sasiId: e.target.value }))}
                                                    disabled={parseInt(dorseFormData.adet) > 1}
                                                    style={parseInt(dorseFormData.adet) > 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                >
                                                    <option value="">Şasi Seçiniz...</option>
                                                    {availableSasis.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            #{s.imalatNo} - {s.musteri} ({s.sasiNo})
                                                        </option>
                                                    ))}
                                                </select>
                                                {parseInt(dorseFormData.adet) > 1 && (
                                                    <div style={{ fontSize: '10px', color: 'var(--warning)', marginTop: '4px' }}>
                                                        ⚠️ Çoklu eklemede şasi otomatik bağlanamaz.
                                                    </div>
                                                )}
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
                                                <label className="form-label">Çekici Geldi Mi *</label>
                                                <select
                                                    className="select"
                                                    value={dorseFormData.cekiciGeldiMi ? 'EVET' : 'HAYIR'}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, cekiciGeldiMi: e.target.value === 'EVET' }))}
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
                                                <label className="form-label">Kalınlık</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: 4mm..."
                                                    value={dorseFormData.kalinlik}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, kalinlik: e.target.value }))}
                                                />
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

                                    ) : (
                                        // SASI FORM fields
                                        <div className="form-grid">
                                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                <label className="form-label">Kayıt Tipi *</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        type="button"
                                                        className={`btn ${sasiFormData.isStok ? 'btn-primary' : 'btn-secondary'}`}
                                                        style={{ flex: 1 }}
                                                        onClick={() => setSasiFormData(prev => ({ ...prev, isStok: true }))}
                                                    >
                                                        <Package size={16} /> Stok Kaydı
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn ${!sasiFormData.isStok ? 'btn-primary' : 'btn-secondary'}`}
                                                        style={{ flex: 1 }}
                                                        onClick={() => setSasiFormData(prev => ({ ...prev, isStok: false }))}
                                                    >
                                                        <User size={16} /> Müşteri Kaydı
                                                    </button>
                                                </div>
                                            </div>

                                            {!sasiFormData.isStok && (
                                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                                    <label className="form-label">Müşteri Adı *</label>
                                                    <input
                                                        type="text"
                                                        className="input"
                                                        required
                                                        placeholder="Müşteri adını giriniz..."
                                                        value={sasiFormData.musteri}
                                                        onChange={(e) => setSasiFormData(prev => ({ ...prev, musteri: e.target.value }))}
                                                    />
                                                </div>
                                            )}

                                            <div className="form-group">
                                                <label className="form-label">Dingil</label>
                                                <select
                                                    className="select"
                                                    value={sasiFormData.dingil}
                                                    onChange={(e) => setSasiFormData(prev => ({ ...prev, dingil: e.target.value }))}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    <option value="TRAX">TRAX</option>
                                                    <option value="BPW">BPW</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Tampon</label>
                                                <select
                                                    className="select"
                                                    value={sasiFormData.tampon}
                                                    onChange={(e) => setSasiFormData(prev => ({ ...prev, tampon: e.target.value }))}
                                                >
                                                    <option value="">Seçiniz</option>
                                                    <option value="Kırma Tampon">KIRMA</option>
                                                    <option value="Sabit Tampon">SABİT</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Adet *</label>
                                                <input
                                                    type="number"
                                                    className="input"
                                                    required
                                                    min="1"
                                                    value={sasiFormData.adet}
                                                    onChange={(e) => setSasiFormData(prev => ({ ...prev, adet: e.target.value }))}
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
                                        {productType === 'DAMPER' ? 'Damper Ekle' : productType === 'DORSE' ? 'Dorse Ekle' : 'Şasi Ekle'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div >
                )}

                {/* Şasi Bağlama Modalı */}
                {showLinkModal && activeDorseForLink && (
                    <div className="modal-overlay" onClick={() => setShowLinkModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
                        <div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                maxWidth: '600px',
                                width: '90%',
                                maxHeight: '85vh',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRadius: '16px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                background: 'var(--card-bg)'
                            }}
                        >
                            <div className="modal-header" style={{
                                background: 'linear-gradient(to right, #022347, #0f172a)',
                                padding: '20px 24px',
                                borderBottom: '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff'
                                    }}>
                                        <LinkIcon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="modal-title" style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Şasi Bağlantısı</h3>
                                        <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', margin: '4px 0 0 0' }}>{activeDorseForLink.musteri} için şasi seçin</p>
                                    </div>
                                </div>
                                <button
                                    className="modal-close"
                                    onClick={() => setShowLinkModal(false)}
                                    style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '24px', fontWeight: 300, background: 'none', border: 'none', cursor: 'pointer' }}
                                >✕</button>
                            </div>

                            <div style={{ padding: '20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ position: 'relative', marginBottom: '16px' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                                        <Search size={18} />
                                    </span>
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Şasi ara (Müşteri adı veya Stok no...)"
                                        style={{ paddingLeft: '40px', height: '42px', borderRadius: '10px' }}
                                        value={linkSearchTerm}
                                        onChange={(e) => setLinkSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="stats-tabs" style={{ marginBottom: '0', background: 'var(--card-bg)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                    <button
                                        className={`tab-btn ${linkFilter === 'hepsi' ? 'active' : ''}`}
                                        onClick={() => setLinkFilter('hepsi')}
                                        style={{ flex: 1, borderRadius: '8px', fontSize: '13px' }}
                                    >Hepsi</button>
                                    <button
                                        className={`tab-btn ${linkFilter === 'stok' ? 'active' : ''}`}
                                        onClick={() => setLinkFilter('stok')}
                                        style={{ flex: 1, borderRadius: '8px', fontSize: '13px' }}
                                    >Stok</button>
                                    <button
                                        className={`tab-btn ${linkFilter === 'musteri' ? 'active' : ''}`}
                                        onClick={() => setLinkFilter('musteri')}
                                        style={{ flex: 1, borderRadius: '8px', fontSize: '13px' }}
                                    >Müşteri</button>
                                </div>
                            </div>

                            <div className="modal-body" style={{ overflowY: 'auto', padding: '0', flex: 1, background: 'var(--card-bg)' }}>
                                {availableSasis.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                                            <Package size={48} strokeWidth={1} style={{ opacity: 0.5 }} />
                                        </div>
                                        <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Bağlanabilir boş şasi bulunamadı.</p>
                                        <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }} onClick={() => { setShowLinkModal(false); setShowAddModal(true); setProductType('SASI'); }}>
                                            <Plus size={16} style={{ marginRight: '6px' }} /> Yeni Şasi Oluştur
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {[...availableSasis]
                                            .filter(s => {
                                                // First apply tab filter
                                                if (linkFilter === 'stok' && !s.musteri.toLowerCase().includes('stok')) return false;
                                                if (linkFilter === 'musteri' && s.musteri.toLowerCase().includes('stok')) return false;

                                                // Then apply search filter
                                                if (linkSearchTerm.trim()) {
                                                    const search = linkSearchTerm.toLowerCase().trim();
                                                    const matchesMusteri = s.musteri.toLowerCase().includes(search);
                                                    const matchesSasiNo = (s.sasiNo || '').toLowerCase().includes(search);
                                                    const matchesImalatNo = String(s.imalatNo || '').includes(search);
                                                    return matchesMusteri || matchesSasiNo || matchesImalatNo;
                                                }
                                                return true;
                                            })
                                            .sort((a, b) => {
                                                const aMatches = a.musteri.toLowerCase().includes(activeDorseForLink.musteri.toLowerCase());
                                                const bMatches = b.musteri.toLowerCase().includes(activeDorseForLink.musteri.toLowerCase());
                                                if (aMatches && !bMatches) return -1;
                                                if (!aMatches && bMatches) return 1;
                                                return 0;
                                            }).map(sasi => {
                                                const isMatch = sasi.musteri.toLowerCase().includes(activeDorseForLink.musteri.toLowerCase()) && !sasi.musteri.toLowerCase().includes('stok');
                                                const progress = calculateSasiProgress(sasi);
                                                return (
                                                    <div
                                                        key={sasi.id}
                                                        onClick={() => handleLinkSasi(activeDorseForLink.id, sasi.id)}
                                                        style={{
                                                            padding: '16px 20px',
                                                            borderBottom: '1px solid var(--border)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            background: isMatch ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                                                            borderLeft: isMatch ? '4px solid var(--primary)' : '4px solid transparent'
                                                        }}
                                                        className="sasi-list-item"
                                                    >
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--foreground)' }}>#{sasi.imalatNo || '0'} - {sasi.musteri}</span>
                                                                {isMatch && <span style={{ fontSize: '10px', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>UYGUN</span>}
                                                                {progress === 100 && <span style={{ fontSize: '10px', background: 'var(--success)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={10} /> HAZIR</span>}
                                                            </div>
                                                            <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <span>{sasi.sasiNo || 'No yok'} | {sasi.dingil} | {sasi.tampon}</span>
                                                                <div style={{ width: '1px', height: '12px', background: 'var(--border)' }}></div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <div className="progress-bar" style={{ width: '60px', height: '6px', borderRadius: '3px', background: 'var(--bg-secondary)' }}>
                                                                        <div className="progress-bar-fill" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: '3px' }}></div>
                                                                    </div>
                                                                    <span style={{ fontSize: '12px', fontWeight: 500, color: progress === 100 ? 'var(--success)' : 'var(--primary)' }}>%{progress}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ color: 'var(--muted)', marginLeft: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                                            <LinkIcon size={16} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer" style={{ padding: '16px 24px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
                                <button className="btn btn-secondary" onClick={() => setShowLinkModal(false)} style={{ width: '100%', justifyContent: 'center' }}>İptal</button>
                            </div>
                        </div>
                    </div>
                )}
            </main >
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
