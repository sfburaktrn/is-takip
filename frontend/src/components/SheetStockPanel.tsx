'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
    addSheetStockDocument,
    addSheetStockMovement,
    createSheetStockItem,
    deleteSheetStockDocument,
    deleteSheetStockItem,
    getSheetStockDocumentUrl,
    getSheetStockItemDetail,
    getSheetStockItems,
    resetSheetStockItem,
    updateSheetStockItem,
    type SheetStockItemDetail,
    type SheetStockItemRow,
    type StockItemDocument,
} from '@/lib/api';
import OzunluLoading from '@/components/OzunluLoading';
import { exportSheetStockItemsToExcel } from '@/lib/stockExcelExport';
import {
    FileSpreadsheet,
    FileText,
    Layers,
    Loader2,
    Minus,
    Package,
    Pencil,
    Plus,
    RefreshCcw,
    RotateCcw,
    Ruler,
    Search,
    Trash2,
    X,
} from 'lucide-react';

type StockLevelZone = 'safe' | 'warn' | 'critical';

function parseNum(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function stockLevelRatio(qty: number | null, critical: number | null): number | null {
    if (qty == null || critical == null || critical <= 0) return null;
    return qty / critical;
}

function stockLevelZone(qty: number | null, critical: number | null): StockLevelZone | null {
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

function stockHeatRgb(danger: number): [number, number, number] {
    const d = Math.min(1, Math.max(0, danger));
    const green: [number, number, number] = [16, 185, 129];
    const yellow: [number, number, number] = [245, 158, 11];
    const red: [number, number, number] = [239, 68, 68];
    if (d <= 0.5) return lerpRgb(green, yellow, d * 2);
    return lerpRgb(yellow, red, (d - 0.5) * 2);
}

function stockDangerT(qty: number | null, critical: number | null): number | null {
    const r = stockLevelRatio(qty, critical);
    if (r == null) return null;
    if (r >= 2) return 0;
    if (r <= 1) return 1;
    return (2 - r) / 1;
}

function stockRowHealthStyle(qty: number | null, critical: number | null): CSSProperties | undefined {
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
        boxShadow: `inset 4px 0 0 rgb(${mid[0]}, ${mid[1]}, ${mid[2]})`,
    };
}

function formatDim(n: number | null | undefined) {
    if (n == null || Number.isNaN(n)) return '—';
    return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}

function formatDateTime(iso: string) {
    try {
        return new Date(iso).toLocaleString('tr-TR');
    } catch {
        return iso;
    }
}

export default function SheetStockPanel({ highlightId }: { highlightId?: number | null }) {
    const [items, setItems] = useState<SheetStockItemRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [saving, setSaving] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailId, setDetailId] = useState<number | null>(null);
    const [exportingExcel, setExportingExcel] = useState(false);

    useEffect(() => {
        const t = window.setTimeout(() => setSearchQ(searchInput.trim()), 320);
        return () => window.clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getSheetStockItems({
                q: searchQ.length >= 2 ? searchQ : undefined,
                limit: 2000,
                skip: 0,
            });
            setItems(res.items);
            setTotal(res.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [searchQ]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (highlightId != null && !loading) {
            setDetailId(highlightId);
        }
    }, [highlightId, loading]);

    const groups = useMemo(() => {
        const m = new Map<string, SheetStockItemRow[]>();
        for (const it of items) {
            const list = m.get(it.material) ?? [];
            list.push(it);
            m.set(it.material, list);
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'tr'));
    }, [items]);

    return (
        <div className="sheet-stock-panel">
            <div className="stock-toolbar">
                <div className="stock-toolbar-grow">
                    <div className="stock-search-wrap">
                        <Search size={18} aria-hidden />
                        <input
                            type="search"
                            className="form-input"
                            placeholder="Malzeme ara (Hardox, ST52…)"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            aria-label="Saç araması"
                            autoComplete="off"
                        />
                    </div>
                </div>
                <div className="stock-toolbar-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={loading || exportingExcel || items.length === 0}
                        onClick={async () => {
                            try {
                                setExportingExcel(true);
                                await exportSheetStockItemsToExcel(items, {
                                    searchQ: searchQ.length >= 2 ? searchQ : undefined,
                                });
                            } catch (e) {
                                alert(e instanceof Error ? e.message : 'Excel oluşturulamadı');
                            } finally {
                                setExportingExcel(false);
                            }
                        }}
                    >
                        {exportingExcel ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <FileSpreadsheet size={18} />
                        )}
                        Excel&apos;e Aktar
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                        Yenile
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                        <Plus size={18} />
                        Yeni saç
                    </button>
                </div>
                <p className="stock-hint">
                    {loading ? 'Yükleniyor…' : `${total} saç kalemi · Malzeme, kalınlık, en, boy ve stok`}
                </p>
            </div>

            {error && <div className="alert alert-error alert--mb20">{error}</div>}

            {loading && items.length === 0 ? (
                <OzunluLoading />
            ) : items.length === 0 ? (
                <div className="stock-empty">
                    <div className="stock-empty-icon">
                        <Package size={32} strokeWidth={1.5} />
                    </div>
                    <p style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 8 }}>Saç kaydı yok</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Yeni saç ekleyerek başlayın.</p>
                </div>
            ) : (
                groups.map(([material, rows]) => (
                    <section key={material} className="stock-group-panel" aria-label={material}>
                        <div className="stock-group-header">
                            <div className="stock-group-title">
                                <span>{material}</span>
                                <span className="stock-group-badge">{rows.length} kalem</span>
                            </div>
                        </div>
                        <div className="stock-table-wrap">
                            <table className="stock-table sheet-stock-table">
                                <thead>
                                    <tr>
                                        <th>Kalınlık</th>
                                        <th>En</th>
                                        <th>Boy</th>
                                        <th className="stock-th-num">Stok</th>
                                        <th className="stock-th-num">Kritik</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const zone = stockLevelZone(row.quantity, row.criticalQuantity);
                                        const healthStyle = stockRowHealthStyle(row.quantity, row.criticalQuantity);
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
                                                id={`sheet-row-${row.id}`}
                                                className={`stock-row-clickable${levelClass}`}
                                                style={healthStyle}
                                                tabIndex={0}
                                                role="button"
                                                onClick={() => setDetailId(row.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setDetailId(row.id);
                                                    }
                                                }}
                                            >
                                                <td>{formatDim(row.thickness)}</td>
                                                <td>{formatDim(row.width)}</td>
                                                <td>{formatDim(row.length)}</td>
                                                <td className="stock-td-num">
                                                    <div className="stock-qty-cell">
                                                        <span className="stock-num">{formatDim(row.quantity)}</span>
                                                        {zone ? (
                                                            <span className={`stock-level-badge stock-level-badge--${zone}`}>
                                                                {stockLevelLabel(zone)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td className="stock-td-num">{row.criticalQuantity != null ? formatDim(row.criticalQuantity) : '—'}</td>
                                                <td>
                                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>Giriş / çıkış</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))
            )}

            {createOpen && (
                <SheetFormModal
                    title="Yeni saç"
                    materialOptions={groups.map(([name]) => name)}
                    saving={saving}
                    onClose={() => !saving && setCreateOpen(false)}
                    onSave={async (payload) => {
                        try {
                            setSaving(true);
                            await createSheetStockItem(payload);
                            setCreateOpen(false);
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
                <SheetDetailModal
                    itemId={detailId}
                    materialOptions={groups.map(([name]) => name)}
                    onClose={() => setDetailId(null)}
                    onMutated={() => void load()}
                />
            )}
        </div>
    );
}

function SheetFormModal({
    title,
    initial,
    materialOptions,
    saving,
    onClose,
    onSave,
}: {
    title: string;
    initial?: SheetStockItemRow | null;
    materialOptions: string[];
    saving: boolean;
    onClose: () => void;
    onSave: (p: {
        material: string;
        thickness: string;
        width: string;
        length: string;
        quantity?: string;
        criticalQuantity: string | null;
    }) => Promise<void>;
}) {
    const isEdit = Boolean(initial);
    const options = useMemo(() => {
        const set = new Set(materialOptions.map((m) => m.trim()).filter(Boolean));
        if (initial?.material) set.add(initial.material);
        return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
    }, [materialOptions, initial?.material]);

    /** '' = yeni grup oluştur */
    const [selectedGroup, setSelectedGroup] = useState(() => {
        if (initial?.material && options.includes(initial.material)) return initial.material;
        if (initial?.material) return '';
        return options.length > 0 ? options[0] : '';
    });
    const [newGroupName, setNewGroupName] = useState(() => {
        if (initial?.material && !options.includes(initial.material)) return initial.material;
        return '';
    });
    const [thickness, setThickness] = useState(initial ? String(initial.thickness) : '');
    const [width, setWidth] = useState(initial ? String(initial.width) : '');
    const [length, setLength] = useState(initial ? String(initial.length) : '');
    const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : '0');
    const [criticalQuantity, setCriticalQuantity] = useState(
        initial?.criticalQuantity != null ? String(initial.criticalQuantity) : ''
    );

    const isNewGroup = selectedGroup === '';
    const resolvedMaterial = (isNewGroup ? newGroupName : selectedGroup).trim();

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sheet-form-title" onClick={onClose}>
            <div
                className="modal modal--premium sheet-form-modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 560 }}
            >
                <div className="modal-header">
                    <div className="sheet-form-hero">
                        <div className="sheet-form-hero-icon" aria-hidden>
                            <Layers size={22} strokeWidth={1.75} />
                        </div>
                        <div>
                            <h2 className="modal-title" id="sheet-form-title">
                                {title}
                            </h2>
                            <p className="modal-subtitle">
                                Mevcut gruptan seçin veya yeni grup adı girin; ardından ölçüleri yazın.
                            </p>
                        </div>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body stock-edit-modal sheet-form-body">
                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">
                                <Layers size={15} aria-hidden /> Grup
                            </div>
                            <div className="stock-modal-card-hint">
                                Hardox 450, ST52 gibi mevcut gruplardan seçin. Listede yoksa &quot;Yeni grup oluştur…&quot; ile ekleyin.
                            </div>
                        </header>
                        <div className="stock-modal-grid">
                            <label className="field">
                                <span className="field-label">Grup *</span>
                                <select
                                    className="form-select field-control"
                                    value={selectedGroup}
                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                    aria-label="Saç grubu"
                                >
                                    <option value="">Yeni grup oluştur…</option>
                                    {options.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {isNewGroup ? (
                                <label className="field">
                                    <span className="field-label">Yeni grup adı *</span>
                                    <input
                                        className="form-input field-control"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        placeholder="örn. S700MC"
                                        autoFocus={!isEdit}
                                    />
                                </label>
                            ) : (
                                <div className="field field--ghost" aria-hidden />
                            )}
                        </div>
                        {isNewGroup ? (
                            <p className="sheet-new-group-hint">
                                Bu adla yeni bir malzeme grubu açılır; saç bu grubun altında listelenir.
                            </p>
                        ) : null}
                    </section>

                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">
                                <Ruler size={15} aria-hidden /> Ölçüler
                            </div>
                            <div className="stock-modal-card-hint">Kalınlık, en ve boy milimetre cinsinden.</div>
                        </header>
                        <div className="stock-modal-grid sheet-dims-grid">
                            <label className="field">
                                <span className="field-label">Kalınlık (mm) *</span>
                                <input
                                    className="form-input field-control"
                                    inputMode="decimal"
                                    value={thickness}
                                    onChange={(e) => setThickness(e.target.value)}
                                    placeholder="örn. 8"
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">En (mm) *</span>
                                <input
                                    className="form-input field-control"
                                    inputMode="decimal"
                                    value={width}
                                    onChange={(e) => setWidth(e.target.value)}
                                    placeholder="örn. 1500"
                                />
                            </label>
                            <label className="field field--span-2">
                                <span className="field-label">Boy (mm) *</span>
                                <input
                                    className="form-input field-control"
                                    inputMode="decimal"
                                    value={length}
                                    onChange={(e) => setLength(e.target.value)}
                                    placeholder="örn. 6000"
                                />
                            </label>
                        </div>
                        {(thickness || width || length) && (
                            <div className="sheet-dim-preview" aria-live="polite">
                                <span className="sheet-dim-preview-label">Özet</span>
                                <strong>
                                    {resolvedMaterial || '—'} · {thickness || '—'} × {width || '—'} × {length || '—'} mm
                                </strong>
                            </div>
                        )}
                    </section>

                    <section className="stock-modal-card">
                        <header className="stock-modal-card-head">
                            <div className="stock-modal-section-title">
                                <Package size={15} aria-hidden /> Stok
                            </div>
                            <div className="stock-modal-card-hint">
                                Stok miktarını ve kritik eşiği buradan düzenleyebilirsiniz.
                            </div>
                        </header>
                        <div className="stock-modal-grid">
                            <label className="field">
                                <span className="field-label">Stok miktarı *</span>
                                <input
                                    className="form-input field-control"
                                    inputMode="decimal"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="0"
                                />
                            </label>
                            <label className="field">
                                <span className="field-label">Kritik stok</span>
                                <input
                                    className="form-input field-control"
                                    inputMode="decimal"
                                    value={criticalQuantity}
                                    onChange={(e) => setCriticalQuantity(e.target.value)}
                                    placeholder="örn. 5"
                                />
                            </label>
                        </div>
                    </section>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        İptal
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving}
                        onClick={() => {
                            if (!resolvedMaterial || !thickness.trim() || !width.trim() || !length.trim()) {
                                alert('Grup, kalınlık, en ve boy zorunlu');
                                return;
                            }
                            if (quantity.trim() === '' || parseNum(quantity) == null || (parseNum(quantity) ?? -1) < 0) {
                                alert('Geçerli bir stok miktarı girin');
                                return;
                            }
                            void onSave({
                                material: resolvedMaterial,
                                thickness: thickness.trim(),
                                width: width.trim(),
                                length: length.trim(),
                                quantity: quantity.trim() || '0',
                                criticalQuantity: criticalQuantity.trim() === '' ? null : criticalQuantity.trim(),
                            });
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        {isEdit ? 'Kaydet' : 'Saç ekle'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SheetDetailModal({
    itemId,
    materialOptions,
    onClose,
    onMutated,
}: {
    itemId: number;
    materialOptions: string[];
    onClose: () => void;
    onMutated: () => void;
}) {
    const [detail, setDetail] = useState<SheetStockItemDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [movementType, setMovementType] = useState<'IN' | 'OUT' | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [docUploadOpen, setDocUploadOpen] = useState(false);
    const [resetStep, setResetStep] = useState<null | 'warn' | 'confirm'>(null);
    const [deleteStep, setDeleteStep] = useState<null | 'warn' | 'confirm'>(null);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setDetail(await getSheetStockItemDetail(itemId));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [itemId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const zone = detail ? stockLevelZone(detail.quantity, detail.criticalQuantity) : null;
    const docs = detail?.documents ?? [];

    const runReset = async () => {
        if (!detail || busy) return;
        setBusy(true);
        try {
            await resetSheetStockItem(detail.id);
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

    const runDelete = async () => {
        if (!detail || busy) return;
        setBusy(true);
        try {
            await deleteSheetStockItem(detail.id);
            setDeleteStep(null);
            onMutated();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Silinemedi');
            setDeleteStep(null);
            setBusy(false);
        }
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="modal stock-detail-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
                <div className="modal-header">
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h2 className="modal-title" style={{ margin: 0 }}>
                            {loading ? 'Yükleniyor…' : detail?.material ?? 'Saç'}
                        </h2>
                        {detail ? (
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                                {formatDim(detail.thickness)} × {formatDim(detail.width)} × {formatDim(detail.length)} mm
                            </p>
                        ) : null}
                    </div>
                    {detail ? (
                        <>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setResetStep('warn')}
                                disabled={busy}
                                title="Bilgileri sıfırla"
                            >
                                <RotateCcw size={14} /> Sıfırla
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteStep('warn')}
                                disabled={busy}
                                title="Ürünü sil"
                                style={{ color: 'var(--danger)' }}
                            >
                                <Trash2 size={14} /> Sil
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)} disabled={busy}>
                                <Pencil size={14} /> Düzenle
                            </button>
                        </>
                    ) : null}
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: '20px 22px' }}>
                    {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
                    {loading && !detail ? (
                        <div style={{ padding: 40, textAlign: 'center' }}>
                            <Loader2 size={28} className="animate-spin" />
                        </div>
                    ) : detail ? (
                        <>
                            <div className="stock-detail-card stock-detail-card--stock" style={{ marginBottom: 18 }}>
                                <div className="stock-detail-card-label">
                                    <Package size={14} aria-hidden /> Canlı stok
                                </div>
                                <div className="stock-detail-card-value">{formatDim(detail.quantity)}</div>
                                {detail.criticalQuantity != null ? (
                                    <div
                                        className={`stock-detail-critical${
                                            zone === 'critical' ? ' is-low' : zone === 'warn' ? ' is-warn' : zone === 'safe' ? ' is-safe' : ''
                                        }`}
                                    >
                                        Kritik eşik: <strong>{formatDim(detail.criticalQuantity)}</strong>
                                        {zone ? ` — ${stockLevelLabel(zone)}` : ''}
                                    </div>
                                ) : (
                                    <div className="stock-detail-critical stock-detail-critical--empty">Kritik seviye tanımlı değil</div>
                                )}
                                <div className="stock-detail-card-actions">
                                    <button type="button" className="btn-stock-in" onClick={() => setMovementType('IN')} disabled={busy}>
                                        <Plus size={15} /> Giriş
                                    </button>
                                    <button type="button" className="btn-stock-out" onClick={() => setMovementType('OUT')} disabled={busy}>
                                        <Minus size={15} /> Çıkış
                                    </button>
                                    <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(true)} disabled={busy}>
                                        <Pencil size={14} /> Stok düzenle
                                    </button>
                                </div>
                            </div>

                            <section className="stock-detail-section">
                                <header className="stock-detail-section-head">
                                    <h3>
                                        <FileText size={16} aria-hidden /> Belgeler
                                    </h3>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                        onClick={() => setDocUploadOpen(true)}
                                        disabled={busy}
                                    >
                                        <Plus size={14} /> PDF / dosya ekle
                                    </button>
                                </header>
                                {docs.length === 0 ? (
                                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                                        Henüz belge yok. Ürünle ilgili PDF veya görsel ekleyebilirsiniz.
                                    </p>
                                ) : (
                                    <ul className="sheet-doc-list">
                                        {docs.map((d: StockItemDocument) => (
                                            <li key={d.id} className="sheet-doc-item">
                                                <a
                                                    href={getSheetStockDocumentUrl(itemId, d.id)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="sheet-doc-link"
                                                >
                                                    {d.isPdf || d.mimeType === 'application/pdf' ? (
                                                        <FileText size={16} aria-hidden />
                                                    ) : (
                                                        <Package size={16} aria-hidden />
                                                    )}
                                                    <span className="sheet-doc-name">
                                                        {d.originalFileName || `Dosya #${d.id}`}
                                                    </span>
                                                    <span className="sheet-doc-meta">
                                                        {formatBytes(d.sizeBytes)} · {formatDateTime(d.createdAt)}
                                                    </span>
                                                </a>
                                                <button
                                                    type="button"
                                                    className="icon-btn icon-btn--danger"
                                                    title="Belgeyi sil"
                                                    disabled={busy}
                                                    onClick={async () => {
                                                        if (!confirm('Bu belgeyi silmek istiyor musunuz?')) return;
                                                        try {
                                                            setBusy(true);
                                                            await deleteSheetStockDocument(itemId, d.id);
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
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            <section className="stock-detail-section">
                                <header className="stock-detail-section-head">
                                    <h3>Stok hareketleri</h3>
                                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{detail.movements.length} kayıt</span>
                                </header>
                                {detail.movements.length === 0 ? (
                                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Henüz giriş/çıkış yok.</p>
                                ) : (
                                    <ul className="stock-movements">
                                        {detail.movements.map((m) => (
                                            <li key={m.id} className={`stock-mv stock-mv--${m.type.toLowerCase()}`}>
                                                <span className="stock-mv-icon" aria-hidden>
                                                    {m.type === 'IN' ? <Plus size={14} /> : <Minus size={14} />}
                                                </span>
                                                <span className="stock-mv-type">{m.type === 'IN' ? 'GİRİŞ' : 'ÇIKIŞ'}</span>
                                                <span className="stock-mv-qty">
                                                    {m.type === 'IN' ? '+' : '−'}
                                                    {m.quantity}
                                                </span>
                                                <span className="stock-mv-balance">
                                                    Kalan: <strong>{m.balanceAfter ?? '—'}</strong>
                                                </span>
                                                <span className="stock-mv-date">{formatDateTime(m.recordedAt)}</span>
                                                {m.note ? <span className="stock-mv-note">{m.note}</span> : null}
                                                {m.user ? <span className="stock-mv-user">{m.user.fullName}</span> : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </>
                    ) : null}
                </div>
            </div>

            {editOpen && detail && (
                <SheetFormModal
                    title="Saç düzenle"
                    initial={detail}
                    materialOptions={materialOptions}
                    saving={busy}
                    onClose={() => !busy && setEditOpen(false)}
                    onSave={async (payload) => {
                        try {
                            setBusy(true);
                            await updateSheetStockItem(itemId, {
                                material: payload.material,
                                thickness: payload.thickness,
                                width: payload.width,
                                length: payload.length,
                                quantity: payload.quantity,
                                criticalQuantity: payload.criticalQuantity,
                            });
                            setEditOpen(false);
                            await refresh();
                            onMutated();
                        } catch (e) {
                            alert(e instanceof Error ? e.message : 'Güncellenemedi');
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}

            {movementType && detail && (
                <SheetMovementModal
                    type={movementType}
                    current={detail.quantity}
                    saving={busy}
                    onClose={() => !busy && setMovementType(null)}
                    onSave={async (qty, note) => {
                        try {
                            setBusy(true);
                            await addSheetStockMovement(itemId, { type: movementType, quantity: qty, note });
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

            {docUploadOpen && detail && (
                <SheetDocumentUploadModal
                    itemLabel={`${detail.material} ${formatDim(detail.thickness)}×${formatDim(detail.width)}×${formatDim(detail.length)}`}
                    saving={busy}
                    onClose={() => !busy && setDocUploadOpen(false)}
                    onSave={async (payload) => {
                        try {
                            setBusy(true);
                            await addSheetStockDocument(itemId, payload);
                            setDocUploadOpen(false);
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

            {resetStep && detail && (
                <SheetConfirmModal
                    title={resetStep === 'warn' ? 'Uyarı: Bilgiler sıfırlanacak' : 'Emin misiniz?'}
                    subtitle={`${detail.material} · ${formatDim(detail.thickness)}×${formatDim(detail.width)}×${formatDim(detail.length)} mm`}
                    busy={busy}
                    dangerLabel={resetStep === 'warn' ? 'Devam et' : 'Evet, sıfırla'}
                    onClose={() => !busy && setResetStep(null)}
                    onConfirm={() => {
                        if (resetStep === 'warn') setResetStep('confirm');
                        else void runReset();
                    }}
                >
                    {resetStep === 'warn' ? (
                        <>
                            <p>
                                Bu işlemde <strong>stok miktarı, kritik seviye, hareket geçmişi ve belgeler</strong> silinir.
                            </p>
                            <p style={{ marginBottom: 0 }}>Grup (malzeme) ve ölçüler (kalınlık / en / boy) kalır.</p>
                        </>
                    ) : (
                        <p style={{ marginBottom: 0 }}>
                            Son uyarı: sıfırlama geri alınamaz. Devam etmek istiyor musunuz?
                        </p>
                    )}
                </SheetConfirmModal>
            )}

            {deleteStep && detail && (
                <SheetConfirmModal
                    title={deleteStep === 'warn' ? 'Uyarı: Ürün silinecek' : 'Emin misiniz?'}
                    subtitle={`${detail.material} · ${formatDim(detail.thickness)}×${formatDim(detail.width)}×${formatDim(detail.length)} mm`}
                    busy={busy}
                    dangerLabel={deleteStep === 'warn' ? 'Devam et' : 'Evet, sil'}
                    onClose={() => !busy && setDeleteStep(null)}
                    onConfirm={() => {
                        if (deleteStep === 'warn') setDeleteStep('confirm');
                        else void runDelete();
                    }}
                >
                    {deleteStep === 'warn' ? (
                        <p style={{ marginBottom: 0 }}>
                            Bu saç kaydı <strong>kalıcı olarak silinecek</strong> (stok, hareketler ve belgeler dahil).
                        </p>
                    ) : (
                        <p style={{ marginBottom: 0 }}>Son uyarı: silme geri alınamaz. Ürünü silmek istiyor musunuz?</p>
                    )}
                </SheetConfirmModal>
            )}
        </div>
    );
}

function formatBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToSheetDocPayload(file: File): Promise<{
    mimeType: string;
    dataBase64: string;
    fileName: string;
}> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = /^image\/(jpeg|jpg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!isPdf && !isImage) {
        throw new Error('JPEG, PNG, WebP veya PDF seçin');
    }
    if (file.size > 4 * 1024 * 1024) throw new Error('Dosya en fazla 4MB olabilir');
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return {
        mimeType: isPdf ? 'application/pdf' : file.type || 'image/jpeg',
        dataBase64: btoa(binary),
        fileName: file.name,
    };
}

function SheetDocumentUploadModal({
    itemLabel,
    saving,
    onClose,
    onSave,
}: {
    itemLabel: string;
    saving: boolean;
    onClose: () => void;
    onSave: (payload: {
        kind?: string;
        mimeType: string;
        dataBase64: string;
        originalFileName?: string | null;
        note?: string | null;
    }) => Promise<void>;
}) {
    const [note, setNote] = useState('');
    const [fileName, setFileName] = useState<string | null>(null);
    const [payload, setPayload] = useState<{ mimeType: string; dataBase64: string; fileName: string } | null>(null);
    const [preparing, setPreparing] = useState(false);

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" style={{ zIndex: 1200 }} onClick={onClose}>
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Belge yükle</h2>
                        <p className="modal-subtitle">PDF veya görsel (JPEG/PNG/WebP), en fazla 4MB.</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={saving || preparing} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 22 }}>
                    <p className="sheet-doc-upload-target">{itemLabel}</p>
                    <label className="field">
                        <span className="field-label">Dosya *</span>
                        <input
                            type="file"
                            accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                            disabled={saving || preparing}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                if (!file) return;
                                try {
                                    setPreparing(true);
                                    const p = await fileToSheetDocPayload(file);
                                    setPayload(p);
                                    setFileName(p.fileName);
                                } catch (err) {
                                    alert(err instanceof Error ? err.message : 'Dosya okunamadı');
                                    setPayload(null);
                                    setFileName(null);
                                } finally {
                                    setPreparing(false);
                                }
                            }}
                        />
                        {fileName ? <span className="sheet-doc-filename">{fileName}</span> : null}
                    </label>
                    <label className="field" style={{ marginTop: 12 }}>
                        <span className="field-label">Not (isteğe bağlı)</span>
                        <input className="form-input field-control" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Teknik şartname, sertifika…" />
                    </label>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving || preparing}>
                        İptal
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={saving || preparing || !payload}
                        onClick={() => {
                            if (!payload) return;
                            void onSave({
                                mimeType: payload.mimeType,
                                dataBase64: payload.dataBase64,
                                originalFileName: payload.fileName,
                                note: note.trim() || null,
                                kind: payload.mimeType === 'application/pdf' ? 'PDF' : 'PRODUCT_IMAGE',
                            });
                        }}
                    >
                        {saving || preparing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Yükle
                    </button>
                </div>
            </div>
        </div>
    );
}

function SheetConfirmModal({
    title,
    subtitle,
    busy,
    dangerLabel,
    onClose,
    onConfirm,
    children,
}: {
    title: string;
    subtitle: string;
    busy: boolean;
    dangerLabel: string;
    onClose: () => void;
    onConfirm: () => void;
    children: ReactNode;
}) {
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" style={{ zIndex: 1300 }} onClick={onClose}>
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{title}</h2>
                        <p className="modal-subtitle">{subtitle}</p>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>
                <div className="modal-body" style={{ padding: 22, fontSize: 14, lineHeight: 1.5 }}>
                    {children}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                        Vazgeç
                    </button>
                    <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
                        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                        {dangerLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function SheetMovementModal({
    type,
    current,
    saving,
    onClose,
    onSave,
}: {
    type: 'IN' | 'OUT';
    current: number;
    saving: boolean;
    onClose: () => void;
    onSave: (qty: number, note: string | null) => Promise<void>;
}) {
    const [qty, setQty] = useState('');
    const [note, setNote] = useState('');
    const isIn = type === 'IN';
    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" style={{ zIndex: 1100 }} onClick={onClose}>
            <div className="modal modal--premium" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">{isIn ? 'Saç girişi' : 'Saç çıkışı'}</h2>
                        <p className="modal-subtitle">Mevcut stoğa göre hareket ekleyin.</p>
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
                            marginBottom: 16,
                        }}
                    >
                        Mevcut stok: <strong style={{ color: 'var(--foreground)' }}>{current}</strong>
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
                        <input className="form-input" style={{ borderRadius: 10 }} value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                        İptal
                    </button>
                    <button
                        type="button"
                        className={isIn ? 'btn btn-primary' : 'btn btn-danger'}
                        disabled={saving}
                        onClick={() => {
                            const n = parseNum(qty);
                            if (n == null || n <= 0) {
                                alert('Pozitif miktar girin');
                                return;
                            }
                            void onSave(n, note.trim() || null);
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                        {isIn ? 'Giriş kaydet' : 'Çıkış kaydet'}
                    </button>
                </div>
            </div>
        </div>
    );
}
