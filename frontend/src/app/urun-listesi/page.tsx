'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { ProductLocalNote } from '@/components/ProductLocalNote';
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
    FileSpreadsheet, // Added icon
    X, // Added icon
    Info // Added icon
} from 'lucide-react';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';

import { trIncludes, trStartsWithStok } from '@/lib/trSearch';
import { trUpper } from '@/lib/trUpper';
import { useDebouncedPersist, applyServerRowIfFieldMatches } from '@/lib/useDebouncedPersist';
import {
    getStats,
    getDampers,
    getDorses,
    getStaleProducts,
    getDropdowns,
    getStepEvents,
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

import { useAppleSegmentedThumb } from '@/hooks/useAppleSegmentedThumb';

type ProductType = 'DAMPER' | 'DORSE' | 'SASI' | 'DORSE_SASI' | 'HEPSI';

const PRODUCT_SEG_ORDER: ProductType[] = ['DAMPER', 'DORSE', 'SASI', 'DORSE_SASI', 'HEPSI'];

type CombinedListItem =
    | (Damper & { _type: 'DAMPER' })
    | (Dorse & { _type: 'DORSE' })
    | (Sasi & { _type: 'SASI' });

type StaleHint = { total: number; days: number } | null;

type StepTimeline = {
    productType: 'DAMPER' | 'DORSE';
    productId: number;
    createdAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    steps: Array<{ key: string; label: string; completedAt: string | null }>;
};

type TimelineState = StepTimeline | null | 'loading';

function formatProductionDuration(ms: number): string {
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const d = Math.floor(totalMin / (60 * 24));
    const h = Math.floor((totalMin - d * 60 * 24) / 60);
    const m = totalMin % 60;
    if (d > 0) return h > 0 ? `${d} gün ${h} saat` : `${d} gün`;
    if (h > 0) return m > 0 ? `${h} saat ${m} dk` : `${h} saat`;
    return `${m} dk`;
}

function normalizeDeliverySasiNoClient(raw: string) {
    const t = String(raw ?? '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
    if (!t) return '';
    if (!/^[A-Z0-9]+$/.test(t)) return '';
    return t;
}

function TimelineMini({ tl }: { tl: StepTimeline }) {
    const lastCompletedMs = tl.steps.reduce<number | null>((acc, s) => {
        if (!s.completedAt) return acc;
        const t = new Date(s.completedAt).getTime();
        if (!Number.isFinite(t)) return acc;
        return acc == null ? t : Math.max(acc, t);
    }, null);

    const firstCompletedMs = tl.steps.reduce<number | null>((acc, s) => {
        if (!s.completedAt) return acc;
        const t = new Date(s.completedAt).getTime();
        if (!Number.isFinite(t)) return acc;
        return acc == null ? t : Math.min(acc, t);
    }, null);

    const startIso =
        tl.createdAt ??
        tl.startedAt ??
        (firstCompletedMs != null ? new Date(firstCompletedMs).toISOString() : null);
    const endIso = tl.endedAt ?? (lastCompletedMs != null ? new Date(lastCompletedMs).toISOString() : null);

    const totalProdMs = startIso && endIso ? new Date(endIso).getTime() - new Date(startIso).getTime() : null;
    const totalProdLabel = totalProdMs != null && totalProdMs > 0 ? formatProductionDuration(totalProdMs) : '—';

    const startLabel = startIso ? new Date(startIso).toLocaleDateString('tr-TR') : '—';
    const endLabel = endIso ? new Date(endIso).toLocaleDateString('tr-TR') : '—';

    // Build anonymous segments from completion gaps (no labels).
    const times = tl.steps
        .map(s => (s.completedAt ? new Date(s.completedAt).getTime() : null))
        .filter((x): x is number => x != null)
        .sort((a, b) => a - b);
    const startMs = startIso ? new Date(startIso).getTime() : (times[0] ?? null);
    const endMs = times.length ? Math.max(...times) : null;
    const hasRange = !!startMs && !!endMs && endMs > startMs;
    const total = hasRange ? endMs! - startMs! : 0;
    const timeSlice = (times.length ? times : []).slice(0, 16);
    const segments = timeSlice.map((t, idx) => {
        const prev = idx === 0 ? (startMs ?? 0) : timeSlice[idx - 1]!;
        const dur = hasRange ? Math.max(0, t - prev) : 0;
        return { idx, dur, w: total > 0 ? (dur / total) * 100 : 0 };
    });
    const labelText = totalProdLabel === '—' ? 'Hesaplanamadı' : `${totalProdLabel}de üretildi`;

    return (
        <div className="prodTWrap">
            <div className="prodTHeader">
                <div className="prodTTitle">
                    <div className="prodTTitleMain">Üretim süresi</div>
                    <div className="prodTTitleSub">(teslimat hariç)</div>
                </div>

                <div className={`prodTChip ${totalProdLabel === '—' ? 'isMuted' : ''}`} title={labelText}>
                    <span className="prodTDot" />
                    <span className="prodTChipText">{labelText}</span>
                </div>
            </div>

            <div className="prodTBar" aria-label="Üretim timeline grafiği">
                <div className="prodTBarGlow" />
                <div className="prodTBarShimmer" />
                <div className="prodTBarSegments">
                    {(segments.length ? segments : Array.from({ length: 12 }, (_, idx) => ({ idx, dur: 0, w: 100 / 12 }))).map(seg => (
                        <div
                            key={seg.idx}
                            className="prodTSeg"
                            style={{
                                width: hasRange ? `${Math.max(0.5, seg.w)}%` : `${100 / 12}%`,
                                opacity: hasRange ? 0.22 + (seg.idx % 6) * 0.09 : 0.10,
                            }}
                        />
                    ))}
                </div>
                <div className="prodTMark start" />
                <div className="prodTMark end" />
                <div className="prodTTicks">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="prodTTick" style={{ left: `${(i + 1) * 20}%` }} />
                    ))}
                </div>
            </div>

            <div className="prodTFooter">
                <div className="prodTDate" title="Başlangıç">
                    {startLabel}
                </div>
                <div className="prodTDate" title="Bitiş">
                    {endLabel}
                </div>
            </div>

            <style jsx>{`
                .prodTWrap {
                    margin-top: 12px;
                    padding: 16px 16px 14px;
                    border-radius: 18px;
                    border: 1px solid rgba(2, 35, 71, 0.12);
                    background: radial-gradient(1200px 220px at 20% 0%, rgba(99, 102, 241, 0.10), transparent 60%),
                        radial-gradient(900px 260px at 90% 30%, rgba(16, 185, 129, 0.10), transparent 55%),
                        linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.65));
                    box-shadow: 0 18px 40px rgba(2, 35, 71, 0.14);
                    backdrop-filter: blur(10px);
                }
                .prodTHeader {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 12px;
                }
                .prodTTitleMain {
                    font-size: 12px;
                    font-weight: 900;
                    letter-spacing: 0.3px;
                    color: var(--foreground);
                }
                .prodTTitleSub {
                    font-size: 11px;
                    color: var(--muted);
                    margin-top: 2px;
                    font-weight: 650;
                }
                .prodTChip {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 12px;
                    border-radius: 9999px;
                    border: 1px solid rgba(2, 35, 71, 0.16);
                    background: linear-gradient(180deg, rgba(2, 35, 71, 0.16), rgba(2, 35, 71, 0.06));
                    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42), 0 10px 18px rgba(2, 35, 71, 0.10);
                }
                .prodTChip.isMuted {
                    opacity: 0.65;
                }
                .prodTDot {
                    width: 9px;
                    height: 9px;
                    border-radius: 9999px;
                    background: linear-gradient(180deg, rgba(16, 185, 129, 0.95), rgba(16, 185, 129, 0.55));
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.14);
                    flex-shrink: 0;
                }
                .prodTChip.isMuted .prodTDot {
                    background: rgba(148, 163, 184, 0.85);
                    box-shadow: none;
                }
                .prodTChipText {
                    font-size: 12px;
                    font-weight: 950;
                    letter-spacing: 0.15px;
                    color: var(--foreground);
                    white-space: nowrap;
                }

                .prodTBar {
                    position: relative;
                    height: 18px;
                    border-radius: 9999px;
                    overflow: hidden;
                    border: 1px solid rgba(2, 35, 71, 0.18);
                    background: linear-gradient(180deg, rgba(15, 23, 42, 0.10), rgba(15, 23, 42, 0.04));
                    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.60), inset 0 -12px 26px rgba(2, 35, 71, 0.10);
                }
                .prodTBarGlow {
                    position: absolute;
                    inset: -40px -60px;
                    background: radial-gradient(circle at 20% 60%, rgba(99, 102, 241, 0.22), transparent 55%),
                        radial-gradient(circle at 80% 30%, rgba(16, 185, 129, 0.18), transparent 60%);
                    pointer-events: none;
                }
                .prodTBarShimmer {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
                    transform: translateX(-120%);
                    animation: prodShimmer 2.6s ease-in-out infinite;
                    opacity: 0.55;
                    pointer-events: none;
                }
                @keyframes prodShimmer {
                    0% {
                        transform: translateX(-120%);
                    }
                    60% {
                        transform: translateX(120%);
                    }
                    100% {
                        transform: translateX(120%);
                    }
                }
                .prodTBarSegments {
                    position: absolute;
                    inset: 0;
                    display: flex;
                }
                .prodTSeg {
                    background: linear-gradient(180deg, rgba(2, 35, 71, 0.90), rgba(2, 35, 71, 0.18));
                    border-right: 1px solid rgba(255, 255, 255, 0.10);
                }
                .prodTMark {
                    position: absolute;
                    top: 50%;
                    width: 8px;
                    height: 8px;
                    border-radius: 9999px;
                    transform: translateY(-50%);
                    background: rgba(255, 255, 255, 0.95);
                    box-shadow: 0 0 0 2px rgba(2, 35, 71, 0.58), 0 10px 18px rgba(2, 35, 71, 0.16);
                }
                .prodTMark.start {
                    left: 10px;
                }
                .prodTMark.end {
                    right: 10px;
                }
                .prodTTicks {
                    position: absolute;
                    inset: 2px 10px;
                    pointer-events: none;
                }
                .prodTTick {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    width: 1px;
                    background: rgba(255, 255, 255, 0.16);
                }

                .prodTFooter {
                    margin-top: 10px;
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    align-items: center;
                }
                .prodTDate {
                    padding: 5px 10px;
                    border-radius: 9999px;
                    border: 1px solid rgba(2, 35, 71, 0.10);
                    background: rgba(255, 255, 255, 0.55);
                    color: var(--muted);
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.15px;
                }
            `}</style>
        </div>
    );
}

type ListSortBy =
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

/** Pozitif sayı = girilmiş imalat no; null, 0 ve boş string eksik sayılır (karttaki !imalatNo ile uyumlu). */
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
        t === '—' ||
        t === '–' ||
        /^[\s\-–—]+$/u.test(t)
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

/** Bağlı çift kartı — liste başlığıyla aynı mantıkta teknik özet (boş alanları doldurur) */
function formatDorseLinkedSpec(d: Dorse): { primary: string; secondary: string | null } {
    const thick = [d.kalinlik, d.malzemeCinsi, d.silindir]
        .map(x => (x == null ? '' : String(x).trim()))
        .filter(Boolean);
    const primary = thick.length > 0 ? thick.join(' · ') : 'Kalınlık / malzeme girilmemiş';
    const rest = [
        d.m3 ? `${String(d.m3).trim()} M³` : '',
        d.renk?.trim(),
        d.dingil?.trim(),
        d.lastik?.trim(),
    ].filter(Boolean);
    return { primary, secondary: rest.length ? rest.join(' · ') : null };
}

