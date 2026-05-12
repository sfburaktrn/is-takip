'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { ProductLocalNote } from '@/components/ProductLocalNote';
import {
  getStats,
  getDampers,
  getDorses,
  getSasis,
  getDropdowns,
  createDamper,
  createDorse,
  createSasi,
  updateDamper,
  updateDorse,
  updateSasi,
  deleteDamper,
  deleteDorse,
  deleteSasi,
  getStaleProducts,
  type Stats,
  type Damper,
  type Dorse,
  type Sasi,
  type Dropdowns,
  STEP_GROUPS,
  DORSE_STEP_GROUPS,
  SASI_STEP_GROUPS
} from '@/lib/api';
import { useAppleSegmentedThumb } from '@/hooks/useAppleSegmentedThumb';
import Link from 'next/link';
import { trIncludes, trStartsWithStok } from '@/lib/trSearch';
import { trUpper } from '@/lib/trUpper';
import { useDebouncedPersist, applyServerRowIfFieldMatches } from '@/lib/useDebouncedPersist';
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
  Type,
  Hash,
  X, // Added
  Info // Added
} from 'lucide-react';

type ProductType = 'DAMPER' | 'DORSE' | 'SASI' | 'DORSE_SASI';

const DASH_SEG_ORDER: ProductType[] = ['DAMPER', 'DORSE', 'SASI', 'DORSE_SASI'];

type DashboardSortBy =
  | 'progress-asc'
  | 'progress-desc'
  | 'name-asc'
  | 'name-desc'
  | 'date-asc'
  | 'date-desc'
  | 'imalat-desc'
  | 'imalat-asc'
  | 'sasiNo-desc'
  | 'sasiNo-asc'
  | null;

function parseImalatNo(n: unknown): number | null {
  if (n == null) return null;
  if (typeof n === 'string') {
    const t = n.trim();
    if (t === '') return null;
    const num = Number(t);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }
  if (typeof n === 'number') {
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }
  return null;
}

function hasDamperDorseImalatNo(n: unknown): boolean {
  return parseImalatNo(n) != null;
}

function compareImalatNoDesc(a: unknown, b: unknown): number {
  const na = parseImalatNo(a);
  const nb = parseImalatNo(b);
  const ah = na != null;
  const bh = nb != null;
  if (ah && bh) return nb - na;
  if (ah) return -1;
  if (bh) return 1;
  return 0;
}

function compareImalatNoAsc(a: unknown, b: unknown): number {
  const na = parseImalatNo(a);
  const nb = parseImalatNo(b);
  const ah = na != null;
  const bh = nb != null;
  if (ah && bh) return na - nb;
  if (ah) return -1;
  if (bh) return 1;
  return 0;
}

function normalizeSasiNoValue(s: unknown): string {
  if (s == null) return '';
  let t = String(s).replace(/\u00a0/g, ' ').trim();
  if (t === '') return '';
  t = t.replace(/\s+/g, ' ');
  if (
    t === '-' ||
    t === 'ÔÇö' ||
    t === 'ÔÇô' ||
    /^[\s\-ÔÇôÔÇö]+$/u.test(t)
  ) {
    return '';
  }
  const u = t.toUpperCase();
  if (u === 'YOK' || u === 'N/A') return '';
  const low = t.toLowerCase();
  if (low === 'n/a' || low === 'null' || low === 'undefined') return '';
  return t;
}

function hasSasiNoWritten(s: unknown): boolean {
  return normalizeSasiNoValue(s) !== '';
}

function formatSasiNoLabel(s: unknown): string {
  const n = normalizeSasiNoValue(s);
  return n !== '' ? n : '-';
}

function compareSasiNoDesc(a: unknown, b: unknown): number {
  const as = normalizeSasiNoValue(a);
  const bs = normalizeSasiNoValue(b);
  if (as && bs) return bs.localeCompare(as, 'tr', { numeric: true });
  if (as) return -1;
  if (bs) return 1;
  return 0;
}

function compareSasiNoAsc(a: unknown, b: unknown): number {
  const as = normalizeSasiNoValue(a);
  const bs = normalizeSasiNoValue(b);
  if (as && bs) return as.localeCompare(bs, 'tr', { numeric: true });
  if (as) return -1;
  if (bs) return 1;
  return 0;
}

function compareSasiRowsBySasiNoDesc(
  a: { sasiNo?: unknown; imalatNo?: unknown; id?: number },
  b: { sasiNo?: unknown; imalatNo?: unknown; id?: number }
): number {
  const c = compareSasiNoDesc(a.sasiNo, b.sasiNo);
  if (c !== 0) return c;
  const ci = compareImalatNoDesc(a.imalatNo, b.imalatNo);
  if (ci !== 0) return ci;
  return (a.id ?? 0) - (b.id ?? 0);
}

function compareSasiRowsBySasiNoAsc(
  a: { sasiNo?: unknown; imalatNo?: unknown; id?: number },
  b: { sasiNo?: unknown; imalatNo?: unknown; id?: number }
): number {
  const c = compareSasiNoAsc(a.sasiNo, b.sasiNo);
  if (c !== 0) return c;
  const ci = compareImalatNoAsc(a.imalatNo, b.imalatNo);
  if (ci !== 0) return ci;
  return (a.id ?? 0) - (b.id ?? 0);
}

