'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import {
    getProposalIngestList,
    patchProposalIngest,
    deleteProposalIngest,
    type ProposalIngestRow,
} from '@/lib/api';
import {
    AlertTriangle, Briefcase, Building2, CheckCircle2, Clock,
    Factory, FileDown, FileText, Loader2, RefreshCcw, Search,
    Trash2, X, ChevronDown, Zap, Eye, MessageSquareText,
} from 'lucide-react';

/* ─── helpers ─── */

type StatusFilter = 'all' | 'pending' | 'done';
const EMPTY_FILTERS = { company: '', approvalFrom: '', approvalTo: '', deliveryFrom: '', deliveryTo: '' };
const ACILIYET_ORDER: Record<string, number> = { 'Çok Acil': 0, 'Acil': 1, 'Normal': 2 };

function fmt(iso: string | null | undefined) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function toLocal(iso: string | null | undefined) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function inRange(iso: string | null | undefined, from: string, to: string) {
    if (!from && !to) return true;
    const v = toLocal(iso);
    if (!v) return false;
    return (!from || v >= from) && (!to || v <= to);
}
function sortRows(list: ProposalIngestRow[]) {
    return [...list].sort((a, b) => {
        if (a.imalataAlindi !== b.imalataAlindi) return a.imalataAlindi ? 1 : -1;
        const aO = ACILIYET_ORDER[a.manufacturingAciliyet ?? ''] ?? 3;
        const bO = ACILIYET_ORDER[b.manufacturingAciliyet ?? ''] ?? 3;
        if (aO !== bO) return aO - bO;
        return new Date(b.approvalLoggedAt ?? b.pushedAt).getTime() - new Date(a.approvalLoggedAt ?? a.pushedAt).getTime();
    });
}

/* ─── aciliyet badge ─── */
function AciliyetBadge({ value }: { value: string | null }) {
    if (!value) return null;
    const cfg =
        value === 'Çok Acil'
            ? { cls: 'aciliyet-cok-acil', icon: true as const }
            : value === 'Acil'
              ? { cls: 'aciliyet-acil', icon: false as const }
              : { cls: 'aciliyet-normal', icon: false as const };
    return (
        <span className={`aciliyet-pill ${cfg.cls}`}>
            {cfg.icon && <Zap size={11} />}
            {value}
        </span>
    );
}

