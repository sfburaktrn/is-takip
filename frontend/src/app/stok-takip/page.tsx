'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { useAuth } from '@/lib/AuthContext';
import {
    addStockItemPrice,
    addStockMovement,
    changeStockSupplier,
    deleteStockPriceHistory,
    deleteStockSupplierHistory,
    createStockItem,
    getStockGroups,
    getStockItemDetail,
    getStockItems,
    updateStockItem,
    type StockGroupRow,
    type StockItemDetail,
    type StockItemRow,
    type StockPriceHistoryPoint
} from '@/lib/api';
import {
    ArrowDownRight,
    ArrowUpRight,
    ArrowRight,
    BarChart3,
    Building2,
    Hash,
    History,
    Layers,
    Loader2,
    Minus,
    Package,
    Pencil,
    Phone,
    Plus,
    RefreshCcw,
    Repeat,
    Search,
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
    supplierName: string | null;
    supplierContact: string | null;
};

function formatTry(n: number | null | undefined) {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n);
}

function formatPct(p: number | null | undefined) {
    if (p == null || Number.isNaN(p)) return '—';
    const sign = p > 0 ? '+' : '';
    return `${sign}${p.toFixed(2).replace('.', ',')} %`;
}

export default function StokTakipPage() {
    const { isAdmin } = useAuth();
    const [groups, setGroups] = useState<StockGroupRow[]>([]);
    const [items, setItems] = useState<StockItemRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [groupFilter, setGroupFilter] = useState<number | 'all'>('all');
    const [searchInput, setSearchInput] = useState('');
    const [searchQ, setSearchQ] = useState('');

    const [itemModal, setItemModal] = useState<'new' | StockItemRow | null>(null);
    const [priceModal, setPriceModal] = useState<StockItemRow | null>(null);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

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
    }, [groupFilter, searchQ]);

    useEffect(() => {
        void load();
    }, [load]);

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
                <main className="main-content stock-page">
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
                            <button type="button" className="btn btn-primary" onClick={() => setItemModal('new')} style={{ background: '#fff', color: 'var(--primary)', border: 'none', boxShadow: '0 4px 14px rgba(0,0,0,0.12)' }}>
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
                        {searchInput.length > 0 && searchInput.length < 2 ? (
                            <p className="stock-hint">Aramayı başlatmak için en az 2 karakter yazın.</p>
                        ) : searchQ.length >= 2 ? (
                            <p className="stock-hint">
                                <strong>{searchQ}</strong> için sonuçlar gösteriliyor.
                            </p>
                        ) : null}
                    </div>

                    {error && (
                        <div className="alert alert-error" style={{ margin: '0 0 20px' }}>
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
                                Filtreleri veya aramayı değiştirin; yeni kalem eklemek için üstteki <strong>Yeni kalem</strong> düğmesini kullanın.
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
                                                <col className="stock-col-code" />
                                                <col className="stock-col-desc" />
                                                <col className="stock-col-unit" />
                                                <col className="stock-col-qty" />
                                                <col className="stock-col-supp" />
                                                <col className="stock-col-contact" />
                                                <col className="stock-col-price" />
                                                <col className="stock-col-delta" />
                                            </colgroup>
                                            <thead>
                                                <tr>
                                                    <th scope="col">Kod</th>
                                                    <th scope="col">Malzeme</th>
                                                    <th scope="col">Birim</th>
                                                    <th scope="col" className="stock-th-num">
                                                        Stok
                                                    </th>
                                                    <th scope="col">Tedarikçi</th>
                                                    <th scope="col">İletişim</th>
                                                    <th scope="col" className="stock-th-num">
                                                        Birim fiyat
                                                    </th>
                                                    <th scope="col" className="stock-th-num stock-th-nowrap" title="Önceki birim fiyata göre değişim">
                                                        Fark %
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map((row) => (
                                                    <tr
                                                        key={row.id}
                                                        className="stock-row-clickable"
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
                                                        <td className="stock-td-num">
                                                            <span className="stock-price">{formatTry(row.latestUnitPrice)}</span>
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
                                                ))}
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

                    {priceModal && (
                        <PriceModal
                            item={priceModal}
                            saving={saving}
                            onClose={() => !saving && setPriceModal(null)}
                            onSave={async (unitPrice, note) => {
                                try {
                                    setSaving(true);
                                    await addStockItemPrice(priceModal.id, { unitPrice, note });
                                    setPriceModal(null);
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
                            itemId={detailId}
                            isAdmin={isAdmin}
                            onClose={() => setDetailId(null)}
                            onMutated={() => void load()}
                            onEditItem={(row) => setItemModal(row)}
                            onAddPrice={(row) => setPriceModal(row)}
                        />
                    )}
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
    const [supplierName, setSupplierName] = useState(initial?.supplierName ?? '');
    const [supplierContact, setSupplierContact] = useState(initial?.supplierContact ?? '');

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
                        </div>
                    </section>

                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">Tedarikçi</div>
                            <div className="stock-modal-card-hint">Tedarikçiyi ekleyin; sonradan “Tedarikçi değiştir” ile güncellenir.</div>
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
                                supplierName: supplierName.trim() || null,
                                supplierContact: supplierContact.trim() || null
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
    const sorted = [...points].sort(
        (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
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
                    <stop offset="0%" stopColor={isUp ? '#ef4444' : '#10b981'} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={isUp ? '#ef4444' : '#10b981'} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill="url(#stockChartFill)" />
            <path
                d={path}
                fill="none"
                stroke={isUp ? '#dc2626' : '#059669'}
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
                        stroke={isUp ? '#dc2626' : '#059669'}
                        strokeWidth={2}
                    >
                        <title>{`${formatDateTime(pt.p.recordedAt)} → ${formatTry(pt.p.unitPrice)}`}</title>
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
                    fill={isUp ? '#dc2626' : '#059669'}
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
    onAddPrice
}: {
    itemId: number;
    isAdmin: boolean;
    onClose: () => void;
    onMutated: () => void;
    onEditItem: (row: StockItemRow) => void;
    onAddPrice: (row: StockItemRow) => void;
}) {
    const [detail, setDetail] = useState<StockItemDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [movementType, setMovementType] = useState<'IN' | 'OUT' | null>(null);
    const [busy, setBusy] = useState(false);

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
            supplierName: detail.supplierName,
            supplierContact: detail.supplierContact,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            latestUnitPrice: detail.latestUnitPrice,
            previousUnitPrice: detail.previousUnitPrice,
            priceChangePercent: detail.priceChangePercent
        };
    }, [detail]);

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
                                        {formatTry(detail.latestUnitPrice)}
                                    </div>
                                    {detail.previousUnitPrice != null ? (
                                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                                            Önceki: {formatTry(detail.previousUnitPrice)}
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
                                            ? `Birim fiyatta ${formatTry(detail.priceChangeAbs ?? 0)} artış var.`
                                            : priceChangeNegative
                                            ? `Birim fiyatta ${formatTry(Math.abs(detail.priceChangeAbs ?? 0))} azalış var.`
                                            : detail.priceChangePercent === 0
                                            ? 'Fiyatta değişiklik yok.'
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
                                            const diff =
                                                next && next.unitPrice !== 0
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
                                                        {formatTry(p.unitPrice)}
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
                                        <Repeat size={14} /> Tedarikçi değiştir
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
                                                                title={[s.supplierName, s.supplierContact].filter(Boolean).join(' · ') || undefined}
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
                    current={{
                        supplierName: detail.supplierName,
                        supplierContact: detail.supplierContact
                    }}
                    saving={busy}
                    onClose={() => !busy && setSupplierOpen(false)}
                    onSave={async (name, contact, note) => {
                        try {
                            setBusy(true);
                            await changeStockSupplier(itemId, {
                                supplierName: name,
                                supplierContact: contact,
                                note
                            });
                            setSupplierOpen(false);
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
    current,
    saving,
    onClose,
    onSave
}: {
    current: { supplierName: string | null; supplierContact: string | null };
    saving: boolean;
    onClose: () => void;
    onSave: (name: string | null, contact: string | null, note: string | null) => Promise<void>;
}) {
    const [name, setName] = useState(current.supplierName ?? '');
    const [contact, setContact] = useState(current.supplierContact ?? '');
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
                        <h2 className="modal-title">Tedarikçi değiştir</h2>
                        <p className="modal-subtitle">
                            Yeni tedarikçiyi girin ve mümkünse değişiklik nedenini not edin.
                        </p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 24 }}>
                    <label>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--muted)' }}>
                            Yeni firma adı
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
                            Yeni iletişim (tel / e-posta)
                        </span>
                        <textarea
                            className="form-input"
                            style={{ borderRadius: 10 }}
                            rows={2}
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                        />
                    </label>
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
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        Vazgeç
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving || (name.trim() === '' && contact.trim() === '')}
                        onClick={() =>
                            void onSave(name.trim() || null, contact.trim() || null, note.trim() || null)
                        }
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
}

function PriceModal({
    item,
    saving,
    onClose,
    onSave
}: {
    item: StockItemRow;
    saving: boolean;
    onClose: () => void;
    onSave: (unitPrice: number, note: string | null) => Promise<void>;
}) {
    const [price, setPrice] = useState('');
    const [note, setNote] = useState('');

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="stock-price-modal-title" onClick={onClose}>
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title" id="stock-price-modal-title">
                            Birim fiyat kaydı
                        </h2>
                        <p className="modal-subtitle">
                            Fiyat geçmişi otomatik tutulur. Not alanına fatura/tedarikçi gibi referans ekleyebilirsiniz.
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
                    </p>
                    <label>
                        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--muted)' }}>Birim fiyat (TRY) *</span>
                        <input
                            className="form-input"
                            style={{ borderRadius: 10, fontSize: '1.05rem', fontWeight: 600 }}
                            type="text"
                            inputMode="decimal"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0,00"
                        />
                    </label>
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
                        Her kayıt fiyat geçmişine eklenir; listede son iki fiyat üzerinden yüzde değişim gösterilir.
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
                            void onSave(n, note.trim() || null);
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
