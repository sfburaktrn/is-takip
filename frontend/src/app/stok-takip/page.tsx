'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { useAuth } from '@/lib/AuthContext';
import {
    addStockItemDocument,
    addStockItemPrice,
    addStockMovement,
    changeStockSupplier,
    deleteStockItemDocument,
    deleteStockPriceHistory,
    deleteStockSupplierHistory,
    createStockItem,
    getStockGroups,
    getStockItemDetail,
    getStockItemDocumentUrl,
    getStockItems,
    resetStockItem,
    updateStockItem,
    updateStockPriceHistory,
    type StockDocumentKind,
    type StockGroupRow,
    type StockItemDetail,
    type StockItemRow,
    type StockPriceCurrency,
    type StockPriceHistoryPoint
} from '@/lib/api';
import { fileToWebp, isImageFile } from '@/lib/imageToWebp';
import {
    ArrowDownRight,
    ArrowUpRight,
    ArrowRight,
    BarChart3,
    Building2,
    FileImage,
    FileText,
    Hash,
    History,
    Image as ImageIcon,
    Layers,
    Loader2,
    Minus,
    Package,
    Pencil,
    Phone,
    Plus,
    RefreshCcw,
    Repeat,
    RotateCcw,
    Search,
    Star,
    Trash2,
    TrendingDown,
    TrendingUp,
    X
} from 'lucide-react';

type StockItemPayload = {
    groupId?: number;
    groupName?: string;
    purchaseCode: string | null;
    description: string;
    unit: string | null;
    quantity: string | null;
    criticalQuantity: string | null;
    supplierName: string | null;
    supplierContact: string | null;
    supplierPaymentTerm: string | null;
    supplierLeadTime: string | null;
};

/** Oran: miktar / kritik. ≥2 → güvenli, 1–2 → yaklaşıyor, ≤1 → kritik */
type StockLevelZone = 'safe' | 'warn' | 'critical';

function parseStockNum(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function stockLevelRatio(qty: string | number | null | undefined, critical: string | number | null | undefined): number | null {
    const q = parseStockNum(qty);
    const c = parseStockNum(critical);
    if (q == null || c == null || c <= 0) return null;
    return q / c;
}

/** 0 = kritikten uzak (yeşil), 1 = kritikte/altında (kırmızı) — ürüne göre oransal */
function stockDangerT(qty: string | number | null | undefined, critical: string | number | null | undefined): number | null {
    const r = stockLevelRatio(qty, critical);
    if (r == null) return null;
    // r≥2 → 0, r=1 → 1, r≤1 → 1 (veya biraz daha kırmızı his için 1)
    if (r >= 2) return 0;
    if (r <= 1) return 1;
    return (2 - r) / 1; // 2→0 … 1→1
}

function stockLevelZone(qty: string | number | null | undefined, critical: string | number | null | undefined): StockLevelZone | null {
    const r = stockLevelRatio(qty, critical);
    if (r == null) return null;
    if (r <= 1) return 'critical';
    if (r < 2) return 'warn';
    return 'safe';
}

function stockLevelLabel(zone: StockLevelZone): string {
    if (zone === 'safe') return 'Kritik seviyeden uzakta';
    if (zone === 'warn') return 'Kritik seviyeye yaklaşıyor';
    return 'Kritik seviyede';
}

function lerpChannel(a: number, b: number, t: number) {
    return Math.round(a + (b - a) * t);
}

function lerpRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [lerpChannel(a[0], b[0], t), lerpChannel(a[1], b[1], t), lerpChannel(a[2], b[2], t)];
}

/** Tehlike 0→1: yeşil → sarı → kırmızı */
function stockHeatRgb(danger: number): [number, number, number] {
    const d = Math.min(1, Math.max(0, danger));
    const green: [number, number, number] = [16, 185, 129];
    const yellow: [number, number, number] = [245, 158, 11];
    const red: [number, number, number] = [239, 68, 68];
    if (d <= 0.5) return lerpRgb(green, yellow, d * 2);
    return lerpRgb(yellow, red, (d - 0.5) * 2);
}

function stockRowHealthStyle(qty: string | number | null | undefined, critical: string | number | null | undefined): CSSProperties | undefined {
    const danger = stockDangerT(qty, critical);
    if (danger == null) return undefined;
    const mid = stockHeatRgb(danger);
    const left = stockHeatRgb(Math.max(0, danger - 0.18));
    const right = stockHeatRgb(Math.min(1, danger + 0.22));
    const alpha = 0.18 + danger * 0.22;
    return {
        ['--stock-c1' as string]: `${left[0]}, ${left[1]}, ${left[2]}`,
        ['--stock-c2' as string]: `${mid[0]}, ${mid[1]}, ${mid[2]}`,
        ['--stock-c3' as string]: `${right[0]}, ${right[1]}, ${right[2]}`,
        ['--stock-alpha' as string]: String(alpha),
        ['--stock-pulse' as string]: String(2.8 + danger * 2.2),
        boxShadow: `inset 4px 0 0 rgb(${mid[0]}, ${mid[1]}, ${mid[2]})`,
    };
}

function hasStockSupplier(s: {
    supplierName?: string | null;
    supplierContact?: string | null;
    supplierPaymentTerm?: string | null;
    supplierLeadTime?: string | null;
}): boolean {
    return Boolean(
        (s.supplierName && s.supplierName.trim()) ||
            (s.supplierContact && s.supplierContact.trim()) ||
            (s.supplierPaymentTerm && s.supplierPaymentTerm.trim()) ||
            (s.supplierLeadTime && s.supplierLeadTime.trim())
    );
}

const STOCK_VADE_OPTIONS = ['Peşin', '7 gün', '15 gün', '30 gün', '45 gün', '60 gün', '90 gün', '120 gün'] as const;
const STOCK_TERMIN_OPTIONS = ['Stoktan', '3 gün', '7 gün', '10 gün', '15 gün', '21 gün', '30 gün', '45 gün', '60 gün'] as const;

function formatMoney(n: number | null | undefined, currency: StockPriceCurrency | string | null | undefined = 'TRY') {
    if (n == null || Number.isNaN(n)) return '—';
    const code = currency === 'USD' || currency === 'EUR' ? currency : 'TRY';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(n);
}

function formatPct(p: number | null | undefined) {
    if (p == null || Number.isNaN(p)) return '—';
    const sign = p > 0 ? '+' : '';
    return `${sign}${p.toFixed(2).replace('.', ',')} %`;
}

const STOCK_CURRENCY_OPTIONS: { value: StockPriceCurrency; label: string }[] = [
    { value: 'TRY', label: 'TRY (₺)' },
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
];

const STOCK_DOC_KIND_LABELS: Record<StockDocumentKind, string> = {
    PRODUCT_IMAGE: 'Ürün resmi',
    TECH_DRAWING: 'Teknik resim',
};

function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToStockDocumentPayload(file: File): Promise<{
    mimeType: string;
    dataBase64: string;
    fileName: string;
}> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (isPdf) {
        if (file.size > 4 * 1024 * 1024) throw new Error('PDF en fazla 4MB olabilir');
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return {
            mimeType: 'application/pdf',
            dataBase64: btoa(binary),
            fileName: file.name,
        };
    }
    if (!isImageFile(file)) {
        throw new Error('JPEG, PNG, WebP veya PDF seçin');
    }
    const webp = await fileToWebp(file);
    return {
        mimeType: webp.mimeType,
        dataBase64: webp.dataBase64,
        fileName: webp.fileName,
    };
}

export default function StokTakipPage() {
    return (
        <Suspense fallback={<OzunluLoading />}>
            <StokTakipInner />
        </Suspense>
    );
}