/* ─── vertical card ─── */
function ProposalCard({ r, onToggleImalat, onRequestDelete, busy, onPdfPreview }: {
    r: ProposalIngestRow;
    onToggleImalat: (id: number, next: boolean) => void;
    onRequestDelete: (row: ProposalIngestRow) => void;
    busy: boolean;
    onPdfPreview: (url: string) => void;
}) {
    const imalat = r.imalataAlindi === true;
    const [open, setOpen] = useState(false);
    const isCokAcil = r.manufacturingAciliyet === 'Çok Acil';
    const accent = isCokAcil ? 'accent-danger' : imalat ? 'accent-success' : 'accent-warning';

    return (
        <div className={`proposal-card ${isCokAcil ? 'cok-acil-card' : ''}`}>
            <div className={`accent-bar ${accent}`} />

            {/* top: icon + badges + company */}
            <div className="proposal-card__head">
                <div className="proposal-card__top-row">
                    <div
                        className={`proposal-card__icon proposal-card__icon--${isCokAcil ? 'danger' : imalat ? 'success' : 'warning'}`}
                    >
                        {isCokAcil ? <Zap size={18} /> : <Factory size={18} />}
                    </div>
                    <span className={`badge status-badge status-badge--row ${imalat ? 'badge-success' : 'badge-warning'}`}>
                        <span className={`status-badge__dot ${imalat ? 'status-badge__dot--on' : 'status-badge__dot--off'} animate-pulse`} />
                        {imalat ? 'Üretimde' : 'Planlamada'}
                    </span>
                    <AciliyetBadge value={r.manufacturingAciliyet} />
                </div>
                <h3 className="proposal-card__title" title={r.companyName}>
                    {r.companyName}
                </h3>
                <p className="proposal-card__id" title={r.sourceProposalId}>
                    ID: {r.sourceProposalId}
                </p>
            </div>

            {/* metrics */}
            <div className="proposal-card__metrics">
                <Metric label="Miktar" value={`${r.quantity} adet`} tone="default" />
                <Metric label="Teklif" value={fmt(r.proposalDate)} tone="default" />
                <Metric label="Onay" value={fmt(r.approvalLoggedAt)} tone="approval" />
                <Metric label="Teslim" value={fmt(r.deliveryDate)} tone="delivery" />
            </div>

            {/* toggle + actions */}
            <div className="proposal-card__footer">
                <div className="proposal-toggle-row">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={imalat}
                        disabled={busy}
                        onClick={() => onToggleImalat(r.id, !imalat)}
                        className={`proposal-toggle ${imalat ? 'proposal-toggle--on' : ''} ${busy ? 'proposal-toggle--busy' : ''}`}
                    >
                        <span className={`proposal-toggle__knob ${imalat ? 'proposal-toggle__knob--on' : ''}`} />
                    </button>
                    <div className="proposal-toggle-copy">
                        <span className="proposal-toggle-copy__title">İmalata alındı</span>
                        <span className="proposal-toggle-copy__hint">
                            Açıkken teklif <strong>Üretim planı</strong> bekleyenler listesine düşer.
                        </span>
                    </div>
                </div>
                <div className="proposal-card__actions">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRequestDelete(r)}
                        className="proposal-icon-btn proposal-icon-btn--danger"
                        aria-label="Sil"
                    >
                        <Trash2 size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className={`proposal-icon-btn ${open ? 'proposal-icon-btn--open' : ''}`}
                        aria-label="Detay"
                    >
                        <ChevronDown size={15} />
                    </button>
                </div>
            </div>

            {/* expandable */}
            <div className={`proposal-expand ${open ? 'proposal-expand--open' : ''}`}>
                <div className="proposal-detail">
                    <div className="proposal-detail__grid">
                        <Field label="Gönderim" value={fmt(r.pushedAt)} />
                        <Field label="Gönderen" value={r.pushedBy ?? ''} />
                        <Field label="Oluşturulma" value={fmt(r.createdAt)} />
                        <Field label="Güncelleme" value={fmt(r.updatedAt)} />
                        <Field label="Ekipman" value={r.equipment ?? ''} />
                        <Field label="Araç" value={r.vehicle ?? ''} />
                        <Field label="Hacim" value={r.volume ?? ''} />
                        <Field label="Kalınlık" value={r.thickness ?? ''} />
                        <Field label="İlgili kişi" value={r.contactPerson ?? ''} />
                        <Field label="E-posta" value={r.ownerEmail ?? ''} />
                    </div>

                    {/* teknik pdf */}
                    {r.teknikPdfUrl && (
                        <div className="proposal-pdf-row">
                            <a href={r.teknikPdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-btn proposal-pdf-link">
                                <FileDown size={15} /> Teknik PDF İndir
                            </a>
                            <button type="button" onClick={() => onPdfPreview(r.teknikPdfUrl!)} className="pdf-btn proposal-pdf-preview-btn">
                                <Eye size={15} /> PDF Önizle
                            </button>
                        </div>
                    )}
                    {r.teknikSartnamePdfUrl && (
                        <div className="proposal-pdf-row">
                            <a
                                href={r.teknikSartnamePdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pdf-btn proposal-pdf-link"
                            >
                                <FileDown size={15} /> Teknik şartname PDF
                            </a>
                            <button
                                type="button"
                                onClick={() => onPdfPreview(r.teknikSartnamePdfUrl!)}
                                className="pdf-btn proposal-pdf-preview-btn"
                            >
                                <Eye size={15} /> Önizle
                            </button>
                        </div>
                    )}
                    {r.ekPdfUrl && (
                        <div className="proposal-pdf-row">
                            <a href={r.ekPdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-btn proposal-pdf-link">
                                <FileDown size={15} /> Ek PDF
                            </a>
                            <button type="button" onClick={() => onPdfPreview(r.ekPdfUrl!)} className="pdf-btn proposal-pdf-preview-btn">
                                <Eye size={15} /> Önizle
                            </button>
                        </div>
                    )}

                    {/* imalat notu */}
                    {r.manufacturingNot && (
                        <div className="notes-block proposal-note">
                            <div className="proposal-note__head">
                                <MessageSquareText size={14} className="proposal-note__head-icon" />
                                <span className="proposal-note__head-label">İmalat Notu</span>
                            </div>
                            <div className="proposal-note__body">
                                <p className="proposal-note__text proposal-note__text--short">{r.manufacturingNot}</p>
                            </div>
                        </div>
                    )}

                    {/* notlar - sadece varsa göster */}
                    {r.notes?.trim() && (
                        <div className="notes-block proposal-note">
                            <div className="proposal-note__head proposal-note__head--primary">
                                <FileText size={14} className="proposal-note__head-icon" />
                                <span className="proposal-note__head-label">Notlar</span>
                            </div>
                            <div className="proposal-note__body">
                                <p className="proposal-note__text proposal-note__text--tall">{r.notes.trim()}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'default' | 'approval' | 'delivery' }) {
    const toneClass =
        tone === 'approval' ? 'proposal-metric-cell--approval' : tone === 'delivery' ? 'proposal-metric-cell--delivery' : 'proposal-metric-cell--default';
    const labelClass =
        tone === 'approval'
            ? 'proposal-metric-cell__label proposal-metric-cell__label--success-tone'
            : tone === 'delivery'
              ? 'proposal-metric-cell__label proposal-metric-cell__label--warning-tone'
              : 'proposal-metric-cell__label';
    return (
        <div className={`proposal-metric-cell ${toneClass}`}>
            <p className={labelClass}>{label}</p>
            <p className="proposal-metric-cell__value">{value}</p>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    const empty = !value || value === '—';
    return (
        <div className="proposal-field">
            <p className="proposal-field__label">{label}</p>
            <p className={`proposal-field__value ${empty ? 'proposal-field__value--empty' : 'proposal-field__value--filled'}`}>
                {empty ? '—' : value}
            </p>
        </div>
    );
}

/* ─── page ─── */
function MevcutIslerContent() {
    const searchParams = useSearchParams();
    const highlightParam = searchParams.get('highlight');
    const highlightResetRef = useRef(false);
    const [rows, setRows] = useState<ProposalIngestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProposalIngestRow | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS }));
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

    const load = useCallback(async () => {
        try { setLoading(true); setError(null); const data = await getProposalIngestList(300); setRows(sortRows(data.map(r => ({ ...r, imalataAlindi: r.imalataAlindi === true })))); }
        catch (e) { setError(e instanceof Error ? e.message : 'Yüklenemedi'); setRows([]); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!highlightParam) return;
        highlightResetRef.current = false;
    }, [highlightParam]);

    useEffect(() => {
        if (!highlightParam || highlightResetRef.current) return;
        const id = parseInt(highlightParam, 10);
        if (!Number.isFinite(id)) return;
        highlightResetRef.current = true;
        setFilters({ ...EMPTY_FILTERS });
        setStatusFilter('all');
    }, [highlightParam]);

    const updateFilter = useCallback((key: keyof typeof EMPTY_FILTERS, value: string) => setFilters(prev => ({ ...prev, [key]: value })), []);
    const clearFilters = useCallback(() => { setFilters({ ...EMPTY_FILTERS }); setStatusFilter('all'); }, []);

    const handleToggle = useCallback(async (id: number, next: boolean) => {
        setBusyId(id); setError(null);
        try { const u = await patchProposalIngest(id, next); setRows(prev => sortRows(prev.map(x => (x.id === id ? { ...u, imalataAlindi: u.imalataAlindi === true } : x)))); }
        catch (e) { setError(e instanceof Error ? e.message : 'Güncellenemedi'); }
        finally { setBusyId(null); }
    }, []);

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return; setDeleteLoading(true); setError(null);
        try { await deleteProposalIngest(deleteTarget.id); setRows(prev => prev.filter(x => x.id !== deleteTarget.id)); setDeleteTarget(null); }
        catch (e) { setError(e instanceof Error ? e.message : 'Silinemedi'); }
        finally { setDeleteLoading(false); }
    }, [deleteTarget]);

    const counts = useMemo(() => ({ pending: rows.filter(r => !r.imalataAlindi).length, done: rows.filter(r => r.imalataAlindi).length, total: rows.length }), [rows]);

    const filteredRows = useMemo(() => {
        const q = filters.company.trim().toLocaleLowerCase('tr-TR');
        return rows.filter(r => {
            if (statusFilter === 'pending' && r.imalataAlindi) return false;
            if (statusFilter === 'done' && !r.imalataAlindi) return false;
            return (q.length === 0 || r.companyName.toLocaleLowerCase('tr-TR').includes(q)) &&
                inRange(r.approvalLoggedAt, filters.approvalFrom, filters.approvalTo) &&
                inRange(r.deliveryDate, filters.deliveryFrom, filters.deliveryTo);
        });
    }, [filters, rows, statusFilter]);

    useEffect(() => {
        if (!highlightParam || loading || rows.length === 0) return;
        const id = parseInt(highlightParam, 10);
        if (!Number.isFinite(id)) return;
        const t = window.setTimeout(() => {
            const el = document.getElementById(`proposal-ingest-${id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('proposal-ingest-highlight');
                window.setTimeout(() => el.classList.remove('proposal-ingest-highlight'), 2600);
            }
        }, 450);
        return () => clearTimeout(t);
    }, [highlightParam, loading, rows]);

    const fCounts = useMemo(() => ({ pending: filteredRows.filter(r => !r.imalataAlindi).length, done: filteredRows.filter(r => r.imalataAlindi).length, total: filteredRows.length }), [filteredRows]);
    const hasActiveFilters = useMemo(() => statusFilter !== 'all' || Object.values(filters).some(v => v.trim().length > 0), [filters, statusFilter]);

    const handleStatClick = (s: StatusFilter) => setStatusFilter(prev => prev === s ? 'all' : s);

    return (
            <>
                <Sidebar />
                <main className="main-content apple-app-page analytics-page min-h-0">
                    <div className="apple-canvas">
                    <header className="header header--stack">
                        <div className="flex w-full flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
                            <div className="min-w-0 flex-1">
                                <h1 className="header-title"><Briefcase size={28} className="mr-2 inline shrink-0 align-middle" /> Mevcut İşler</h1>
                                <p className="header-subtitle">Onaylı teklif kayıtları. Silme yalnızca bu listeyi etkiler.</p>
                            </div>
                            <button type="button" className="btn btn-primary analytics-touch-target flex shrink-0 items-center gap-2" onClick={load}>
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />} Yenile
                            </button>
                        </div>

                        {!loading && rows.length > 0 && (
                            <div className="stats-grid mb-0 w-full">
                                <div className={`stat-card stat-clickable ${statusFilter === 'all' ? 'stat-active' : ''}`} onClick={() => handleStatClick('all')}>
                                    <div className="stat-icon blue"><Building2 size={22} /></div>
                                    <div><div className="stat-value">{counts.total}</div><div className="stat-label">Toplam</div></div>
                                </div>
                                <div className={`stat-card stat-clickable ${statusFilter === 'pending' ? 'stat-active' : ''}`} onClick={() => handleStatClick('pending')}>
                                    <div className="stat-icon yellow"><Clock size={22} /></div>
                                    <div><div className="stat-value">{counts.pending}</div><div className="stat-label">Bekliyor</div></div>
                                </div>
                                <div className={`stat-card stat-clickable ${statusFilter === 'done' ? 'stat-active' : ''}`} onClick={() => handleStatClick('done')}>
                                    <div className="stat-icon green"><CheckCircle2 size={22} /></div>
                                    <div><div className="stat-value">{counts.done}</div><div className="stat-label">Üretimde</div></div>
                                </div>
                            </div>
                        )}
                    </header>

                    {error && (
                        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900" role="alert">
                            <AlertTriangle className="mt-0.5 shrink-0" size={20} /> {error}
                        </div>
                    )}

                    {/* filter */}
                    {!loading && rows.length > 0 && (
                        <div className="filter-panel filter-panel--rounded">
                            <div className="filter-accent" />
                            <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="filter-header filter-header--btn">
                                <div className="filter-header__left">
                                    <div className="filter-icon-wrap filter-icon-wrap--gradient">
                                        <Search size={18} />
                                    </div>
                                    <div className="filter-header__titles">
                                        <h2>Filtrele</h2>
                                        <p>
                                            {hasActiveFilters ? `${fCounts.total} kayıt gösteriliyor` : 'Firma, onay veya teslim tarihine göre'}
                                        </p>
                                    </div>
                                </div>
                                <div className="filter-header__right">
                                    {hasActiveFilters && <span className="filter-dot-active" />}
                                    <ChevronDown size={18} className={`filter-chevron ${filtersOpen ? 'filter-chevron--open' : ''}`} />
                                </div>
                            </button>
                            <div className={`filter-collapse ${filtersOpen ? 'filter-collapse--open' : ''}`}>
                                <div className="filter-body">
                                    <div className="filter-search-wrap">
                                        <Search size={16} className="filter-search-icon" />
                                        <input
                                            className="input input--search-leading"
                                            type="text"
                                            placeholder="Firma adına göre ara..."
                                            value={filters.company}
                                            onChange={(e) => updateFilter('company', e.target.value)}
                                        />
                                    </div>
                                    <div className="filter-date-grid">
                                        <div className="form-group">
                                            <label className="form-label form-label--success-tone">Onay Başlangıç</label>
                                            <input
                                                className="input"
                                                type="date"
                                                value={filters.approvalFrom}
                                                onChange={(e) => updateFilter('approvalFrom', e.target.value)}
                                                max={filters.approvalTo || undefined}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label form-label--success-tone">Onay Bitiş</label>
                                            <input
                                                className="input"
                                                type="date"
                                                value={filters.approvalTo}
                                                onChange={(e) => updateFilter('approvalTo', e.target.value)}
                                                min={filters.approvalFrom || undefined}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label form-label--warning-tone">Teslim Başlangıç</label>
                                            <input
                                                className="input"
                                                type="date"
                                                value={filters.deliveryFrom}
                                                onChange={(e) => updateFilter('deliveryFrom', e.target.value)}
                                                max={filters.deliveryTo || undefined}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label form-label--warning-tone">Teslim Bitiş</label>
                                            <input
                                                className="input"
                                                type="date"
                                                value={filters.deliveryTo}
                                                onChange={(e) => updateFilter('deliveryTo', e.target.value)}
                                                min={filters.deliveryFrom || undefined}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {hasActiveFilters && (
                                    <div className="filter-footer">
                                        <button type="button" className="btn btn-secondary btn--gap-sm" onClick={clearFilters}>
                                            <X size={14} /> Temizle
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* content */}
                    {loading && rows.length === 0 ? (
                        <div className="page-loading-pad">
                            <OzunluLoading variant="inline" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="card empty-state-card">
                            <Briefcase className="mx-auto empty-state-card__icon" size={48} />
                            <p className="empty-state-card__title">Kayıt yok</p>
                            <p className="empty-state-card__desc">Teklif Takip üzerinden gönderim yapılınca burada görünür.</p>
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="card empty-state-card">
                            <Search className="mx-auto empty-state-card__icon" size={48} />
                            <p className="empty-state-card__title">Filtrelere uyan kayıt bulunamadı</p>
                            <button type="button" className="btn btn-secondary empty-state-card__btn btn--gap-sm" onClick={clearFilters}>
                                <X size={16} /> Sıfırla
                            </button>
                        </div>
                    ) : (
                        <div className="card-grid">
                            {filteredRows.map((r, i) => (
                                <div
                                    key={r.id}
                                    id={`proposal-ingest-${r.id}`}
                                    className="proposal-card-anim"
                                    style={{ animationDelay: `${i * 0.04}s` }}
                                >
                                    <ProposalCard r={r} busy={busyId === r.id} onToggleImalat={handleToggle} onRequestDelete={setDeleteTarget} onPdfPreview={setPdfPreviewUrl} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* delete modal */}
                    {deleteTarget && (
                        <div className="modal-overlay" onClick={() => !deleteLoading && setDeleteTarget(null)}>
                            <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2 className="modal-title">Kaydı Sil</h2>
                                    <button type="button" className="modal-close" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="modal-body">
                                    <div className="modal-danger-row">
                                        <div className="modal-danger-icon">
                                            <AlertTriangle size={22} />
                                        </div>
                                        <div className="modal-danger-text">
                                            <p>{deleteTarget.companyName}</p>
                                            <p>Bu kayıt kalıcı olarak silinecek.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" disabled={deleteLoading} onClick={() => setDeleteTarget(null)}>
                                        Vazgeç
                                    </button>
                                    <button type="button" className="btn btn--danger-solid" disabled={deleteLoading} onClick={handleDelete}>
                                        {deleteLoading ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Siliniyor
                                            </>
                                        ) : (
                                            'Sil'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* pdf preview modal */}
                    {pdfPreviewUrl && (
                        <div className="modal-overlay" onClick={() => setPdfPreviewUrl(null)}>
                            <div className="pdf-modal-shell" onClick={(e) => e.stopPropagation()}>
                                <div className="pdf-modal-toolbar">
                                    <div className="pdf-modal-toolbar__left">
                                        <FileText size={18} className="pdf-modal-toolbar__icon" />
                                        <span className="pdf-modal-toolbar__title">Teknik PDF Önizleme</span>
                                    </div>
                                    <div className="pdf-modal-toolbar__actions">
                                        <a
                                            href={pdfPreviewUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-primary btn--compact"
                                        >
                                            <FileDown size={14} /> İndir
                                        </a>
                                        <button type="button" className="modal-close" onClick={() => setPdfPreviewUrl(null)}>
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>
                                <iframe src={pdfPreviewUrl} className="pdf-modal-frame" title="PDF Önizleme" />
                            </div>
                        </div>
                    )}
                    </div>
                </main>
            </>
    );
}

export default function MevcutIslerPage() {
    return (
        <AuthGuard>
            <Suspense
                fallback={
                    <>
                        <Sidebar />
                        <main className="main-content apple-app-page analytics-page min-h-0">
                            <div className="apple-canvas">
                            <OzunluLoading variant="inline" />
                            </div>
                        </main>
                    </>
                }
            >
                <MevcutIslerContent />
            </Suspense>
        </AuthGuard>
    );
}
