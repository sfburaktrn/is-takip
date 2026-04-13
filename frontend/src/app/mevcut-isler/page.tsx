'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
    const cfg = value === 'Çok Acil'
        ? { bg: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', cls: 'aciliyet-cok-acil', icon: true }
        : value === 'Acil'
            ? { bg: 'linear-gradient(135deg,#ea580c,#c2410c)', color: '#fff', cls: 'aciliyet-acil', icon: false }
            : { bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', cls: '', icon: false };
    return (
        <span className={`aciliyet-pill ${cfg.cls}`} style={{ background: cfg.bg, color: cfg.color, display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.3px' }}>
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
            <div style={{ padding: '20px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div className="card-icon" style={{
                        width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
                        background: isCokAcil ? 'var(--danger)' : imalat ? 'var(--success)' : 'var(--warning)',
                    }}>
                        {isCokAcil ? <Zap size={18} /> : <Factory size={18} />}
                    </div>
                    <span className={`badge status-badge ${imalat ? 'badge-success' : 'badge-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: imalat ? '#34d399' : '#fbbf24', display: 'inline-block' }} className="animate-pulse" />
                        {imalat ? 'Üretimde' : 'Planlamada'}
                    </span>
                    <AciliyetBadge value={r.manufacturingAciliyet} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.companyName}>{r.companyName}</h3>
                <p style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sourceProposalId}>ID: {r.sourceProposalId}</p>
            </div>

            {/* metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', margin: '16px 0 0' }}>
                <Metric label="Miktar" value={`${r.quantity} adet`} bg="var(--card)" />
                <Metric label="Teklif" value={fmt(r.proposalDate)} bg="var(--card)" />
                <Metric label="Onay" value={fmt(r.approvalLoggedAt)} bg="#ecfdf5" labelColor="#059669" />
                <Metric label="Teslim" value={fmt(r.deliveryDate)} bg="#fffbeb" labelColor="#d97706" />
            </div>

            {/* toggle + actions */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button type="button" role="switch" aria-checked={imalat} disabled={busy} onClick={() => onToggleImalat(r.id, !imalat)}
                        style={{ position: 'relative', width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'background 0.2s', background: imalat ? 'var(--success)' : '#cbd5e1', opacity: busy ? 0.5 : 1 }}>
                        <span style={{ position: 'absolute', top: '2px', left: imalat ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.2s' }} />
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)' }}>İmalata alındı</span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.35 }}>
                            Açıkken teklif <strong>Üretim planı</strong> bekleyenler listesine düşer.
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" disabled={busy} onClick={() => onRequestDelete(r)} style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Sil"><Trash2 size={15} /></button>
                    <button type="button" onClick={() => setOpen(v => !v)} style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border)', background: '#fff', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : '' }} aria-label="Detay"><ChevronDown size={15} /></button>
                </div>
            </div>

            {/* expandable */}
            <div style={{ maxHeight: open ? '800px' : '0px', opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease' }}>
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--secondary)', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <a href={r.teknikPdfUrl} target="_blank" rel="noopener noreferrer" className="pdf-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', textDecoration: 'none' }}>
                                <FileDown size={15} /> Teknik PDF İndir
                            </a>
                            <button type="button" onClick={() => onPdfPreview(r.teknikPdfUrl!)} className="pdf-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', cursor: 'pointer' }}>
                                <Eye size={15} /> PDF Önizle
                            </button>
                        </div>
                    )}

                    {/* imalat notu */}
                    {r.manufacturingNot && (
                        <div className="notes-block" style={{ marginTop: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <MessageSquareText size={14} style={{ color: '#fff' }} />
                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff' }}>İmalat Notu</span>
                            </div>
                            <div style={{ padding: '12px 16px' }}>
                                <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '100px', overflowY: 'auto', margin: 0 }}>{r.manufacturingNot}</p>
                            </div>
                        </div>
                    )}

                    {/* notlar - sadece varsa göster */}
                    {r.notes?.trim() && (
                        <div className="notes-block" style={{ marginTop: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, var(--primary), #03346E)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={14} style={{ color: '#fff' }} />
                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#fff' }}>Notlar</span>
                            </div>
                            <div style={{ padding: '12px 16px' }}>
                                <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '120px', overflowY: 'auto', margin: 0 }}>{r.notes.trim()}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Metric({ label, value, bg, labelColor }: { label: string; value: string; bg: string; labelColor?: string }) {
    return (
        <div style={{ background: bg, padding: '12px 20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: labelColor ?? 'var(--muted)', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', marginTop: '3px' }}>{value}</p>
        </div>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    const empty = !value || value === '—';
    return (
        <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '13px', fontWeight: empty ? 400 : 500, color: empty ? '#94a3b8' : 'var(--foreground)', fontStyle: empty ? 'italic' : 'normal', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{empty ? '—' : value}</p>
        </div>
    );
}

/* ─── page ─── */
export default function MevcutIslerPage() {
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

    const fCounts = useMemo(() => ({ pending: filteredRows.filter(r => !r.imalataAlindi).length, done: filteredRows.filter(r => r.imalataAlindi).length, total: filteredRows.length }), [filteredRows]);
    const hasActiveFilters = useMemo(() => statusFilter !== 'all' || Object.values(filters).some(v => v.trim().length > 0), [filters, statusFilter]);

    const handleStatClick = (s: StatusFilter) => setStatusFilter(prev => prev === s ? 'all' : s);

    return (
        <AuthGuard>
            <>
                <Sidebar />
                <main className="main-content analytics-page min-h-0">
                    <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
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
                            <div className="stats-grid w-full" style={{ marginBottom: 0 }}>
                                <div className={`stat-card stat-clickable ${statusFilter === 'all' ? 'stat-active' : ''}`} onClick={() => handleStatClick('all')} style={{ cursor: 'pointer' }}>
                                    <div className="stat-icon blue"><Building2 size={22} /></div>
                                    <div><div className="stat-value">{counts.total}</div><div className="stat-label">Toplam</div></div>
                                </div>
                                <div className={`stat-card stat-clickable ${statusFilter === 'pending' ? 'stat-active' : ''}`} onClick={() => handleStatClick('pending')} style={{ cursor: 'pointer' }}>
                                    <div className="stat-icon yellow"><Clock size={22} /></div>
                                    <div><div className="stat-value">{counts.pending}</div><div className="stat-label">Bekliyor</div></div>
                                </div>
                                <div className={`stat-card stat-clickable ${statusFilter === 'done' ? 'stat-active' : ''}`} onClick={() => handleStatClick('done')} style={{ cursor: 'pointer' }}>
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
                        <div className="filter-panel" style={{ borderRadius: '16px', overflow: 'hidden', marginBottom: '36px', border: '1px solid var(--border)', background: 'var(--card)' }}>
                            <div className="filter-accent" />
                            <button type="button" onClick={() => setFiltersOpen(v => !v)} className="filter-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 20px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="filter-icon-wrap" style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary), #03346E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Search size={18} /></div>
                                    <div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Filtrele</h2>
                                        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{hasActiveFilters ? `${fCounts.total} kayıt gösteriliyor` : 'Firma, onay veya teslim tarihine göre'}</p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {hasActiveFilters && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
                                    <ChevronDown size={18} style={{ color: 'var(--muted)', transition: 'transform 0.3s', transform: filtersOpen ? 'rotate(180deg)' : '' }} />
                                </div>
                            </button>
                            <div style={{ maxHeight: filtersOpen ? '500px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.3s', opacity: filtersOpen ? 1 : 0 }}>
                                <div style={{ borderTop: '1px solid var(--border)', padding: '20px', background: 'var(--secondary)' }}>
                                    <div style={{ marginBottom: '16px', position: 'relative' }}>
                                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                                        <input className="input" type="text" placeholder="Firma adına göre ara..." value={filters.company} onChange={e => updateFilter('company', e.target.value)} style={{ paddingLeft: '38px' }} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                                        <div className="form-group"><label className="form-label" style={{ color: '#059669' }}>Onay Başlangıç</label><input className="input" type="date" value={filters.approvalFrom} onChange={e => updateFilter('approvalFrom', e.target.value)} max={filters.approvalTo || undefined} /></div>
                                        <div className="form-group"><label className="form-label" style={{ color: '#059669' }}>Onay Bitiş</label><input className="input" type="date" value={filters.approvalTo} onChange={e => updateFilter('approvalTo', e.target.value)} min={filters.approvalFrom || undefined} /></div>
                                        <div className="form-group"><label className="form-label" style={{ color: '#d97706' }}>Teslim Başlangıç</label><input className="input" type="date" value={filters.deliveryFrom} onChange={e => updateFilter('deliveryFrom', e.target.value)} max={filters.deliveryTo || undefined} /></div>
                                        <div className="form-group"><label className="form-label" style={{ color: '#d97706' }}>Teslim Bitiş</label><input className="input" type="date" value={filters.deliveryTo} onChange={e => updateFilter('deliveryTo', e.target.value)} min={filters.deliveryFrom || undefined} /></div>
                                    </div>
                                </div>
                                {hasActiveFilters && (
                                    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-secondary" onClick={clearFilters} style={{ gap: '6px' }}><X size={14} /> Temizle</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* content */}
                    {loading && rows.length === 0 ? (
                        <div style={{ padding: '48px 0' }}>
                            <OzunluLoading variant="inline" />
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '16px' }}>
                            <Briefcase className="mx-auto" size={48} style={{ color: 'var(--border)' }} />
                            <p style={{ marginTop: '16px', fontWeight: 600 }}>Kayıt yok</p>
                            <p style={{ marginTop: '4px', color: 'var(--muted)', fontSize: '14px' }}>Teklif Takip üzerinden gönderim yapılınca burada görünür.</p>
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="card" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: '16px' }}>
                            <Search className="mx-auto" size={48} style={{ color: 'var(--border)' }} />
                            <p style={{ marginTop: '16px', fontWeight: 600 }}>Filtrelere uyan kayıt bulunamadı</p>
                            <button type="button" className="btn btn-secondary" onClick={clearFilters} style={{ marginTop: '16px', gap: '6px' }}><X size={16} /> Sıfırla</button>
                        </div>
                    ) : (
                        <div className="card-grid">
                            {filteredRows.map((r, i) => (
                                <div key={r.id} style={{ animation: `fadeSlideUp 0.4s ${i * 0.04}s both` }}>
                                    <ProposalCard r={r} busy={busyId === r.id} onToggleImalat={handleToggle} onRequestDelete={setDeleteTarget} onPdfPreview={setPdfPreviewUrl} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* delete modal */}
                    {deleteTarget && (
                        <div className="modal-overlay" onClick={() => !deleteLoading && setDeleteTarget(null)}>
                            <div className="modal" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                                <div className="modal-header"><h2 className="modal-title">Kaydı Sil</h2><button type="button" className="modal-close" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}><X size={18} /></button></div>
                                <div className="modal-body">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertTriangle size={22} /></div>
                                        <div><p style={{ fontWeight: 700 }}>{deleteTarget.companyName}</p><p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>Bu kayıt kalıcı olarak silinecek.</p></div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" disabled={deleteLoading} onClick={() => setDeleteTarget(null)}>Vazgeç</button>
                                    <button type="button" className="btn" disabled={deleteLoading} onClick={handleDelete} style={{ background: 'var(--danger)', color: 'white' }}>
                                        {deleteLoading ? <><Loader2 size={16} className="animate-spin" /> Siliniyor</> : 'Sil'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* pdf preview modal */}
                    {pdfPreviewUrl && (
                        <div className="modal-overlay" onClick={() => setPdfPreviewUrl(null)}>
                            <div style={{ width: '90vw', maxWidth: '900px', height: '85vh', background: 'var(--card)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <FileText size={18} style={{ color: 'var(--primary)' }} />
                                        <span style={{ fontWeight: 700, fontSize: '15px' }}>Teknik PDF Önizleme</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '13px', padding: '6px 16px' }}><FileDown size={14} /> İndir</a>
                                        <button type="button" className="modal-close" onClick={() => setPdfPreviewUrl(null)}><X size={18} /></button>
                                    </div>
                                </div>
                                <iframe src={pdfPreviewUrl} style={{ flex: 1, width: '100%', border: 'none' }} title="PDF Önizleme" />
                            </div>
                        </div>
                    )}

                    <style>{`
                        .card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
                        @media (max-width: 960px) { .card-grid { grid-template-columns: 1fr; } }

                        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

                        .proposal-card { border: 1px solid var(--border); border-radius: 16px; background: var(--card); overflow: hidden; transition: transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease, border-color 0.3s ease; position: relative; }
                        .proposal-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: 0 16px 40px -16px rgba(2,35,71,0.2); }
                        .proposal-card::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.06), transparent 50%); pointer-events: none; opacity: 0; transition: opacity 0.3s; }
                        .proposal-card:hover::after { opacity: 1; }

                        .accent-bar { height: 4px; }
                        .accent-success { background: linear-gradient(90deg,#10b981,#34d399,#6ee7b7,#34d399,#10b981); background-size: 200% 100%; animation: shimmer 4s linear infinite; }
                        .accent-warning { background: linear-gradient(90deg,#f59e0b,#fbbf24,#fcd34d,#fbbf24,#f59e0b); background-size: 200% 100%; animation: shimmer 4s linear infinite; }
                        .accent-danger { background: linear-gradient(90deg,#ef4444,#f87171,#fca5a5,#f87171,#ef4444); background-size: 200% 100%; animation: shimmer 2s linear infinite; }

                        .card-icon { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1); }
                        .proposal-card:hover .card-icon { transform: scale(1.1) rotate(-3deg); }

                        .cok-acil-card { border-color: #fca5a5 !important; }
                        .cok-acil-card:hover { border-color: #ef4444 !important; box-shadow: 0 16px 40px -16px rgba(239,68,68,0.25); }
                        @keyframes acilPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.1); } }
                        .cok-acil-card { animation: acilPulse 2.5s ease-in-out infinite; }
                        .aciliyet-cok-acil { animation: acilBadgePulse 1.5s ease-in-out infinite; }
                        @keyframes acilBadgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } 50% { box-shadow: 0 0 0 4px rgba(239,68,68,0.2); } }

                        .aciliyet-acil { animation: acilAmberPulse 2s ease-in-out infinite; }
                        @keyframes acilAmberPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } 50% { box-shadow: 0 0 0 4px rgba(245,158,11,0.2); } }

                        .pdf-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
                        .pdf-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px -2px rgba(0,0,0,0.1); }

                        .stat-clickable { transition: all 0.2s ease !important; user-select: none; }
                        .stat-clickable:hover { border-color: var(--primary) !important; transform: translateY(-2px); box-shadow: 0 4px 12px -4px rgba(2,35,71,0.15); }
                        .stat-active { border-color: var(--primary) !important; box-shadow: 0 0 0 2px rgba(2,35,71,0.15) !important; background: rgba(2,35,71,0.03) !important; }

                        .filter-panel { transition: box-shadow 0.3s ease; }
                        .filter-panel:hover { box-shadow: 0 4px 16px -8px rgba(2,35,71,0.1); }
                        .filter-accent { height: 3px; background: linear-gradient(90deg, var(--primary), #818cf8, var(--primary)); background-size: 200% 100%; animation: shimmer 3s linear infinite; }
                        .filter-header { transition: background 0.2s ease !important; }
                        .filter-header:hover { background: var(--secondary) !important; }
                        .filter-icon-wrap { transition: transform 0.3s ease; }
                        .filter-header:hover .filter-icon-wrap { transform: scale(1.05) rotate(-3deg); }

                        .notes-block { transition: box-shadow 0.2s ease; }
                        .notes-block:hover { box-shadow: 0 2px 8px -2px rgba(2,35,71,0.1); }

                        .status-badge { display: inline-flex; align-items: center; gap: 5px; }
                    `}</style>
                </main>
            </>
        </AuthGuard>
    );
}