function StokTakipInner() {
    const { isAdmin } = useAuth();
    const searchParams = useSearchParams();
    const highlightId = useMemo(() => {
        const raw = searchParams?.get('highlight');
        if (!raw) return null;
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
    }, [searchParams]);
    const highlightOpenedRef = useRef<number | null>(null);

    const [groups, setGroups] = useState<StockGroupRow[]>([]);
    const [items, setItems] = useState<StockItemRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupFilter, setGroupFilter] = useState<number | 'all'>('all');
    const [searchInput, setSearchInput] = useState('');
    const [searchQ, setSearchQ] = useState('');

    const [itemModal, setItemModal] = useState<'new' | StockItemRow | null>(null);
    const [priceModal, setPriceModal] = useState<{
        item: StockItemRow;
        edit?: StockPriceHistoryPoint;
    } | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [detailNonce, setDetailNonce] = useState(0);
    const [saving, setSaving] = useState(false);
    /** Varsayılan: sayfa açılışında yalnızca ana kalemler */
    const [listScope, setListScope] = useState<'main' | 'all'>('main');
    const [togglingMainId, setTogglingMainId] = useState<number | null>(null);

    useEffect(() => {
        const t = window.setTimeout(() => {
            setSearchQ(searchInput.trim());
        }, 320);
        return () => window.clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [g, res] = await Promise.all([
                getStockGroups(),
                getStockItems({
                    groupId: groupFilter === 'all' ? undefined : groupFilter,
                    q: searchQ.length >= 2 ? searchQ : undefined,
                    mainOnly: listScope === 'main',
                    limit: 2000,
                    skip: 0
                })
            ]);
            setGroups(g);
            setItems(res.items);
            setTotal(res.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [groupFilter, searchQ, listScope]);

    useEffect(() => {
        void load();
    }, [load]);

    const toggleMainItem = useCallback(
        async (row: StockItemRow, e?: { stopPropagation: () => void }) => {
            e?.stopPropagation();
            const next = !row.isMainItem;
            setTogglingMainId(row.id);
            try {
                await updateStockItem(row.id, { isMainItem: next });
                if (listScope === 'main' && !next) {
                    setItems((prev) => prev.filter((i) => i.id !== row.id));
                    setTotal((t) => Math.max(0, t - 1));
                } else {
                    setItems((prev) => prev.map((i) => (i.id === row.id ? { ...i, isMainItem: next } : i)));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Ana kalem güncellenemedi');
            } finally {
                setTogglingMainId(null);
            }
        },
        [listScope]
    );

    useEffect(() => {
        if (highlightId == null || loading) return;
        if (highlightOpenedRef.current === highlightId) return;
        const found = items.some((i) => i.id === highlightId);
        if (!found) {
            if (listScope === 'main') {
                setListScope('all');
            }
            return;
        }
        highlightOpenedRef.current = highlightId;
        setDetailId(highlightId);
        window.setTimeout(() => {
            const el = document.getElementById(`stock-row-${highlightId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
    }, [highlightId, loading, items, listScope]);

    const itemsByGroup = useMemo(() => {
        const order = new Map(groups.map((g, i) => [g.id, i]));
        const m = new Map<number, StockItemRow[]>();
        for (const it of items) {
            const list = m.get(it.groupId) ?? [];
            list.push(it);
            m.set(it.groupId, list);
        }
        const groupIds = [...m.keys()].sort((a, b) => {
            const ia = order.get(a) ?? 9999;
            const ib = order.get(b) ?? 9999;
            if (ia !== ib) return ia - ib;
            return a - b;
        });
        return { map: m, orderedGroupIds: groupIds };
    }, [items, groups]);

    const groupSectionsCount = itemsByGroup.orderedGroupIds.length;
    const pricedCount = useMemo(() => items.filter((i) => i.latestUnitPrice != null).length, [items]);

    return (
        <AuthGuard>
            <>
                <Sidebar />
                <main className="main-content apple-app-page">
                    <div className="apple-canvas">
                    <section className="stock-hero" aria-labelledby="stock-page-title">
                        <div className="stock-hero-inner">
                            <div className="stock-hero-title">
                                <div className="stock-hero-icon" aria-hidden>
                                    <Package size={26} strokeWidth={1.75} />
                                </div>
                                <div>
                                    <h1 id="stock-page-title">Stok takip</h1>
                                    <p>
                                        Satınalma kodları, tedarikçi bilgileri ve birim fiyat geçmişi tek ekranda. Fiyat
                                        kayıtlarıyla dönemsel artış ve azalışları izleyin.
                                    </p>
                                </div>
                            </div>
                            <button type="button" className="btn btn-primary btn-stock-hero-add" onClick={() => setItemModal('new')}>
                                <Plus size={18} />
                                Yeni kalem
                            </button>
                        </div>
                    </section>

                    <div className="stock-stat-grid" role="region" aria-label="Özet">
                        <div className="stock-stat-card">
                            <div className="stock-stat-icon stock-stat-icon--primary" aria-hidden>
                                <BarChart3 size={22} />
                            </div>
                            <div>
                                <div className="stock-stat-value">{loading ? '…' : total}</div>
                                <div className="stock-stat-label">Listelenen kalem</div>
                            </div>
                        </div>
                        <div className="stock-stat-card">
                            <div className="stock-stat-icon stock-stat-icon--muted" aria-hidden>
                                <Layers size={22} />
                            </div>
                            <div>
                                <div className="stock-stat-value">{loading ? '…' : groupSectionsCount}</div>
                                <div className="stock-stat-label">Görünen grup</div>
                            </div>
                        </div>
                        <div className="stock-stat-card">
                            <div className="stock-stat-icon stock-stat-icon--success" aria-hidden>
                                <TrendingUp size={22} />
                            </div>
                            <div>
                                <div className="stock-stat-value">{loading ? '…' : pricedCount}</div>
                                <div className="stock-stat-label">Birim fiyatı tanımlı</div>
                            </div>
                        </div>
                    </div>

                    <div className="stock-toolbar">
                        <div className="stock-toolbar-grow">
                            <div className="stock-scope-toggle" role="tablist" aria-label="Liste kapsamı">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={listScope === 'main'}
                                    className={`stock-scope-btn${listScope === 'main' ? ' is-active' : ''}`}
                                    onClick={() => setListScope('main')}
                                >
                                    <Star size={15} aria-hidden />
                                    Ana kalemler
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={listScope === 'all'}
                                    className={`stock-scope-btn${listScope === 'all' ? ' is-active' : ''}`}
                                    onClick={() => setListScope('all')}
                                >
                                    Tüm ürünler
                                </button>
                            </div>
                            <div className="stock-search-wrap">
                                <Search size={18} aria-hidden />
                                <input
                                    type="search"
                                    className="form-input"
                                    placeholder="Malzeme, kod veya tedarikçi ara…"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    aria-label="Stok araması"
                                    autoComplete="off"
                                />
                            </div>
                            <select
                                className="form-select"
                                value={groupFilter === 'all' ? '' : String(groupFilter)}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setGroupFilter(v === '' ? 'all' : parseInt(v, 10));
                                }}
                                aria-label="Grup filtresi"
                            >
                                <option value="">Tüm gruplar</option>
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.name} ({g.itemCount})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="stock-toolbar-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                                Yenile
                            </button>
                        </div>
                        {listScope === 'main' && !loading && total === 0 && searchQ.length < 2 ? (
                            <p className="stock-hint">
                                Henüz ana kalem yok. <strong>Tüm ürünler</strong>e geçip satırdaki yıldıza basarak ekleyin.
                            </p>
                        ) : searchInput.length > 0 && searchInput.length < 2 ? (
                            <p className="stock-hint">Aramayı başlatmak için en az 2 karakter yazın.</p>
                        ) : searchQ.length >= 2 ? (
                            <p className="stock-hint">
                                <strong>{searchQ}</strong> için sonuçlar gösteriliyor
                                {listScope === 'main' ? ' (ana kalemler içinde)' : ''}.
                            </p>
                        ) : null}
                    </div>

                    {error && (
                        <div className="alert alert-error alert--mb20">
                            {error}
                        </div>
                    )}

                    {loading && items.length === 0 ? (
                        <OzunluLoading />
                    ) : itemsByGroup.orderedGroupIds.length === 0 ? (
                        <div className="stock-empty">
                            <div className="stock-empty-icon">
                                <Package size={32} strokeWidth={1.5} />
                            </div>
                            <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '8px' }}>Kayıt bulunamadı</p>
                            <p style={{ fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
                                {listScope === 'main'
                                    ? 'Ana kalem listesi boş. Tüm ürünler görünümüne geçip satırdaki yıldıza basarak ana kaleme ekleyin.'
                                    : (
                                        <>
                                            Filtreleri veya aramayı değiştirin; yeni kalem eklemek için üstteki <strong>Yeni kalem</strong> düğmesini kullanın.
                                        </>
                                    )}
                            </p>
                        </div>
                    ) : (
                        itemsByGroup.orderedGroupIds.map((gid) => {
                            const g = groups.find((x) => x.id === gid);
                            const rows = itemsByGroup.map.get(gid) ?? [];
                            if (rows.length === 0) return null;
                            return (
                                <section key={gid} className="stock-group-panel" aria-labelledby={`stock-group-${gid}`}>
                                    <div className="stock-group-header">
                                        <div className="stock-group-title" id={`stock-group-${gid}`}>
                                            <Layers size={18} style={{ color: 'var(--primary)', opacity: 0.9 }} aria-hidden />
                                            <span>{g?.name ?? `Grup #${gid}`}</span>
                                            <span className="stock-group-badge">{rows.length} kalem</span>
                                        </div>
                                    </div>
                                    <div className="stock-table-wrap">
                                        <table className="stock-table">
                                            <colgroup>
                                                <col className="stock-col-main" />
                                                <col className="stock-col-code" />
                                                <col className="stock-col-desc" />
                                                <col className="stock-col-unit" />
                                                <col className="stock-col-qty" />
                                                <col className="stock-col-supp" />
                                                <col className="stock-col-contact" />
                                                <col className="stock-col-vade" />
                                                <col className="stock-col-termin" />
                                                <col className="stock-col-price" />
                                                <col className="stock-col-delta" />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th scope="col" className="stock-th-main" title="Ana kalem">
                                                        <Star size={14} aria-hidden />
                                                    </th>
                                                    <th scope="col">Kod</th>
                                                    <th scope="col">Malzeme</th>
                                                    <th scope="col">Birim</th>
                                                    <th scope="col" className="stock-th-num">
                                                        Stok
                                                    </th>
                                                    <th scope="col">Tedarikçi</th>
                                                    <th scope="col">İletişim</th>
                                                    <th scope="col" className="stock-th-nowrap">
                                                        Vade
                                                    </th>
                                                    <th scope="col" className="stock-th-nowrap">
                                                        Termin
                                                    </th>
                                                    <th scope="col" className="stock-th-num">
                                                        Birim fiyat
                                                    </th>
                                                    <th scope="col" className="stock-th-num stock-th-nowrap" title="Önceki birim fiyata göre değişim">
                                                        Fark %
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row) => {
                                                    const zone = stockLevelZone(row.quantity, row.criticalQuantity);
                                                    const healthStyle = stockRowHealthStyle(row.quantity, row.criticalQuantity);
                                                    const isHighlight = highlightId === row.id;
                                                    const levelClass =
                                                        zone === 'safe'
                                                            ? ' stock-row--level stock-row--level-safe'
                                                            : zone === 'warn'
                                                              ? ' stock-row--level stock-row--level-warn'
                                                              : zone === 'critical'
                                                                ? ' stock-row--level stock-row--level-critical'
                                                                : '';
                                                    return (
                                                    <tr
                                                        key={row.id}
                                                        id={`stock-row-${row.id}`}
                                                        className={`stock-row-clickable${levelClass}${isHighlight ? ' stock-row--highlight' : ''}`}
                                                        style={healthStyle}
                                                        tabIndex={0}
                                                        role="button"
                                                        aria-label={`${row.description} detayını aç`}
                                                        onClick={() => setDetailId(row.id)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                setDetailId(row.id);
                                                            }
                                                        }}
                                                    >
                                                        <td className="stock-td-main" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                className={`stock-main-toggle${row.isMainItem ? ' is-on' : ''}`}
                                                                disabled={togglingMainId === row.id}
                                                                title={row.isMainItem ? 'Ana kalemden çıkar' : 'Ana kaleme ekle'}
                                                                aria-label={row.isMainItem ? 'Ana kalemden çıkar' : 'Ana kaleme ekle'}
                                                                aria-pressed={Boolean(row.isMainItem)}
                                                                onClick={(e) => void toggleMainItem(row, e)}
                                                            >
                                                                {togglingMainId === row.id ? (
                                                                    <Loader2 size={15} className="animate-spin" />
                                                                ) : (
                                                                    <Star size={15} fill={row.isMainItem ? 'currentColor' : 'none'} />
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td>
                                                            {row.purchaseCode ? (
                                                                <span className="stock-code" title={row.purchaseCode}>
                                                                    {row.purchaseCode}
                                                                </span>
                                                            ) : (
                                                                <span className="stock-unit-pill" style={{ opacity: 0.75 }}>
                                                                    —
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className="stock-desc" title={row.description}>
                                                                {row.description}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {row.unit ? <span className="stock-unit-pill">{row.unit}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                                                        </td>
                                                        <td className="stock-td-num">
                                                            <div className="stock-qty-cell">
                                                                <span className="stock-num">{row.quantity ?? '—'}</span>
                                                                {row.quantity != null ? (
                                                                    <span className="stock-live" title="Canlı stok — her giriş/çıkışta anında güncellenir">
                                                                        <span className="stock-live-dot" aria-hidden />
                                                                        LIVE
                                                                    </span>
                                                                ) : null}
                                                                {zone ? (
                                                                    <span
                                                                        className={`stock-level-badge stock-level-badge--${zone}`}
                                                                        title={`Kritik eşik: ${row.criticalQuantity}`}
                                                                    >
                                                                        {stockLevelLabel(zone)}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className="stock-supplier" title={row.supplierName ?? undefined}>
                                                                {row.supplierName ?? '—'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="stock-contact" title={row.supplierContact ?? undefined}>
                                                                {row.supplierContact ?? '—'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="stock-unit-pill" title={row.supplierPaymentTerm ?? undefined}>
                                                                {row.supplierPaymentTerm ?? '—'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span className="stock-unit-pill" title={row.supplierLeadTime ?? undefined}>
                                                                {row.supplierLeadTime ?? '—'}
                                                            </span>
                                                        </td>
                                                        <td className="stock-td-num">
                                                            <span className="stock-price">{formatMoney(row.latestUnitPrice, row.latestCurrency)}</span>
                                                        </td>
                                                        <td className="stock-td-num stock-td-delta">
                                                            {row.priceChangePercent != null ? (
                                                                <span
                                                                    className={`stock-delta ${row.priceChangePercent > 0 ? 'stock-delta--up' : row.priceChangePercent < 0 ? 'stock-delta--down' : ''}`}
                                                                    title={`Önceki fiyata göre: ${formatPct(row.priceChangePercent)}`}
                                                                >
                                                                    {row.priceChangePercent > 0 ? (
                                                                        <TrendingUp size={12} />
                                                                    ) : row.priceChangePercent < 0 ? (
                                                                        <TrendingDown size={12} />
                                                                    ) : null}
                                                                    {formatPct(row.priceChangePercent)}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            );
                        })
                    )}

                    {itemModal && (
                        <ItemEditModal
                            key={itemModal === 'new' ? 'new' : itemModal.id}
                            mode={itemModal === 'new' ? 'new' : 'edit'}
                            initial={itemModal === 'new' ? null : itemModal}
                            groups={groups}
                            saving={saving}
                            onClose={() => !saving && setItemModal(null)}
                            onSave={async (payload) => {
                                try {
                                    setSaving(true);
                                    if (itemModal === 'new') {
                                        await createStockItem(payload);
                                    } else {
                                        await updateStockItem(itemModal.id, payload);
                                    }
                                    setItemModal(null);
                                    await load();
                                } catch (e) {
                                    alert(e instanceof Error ? e.message : 'Kaydedilemedi');
                                } finally {
                                    setSaving(false);
                                }
                            }}
                        />
                    )}

                    {detailId != null && (
                        <StockDetailModal
                            key={`${detailId}-${detailNonce}`}
                            itemId={detailId}
                            isAdmin={isAdmin}
                            onClose={() => setDetailId(null)}
                            onMutated={() => void load()}
                            onEditItem={(row) => setItemModal(row)}
                            onAddPrice={(row) => setPriceModal({ item: row })}
                            onEditPrice={(row, hist) => setPriceModal({ item: row, edit: hist })}
                        />
                    )}

                    {priceModal && (
                        <PriceModal
                            key={priceModal.edit ? `edit-${priceModal.edit.id}` : `new-${priceModal.item.id}`}
                            item={priceModal.item}
                            edit={priceModal.edit}
                            saving={saving}
                            onClose={() => !saving && setPriceModal(null)}
                            onSave={async (unitPrice, currency, note) => {
                                try {
                                    setSaving(true);
                                    if (priceModal.edit) {
                                        await updateStockPriceHistory(priceModal.item.id, priceModal.edit.id, {
                                            unitPrice,
                                            currency,
                                            note
                                        });
                                    } else {
                                        await addStockItemPrice(priceModal.item.id, { unitPrice, currency, note });
                                    }
                                    setPriceModal(null);
                                    await load();
                                    if (detailId != null) setDetailNonce((n) => n + 1);
                                } catch (e) {
                                    alert(e instanceof Error ? e.message : 'Kaydedilemedi');
                                } finally {
                                    setSaving(false);
                                }
                            }}
                        />
                    )}
                    </div>
                </main>
            </>
        </AuthGuard>
    );
}

function ItemEditModal({
    mode,
    initial,
    groups,
    saving,
    onClose,
    onSave
}: {
    mode: 'new' | 'edit';
    initial: StockItemRow | null;
    groups: StockGroupRow[];
    saving: boolean;
    onClose: () => void;
    onSave: (p: StockItemPayload) => Promise<void>;
}) {
    const [groupId, setGroupId] = useState<number | ''>(initial?.groupId ?? '');
    const [newGroupName, setNewGroupName] = useState('');
    const [purchaseCode, setPurchaseCode] = useState(initial?.purchaseCode ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [unit, setUnit] = useState(initial?.unit ?? '');
    const [quantity, setQuantity] = useState(initial?.quantity ?? '');
    const [criticalQuantity, setCriticalQuantity] = useState(initial?.criticalQuantity ?? '');
    const [supplierName, setSupplierName] = useState(initial?.supplierName ?? '');
    const [supplierContact, setSupplierContact] = useState(initial?.supplierContact ?? '');
    const [supplierPaymentTerm, setSupplierPaymentTerm] = useState(initial?.supplierPaymentTerm ?? '');
    const [supplierLeadTime, setSupplierLeadTime] = useState(initial?.supplierLeadTime ?? '');

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="stock-modal-title" onClick={onClose}>
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="stock-modal-title">
                            {mode === 'new' ? 'Yeni stok kalemi' : 'Kalemi düzenle'}
                        </h2>
                        <p className="modal-subtitle">
                            Grup, stok ve tedarikçi bilgilerini güncelleyin. Zorunlu alanlar (*) işaretlidir.
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body stock-edit-modal">
                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">Grup</div>
                            <div className="stock-modal-card-hint">Kalemin bağlı olduğu grubu seçin.</div>
                        </header>
                        <div className="stock-modal-grid">
                            <label className="field">
                                <span className="field-label">Mevcut grup</span>
                                <select
                                    className="form-select field-control"
                                    value={groupId === '' ? '' : String(groupId)}
                                    onChange={(e) => setGroupId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                >
                                    <option value="">Yeni grup oluştur…</option>
                                    {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            {g.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {groupId === '' ? (
                                <label className="field">
                                    <span className="field-label">Yeni grup adı</span>
                                    <input
                                        className="form-input field-control"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="Örn. 100-ŞASİ GRUBU"
                                    />
                                </label>
                            ) : (
                                <div className="field field--ghost" aria-hidden />
                            )}
                        </div>
                    </section>

                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">Malzeme</div>
                            <div className="stock-modal-card-hint">Arama ve raporlama için kısa ve net yazın.</div>
                        </header>
                        <div className="stock-modal-grid">
                            <label className="field">
                                <span className="field-label">
                                    <Hash size={14} aria-hidden /> Satınalma kodu
                                </span>
                                <input
                                    className="form-input field-control"
                                    value={purchaseCode}
                                    onChange={(e) => setPurchaseCode(e.target.value)}
                                    placeholder="Örn. 400003"
                                />
                            </label>
                            <label className="field field--span-2">
                                <span className="field-label">Malzeme tanımı *</span>
                                <textarea
                                    className="form-input field-control"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Örn. Tekli bobin"
                                    required
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">Birim</span>
                                <input
                                    className="form-input field-control"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder="ADET, KG…"
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">Güncel stok</span>
                                <input
                                    className="form-input field-control"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="0"
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">Kritik stok seviyesi</span>
                                <input
                                    className="form-input field-control"
                                    value={criticalQuantity}
                                    onChange={(e) => setCriticalQuantity(e.target.value)}
                                    placeholder="Örn. 10"
                                    title="Stok bu seviyenin altına inince bildirim oluşur"
                                />
                            </label>
                        </div>
                    </section>

                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">Tedarikçi</div>
                            <div className="stock-modal-card-hint">
                                İsteğe bağlı. Boş bırakırsanız detaydan “İlk tedarikçiyi gir” ile ekleyebilirsiniz.
                            </div>
                        </header>
                        <div className="stock-modal-grid">
                            <label className="field">
                                <span className="field-label">
                                    <Building2 size={14} aria-hidden /> Firma adı
                                </span>
                                <input
                                    className="form-input field-control"
                                    value={supplierName}
                                    onChange={(e) => setSupplierName(e.target.value)}
                                    placeholder="Örn. Hüseyin Koç"
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">
                                    <Phone size={14} aria-hidden /> İletişim
                                </span>
                                <input
                                    className="form-input field-control"
                                    value={supplierContact}
                                    onChange={(e) => setSupplierContact(e.target.value)}
                                    placeholder="Tel / e-posta"
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">Vade</span>
                                <input
                                    className="form-input field-control"
                                    list="stock-vade-options"
                                    value={supplierPaymentTerm}
                                    onChange={(e) => setSupplierPaymentTerm(e.target.value)}
                                    placeholder="Seçin veya yazın — örn. 40 gün"
                                    maxLength={80}
                                />
                                <datalist id="stock-vade-options">
                                    {STOCK_VADE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} />
                                    ))}
                                </datalist>
                            </label>
                            <label className="field">
                                <span className="field-label">Termin süresi</span>
                                <input
                                    className="form-input field-control"
                                    list="stock-termin-options"
                                    value={supplierLeadTime}
                                    onChange={(e) => setSupplierLeadTime(e.target.value)}
                                    placeholder="Seçin veya yazın — örn. 12 gün"
                                    maxLength={80}
                                />
                                <datalist id="stock-termin-options">
                                    {STOCK_TERMIN_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} />
                                    ))}
                                </datalist>
                            </label>
                        </div>
                    </section>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving || !description.trim()}
                        onClick={() => {
                            const payload: StockItemPayload = {
                                purchaseCode: purchaseCode.trim() || null,
                                description: description.trim(),
                                unit: unit.trim() || null,
                                quantity: String(quantity ?? '').trim() || null,
                                criticalQuantity: String(criticalQuantity ?? '').trim() || null,
                                supplierName: supplierName.trim() || null,
                                supplierContact: supplierContact.trim() || null,
                                supplierPaymentTerm: supplierPaymentTerm.trim() || null,
                                supplierLeadTime: supplierLeadTime.trim() || null
                            };
                            if (groupId !== '') {
                                payload.groupId = groupId;
                            } else if (newGroupName.trim()) {
                                payload.groupName = newGroupName.trim();
                            }
                            if (mode === 'new' && payload.groupId == null && !payload.groupName) {
                                alert('Grup seçin veya yeni grup adı girin');
                                return;
                            }
                            void onSave(payload);
                        }}
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatDateTime(iso: string | Date) {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(d);
}

function PriceSparkline({ points }: { points: StockPriceHistoryPoint[] }) {
    if (points.length < 2) {
        return (
            <div className="stock-chart-empty">
                <BarChart3 size={26} strokeWidth={1.6} />
                <p>Grafik için en az 2 fiyat kaydı gerekli.</p>
            </div>
        );
    }
    const W = 520;
    const H = 160;
    const PAD_X = 12;
    const PAD_Y_TOP = 16;
    const PAD_Y_BOT = 24;
    const sortedAll = [...points].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    const chartCurrency = sortedAll[sortedAll.length - 1]?.currency || 'TRY';
    const sorted = sortedAll.filter((p) => (p.currency || 'TRY') === chartCurrency);
    if (sorted.length < 2) {
        return (
            <div className="stock-chart-empty">
                <BarChart3 size={26} strokeWidth={1.6} />
                <p>Aynı para biriminde en az 2 fiyat kaydı gerekli.</p>
            </div>
        );
    }
    const ys = sorted.map((p) => p.unitPrice);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanY = maxY - minY || 1;
    const stepX = (W - PAD_X * 2) / (sorted.length - 1);
    const plotH = H - PAD_Y_TOP - PAD_Y_BOT;

    const xy = sorted.map((p, i) => ({
        x: PAD_X + i * stepX,
        y: PAD_Y_TOP + plotH - ((p.unitPrice - minY) / spanY) * plotH,
        p
    }));

    const path = xy.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
    const area =
        `M${xy[0].x.toFixed(1)},${(PAD_Y_TOP + plotH).toFixed(1)} ` +
        xy.map((pt) => `L${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ') +
        ` L${xy[xy.length - 1].x.toFixed(1)},${(PAD_Y_TOP + plotH).toFixed(1)} Z`;

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const overallDelta = first.unitPrice !== 0 ? ((last.unitPrice - first.unitPrice) / first.unitPrice) * 100 : null;
    const isUp = last.unitPrice >= first.unitPrice;

    return (
        <svg className="stock-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Birim fiyat trendi">
            <defs>
                <linearGradient id="stockChartFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={isUp ? 'var(--danger)' : 'var(--success)'} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={isUp ? 'var(--danger)' : 'var(--success)'} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill="url(#stockChartFill)" />
            <path
                d={path}
                fill="none"
                stroke={isUp ? 'var(--danger)' : 'var(--success)'}
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {xy.map((pt, i) => (
                <g key={pt.p.id}>
                    <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={i === xy.length - 1 ? 4.5 : 3}
                        fill="#fff"
                        stroke={isUp ? 'var(--danger)' : 'var(--success)'}
                        strokeWidth={2}
                    >
                        <title>{`${formatDateTime(pt.p.recordedAt)} → ${formatMoney(pt.p.unitPrice, pt.p.currency)}`}</title>
                    </circle>
                </g>
            ))}
            <text
                x={PAD_X}
                y={H - 6}
                fontSize="10"
                fill="var(--muted)"
                style={{ fontFamily: 'ui-sans-serif' }}
            >
                {formatDateTime(first.recordedAt)}
            </text>
            <text
                x={W - PAD_X}
                y={H - 6}
                fontSize="10"
                fill="var(--muted)"
                textAnchor="end"
                style={{ fontFamily: 'ui-sans-serif' }}
            >
                {formatDateTime(last.recordedAt)}
            </text>
            {overallDelta != null ? (
                <text
                    x={W - PAD_X}
                    y={PAD_Y_TOP - 2}
                    fontSize="11"
                    fontWeight={700}
                    textAnchor="end"
                    fill={isUp ? 'var(--danger)' : 'var(--success)'}
                >
                    {formatPct(Math.round(overallDelta * 100) / 100)}
                </text>
            ) : null}
        </svg>
    );
}

function StockDetailModal({
    itemId,
    isAdmin,
    onClose,
    onMutated,
    onEditItem,
    onAddPrice,
    onEditPrice
}: {
    itemId: number;
    isAdmin: boolean;
    onClose: () => void;
    onMutated: () => void;
    onEditItem: (row: StockItemRow) => void;
    onAddPrice: (row: StockItemRow) => void;
    onEditPrice: (row: StockItemRow, hist: StockPriceHistoryPoint) => void;
}) {
    const [detail, setDetail] = useState<StockItemDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [movementType, setMovementType] = useState<'IN' | 'OUT' | null>(null);
    const [busy, setBusy] = useState(false);
    const [docUploadOpen, setDocUploadOpen] = useState<{
        hint?: string;
        defaultKind?: StockDocumentKind;
    } | null>(null);
    const [resetStep, setResetStep] = useState<null | 'warn' | 'confirm'>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const d = await getStockItemDetail(itemId);
            setDetail(d);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [itemId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const priceChangePositive = (detail?.priceChangePercent ?? 0) > 0;
    const priceChangeNegative = (detail?.priceChangePercent ?? 0) < 0;

    const asRow = useCallback((): StockItemRow | null => {
        if (!detail) return null;
        return {
            id: detail.id,
            groupId: detail.groupId,
            group: { id: detail.group.id, name: detail.group.name },
            purchaseCode: detail.purchaseCode,
            description: detail.description,
            unit: detail.unit,
            quantity: detail.quantity != null ? String(detail.quantity) : null,
            criticalQuantity: detail.criticalQuantity != null ? String(detail.criticalQuantity) : null,
            isMainItem: Boolean(detail.isMainItem),
            supplierName: detail.supplierName,
            supplierContact: detail.supplierContact,
            supplierPaymentTerm: detail.supplierPaymentTerm ?? null,
            supplierLeadTime: detail.supplierLeadTime ?? null,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            latestUnitPrice: detail.latestUnitPrice,
            previousUnitPrice: detail.previousUnitPrice,
            latestCurrency: detail.latestCurrency,
            previousCurrency: detail.previousCurrency,
            priceChangePercent: detail.priceChangePercent
        };
    }, [detail]);

    const toggleDetailMain = async () => {
        if (!detail || busy) return;
        const next = !detail.isMainItem;
        setBusy(true);
        try {
            await updateStockItem(detail.id, { isMainItem: next });
            setDetail({ ...detail, isMainItem: next });
            onMutated();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ana kalem güncellenemedi');
        } finally {
            setBusy(false);
        }
    };

    const runReset = async () => {
        if (!detail || busy) return;
        setBusy(true);
        try {
            await resetStockItem(detail.id);
            setResetStep(null);
            await refresh();
            onMutated();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sıfırlanamadı');
            setResetStep(null);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="stock-detail-title" onClick={onClose}>
            <div
                className="modal stock-detail-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 960 }}
            >
                <div className="modal-header">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
                        <h2 className="modal-title" id="stock-detail-title" style={{ margin: 0 }}>
                            {loading ? 'Yükleniyor…' : detail?.description ?? 'Stok detayı'}
                        </h2>
                        {detail && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                {detail.purchaseCode ? (
                                    <span className="stock-code" style={{ fontSize: 11 }}>{detail.purchaseCode}</span>
                                ) : null}
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                    {detail.group.name}
                                </span>
                            </div>
                        )}
                    </div>
                    {detail && (
                        <button
                            type="button"
                            className="btn btn-secondary stock-detail-reset-btn"
                            onClick={() => setResetStep('warn')}
                            disabled={busy}
                            title="Ürüne ait tüm bilgileri sıfırla"
                        >
                            <RotateCcw size={14} />
                            Bilgileri sıfırla
                        </button>
                    )}
                    {detail && (
                        <button
                            type="button"
                            className={`btn btn-secondary stock-detail-main-btn${detail.isMainItem ? ' is-on' : ''}`}
                            onClick={() => void toggleDetailMain()}
                            disabled={busy}
                            title={detail.isMainItem ? 'Ana kalemden çıkar' : 'Ana kaleme ekle'}
                        >
                            <Star size={14} fill={detail.isMainItem ? 'currentColor' : 'none'} />
                            {detail.isMainItem ? 'Ana kalemden çıkar' : 'Ana kaleme ekle'}
                        </button>
                    )}
                    {detail && (
                        <button
                            type="button"
                            className="btn btn-secondary stock-detail-edit-btn"
                            onClick={() => {
                                const r = asRow();
                                if (r) {
                                    onEditItem(r);
                                    onClose();
                                }
                            }}
                            title="Kalemi düzenle"
                        >
                            <Pencil size={14} /> Düzenle
                        </button>
                    )}
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: '20px 22px' }}>
                    {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
                    {loading && !detail ? (
                        <div style={{ padding: '40px 0', textAlign: 'center' }}>
                            <Loader2 size={28} className="animate-spin" />
                        </div>
                    ) : detail ? (
                        <>
                            <div className="stock-detail-topgrid">
                                <div className="stock-detail-card stock-detail-card--stock">
                                    <div className="stock-detail-card-label">
                                        <Package size={14} aria-hidden /> Canlı stok
                                        <span className="stock-live" style={{ marginLeft: 'auto' }}>
                                            <span className="stock-live-dot" aria-hidden />
                                            LIVE
                                        </span>
                                    </div>
                                    <div className="stock-detail-card-value">
                                        {detail.quantity != null ? detail.quantity : '—'}{' '}
                                        <span className="stock-detail-card-unit">{detail.unit ?? ''}</span>
                                    </div>
                                    {detail.criticalQuantity != null ? (
                                        (() => {
                                            const zone = stockLevelZone(detail.quantity, detail.criticalQuantity);
                                            return (
                                        <div
                                            className={`stock-detail-critical${
                                                zone === 'critical' ? ' is-low' : zone === 'warn' ? ' is-warn' : zone === 'safe' ? ' is-safe' : ''
                                            }`}
                                        >
                                            Kritik eşik: <strong>{detail.criticalQuantity}</strong>
                                            {zone ? ` — ${stockLevelLabel(zone)}` : ''}
                                        </div>
                                            );
                                        })()
                                    ) : (
                                        <div className="stock-detail-critical stock-detail-critical--empty">
                                            Kritik stok seviyesi tanımlanmamış
                                        </div>
                                    )}
                                    <div className="stock-detail-card-actions">
                                        <button
                                            type="button"
                                            className="btn-stock-in"
                                            onClick={() => setMovementType('IN')}
                                            disabled={busy}
                                        >
                                            <Plus size={15} /> Giriş
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-stock-out"
                                            onClick={() => setMovementType('OUT')}
                                            disabled={busy}
                                        >
                                            <Minus size={15} /> Çıkış
                                        </button>
                                    </div>
                                </div>

                                <div className="stock-detail-card">
                                    <div className="stock-detail-card-label">
                                        <BarChart3 size={14} aria-hidden /> Güncel birim fiyat
                                    </div>
                                    <div className="stock-detail-card-value" style={{ fontSize: '1.4rem' }}>
                                        {formatMoney(detail.latestUnitPrice, detail.latestCurrency)}
                                    </div>
                                    {detail.previousUnitPrice != null ? (
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                            Önceki: {formatMoney(detail.previousUnitPrice, detail.previousCurrency)}
                                        </div>
                                    ) : null}
                                    <div className="stock-detail-card-actions" style={{ marginTop: 'auto' }}>
                                        <button
                                            type="button"
                                            className="btn-stock-price"
                                            onClick={() => {
                                                const r = asRow();
                                                if (r) {
                                                    onAddPrice(r);
                                                    onClose();
                                                }
                                            }}
                                        >
                                            <Plus size={14} /> Fiyat ekle
                                        </button>
                                    </div>
                                </div>

                                <div
                                    className={`stock-detail-card stock-detail-alert ${
                                        priceChangePositive
                                            ? 'stock-detail-alert--up'
                                            : priceChangeNegative
                                            ? 'stock-detail-alert--down'
                                            : ''
                                    }`}
                                >
                                    <div className="stock-detail-card-label">
                                        {priceChangePositive ? (
                                            <ArrowUpRight size={14} aria-hidden />
                                        ) : priceChangeNegative ? (
                                            <ArrowDownRight size={14} aria-hidden />
                                        ) : (
                                            <Repeat size={14} aria-hidden />
                                        )}
                                        Önceki alıma göre
                                    </div>
                                    <div className="stock-detail-card-value" style={{ fontSize: '1.4rem' }}>
                                        {detail.priceChangePercent != null
                                            ? formatPct(detail.priceChangePercent)
                                            : '—'}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            marginTop: 4,
                                            lineHeight: 1.4
                                        }}
                                    >
                                        {priceChangePositive
                                            ? `Birim fiyatta ${formatMoney(detail.priceChangeAbs ?? 0, detail.latestCurrency)} artış var.`
                                            : priceChangeNegative
                                            ? `Birim fiyatta ${formatMoney(Math.abs(detail.priceChangeAbs ?? 0), detail.latestCurrency)} azalış var.`
                                            : detail.priceChangePercent === 0
                                            ? 'Fiyatta değişiklik yok.'
                                            : detail.latestCurrency &&
                                                detail.previousCurrency &&
                                                detail.latestCurrency !== detail.previousCurrency
                                              ? 'Son iki fiyat farklı para biriminde; yüzde fark hesaplanmadı.'
                                            : 'Karşılaştırma için en az iki fiyat kaydı gerekli.'}
                                    </div>
                                </div>
                            </div>

                            <section className="stock-detail-section">
                                <header className="stock-detail-section-head">
                                    <h3>
                                        <BarChart3 size={16} aria-hidden /> Birim fiyat grafiği
                                    </h3>
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        {detail.priceHistory.length} kayıt
                                    </span>
                                </header>
                                <div className="stock-detail-chart-wrap">
                                    <PriceSparkline points={detail.priceHistory} />
                                </div>
                                {detail.priceHistory.length > 0 ? (
                                    <ul className="stock-detail-pricelist">
                                        {detail.priceHistory.slice(0, 6).map((p, i, arr) => {
                                            const next = arr[i + 1];
                                            const sameCurrency =
                                                next != null && (p.currency || 'TRY') === (next.currency || 'TRY');
                                            const diff =
                                                sameCurrency && next && next.unitPrice !== 0
                                                    ? ((p.unitPrice - next.unitPrice) / next.unitPrice) * 100
                                                    : null;
                                            const up = diff != null && diff > 0;
                                            const down = diff != null && diff < 0;
                                            return (
                                                <li key={p.id}>
                                                    <span className="stock-detail-pricelist-date">
                                                        {formatDateTime(p.recordedAt)}
                                                    </span>
                                                    <span className="stock-detail-pricelist-price">
                                                        {formatMoney(p.unitPrice, p.currency)}
                                                    </span>
                                                    {diff != null ? (
                                                        <span
                                                            className={`stock-delta ${
                                                                up ? 'stock-delta--up' : down ? 'stock-delta--down' : ''
                                                            }`}
                                                        >
                                                            {up ? <TrendingUp size={11} /> : down ? <TrendingDown size={11} /> : null}
                                                            {formatPct(Math.round(diff * 100) / 100)}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>ilk</span>
                                                    )}
                                                    <span
                                                        className="stock-detail-pricelist-supplier"
                                                        title={
                                                            [p.supplierName, p.supplierContact].filter(Boolean).join(' · ') ||
                                                            undefined
                                                        }
                                                    >
                                                        {p.supplierName ?? (
                                                            <span style={{ color: 'var(--muted)' }}>—</span>
                                                        )}
                                                    </span>
                                                    {p.note ? (
                                                        <span className="stock-detail-pricelist-note" title={p.note}>
                                                            {p.note}
                                                        </span>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="icon-btn"
                                                        title="Fiyatı düzelt"
                                                        disabled={busy}
                                                        onClick={() => {
                                                            const r = asRow();
                                                            if (r) onEditPrice(r, p);
                                                        }}
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    {isAdmin ? (
                                                        <button
                                                            type="button"
                                                            className="icon-btn icon-btn--danger"
                                                            title="Fiyat kaydını sil"
                                                            disabled={busy}
                                                            onClick={async () => {
                                                                if (!confirm('Bu fiyat kaydını silmek istiyor musunuz?')) return;
                                                                try {
                                                                    setBusy(true);
                                                                    await deleteStockPriceHistory(itemId, p.id);
                                                                    await refresh();
                                                                    onMutated();
                                                                } catch (e) {
                                                                    alert(e instanceof Error ? e.message : 'Silinemedi');
                                                                } finally {
                                                                    setBusy(false);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    ) : null}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : null}
                            </section>

                            <section className="stock-detail-section">
                                <header className="stock-detail-section-head">
                                    <h3>
                                        <Building2 size={16} aria-hidden /> Tedarikçi
                                    </h3>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                        onClick={() => setSupplierOpen(true)}
                                    >
                                        {hasStockSupplier(detail) ? (
                                            <>
                                                <Repeat size={14} /> Tedarikçiyi değiştir
                                            </>
                                        ) : (
                                            <>
                                                <Plus size={14} /> İlk tedarikçiyi gir
                                            </>
                                        )}
                                    </button>
                                </header>
                                <div className="stock-detail-supplier">
                                    <div>
                                        <div className="stock-detail-label">Firma</div>
                                        <div className="stock-detail-value">
                                            {detail.supplierName ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="stock-detail-label">
                                            <Phone size={12} aria-hidden /> İletişim
                                        </div>
                                        <div
                                            className="stock-detail-value"
                                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                        >
                                            {detail.supplierContact ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="stock-detail-label">Vade</div>
                                        <div className="stock-detail-value">
                                            {detail.supplierPaymentTerm ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="stock-detail-label">Termin</div>
                                        <div className="stock-detail-value">
                                            {detail.supplierLeadTime ?? <span style={{ color: 'var(--muted)' }}>—</span>}
                                        </div>
                                    </div>
                                </div>
                                {detail.supplierHistory.length > 0 ? (
                                    <details className="stock-detail-hist">
                                        <summary>
                                            <History size={13} aria-hidden />
                                            Tedarikçi değişiklik geçmişi ({detail.supplierHistory.length})
                                        </summary>
                                        <ul>
                                            {detail.supplierHistory.map((s) => (
                                                <li key={s.id}>
                                                    <span className="stock-detail-hist-date">
                                                        {formatDateTime(s.recordedAt)}
                                                    </span>
                                                    <span className="stock-detail-hist-body">
                                                        <span className="stock-hist-flow">
                                                            {s.prevSupplierName || s.prevSupplierContact ? (
                                                                <>
                                                                    <span
                                                                        className="stock-hist-chip stock-hist-chip--from"
                                                                        title={[s.prevSupplierName, s.prevSupplierContact].filter(Boolean).join(' · ') || undefined}
                                                                    >
                                                                        <span className="stock-hist-tag stock-hist-tag--from">Eski</span>
                                                                        <Building2 size={14} aria-hidden className="stock-hist-chip-ic" />
                                                                        <span className="stock-hist-chip-name">{s.prevSupplierName ?? '—'}</span>
                                                                        {s.prevSupplierContact ? (
                                                                            <>
                                                                                <Phone size={13} aria-hidden className="stock-hist-chip-ic stock-hist-chip-ic--muted" />
                                                                                <span className="stock-hist-chip-meta">{s.prevSupplierContact}</span>
                                                                            </>
                                                                        ) : null}
                                                                    </span>
                                                                    <span className="stock-hist-arrow" aria-hidden>
                                                                        <ArrowRight size={16} />
                                                                    </span>
                                                                </>
                                                            ) : null}
                                                            <span
                                                                className="stock-hist-chip stock-hist-chip--to"
                                                                title={[s.supplierName, s.supplierContact, s.supplierPaymentTerm, s.supplierLeadTime].filter(Boolean).join(' · ') || undefined}
                                                            >
                                                                <span className="stock-hist-tag stock-hist-tag--to">Yeni</span>
                                                                <Building2 size={14} aria-hidden className="stock-hist-chip-ic" />
                                                                <span className="stock-hist-chip-name">{s.supplierName ?? '—'}</span>
                                                                {s.supplierContact ? (
                                                                    <>
                                                                        <Phone size={13} aria-hidden className="stock-hist-chip-ic stock-hist-chip-ic--muted" />
                                                                        <span className="stock-hist-chip-meta">{s.supplierContact}</span>
                                                                    </>
                                                                ) : null}
                                                                {s.supplierPaymentTerm ? (
                                                                    <span className="stock-hist-chip-meta">· Vade: {s.supplierPaymentTerm}</span>
                                                                ) : null}
                                                                {s.supplierLeadTime ? (
                                                                    <span className="stock-hist-chip-meta">· Termin: {s.supplierLeadTime}</span>
                                                                ) : null}
                                                            </span>
                                                        </span>
                                                        {s.note ? (
                                                            <span className="stock-hist-note" title={s.note}>
                                                                <span className="stock-hist-note-label">Neden:</span>
                                                                {s.note}
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    {s.user ? (
                                                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                                            {s.user.fullName}
                                                        </span>
                                                    ) : null}
                                                    {isAdmin ? (
                                                        <button
                                                            type="button"
                                                            className="icon-btn icon-btn--danger"
                                                            title="Geçmiş kaydını sil"
                                                            disabled={busy}
                                                            onClick={async () => {
                                                                if (!confirm('Bu tedarikçi geçmiş kaydını silmek istiyor musunuz?')) return;
                                                                try {
                                                                    setBusy(true);
                                                                    await deleteStockSupplierHistory(itemId, s.id);
                                                                    await refresh();
                                                                    onMutated();
                                                                } catch (e) {
                                                                    alert(e instanceof Error ? e.message : 'Silinemedi');
                                                                } finally {
                                                                    setBusy(false);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                ) : null}
                            </section>

                            <section className="stock-detail-section">
                                <header className="stock-detail-section-head">
                                    <h3>
                                        <FileImage size={16} aria-hidden /> Ürün / teknik resim
                                    </h3>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                        onClick={() => setDocUploadOpen({})}
                                    >
                                        <Plus size={14} /> Dosya yükle
                                    </button>
                                </header>
                                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
                                    Tedarikçi değişince yeni resim/teknik çizim ekleyin; eskiler geçmiş olarak kalır.
                                </p>
                                {(detail.documents?.length ?? 0) === 0 ? (
                                    <div className="stock-empty" style={{ padding: '24px 12px', margin: 0 }}>
                                        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                                            Henüz ürün veya teknik resim yok.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="stock-doc-list">
                                        {(detail.documents ?? []).map((doc, idx) => {
                                            const url = getStockItemDocumentUrl(itemId, doc.id);
                                            const kindLabel =
                                                STOCK_DOC_KIND_LABELS[doc.kind as StockDocumentKind] || doc.kind;
                                            const isLatest = idx === 0;
                                            return (
                                                <li key={doc.id} className={`stock-doc-card${isLatest ? ' is-latest' : ''}`}>
                                                    <a
                                                        className="stock-doc-thumb"
                                                        href={url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title="Aç"
                                                    >
                                                        {doc.isImage || String(doc.mimeType).startsWith('image/') ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={url} alt={doc.originalFileName || kindLabel} />
                                                        ) : (
                                                            <span className="stock-doc-pdf">
                                                                <FileText size={28} />
                                                                <span>PDF</span>
                                                            </span>
                                                        )}
                                                    </a>
                                                    <div className="stock-doc-meta">
                                                        <div className="stock-doc-title-row">
                                                            <span className="stock-doc-kind">
                                                                {doc.kind === 'TECH_DRAWING' ? (
                                                                    <FileText size={13} />
                                                                ) : (
                                                                    <ImageIcon size={13} />
                                                                )}
                                                                {kindLabel}
                                                            </span>
                                                            {isLatest ? <span className="stock-doc-badge">Güncel</span> : null}
                                                        </div>
                                                        <div className="stock-doc-date">{formatDateTime(doc.createdAt)}</div>
                                                        {doc.supplierName ? (
                                                            <div className="stock-doc-supplier" title={doc.supplierName}>
                                                                <Building2 size={12} /> {doc.supplierName}
                                                            </div>
                                                        ) : null}
                                                        <div className="stock-doc-file">
                                                            {doc.originalFileName || 'dosya'} · {formatBytes(doc.sizeBytes)}
                                                        </div>
                                                        {doc.note ? (
                                                            <div className="stock-doc-note" title={doc.note}>
                                                                {doc.note}
                                                            </div>
                                                        ) : null}
                                                        <div className="stock-doc-actions">
                                                            <a className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} href={url} target="_blank" rel="noreferrer">
                                                                Aç
                                                            </a>
                                                            {isAdmin ? (
                                                                <button
                                                                    type="button"
                                                                    className="icon-btn icon-btn--danger"
                                                                    title="Sil"
                                                                    disabled={busy}
                                                                    onClick={async () => {
                                                                        if (!confirm('Bu dosyayı silmek istiyor musunuz?')) return;
                                                                        try {
                                                                            setBusy(true);
                                                                            await deleteStockItemDocument(itemId, doc.id);
                                                                            await refresh();
                                                                            onMutated();
                                                                        } catch (e) {
                                                                            alert(e instanceof Error ? e.message : 'Silinemedi');
                                                                        } finally {
                                                                            setBusy(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </section>

                            <section className="stock-detail-section">
                                <header className="stock-detail-section-head">
                                    <h3>
                                        <Repeat size={16} aria-hidden /> Stok hareketleri
                                    </h3>
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                        {detail.movements.length} kayıt
                                    </span>
                                </header>
                                {detail.movements.length === 0 ? (
                                    <div className="stock-empty" style={{ padding: '24px 12px', margin: 0 }}>
                                        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                                            Henüz giriş/çıkış hareketi yok.
                                        </p>
                                    </div>
                                ) : (
                                    <ul className="stock-movements">
                                        {detail.movements.map((m) => (
                                            <li key={m.id} className={`stock-mv stock-mv--${m.type.toLowerCase()}`}>
                                                <span className="stock-mv-icon" aria-hidden>
                                                    {m.type === 'IN' ? <Plus size={14} /> : <Minus size={14} />}
                                                </span>
                                                <span className="stock-mv-type">
                                                    {m.type === 'IN' ? 'GİRİŞ' : 'ÇIKIŞ'}
                                                </span>
                                                <span className="stock-mv-qty">
                                                    {m.type === 'IN' ? '+' : '−'}
                                                    {m.quantity}
                                                </span>
                                                <span className="stock-mv-balance">
                                                    Kalan: <strong>{m.balanceAfter ?? '—'}</strong>
                                                </span>
                                                <span className="stock-mv-date">{formatDateTime(m.recordedAt)}</span>
                                                {m.note ? <span className="stock-mv-note" title={m.note}>{m.note}</span> : null}
                                                {m.user ? (
                                                    <span className="stock-mv-user">{m.user.fullName}</span>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </>
                    ) : null}
                </div>
            </div>

            {supplierOpen && detail && (
                <SupplierChangeModal
                    mode={hasStockSupplier(detail) ? 'change' : 'first'}
                    current={{
                        supplierName: detail.supplierName,
                        supplierContact: detail.supplierContact,
                        supplierPaymentTerm: detail.supplierPaymentTerm ?? null,
                        supplierLeadTime: detail.supplierLeadTime ?? null
                    }}
                    saving={busy}
                    onClose={() => !busy && setSupplierOpen(false)}
                    onSave={async (name, contact, paymentTerm, leadTime, note) => {
                        const wasFirst = !hasStockSupplier(detail);
                        try {
                            setBusy(true);
                            await changeStockSupplier(itemId, {
                                supplierName: name,
                                supplierContact: contact,
                                supplierPaymentTerm: paymentTerm,
                                supplierLeadTime: leadTime,
                                note
                            });
                            setSupplierOpen(false);
                            await refresh();
                            onMutated();
                            setDocUploadOpen({
                                hint: wasFirst
                                    ? 'İlk tedarikçi kaydedildi. İsterseniz ürün veya teknik resim yükleyebilirsiniz.'
                                    : 'Tedarikçi değişti. Yeni tedarikçiye ait ürün veya teknik resmi yükleyin; eski dosyalar geçmişte kalır.',
                                defaultKind: 'TECH_DRAWING',
                            });
                        } catch (e) {
                            alert(e instanceof Error ? e.message : 'Kaydedilemedi');
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}

            {docUploadOpen && detail && (
                <StockDocumentUploadModal
                    itemDescription={detail.description}
                    supplierName={detail.supplierName}
                    hint={docUploadOpen.hint}
                    defaultKind={docUploadOpen.defaultKind || 'PRODUCT_IMAGE'}
                    saving={busy}
                    onClose={() => !busy && setDocUploadOpen(null)}
                    onSave={async (payload) => {
                        try {
                            setBusy(true);
                            await addStockItemDocument(itemId, payload);
                            setDocUploadOpen(null);
                            await refresh();
                            onMutated();
                        } catch (e) {
                            alert(e instanceof Error ? e.message : 'Yüklenemedi');
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}

            {movementType && detail && (
                <MovementModal
                    type={movementType}
                    unit={detail.unit}
                    current={detail.quantity}
                    saving={busy}
                    onClose={() => !busy && setMovementType(null)}
                    onSave={async (qty, note) => {
                        try {
                            setBusy(true);
                            await addStockMovement(itemId, { type: movementType, quantity: qty, note });
                            setMovementType(null);
                            await refresh();
                            onMutated();
                        } catch (e) {
                            alert(e instanceof Error ? e.message : 'Kaydedilemedi');
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}

            {resetStep && detail && (
                <div
                    className="modal-overlay stock-reset-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="stock-reset-title"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!busy) setResetStep(null);
                    }}
                >
                    <div
                        className="modal modal--premium stock-reset-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: 480 }}
                    >
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title" id="stock-reset-title">
                                    {resetStep === 'warn' ? 'Uyarı: Bilgiler silinecek' : 'Emin misiniz?'}
                                </h2>
                                <p className="modal-subtitle">
                                    {detail.description}
                                    {detail.purchaseCode ? ` (${detail.purchaseCode})` : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="modal-close"
                                onClick={() => !busy && setResetStep(null)}
                                disabled={busy}
                                aria-label="Kapat"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '20px 22px' }}>
                            {resetStep === 'warn' ? (
                                <div className="stock-reset-warn">
                                    <p>
                                        Bu işleme devam ederseniz ürüne ait <strong>bütün bilgiler kalıcı olarak
                                        silinecek</strong>:
                                    </p>
                                    <ul>
                                        <li>Güncel stok miktarı ve kritik stok seviyesi</li>
                                        <li>Tedarikçi bilgileri (firma, iletişim, vade, termin)</li>
                                        <li>Ana kalem işareti</li>
                                        <li>Tüm birim fiyat geçmişi</li>
                                        <li>Tüm stok giriş/çıkış hareketleri</li>
                                        <li>Tedarikçi değişiklik geçmişi</li>
                                        <li>Ürün ve teknik resimler</li>
                                    </ul>
                                    <p className="stock-reset-keep">
                                        Yalnızca grup, satınalma kodu, malzeme tanımı ve birim kalır. Bu işlem geri
                                        alınamaz.
                                    </p>
                                </div>
                            ) : (
                                <div className="stock-reset-warn stock-reset-warn--final">
                                    <p>
                                        <strong>Son onay:</strong> Yukarıda listelenen tüm bilgiler silinecek. Emin
                                        misiniz?
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setResetStep(null)}
                                disabled={busy}
                            >
                                Vazgeç
                            </button>
                            {resetStep === 'warn' ? (
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => setResetStep('confirm')}
                                    disabled={busy}
                                >
                                    Anladım, devam et
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={() => void runReset()}
                                    disabled={busy}
                                >
                                    {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                    Evet, tüm bilgileri sil
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MovementModal({
    type,
    unit,
    current,
    saving,
    onClose,
    onSave
}: {
    type: 'IN' | 'OUT';
    unit: string | null;
    current: number | null;
    saving: boolean;
    onClose: () => void;
    onSave: (qty: number, note: string | null) => Promise<void>;
}) {
    const [qty, setQty] = useState('');
    const [note, setNote] = useState('');
    const isIn = type === 'IN';
    return (
        <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1100 }}
            onClick={onClose}
        >
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{isIn ? 'Stok girişi' : 'Stok çıkışı'}</h2>
                        <p className="modal-subtitle">
                            Mevcut stoğa göre hareket ekleyin. İsterseniz açıklayıcı bir not bırakın.
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 24 }}>
                    <p
                        style={{
                            fontSize: '0.88rem',
                            color: 'var(--muted)',
                            padding: '10px 12px',
                            background: 'var(--secondary)',
                            borderRadius: 10,
                            marginBottom: 16
                        }}
                    >
                        Mevcut stok: <strong style={{ color: 'var(--foreground)' }}>{current ?? 0}</strong>{' '}
                        {unit ?? ''}
                    </p>
                    <label>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            {isIn ? 'Giriş miktarı *' : 'Çıkış miktarı *'}
                        </span>
                        <input
                            className="form-input"
                            style={{ fontSize: '1.05rem', fontWeight: 600, borderRadius: 10 }}
                            type="text"
                            inputMode="decimal"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            placeholder="0"
                            autoFocus
                        />
                    </label>
                    <label style={{ display: 'block', marginTop: 14 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            Not (isteğe bağlı)
                        </span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={isIn ? 'İrsaliye no, fatura, tedarikçi…' : 'İmalat no, iş emri…'}
                        />
                    </label>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className={isIn ? 'btn btn-primary' : 'btn btn-danger'}
                        disabled={saving}
                        onClick={() => {
                            const n = Number(String(qty).replace(',', '.'));
                            if (!Number.isFinite(n) || n <= 0) {
                                alert('Geçerli bir miktar girin');
                                return;
                            }
                            void onSave(n, note.trim() || null);
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isIn ? 'Girişi kaydet' : 'Çıkışı kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SupplierChangeModal({
    mode = 'change',
    current,
    saving,
    onClose,
    onSave
}: {
    mode?: 'first' | 'change';
    current: {
        supplierName: string | null;
        supplierContact: string | null;
        supplierPaymentTerm: string | null;
        supplierLeadTime: string | null;
    };
    saving: boolean;
    onClose: () => void;
    onSave: (
        name: string | null,
        contact: string | null,
        paymentTerm: string | null,
        leadTime: string | null,
        note: string | null
    ) => Promise<void>;
}) {
    const isFirst = mode === 'first';
    const [name, setName] = useState(isFirst ? '' : current.supplierName ?? '');
    const [contact, setContact] = useState(isFirst ? '' : current.supplierContact ?? '');
    const [paymentTerm, setPaymentTerm] = useState(isFirst ? '' : current.supplierPaymentTerm ?? '');
    const [leadTime, setLeadTime] = useState(isFirst ? '' : current.supplierLeadTime ?? '');
    const [note, setNote] = useState('');
    return (
        <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1100 }}
            onClick={onClose}
        >
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{isFirst ? 'İlk tedarikçiyi gir' : 'Tedarikçiyi değiştir'}</h2>
                        <p className="modal-subtitle">
                            {isFirst
                                ? 'Bu ürün için ilk tedarikçi bilgilerini girin. Kayıttan sonra ürün/teknik resim yükleyebilirsiniz.'
                                : 'Firma, iletişim, vade ve termin bilgisini girin. Kayıttan sonra yeni ürün/teknik resmi yüklemeniz istenir.'}
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 24 }}>
                    <label>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            {isFirst ? 'Firma adı' : 'Yeni firma adı'}
                        </span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </label>
                    <label style={{ display: 'block', marginTop: 14 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            {isFirst ? 'İletişim (tel / e-posta)' : 'Yeni iletişim (tel / e-posta)'}
                        </span>
                        <textarea
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            rows={2}
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                        />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                        <label>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                                Vade (bu üründe)
                            </span>
                            <input
                                className="form-input"
                                style={{ borderRadius: 10 }}
                                list="stock-supplier-vade-options"
                                value={paymentTerm}
                                onChange={(e) => setPaymentTerm(e.target.value)}
                                placeholder="Seçin veya yazın — örn. 40 gün"
                                maxLength={80}
                            />
                            <datalist id="stock-supplier-vade-options">
                                {STOCK_VADE_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt} />
                                ))}
                            </datalist>
                        </label>
                        <label>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                                Termin süresi
                            </span>
                            <input
                                className="form-input"
                                style={{ borderRadius: 10 }}
                                list="stock-supplier-termin-options"
                                value={leadTime}
                                onChange={(e) => setLeadTime(e.target.value)}
                                placeholder="Seçin veya yazın — örn. 12 gün"
                                maxLength={80}
                            />
                            <datalist id="stock-supplier-termin-options">
                                {STOCK_TERMIN_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt} />
                                ))}
                            </datalist>
                        </label>
                    </div>
                    {!isFirst ? (
                        <label style={{ display: 'block', marginTop: 14 }}>
                            <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                                Değişiklik notu (isteğe bağlı)
                            </span>
                            <input
                                className="form-input"
                                style={{ borderRadius: 10 }}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Neden değişti?"
                            />
                        </label>
                    ) : null}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                            saving ||
                            (name.trim() === '' &&
                                contact.trim() === '' &&
                                paymentTerm.trim() === '' &&
                                leadTime.trim() === '')
                        }
                        onClick={() =>
                            void onSave(
                                name.trim() || null,
                                contact.trim() || null,
                                paymentTerm.trim() || null,
                                leadTime.trim() || null,
                                note.trim() || null
                            )
                        }
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isFirst ? 'İlk tedarikçiyi kaydet' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PriceModal({
    item,
    edit,
    saving,
    onClose,
    onSave
}: {
    item: StockItemRow;
    edit?: StockPriceHistoryPoint;
    saving: boolean;
    onClose: () => void;
    onSave: (unitPrice: number, currency: StockPriceCurrency, note: string | null) => Promise<void>;
}) {
    const isEdit = Boolean(edit);
    const [price, setPrice] = useState(edit != null ? String(edit.unitPrice).replace('.', ',') : '');
    const [currency, setCurrency] = useState<StockPriceCurrency>(
        (edit?.currency as StockPriceCurrency) || item.latestCurrency || 'TRY'
    );
    const [note, setNote] = useState(edit?.note ?? '');

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="stock-price-modal-title" onClick={onClose}>
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="stock-price-modal-title">
                            {isEdit ? 'Fiyatı düzelt' : 'Birim fiyat kaydı'}
                        </h2>
                        <p className="modal-subtitle">
                            {isEdit
                                ? 'Yanlış girilen fiyatı, para birimini veya notu güncelleyin. Tarih aynı kalır.'
                                : 'Fiyat geçmişi otomatik tutulur. Not alanına fatura/tedarikçi gibi referans ekleyebilirsiniz.'}
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: '24px' }}>
                    <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--muted)',
                            lineHeight: 1.5,
                            padding: '12px 14px',
                            background: 'var(--secondary)',
                            borderRadius: 12,
                            border: '1px solid var(--border)',
                            marginBottom: '18px'
                        }}
                    >
                        {item.description}
                        {isEdit && edit ? (
                            <>
                                <br />
                                <span style={{ fontSize: '0.8rem' }}>
                                    Kayıt tarihi: {formatDateTime(edit.recordedAt)}
                                </span>
                            </>
                        ) : null}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
                        <label>
                            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>Birim fiyat *</span>
                            <input
                                className="form-input"
                                style={{ borderRadius: 10, fontSize: '1.05rem', fontWeight: 600 }}
                                type="text"
                                inputMode="decimal"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="0,00"
                                autoFocus
                            />
                        </label>
                        <label>
                            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>Para birimi *</span>
                            <select
                                className="form-input"
                                style={{ borderRadius: 10, fontSize: '0.95rem', fontWeight: 600 }}
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as StockPriceCurrency)}
                            >
                                {STOCK_CURRENCY_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <label style={{ display: 'block', marginTop: '16px' }}>
                        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>Not (isteğe bağlı)</span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Fatura no, tarih, tedarikçi…"
                        />
                    </label>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.45 }}>
                        {isEdit
                            ? 'Düzeltme mevcut kaydı günceller; yeni satır eklenmez.'
                            : 'Her kayıt fiyat geçmişine eklenir; aynı para birimindeki son iki fiyat üzerinden yüzde değişim gösterilir.'}
                    </p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => {
                            const n = Number(String(price).replace(',', '.'));
                            if (!Number.isFinite(n)) {
                                alert('Geçerli bir fiyat girin');
                                return;
                            }
                            void onSave(n, currency, note.trim() || null);
                        }}
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                        {isEdit ? 'Düzeltmeyi kaydet' : 'Kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StockDocumentUploadModal({
    itemDescription,
    supplierName,
    hint,
    defaultKind,
    saving,
    onClose,
    onSave,
}: {
    itemDescription: string;
    supplierName: string | null;
    hint?: string;
    defaultKind: StockDocumentKind;
    saving: boolean;
    onClose: () => void;
    onSave: (payload: {
        kind: StockDocumentKind;
        mimeType: string;
        dataBase64: string;
        originalFileName?: string | null;
        note?: string | null;
        supplierName?: string | null;
    }) => Promise<void>;
}) {
    const [kind, setKind] = useState<StockDocumentKind>(defaultKind);
    const [docSupplierName, setDocSupplierName] = useState(supplierName ?? '');
    const [note, setNote] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [payload, setPayload] = useState<{ mimeType: string; dataBase64: string; fileName: string } | null>(null);
    const [preparing, setPreparing] = useState(false);

    return (
        <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            style={{ zIndex: 1200 }}
            onClick={onClose}
        >
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Ürün / teknik resim yükle</h2>
                        <p className="modal-subtitle">
                            JPEG, PNG, WebP veya PDF. Max 4MB. Eski dosyalar silinmez, geçmişte kalır.
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving || preparing} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 24 }}>
                    {hint ? (
                        <p
                            style={{
                                fontSize: '0.88rem',
                                color: 'var(--foreground)',
                                lineHeight: 1.5,
                                padding: '12px 14px',
                                background: 'color-mix(in srgb, var(--primary) 10%, var(--card))',
                                borderRadius: 12,
                                border: '1px solid color-mix(in srgb, var(--primary) 25%, var(--border))',
                                marginBottom: 16,
                            }}
                        >
                            {hint}
                        </p>
                    ) : null}
                    <p
                        style={{
                            fontSize: '0.9rem',
                            color: 'var(--muted)',
                            lineHeight: 1.5,
                            padding: '12px 14px',
                            background: 'var(--secondary)',
                            borderRadius: 12,
                            border: '1px solid var(--border)',
                            marginBottom: 16,
                        }}
                    >
                        {itemDescription}
                    </p>
                    <label style={{ display: 'block', marginBottom: 14 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            <Building2 size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-1px' }} aria-hidden />
                            Tedarikçi adı *
                        </span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            value={docSupplierName}
                            onChange={(e) => setDocSupplierName(e.target.value)}
                            placeholder="Bu resmin / çizimin ait olduğu tedarikçi"
                            autoFocus={!supplierName}
                        />
                    </label>
                    <label style={{ display: 'block', marginBottom: 14 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            Dosya tipi *
                        </span>
                        <select
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            value={kind}
                            onChange={(e) => setKind(e.target.value as StockDocumentKind)}
                        >
                            <option value="PRODUCT_IMAGE">Ürün resmi</option>
                            <option value="TECH_DRAWING">Teknik resim</option>
                        </select>
                    </label>
                    <label style={{ display: 'block', marginBottom: 14 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            Dosya *
                        </span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
                            disabled={saving || preparing}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                void (async () => {
                                    try {
                                        setPreparing(true);
                                        const next = await fileToStockDocumentPayload(file);
                                        setPayload(next);
                                        setFileName(next.fileName);
                                    } catch (err) {
                                        setPayload(null);
                                        setFileName(null);
                                        alert(err instanceof Error ? err.message : 'Dosya hazırlanamadı');
                                    } finally {
                                        setPreparing(false);
                                    }
                                })();
                            }}
                        />
                        {preparing ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                                <Loader2 size={14} className="animate-spin" /> Hazırlanıyor…
                            </span>
                        ) : fileName ? (
                            <span style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--foreground)' }}>
                                Seçildi: {fileName}
                            </span>
                        ) : null}
                    </label>
                    <label style={{ display: 'block' }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            Not (isteğe bağlı)
                        </span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Revizyon, parça kodu…"
                        />
                    </label>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving || preparing}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving || preparing || !payload || !docSupplierName.trim()}
                        onClick={() => {
                            if (!payload) return;
                            const sn = docSupplierName.trim();
                            if (!sn) {
                                alert('Tedarikçi adı girin');
                                return;
                            }
                            void onSave({
                                kind,
                                mimeType: payload.mimeType,
                                dataBase64: payload.dataBase64,
                                originalFileName: payload.fileName,
                                note: note.trim() || null,
                                supplierName: sn,
                            });
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        Yükle
                    </button>
                </div>
            </div>
        </div>
    );
}