function DashboardContent() {
  const [productType, setProductType] = useState<ProductType>('DAMPER');
  const dashSegTrackRef = useRef<HTMLDivElement>(null);
  const dashSegActiveIndex = DASH_SEG_ORDER.indexOf(productType);
  const dashSegThumb = useAppleSegmentedThumb(
    dashSegTrackRef,
    dashSegActiveIndex >= 0 ? dashSegActiveIndex : 0
  );
  const [stats, setStats] = useState<Stats | null>(null);
  const [dampers, setDampers] = useState<Damper[]>([]);
  const [dorses, setDorses] = useState<Dorse[]>([]);
  const [sasis, setSasis] = useState<Sasi[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sasiFilter, setSasiFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<DashboardSortBy>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<{
    kind: 'DAMPER' | 'DORSE';
    id: number;
    teslimSasiNo: string;
    teslimEden: string;
    teslimAlan: string;
    teslimNot: string;
  } | null>(null);

  const COLORS = {
    primary: 'var(--primary)',
    secondary: 'var(--foreground-secondary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    info: 'var(--control-fill)',
    grid: 'var(--border)',
  };

  // Sasi Link Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [activeDorseForLink, setActiveDorseForLink] = useState<Dorse | null>(null);
  const [linkFilter, setLinkFilter] = useState<'hepsi' | 'stok' | 'musteri'>('hepsi');
  const [linkSearchTerm, setLinkSearchTerm] = useState('');
  const [availableSasis, setAvailableSasis] = useState<Sasi[]>([]);
  const [, setLinkLoading] = useState(false);
  const [staleHint, setStaleHint] = useState<{ total: number; days: number } | null>(null);
  const { schedule: persistLater, flush: persistNow } = useDebouncedPersist();

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
    branda: false,
    renk: '',
  });

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
    silindir: '',
    malzemeCinsi: '',
    frenMarka: '',
    branda: false,
    renk: '',
  });

  // Sasi Form State
  const [sasiFormData, setSasiFormData] = useState({
    imalatNo: '',
    musteri: '',
    adet: '1',
    sasiNo: '',
    tampon: '',
    dingil: '',
    isStok: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    getStaleProducts(14)
      .then(d => {
        const total = d.dampers.length + d.dorses.length + d.sasis.length;
        setStaleHint(total > 0 ? { total, days: d.days } : null);
      })
      .catch(() => setStaleHint(null));
  }, []);

  useEffect(() => {
    if (showAddModal && productType === 'DORSE') {
      getSasis(true).then(setAvailableSasis).catch(console.error);
    }
  }, [showAddModal, productType]);

  async function loadData() {
    try {
      const [, damperStats, , sasiStats, dampersData, dorsesData, sasisData, dropdownsData] = await Promise.all([
        getStats('DAMPER'),
        getStats('DAMPER'),
        getStats('DORSE'),
        getStats('SASI'),
        getDampers(),
        getDorses(),
        getSasis(),
        getDropdowns()
      ]);
      setStats(sasiStats); // Default to current or just store all
      // Actually, let's just use the active productType's stats in currentStats useMemo
      setStats(damperStats); // Initial
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

  // Need to force refresh stats when product type changes or use memo properly
  useEffect(() => {
    async function updateStats() {
      // DORSE_SASI view doesn't need its own stats from backend
      if (productType === 'DORSE_SASI') return;
      const statsType = productType as 'DAMPER' | 'DORSE' | 'SASI';
      const s = await getStats(statsType);
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
      case 'DEVAM ED─░YOR':
        return <span className="badge badge-warning">{status}</span>;
      case 'BA┼ŞLAMADI':
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
      damper.elektrik, damper.hava, damper.tamamlama, damper.sonKontrol
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
      dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat
    ];
    const completed = steps.filter(Boolean).length;
    // akmTseMuayenesi and dmoMuayenesi are excluded from progress calculation
    // They don't block completion status
    return Math.round((completed / steps.length) * 100);
  };

  const getDamperStatus = (damper: Damper): string => {
    if (damper.teslimat) return 'teslimEdilen';
    // All step fields to check
    const allSteps = [
      damper.plazmaProgrami, damper.sacMalzemeKontrolu, damper.plazmaKesim,
      damper.damperSasiPlazmaKesim, damper.presBukum, damper.aracBraket,
      damper.damperSasi, damper.sasiYukleme, damper.milAltKutuk, damper.taban,
      damper.yan, damper.onGogus, damper.arkaKapak, damper.yuklemeMalzemesi,
      damper.damperKurulmasi, damper.damperKaynak, damper.sasiKapakSiperlik,
      damper.yukleme, damper.hidrolik, damper.boyaHazirlik, damper.boya,
      damper.elektrik, damper.hava, damper.tamamlama, damper.sonKontrol
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
    if (dorse.teslimat) return 'teslimEdilen';
    const allSteps = [
      dorse.plazmaProgrami, dorse.sacMalzemeKontrolu, dorse.plazmaKesim,
      dorse.presBukum, dorse.dorseSasi,
      dorse.milAltKutuk, dorse.taban, dorse.yan, dorse.onGogus, dorse.arkaKapak, dorse.yuklemeMalzemesi,
      dorse.dorseKurulmasi, dorse.dorseKaynak, dorse.kapakSiperlik, dorse.yukleme, dorse.hidrolik,
      dorse.boyaHazirlik, dorse.dorseSasiBoyama,
      dorse.cekiciElektrik, dorse.cekiciHidrolik,
      dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.aracKontrolBypassAyari,
      dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat
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
    // Collect all sub-steps from SASI_STEP_GROUPS
    const allSteps: boolean[] = [];
    SASI_STEP_GROUPS.forEach(group => {
      group.subSteps.forEach(step => {
        allSteps.push(Boolean(sasi[step.key as keyof Sasi]));
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
        allSteps.push(Boolean(sasi[step.key as keyof Sasi]));
      });
    });

    const completedSteps = allSteps.filter(Boolean).length;
    const totalSteps = allSteps.length;

    if (completedSteps === totalSteps) return 'tamamlanan';
    if (completedSteps === 0) return 'baslamayan';
    return 'devamEden';
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
      alert('┼Şasi ba─şlan─▒rken hata olu┼ştu');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlinkSasi = async (dorseId: number) => {
    if (!confirm('┼Şasi ba─şlant─▒s─▒n─▒ kald─▒rmak istedi─şinize emin misiniz?')) return;

    try {
      setLinkLoading(true);
      const { unlinkSasi } = await import('@/lib/api');
      const updatedDorse = await unlinkSasi(dorseId);
      setDorses(prev => prev.map(d => d.id === dorseId ? updatedDorse : d));
      loadData(); // Refresh stats and list
    } catch (error) {
      console.error('Error unlinking sasi:', error);
      alert('┼Şasi ba─şlant─▒s─▒ kald─▒r─▒l─▒rken hata olu┼ştu');
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

  const handleStepToggle = (id: number, stepKey: string, currentValue: boolean, type: ProductType) => {
    const next = !currentValue;
    if (type === 'DAMPER') {
      if (stepKey === 'teslimat' && next === true) {
        setExpandedId(id);
        setDeliveryDraft({ kind: 'DAMPER', id, teslimSasiNo: '', teslimEden: '', teslimAlan: '', teslimNot: '' });
        return;
      }
      setDampers(prev =>
        prev.map(d => (d.id === id ? ({ ...d, [stepKey]: next } as Damper) : d))
      );
      void (async () => {
        try {
          const updated = await updateDamper(id, { [stepKey]: next });
          setDampers(prev =>
            applyServerRowIfFieldMatches(prev, id, stepKey as keyof Damper, next, updated)
          );
        } catch (error) {
          console.error('Error updating step:', error);
          setDampers(prev =>
            prev.map(d => (d.id === id ? ({ ...d, [stepKey]: currentValue } as Damper) : d))
          );
        }
      })();
    } else if (type === 'DORSE') {
      if (stepKey === 'teslimat' && next === true) {
        setExpandedId(id);
        setDeliveryDraft({ kind: 'DORSE', id, teslimSasiNo: '', teslimEden: '', teslimAlan: '', teslimNot: '' });
        return;
      }
      setDorses(prev =>
        prev.map(d => (d.id === id ? ({ ...d, [stepKey]: next } as Dorse) : d))
      );
      void (async () => {
        try {
          const updated = await updateDorse(id, { [stepKey]: next });
          setDorses(prev =>
            applyServerRowIfFieldMatches(prev, id, stepKey as keyof Dorse, next, updated)
          );
        } catch (error) {
          console.error('Error updating step:', error);
          setDorses(prev =>
            prev.map(d => (d.id === id ? ({ ...d, [stepKey]: currentValue } as Dorse) : d))
          );
        }
      })();
    } else if (type === 'SASI') {
      setSasis(prev =>
        prev.map(s => (s.id === id ? ({ ...s, [stepKey]: next } as Sasi) : s))
      );
      void (async () => {
        try {
          const updated = await updateSasi(id, { [stepKey]: next });
          setSasis(prev =>
            applyServerRowIfFieldMatches(prev, id, stepKey as keyof Sasi, next, updated)
          );
        } catch (error) {
          console.error('Error updating step:', error);
          setSasis(prev =>
            prev.map(s => (s.id === id ? ({ ...s, [stepKey]: currentValue } as Sasi) : s))
          );
        }
      })();
    }
  };

  const confirmDelivery = async () => {
    if (!deliveryDraft) return;
    const temizNo = deliveryDraft.teslimSasiNo.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '');
    if (!temizNo) return alert('┼Şase no zorunludur. Yaln─▒z AÔÇôZ ve 0ÔÇô9 kullan─▒labilir.');
    if (!deliveryDraft.teslimEden.trim()) return alert('Teslim eden zorunludur.');
    if (!deliveryDraft.teslimAlan.trim()) return alert('Teslim alan zorunludur.');
    try {
      if (deliveryDraft.kind === 'DAMPER') {
        const updated = await updateDamper(deliveryDraft.id, {
          teslimat: true,
          teslimSasiNo: temizNo,
          teslimEden: deliveryDraft.teslimEden.trim(),
          teslimAlan: deliveryDraft.teslimAlan.trim(),
          teslimNot: deliveryDraft.teslimNot.trim() || null
        });
        setDampers(prev => prev.map(d => (d.id === deliveryDraft.id ? updated : d)));
      } else {
        const updated = await updateDorse(deliveryDraft.id, {
          teslimat: true,
          teslimSasiNo: temizNo,
          teslimEden: deliveryDraft.teslimEden.trim(),
          teslimAlan: deliveryDraft.teslimAlan.trim(),
          teslimNot: deliveryDraft.teslimNot.trim() || null
        });
        setDorses(prev => prev.map(d => (d.id === deliveryDraft.id ? updated : d)));
      }
      setDeliveryDraft(null);
      loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Teslim kaydedilemedi');
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
          m3: formData.m3 || null,
          renk: formData.renk || null,
          adet: quantity,
          branda: formData.branda,
          brandaMontaji: false,
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
          renk: '',
        });
        loadData();
        if (quantity > 1) {
          alert(`${quantity} adet damper ba┼şar─▒yla olu┼şturuldu!\n(${formData.musteri} 1 - ${formData.musteri} ${quantity})`);
        }
      } catch (error) {
        console.error('Error creating damper:', error);
        alert('Damper olu┼şturulurken hata olu┼ştu');
      }
    } else if (productType === 'DORSE') {
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
          m3: dorseFormData.m3 || null,
          renk: dorseFormData.renk || null,
          adet: quantity,
          sasiId: dorseFormData.sasiId ? parseInt(dorseFormData.sasiId) : null,
          silindir: dorseFormData.silindir || null,
          malzemeCinsi: dorseFormData.malzemeCinsi || null,
          frenMarka: dorseFormData.frenMarka || null,
          branda: dorseFormData.branda,
          brandaMontaji: false,
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
          silindir: '',
          malzemeCinsi: '',
          frenMarka: '',
          branda: false,
          renk: '',
        });
        loadData();
        if (quantity > 1) {
          alert(`${quantity} adet dorse ba┼şar─▒yla olu┼şturuldu!`);
        }
      } catch (error) {
        console.error('Error creating dorse:', error);
        alert('Dorse olu┼şturulurken hata olu┼ştu');
      }
    } else if (productType === 'SASI') {
      // Sasi Creation
      const quantity = parseInt(sasiFormData.adet) || 1;
      try {
        await createSasi({
          imalatNo: sasiFormData.imalatNo ? parseInt(sasiFormData.imalatNo) : null,
          musteri: sasiFormData.isStok ? 'Stok' : sasiFormData.musteri,
          adet: quantity,
          sasiNo: sasiFormData.sasiNo || null,
          tampon: sasiFormData.tampon || null,
          dingil: sasiFormData.dingil || null,
        });
        setShowAddModal(false);
        setSasiFormData({
          imalatNo: '',
          musteri: '',
          adet: '1',
          sasiNo: '',
          tampon: '',
          dingil: '',
          isStok: true,
        });
        loadData();
        if (quantity > 1) {
          alert(`${quantity} adet ┼şasi ba┼şar─▒yla olu┼şturuldu!`);
        }
      } catch (error) {
        console.error('Error creating sasi:', error);
        alert('┼Şasi olu┼şturulurken hata olu┼ştu');
      }
    }
  };

  // Old handleAddDamper replaced effectively by handleCreate
  // but keeping signature or removing. I'll replace the block.

  // Filter and sort dampers
  const sortedDampers = useMemo(() => {
    let result = [...dampers];

    if (searchTerm) {
      const t = searchTerm.trim();
      result = result.filter(
        d =>
          trIncludes(d.musteri, t) ||
          trIncludes(d.aracMarka, t) ||
          trIncludes(d.model, t) ||
          (d.imalatNo ?? '').toString().includes(t)
      );
    }

    if (statusFilter) {
      if (statusFilter === 'eksikNumara') {
        result = result.filter(d => !hasDamperDorseImalatNo(d.imalatNo));
      } else {
        result = result.filter(d => getDamperStatus(d) === statusFilter);
      }
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
          case 'imalat-desc':
            return compareImalatNoDesc(a.imalatNo, b.imalatNo);
          case 'imalat-asc':
            return compareImalatNoAsc(a.imalatNo, b.imalatNo);
          default:
            return 0;
        }
      });
    }

    return statusFilter || sortBy || searchTerm ? result : result.slice(0, 5);
  }, [dampers, statusFilter, sortBy, searchTerm]);

  // Filter and sort dorses
  const sortedDorses = useMemo(() => {
    let result = [...dorses];

    if (searchTerm) {
      const t = searchTerm.trim();
      result = result.filter(
        d => trIncludes(d.musteri, t) || (d.imalatNo ?? '').toString().includes(t)
      );
    }

    if (statusFilter) {
      if (statusFilter === 'eksikNumara') {
        result = result.filter(d => !hasDamperDorseImalatNo(d.imalatNo));
      } else {
        result = result.filter(d => getDorseStatus(d) === statusFilter);
      }
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
          case 'imalat-desc':
            return compareImalatNoDesc(a.imalatNo, b.imalatNo);
          case 'imalat-asc':
            return compareImalatNoAsc(a.imalatNo, b.imalatNo);
          default:
            return 0;
        }
      });
    }

    return statusFilter || sortBy || searchTerm ? result : result.slice(0, 50);
  }, [dorses, statusFilter, sortBy, searchTerm]);

  // Filter and sort sasis
  const sortedSasis = useMemo(() => {
    let result = [...sasis];

    if (searchTerm) {
      const t = searchTerm.trim();
      result = result.filter(
        s =>
          trIncludes(s.musteri, t) ||
          trIncludes(s.sasiNo, t) ||
          (s.imalatNo ?? '').toString().includes(t)
      );
    }

    if (statusFilter) {
      if (statusFilter === 'eksikNumara') {
        result = result.filter(s => !hasSasiNoWritten(s.sasiNo));
      } else if (statusFilter === 'tamamlanan') {
        result = result.filter(s => getSasiStatus(s) === 'tamamlanan');
      } else if (statusFilter === 'devamEden') {
        result = result.filter(s => getSasiStatus(s) === 'devamEden');
      } else if (statusFilter === 'baslamayan') {
        result = result.filter(s => getSasiStatus(s) === 'baslamayan');
      } else if (statusFilter === 'bosStok') {
        result = result.filter(s => trStartsWithStok(s.musteri) && !s.dorse);
      } else if (statusFilter === 'tamamlananStok') {
        result = result.filter(s => trStartsWithStok(s.musteri) && getSasiStatus(s) === 'tamamlanan');
      } else if (statusFilter === 'devamEdenStok') {
        result = result.filter(s => trStartsWithStok(s.musteri) && getSasiStatus(s) === 'devamEden');
      } else if (statusFilter === 'bosMusteri') {
        result = result.filter(s => !trStartsWithStok(s.musteri) && !s.dorse);
      } else if (statusFilter === 'tamamlananMusteri') {
        result = result.filter(s => !trStartsWithStok(s.musteri) && getSasiStatus(s) === 'tamamlanan');
      } else if (statusFilter === 'devamEdenMusteri') {
        result = result.filter(s => !trStartsWithStok(s.musteri) && getSasiStatus(s) === 'devamEden');
      }
    }

    if (sasiFilter) {
      result = result.filter(s => {
        if (sasiFilter === 'K─▒rma-BPW') return s.tampon === 'K─▒rma Tampon' && s.dingil === 'BPW';
        if (sasiFilter === 'K─▒rma-TRAX') return s.tampon === 'K─▒rma Tampon' && s.dingil === 'TRAX';
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
          case 'imalat-desc': {
            const c = compareImalatNoDesc(a.imalatNo, b.imalatNo);
            return c !== 0 ? c : (a.id ?? 0) - (b.id ?? 0);
          }
          case 'imalat-asc': {
            const c = compareImalatNoAsc(a.imalatNo, b.imalatNo);
            return c !== 0 ? c : (a.id ?? 0) - (b.id ?? 0);
          }
          case 'sasiNo-desc':
            return compareSasiRowsBySasiNoDesc(a, b);
          case 'sasiNo-asc':
            return compareSasiRowsBySasiNoAsc(a, b);
          default:
            return 0;
        }
      });
    }

    return result;
  }, [sasis, statusFilter, sortBy, sasiFilter, searchTerm]);

  const eksikNumaraCount = useMemo(() => {
    if (productType === 'DAMPER') return dampers.filter(d => !hasDamperDorseImalatNo(d.imalatNo)).length;
    if (productType === 'DORSE') return dorses.filter(d => !hasDamperDorseImalatNo(d.imalatNo)).length;
    if (productType === 'SASI') return sasis.filter(s => !hasSasiNoWritten(s.sasiNo)).length;
    return 0;
  }, [productType, dampers, dorses, sasis]);

  useEffect(() => {
    setSortBy(prev => {
      if ((productType === 'DAMPER' || productType === 'DORSE') && (prev === 'sasiNo-desc' || prev === 'sasiNo-asc'))
        return null;
      return prev;
    });
  }, [productType]);

  useEffect(() => {
    if (productType === 'DORSE_SASI') {
      setStatusFilter(prev => (prev === 'eksikNumara' ? null : prev));
    }
  }, [productType]);

  const currentStats = useMemo(() => {
    if (productType === 'DAMPER') return stats;

    if (productType === 'DORSE') {
      return {
        total: dorses.length,
        tamamlanan: dorses.filter(d => getDorseStatus(d) === 'tamamlanan').length,
        teslimEdilen: dorses.filter(d => d.teslimat).length,
        devamEden: dorses.filter(d => getDorseStatus(d) === 'devamEden').length,
        baslamayan: dorses.filter(d => getDorseStatus(d) === 'baslamayan').length
      };
    }

    if (productType === 'SASI') {
      return {
        total: sasis.length,
        tamamlanan: sasis.filter(s => getSasiStatus(s) === 'tamamlanan').length,
        devamEden: sasis.filter(s => getSasiStatus(s) === 'devamEden').length,
        baslamayan: sasis.filter(s => getSasiStatus(s) === 'baslamayan').length
      };
    }

    return null;
  }, [productType, stats, dorses, sasis]);

  // Get linked Dorse-Sasi pairs for DORSE_SASI view
  const linkedDorseSasis = useMemo(() => {
    return dorses
      .filter(d => d.sasi)
      .map(d => ({
        dorse: d,
        sasi: d.sasi!,
        dorseProgress: calculateDorseProgress(d),
        sasiProgress: calculateSasiProgress(d.sasi!)
      }))
      .sort((a, b) => b.dorseProgress - a.dorseProgress);
  }, [dorses]);

  const filteredLinkedDorseSasis = useMemo(() => {
    if (!searchTerm.trim()) return linkedDorseSasis;
    const term = searchTerm.trim();
    return linkedDorseSasis.filter(({ dorse, sasi }) =>
      trIncludes(dorse.musteri, term) ||
      String(dorse.imalatNo).includes(term) ||
      trIncludes(sasi.musteri, term) ||
      trIncludes(sasi.sasiNo, term) ||
      String(sasi.imalatNo).includes(term)
    );
  }, [linkedDorseSasis, searchTerm]);

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="main-content">
          <OzunluLoading variant="inline" />
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="header header--stack">
          <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="header-title">Dashboard</h1>
              <p className="header-subtitle">{productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : '┼Şasi'} imalat s├╝re├ğlerine genel bak─▒┼ş</p>
            </div>
            <button className="btn btn-premium" onClick={() => setShowAddModal(true)}>
              <Plus size={20} /> Yeni {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : '┼Şasi'} Ekle
            </button>
          </div>

          {/* Product Toggle */}
          <div
            ref={dashSegTrackRef}
            className="apple-segmented apple-segmented--wrap apple-segmented--slide"
          >
            <span
              className="apple-segmented__thumb"
              aria-hidden
              style={{
                transform: `translate3d(${dashSegThumb.x}px, ${dashSegThumb.y}px, 0)`,
                width: Math.max(0, dashSegThumb.w),
                height: Math.max(0, dashSegThumb.h),
                opacity: dashSegThumb.w > 0 && dashSegThumb.h > 0 ? 1 : 0,
              }}
            />
            <button
              type="button"
              className={`apple-segmented-btn${productType === 'DAMPER' ? ' is-active-brand' : ''}`}
              onClick={() => setProductType('DAMPER')}
            >
              Damperler
            </button>
            <button
              type="button"
              className={`apple-segmented-btn${productType === 'DORSE' ? ' is-active-brand' : ''}`}
              onClick={() => setProductType('DORSE')}
            >
              Dorseler
            </button>
            <button
              type="button"
              className={`apple-segmented-btn${productType === 'SASI' ? ' is-active-brand' : ''}`}
              onClick={() => setProductType('SASI')}
            >
              ┼Şasiler
            </button>
            <button
              type="button"
              className={`apple-segmented-btn${productType === 'DORSE_SASI' ? ' is-active-brand' : ''}`}
              onClick={() => setProductType('DORSE_SASI')}
            >
              <LinkIcon size={16} className="page-title-leading-icon" /> Dorse+┼Şasi
            </button>
          </div>

          <div className="w-full sm:w-[300px] apple-search-box">
            <Search size={18} className="apple-search-icon" />
            <input
              type="text"
              placeholder={`${productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : productType === 'SASI' ? '┼Şasi' : 'Dorse veya ┼Şasi'} ara...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="apple-search-input-pill"
            />
          </div>
        </header>

        {productType !== 'DORSE_SASI' && (
          <div className="stats-grid" style={{
            display: productType === 'SASI' ? 'block' : 'grid',
            gridTemplateColumns: productType === 'SASI' ? undefined : undefined
          }}>
            {/* SASI VIEW CUSTOM LAYOUT */}
            {productType === 'SASI' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'stretch' }}>

                {/* 1. GENEL DURUM (Sol) - 2 Kart */}
                <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      cursor: 'pointer',
                      borderLeft: `4px solid ${COLORS.primary}`,
                      borderTop: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                      borderRight: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                      borderBottom: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px',
                      backgroundColor: 'var(--card)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setStatusFilter(null)}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Package size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.total || 0}</div>
                      <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Toplam ┼Şasi</div>
                    </div>
                  </div>
                  <div
                    style={{
                      cursor: 'pointer',
                      borderLeft: `4px solid ${COLORS.success}`,
                      borderTop: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                      borderRight: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                      borderBottom: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px',
                      backgroundColor: 'var(--card)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setStatusFilter(statusFilter === 'tamamlanan' ? null : 'tamamlanan')}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <CheckCircle size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.tamamlanan || 0}</div>
                      <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Tamamlanan</div>
                    </div>
                  </div>
                </div>

                {/* 2. GENEL DURUM (Sa─ş) - 2 Kart */}
                <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div
                    style={{
                      cursor: 'pointer',
                      borderLeft: `4px solid ${COLORS.warning}`,
                      borderTop: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                      borderRight: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                      borderBottom: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px',
                      backgroundColor: 'var(--card)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setStatusFilter(statusFilter === 'devamEden' ? null : 'devamEden')}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <RefreshCcw size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.devamEden || 0}</div>
                      <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Devam Eden</div>
                    </div>
                  </div>
                  <div
                    style={{
                      cursor: 'pointer',
                      borderLeft: `4px solid ${COLORS.danger}`,
                      borderTop: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid var(--border)',
                      borderRight: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid var(--border)',
                      borderBottom: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '16px',
                      backgroundColor: 'var(--card)',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      flex: 1, display: 'flex', alignItems: 'center', gap: '16px',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setStatusFilter(statusFilter === 'baslamayan' ? null : 'baslamayan')}
                  >
                    <div style={{
                      width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)', color: COLORS.danger,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <PauseCircle size={24} strokeWidth={2} />
                    </div>
                    <div>
                      <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.baslamayan || 0}</div>
                      <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Ba┼şlamayan</div>
                    </div>
                  </div>
                </div>

                {/* 3. STOK ┼ŞAS─░LER GRUBU - 3 Kart */}
                <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', height: '20px' }}>STOK ┼ŞAS─░LER</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div
                      style={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${COLORS.primary}`,
                        borderTop: statusFilter === 'bosStok' ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                        borderRight: statusFilter === 'bosStok' ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                        borderBottom: statusFilter === 'bosStok' ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px',
                        backgroundColor: 'var(--card)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setStatusFilter(statusFilter === 'bosStok' ? null : 'bosStok')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Package size={18} />
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.primary, fontWeight: 700 }}>{stats?.stokSasiCount || 0}</div>
                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Bo┼ş Stok</div>
                      </div>
                    </div>
                    <div
                      style={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${COLORS.success}`,
                        borderTop: statusFilter === 'tamamlananStok' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                        borderRight: statusFilter === 'tamamlananStok' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                        borderBottom: statusFilter === 'tamamlananStok' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px',
                        backgroundColor: 'var(--card)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setStatusFilter(statusFilter === 'tamamlananStok' ? null : 'tamamlananStok')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.success, fontWeight: 700 }}>{stats?.tamamlananStok || 0}</div>
                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Tamamlanan</div>
                      </div>
                    </div>
                    <div
                      style={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${COLORS.warning}`,
                        borderTop: statusFilter === 'devamEdenStok' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                        borderRight: statusFilter === 'devamEdenStok' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                        borderBottom: statusFilter === 'devamEdenStok' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px',
                        backgroundColor: 'var(--card)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setStatusFilter(statusFilter === 'devamEdenStok' ? null : 'devamEdenStok')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <RefreshCcw size={18} />
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.warning, fontWeight: 700 }}>{stats?.devamEdenStok || 0}</div>
                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Devam Eden</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. M├£┼ŞTER─░ ┼ŞAS─░LER GRUBU - 3 Kart */}
                <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', height: '20px' }}>M├£┼ŞTER─░ ┼ŞAS─░LER</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                    <div
                      style={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${COLORS.info}`,
                        borderTop: statusFilter === 'bosMusteri' ? `2px solid ${COLORS.info}` : '1px solid var(--border)',
                        borderRight: statusFilter === 'bosMusteri' ? `2px solid ${COLORS.info}` : '1px solid var(--border)',
                        borderBottom: statusFilter === 'bosMusteri' ? `2px solid ${COLORS.info}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px',
                        backgroundColor: 'var(--card)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setStatusFilter(statusFilter === 'bosMusteri' ? null : 'bosMusteri')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)', color: COLORS.info,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <User size={18} />
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.info, fontWeight: 700 }}>{stats?.musteriSasiCount || 0}</div>
                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Bo┼ş M├╝┼şteri</div>
                      </div>
                    </div>
                    <div
                      style={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${COLORS.success}`,
                        borderTop: statusFilter === 'tamamlananMusteri' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                        borderRight: statusFilter === 'tamamlananMusteri' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                        borderBottom: statusFilter === 'tamamlananMusteri' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px',
                        backgroundColor: 'var(--card)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setStatusFilter(statusFilter === 'tamamlananMusteri' ? null : 'tamamlananMusteri')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.success, fontWeight: 700 }}>{stats?.tamamlananMusteri || 0}</div>
                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Bitmi┼ş M├╝┼şteri</div>
                      </div>
                    </div>
                    <div
                      style={{
                        cursor: 'pointer',
                        borderLeft: `4px solid ${COLORS.warning}`,
                        borderTop: statusFilter === 'devamEdenMusteri' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                        borderRight: statusFilter === 'devamEdenMusteri' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                        borderBottom: statusFilter === 'devamEdenMusteri' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '12px',
                        backgroundColor: 'var(--card)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        flex: 1, display: 'flex', alignItems: 'center', gap: '12px',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setStatusFilter(statusFilter === 'devamEdenMusteri' ? null : 'devamEdenMusteri')}
                    >
                      <div style={{
                        width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <RefreshCcw size={18} />
                      </div>
                      <div>
                        <div className="stat-value" style={{ fontSize: '18px', color: COLORS.warning, fontWeight: 700 }}>{stats?.devamEdenMusteri || 0}</div>
                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Devam Eden</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              /* STANDARD VIEW (Damper/Dorse) */
              <>
                <div
                  style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${COLORS.primary}`,
                    borderTop: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                    borderRight: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                    borderBottom: statusFilter === null ? `2px solid ${COLORS.primary}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    backgroundColor: 'var(--card)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setStatusFilter(null)}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(2, 35, 71, 0.1)', color: COLORS.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Package size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.total || 0}</div>
                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Toplam {productType === 'DAMPER' ? 'Damper' : 'Dorse'}</div>
                  </div>
                </div>

                <div
                  style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${COLORS.success}`,
                    borderTop: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                    borderRight: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                    borderBottom: statusFilter === 'tamamlanan' ? `2px solid ${COLORS.success}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    backgroundColor: 'var(--card)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setStatusFilter(statusFilter === 'tamamlanan' ? null : 'tamamlanan')}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)', color: COLORS.success,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <CheckCircle size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.tamamlanan || 0}</div>
                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Tamamlanan</div>
                  </div>
                </div>

                <div
                  style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${COLORS.info}`,
                    borderTop: statusFilter === 'teslimEdilen' ? `2px solid ${COLORS.info}` : '1px solid var(--border)',
                    borderRight: statusFilter === 'teslimEdilen' ? `2px solid ${COLORS.info}` : '1px solid var(--border)',
                    borderBottom: statusFilter === 'teslimEdilen' ? `2px solid ${COLORS.info}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    backgroundColor: 'var(--card)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setStatusFilter(statusFilter === 'teslimEdilen' ? null : 'teslimEdilen')}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)', color: COLORS.info,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Truck size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.teslimEdilen || 0}</div>
                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Teslim Edilen</div>
                  </div>
                </div>

                <div
                  style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${COLORS.warning}`,
                    borderTop: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                    borderRight: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                    borderBottom: statusFilter === 'devamEden' ? `2px solid ${COLORS.warning}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    backgroundColor: 'var(--card)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setStatusFilter(statusFilter === 'devamEden' ? null : 'devamEden')}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)', color: COLORS.warning,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <RefreshCcw size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.devamEden || 0}</div>
                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Devam Eden</div>
                  </div>
                </div>

                <div
                  style={{
                    cursor: 'pointer',
                    borderLeft: `4px solid ${COLORS.danger}`,
                    borderTop: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid var(--border)',
                    borderRight: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid var(--border)',
                    borderBottom: statusFilter === 'baslamayan' ? `2px solid ${COLORS.danger}` : '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '16px',
                    backgroundColor: 'var(--card)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setStatusFilter(statusFilter === 'baslamayan' ? null : 'baslamayan')}
                >
                  <div style={{
                    width: '48px', height: '48px', borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', color: COLORS.danger,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <PauseCircle size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.baslamayan || 0}</div>
                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Ba┼şlamayan</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* DORSE_SASI View */}
        {productType === 'DORSE_SASI' && (
          <div style={{ marginBottom: '24px' }}>
            <div className="dashboard-header-row">
              <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: '6px', fontSize: '14px' }}>
                  {filteredLinkedDorseSasis.length} ├çift
                </span>
                Ba─şl─▒ Dorse-┼Şasi Listesi
              </h2>
            </div>

            {filteredLinkedDorseSasis.length === 0 ? (
              <div style={{
                padding: '60px 40px',
                textAlign: 'center',
                background: 'var(--card-bg)',
                borderRadius: '16px',
                border: '1px dashed var(--border)'
              }}>
                <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.2 }}>­şöı</div>
                <h3 style={{ marginBottom: '8px', color: 'var(--foreground)' }}>
                  {filteredLinkedDorseSasis.length === 0 && linkedDorseSasis.length > 0 ? 'Sonu├ğ bulunamad─▒' : 'Hen├╝z Ba─şl─▒ ├çift Yok'}
                </h3>
                {linkedDorseSasis.length === 0 && (
                  <>
                    <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>Dorseler sekmesinden bir dorseye ┼şasi ba─şlayabilirsiniz.</p>
                    <button className="btn btn-primary" onClick={() => setProductType('DORSE')}>
                      Dorseler&apos;e Git
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredLinkedDorseSasis.map(({ dorse, sasi, dorseProgress, sasiProgress }) => (
                  <div
                    key={dorse.id}
                    style={{
                      background: 'var(--card-bg)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      border: '1px solid var(--border)',
                      overflow: 'hidden'
                    }}
                  >
                    <div className="dorse-sasi-grid">
                      {/* Dorse Section */}
                      <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <div>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--primary)',
                              background: 'color-mix(in srgb, var(--primary) 12%, var(--card))',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              letterSpacing: '0.5px'
                            }}>
                              DORSE #{dorse.imalatNo}
                            </span>
                            <div style={{ marginTop: '8px', fontWeight: 600, fontSize: '16px' }}>{dorse.musteri}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--muted)' }}>
                            <div>{dorse.malzemeCinsi || '-'}</div>
                            <div>{dorse.m3}m┬│</div>
                          </div>
                        </div>

                        <div style={{ marginBottom: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                          <span>Tamamlanma</span>
                          <span style={{ fontWeight: 600, color: dorseProgress === 100 ? 'var(--success)' : 'var(--primary)' }}>%{dorseProgress}</span>
                        </div>
                        <div style={{
                          height: '6px',
                          background: 'var(--secondary)',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${dorseProgress}%`,
                            height: '100%',
                            background: dorseProgress === 100 ? 'var(--success)' : 'var(--primary)',
                            borderRadius: '3px',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>

                      {/* Divider / Link */}
                      <div className="dorse-sasi-divider">
                        <div style={{ color: 'var(--muted)', opacity: 0.5 }}>­şöù</div>
                      </div>

                      {/* Sasi Section */}
                      <div style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <div>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: 'var(--success)',
                              background: 'color-mix(in srgb, var(--success) 12%, var(--card))',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              letterSpacing: '0.5px'
                            }}>
                              ┼ŞAS─░ #{sasi.imalatNo}
                            </span>
                            <div style={{ marginTop: '8px', fontWeight: 600, fontSize: '16px' }}>{sasi.musteri}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--muted)' }}>
                            <div>{sasi.dingil}</div>
                            <div>{formatSasiNoLabel(sasi.sasiNo)}</div>
                          </div>
                        </div>

                        <div style={{ marginBottom: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                          <span>Tamamlanma</span>
                          <span style={{ fontWeight: 600, color: sasiProgress === 100 ? 'var(--success)' : 'var(--primary)' }}>%{sasiProgress}</span>
                        </div>
                        <div style={{
                          height: '6px',
                          background: 'var(--secondary)',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${sasiProgress}%`,
                            height: '100%',
                            background: sasiProgress === 100 ? 'var(--success)' : 'var(--success)',
                            borderRadius: '3px',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dampers List */}
        {productType !== 'DORSE_SASI' && (
          <div style={{ marginBottom: '24px' }}>
            {staleHint && (
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.10)',
                  border: '1px solid rgba(245, 158, 11, 0.28)',
                  fontSize: '13px',
                  color: 'var(--warning)',
                  marginBottom: '14px',
                }}
              >
                <strong>Hat─▒rlatma:</strong> ├£retimde olup son {staleHint.days} g├╝nd├╝r g├╝ncellenmeyen{' '}
                <strong>{staleHint.total}</strong> kay─▒t var (teslimat bekleyen / ┼şasi montaj─▒ bitmemi┼ş).{' '}
                <Link href="/urun-listesi" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  ├£r├╝n listesine git
                </Link>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                {statusFilter === 'tamamlanan' && `Ô£à Tamamlanan ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : '┼Şasiler'}`}
                {statusFilter === 'devamEden' && `­şöä Devam Eden ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : '┼Şasiler'}`}
                {statusFilter === 'baslamayan' && `ÔÅ©´©Å Ba┼şlamayan ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : '┼Şasiler'}`}
                {statusFilter === 'eksikNumara' &&
                  (productType === 'SASI'
                    ? '┼Şasi no girilmeyen ┼şasiler'
                    : `─░malat no girilmeyen ${productType === 'DAMPER' ? 'damperler' : 'dorseler'}`)}
                {!statusFilter && `Son Eklenen ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' ? 'Dorseler' : '┼Şasiler'}`}
              </h2>
              {statusFilter && (
                <button className="btn btn-secondary" onClick={() => setStatusFilter(null)}>
                  Ô£ò Filtreyi Kald─▒r
                </button>
              )}
              {!statusFilter && (
                <Link href="/urun-listesi" className="btn btn-secondary">
                  T├╝m├╝n├╝ G├Âr ÔåÆ
                </Link>
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
                    background: sasiFilter === 'K─▒rma-BPW' ? 'var(--primary)' : undefined,
                    color: sasiFilter === 'K─▒rma-BPW' ? 'white' : undefined,
                    border: sasiFilter === 'K─▒rma-BPW' ? 'none' : undefined
                  }}
                  onClick={() => setSasiFilter(sasiFilter === 'K─▒rma-BPW' ? null : 'K─▒rma-BPW')}
                >
                  K─▒rma-BPW
                </button>
                <button
                  className={`btn btn-secondary`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background: sasiFilter === 'K─▒rma-TRAX' ? 'var(--primary)' : undefined,
                    color: sasiFilter === 'K─▒rma-TRAX' ? 'white' : undefined,
                    border: sasiFilter === 'K─▒rma-TRAX' ? 'none' : undefined
                  }}
                  onClick={() => setSasiFilter(sasiFilter === 'K─▒rma-TRAX' ? null : 'K─▒rma-TRAX')}
                >
                  K─▒rma-TRAX
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
                    Ô£ò Filtreyi Kald─▒r
                  </button>
                )}
              </div>
            )}

            {/* S─▒ralama Butonlar─▒ */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)', alignSelf: 'center', marginRight: '4px' }}>S─▒rala:</span>

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

              {/* ─░sim */}
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
                <Type size={16} /> ─░sim {sortBy === 'name-asc' ? 'AÔåÆZ' : sortBy === 'name-desc' ? 'ZÔåÆA' : ''}
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
                <Calendar size={16} /> Tarih {sortBy === 'date-desc' ? 'YeniÔåÆEski' : sortBy === 'date-asc' ? 'EskiÔåÆYeni' : ''}
              </button>

              {(productType === 'DAMPER' || productType === 'DORSE' || productType === 'SASI') && (
                <button
                  type="button"
                  className={`btn btn-secondary`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background:
                      sortBy === 'imalat-desc' || sortBy === 'imalat-asc' ? 'var(--primary)' : undefined,
                    color: sortBy === 'imalat-desc' || sortBy === 'imalat-asc' ? 'white' : undefined
                  }}
                  onClick={() => {
                    if (sortBy === 'imalat-desc') setSortBy('imalat-asc');
                    else if (sortBy === 'imalat-asc') setSortBy(null);
                    else setSortBy('imalat-desc');
                  }}
                  title="─░malat no: ├Ânce b├╝y├╝kten k├╝├ğ├╝─şe, tekrar k├╝├ğ├╝kten b├╝y├╝─şe; bo┼ş/0 olanlar her zaman sonda"
                >
                  <Hash size={16} /> ─░malat no{' '}
                  {sortBy === 'imalat-desc' ? 'Ôåô' : sortBy === 'imalat-asc' ? 'Ôåæ' : ''}
                </button>
              )}

              {productType === 'SASI' && (
                <button
                  type="button"
                  className={`btn btn-secondary`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    background:
                      sortBy === 'sasiNo-desc' || sortBy === 'sasiNo-asc' ? 'var(--primary)' : undefined,
                    color: sortBy === 'sasiNo-desc' || sortBy === 'sasiNo-asc' ? 'white' : undefined
                  }}
                  onClick={() => {
                    if (sortBy === 'sasiNo-desc') setSortBy('sasiNo-asc');
                    else if (sortBy === 'sasiNo-asc') setSortBy(null);
                    else setSortBy('sasiNo-desc');
                  }}
                  title="┼Şasi no: ├Ânce b├╝y├╝kten k├╝├ğ├╝─şe, tekrar k├╝├ğ├╝kten b├╝y├╝─şe; bo┼ş olanlar sonda"
                >
                  <Hash size={16} /> ┼Şasi no{' '}
                  {sortBy === 'sasiNo-desc' ? 'Ôåô' : sortBy === 'sasiNo-asc' ? 'Ôåæ' : ''}
                </button>
              )}

              {(productType === 'DAMPER' || productType === 'DORSE' || productType === 'SASI') && (
                <button
                  type="button"
                  className={`btn btn-secondary`}
                  style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderStyle: 'dashed',
                    background: statusFilter === 'eksikNumara' ? 'rgba(245, 158, 11, 0.25)' : undefined,
                    borderColor: statusFilter === 'eksikNumara' ? 'var(--warning)' : undefined
                  }}
                  onClick={() => setStatusFilter(statusFilter === 'eksikNumara' ? null : 'eksikNumara')}
                  title={
                    productType === 'SASI'
                      ? '┼Şasi numaras─▒ girilmemi┼ş ┼şasiler'
                      : '─░malat numaras─▒ girilmemi┼ş damper/dorse kay─▒tlar─▒'
                  }
                >
                  {productType === 'SASI'
                    ? `┼Şasi no yok (${eksikNumaraCount})`
                    : `─░malat no eksik (${eksikNumaraCount})`}
                </button>
              )}

              {sortBy && (
                <button
                  className="btn"
                  style={{ fontSize: '12px', padding: '6px 12px', color: 'var(--danger)' }}
                  onClick={() => setSortBy(null)}
                >
                  Ô£ò S─▒ralamay─▒ Kald─▒r
                </button>
              )}
            </div>

            {productType === 'DAMPER' ? (
              sortedDampers.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  Bu kategoride damper bulunamad─▒
                </div>
              ) : (
                sortedDampers.map((damper) => {
                  const progress = calculateProgress(damper);
                  const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BA┼ŞLAMADI' : 'DEVAM ED─░YOR';
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
                          {damper.malzemeCinsi} | {damper.m3} M┬│{damper.renk ? ` | ${damper.renk}` : ''}
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
                        }} title={damper.aracGeldiMi ? 'Ara├ğ Geldi' : 'Ara├ğ Gelmedi'}></div>
                        <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>Ôû╝</div>
                      </div>

                      {isExpanded && (
                        <div className="damper-card-body">
                          <ProductLocalNote
                            kind="DAMPER"
                            productId={damper.id}
                            value={damper.cardNote}
                            onPersist={async (next) => {
                              const updated = await updateDamper(damper.id, { cardNote: next });
                              setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                            }}
                          />
                          {/* Ara├ğ Geldi Mi */}
                          {/* Bilgi Kartlar─▒ (─░malat No, Ara├ğ Durumu & Tarih) */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                            marginBottom: '20px',
                            paddingBottom: '20px',
                            borderBottom: '1px solid var(--border)'
                          }}>
                            {/* ─░malat No - D├╝zenlenebilir */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: !damper.imalatNo ? '2px solid var(--warning)' : '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>─░MALAT NO</div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: !damper.imalatNo ? 'var(--warning)' : 'var(--foreground)' }}>
                                  {damper.imalatNo ?? 'Girilmedi'}
                                </div>
                              </div>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                className="input"
                                style={{
                                  width: '100px',
                                  padding: '6px 10px',
                                  fontSize: '13px',
                                  textAlign: 'center',
                                  height: '34px'
                                }}
                                placeholder="─░malat No"
                                value={damper.imalatNo != null ? String(damper.imalatNo) : ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, '');
                                  const newImalatNo = digits === '' ? null : parseInt(digits, 10);
                                  setDampers(prev =>
                                    prev.map(d => (d.id === damper.id ? { ...d, imalatNo: newImalatNo } : d))
                                  );
                                  const key = `damper-${damper.id}-imalatNo`;
                                  persistLater(key, async () => {
                                    const updated = await updateDamper(damper.id, { imalatNo: newImalatNo });
                                    setDampers(prev =>
                                      applyServerRowIfFieldMatches(prev, damper.id, 'imalatNo', newImalatNo, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`damper-${damper.id}-imalatNo`)}
                              />
                            </div>

                            {/* ┼Şasi No - D├╝zenlenebilir */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              minWidth: 0
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>┼ŞAS─░ NO</div>
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
                                  height: '34px',
                                  flexShrink: 0
                                }}
                                placeholder="┼Şasi No"
                                value={damper.sasiNo || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newSasiNo = e.target.value;
                                  setDampers(prev =>
                                    prev.map(d => (d.id === damper.id ? { ...d, sasiNo: newSasiNo } : d))
                                  );
                                  const key = `damper-${damper.id}-sasiNo`;
                                  persistLater(key, async () => {
                                    const updated = await updateDamper(damper.id, { sasiNo: newSasiNo });
                                    setDampers(prev =>
                                      applyServerRowIfFieldMatches(prev, damper.id, 'sasiNo', newSasiNo, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`damper-${damper.id}-sasiNo`)}
                              />
                            </div>

                            {/* Renk - ─░malat / ┼Şasi ile ayn─▒ sat─▒rda (auto-fit ─▒zgara) */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              minWidth: 0
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>RENK</div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: damper.renk ? 'var(--foreground)' : 'var(--muted)' }}>
                                  {damper.renk || 'Girilmedi'}
                                </div>
                              </div>
                              <input
                                type="text"
                                className="input"
                                style={{
                                  width: '100px',
                                  padding: '6px 10px',
                                  fontSize: '13px',
                                  height: '34px',
                                  flexShrink: 0
                                }}
                                placeholder="Renk"
                                value={damper.renk || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newRenk = e.target.value;
                                  setDampers(prev =>
                                    prev.map(d => (d.id === damper.id ? { ...d, renk: newRenk } : d))
                                  );
                                  const key = `damper-${damper.id}-renk`;
                                  persistLater(key, async () => {
                                    const updated = await updateDamper(damper.id, { renk: newRenk });
                                    setDampers(prev =>
                                      applyServerRowIfFieldMatches(prev, damper.id, 'renk', newRenk, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`damper-${damper.id}-renk`)}
                              />
                            </div>

                            {/* Branda */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              minWidth: 0
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>BRANDA</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: damper.branda ? 'var(--success)' : 'var(--danger)' }}>
                                  {damper.branda ? 'VAR' : 'YOK'}
                                </div>
                              </div>
                              <select
                                className="select"
                                value={damper.branda ? 'VAR' : 'YOK'}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = e.target.value === 'VAR';
                                  e.stopPropagation();
                                  setDampers((prev) =>
                                    prev.map((d) =>
                                      d.id === damper.id
                                        ? { ...d, branda: v, ...(v ? {} : { brandaMontaji: false }) }
                                        : d
                                    )
                                  );
                                  void (async () => {
                                    const updated = await updateDamper(
                                      damper.id,
                                      v ? { branda: true } : { branda: false, brandaMontaji: false }
                                    );
                                    setDampers((prev) =>
                                      applyServerRowIfFieldMatches(prev, damper.id, 'branda', v, updated)
                                    );
                                  })();
                                }}
                                style={{ width: '76px', padding: '6px 8px', fontSize: '12px', height: '34px', flexShrink: 0 }}
                              >
                                <option value="VAR">VAR</option>
                                <option value="YOK">YOK</option>
                              </select>
                            </div>

                            {/* Ara├ğ markas─▒ ÔÇö tam sat─▒r */}
                            <div style={{
                              gridColumn: '1 / -1',
                              background: 'var(--card-bg-secondary)',
                              padding: '16px 20px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              minWidth: 0
                            }}>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>ARA├ç MARKASI</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                                <div
                                  style={{
                                    flex: '1 1 200px',
                                    minWidth: 0,
                                    fontSize: '15px',
                                    fontWeight: 500,
                                    color: damper.aracMarka ? 'var(--foreground)' : 'var(--muted)',
                                    lineHeight: 1.4,
                                    overflowWrap: 'anywhere',
                                    wordBreak: 'break-word'
                                  }}
                                >
                                  {damper.aracMarka || 'Girilmedi'}
                                </div>
                                <select
                                  className="input"
                                  style={{
                                    flex: '2 1 280px',
                                    width: '100%',
                                    minWidth: 'min(100%, 220px)',
                                    maxWidth: '100%',
                                    padding: '8px 14px',
                                    fontSize: '15px',
                                    height: '40px',
                                    boxSizing: 'border-box'
                                  }}
                                  value={damper.aracMarka ?? ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const newMarka = e.target.value || null;
                                    setDampers(prev =>
                                      prev.map(d => (d.id === damper.id ? { ...d, aracMarka: newMarka } : d))
                                    );
                                    const key = `damper-${damper.id}-aracMarka`;
                                    persistLater(key, async () => {
                                      const updated = await updateDamper(damper.id, { aracMarka: newMarka });
                                      setDampers(prev =>
                                        applyServerRowIfFieldMatches(prev, damper.id, 'aracMarka', newMarka, updated)
                                      );
                                    });
                                  }}
                                  onBlur={() => void persistNow(`damper-${damper.id}-aracMarka`)}
                                >
                                  <option value="">Seçiniz</option>
                                  {(dropdowns?.aracMarka ?? []).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                  {damper.aracMarka && !(dropdowns?.aracMarka ?? []).includes(damper.aracMarka) ? (
                                    <option value={damper.aracMarka}>{damper.aracMarka} (kayıtlı)</option>
                                  ) : null}
                                </select>
                              </div>
                            </div>

                            <div className="damper-info-trio">
                              <div style={{
                                background: 'var(--card-bg-secondary)',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                position: 'relative',
                                minWidth: 0
                              }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>OLU┼ŞTURULMA TAR─░H─░</div>
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
                                    width: '40px',
                                    height: '30px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--bg)',
                                    color: 'transparent',
                                    cursor: 'pointer',
                                    opacity: 0,
                                    position: 'absolute',
                                    right: '16px',
                                    zIndex: 10
                                  }}
                                  title="Tarihi D├╝zenle"
                                  onChange={(e) => {
                                    if (!e.target.value) return;
                                    const iso = new Date(e.target.value).toISOString();
                                    setDampers(prev =>
                                      prev.map(d => (d.id === damper.id ? { ...d, createdAt: iso } : d))
                                    );
                                    void (async () => {
                                      const updated = await updateDamper(damper.id, { createdAt: iso });
                                      setDampers(prev =>
                                        applyServerRowIfFieldMatches(prev, damper.id, 'createdAt', iso, updated)
                                      );
                                    })();
                                  }}
                                />
                                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  <Calendar size={20} />
                                </div>
                              </div>

                              <div style={{
                                background: 'var(--card-bg-secondary)',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                minWidth: 0
                              }}>
                                <div>
                                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADET</div>
                                  <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                    {damper.adet > 0 ? damper.adet : 'ÔÇô'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                                    value={damper.adet > 0 ? String(damper.adet) : ''}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const raw = e.target.value;
                                      const key = `damper-${damper.id}-adet`;
                                      if (raw === '') {
                                        setDampers(prev =>
                                          prev.map(d => (d.id === damper.id ? { ...d, adet: 0 } : d))
                                        );
                                        persistLater(key, async () => {
                                          const updated = await updateDamper(damper.id, { adet: 1 });
                                          setDampers(prev =>
                                            applyServerRowIfFieldMatches(prev, damper.id, 'adet', 0, updated)
                                          );
                                        });
                                        return;
                                      }
                                      const newAdet = parseInt(raw, 10);
                                      if (Number.isNaN(newAdet) || newAdet < 1) return;
                                      const snap = newAdet;
                                      setDampers(prev =>
                                        prev.map(d => (d.id === damper.id ? { ...d, adet: newAdet } : d))
                                      );
                                      persistLater(key, async () => {
                                        const updated = await updateDamper(damper.id, { adet: newAdet });
                                        setDampers(prev =>
                                          applyServerRowIfFieldMatches(prev, damper.id, 'adet', snap, updated)
                                        );
                                      });
                                    }}
                                    onBlur={() => {
                                      void persistNow(`damper-${damper.id}-adet`);
                                      setDampers(prev =>
                                        prev.map(d =>
                                          d.id === damper.id && d.adet < 1 ? { ...d, adet: 1 } : d
                                        )
                                      );
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>

                              <div style={{
                                background: 'var(--card-bg-secondary)',
                                padding: '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                minWidth: 0
                              }}>
                                <div>
                                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ARA├ç DURUMU</div>
                                  <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                    {damper.aracGeldiMi ? 'Ara├ğ Fabrikada' : 'Ara├ğ Gelmedi'}
                                  </div>
                                </div>
                                <div
                                  className={`step-toggle ${damper.aracGeldiMi ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStepToggle(damper.id, 'aracGeldiMi', damper.aracGeldiMi, 'DAMPER');
                                  }}
                                  style={{ transform: 'scale(1.1)' }}
                                  title="De─şi┼ştirmek i├ğin t─▒klay─▒n"
                                ></div>
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
                                    const isBrandaMontajiLocked = step.key === 'brandaMontaji' && !damper.branda;
                                    const isCompleted = damper[step.key as keyof Damper] as boolean;
                                    const toggleOn = !isBrandaMontajiLocked && isCompleted;
                                    return (
                                      <div
                                        key={step.key}
                                        className="step-item"
                                        style={isBrandaMontajiLocked ? { alignItems: 'flex-start' } : undefined}
                                      >
                                        <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                                          <span className="step-item-label">{step.label}</span>
                                          {isBrandaMontajiLocked ? (
                                            <div
                                              style={{
                                                fontSize: '11px',
                                                color: 'var(--muted)',
                                                marginTop: 6,
                                                maxWidth: 240,
                                                lineHeight: 1.35,
                                              }}
                                            >
                                              Bu sipari┼şte branda yok; bu ad─▒m kullan─▒lm─▒yor.
                                            </div>
                                          ) : null}
                                        </div>
                                        <div style={{ alignSelf: 'center', flexShrink: 0 }}>
                                          <div
                                            className={`step-toggle ${toggleOn ? 'active' : ''}`}
                                            onClick={
                                              isBrandaMontajiLocked
                                                ? undefined
                                                : () => handleStepToggle(damper.id, step.key, isCompleted, 'DAMPER')
                                            }
                                            title={
                                              isBrandaMontajiLocked
                                                ? 'Branda yok ÔÇö montaj takip edilmez'
                                                : 'De─şi┼ştirmek i├ğin t─▒klay─▒n'
                                            }
                                            style={
                                              isBrandaMontajiLocked
                                                ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }
                                                : undefined
                                            }
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* Muayene ve Teslimat */}
                          <div className="step-group">
                            <div className="step-group-title">MUAYENE & TESL─░MAT</div>
                            <div className="step-items">

                              <div className="step-item">
                                <span className="step-item-label">Kurum Muayenesi</span>
                                <select
                                  className="select"
                                  style={{ width: '120px', padding: '6px 10px', fontSize: '12px' }}
                                  value={damper.kurumMuayenesi}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    void (async () => {
                                      const updated = await updateDamper(damper.id, { kurumMuayenesi: v });
                                      setDampers(prev =>
                                        applyServerRowIfFieldMatches(prev, damper.id, 'kurumMuayenesi', v, updated)
                                      );
                                    })();
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
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    void (async () => {
                                      const updated = await updateDamper(damper.id, { dmoMuayenesi: v });
                                      setDampers(prev =>
                                        applyServerRowIfFieldMatches(prev, damper.id, 'dmoMuayenesi', v, updated)
                                      );
                                    })();
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

                          {deliveryDraft?.kind === 'DAMPER' && deliveryDraft.id === damper.id && (
                            <div
                              className="card"
                              style={{
                                marginTop: '16px',
                                padding: '16px',
                                background: 'rgba(59, 130, 246, 0.06)',
                                border: '1px solid rgba(59, 130, 246, 0.20)'
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: '10px' }}>Teslim bilgileri</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                  ┼Şase No
                                  <input
                                    value={deliveryDraft.teslimSasiNo}
                                    onChange={(e) =>
                                      setDeliveryDraft((p) =>
                                        p
                                          ? {
                                              ...p,
                                              teslimSasiNo: e.target.value.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '')
                                            }
                                          : p
                                      )
                                    }
                                    className="input"
                                    placeholder="├ûrn: TRAX3077108"
                                    style={{ marginTop: '6px' }}
                                  />
                                </label>
                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                  Teslim Eden
                                  <input
                                    value={deliveryDraft.teslimEden}
                                    onChange={(e) => setDeliveryDraft((p) => (p ? { ...p, teslimEden: e.target.value } : p))}
                                    className="input"
                                    style={{ marginTop: '6px' }}
                                  />
                                </label>
                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                  Teslim Alan
                                  <input
                                    value={deliveryDraft.teslimAlan}
                                    onChange={(e) => setDeliveryDraft((p) => (p ? { ...p, teslimAlan: e.target.value } : p))}
                                    className="input"
                                    style={{ marginTop: '6px' }}
                                  />
                                </label>
                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                  Teslim Alan Firma (otomatik)
                                  <input value={damper.musteri} readOnly className="input" style={{ marginTop: '6px', opacity: 0.75 }} />
                                </label>
                              </div>
                              <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '12px' }}>
                                Not
                                <textarea
                                  value={deliveryDraft.teslimNot}
                                  onChange={(e) => setDeliveryDraft((p) => (p ? { ...p, teslimNot: e.target.value } : p))}
                                  className="input"
                                  style={{ marginTop: '6px', minHeight: '80px' }}
                                />
                              </label>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                                <button className="btn btn-secondary" onClick={() => setDeliveryDraft(null)}>
                                  Vazge├ğ
                                </button>
                                <button className="btn btn-primary" onClick={() => void confirmDelivery()}>
                                  Teslim Et
                                </button>
                              </div>
                            </div>
                          )}

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
                                if (window.confirm(`"${damper.musteri}" - ─░malat No: ${damper.imalatNo}\n\nBu damperi silmek istedi─şinize emin misiniz?\n\nBu i┼şlem geri al─▒namaz!`)) {
                                  try {
                                    await deleteDamper(damper.id);
                                    setDampers(prev => prev.filter(d => d.id !== damper.id));
                                    setExpandedId(null);
                                    loadData(); // Refresh stats
                                  } catch (error) {
                                    console.error('Error deleting damper:', error);
                                    alert('Damper silinirken hata olu┼ştu');
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
            ) : productType === 'DORSE' ? (
              sortedDorses.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  Bu kategoride dorse bulunamad─▒
                </div>
              ) : (
                sortedDorses.map((dorse) => {
                  const progress = calculateDorseProgress(dorse);
                  const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BA┼ŞLAMADI' : 'DEVAM ED─░YOR';
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
                          {dorse.dingil} | {dorse.m3} M┬│{dorse.renk ? ` | ${dorse.renk}` : ''}
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
                        }} title={dorse.cekiciGeldiMi ? '├çekici Geldi' : '├çekici Gelmedi'}></div>
                        <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>Ôû╝</div>
                      </div>

                      {isExpanded && (
                        <div className="damper-card-body">
                          <ProductLocalNote
                            kind="DORSE"
                            productId={dorse.id}
                            value={dorse.cardNote}
                            onPersist={async (next) => {
                              const updated = await updateDorse(dorse.id, { cardNote: next });
                              setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
                            }}
                          />
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                            marginBottom: '20px',
                            paddingBottom: '20px',
                            borderBottom: '1px solid var(--border)'
                          }}>
                            {/* ─░malat No */}
                            {/* ─░malat No */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: !dorse.imalatNo ? '2px solid var(--warning)' : '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>─░MALAT NO</div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: !dorse.imalatNo ? 'var(--warning)' : 'var(--foreground)' }}>
                                  {dorse.imalatNo ?? 'Girilmedi'}
                                </div>
                              </div>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                className="input"
                                style={{ width: '80px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', height: '34px' }}
                                placeholder="No"
                                value={dorse.imalatNo != null ? String(dorse.imalatNo) : ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, '');
                                  const newImalatNo = digits === '' ? null : parseInt(digits, 10);
                                  setDorses(prev =>
                                    prev.map(d => (d.id === dorse.id ? { ...d, imalatNo: newImalatNo } : d))
                                  );
                                  const key = `dorse-${dorse.id}-imalatNo`;
                                  persistLater(key, async () => {
                                    const updated = await updateDorse(dorse.id, { imalatNo: newImalatNo });
                                    setDorses(prev =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'imalatNo', newImalatNo, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`dorse-${dorse.id}-imalatNo`)}
                              />
                            </div>



                            {/* Silindir */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>S─░L─░ND─░R</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                  {dorse.silindir || '-'}
                                </div>
                              </div>
                              <input
                                type="text"
                                className="input"
                                style={{ width: '100px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', height: '34px' }}
                                placeholder="Silindir"
                                value={dorse.silindir ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newSilindir = e.target.value;
                                  setDorses(prev =>
                                    prev.map(d => (d.id === dorse.id ? { ...d, silindir: newSilindir } : d))
                                  );
                                  const key = `dorse-${dorse.id}-silindir`;
                                  persistLater(key, async () => {
                                    const updated = await updateDorse(dorse.id, { silindir: newSilindir });
                                    setDorses(prev =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'silindir', newSilindir, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`dorse-${dorse.id}-silindir`)}
                              />
                            </div>

                            {/* Malzeme Cinsi */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>MALZEME C─░NS─░</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                  {dorse.malzemeCinsi || '-'}
                                </div>
                              </div>
                              <select
                                className="select"
                                style={{ width: '100px', padding: '6px 10px', fontSize: '12px', height: '34px' }}
                                value={dorse.malzemeCinsi ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newMalzemeCinsi = e.target.value;
                                  void (async () => {
                                    const updated = await updateDorse(dorse.id, { malzemeCinsi: newMalzemeCinsi });
                                    setDorses(prev =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'malzemeCinsi', newMalzemeCinsi, updated)
                                    );
                                  })();
                                }}
                              >
                                <option value="">Se├ğiniz</option>
                                {dropdowns?.malzemeCinsi.map(m => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>

                            {/* Kal─▒nl─▒k */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>KALINLIK</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                  {dorse.kalinlik || '-'}
                                </div>
                              </div>
                              <input
                                type="text"
                                className="input"
                                style={{ width: '80px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', height: '34px' }}
                                placeholder="Kal─▒nl─▒k"
                                value={dorse.kalinlik ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newKalinlik = e.target.value;
                                  setDorses(prev =>
                                    prev.map(d => (d.id === dorse.id ? { ...d, kalinlik: newKalinlik } : d))
                                  );
                                  const key = `dorse-${dorse.id}-kalinlik`;
                                  persistLater(key, async () => {
                                    const updated = await updateDorse(dorse.id, { kalinlik: newKalinlik });
                                    setDorses(prev =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'kalinlik', newKalinlik, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`dorse-${dorse.id}-kalinlik`)}
                              />
                            </div>

                            {/* Fren (Wabco / Knorr) */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>FREN</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                  {dorse.frenMarka || '-'}
                                </div>
                              </div>
                              <select
                                className="select"
                                style={{ width: '100px', padding: '6px 10px', fontSize: '12px', height: '34px' }}
                                value={dorse.frenMarka ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const vOrNull = v === '' ? null : v;
                                  void (async () => {
                                    const updated = await updateDorse(dorse.id, { frenMarka: vOrNull });
                                    setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
                                  })();
                                }}
                              >
                                <option value="">Se├ğiniz</option>
                                {(dropdowns?.dorseFren ?? ['Wabco', 'Knorr']).map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </div>

                            {/* ┼Şasi Ba─şlant─▒s─▒ */}
                            <div style={{
                              gridColumn: '1 / -1',
                              background: 'var(--card-bg-secondary)',
                              padding: '16px',
                              borderRadius: 'var(--radius-lg)',
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
                                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>┼ŞAS─░ BA─ŞLANTISI</div>
                                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--primary)' }}>
                                    {dorse.sasi ? (
                                      <span>#{dorse.sasi.imalatNo} - {dorse.sasi.musteri} ({dorse.sasi.sasiNo})</span>
                                    ) : (
                                      <span style={{ color: 'var(--muted)' }}>┼Şasi ba─şl─▒ de─şil</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  className="btn btn-primary"
                                  onClick={(e) => { e.stopPropagation(); openLinkModal(dorse); }}
                                  style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                  {dorse.sasi ? <><LinkIcon size={14} /> ┼Şasiyi De─şi┼ştir</> : <><LinkIcon size={14} /> ┼Şasi Ba─şla</>}
                                </button>
                                {dorse.sasi && (
                                  <button
                                    className="btn btn-danger"
                                    onClick={(e) => { e.stopPropagation(); handleUnlinkSasi(dorse.id); }}
                                    style={{ fontSize: '13px', padding: '8px 16px' }}
                                  >
                                    <X size={14} /> ┼Şasiyi Kald─▒r
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Dorse Durumu -> ├çekici Durumu */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>├çEK─░C─░ DURUMU</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                  {dorse.cekiciGeldiMi ? '├çekici Geldi' : '├çekici Gelmedi'}
                                </div>
                              </div>
                              <div
                                className={`step-toggle ${dorse.cekiciGeldiMi ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStepToggle(dorse.id, 'cekiciGeldiMi', dorse.cekiciGeldiMi, 'DORSE');
                                }}
                                style={{ transform: 'scale(1.1)' }}
                                title="De─şi┼ştirmek i├ğin t─▒klay─▒n"
                              ></div>
                            </div>

                            {/* Adet */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ADET</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                  {dorse.adet > 0 ? dorse.adet : 'ÔÇô'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  className="input"
                                  min="1"
                                  style={{ width: '60px', padding: '4px 8px', fontSize: '13px', textAlign: 'center', height: '32px' }}
                                  value={dorse.adet > 0 ? String(dorse.adet) : ''}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const raw = e.target.value;
                                    const key = `dorse-${dorse.id}-adet`;
                                    if (raw === '') {
                                      setDorses(prev =>
                                        prev.map(d => (d.id === dorse.id ? { ...d, adet: 0 } : d))
                                      );
                                      persistLater(key, async () => {
                                        const updated = await updateDorse(dorse.id, { adet: 1 });
                                        setDorses(prev =>
                                          applyServerRowIfFieldMatches(prev, dorse.id, 'adet', 0, updated)
                                        );
                                      });
                                      return;
                                    }
                                    const newAdet = parseInt(raw, 10);
                                    if (Number.isNaN(newAdet) || newAdet < 1) return;
                                    const snap = newAdet;
                                    setDorses(prev =>
                                      prev.map(d => (d.id === dorse.id ? { ...d, adet: newAdet } : d))
                                    );
                                    persistLater(key, async () => {
                                      const updated = await updateDorse(dorse.id, { adet: newAdet });
                                      setDorses(prev =>
                                        applyServerRowIfFieldMatches(prev, dorse.id, 'adet', snap, updated)
                                      );
                                    });
                                  }}
                                  onBlur={() => {
                                    void persistNow(`dorse-${dorse.id}-adet`);
                                    setDorses(prev =>
                                      prev.map(d =>
                                        d.id === dorse.id && d.adet < 1 ? { ...d, adet: 1 } : d
                                      )
                                    );
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>

                            {/* Renk - D├╝zenlenebilir */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>RENK</div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: dorse.renk ? 'var(--foreground)' : 'var(--muted)' }}>
                                  {dorse.renk || 'Girilmedi'}
                                </div>
                              </div>
                              <input
                                type="text"
                                className="input"
                                style={{
                                  width: '100px',
                                  padding: '6px 10px',
                                  fontSize: '13px',
                                  height: '34px'
                                }}
                                placeholder="Renk"
                                value={dorse.renk || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const newRenk = e.target.value;
                                  setDorses(prev =>
                                    prev.map(d => (d.id === dorse.id ? { ...d, renk: newRenk } : d))
                                  );
                                  const key = `dorse-${dorse.id}-renk`;
                                  persistLater(key, async () => {
                                    const updated = await updateDorse(dorse.id, { renk: newRenk });
                                    setDorses(prev =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'renk', newRenk, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`dorse-${dorse.id}-renk`)}
                              />
                            </div>

                            {/* Branda */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              minWidth: 0
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>BRANDA</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: dorse.branda ? 'var(--success)' : 'var(--danger)' }}>
                                  {dorse.branda ? 'VAR' : 'YOK'}
                                </div>
                              </div>
                              <select
                                className="select"
                                value={dorse.branda ? 'VAR' : 'YOK'}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = e.target.value === 'VAR';
                                  e.stopPropagation();
                                  setDorses((prev) =>
                                    prev.map((d) =>
                                      d.id === dorse.id
                                        ? { ...d, branda: v, ...(v ? {} : { brandaMontaji: false }) }
                                        : d
                                    )
                                  );
                                  void (async () => {
                                    const updated = await updateDorse(
                                      dorse.id,
                                      v ? { branda: true } : { branda: false, brandaMontaji: false }
                                    );
                                    setDorses((prev) =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'branda', v, updated)
                                    );
                                  })();
                                }}
                                style={{ width: '76px', padding: '6px 8px', fontSize: '12px', height: '34px', flexShrink: 0 }}
                              >
                                <option value="VAR">VAR</option>
                                <option value="YOK">YOK</option>
                              </select>
                            </div>

                            {/* Tarih */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              position: 'relative'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>OLU┼ŞTURULMA TAR─░H─░</div>
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
                                title="Tarihi D├╝zenle"
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const iso = new Date(e.target.value).toISOString();
                                  setDorses(prev =>
                                    prev.map(d => (d.id === dorse.id ? { ...d, createdAt: iso } : d))
                                  );
                                  void (async () => {
                                    const updated = await updateDorse(dorse.id, { createdAt: iso });
                                    setDorses(prev =>
                                      applyServerRowIfFieldMatches(prev, dorse.id, 'createdAt', iso, updated)
                                    );
                                  })();
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
                                    // Handle non-boolean steps (Dropdowns for Muayene fields)
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
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              void (async () => {
                                                const updated = await updateDorse(dorse.id, { [step.key]: v });
                                                setDorses(prev =>
                                                  applyServerRowIfFieldMatches(
                                                    prev,
                                                    dorse.id,
                                                    step.key as keyof Dorse,
                                                    v,
                                                    updated
                                                  )
                                                );
                                              })();
                                            }}
                                          >
                                            <option value="">Se├ğiniz</option>
                                            {options?.map(v => (
                                              <option key={v} value={v}>{v}</option>
                                            ))}
                                          </select>
                                        </div>
                                      );
                                    }

                                    // Handle boolean steps (Toggles)
                                    const isBrandaMontajiLocked = step.key === 'brandaMontaji' && !dorse.branda;
                                    const isCompleted = dorse[step.key as keyof Dorse] as boolean;
                                    const toggleOn = !isBrandaMontajiLocked && isCompleted;
                                    return (
                                      <div
                                        key={step.key}
                                        className="step-item"
                                        style={isBrandaMontajiLocked ? { alignItems: 'flex-start' } : undefined}
                                      >
                                        <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                                          <span className="step-item-label">{step.label}</span>
                                          {isBrandaMontajiLocked ? (
                                            <div
                                              style={{
                                                fontSize: '11px',
                                                color: 'var(--muted)',
                                                marginTop: 6,
                                                maxWidth: 240,
                                                lineHeight: 1.35,
                                              }}
                                            >
                                              Bu sipari┼şte branda yok; bu ad─▒m kullan─▒lm─▒yor.
                                            </div>
                                          ) : null}
                                        </div>
                                        <div style={{ alignSelf: 'center', flexShrink: 0 }}>
                                          <div
                                            className={`step-toggle ${toggleOn ? 'active' : ''}`}
                                            onClick={
                                              isBrandaMontajiLocked
                                                ? undefined
                                                : () => handleStepToggle(dorse.id, step.key, isCompleted, 'DORSE')
                                            }
                                            title={
                                              isBrandaMontajiLocked
                                                ? 'Branda yok ÔÇö montaj takip edilmez'
                                                : 'De─şi┼ştirmek i├ğin t─▒klay─▒n'
                                            }
                                            style={
                                              isBrandaMontajiLocked
                                                ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }
                                                : undefined
                                            }
                                          />
                                        </div>
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
                                if (window.confirm(`"${dorse.musteri}" - ─░malat No: ${dorse.imalatNo}\n\nBu dorseyi silmek istedi─şinize emin misiniz?\n\nBu i┼şlem geri al─▒namaz!`)) {
                                  try {
                                    await deleteDorse(dorse.id);
                                    setDorses(prev => prev.filter(d => d.id !== dorse.id));
                                    setExpandedId(null);
                                    loadData();
                                  } catch (error) {
                                    console.error('Error deleting dorse:', error);
                                    alert('Dorse silinirken hata olu┼ştu');
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
            ) : (
              sortedSasis.length === 0 ? (
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                  Bu kategoride ┼şasi bulunamad─▒
                </div>
              ) : (
                sortedSasis.map((sasi) => {
                  const progress = calculateSasiProgress(sasi);
                  const overallStatus = getSasiStatus(sasi).toUpperCase();
                  const isExpanded = expandedId === sasi.id;

                  return (
                    <div key={sasi.id} className="damper-card">
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
                          {formatSasiNoLabel(sasi.sasiNo)} | {sasi.dingil || '-'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="progress-bar" style={{ width: '100%', maxWidth: '80px' }}>
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '35px' }}>{progress}%</span>
                        </div>
                        <div>{getStatusBadge(overallStatus === 'TAMAMLANAN' ? 'TAMAMLANDI' : overallStatus === 'BASLAMAYAN' ? 'BA┼ŞLAMADI' : 'DEVAM ED─░YOR')}</div>
                        <div style={{ fontSize: '20px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>Ôû╝</div>
                      </div>

                      {isExpanded && (
                        <div className="damper-card-body">
                          <ProductLocalNote
                            kind="SASI"
                            productId={sasi.id}
                            value={sasi.cardNote}
                            onPersist={async (next) => {
                              const updated = await updateSasi(sasi.id, { cardNote: next });
                              setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                            }}
                          />
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '12px',
                            marginBottom: '20px',
                            paddingBottom: '20px',
                            borderBottom: '1px solid var(--border)'
                          }}>
                            {/* ─░malat no */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: !hasDamperDorseImalatNo(sasi.imalatNo) ? '2px solid var(--warning)' : '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>─░MALAT NO</div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: !hasDamperDorseImalatNo(sasi.imalatNo) ? 'var(--warning)' : 'var(--foreground)' }}>{sasi.imalatNo ?? 'Girilmedi'}</div>
                              </div>
                              <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                className="input"
                                style={{ width: '80px', padding: '4px', fontSize: '13px', textAlign: 'center' }}
                                placeholder="No"
                                value={sasi.imalatNo != null ? String(sasi.imalatNo) : ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, '');
                                  const val = digits === '' ? null : parseInt(digits, 10);
                                  setSasis(prev =>
                                    prev.map(s => (s.id === sasi.id ? { ...s, imalatNo: val } : s))
                                  );
                                  const key = `sasi-${sasi.id}-imalatNo`;
                                  persistLater(key, async () => {
                                    const updated = await updateSasi(sasi.id, { imalatNo: val });
                                    setSasis(prev =>
                                      applyServerRowIfFieldMatches(prev, sasi.id, 'imalatNo', val, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`sasi-${sasi.id}-imalatNo`)}
                              />
                            </div>

                            {/* ┼Şasi no */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: !hasSasiNoWritten(sasi.sasiNo) ? '2px solid var(--warning)' : '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              minWidth: 0
                            }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>┼ŞAS─░ NO</div>
                                <div style={{ fontSize: '14px', fontWeight: 500, color: hasSasiNoWritten(sasi.sasiNo) ? 'var(--foreground)' : 'var(--warning)' }}>{hasSasiNoWritten(sasi.sasiNo) ? normalizeSasiNoValue(sasi.sasiNo) : 'Girilmedi'}</div>
                              </div>
                              <input
                                type="text"
                                autoComplete="off"
                                className="input"
                                style={{ width: '140px', padding: '4px', fontSize: '13px', flexShrink: 0 }}
                                placeholder="┼Şasi no"
                                value={sasi.sasiNo ?? ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const v = raw.trim() === '' ? null : raw;
                                  setSasis(prev =>
                                    prev.map(s => (s.id === sasi.id ? { ...s, sasiNo: v } : s))
                                  );
                                  const key = `sasi-${sasi.id}-sasiNo`;
                                  persistLater(key, async () => {
                                    const updated = await updateSasi(sasi.id, { sasiNo: v });
                                    setSasis(prev =>
                                      applyServerRowIfFieldMatches(prev, sasi.id, 'sasiNo', v, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`sasi-${sasi.id}-sasiNo`)}
                              />
                            </div>

                            {/* M├╝┼şteri */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>M├£┼ŞTER─░ / ─░S─░M</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>{sasi.musteri}</div>
                              </div>
                              <input
                                type="text"
                                className="input"
                                style={{ width: '120px', padding: '4px', fontSize: '13px' }}
                                value={sasi.musteri || ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSasis(prev =>
                                    prev.map(s => (s.id === sasi.id ? { ...s, musteri: v } : s))
                                  );
                                  const key = `sasi-${sasi.id}-musteri`;
                                  persistLater(key, async () => {
                                    const updated = await updateSasi(sasi.id, { musteri: v });
                                    setSasis(prev =>
                                      applyServerRowIfFieldMatches(prev, sasi.id, 'musteri', v, updated)
                                    );
                                  });
                                }}
                                onBlur={() => void persistNow(`sasi-${sasi.id}-musteri`)}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="─░sim Giriniz"
                              />
                            </div>

                            {/* Tampon */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)'
                            }}>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TAMPON</div>
                              <select
                                className="select"
                                style={{
                                  width: '100%',
                                  padding: '4px',
                                  fontSize: '13px',
                                  background: 'var(--card-bg-secondary)',
                                  border: 'none',
                                  color: 'var(--foreground)'
                                }}
                                value={sasi.tampon || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  void (async () => {
                                    const updated = await updateSasi(sasi.id, { tampon: v });
                                    setSasis(prev =>
                                      applyServerRowIfFieldMatches(prev, sasi.id, 'tampon', v, updated)
                                    );
                                  })();
                                }}
                              >
                                <option style={{ color: 'black' }} value="">Se├ğiniz</option>
                                <option style={{ color: 'black' }} value="K─▒rma Tampon">KIRMA</option>
                                <option style={{ color: 'black' }} value="Sabit Tampon">SAB─░T</option>
                              </select>
                            </div>

                            {/* Dingil */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)'
                            }}>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>D─░NG─░L</div>
                              <select
                                className="select"
                                style={{
                                  width: '100%',
                                  padding: '4px',
                                  fontSize: '13px',
                                  background: 'var(--card-bg-secondary)',
                                  border: 'none',
                                  color: 'var(--foreground)'
                                }}
                                value={sasi.dingil || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  void (async () => {
                                    const updated = await updateSasi(sasi.id, { dingil: v });
                                    setSasis(prev =>
                                      applyServerRowIfFieldMatches(prev, sasi.id, 'dingil', v, updated)
                                    );
                                  })();
                                }}
                              >
                                <option style={{ color: 'black' }} value="">Se├ğiniz</option>
                                <option style={{ color: 'black' }} value="TRAX">TRAX</option>
                                <option style={{ color: 'black' }} value="BPW">BPW</option>
                              </select>
                            </div>

                            {/* Tarih */}
                            <div style={{
                              background: 'var(--card-bg-secondary)',
                              padding: '12px 16px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div>
                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TAR─░H</div>
                                <div style={{ fontSize: '13px' }}>{sasi.createdAt ? new Date(sasi.createdAt).toLocaleDateString() : '-'}</div>
                              </div>
                              <input
                                type="date"
                                className="input"
                                style={{ width: '110px', padding: '4px', fontSize: '12px' }}
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const iso = new Date(e.target.value).toISOString();
                                  setSasis(prev =>
                                    prev.map(s => (s.id === sasi.id ? { ...s, createdAt: iso } : s))
                                  );
                                  void (async () => {
                                    const updated = await updateSasi(sasi.id, { createdAt: iso });
                                    setSasis(prev =>
                                      applyServerRowIfFieldMatches(prev, sasi.id, 'createdAt', iso, updated)
                                    );
                                  })();
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </div>

                          {/* Sasi Steps */}
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
                                    // Handle boolean steps (Toggles)
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
                                if (window.confirm(`"${sasi.musteri}" - ─░malat No: ${sasi.imalatNo}\n\nBu ┼şasiyi silmek istedi─şinize emin misiniz?\n\nBu i┼şlem geri al─▒namaz!`)) {
                                  try {
                                    await deleteSasi(sasi.id);
                                    setSasis(prev => prev.filter(s => s.id !== sasi.id));
                                    setExpandedId(null);
                                    loadData();
                                  } catch (error) {
                                    console.error('Error deleting sasi:', error);
                                    alert('┼Şasi silinirken hata olu┼ştu');
                                  }
                                }
                              }}
                            >
                              <Trash2 size={16} /> ┼Şasiyi Sil
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
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="modal-overlay apple-product-form-overlay" onClick={() => setShowAddModal(false)}>
            <div
              className="modal modal--premium apple-product-form-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dashboard-add-product-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="modal-title" id="dashboard-add-product-modal-title">
                  Yeni {productType === 'DAMPER' ? 'Damper' : productType === 'DORSE' ? 'Dorse' : 'Şasi'} Ekle
                </h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Kapat"
                >
                  <X size={18} strokeWidth={2.25} />
                </button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  {productType === 'DAMPER' ? (
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">─░malat No <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(sonra doldurulabilir)</span></label>
                        <input
                          type="number"
                          className="input"
                          placeholder="Sonra doldurulacak..."
                          value={formData.imalatNo}
                          onChange={(e) => setFormData(prev => ({ ...prev, imalatNo: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">M├╝┼şteri *</label>
                        <input
                          type="text"
                          className="input"
                          required
                          value={formData.musteri}
                          onChange={(e) => setFormData(prev => ({ ...prev, musteri: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Ara├ğ Geldi Mi *</label>
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
                        <label className="form-label">Ara├ğ Marka</label>
                        <select
                          className="select"
                          value={formData.aracMarka}
                          onChange={(e) => setFormData(prev => ({ ...prev, aracMarka: e.target.value }))}
                        >
                          <option value="">Seçiniz</option>
                          {(dropdowns?.aracMarka ?? []).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Model</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: 3545 D, 3345 K..."
                          value={formData.model}
                          onChange={(e) => setFormData(prev => ({ ...prev, model: trUpper(e.target.value) }))}
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
                          <option value="">Se├ğiniz</option>
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
                          <option value="">Se├ğiniz</option>
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
                        <label className="form-label">M┬│</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: 18+2"
                          value={formData.m3}
                          onChange={(e) => setFormData(prev => ({ ...prev, m3: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Renk</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: Beyaz, K─▒rm─▒z─▒..."
                          value={formData.renk}
                          onChange={(e) => setFormData(prev => ({ ...prev, renk: trUpper(e.target.value) }))}
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
                              <Lightbulb size={18} /> {formData.adet} ayr─▒ damper olu┼şturulacak: {formData.musteri || 'Firma'} 1, {formData.musteri || 'Firma'} 2, ... {formData.musteri || 'Firma'} {formData.adet}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : productType === 'DORSE' ? (
                    // DORSE FORM fields
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">─░malat No <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(sonra doldurulabilir)</span></label>
                        <input
                          type="number"
                          className="input"
                          placeholder="Sonra doldurulacak..."
                          value={dorseFormData.imalatNo}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, imalatNo: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">┼Şasi Ba─şla <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(Opsiyonel)</span></label>
                        <select
                          className="select"
                          value={dorseFormData.sasiId}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, sasiId: e.target.value }))}
                          disabled={parseInt(dorseFormData.adet) > 1}
                          style={parseInt(dorseFormData.adet) > 1 ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                          <option value="">┼Şasi Se├ğiniz...</option>
                          {availableSasis.map(s => (
                            <option key={s.id} value={s.id}>
                              #{s.imalatNo} - {s.musteri} ({s.sasiNo})
                            </option>
                          ))}
                        </select>
                        {parseInt(dorseFormData.adet) > 1 && (
                          <div style={{ fontSize: '10px', color: 'var(--warning)', marginTop: '4px' }}>
                            ÔÜá´©Å ├çoklu eklemede ┼şasi otomatik ba─şlanamaz.
                          </div>
                        )}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Silindir</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Silindir bilgisi..."
                          value={dorseFormData.silindir}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, silindir: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Malzeme Cinsi</label>
                        <select
                          className="select"
                          value={dorseFormData.malzemeCinsi}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, malzemeCinsi: e.target.value }))}
                        >
                          <option value="">Se├ğiniz</option>
                          {dropdowns?.malzemeCinsi.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">M├╝┼şteri *</label>
                        <input
                          type="text"
                          className="input"
                          required
                          value={dorseFormData.musteri}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, musteri: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">├çekici Geldi Mi *</label>
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
                          placeholder="├ûrn: PIRLANTA..."
                          value={dorseFormData.dingil}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, dingil: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Lastik</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: BRIDGESTONE..."
                          value={dorseFormData.lastik}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, lastik: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tampon</label>
                        <select
                          className="select"
                          value={dorseFormData.tampon}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, tampon: e.target.value }))}
                        >
                          <option value="">Se├ğiniz</option>
                          <option value="K─▒rma">K─▒rma</option>
                          <option value="Sabit">Sabit</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Kal─▒nl─▒k</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: 4mm..."
                          value={dorseFormData.kalinlik}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, kalinlik: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fren</label>
                        <select
                          className="select"
                          value={dorseFormData.frenMarka}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, frenMarka: e.target.value }))}
                        >
                          <option value="">Se├ğiniz</option>
                          {(dropdowns?.dorseFren ?? ['Wabco', 'Knorr']).map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Branda *</label>
                        <select
                          className="select"
                          value={dorseFormData.branda ? 'VAR' : 'YOK'}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, branda: e.target.value === 'VAR' }))}
                        >
                          <option value="YOK">YOK</option>
                          <option value="VAR">VAR</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">M┬│</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: 18+2"
                          value={dorseFormData.m3}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, m3: trUpper(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Renk</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="├ûrn: Beyaz, K─▒rm─▒z─▒..."
                          value={dorseFormData.renk}
                          onChange={(e) => setDorseFormData(prev => ({ ...prev, renk: trUpper(e.target.value) }))}
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
                        <label className="form-label">Kay─▒t Tipi *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className={`btn ${sasiFormData.isStok ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: 1 }}
                            onClick={() => setSasiFormData(prev => ({ ...prev, isStok: true }))}
                          >
                            <Package size={16} /> Stok Kayd─▒
                          </button>
                          <button
                            type="button"
                            className={`btn ${!sasiFormData.isStok ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: 1 }}
                            onClick={() => setSasiFormData(prev => ({ ...prev, isStok: false }))}
                          >
                            <User size={16} /> M├╝┼şteri Kayd─▒
                          </button>
                        </div>
                      </div>

                      {!sasiFormData.isStok && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label">M├╝┼şteri Ad─▒ *</label>
                          <input
                            type="text"
                            className="input"
                            required
                            placeholder="M├╝┼şteri ad─▒n─▒ giriniz..."
                            value={sasiFormData.musteri}
                            onChange={(e) => setSasiFormData(prev => ({ ...prev, musteri: trUpper(e.target.value) }))}
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
                          <option value="">Se├ğiniz</option>
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
                          <option value="">Se├ğiniz</option>
                          <option value="K─▒rma Tampon">KIRMA</option>
                          <option value="Sabit Tampon">SAB─░T</option>
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
          </div>
        )}

        {/* ┼Şasi Ba─şlant─▒s─▒ Modal─▒ */}
        {showLinkModal && activeDorseForLink && (
          <div className="modal-overlay" onClick={() => setShowLinkModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', background: 'rgba(0, 0, 0, 0.6)' }}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                background: 'var(--card)',
                overflow: 'hidden'
              }}
            >
              {/* Modal Header */}
              <div className="modal-header" style={{
                background: 'linear-gradient(135deg, #1c1c1e 0%, #000000 100%)',
                padding: '24px 32px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}>
                    <LinkIcon size={24} />
                  </div>
                  <div>
                    <h3 className="modal-title" style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>┼Şasi Ba─şlant─▒s─▒</h3>
                    <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', margin: '4px 0 0 0', fontWeight: 500 }}>
                      <span style={{ color: '#fff' }}>{activeDorseForLink.musteri}</span> i├ğin ┼şasi se├ğimi
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLinkModal(false)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search & Filters */}
              <div style={{ padding: '24px 32px', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', marginBottom: '16px' }}>
                  <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-secondary)' }} />
                  <input
                    type="text"
                    placeholder="┼Şasi ara (M├╝┼şteri ad─▒, Stok no veya ─░malat no...)"
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 48px',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      fontSize: '15px',
                      color: 'var(--foreground)',
                      outline: 'none',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    value={linkSearchTerm}
                    onChange={(e) => setLinkSearchTerm(e.target.value)}
                    onFocus={(e) => e.target.style.borderColor = 'var(--control-fill)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
                <div style={{ display: 'flex', background: 'var(--border)', padding: '4px', borderRadius: 'var(--radius-lg)', gap: '4px' }}>
                  {['hepsi', 'stok', 'musteri'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLinkFilter(filter as 'hepsi' | 'stok' | 'musteri')}
                      style={{
                        flex: 1,
                        padding: '8px',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: linkFilter === filter ? 'white' : 'transparent',
                        color: linkFilter === filter ? 'var(--foreground)' : 'var(--foreground-secondary)',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: linkFilter === filter ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {filter === 'hepsi' ? 'T├╝m ┼Şasiler' : filter === 'stok' ? 'Stok ┼Şasileri' : 'M├╝┼şteri ┼Şasileri'}
                    </button>
                  ))}
                </div>
              </div>

              {/* List Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px', background: 'var(--card)' }}>
                {availableSasis.length === 0 ? (
                  <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
                    <Package size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--foreground-secondary)' }}>Ba─şlanabilir ┼şasi bulunamad─▒.</p>
                    <button
                      style={{ marginTop: '16px', padding: '10px 20px', background: 'color-mix(in srgb, var(--primary) 14%, var(--card))', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => { setShowLinkModal(false); setShowAddModal(true); setProductType('SASI'); }}
                    >
                      + Yeni ┼Şasi Olu┼ştur
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[...availableSasis]
                      .filter(s => {
                        if (linkFilter === 'stok' && !trIncludes(s.musteri, 'stok')) return false;
                        if (linkFilter === 'musteri' && trIncludes(s.musteri, 'stok')) return false;

                        if (linkSearchTerm.trim()) {
                          const search = linkSearchTerm.trim();
                          return (
                            trIncludes(s.musteri, search) ||
                            trIncludes(s.sasiNo, search) ||
                            String(s.imalatNo || '').includes(search)
                          );
                        }
                        return true;
                      })
                      .map(sasi => {
                        const isMatch =
                          trIncludes(sasi.musteri, activeDorseForLink.musteri) &&
                          !trIncludes(sasi.musteri, 'stok');
                        const progress = calculateSasiProgress(sasi);

                        return (
                          <div
                            key={sasi.id}
                            onClick={() => handleLinkSasi(activeDorseForLink.id, sasi.id)}
                            style={{
                              padding: '20px',
                              borderRadius: '16px',
                              border: isMatch ? '2px solid var(--primary)' : '1px solid var(--border)',
                              background: isMatch ? 'color-mix(in srgb, var(--primary) 12%, var(--card))' : 'var(--card)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseOver={(e) => {
                              if (!isMatch) {
                                e.currentTarget.style.borderColor = 'var(--muted)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!isMatch) {
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--foreground)' }}>
                                  #{sasi.imalatNo} - {sasi.musteri}
                                </span>
                                {isMatch && (
                                  <span style={{ fontSize: '11px', background: 'var(--primary)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                    ├ûNER─░LEN
                                  </span>
                                )}
                                {progress === 100 && (
                                  <span style={{ fontSize: '11px', background: 'var(--success)', color: 'white', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle size={12} /> HAZIR
                                  </span>
                                )}
                              </div>
                              <div style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--foreground-secondary)', fontSize: '13px', fontWeight: 500 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Info size={14} /> {sasi.sasiNo || '┼Şasi No Yok'}</span>
                                <span style={{ width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%' }}></span>
                                <span>{sasi.dingil}</span>
                                <span style={{ width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%' }}></span>
                                <span>{sasi.tampon}</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: progress === 100 ? 'var(--success)' : 'var(--control-fill)' }}>
                                %{progress} Tamamland─▒
                              </span>
                              <div style={{ width: '100px', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? 'var(--success)' : 'var(--control-fill)', borderRadius: '3px', transition: 'width 0.5s' }}></div>
                              </div>
                            </div>

                            <div style={{ marginLeft: '24px', width: '40px', height: '40px', borderRadius: 'var(--radius-lg)', background: isMatch ? 'var(--primary)' : 'var(--background)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isMatch ? 'white' : 'var(--muted)' }}>
                              <LinkIcon size={20} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '20px 32px', background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowLinkModal(false)}
                  style={{
                    padding: '12px 32px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--background)',
                    color: 'var(--foreground-secondary)',
                    border: '1px solid var(--border)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--border)'; e.currentTarget.style.color = 'var(--foreground)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--background)'; e.currentTarget.style.color = 'var(--foreground-secondary)'; }}
                >
                  ─░ptal
                </button>
              </div>
            </div>
          </div>
        )}
      </main >
    </>
  );
}

export default function Dashboard() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