function formatSasiLinkedSpec(s: Sasi): { primary: string; secondary: string | null } {
    const no = normalizeSasiNoValue(s.sasiNo);
    const primary = no !== '' ? no : 'Şasi no girilmemiş';
    const rest = [s.dingil?.trim(), s.tampon?.trim()].filter((x): x is string => Boolean(x));
    if (rest.length > 0) return { primary, secondary: rest.join(' · ') };
    if (s.adet > 1) return { primary, secondary: `${s.adet} adet` };
    return { primary, secondary: null };
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

function UrunListesiContent() {
    const pathname = usePathname();
    /** useSearchParams Suspense ile takılmalara yol açabildiği için sorgu dizesi pathname ile senkron okunur. */
    const [urlSearch, setUrlSearch] = useState('');
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const sync = () => setUrlSearch(window.location.search);
        sync();
        window.addEventListener('popstate', sync);
        return () => window.removeEventListener('popstate', sync);
    }, [pathname]);
    const urlTypeParam = useMemo(() => new URLSearchParams(urlSearch).get('type'), [urlSearch]);
    const urlExpandParam = useMemo(() => new URLSearchParams(urlSearch).get('expand'), [urlSearch]);
    const [productType, setProductType] = useState<ProductType>('DAMPER');
    const productTypeRef = useRef(productType);
    productTypeRef.current = productType;
    const loadGenRef = useRef(0);
    const productSegTrackRef = useRef<HTMLDivElement>(null);
    const productSegActiveIndex = PRODUCT_SEG_ORDER.indexOf(productType);
    const productSegThumb = useAppleSegmentedThumb(
        productSegTrackRef,
        productSegActiveIndex >= 0 ? productSegActiveIndex : 0
    );
    const [stats, setStats] = useState<Stats | null>(null);
    const [dampers, setDampers] = useState<Damper[]>([]);
    const [dorses, setDorses] = useState<Dorse[]>([]);
    const [sasis, setSasis] = useState<Sasi[]>([]);
    const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
    const [staleHint, setStaleHint] = useState<StaleHint>(null);

    const COLORS = {
        primary: 'var(--primary)',
        secondary: 'var(--foreground-secondary)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--control-fill)',
        grid: 'var(--border)',
    };
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [sasiFilter, setSasiFilter] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<ListSortBy>(null);
    const [deliveryDraft, setDeliveryDraft] = useState<{
        kind: 'DAMPER' | 'DORSE';
        id: number;
        teslimSasiNo: string;
        teslimEden: string;
        teslimAlan: string;
        teslimNot: string;
    } | null>(null);
    const [deliveryEdit, setDeliveryEdit] = useState<
        | {
              kind: 'DAMPER';
              id: number;
              teslimSasiNo: string;
              teslimEden: string;
              teslimAlan: string;
              teslimAlanFirma: string;
              teslimNot: string;
          }
        | {
              kind: 'DORSE';
              id: number;
              teslimSasiNo: string;
              teslimEden: string;
              teslimAlan: string;
              teslimAracSahibi: string;
              teslimNot: string;
          }
        | null
    >(null);
    const [timelines, setTimelines] = useState<Record<string, TimelineState>>({});

    // Sasi Link Modal State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [activeDorseForLink, setActiveDorseForLink] = useState<Dorse | null>(null);
    const [linkFilter, setLinkFilter] = useState<'hepsi' | 'stok' | 'musteri'>('hepsi');
    const [linkSearchTerm, setLinkSearchTerm] = useState('');
    const [availableSasis, setAvailableSasis] = useState<Sasi[]>([]);
    const [, setLinkLoading] = useState(false);
    const { schedule: persistLater, flush: persistNow } = useDebouncedPersist();

    // Dorse ekleme formu için: şasi listesi (unlinked) doldur.
    useEffect(() => {
        if (!showAddModal) return;
        if (productType !== 'DORSE') return;
        void (async () => {
            try {
                const { getSasis } = await import('@/lib/api');
                const unlinkedSasis = await getSasis(true);
                setAvailableSasis(unlinkedSasis);
            } catch (e) {
                console.error('Sasi listesi alınamadı:', e);
                setAvailableSasis([]);
            }
        })();
    }, [showAddModal, productType]);

    useEffect(() => {
        getStaleProducts(14)
            .then((d) => {
                const total = d.dampers.length + d.dorses.length + d.sasis.length;
                setStaleHint(total > 0 ? { total, days: d.days } : null);
            })
            .catch(() => setStaleHint(null));
    }, []);

    useEffect(() => {
        if (!expandedId) return;
        if (productType !== 'DAMPER' && productType !== 'DORSE') return;
        const [t, idStr] = expandedId.split('-');
        const productId = Number(idStr);
        const analyticsKind: 'DAMPER' | 'DORSE' | null = t === 'DAMPER' || t === 'DORSE' ? t : null;
        if (!analyticsKind || !Number.isFinite(productId) || productId <= 0) return;

        const key = `${analyticsKind}-${productId}`;
        let shouldFetch = false;
        setTimelines(prev => {
            if (prev[key] !== undefined) return prev; // cached (including null)
            shouldFetch = true;
            return { ...prev, [key]: 'loading' };
        });
        if (!shouldFetch) return;

        void (async () => {
            try {
                const res = await getStepEvents(analyticsKind, productId);
                const byKey = new Map(res.events.map(e => [e.key, e.completedAt]));
                setTimelines(prev => ({
                    ...prev,
                    [key]: {
                        productType: analyticsKind,
                        productId,
                        createdAt: res.createdAt ?? null,
                        startedAt: res.productionStartedAt,
                        endedAt: res.productionEndAt ?? null,
                        steps: res.steps.map(s => ({
                            key: s.key,
                            label: s.label,
                            completedAt: byKey.get(s.key) ?? null
                        }))
                    }
                }));
            } catch (e) {
                console.error('step-events fetch failed', analyticsKind, productId, e);
                setTimelines(prev => ({ ...prev, [key]: null }));
            }
        })();
    }, [expandedId, productType]);

    // Prefetch timelines so "Tamamlanan" cards show instantly.
    // IMPORTANT: do not reference sortedDampers/sortedDorses here (they are defined later).
    useEffect(() => {
        if (productType !== 'DAMPER' && productType !== 'DORSE') return;
        if (statusFilter !== 'tamamlanan' && statusFilter !== 'teslimEdilen') return;

        const kind: 'DAMPER' | 'DORSE' = productType;
        const ids =
            kind === 'DAMPER'
                ? dampers
                      .filter(d => {
                          const st = getDamperStatus(d);
                          return st === statusFilter;
                      })
                      .map(d => d.id)
                : dorses
                      .filter(d => {
                          const st = getDorseStatus(d);
                          return st === statusFilter;
                      })
                      .map(d => d.id);

        // Prefetch only first N to protect UX.
        const targetIds = ids.slice(0, 60);
        if (targetIds.length === 0) return;

        let cancelled = false;

        const run = async () => {
            const queue = [...targetIds];
            const CONCURRENCY = 6;

            const worker = async () => {
                while (queue.length && !cancelled) {
                    const id = queue.shift()!;
                    const key = `${kind}-${id}`;

                    // skip if already fetched/cached
                    const existing = timelines[key];
                    if (existing !== undefined && existing !== 'loading') continue;

                    setTimelines(prev => (prev[key] === undefined ? { ...prev, [key]: 'loading' } : prev));
                    try {
                        const res = await getStepEvents(kind, id);
                        const byKey = new Map(res.events.map(e => [e.key, e.completedAt]));
                        if (cancelled) return;
                        setTimelines(prev => ({
                            ...prev,
                            [key]: {
                                productType: kind,
                                productId: id,
                                createdAt: res.createdAt ?? null,
                                startedAt: res.productionStartedAt,
                                endedAt: res.productionEndAt ?? null,
                                steps: res.steps.map(s => ({
                                    key: s.key,
                                    label: s.label,
                                    completedAt: byKey.get(s.key) ?? null
                                }))
                            }
                        }));
                    } catch (e) {
                        if (cancelled) return;
                        console.error('step-events prefetch failed', kind, id, e);
                        setTimelines(prev => ({ ...prev, [key]: null }));
                    }
                }
            };

            await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
        };

        void run();
        return () => {
            cancelled = true;
        };
        // timelines bilinçli dışarıda; içeride güncellenir, bağımlılığa eklenmez
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productType, statusFilter, dampers, dorses]);

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
        sasiId: '', // Added
        silindir: '', // Added
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
        silindir: '', // Added
        malzemeCinsi: '', // Added
        frenMarka: '',
        branda: false, // Added
        renk: '',
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

    useEffect(() => {
        if (loading) return;
        const t = urlTypeParam as ProductType | null;
        const exp = urlExpandParam;
        if (!exp || !t || !['DAMPER', 'DORSE', 'SASI'].includes(t)) return;
        const id = parseInt(exp, 10);
        if (Number.isNaN(id)) return;
        setProductType(t);
        setExpandedId(`${t}-${id}`);
        const tick = window.setTimeout(() => {
            document.getElementById(`urun-row-${t}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
        return () => window.clearTimeout(tick);
    }, [loading, urlTypeParam, urlExpandParam, dampers.length, dorses.length, sasis.length]);

    useEffect(() => {
        setSortBy(prev => {
            if (
                (productType === 'DAMPER' || productType === 'DORSE') &&
                (prev === 'sasiNo-desc' || prev === 'sasiNo-asc')
            ) {
                return null;
            }
            return prev;
        });
    }, [productType]);

    const loadData = useCallback(async () => {
        const gen = ++loadGenRef.current;
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
            if (gen !== loadGenRef.current) return;
            const pt = productTypeRef.current;
            if (pt === 'DAMPER') setStats(damperStats);
            else if (pt === 'DORSE' || pt === 'DORSE_SASI') setStats(dorseStats);
            else if (pt === 'SASI') setStats(sasiStats);

            setDampers(dampersData);
            setDorses(dorsesData);
            setSasis(sasisData);
            setDropdowns(dropdownsData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            if (gen === loadGenRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    // Refresh stats when product type changes
    useEffect(() => {
        async function updateStats() {
            if (productType === 'HEPSI' || productType === 'DORSE_SASI') return;
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
            dorse.frenProgrami, dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.aracKontrolBypassAyari,
            dorse.sonKontrol, dorse.tipOnay, dorse.fatura, dorse.tahsilat
        ];
        const completed = steps.filter(Boolean).length;
        // akmTseMuayenesi and dmoMuayenesi are excluded - they don't block completion
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
            dorse.frenProgrami, dorse.fren, dorse.dorseElektrik, dorse.tamamlama, dorse.aracKontrolBypassAyari,
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

    const handleUnlinkSasi = async (dorseId: number) => {
        if (!confirm('Şasi bağlantısını kaldırmak istediğinize emin misiniz?')) return;

        try {
            setLinkLoading(true);
            const { unlinkSasi } = await import('@/lib/api');
            const updatedDorse = await unlinkSasi(dorseId);
            setDorses(prev => prev.map(d => d.id === dorseId ? updatedDorse : d));
            loadData(); // Refresh stats and list
        } catch (error) {
            console.error('Error unlinking sasi:', error);
            alert('Şasi bağlantısı kaldırılırken hata oluştu');
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
                setExpandedId(`${type}-${id}`);
                setDeliveryDraft({
                    kind: 'DAMPER',
                    id,
                    teslimSasiNo: '',
                    teslimEden: '',
                    teslimAlan: '',
                    teslimNot: ''
                });
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
                setExpandedId(`${type}-${id}`);
                setDeliveryDraft({
                    kind: 'DORSE',
                    id,
                    teslimSasiNo: '',
                    teslimEden: '',
                    teslimAlan: '',
                    teslimNot: ''
                });
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
        } else {
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
        if (!temizNo) {
            alert('Şase no zorunludur. Yalnız A–Z ve 0–9 kullanılabilir.');
            return;
        }
        if (!deliveryDraft.teslimEden.trim()) {
            alert('Teslim eden zorunludur.');
            return;
        }
        if (!deliveryDraft.teslimAlan.trim()) {
            alert('Teslim alan zorunludur.');
            return;
        }
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
            const msg = e instanceof Error ? e.message : 'Teslim kaydedilemedi';
            alert(msg);
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
                    sasiId: '', // Added
                    silindir: '', // Added
                    renk: '',
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
                    m3: dorseFormData.m3 || null,
                    renk: dorseFormData.renk || null,
                    adet: quantity,
                    sasiId: dorseFormData.sasiId ? parseInt(dorseFormData.sasiId) : null,
                    silindir: dorseFormData.silindir || null, // Added
                    malzemeCinsi: dorseFormData.malzemeCinsi || null, // Added
                    frenMarka: dorseFormData.frenMarka || null,
                    branda: dorseFormData.branda, // Added
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
                    silindir: '', // Added
                    malzemeCinsi: '', // Added
                    frenMarka: '',
                    branda: false, // Added
                    renk: '',
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
            const t = searchTerm.trim();
            result = result.filter(
                d =>
                    trIncludes(d.musteri, t) ||
                    trIncludes(d.aracMarka, t) ||
                    trIncludes(d.model, t) ||
                    (d.imalatNo ?? '').toString().includes(t)
            );
        }

        if (statusFilter === 'eksikNumara') {
            result = result.filter(d => !hasDamperDorseImalatNo(d.imalatNo));
        } else if (statusFilter) {
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
                    case 'imalat-desc':
                        return compareImalatNoDesc(a.imalatNo, b.imalatNo);
                    case 'imalat-asc':
                        return compareImalatNoAsc(a.imalatNo, b.imalatNo);
                    default:
                        return 0;
                }
            });
        }

        return result;
    }, [dampers, statusFilter, sortBy, searchTerm]);

    // Filter and sort dorses
    const sortedDorses = useMemo(() => {
        let result = productType === 'DORSE_SASI' ? dorses.filter(d => d.sasi) : [...dorses];

        if (searchTerm) {
            const t = searchTerm.trim();
            result = result.filter(
                d =>
                    trIncludes(d.musteri, t) ||
                    (d.imalatNo ?? '').toString().includes(t) ||
                    trIncludes(d.sasi?.musteri, t) ||
                    trIncludes(d.sasi?.sasiNo, t) ||
                    (d.sasi?.imalatNo ?? '').toString().includes(t)
            );
        }

        if (statusFilter === 'eksikNumara') {
            result = result.filter(d => !hasDamperDorseImalatNo(d.imalatNo));
        } else if (statusFilter) {
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
                    case 'imalat-desc':
                        return compareImalatNoDesc(a.imalatNo, b.imalatNo);
                    case 'imalat-asc':
                        return compareImalatNoAsc(a.imalatNo, b.imalatNo);
                    default:
                        return 0;
                }
            });
        }

        return result;
    }, [dorses, productType, statusFilter, sortBy, searchTerm]);

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

        if (statusFilter === 'eksikNumara') {
            result = result.filter(s => !hasSasiNoWritten(s.sasiNo));
        } else if (statusFilter) {
            if (statusFilter === 'tamamlanan') {
                result = result.filter(s => getSasiStatus(s) === 'tamamlanan');
            } else if (statusFilter === 'devamEden') {
                result = result.filter(s => getSasiStatus(s) === 'devamEden');
            } else if (statusFilter === 'baslamayan') {
                result = result.filter(s => getSasiStatus(s) === 'baslamayan');
            } else if (statusFilter === 'bosStok') {
                result = result.filter(s => trStartsWithStok(s.musteri) && !s.isLinked);
            } else if (statusFilter === 'tamamlananStok') {
                result = result.filter(s => trStartsWithStok(s.musteri) && getSasiStatus(s) === 'tamamlanan');
            } else if (statusFilter === 'devamEdenStok') {
                result = result.filter(s => trStartsWithStok(s.musteri) && getSasiStatus(s) === 'devamEden');
            } else if (statusFilter === 'bosMusteri') {
                result = result.filter(s => !trStartsWithStok(s.musteri) && !s.isLinked);
            } else if (statusFilter === 'tamamlananMusteri') {
                result = result.filter(s => !trStartsWithStok(s.musteri) && getSasiStatus(s) === 'tamamlanan');
            } else if (statusFilter === 'devamEdenMusteri') {
                result = result.filter(s => !trStartsWithStok(s.musteri) && getSasiStatus(s) === 'devamEden');
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

    // Helper functions for status (defined here to be accessible in sortedAllProducts)



    // Filter and sort all products combined
    const sortedAllProducts = useMemo(() => {
        // Combine all products with a type identifier
        const allItems = [
            ...dampers.map(d => ({ ...d, _type: 'DAMPER' as const })),
            ...dorses.map(d => ({ ...d, _type: 'DORSE' as const })),
            ...sasis.map(d => ({ ...d, _type: 'SASI' as const }))
        ];

        let result = [...allItems];

        if (searchTerm) {
            const t = searchTerm.trim();
            result = result.filter(item => {
                if (item._type === 'DAMPER') {
                    const d = item as typeof dampers[0];
                    return (
                        trIncludes(d.musteri, t) ||
                        trIncludes(d.aracMarka, t) ||
                        trIncludes(d.model, t) ||
                        (d.imalatNo ?? '').toString().includes(t)
                    );
                } else if (item._type === 'DORSE') {
                    const d = item as typeof dorses[0];
                    return trIncludes(d.musteri, t) || (d.imalatNo ?? '').toString().includes(t);
                } else {
                    const s = item as typeof sasis[0];
                    return (
                        trIncludes(s.musteri, t) ||
                        trIncludes(s.sasiNo, t) ||
                        (s.imalatNo ?? '').toString().includes(t)
                    );
                }
            });
        }

        if (statusFilter === 'eksikNumara') {
            result = result.filter(item => {
                if (item._type === 'DAMPER') return !hasDamperDorseImalatNo((item as Damper).imalatNo);
                if (item._type === 'DORSE') return !hasDamperDorseImalatNo((item as Dorse).imalatNo);
                return !hasSasiNoWritten((item as Sasi).sasiNo);
            });
        } else if (statusFilter) {
            // General status filtering for combined list
            // Mapping statuses to common terms if needed, or using specific logic
            result = result.filter((item) => {
                let status: string;
                if (item._type === 'DAMPER') status = getDamperStatus(item);
                else if (item._type === 'DORSE') status = getDorseStatus(item);
                else status = getSasiStatus(item);

                if (statusFilter === 'tamamlanan') return status === 'tamamlanan';
                if (statusFilter === 'devamEden') return status === 'devamEden';
                if (statusFilter === 'baslamayan') return status === 'baslamayan';

                if (item._type === 'SASI') {
                    if (statusFilter === 'bosStok') {
                        return trStartsWithStok(item.musteri) && !item.isLinked;
                    } else if (statusFilter === 'tamamlananStok') {
                        return trStartsWithStok(item.musteri) && status === 'tamamlanan';
                    } else if (statusFilter === 'devamEdenStok') {
                        return trStartsWithStok(item.musteri) && status === 'devamEden';
                    } else if (statusFilter === 'bosMusteri') {
                        return !trStartsWithStok(item.musteri) && !item.isLinked;
                    } else if (statusFilter === 'tamamlananMusteri') {
                        return !trStartsWithStok(item.musteri) && status === 'tamamlanan';
                    } else if (statusFilter === 'devamEdenMusteri') {
                        return !trStartsWithStok(item.musteri) && status === 'devamEden';
                    }
                }

                return false;
            });
        }

        if (sortBy) {
            result.sort((a, b) => {
                // Progress can be handled generically
                const getProgress = (item: CombinedListItem) => {
                    if (item._type === 'DAMPER') return calculateProgress(item);
                    if (item._type === 'DORSE') return calculateDorseProgress(item);
                    return calculateSasiProgress(item);
                };

                const getName = (item: CombinedListItem) => item.musteri || '';
                const getDate = (item: CombinedListItem) => new Date(item.createdAt || 0).getTime();

                switch (sortBy) {
                    case 'progress-asc':
                        return getProgress(a) - getProgress(b);
                    case 'progress-desc':
                        return getProgress(b) - getProgress(a);
                    case 'name-asc':
                        return getName(a).localeCompare(getName(b), 'tr');
                    case 'name-desc':
                        return getName(b).localeCompare(getName(a), 'tr');
                    case 'date-asc':
                        return getDate(a) - getDate(b);
                    case 'date-desc':
                        return getDate(b) - getDate(a);
                    case 'imalat-desc': {
                        const key = (item: (typeof allItems)[number]) => {
                            if (item._type === 'DAMPER' || item._type === 'DORSE') {
                                return parseImalatNo((item as Damper | Dorse).imalatNo);
                            }
                            if (item._type === 'SASI') return parseImalatNo((item as Sasi).imalatNo);
                            return null;
                        };
                        const ka = key(a);
                        const kb = key(b);
                        if (ka != null && kb != null) return kb - ka;
                        if (ka != null) return -1;
                        if (kb != null) return 1;
                        return (a.id ?? 0) - (b.id ?? 0);
                    }
                    case 'imalat-asc': {
                        const key = (item: (typeof allItems)[number]) => {
                            if (item._type === 'DAMPER' || item._type === 'DORSE') {
                                return parseImalatNo((item as Damper | Dorse).imalatNo);
                            }
                            if (item._type === 'SASI') return parseImalatNo((item as Sasi).imalatNo);
                            return null;
                        };
                        const ka = key(a);
                        const kb = key(b);
                        if (ka != null && kb != null) return ka - kb;
                        if (ka != null) return -1;
                        if (kb != null) return 1;
                        return (a.id ?? 0) - (b.id ?? 0);
                    }
                    case 'sasiNo-desc': {
                        const key = (item: (typeof allItems)[number]) =>
                            item._type === 'SASI' ? normalizeSasiNoValue((item as Sasi).sasiNo) || null : null;
                        const sa = key(a);
                        const sb = key(b);
                        if (sa && sb) return sb.localeCompare(sa, 'tr', { numeric: true });
                        if (sa) return -1;
                        if (sb) return 1;
                        return (a.id ?? 0) - (b.id ?? 0);
                    }
                    case 'sasiNo-asc': {
                        const key = (item: (typeof allItems)[number]) =>
                            item._type === 'SASI' ? normalizeSasiNoValue((item as Sasi).sasiNo) || null : null;
                        const sa = key(a);
                        const sb = key(b);
                        if (sa && sb) return sa.localeCompare(sb, 'tr', { numeric: true });
                        if (sa) return -1;
                        if (sb) return 1;
                        return (a.id ?? 0) - (b.id ?? 0);
                    }
                    default:
                        return 0;
                }
            });
        }

        return result;
    }, [dampers, dorses, sasis, searchTerm, statusFilter, sortBy]);

    const eksikNumaraCount = useMemo(() => {
        if (productType === 'DAMPER') return dampers.filter(d => !hasDamperDorseImalatNo(d.imalatNo)).length;
        if (productType === 'DORSE') return dorses.filter(d => !hasDamperDorseImalatNo(d.imalatNo)).length;
        if (productType === 'SASI') return sasis.filter(s => !hasSasiNoWritten(s.sasiNo)).length;
        return (
            dampers.filter(d => !hasDamperDorseImalatNo(d.imalatNo)).length +
            dorses.filter(d => !hasDamperDorseImalatNo(d.imalatNo)).length +
            sasis.filter(s => !hasSasiNoWritten(s.sasiNo)).length
        );
    }, [productType, dampers, dorses, sasis]);

    const currentStats = useMemo(() => {
        // Yardımcı fonksiyonlar (Stats hesaplaması için)
        const getDamperStatus = (d: Damper) => {
            const p = calculateProgress(d);
            return p === 100 ? 'tamamlanan' : p === 0 ? 'baslamayan' : 'devamEden';
        };

        const damperStats = {
            total: dampers.length,
            tamamlanan: dampers.filter(d => getDamperStatus(d) === 'tamamlanan').length,
            teslimEdilen: dampers.filter(d => d.teslimat).length,
            devamEden: dampers.filter(d => getDamperStatus(d) === 'devamEden').length,
            baslamayan: dampers.filter(d => getDamperStatus(d) === 'baslamayan').length
        };

        const dorseStats = {
            total: dorses.length,
            tamamlanan: dorses.filter(d => getDorseStatus(d) === 'tamamlanan').length,
            teslimEdilen: dorses.filter(d => d.teslimat).length,
            devamEden: dorses.filter(d => getDorseStatus(d) === 'devamEden').length,
            baslamayan: dorses.filter(d => getDorseStatus(d) === 'baslamayan').length
        };

        const sasiStats = {
            total: sasis.length,
            tamamlanan: sasis.filter(s => getSasiStatus(s) === 'tamamlanan').length,
            teslimEdilen: 0,
            devamEden: sasis.filter(s => getSasiStatus(s) === 'devamEden').length,
            baslamayan: sasis.filter(s => getSasiStatus(s) === 'baslamayan').length
        };

        if (productType === 'DORSE_SASI') {
            return {
                total: sortedDorses.length,
                tamamlanan: sortedDorses.filter(d => calculateDorseProgress(d) === 100).length,
                teslimEdilen: sortedDorses.filter(d => d.teslimat).length,
                devamEden: sortedDorses.filter(d => {
                    const p = calculateDorseProgress(d);
                    return p > 0 && p < 100;
                }).length,
                baslamayan: sortedDorses.filter(d => calculateDorseProgress(d) === 0).length,
            };
        }

        if (productType === 'HEPSI') {
            return {
                total: damperStats.total + dorseStats.total + sasiStats.total,
                tamamlanan: damperStats.tamamlanan + dorseStats.tamamlanan + sasiStats.tamamlanan,
                teslimEdilen: damperStats.teslimEdilen + dorseStats.teslimEdilen,
                devamEden: damperStats.devamEden + dorseStats.devamEden + sasiStats.devamEden,
                baslamayan: damperStats.baslamayan + dorseStats.baslamayan + sasiStats.baslamayan
            };
        }

        if (productType === 'DAMPER') return stats;

        if (productType === 'SASI') return sasiStats;

        // Default: DORSE
        return dorseStats;
    }, [productType, stats, dorses, sasis, dampers, sortedDorses]);

    const handleExportExcel = async () => {
        if (productType === 'HEPSI' || productType === 'DORSE_SASI') {
            alert('Lütfen Excel çıktısı almak için belirli bir ürün grubu (Damper, Dorse veya Şasi) seçiniz.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ürün Listesi');

        // Header Styles
        const groupHeaderStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };

        const subHeaderStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, color: { argb: 'FF000000' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } } as ExcelJS.Fill, // Gray-300
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        };

        // --- EXPORT CONFIGURATION ---
        type ExcelBaseCol = { header: string; key: string; width: number };
        type ExcelStep = { key: string; label: string };
        type ExcelGroup = { key: string; name: string; subSteps: ExcelStep[] };

        let baseColumns: ExcelBaseCol[] = [];
        let stepGroups: ExcelGroup[] = [];
        let data: (Damper | Dorse | Sasi)[] = [];
        let inspectionKeys = { kurum: '', dmo: '' }; // Keys for inspection fields

        if (productType === 'DAMPER') {
            baseColumns = [
                { header: 'İMALAT NO', key: 'imalatNo', width: 12 },
                { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
                { header: 'ARAÇ GELDİ Mİ', key: 'aracGeldiMi', width: 15 },
                { header: 'MARKA', key: 'aracMarka', width: 15 },
                { header: 'MODEL', key: 'model', width: 15 },
                { header: 'TİP', key: 'tip', width: 20 },
                { header: 'MALZEME', key: 'malzemeCinsi', width: 15 },
                { header: 'M3', key: 'm3', width: 8 },
            ];
            stepGroups = STEP_GROUPS;
            data = sortedDampers;
            inspectionKeys = { kurum: 'kurumMuayenesi', dmo: 'dmoMuayenesi' };

        } else if (productType === 'DORSE') {
            baseColumns = [
                { header: 'İMALAT NO', key: 'imalatNo', width: 15 },
                { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
                { header: 'TARİH', key: 'createdAt', width: 15 },
                { header: 'ŞASİ NO', key: 'sasiNo', width: 20 },
                { header: 'ÇEKİCİ GELDİ Mİ', key: 'cekiciGeldiMi', width: 18 },
                { header: 'DİNGİL', key: 'dingil', width: 15 },
                { header: 'LASTİK', key: 'lastik', width: 15 },
                { header: 'TAMPON', key: 'tampon', width: 15 },
                { header: 'KALINLIK', key: 'kalinlik', width: 15 },
                { header: 'M3', key: 'm3', width: 10 },
            ];
            // Filter out inspection steps from Dorse groups to avoid duplication in "MUAYENE & TESLİMAT"
            stepGroups = DORSE_STEP_GROUPS.map(g => ({
                ...g,
                subSteps: g.subSteps.filter(s => !['akmTseMuayenesi', 'dmoMuayenesi', 'teslimat'].includes(s.key))
            }));
            data = sortedDorses;
            inspectionKeys = { kurum: 'akmTseMuayenesi', dmo: 'dmoMuayenesi' };

        } else if (productType === 'SASI') {
            baseColumns = [
                { header: 'İMALAT NO', key: 'imalatNo', width: 15 },
                { header: 'MÜŞTERİ', key: 'musteri', width: 25 },
                { header: 'ŞASİ NO', key: 'sasiNo', width: 20 },
                { header: 'TAMPON', key: 'tampon', width: 15 },
                { header: 'DİNGİL', key: 'dingil', width: 15 },
            ];
            stepGroups = SASI_STEP_GROUPS; // Sasi doesn't have inspections in groups usually
            data = sortedSasis;
            inspectionKeys = { kurum: '', dmo: '' }; // Sasi has no inspections
        }

        // --- PREPARE COLUMNS ---
        const excelColumns: Partial<ExcelJS.Column>[] = [...baseColumns];

        // Step Groups
        stepGroups.forEach(group => {
            group.subSteps.forEach((step: ExcelStep) => {
                excelColumns.push({ header: step.label, key: step.key, width: 18 });
            });
            // Summary Column
            excelColumns.push({ header: group.name, key: `${group.key}Summary`, width: 20 });
        });

        // "MUAYENE & TESLİMAT" Group
        if (productType !== 'SASI') {
            excelColumns.push({ header: 'KURUM MUAYENESİ', key: 'kurumMuayenesi', width: 20 });
            excelColumns.push({ header: 'DMO MUAYENESİ', key: 'dmoMuayenesi', width: 20 });
            excelColumns.push({ header: 'TESLİMAT', key: 'teslimat', width: 20 });
        }

        worksheet.columns = excelColumns;

        // --- HEADER ROW 1 & 2 VALUES ---
        const row1Values: string[] = [];
        const row2Values: string[] = [];

        baseColumns.forEach(col => {
            row1Values.push(col.header);
            row2Values.push(col.header);
        });

        stepGroups.forEach((group) => {
            row1Values.push(group.name);
            // Fill placeholders for merge
            // Correct logic for merge placeholders
            for (let i = 0; i < group.subSteps.length; i++) {
                row1Values.push(group.name);
            }

            group.subSteps.forEach((step: ExcelStep) => {
                row2Values.push(step.label);
            });
            row2Values.push('DURUM');
        });

        // Muayene Group
        if (productType !== 'SASI') {
            row1Values.push('MUAYENE & TESLİMAT');
            row1Values.push('MUAYENE & TESLİMAT');
            row1Values.push('MUAYENE & TESLİMAT');

            row2Values.push('KURUM MUAYENESİ');
            row2Values.push('DMO MUAYENESİ');
            row2Values.push('TESLİMAT');
        }

        const headerRow1 = worksheet.getRow(1);
        headerRow1.values = row1Values;
        worksheet.insertRow(2, row2Values);

        // --- MERGING & STYLING ---
        let currentCol = 1;

        // 1. Static Cols
        baseColumns.forEach(() => {
            worksheet.mergeCells(1, currentCol, 2, currentCol);
            const cell = worksheet.getCell(1, currentCol);
            cell.style = groupHeaderStyle;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
            currentCol++;
        });

        // 2. Step Groups
        stepGroups.forEach((group, idx) => {
            const startCol = currentCol;
            const endCol = startCol + group.subSteps.length; // subSteps + 1 summary

            worksheet.mergeCells(1, startCol, 1, endCol);

            const groupTitleCell = worksheet.getCell(1, startCol);
            groupTitleCell.value = group.name;

            // Alternating Colors
            const isEven = idx % 2 === 0;
            const bgColor = isEven ? 'FF1E3A8A' : 'FFFFFFFF';
            const fontColor = isEven ? 'FFFFFFFF' : 'FF000000';

            groupTitleCell.style = {
                font: { bold: true, color: { argb: fontColor }, size: 12 },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
                alignment: { horizontal: 'center', vertical: 'middle' },
                border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
            } as ExcelJS.Style;

            for (let c = startCol; c <= endCol; c++) {
                const cell = worksheet.getCell(2, c);
                cell.style = subHeaderStyle;
                // Summary sub-header
                if (c === endCol) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B5563' } };
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                }
            }
            currentCol = endCol + 1;
        });

        // 3. Muayene Group
        if (productType !== 'SASI') {
            const startCol = currentCol;
            const endCol = startCol + 2;
            worksheet.mergeCells(1, startCol, 1, endCol);

            const muayeneTitleCell = worksheet.getCell(1, startCol);
            muayeneTitleCell.value = 'MUAYENE & TESLİMAT';

            // Next color
            const nextIdx = stepGroups.length;
            const isEven = nextIdx % 2 === 0;
            const bgColor = isEven ? 'FF1E3A8A' : 'FFFFFFFF';
            const fontColor = isEven ? 'FFFFFFFF' : 'FF000000';

            muayeneTitleCell.style = {
                font: { bold: true, color: { argb: fontColor }, size: 12 },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
                alignment: { horizontal: 'center', vertical: 'middle' },
                border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
            } as ExcelJS.Style;

            for (let c = startCol; c <= endCol; c++) {
                const cell = worksheet.getCell(2, c);
                cell.style = subHeaderStyle;
            }
        }

        // --- DATA ROWS ---
        data.forEach(item => {
            const rowValues: unknown[] = [];
            const itemRec = item as unknown as Record<string, unknown>;

            // Base Info
            baseColumns.forEach(col => {
                let val: unknown = itemRec[col.key];

                // Special handling for Sasi No in Dorse (it might be in linked sasi object)
                if (col.key === 'sasiNo' && productType === 'DORSE') {
                    if (!val && (item as Dorse).sasi) {
                        const sasiObj = (item as Dorse).sasi!;
                        if (sasiObj.sasiNo) {
                            val = `${sasiObj.musteri} - ${sasiObj.sasiNo}`;
                        } else if (sasiObj.imalatNo) {
                            val = `${sasiObj.musteri} - #${sasiObj.imalatNo}`;
                        } else {
                            val = sasiObj.musteri;
                        }
                    }
                }

                if (['aracGeldiMi', 'cekiciGeldiMi'].includes(col.key)) val = val ? 'EVET' : 'HAYIR';
                if (col.key === 'createdAt' && val)
                    val = new Date(val as string | number | Date).toLocaleDateString('tr-TR');
                rowValues.push(val);
            });

            // Step Groups Status
            stepGroups.forEach(group => {
                let completedCount = 0;
                group.subSteps.forEach((step: ExcelStep) => {
                    const val = itemRec[step.key];
                    if (val) completedCount++;
                    rowValues.push(val);
                });

                const total = group.subSteps.length;
                let summary = '';
                if (completedCount === total) summary = 'TAMAMLANDI';
                else if (completedCount > 0) summary = 'DEVAM EDİYOR';
                else summary = 'BAŞLAMADI';

                rowValues.push(summary);
            });

            // Custom Group Data
            if (productType !== 'SASI') {
                const d = item as Damper | Dorse;
                // Kurum
                const kurumVal = inspectionKeys.kurum ? (itemRec[inspectionKeys.kurum] || 'YOK') : 'YOK';
                rowValues.push(kurumVal);
                // DMO
                const dmoVal = inspectionKeys.dmo ? (itemRec[inspectionKeys.dmo] || 'YOK') : 'YOK';
                rowValues.push(dmoVal);
                // Teslimat
                rowValues.push(d.teslimat);
            }

            const row = worksheet.addRow(rowValues);

            // --- CELL FORMATTING ---
            let cellIdx = baseColumns.length + 1;

            stepGroups.forEach(group => {
                // Sub Steps
                group.subSteps.forEach(() => {
                    const cell = row.getCell(cellIdx);
                    const val = cell.value;

                    if (val === true) {
                        cell.value = 'TAMAMLANDI';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
                        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
                    } else {
                        cell.value = 'BAŞLAMADI';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
                        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
                    }
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cellIdx++;
                });

                // Summary Cell
                const summaryCell = row.getCell(cellIdx);
                const summaryVal = summaryCell.value;
                summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
                summaryCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                summaryCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                if (summaryVal === 'TAMAMLANDI') {
                    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
                } else if (summaryVal === 'DEVAM EDİYOR') {
                    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF06B6D4' } }; // Cyan
                } else {
                    summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
                }
                cellIdx++;
            });

            // Muayene & Teslimat formatting
            if (productType !== 'SASI') {
                const kurumCell = row.getCell(cellIdx);
                if (['YAPILDI', 'VAR', 'EVET', 'TAMAMLANDI'].includes(kurumCell.value as string)) {
                    kurumCell.value = 'YAPILDI';
                    kurumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
                    kurumCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                } else {
                    kurumCell.value = 'YOK';
                    kurumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
                    kurumCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                }
                kurumCell.alignment = { horizontal: 'center', vertical: 'middle' };
                kurumCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cellIdx++;

                const dmoCell = row.getCell(cellIdx);
                if (['YAPILDI', 'VAR', 'EVET', 'TAMAMLANDI'].includes(dmoCell.value as string)) {
                    dmoCell.value = 'YAPILDI';
                    dmoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
                    dmoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                } else {
                    dmoCell.value = 'YOK';
                    dmoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
                    dmoCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                }
                dmoCell.alignment = { horizontal: 'center', vertical: 'middle' };
                dmoCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cellIdx++;

                const teslimatCell = row.getCell(cellIdx);
                if (teslimatCell.value === true || teslimatCell.value === 'TAMAMLANDI') {
                    teslimatCell.value = 'TAMAMLANDI';
                    teslimatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22C55E' } };
                    teslimatCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                } else {
                    teslimatCell.value = 'BAŞLAMADI';
                    teslimatCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } };
                    teslimatCell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                }
                teslimatCell.alignment = { horizontal: 'center', vertical: 'middle' };
                teslimatCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cellIdx++;
            }
        });

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${productType}_Listesi_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
    };

    if (loading) {
        return (
            <>
                <Sidebar />
                <main className="main-content apple-app-page">
                    <div className="apple-canvas">
                        <OzunluLoading variant="inline" />
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Sidebar />
            <main className="main-content apple-app-page urun-listesi-page">
                <div className="apple-canvas">
                <header className="header header--stack apple-page-hero">
                    <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
                        <div>
                            <h1 className="header-title">Ürün Listesi</h1>
                            <p className="header-subtitle">
                                {(productType === 'DAMPER'
                                    ? 'Damper'
                                    : productType === 'DORSE'
                                      ? 'Dorse'
                                      : productType === 'SASI'
                                        ? 'Şasi'
                                        : productType === 'DORSE_SASI'
                                          ? 'Dorse+Şasi'
                                          : 'Tüm')}{' '}
                                imalat süreçlerini görüntüleyin ve yönetin
                            </p>
                        </div>
                        <div className="header-toolbar">
                            <button type="button" className="btn btn-secondary btn--row" onClick={handleExportExcel}>
                                <FileSpreadsheet size={20} /> Excel&apos;e Aktar
                            </button>
                            {productType !== 'HEPSI' && productType !== 'DORSE_SASI' && (
                                <button type="button" className="btn btn-premium btn--row" onClick={() => setShowAddModal(true)}>
                                    <Plus size={20} /> Yeni{' '}
                                    {productType === 'DAMPER'
                                        ? 'Damper'
                                        : productType === 'DORSE'
                                          ? 'Dorse'
                                          : productType === 'SASI'
                                            ? 'Şasi'
                                            : 'Ürün'}{' '}
                                    Ekle
                                </button>
                            )}
                        </div>
                    </div>

                    {staleHint && (
                        <div className="apple-stale-reminder" role="status">
                            <p className="apple-stale-reminder__label">Hatırlatma</p>
                            <p className="apple-stale-reminder__body">
                                Üretimde olup son <span className="apple-stale-reminder__accent">{staleHint.days}</span> gündür
                                güncellenmeyen <strong className="apple-stale-reminder__num">{staleHint.total}</strong> kayıt var
                                (teslimat bekleyen / şasi montajı bitmemiş).
                            </p>
                        </div>
                    )}

                    {/* Product Toggle & Search */}
                    <div className="apple-toolbar-row">
                        <div
                            ref={productSegTrackRef}
                            className={`apple-segmented apple-segmented--wrap apple-segmented--slide${productSegThumb.ready ? ' is-thumb-ready' : ''}`}
                        >
                            <span
                                className="apple-segmented__thumb"
                                aria-hidden
                                style={{
                                    transform: `translate3d(${productSegThumb.x}px, ${productSegThumb.y}px, 0)`,
                                    width: Math.max(0, productSegThumb.w),
                                    height: Math.max(0, productSegThumb.h),
                                    opacity: productSegThumb.ready ? 1 : 0,
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
                                Şasiler
                            </button>
                            <button
                                type="button"
                                className={`apple-segmented-btn${productType === 'DORSE_SASI' ? ' is-active-brand' : ''}`}
                                onClick={() => setProductType('DORSE_SASI')}
                            >
                                Dorse+Şasi
                            </button>
                            <button
                                type="button"
                                className={`apple-segmented-btn${productType === 'HEPSI' ? ' is-active-brand' : ''}`}
                                onClick={() => setProductType('HEPSI')}
                            >
                                Tüm Ürünler
                            </button>
                        </div>

                        <div className="apple-search-box apple-search-box--md">
                            <Search size={18} className="apple-search-icon" />
                            <input
                                type="text"
                                placeholder={`${productType === 'DAMPER'
                                    ? 'Damper'
                                    : productType === 'DORSE'
                                      ? 'Dorse'
                                      : productType === 'SASI'
                                        ? 'Şasi'
                                        : productType === 'DORSE_SASI'
                                          ? 'Dorse+Şasi'
                                          : 'Tüm Ürünler'} Ara...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="apple-search-input-pill"
                            />
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                {/* Stats Grid */}
                {productType === 'SASI' ? (
                    <div className="flex flex-col md:flex-row flex-wrap gap-4 items-stretch mb-6">

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
                                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Toplam Şasi</div>
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

                        {/* 2. GENEL DURUM (Sağ) - 2 Kart */}
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
                                    <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Başlamayan</div>
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
                                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Boş Stok</div>
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
                                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Bitmiş Stok</div>
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

                        {/* 4. MÜŞTERİ ŞASİLER GRUBU - 3 Kart */}
                        <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', height: '20px' }}>MÜŞTERİ ŞASİLER</div>
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
                                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Boş Müşteri</div>
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
                                        <div className="stat-label" style={{ fontSize: '11px', color: 'var(--foreground-secondary)' }}>Bitmiş Müşteri</div>
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
                    <div className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
                                <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>
                                    Toplam{' '}
                                    {productType === 'DAMPER'
                                        ? 'Damper'
                                        : productType === 'DORSE_SASI'
                                          ? 'bağlı çift'
                                          : productType === 'DORSE'
                                            ? 'Dorse'
                                            : 'Ürün'}
                                </div>
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
                                <div className="stat-value" style={{ color: 'var(--foreground)', fontSize: '24px', fontWeight: 700 }}>{currentStats?.teslimEdilen ?? 0}</div>
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
                                <div className="stat-label" style={{ color: 'var(--foreground-secondary)', fontSize: '14px' }}>Başlamayan</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dampers List */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                            {statusFilter === 'tamamlanan' &&
                                `✅ Tamamlanan ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' || productType === 'DORSE_SASI' ? 'Dorseler' : 'Şasiler'}`}
                            {statusFilter === 'devamEden' &&
                                `🔄 Devam Eden ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' || productType === 'DORSE_SASI' ? 'Dorseler' : 'Şasiler'}`}
                            {statusFilter === 'baslamayan' &&
                                `⏸️ Başlamayan ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' || productType === 'DORSE_SASI' ? 'Dorseler' : 'Şasiler'}`}
                            {statusFilter === 'eksikNumara' &&
                                (productType === 'SASI'
                                    ? 'Şasi no girilmeyen şasiler'
                                    : productType === 'HEPSI'
                                      ? 'İmalat veya şasi no eksik kayıtlar'
                                      : `İmalat no girilmeyen ${productType === 'DAMPER' ? 'damperler' : 'dorseler'}`)}
                            {!statusFilter &&
                                `Tüm ${productType === 'DAMPER' ? 'Damperler' : productType === 'DORSE' || productType === 'DORSE_SASI' ? 'Dorseler' : 'Şasiler'}`}
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

                        {(productType === 'DAMPER' ||
                            productType === 'DORSE' ||
                            productType === 'SASI' ||
                            productType === 'HEPSI') && (
                            <button
                                type="button"
                                className={`btn btn-secondary`}
                                style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    background:
                                        sortBy === 'imalat-desc' || sortBy === 'imalat-asc' ? 'var(--primary)' : undefined,
                                    color:
                                        sortBy === 'imalat-desc' || sortBy === 'imalat-asc' ? 'white' : undefined
                                }}
                                onClick={() => {
                                    if (sortBy === 'imalat-desc') setSortBy('imalat-asc');
                                    else if (sortBy === 'imalat-asc') setSortBy(null);
                                    else setSortBy('imalat-desc');
                                }}
                                title="İmalat no: önce büyükten küçüğe, tekrar küçükten büyüğe; boş/0 olanlar her zaman sonda"
                            >
                                <Hash size={16} /> İmalat no{' '}
                                {sortBy === 'imalat-desc' ? '↓' : sortBy === 'imalat-asc' ? '↑' : ''}
                            </button>
                        )}

                        {(productType === 'SASI' || productType === 'HEPSI') && (
                            <button
                                type="button"
                                className={`btn btn-secondary`}
                                style={{
                                    fontSize: '12px',
                                    padding: '6px 12px',
                                    background:
                                        sortBy === 'sasiNo-desc' || sortBy === 'sasiNo-asc' ? 'var(--primary)' : undefined,
                                    color:
                                        sortBy === 'sasiNo-desc' || sortBy === 'sasiNo-asc' ? 'white' : undefined
                                }}
                                onClick={() => {
                                    if (sortBy === 'sasiNo-desc') setSortBy('sasiNo-asc');
                                    else if (sortBy === 'sasiNo-asc') setSortBy(null);
                                    else setSortBy('sasiNo-desc');
                                }}
                                title="Şasi no: önce büyükten küçüğe, tekrar küçükten büyüğe; boş olanlar sonda"
                            >
                                <Hash size={16} /> Şasi no{' '}
                                {sortBy === 'sasiNo-desc' ? '↓' : sortBy === 'sasiNo-asc' ? '↑' : ''}
                            </button>
                        )}

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
                                    ? 'Şasi numarası girilmemiş şasiler'
                                    : productType === 'HEPSI'
                                      ? 'Damper/dorsede imalat no, şaside şasi no eksik olanlar'
                                      : 'İmalat numarası girilmemiş kayıtlar'
                            }
                        >
                            {productType === 'SASI'
                                ? `Şasi no yok (${eksikNumaraCount})`
                                : productType === 'HEPSI'
                                  ? `İmalat/şasi no eksik (${eksikNumaraCount})`
                                  : `İmalat no eksik (${eksikNumaraCount})`}
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

                    {productType === 'HEPSI' ? (
                        sortedAllProducts.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Kriterlere uygun ürün bulunamadı
                            </div>
                        ) : (
                            sortedAllProducts.map((item) => {
                                if (item._type === 'DAMPER') {
                                    const damper = item as typeof dampers[0];
                                    const progress = calculateProgress(damper);
                                    const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                    const isExpanded = expandedId === `DAMPER-${damper.id}`;

                                    return (
                                        <div key={`DAMPER-${damper.id}`} id={`urun-row-DAMPER-${damper.id}`} className="damper-card">
                                            <div
                                                className="damper-card-header damper-card-header--apple"
                                                onClick={() => setExpandedId(isExpanded ? null : `DAMPER-${damper.id}`)}
                                            >
                                                <div className="apple-urun-row__imalat">#{damper.imalatNo}</div>
                                                <div className="apple-urun-row__musteri">{damper.musteri}</div>
                                                <div>
                                                    <span className="apple-urun-row__pill">{damper.tip}</span>
                                                </div>
                                                <div className="apple-urun-row__specs">
                                                    {damper.malzemeCinsi} | {damper.m3} M³{damper.renk ? ` | ${damper.renk}` : ''}
                                                </div>
                                                <div className="apple-urun-row__progress">
                                                    <div className="progress-bar progress-bar--compact">
                                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="apple-urun-row__pct">{progress}%</span>
                                                </div>
                                                <div className="apple-urun-row__badge">{getStatusBadge(overallStatus)}</div>
                                                <div className="apple-urun-row__trail">
                                                    <div
                                                        className={`apple-urun-row__dot ${damper.aracGeldiMi ? 'apple-urun-row__dot--ok' : 'apple-urun-row__dot--no'}`}
                                                        title={damper.aracGeldiMi ? 'Araç Geldi' : 'Araç Gelmedi'}
                                                    />
                                                    <span className={`apple-urun-row__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden>
                                                        ▼
                                                    </span>
                                                </div>
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
                                                            borderRadius: 'var(--radius-md)',
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
                                                                placeholder="İmalat No"
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

                                                        {/* Şasi No - Düzenlenebilir */}
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
                                                                    height: '34px',
                                                                    flexShrink: 0
                                                                }}
                                                                placeholder="Şasi No"
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

                                                        {/* Renk - İmalat / Şasi ile aynı satırda */}
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

                                                        {/* Araç markası — tam satır */}
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>ARAÇ MARKASI</div>
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
                                                                    title="Tarihi Düzenle"
                                                                    onChange={(e) => {
                                                                        if (!e.target.value) return;
                                                                        const iso = new Date(e.target.value).toISOString();
                                                                        setDampers(prev =>
                                                                            prev.map(d => (d.id === damper.id ? { ...d, createdAt: iso } : d))
                                                                        );
                                                                        void (async () => {
                                                                            const updated = await updateDamper(damper.id, { createdAt: iso });
                                                                            setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
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
                                                                        {damper.adet > 0 ? damper.adet : '–'}
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
                                                                    <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ARAÇ DURUMU</div>
                                                                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                        {damper.aracGeldiMi ? 'Araç Fabrikada' : 'Araç Gelmedi'}
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className={`step-toggle ${damper.aracGeldiMi ? 'active' : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleStepToggle(damper.id, 'aracGeldiMi', damper.aracGeldiMi, 'DAMPER');
                                                                    }}
                                                                    style={{ transform: 'scale(1.1)' }}
                                                                    title="Değiştirmek için tıklayın"
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
                                                                                            Bu siparişte branda yok; bu adım kullanılmıyor.
                                                                                        </div>
                                                                                    ) : null}
                                                                                </div>
                                                                                <div style={{ alignSelf: 'center', flexShrink: 0 }}>
                                                                                    <div
                                                                                        className={`step-toggle ${toggleOn ? 'active' : ''}`}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (isBrandaMontajiLocked) return;
                                                                                            handleStepToggle(damper.id, step.key, isCompleted, 'DAMPER');
                                                                                        }}
                                                                                        title={
                                                                                            isBrandaMontajiLocked
                                                                                                ? 'Branda yok — montaj takip edilmez'
                                                                                                : 'Değiştirmek için tıklayın'
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
                                                        <div className="step-group-title">MUAYENE & TESLİMAT</div>
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
                                                                            setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                                                                        })();
                                                                    }}
                                                                >
                                                                    {(dropdowns?.kurumMuayenesi ?? []).map(v => (
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
                                                                            setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                                                                        })();
                                                                    }}
                                                                >
                                                                    {(dropdowns?.dmoMuayenesi ?? []).map(v => (
                                                                        <option key={v} value={v}>{v}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="step-item">
                                                                <span className="step-item-label">Teslimat</span>
                                                                <div
                                                                    className={`step-toggle ${damper.teslimat ? 'active' : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleStepToggle(damper.id, 'teslimat', damper.teslimat, 'DAMPER');
                                                                    }}
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
                                                                borderRadius: '14px',
                                                                background: 'var(--card)',
                                                                border: '1px solid rgba(2, 35, 71, 0.10)',
                                                                boxShadow: '0 10px 24px rgba(2, 35, 71, 0.06)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                                <div style={{ fontWeight: 800, letterSpacing: '0.2px' }}>Teslim bilgileri</div>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Kaydetmek için “Teslim Et”</div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    Şase No
                                                                    <input
                                                                        value={deliveryDraft.teslimSasiNo}
                                                                        onChange={(e) =>
                                                                            setDeliveryDraft((p) =>
                                                                                p
                                                                                    ? {
                                                                                          ...p,
                                                                                          teslimSasiNo: e.target.value
                                                                                              .toLocaleUpperCase('tr-TR')
                                                                                              .replace(/[^A-Z0-9]/g, '')
                                                                                      }
                                                                                    : p
                                                                            )
                                                                        }
                                                                        className="input"
                                                                        placeholder="Örn: TRAX3077108"
                                                                        style={{ marginTop: '6px' }}
                                                                    />
                                                                </label>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    Teslim Eden
                                                                    <input
                                                                        value={deliveryDraft.teslimEden}
                                                                        onChange={(e) =>
                                                                            setDeliveryDraft((p) => (p ? { ...p, teslimEden: e.target.value } : p))
                                                                        }
                                                                        className="input"
                                                                        style={{ marginTop: '6px' }}
                                                                    />
                                                                </label>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    Teslim Alan
                                                                    <input
                                                                        value={deliveryDraft.teslimAlan}
                                                                        onChange={(e) =>
                                                                            setDeliveryDraft((p) => (p ? { ...p, teslimAlan: e.target.value } : p))
                                                                        }
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
                                                                    onChange={(e) =>
                                                                        setDeliveryDraft((p) => (p ? { ...p, teslimNot: e.target.value } : p))
                                                                    }
                                                                    className="input"
                                                                    style={{ marginTop: '6px', minHeight: '80px' }}
                                                                />
                                                            </label>
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                                                                <button className="btn btn-secondary" onClick={() => setDeliveryDraft(null)}>
                                                                    Vazgeç
                                                                </button>
                                                                <button className="btn btn-primary" onClick={() => void confirmDelivery()}>
                                                                    Teslim Et
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!deliveryDraft && damper.teslimat && (
                                                        <div
                                                            className="card"
                                                            style={{
                                                                marginTop: '16px',
                                                                padding: '16px',
                                                                borderRadius: '14px',
                                                                background: 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
                                                                border: '1px solid rgba(16, 185, 129, 0.22)',
                                                                boxShadow: '0 10px 24px rgba(2, 35, 71, 0.06)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: '10px' }}>
                                                                <div style={{ fontWeight: 800, letterSpacing: '0.2px' }}>Teslim edildi</div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                        {damper.teslimAt ? new Date(damper.teslimAt).toLocaleString('tr-TR') : ''}
                                                                    </div>
                                                                    <button
                                                                        className="btn btn-secondary"
                                                                        style={{ padding: '6px 10px', fontSize: 12 }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeliveryEdit({
                                                                                kind: 'DAMPER',
                                                                                id: damper.id,
                                                                                teslimSasiNo: damper.teslimSasiNo || '',
                                                                                teslimEden: damper.teslimEden || '',
                                                                                teslimAlan: damper.teslimAlan || '',
                                                                                teslimAlanFirma: damper.teslimAlanFirma || damper.musteri || '',
                                                                                teslimNot: damper.teslimNot || '',
                                                                            });
                                                                        }}
                                                                    >
                                                                        Düzenle
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {deliveryEdit?.kind === 'DAMPER' && deliveryEdit.id === damper.id ? (
                                                                <div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Şase No
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                                                                                value={deliveryEdit.teslimSasiNo}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => {
                                                                                    const next = e.target.value.toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
                                                                                    setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimSasiNo: next } : p));
                                                                                }}
                                                                            />
                                                                        </label>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Teslim Eden
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6 }}
                                                                                value={deliveryEdit.teslimEden}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimEden: e.target.value } : p))}
                                                                            />
                                                                        </label>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Teslim Alan
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6 }}
                                                                                value={deliveryEdit.teslimAlan}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimAlan: e.target.value } : p))}
                                                                            />
                                                                        </label>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Teslim Alan Firma
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6 }}
                                                                                value={deliveryEdit.teslimAlanFirma}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimAlanFirma: e.target.value } : p))}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                    <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: 12 }}>
                                                                        Not
                                                                        <textarea
                                                                            className="input"
                                                                            style={{ marginTop: 6, minHeight: 80 }}
                                                                            value={deliveryEdit.teslimNot}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimNot: e.target.value } : p))}
                                                                        />
                                                                    </label>
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                                                                        <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); setDeliveryEdit(null); }}>
                                                                            Vazgeç
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                const normalized = normalizeDeliverySasiNoClient(deliveryEdit.teslimSasiNo);
                                                                                if (!normalized) return alert('Şase no geçersiz. Yalnız A–Z ve 0–9 kullanılabilir.');
                                                                                const updated = await updateDamper(damper.id, {
                                                                                    teslimSasiNo: normalized,
                                                                                    teslimEden: deliveryEdit.teslimEden,
                                                                                    teslimAlan: deliveryEdit.teslimAlan,
                                                                                    teslimAlanFirma: deliveryEdit.teslimAlanFirma,
                                                                                    teslimNot: deliveryEdit.teslimNot || null,
                                                                                });
                                                                                setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                                                                                setDeliveryEdit(null);
                                                                            }}
                                                                        >
                                                                            Kaydet
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Şase No</div>
                                                                            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700 }}>
                                                                                {damper.teslimSasiNo || '—'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Eden</div>
                                                                            <div style={{ fontWeight: 600 }}>{damper.teslimEden || '—'}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Alan</div>
                                                                            <div style={{ fontWeight: 600 }}>{damper.teslimAlan || '—'}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Alan Firma</div>
                                                                            <div style={{ fontWeight: 600 }}>{damper.teslimAlanFirma || damper.musteri || '—'}</div>
                                                                        </div>
                                                                    </div>
                                                                    {damper.teslimNot ? (
                                                                        <div style={{ marginTop: 12 }}>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Not</div>
                                                                            <div style={{ color: 'var(--foreground)' }}>{damper.teslimNot}</div>
                                                                        </div>
                                                                    ) : null}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Timeline intentionally hidden in HEPSI view */}

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
                                } else if (item._type === 'SASI') {
                                    const sasi = item as typeof sasis[0];
                                    const progress = calculateSasiProgress(sasi);
                                    let overallStatus = getSasiStatus(sasi);
                                    overallStatus = overallStatus === 'tamamlanan' ? 'TAMAMLANDI' : overallStatus === 'baslamayan' ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                    const isExpanded = expandedId === `SASI-${sasi.id}`;

                                    return (
                                        <div key={`SASI-${sasi.id}`} id={`urun-row-SASI-${sasi.id}`} className="damper-card">
                                            {/* Header */}
                                            <div
                                                className="damper-card-header damper-card-header--apple"
                                                onClick={() => setExpandedId(isExpanded ? null : `SASI-${sasi.id}`)}
                                            >
                                                <div className="apple-urun-row__imalat">#{sasi.imalatNo}</div>
                                                <div className="apple-urun-row__musteri">{sasi.musteri}</div>
                                                <div>
                                                    <span className="apple-urun-row__pill">{sasi.tampon || '-'}</span>
                                                </div>
                                                <div className="apple-urun-row__specs">
                                                    {formatSasiNoLabel(sasi.sasiNo)} | {sasi.dingil || '-'}
                                                </div>
                                                <div className="apple-urun-row__progress">
                                                    <div className="progress-bar progress-bar--compact">
                                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="apple-urun-row__pct">{progress}%</span>
                                                </div>
                                                <div className="apple-urun-row__badge">{getStatusBadge(overallStatus)}</div>
                                                <div className="apple-urun-row__trail">
                                                    <span className={`apple-urun-row__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden>
                                                        ▼
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Body */}
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
                                                    {/* Info Cards */}
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                        gap: '12px',
                                                        marginBottom: '20px',
                                                        paddingBottom: '20px',
                                                        borderBottom: '1px solid var(--border)'
                                                    }}>

                                                        {/* İMALAT NO */}
                                                        <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: !hasDamperDorseImalatNo(sasi.imalatNo) ? '2px solid var(--warning)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
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
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        </div>

                                                        {/* ŞASİ NO */}
                                                        <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: !hasSasiNoWritten(sasi.sasiNo) ? '2px solid var(--warning)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ŞASİ NO</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 500, color: hasSasiNoWritten(sasi.sasiNo) ? 'var(--foreground)' : 'var(--warning)' }}>{hasSasiNoWritten(sasi.sasiNo) ? normalizeSasiNoValue(sasi.sasiNo) : 'Girilmedi'}</div>
                                                            </div>
                                                            <input
                                                                type="text"
                                                                autoComplete="off"
                                                                className="input"
                                                                style={{ width: '140px', padding: '4px', fontSize: '13px', flexShrink: 0 }}
                                                                placeholder="Şasi no"
                                                                value={sasi.sasiNo ?? ''}
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
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        </div>


                                                        {/* MÜŞTERİ (Editable) */}
                                                        <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>MÜŞTERİ / İSİM</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>{sasi.musteri}</div>
                                                            </div>
                                                            <input type="text" className="input" style={{ width: '120px', padding: '4px', fontSize: '13px' }} value={sasi.musteri || ''} onChange={(e) => {
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
                                                            }} onBlur={() => void persistNow(`sasi-${sasi.id}-musteri`)} onClick={e => e.stopPropagation()} placeholder="İsim Giriniz" />
                                                        </div>

                                                        {/* TAMPON */}
                                                        <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TAMPON</div>
                                                            <select className="select" style={{ width: '100%', padding: '4px', fontSize: '13px', background: 'var(--card-bg-secondary)', border: 'none', color: 'var(--foreground)' }} value={sasi.tampon || ''} onChange={(e) => {
                                                                const v = e.target.value;
                                                                void (async () => {
                                                                    const updated = await updateSasi(sasi.id, { tampon: v });
                                                                    setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                                                                })();
                                                            }} onClick={e => e.stopPropagation()}>
                                                                <option style={{ color: 'black' }} value="">Seçiniz</option>
                                                                <option style={{ color: 'black' }} value="Kırma Tampon">KIRMA</option>
                                                                <option style={{ color: 'black' }} value="Sabit Tampon">SABİT</option>
                                                            </select>
                                                        </div>

                                                        {/* DINGIL */}
                                                        <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>DİNGİL</div>
                                                            <select className="select" style={{ width: '100%', padding: '4px', fontSize: '13px', background: 'var(--card-bg-secondary)', border: 'none', color: 'var(--foreground)' }} value={sasi.dingil || ''} onChange={(e) => {
                                                                const v = e.target.value;
                                                                void (async () => {
                                                                    const updated = await updateSasi(sasi.id, { dingil: v });
                                                                    setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                                                                })();
                                                            }} onClick={e => e.stopPropagation()}>
                                                                <option style={{ color: 'black' }} value="">Seçiniz</option>
                                                                <option style={{ color: 'black' }} value="TRAX">TRAX</option>
                                                                <option style={{ color: 'black' }} value="BPW">BPW</option>
                                                            </select>
                                                        </div>

                                                        {/* TARİH */}
                                                        <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TARİH</div>
                                                                <div style={{ fontSize: '13px' }}>{sasi.createdAt ? new Date(sasi.createdAt).toLocaleDateString() : '-'}</div>
                                                            </div>
                                                            <input type="date" className="input" style={{ width: '110px', padding: '4px', fontSize: '12px' }} onChange={(e) => {
                                                                if (!e.target.value) return;
                                                                const iso = new Date(e.target.value).toISOString();
                                                                setSasis(prev =>
                                                                    prev.map(s => (s.id === sasi.id ? { ...s, createdAt: iso } : s))
                                                                );
                                                                void (async () => {
                                                                    const updated = await updateSasi(sasi.id, { createdAt: iso });
                                                                    setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                                                                })();
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
                                } else {
                                    const dorse = item as typeof dorses[0];
                                    const progress = calculateDorseProgress(dorse);
                                    const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                    const isExpanded = expandedId === `DORSE-${dorse.id}`;

                                    return (
                                        <div key={`DORSE-${dorse.id}`} id={`urun-row-DORSE-${dorse.id}`} className="damper-card">
                                            <div
                                                className="damper-card-header damper-card-header--apple"
                                                onClick={() => setExpandedId(isExpanded ? null : `DORSE-${dorse.id}`)}
                                            >
                                                <div className="apple-urun-row__imalat">#{dorse.imalatNo}</div>
                                                <div className="apple-urun-row__musteri">{dorse.musteri}</div>
                                                <div>
                                                    <span className="apple-urun-row__pill">{dorse.kalinlik}</span>
                                                </div>
                                                <div className="apple-urun-row__specs">
                                                    {dorse.dingil} | {dorse.m3} M³{dorse.renk ? ` | ${dorse.renk}` : ''}
                                                </div>
                                                <div className="apple-urun-row__progress">
                                                    <div className="progress-bar progress-bar--compact">
                                                        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                    </div>
                                                    <span className="apple-urun-row__pct">{progress}%</span>
                                                </div>
                                                <div className="apple-urun-row__badge">{getStatusBadge(overallStatus)}</div>
                                                <div className="apple-urun-row__trail">
                                                    <div
                                                        className={`apple-urun-row__dot ${dorse.cekiciGeldiMi ? 'apple-urun-row__dot--ok' : 'apple-urun-row__dot--no'}`}
                                                        title={dorse.cekiciGeldiMi ? 'Çekici Geldi' : 'Çekici Gelmedi'}
                                                    />
                                                    <span className={`apple-urun-row__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden>
                                                        ▼
                                                    </span>
                                                </div>
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
                                                        {/* İmalat No */}
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
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
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
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>SİLİNDİR</div>
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
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>MALZEME CİNSİ</div>
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
                                                                        setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
                                                                    })();
                                                                }}
                                                            >
                                                                <option value="">Seçiniz</option>
                                                                {(dropdowns?.malzemeCinsi ?? []).map(m => (
                                                                    <option key={m} value={m}>{m}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Kalınlık */}
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
                                                                placeholder="Kalınlık"
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
                                                                <option value="">Seçiniz</option>
                                                                {(dropdowns?.dorseFren ?? ['Wabco', 'Knorr']).map((f) => (
                                                                    <option key={f} value={f}>{f}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {/* Şasi Bağlantısı */}
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
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button
                                                                    className="btn btn-primary"
                                                                    onClick={(e) => { e.stopPropagation(); openLinkModal(dorse); }}
                                                                    style={{ fontSize: '13px', padding: '8px 16px' }}
                                                                >
                                                                    {dorse.sasi ? <><LinkIcon size={14} /> Şasiyi Değiştir</> : <><LinkIcon size={14} /> Şasi Bağla</>}
                                                                </button>
                                                                {dorse.sasi && (
                                                                    <button
                                                                        className="btn btn-danger"
                                                                        onClick={(e) => { e.stopPropagation(); handleUnlinkSasi(dorse.id); }}
                                                                        style={{ fontSize: '13px', padding: '8px 16px' }}
                                                                    >
                                                                        <X size={14} /> Şasiyi Kaldır
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Çekici Durumu */}
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
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ÇEKİCİ DURUMU</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                    {dorse.cekiciGeldiMi ? 'Çekici Geldi' : 'Çekici Gelmedi'}
                                                                </div>
                                                            </div>
                                                            <div
                                                                className={`step-toggle ${dorse.cekiciGeldiMi ? 'active' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStepToggle(dorse.id, 'cekiciGeldiMi', dorse.cekiciGeldiMi, 'DORSE');
                                                                }}
                                                                style={{ transform: 'scale(1.1)' }}
                                                                title="Değiştirmek için tıklayın"
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
                                                                    {dorse.adet > 0 ? dorse.adet : '–'}
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

                                                        {/* Renk */}
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
                                                                onChange={(e) => {
                                                                    if (!e.target.value) return;
                                                                    const iso = new Date(e.target.value).toISOString();
                                                                    setDorses(prev =>
                                                                        prev.map(d => (d.id === dorse.id ? { ...d, createdAt: iso } : d))
                                                                    );
                                                                    void (async () => {
                                                                        const updated = await updateDorse(dorse.id, { createdAt: iso });
                                                                        setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
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
                                                                                        onChange={(e) => {
                                                                                            const v = e.target.value;
                                                                                            void (async () => {
                                                                                                const updated = await updateDorse(dorse.id, { [step.key]: v });
                                                                                                setDorses(prev =>
                                                                                                    applyServerRowIfFieldMatches(prev, dorse.id, step.key as keyof Dorse, v, updated)
                                                                                                );
                                                                                            })();
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
                                                                                            Bu siparişte branda yok; bu adım kullanılmıyor.
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
                                                                                                ? 'Branda yok — montaj takip edilmez'
                                                                                                : 'Değiştirmek için tıklayın'
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

                                                    {/* Timeline intentionally hidden in HEPSI view */}

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
                                }
                            })
                        )
                    ) : productType === 'DAMPER' ? (
                        sortedDampers.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Bu kategoride damper bulunamadı
                            </div>
                        ) : (
                            sortedDampers.map((damper) => {
                                const progress = calculateProgress(damper);
                                const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                const isExpanded = expandedId === `DAMPER-${damper.id}`;

                                return (
                                    <div key={damper.id} id={`urun-row-DAMPER-${damper.id}`} className="damper-card">
                                        <div
                                            className="damper-card-header damper-card-header--apple"
                                            onClick={() => setExpandedId(isExpanded ? null : `DAMPER-${damper.id}`)}
                                        >
                                            <div className="apple-urun-row__imalat">#{damper.imalatNo}</div>
                                            <div className="apple-urun-row__musteri">{damper.musteri}</div>
                                            <div>
                                                <span className="apple-urun-row__pill">{damper.tip}</span>
                                            </div>
                                            <div className="apple-urun-row__specs">
                                                {damper.malzemeCinsi} | {damper.m3} M³{damper.renk ? ` | ${damper.renk}` : ''}
                                            </div>
                                            <div className="apple-urun-row__progress">
                                                <div className="progress-bar progress-bar--compact">
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                                <span className="apple-urun-row__pct">{progress}%</span>
                                            </div>
                                            <div className="apple-urun-row__badge">{getStatusBadge(overallStatus)}</div>
                                            <div className="apple-urun-row__trail">
                                                <div
                                                    className={`apple-urun-row__dot ${damper.aracGeldiMi ? 'apple-urun-row__dot--ok' : 'apple-urun-row__dot--no'}`}
                                                    title={damper.aracGeldiMi ? 'Araç Geldi' : 'Araç Gelmedi'}
                                                />
                                                <span className={`apple-urun-row__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden>
                                                    ▼
                                                </span>
                                            </div>
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
                                                        borderRadius: 'var(--radius-md)',
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
                                                            placeholder="İmalat No"
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

                                                    {/* Şasi No - Düzenlenebilir */}
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
                                                                height: '34px',
                                                                flexShrink: 0
                                                            }}
                                                            placeholder="Şasi No"
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

                                                    {/* Renk - İmalat / Şasi ile aynı satırda */}
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

                                                    {/* Araç markası — tam satır */}
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
                                                        <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>ARAÇ MARKASI</div>
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
                                                                title="Tarihi Düzenle"
                                                                onChange={(e) => {
                                                                    if (!e.target.value) return;
                                                                    const iso = new Date(e.target.value).toISOString();
                                                                    setDampers(prev =>
                                                                        prev.map(d => (d.id === damper.id ? { ...d, createdAt: iso } : d))
                                                                    );
                                                                    void (async () => {
                                                                        const updated = await updateDamper(damper.id, { createdAt: iso });
                                                                        setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
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
                                                                    {damper.adet > 0 ? damper.adet : '–'}
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
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ARAÇ DURUMU</div>
                                                                <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                    {damper.aracGeldiMi ? 'Araç Fabrikada' : 'Araç Gelmedi'}
                                                                </div>
                                                            </div>
                                                            <div
                                                                className={`step-toggle ${damper.aracGeldiMi ? 'active' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStepToggle(damper.id, 'aracGeldiMi', damper.aracGeldiMi, 'DAMPER');
                                                                }}
                                                                style={{ transform: 'scale(1.1)' }}
                                                                title="Değiştirmek için tıklayın"
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
                                                                                        Bu siparişte branda yok; bu adım kullanılmıyor.
                                                                                    </div>
                                                                                ) : null}
                                                                            </div>
                                                                            <div style={{ alignSelf: 'center', flexShrink: 0 }}>
                                                                                <div
                                                                                    className={`step-toggle ${toggleOn ? 'active' : ''}`}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (isBrandaMontajiLocked) return;
                                                                                        handleStepToggle(damper.id, step.key, isCompleted, 'DAMPER');
                                                                                    }}
                                                                                    title={
                                                                                        isBrandaMontajiLocked
                                                                                            ? 'Branda yok — montaj takip edilmez'
                                                                                            : 'Değiştirmek için tıklayın'
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
                                                    <div className="step-group-title">MUAYENE & TESLİMAT</div>
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
                                                                        setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                                                                    })();
                                                                }}
                                                            >
                                                                {(dropdowns?.kurumMuayenesi ?? []).map(v => (
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
                                                                        setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                                                                    })();
                                                                }}
                                                            >
                                                                {(dropdowns?.dmoMuayenesi ?? []).map(v => (
                                                                    <option key={v} value={v}>{v}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="step-item">
                                                            <span className="step-item-label">Teslimat</span>
                                                            <div
                                                                className={`step-toggle ${damper.teslimat ? 'active' : ''}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStepToggle(damper.id, 'teslimat', damper.teslimat, 'DAMPER');
                                                                }}
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
                                                                borderRadius: '14px',
                                                                background: 'var(--card)',
                                                                border: '1px solid rgba(2, 35, 71, 0.10)',
                                                                boxShadow: '0 10px 24px rgba(2, 35, 71, 0.06)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                                <div style={{ fontWeight: 800, letterSpacing: '0.2px' }}>Teslim bilgileri</div>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Kaydetmek için “Teslim Et”</div>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    Şase No
                                                                    <input
                                                                        value={deliveryDraft.teslimSasiNo}
                                                                        onChange={(e) =>
                                                                            setDeliveryDraft((p) =>
                                                                                p
                                                                                    ? {
                                                                                          ...p,
                                                                                          teslimSasiNo: e.target.value
                                                                                              .toLocaleUpperCase('tr-TR')
                                                                                              .replace(/[^A-Z0-9]/g, '')
                                                                                      }
                                                                                    : p
                                                                            )
                                                                        }
                                                                        className="input"
                                                                        placeholder="Örn: TRAX3077108"
                                                                        style={{ marginTop: '6px' }}
                                                                    />
                                                                </label>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    Teslim Eden
                                                                    <input
                                                                        value={deliveryDraft.teslimEden}
                                                                        onChange={(e) =>
                                                                            setDeliveryDraft((p) => (p ? { ...p, teslimEden: e.target.value } : p))
                                                                        }
                                                                        className="input"
                                                                        style={{ marginTop: '6px' }}
                                                                    />
                                                                </label>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    Teslim Alan
                                                                    <input
                                                                        value={deliveryDraft.teslimAlan}
                                                                        onChange={(e) =>
                                                                            setDeliveryDraft((p) => (p ? { ...p, teslimAlan: e.target.value } : p))
                                                                        }
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
                                                                    onChange={(e) =>
                                                                        setDeliveryDraft((p) => (p ? { ...p, teslimNot: e.target.value } : p))
                                                                    }
                                                                    className="input"
                                                                    style={{ marginTop: '6px', minHeight: '80px' }}
                                                                />
                                                            </label>
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                                                                <button className="btn btn-secondary" onClick={() => setDeliveryDraft(null)}>
                                                                    Vazgeç
                                                                </button>
                                                                <button className="btn btn-primary" onClick={() => void confirmDelivery()}>
                                                                    Teslim Et
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!deliveryDraft && damper.teslimat && (
                                                        <div
                                                            className="card"
                                                            style={{
                                                                marginTop: '16px',
                                                                padding: '16px',
                                                                borderRadius: '14px',
                                                                background: 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
                                                                border: '1px solid rgba(16, 185, 129, 0.22)',
                                                                boxShadow: '0 10px 24px rgba(2, 35, 71, 0.06)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: '10px' }}>
                                                                <div style={{ fontWeight: 800, letterSpacing: '0.2px' }}>Teslim edildi</div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                        {damper.teslimAt ? new Date(damper.teslimAt).toLocaleString('tr-TR') : ''}
                                                                    </div>
                                                                    <button
                                                                        className="btn btn-secondary"
                                                                        style={{ padding: '6px 10px', fontSize: 12 }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDeliveryEdit({
                                                                                kind: 'DAMPER',
                                                                                id: damper.id,
                                                                                teslimSasiNo: damper.teslimSasiNo || '',
                                                                                teslimEden: damper.teslimEden || '',
                                                                                teslimAlan: damper.teslimAlan || '',
                                                                                teslimAlanFirma: damper.teslimAlanFirma || damper.musteri || '',
                                                                                teslimNot: damper.teslimNot || '',
                                                                            });
                                                                        }}
                                                                    >
                                                                        Düzenle
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {deliveryEdit?.kind === 'DAMPER' && deliveryEdit.id === damper.id ? (
                                                                <div>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Şase No
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                                                                                value={deliveryEdit.teslimSasiNo}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => {
                                                                                    const next = e.target.value.toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
                                                                                    setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimSasiNo: next } : p));
                                                                                }}
                                                                            />
                                                                        </label>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Teslim Eden
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6 }}
                                                                                value={deliveryEdit.teslimEden}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimEden: e.target.value } : p))}
                                                                            />
                                                                        </label>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Teslim Alan
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6 }}
                                                                                value={deliveryEdit.teslimAlan}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimAlan: e.target.value } : p))}
                                                                            />
                                                                        </label>
                                                                        <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                            Teslim Alan Firma
                                                                            <input
                                                                                className="input"
                                                                                style={{ marginTop: 6 }}
                                                                                value={deliveryEdit.teslimAlanFirma}
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimAlanFirma: e.target.value } : p))}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                    <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: 12 }}>
                                                                        Not
                                                                        <textarea
                                                                            className="input"
                                                                            style={{ marginTop: 6, minHeight: 80 }}
                                                                            value={deliveryEdit.teslimNot}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DAMPER' ? { ...p, teslimNot: e.target.value } : p))}
                                                                        />
                                                                    </label>
                                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                                                                        <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); setDeliveryEdit(null); }}>
                                                                            Vazgeç
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-primary"
                                                                            onClick={async (e) => {
                                                                                e.stopPropagation();
                                                                                const normalized = normalizeDeliverySasiNoClient(deliveryEdit.teslimSasiNo);
                                                                                if (!normalized) return alert('Şase no geçersiz. Yalnız A–Z ve 0–9 kullanılabilir.');
                                                                                const updated = await updateDamper(damper.id, {
                                                                                    teslimSasiNo: normalized,
                                                                                    teslimEden: deliveryEdit.teslimEden,
                                                                                    teslimAlan: deliveryEdit.teslimAlan,
                                                                                    teslimAlanFirma: deliveryEdit.teslimAlanFirma,
                                                                                    teslimNot: deliveryEdit.teslimNot || null,
                                                                                });
                                                                                setDampers(prev => prev.map(d => (d.id === damper.id ? updated : d)));
                                                                                setDeliveryEdit(null);
                                                                            }}
                                                                        >
                                                                            Kaydet
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Şase No</div>
                                                                            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700 }}>
                                                                                {damper.teslimSasiNo || '—'}
                                                                            </div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Eden</div>
                                                                            <div style={{ fontWeight: 600 }}>{damper.teslimEden || '—'}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Alan</div>
                                                                            <div style={{ fontWeight: 600 }}>{damper.teslimAlan || '—'}</div>
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Alan Firma</div>
                                                                            <div style={{ fontWeight: 600 }}>{damper.teslimAlanFirma || damper.musteri || '—'}</div>
                                                                        </div>
                                                                    </div>
                                                                    {damper.teslimNot ? (
                                                                        <div style={{ marginTop: 12 }}>
                                                                            <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Not</div>
                                                                            <div style={{ color: 'var(--foreground)' }}>{damper.teslimNot}</div>
                                                                        </div>
                                                                    ) : null}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {productType === 'DAMPER' &&
                                                    (getDamperStatus(damper) === 'tamamlanan' || getDamperStatus(damper) === 'teslimEdilen') ? (
                                                        (() => {
                                                            const tl = timelines[`DAMPER-${damper.id}`];
                                                            if (tl === 'loading') {
                                                                return (
                                                                    <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                                                                        Üretim süresi hazırlanıyor…
                                                                    </div>
                                                                );
                                                            }
                                                            if (tl) return <TimelineMini tl={tl} />;
                                                            return (
                                                                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                                                                    Üretim süresi verisi bulunamadı.
                                                                </div>
                                                            );
                                                        })()
                                                    ) : null}

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
                                const isExpanded = expandedId === `SASI-${sasi.id}`;

                                return (
                                    <div key={sasi.id} id={`urun-row-SASI-${sasi.id}`} className="damper-card">
                                        {/* Header */}
                                        <div
                                            className="damper-card-header damper-card-header--apple"
                                            onClick={() => setExpandedId(isExpanded ? null : `SASI-${sasi.id}`)}
                                        >
                                            <div className="apple-urun-row__imalat">#{sasi.imalatNo}</div>
                                            <div className="apple-urun-row__musteri">{sasi.musteri}</div>
                                            <div>
                                                <span className="apple-urun-row__pill">{sasi.tampon || '-'}</span>
                                            </div>
                                            <div className="apple-urun-row__specs">
                                                {formatSasiNoLabel(sasi.sasiNo)} | {sasi.dingil || '-'}
                                            </div>
                                            <div className="apple-urun-row__progress">
                                                <div className="progress-bar progress-bar--compact">
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                                <span className="apple-urun-row__pct">{progress}%</span>
                                            </div>
                                            <div className="apple-urun-row__badge">{getStatusBadge(overallStatus)}</div>
                                            <div className="apple-urun-row__trail">
                                                <span className={`apple-urun-row__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden>
                                                    ▼
                                                </span>
                                            </div>
                                        </div>

                                        {/* Body */}
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
                                                {/* Info Cards */}
                                                <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                    gap: '12px',
                                                    marginBottom: '20px',
                                                    paddingBottom: '20px',
                                                    borderBottom: '1px solid var(--border)'
                                                }}>

                                                    {/* İMALAT NO */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: !hasDamperDorseImalatNo(sasi.imalatNo) ? '2px solid var(--warning)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
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
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </div>

                                                    {/* ŞASİ NO */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: !hasSasiNoWritten(sasi.sasiNo) ? '2px solid var(--warning)' : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ŞASİ NO</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500, color: hasSasiNoWritten(sasi.sasiNo) ? 'var(--foreground)' : 'var(--warning)' }}>{hasSasiNoWritten(sasi.sasiNo) ? normalizeSasiNoValue(sasi.sasiNo) : 'Girilmedi'}</div>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            autoComplete="off"
                                                            className="input"
                                                            style={{ width: '140px', padding: '4px', fontSize: '13px', flexShrink: 0 }}
                                                            placeholder="Şasi no"
                                                            value={sasi.sasiNo ?? ''}
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
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </div>


                                                    {/* MÜŞTERİ (Editable) */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>MÜŞTERİ / İSİM</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{sasi.musteri}</div>
                                                        </div>
                                                        <input type="text" className="input" style={{ width: '120px', padding: '4px', fontSize: '13px' }} value={sasi.musteri || ''} onChange={(e) => {
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
                                                        }} onBlur={() => void persistNow(`sasi-${sasi.id}-musteri`)} onClick={e => e.stopPropagation()} placeholder="İsim Giriniz" />
                                                    </div>

                                                    {/* TAMPON */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TAMPON</div>
                                                        <select className="select" style={{ width: '100%', padding: '4px', fontSize: '13px', background: 'var(--card-bg-secondary)', border: 'none', color: 'var(--foreground)' }} value={sasi.tampon || ''} onChange={(e) => {
                                                            const v = e.target.value;
                                                            void (async () => {
                                                                const updated = await updateSasi(sasi.id, { tampon: v });
                                                                setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                                                            })();
                                                        }} onClick={e => e.stopPropagation()}>
                                                            <option style={{ color: 'black' }} value="">Seçiniz</option>
                                                            <option style={{ color: 'black' }} value="Kırma Tampon">KIRMA</option>
                                                            <option style={{ color: 'black' }} value="Sabit Tampon">SABİT</option>
                                                        </select>
                                                    </div>

                                                    {/* DINGIL */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>DİNGİL</div>
                                                        <select className="select" style={{ width: '100%', padding: '4px', fontSize: '13px', background: 'var(--card-bg-secondary)', border: 'none', color: 'var(--foreground)' }} value={sasi.dingil || ''} onChange={(e) => {
                                                            const v = e.target.value;
                                                            void (async () => {
                                                                const updated = await updateSasi(sasi.id, { dingil: v });
                                                                setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                                                            })();
                                                        }} onClick={e => e.stopPropagation()}>
                                                            <option style={{ color: 'black' }} value="">Seçiniz</option>
                                                            <option style={{ color: 'black' }} value="TRAX">TRAX</option>
                                                            <option style={{ color: 'black' }} value="BPW">BPW</option>
                                                        </select>
                                                    </div>

                                                    {/* TARİH */}
                                                    <div style={{ background: 'var(--card-bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>TARİH</div>
                                                            <div style={{ fontSize: '13px' }}>{sasi.createdAt ? new Date(sasi.createdAt).toLocaleDateString() : '-'}</div>
                                                        </div>
                                                        <input type="date" className="input" style={{ width: '110px', padding: '4px', fontSize: '12px' }} onChange={(e) => {
                                                            if (!e.target.value) return;
                                                            const iso = new Date(e.target.value).toISOString();
                                                            setSasis(prev =>
                                                                prev.map(s => (s.id === sasi.id ? { ...s, createdAt: iso } : s))
                                                            );
                                                            void (async () => {
                                                                const updated = await updateSasi(sasi.id, { createdAt: iso });
                                                                setSasis(prev => prev.map(s => (s.id === sasi.id ? updated : s)));
                                                            })();
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
                    ) : productType === 'DORSE_SASI' ? (
                        <div className="urun-linked-wrap">
                            <header className="urun-linked-section-head">
                                <span className="urun-linked-count-pill">{filteredLinkedDorseSasis.length}</span>
                                <div className="urun-linked-section-text">
                                    <h2 className="urun-linked-section-title">Bağlı dorse–şasi</h2>
                                    <p className="urun-linked-section-sub">
                                        Aynı satırda dorse ile eşleşen şasi; teknik bilgiler dorseler ve şasiler sekmesindeki alanlarla uyumludur.
                                    </p>
                                </div>
                            </header>

                            {filteredLinkedDorseSasis.length === 0 ? (
                                <div className="urun-linked-empty card">
                                    <h3 className="urun-linked-empty__title">
                                        {linkedDorseSasis.length > 0 ? 'Sonuç bulunamadı' : 'Henüz bağlı çift yok'}
                                    </h3>
                                    {linkedDorseSasis.length === 0 && (
                                        <>
                                            <p className="urun-linked-empty__hint">
                                                Dorseler sekmesinden bir dorseye şasi bağlayabilirsiniz.
                                            </p>
                                            <button type="button" className="btn btn-primary" onClick={() => setProductType('DORSE')}>
                                                Dorselere git
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="urun-linked-list">
                                    {filteredLinkedDorseSasis.map(({ dorse, sasi, dorseProgress, sasiProgress }) => {
                                        const dSpec = formatDorseLinkedSpec(dorse);
                                        const sSpec = formatSasiLinkedSpec(sasi);
                                        return (
                                            <article key={dorse.id} className="urun-linked-pair card">
                                                <div className="dorse-sasi-grid">
                                                    <div className="urun-linked-panel urun-linked-panel--dorse">
                                                        <div className="urun-linked-panel__head">
                                                            <div className="urun-linked-panel__title-block">
                                                                <span className="urun-linked-chip urun-linked-chip--dorse">
                                                                    Dorse #{dorse.imalatNo ?? '—'}
                                                                </span>
                                                                <div className="urun-linked-name">{dorse.musteri?.trim() || '—'}</div>
                                                            </div>
                                                            <div className="urun-linked-meta">
                                                                <div className="urun-linked-meta__line urun-linked-meta__line--strong">{dSpec.primary}</div>
                                                                {dSpec.secondary ? (
                                                                    <div className="urun-linked-meta__line">{dSpec.secondary}</div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="urun-linked-progress-head">
                                                            <span>Tamamlanma</span>
                                                            <span
                                                                className={
                                                                    dorseProgress === 100 ? 'urun-linked-pct is-done' : 'urun-linked-pct'
                                                                }
                                                            >
                                                                %{dorseProgress}
                                                            </span>
                                                        </div>
                                                        <div className="urun-linked-progress-track">
                                                            <div
                                                                className="urun-linked-progress-fill urun-linked-progress-fill--dorse"
                                                                style={{ width: `${dorseProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="dorse-sasi-divider urun-linked-nexus" aria-hidden>
                                                        <span className="urun-linked-nexus__disc" />
                                                    </div>

                                                    <div className="urun-linked-panel urun-linked-panel--sasi">
                                                        <div className="urun-linked-panel__head">
                                                            <div className="urun-linked-panel__title-block">
                                                                <span className="urun-linked-chip urun-linked-chip--sasi">
                                                                    Şasi #{sasi.imalatNo ?? '—'}
                                                                </span>
                                                                <div className="urun-linked-name">{sasi.musteri?.trim() || '—'}</div>
                                                            </div>
                                                            <div className="urun-linked-meta">
                                                                <div className="urun-linked-meta__line urun-linked-meta__line--strong">{sSpec.primary}</div>
                                                                {sSpec.secondary ? (
                                                                    <div className="urun-linked-meta__line">{sSpec.secondary}</div>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div className="urun-linked-progress-head">
                                                            <span>Tamamlanma</span>
                                                            <span
                                                                className={
                                                                    sasiProgress === 100 ? 'urun-linked-pct is-done' : 'urun-linked-pct'
                                                                }
                                                            >
                                                                %{sasiProgress}
                                                            </span>
                                                        </div>
                                                        <div className="urun-linked-progress-track">
                                                            <div
                                                                className="urun-linked-progress-fill urun-linked-progress-fill--sasi"
                                                                style={{ width: `${sasiProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        sortedDorses.length === 0 ? (
                            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                Bu kategoride dorse bulunamadı
                            </div>
                        ) : (
                            sortedDorses.map((dorse) => {
                                const progress = calculateDorseProgress(dorse);
                                const overallStatus = progress === 100 ? 'TAMAMLANDI' : progress === 0 ? 'BAŞLAMADI' : 'DEVAM EDİYOR';
                                const isExpanded = expandedId === `DORSE-${dorse.id}`;

                                return (
                                    <div key={dorse.id} id={`urun-row-DORSE-${dorse.id}`} className="damper-card">
                                        <div
                                            className="damper-card-header damper-card-header--apple"
                                            onClick={() => setExpandedId(isExpanded ? null : `DORSE-${dorse.id}`)}
                                        >
                                            <div className="apple-urun-row__imalat">#{dorse.imalatNo}</div>
                                            <div className="apple-urun-row__musteri">{dorse.musteri}</div>
                                            <div>
                                                <span className="apple-urun-row__pill">{dorse.kalinlik}</span>
                                            </div>
                                            <div className="apple-urun-row__specs">
                                                {dorse.dingil} | {dorse.m3} M³{dorse.renk ? ` | ${dorse.renk}` : ''}
                                            </div>
                                            <div className="apple-urun-row__progress">
                                                <div className="progress-bar progress-bar--compact">
                                                    <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                                <span className="apple-urun-row__pct">{progress}%</span>
                                            </div>
                                            <div className="apple-urun-row__badge">{getStatusBadge(overallStatus)}</div>
                                            <div className="apple-urun-row__trail">
                                                <div
                                                    className={`apple-urun-row__dot ${dorse.cekiciGeldiMi ? 'apple-urun-row__dot--ok' : 'apple-urun-row__dot--no'}`}
                                                    title={dorse.cekiciGeldiMi ? 'Çekici Geldi' : 'Çekici Gelmedi'}
                                                />
                                                <span className={`apple-urun-row__chevron${isExpanded ? ' is-open' : ''}`} aria-hidden>
                                                    ▼
                                                </span>
                                            </div>
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
                                                    {/* İmalat No */}
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>İMALAT NO</div>
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>SİLİNDİR</div>
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>MALZEME CİNSİ</div>
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
                                                                    setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
                                                                })();
                                                            }}
                                                        >
                                                            <option value="">Seçiniz</option>
                                                            {(dropdowns?.malzemeCinsi ?? []).map(m => (
                                                                <option key={m} value={m}>{m}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Kalınlık */}
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
                                                            placeholder="Kalınlık"
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
                                                            <option value="">Seçiniz</option>
                                                            {(dropdowns?.dorseFren ?? ['Wabco', 'Knorr']).map((f) => (
                                                                <option key={f} value={f}>{f}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Şasi Bağlantısı */}
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
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                className="btn btn-primary"
                                                                onClick={(e) => { e.stopPropagation(); openLinkModal(dorse); }}
                                                                style={{ fontSize: '13px', padding: '8px 16px' }}
                                                            >
                                                                {dorse.sasi ? <><LinkIcon size={14} /> Şasiyi Değiştir</> : <><LinkIcon size={14} /> Şasi Bağla</>}
                                                            </button>
                                                            {dorse.sasi && (
                                                                <button
                                                                    className="btn btn-danger"
                                                                    onClick={(e) => { e.stopPropagation(); handleUnlinkSasi(dorse.id); }}
                                                                    style={{ fontSize: '13px', padding: '8px 16px' }}
                                                                >
                                                                    <X size={14} /> Şasiyi Kaldır
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Çekici Durumu */}
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
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600, marginBottom: '4px' }}>ÇEKİCİ DURUMU</div>
                                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                                {dorse.cekiciGeldiMi ? 'Çekici Geldi' : 'Çekici Gelmedi'}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`step-toggle ${dorse.cekiciGeldiMi ? 'active' : ''}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStepToggle(dorse.id, 'cekiciGeldiMi', dorse.cekiciGeldiMi, 'DORSE');
                                                            }}
                                                            style={{ transform: 'scale(1.1)' }}
                                                            title="Değiştirmek için tıklayın"
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
                                                                {dorse.adet > 0 ? dorse.adet : '–'}
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

                                                    {/* Renk */}
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
                                                            onChange={(e) => {
                                                                if (!e.target.value) return;
                                                                const iso = new Date(e.target.value).toISOString();
                                                                setDorses(prev =>
                                                                    prev.map(d => (d.id === dorse.id ? { ...d, createdAt: iso } : d))
                                                                );
                                                                void (async () => {
                                                                    const updated = await updateDorse(dorse.id, { createdAt: iso });
                                                                    setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
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
                                                                                    onChange={(e) => {
                                                                                        const v = e.target.value;
                                                                                        void (async () => {
                                                                                            const updated = await updateDorse(dorse.id, { [step.key]: v });
                                                                                            setDorses(prev =>
                                                                                                applyServerRowIfFieldMatches(prev, dorse.id, step.key as keyof Dorse, v, updated)
                                                                                            );
                                                                                        })();
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
                                                                                        Bu siparişte branda yok; bu adım kullanılmıyor.
                                                                                    </div>
                                                                                ) : null}
                                                                            </div>
                                                                            <div style={{ alignSelf: 'center', flexShrink: 0 }}>
                                                                                <div
                                                                                    className={`step-toggle ${toggleOn ? 'active' : ''}`}
                                                                                        onClick={() => {
                                                                                            if (isBrandaMontajiLocked) return;
                                                                                            handleStepToggle(dorse.id, step.key, isCompleted, 'DORSE');
                                                                                        }}
                                                                                    title={
                                                                                        isBrandaMontajiLocked
                                                                                            ? 'Branda yok — montaj takip edilmez'
                                                                                            : 'Değiştirmek için tıklayın'
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

                                                {deliveryDraft?.kind === 'DORSE' && deliveryDraft.id === dorse.id && (
                                                    <div
                                                        className="card"
                                                        style={{
                                                            marginTop: '16px',
                                                            padding: '16px',
                                                            borderRadius: '14px',
                                                            background: 'var(--card)',
                                                            border: '1px solid rgba(2, 35, 71, 0.10)',
                                                            boxShadow: '0 10px 24px rgba(2, 35, 71, 0.06)'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                            <div style={{ fontWeight: 800, letterSpacing: '0.2px' }}>Teslim bilgileri</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Kaydetmek için “Teslim Et”</div>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                            <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                Dorse Şase No
                                                                <input
                                                                    value={deliveryDraft.teslimSasiNo}
                                                                    onChange={(e) =>
                                                                        setDeliveryDraft((p) =>
                                                                            p
                                                                                ? {
                                                                                      ...p,
                                                                                      teslimSasiNo: e.target.value
                                                                                          .toLocaleUpperCase('tr-TR')
                                                                                          .replace(/[^A-Z0-9]/g, '')
                                                                                  }
                                                                                : p
                                                                        )
                                                                    }
                                                                    className="input"
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
                                                                Aracın Sahibi (otomatik)
                                                                <input value={dorse.musteri} readOnly className="input" style={{ marginTop: '6px', opacity: 0.75 }} />
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
                                                                Vazgeç
                                                            </button>
                                                            <button className="btn btn-primary" onClick={() => void confirmDelivery()}>
                                                                Teslim Et
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!deliveryDraft && dorse.teslimat && (
                                                    <div
                                                        className="card"
                                                        style={{
                                                            marginTop: '16px',
                                                            padding: '16px',
                                                            borderRadius: '14px',
                                                            background: 'linear-gradient(180deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))',
                                                            border: '1px solid rgba(16, 185, 129, 0.22)',
                                                            boxShadow: '0 10px 24px rgba(2, 35, 71, 0.06)'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: '10px' }}>
                                                            <div style={{ fontWeight: 800, letterSpacing: '0.2px' }}>Teslim edildi</div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                    {dorse.teslimAt ? new Date(dorse.teslimAt).toLocaleString('tr-TR') : ''}
                                                                </div>
                                                                <button
                                                                    className="btn btn-secondary"
                                                                    style={{ padding: '6px 10px', fontSize: 12 }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDeliveryEdit({
                                                                            kind: 'DORSE',
                                                                            id: dorse.id,
                                                                            teslimSasiNo: dorse.teslimSasiNo || '',
                                                                            teslimEden: dorse.teslimEden || '',
                                                                            teslimAlan: dorse.teslimAlan || '',
                                                                            teslimAracSahibi: dorse.teslimAracSahibi || dorse.musteri || '',
                                                                            teslimNot: dorse.teslimNot || '',
                                                                        });
                                                                    }}
                                                                >
                                                                    Düzenle
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {deliveryEdit?.kind === 'DORSE' && deliveryEdit.id === dorse.id ? (
                                                            <div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                        Dorse Şase No
                                                                        <input
                                                                            className="input"
                                                                            style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
                                                                            value={deliveryEdit.teslimSasiNo}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => {
                                                                                const next = e.target.value.toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
                                                                                setDeliveryEdit(p => (p && p.kind === 'DORSE' ? { ...p, teslimSasiNo: next } : p));
                                                                            }}
                                                                        />
                                                                    </label>
                                                                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                        Teslim Eden
                                                                        <input
                                                                            className="input"
                                                                            style={{ marginTop: 6 }}
                                                                            value={deliveryEdit.teslimEden}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DORSE' ? { ...p, teslimEden: e.target.value } : p))}
                                                                        />
                                                                    </label>
                                                                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                        Teslim Alan
                                                                        <input
                                                                            className="input"
                                                                            style={{ marginTop: 6 }}
                                                                            value={deliveryEdit.teslimAlan}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DORSE' ? { ...p, teslimAlan: e.target.value } : p))}
                                                                        />
                                                                    </label>
                                                                    <label style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                                        Aracın Sahibi
                                                                        <input
                                                                            className="input"
                                                                            style={{ marginTop: 6 }}
                                                                            value={deliveryEdit.teslimAracSahibi}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DORSE' ? { ...p, teslimAracSahibi: e.target.value } : p))}
                                                                        />
                                                                    </label>
                                                                </div>
                                                                <label style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: 12 }}>
                                                                    Not
                                                                    <textarea
                                                                        className="input"
                                                                        style={{ marginTop: 6, minHeight: 80 }}
                                                                        value={deliveryEdit.teslimNot}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => setDeliveryEdit(p => (p && p.kind === 'DORSE' ? { ...p, teslimNot: e.target.value } : p))}
                                                                    />
                                                                </label>
                                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                                                                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); setDeliveryEdit(null); }}>
                                                                        Vazgeç
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-primary"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            const normalized = normalizeDeliverySasiNoClient(deliveryEdit.teslimSasiNo);
                                                                            if (!normalized) return alert('Şase no geçersiz. Yalnız A–Z ve 0–9 kullanılabilir.');
                                                                            const updated = await updateDorse(dorse.id, {
                                                                                teslimSasiNo: normalized,
                                                                                teslimEden: deliveryEdit.teslimEden,
                                                                                teslimAlan: deliveryEdit.teslimAlan,
                                                                                teslimAracSahibi: deliveryEdit.teslimAracSahibi,
                                                                                teslimNot: deliveryEdit.teslimNot || null,
                                                                            });
                                                                            setDorses(prev => prev.map(d => (d.id === dorse.id ? updated : d)));
                                                                            setDeliveryEdit(null);
                                                                        }}
                                                                    >
                                                                        Kaydet
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                                                                    <div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Dorse Şase No</div>
                                                                        <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700 }}>
                                                                            {dorse.teslimSasiNo || '—'}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Eden</div>
                                                                        <div style={{ fontWeight: 600 }}>{dorse.teslimEden || '—'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Teslim Alan</div>
                                                                        <div style={{ fontWeight: 600 }}>{dorse.teslimAlan || '—'}</div>
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Aracın Sahibi</div>
                                                                        <div style={{ fontWeight: 600 }}>{dorse.teslimAracSahibi || dorse.musteri || '—'}</div>
                                                                    </div>
                                                                </div>
                                                                {dorse.teslimNot ? (
                                                                    <div style={{ marginTop: 12 }}>
                                                                        <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>Not</div>
                                                                        <div style={{ color: 'var(--foreground)' }}>{dorse.teslimNot}</div>
                                                                    </div>
                                                                ) : null}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {productType === 'DORSE' &&
                                                (getDorseStatus(dorse) === 'tamamlanan' || getDorseStatus(dorse) === 'teslimEdilen') ? (
                                                    (() => {
                                                        const tl = timelines[`DORSE-${dorse.id}`];
                                                        if (tl === 'loading') {
                                                            return (
                                                                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                                                                    Üretim süresi hazırlanıyor…
                                                                </div>
                                                            );
                                                        }
                                                        if (tl) return <TimelineMini tl={tl} />;
                                                        return (
                                                            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                                                                Üretim süresi verisi bulunamadı.
                                                            </div>
                                                        );
                                                    })()
                                                ) : null}

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
                    <div className="modal-overlay apple-product-form-overlay" onClick={() => setShowAddModal(false)}>
                        <div
                            className="modal modal--premium apple-product-form-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="add-product-modal-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2 className="modal-title" id="add-product-modal-title">
                                    Yeni{' '}
                                    {productType === 'DAMPER'
                                        ? 'Damper'
                                        : productType === 'DORSE'
                                          ? 'Dorse'
                                          : productType === 'SASI'
                                            ? 'Şasi'
                                            : 'Ürün'}{' '}
                                    Ekle
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
                                                    onChange={(e) => setFormData(prev => ({ ...prev, musteri: trUpper(e.target.value) }))}
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
                                                    placeholder="Örn: 3545 D, 3345 K..."
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
                                                    <option value="">Seçiniz</option>
                                                    {(dropdowns?.tip ?? []).map(t => (
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
                                                    {(dropdowns?.malzemeCinsi ?? []).map(m => (
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
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: 18+2"
                                                    value={formData.m3}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, m3: trUpper(e.target.value) }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Renk</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: Beyaz, Kırmızı..."
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
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, musteri: trUpper(e.target.value) }))}
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
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, dingil: trUpper(e.target.value) }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Lastik</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: BRIDGESTONE..."
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
                                                    <option value="">Seçiniz</option>
                                                    <option value="Kırma">Kırma</option>
                                                    <option value="Sabit">Sabit</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Kalınlık</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: 4mm..."
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
                                                    <option value="">Seçiniz</option>
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
                                                <label className="form-label">M³</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: 18+2"
                                                    value={dorseFormData.m3}
                                                    onChange={(e) => setDorseFormData(prev => ({ ...prev, m3: trUpper(e.target.value) }))}
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Renk</label>
                                                <input
                                                    type="text"
                                                    className="input"
                                                    placeholder="Örn: Beyaz, Kırmızı..."
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
                    </div>
                )}

                {/* Şasi Bağlantısı Modalı */}
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
                                        <h3 className="modal-title" style={{ margin: 0, color: '#fff', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em' }}>Şasi Bağlantısı</h3>
                                        <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', margin: '4px 0 0 0', fontWeight: 500 }}>
                                            <span style={{ color: '#fff' }}>{activeDorseForLink.musteri}</span> için şasi seçimi
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
                                        color: '#ffffff',
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
                                        placeholder="Şasi ara (Müşteri adı, Stok no veya İmalat no...)"
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
                                                background: linkFilter === filter ? 'var(--card)' : 'transparent',
                                                color: linkFilter === filter ? 'var(--foreground)' : 'var(--foreground-secondary)',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                boxShadow: linkFilter === filter ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {filter === 'hepsi' ? 'Tüm Şasiler' : filter === 'stok' ? 'Stok Şasileri' : 'Müşteri Şasileri'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* List Content */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px', background: 'var(--card)' }}>
                                {availableSasis.length === 0 ? (
                                    <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
                                        <Package size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
                                        <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--foreground-secondary)' }}>Bağlanabilir şasi bulunamadı.</p>
                                        <button
                                            style={{ marginTop: '16px', padding: '10px 20px', background: 'color-mix(in srgb, var(--primary) 14%, var(--card))', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}
                                            onClick={() => { setShowLinkModal(false); setShowAddModal(true); setProductType('SASI'); }}
                                        >
                                            + Yeni Şasi Oluştur
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
                                                                    <span style={{ fontSize: '11px', background: 'var(--primary)', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                                                        ÖNERİLEN
                                                                    </span>
                                                                )}
                                                                {progress === 100 && (
                                                                    <span style={{ fontSize: '11px', background: 'var(--success)', color: '#ffffff', padding: '4px 10px', borderRadius: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        <CheckCircle size={12} /> HAZIR
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--foreground-secondary)', fontSize: '13px', fontWeight: 500 }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Info size={14} /> {sasi.sasiNo || 'Şasi No Yok'}</span>
                                                                <span style={{ width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%' }}></span>
                                                                <span>{sasi.dingil}</span>
                                                                <span style={{ width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%' }}></span>
                                                                <span>{sasi.tampon}</span>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 700, color: progress === 100 ? 'var(--success)' : 'var(--control-fill)' }}>
                                                                %{progress} Tamamlandı
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
                                    İptal
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                </div>
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
