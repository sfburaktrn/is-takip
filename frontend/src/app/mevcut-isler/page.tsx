'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import {
    getProposalIngestList,
    patchProposalIngest,
    deleteProposalIngest,
    type ProposalIngestRow,
} from '@/lib/api';
import {
    Briefcase,
    Building2,
    Clock,
    Factory,
    Loader2,
    RefreshCcw,
    Trash2,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';

/** Kart içi: kısa tarih-saat, yatay ızgarada yer kaplamasın */
function fmtDtCard(iso: string | null | undefined) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SectionTitle({ children }: { children: string }) {
    return (
        <div className="col-span-full border-b border-slate-200 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--primary,#022347)] first:pt-0">
            {children}
        </div>
    );
}

function DenseField({ label, value }: { label: string; value: string }) {
    const empty = !value || value === '—';
    return (
        <div className="min-w-0 px-1">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            <div
                className={`mt-0.5 break-words text-[10px] leading-tight sm:text-[11px] ${
                    empty ? 'italic text-slate-400' : 'font-medium text-slate-900'
                }`}
            >
                {empty ? '—' : value}
            </div>
        </div>
    );
}

function ProposalCard({
    r,
    onToggleImalat,
    onRequestDelete,
    busy,
}: {
    r: ProposalIngestRow;
    onToggleImalat: (id: number, next: boolean) => void;
    onRequestDelete: (row: ProposalIngestRow) => void;
    busy: boolean;
}) {
    const imalat = r.imalataAlindi === true;
    const hasNotes = Boolean(r.notes?.trim());

    return (
        <article className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-[var(--card,#fff)] shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5">
            <div className="flex h-1.5 w-full shrink-0">
                <div className="w-[28%] max-w-[6rem] bg-[var(--primary,#022347)]" aria-hidden />
                <div className={`min-w-0 flex-1 ${imalat ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
            </div>

            <div className="flex min-h-0 flex-col lg:flex-row">
                {/* Sol şerit: yatay kartın kısa kenarı */}
                <aside className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:w-[13.5rem] lg:border-b-0 lg:border-r lg:border-slate-200 lg:px-4 lg:py-4 xl:w-[15rem]">
                    <span
                        className={`w-fit rounded-md border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                            imalat
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-200 bg-amber-50 text-amber-900'
                        }`}
                    >
                        {imalat ? 'Üretimde' : 'Bekliyor'}
                    </span>
                    <h2 className="line-clamp-3 text-sm font-bold leading-snug text-slate-900">{r.companyName}</h2>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Kaynak ID</p>
                        <p className="mt-1 break-all font-mono text-[10px] leading-snug text-slate-800">{r.sourceProposalId}</p>
                    </div>
                    <div
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 ${
                            imalat ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white'
                        }`}
                    >
                        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium text-slate-800">
                            <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                    imalat ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}
                            >
                                <Factory size={11} strokeWidth={2.25} />
                            </span>
                            <span className="leading-tight">İmalata alındı</span>
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={imalat}
                            disabled={busy}
                            onClick={() => onToggleImalat(r.id, !imalat)}
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 ${
                                imalat ? 'bg-emerald-600 focus-visible:ring-emerald-500' : 'bg-slate-300 focus-visible:ring-slate-400'
                            }`}
                            aria-label={imalat ? 'İmalattan çıkar' : 'İmalata al'}
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                    imalat ? 'translate-x-4' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRequestDelete(r)}
                        className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-white py-1.5 text-[10px] font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
                    >
                        <Trash2 size={12} strokeWidth={2} />
                        Kaydı sil
                    </button>
                </aside>

                {/* Sağ: tüm alanlar 3 sütun sıkı ızgara — tek bakışta */}
                <div className="min-h-0 min-w-0 flex-1 px-4 py-3 sm:px-5 sm:py-3.5 lg:py-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 sm:gap-x-3">
                        <SectionTitle>Zaman ve miktar</SectionTitle>
                        <DenseField label="Teklif tarihi" value={fmtDtCard(r.proposalDate)} />
                        <DenseField label="Miktar" value={String(r.quantity)} />
                        <DenseField label="Teslimat" value={fmtDtCard(r.deliveryDate)} />
                        <DenseField label="Onay kaydı" value={fmtDtCard(r.approvalLoggedAt)} />

                        <SectionTitle>Teklif ve gönderim</SectionTitle>
                        <DenseField label="Gönderim (Teklif)" value={fmtDtCard(r.pushedAt)} />
                        <DenseField label="Gönderen" value={r.pushedBy ?? ''} />
                        <DenseField label="Oluşturulma" value={fmtDtCard(r.createdAt)} />
                        <DenseField label="Son güncelleme" value={fmtDtCard(r.updatedAt)} />

                        <SectionTitle>Teknik</SectionTitle>
                        <DenseField label="Ekipman" value={r.equipment ?? ''} />
                        <DenseField label="Araç" value={r.vehicle ?? ''} />
                        <DenseField label="Hacim" value={r.volume ?? ''} />
                        <DenseField label="Kalınlık" value={r.thickness ?? ''} />

                        <SectionTitle>İletişim</SectionTitle>
                        <DenseField label="İlgili kişi" value={r.contactPerson ?? ''} />
                        <DenseField label="Sahip e-posta" value={r.ownerEmail ?? ''} />

                        <SectionTitle>Notlar</SectionTitle>
                        <div className="col-span-full rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2">
                            <p
                                className="max-h-[4.5rem] overflow-y-auto text-[10px] leading-snug text-slate-800 [scrollbar-width:thin] sm:max-h-[5rem] sm:text-[11px]"
                                title={hasNotes ? r.notes ?? undefined : undefined}
                            >
                                {hasNotes ? (
                                    <span className="block whitespace-pre-wrap break-words pr-1">{r.notes!.trim()}</span>
                                ) : (
                                    <span className="text-slate-400 italic">Not yok.</span>
                                )}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

export default function MevcutIslerPage() {
    const [rows, setRows] = useState<ProposalIngestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProposalIngestRow | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getProposalIngestList(300);
            setRows(data.map(r => ({ ...r, imalataAlindi: r.imalataAlindi === true })));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleToggleImalat = useCallback(async (id: number, next: boolean) => {
        setBusyId(id);
        setError(null);
        try {
            const updated = await patchProposalIngest(id, next);
            setRows(prev => {
                const mapped = prev.map(x =>
                    x.id === id ? { ...updated, imalataAlindi: updated.imalataAlindi === true } : x
                );
                return [...mapped].sort((a, b) => {
                    if (a.imalataAlindi !== b.imalataAlindi) return a.imalataAlindi ? 1 : -1;
                    return new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime();
                });
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Güncellenemedi');
        } finally {
            setBusyId(null);
        }
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        setError(null);
        try {
            await deleteProposalIngest(deleteTarget.id);
            setRows(prev => prev.filter(x => x.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Silinemedi');
        } finally {
            setDeleteLoading(false);
        }
    }, [deleteTarget]);

    const counts = useMemo(() => {
        const pending = rows.filter(r => !r.imalataAlindi).length;
        const done = rows.filter(r => r.imalataAlindi).length;
        return { pending, done, total: rows.length };
    }, [rows]);

    return (
        <AuthGuard>
            <>
                <Sidebar />
                <main className="main-content analytics-page min-h-0">
                    <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                        <div className="flex flex-col lg:flex-row w-full justify-between items-stretch lg:items-start gap-4">
                            <div className="min-w-0 flex-1">
                                <h1 className="header-title">
                                    <Briefcase size={32} className="inline mr-2 sm:mr-3 align-middle shrink-0" />
                                    Mevcut işler
                                </h1>
                                <p className="header-subtitle max-w-3xl">
                                    Teklif Takip üzerinden gelen onaylı teklif kayıtları. Silmek yalnızca bu listeyi etkiler;
                                    damper, dorse ve şasi üretim kayıtlarına dokunulmaz.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary analytics-touch-target w-full lg:w-auto justify-center shrink-0 flex items-center gap-2"
                                onClick={load}
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                                Yenile
                            </button>
                        </div>
                        {!loading && rows.length > 0 ? (
                            <div className="stats-grid w-full" style={{ marginBottom: 0 }}>
                                <div className="stat-card">
                                    <div className="stat-icon blue">
                                        <Building2 size={22} />
                                    </div>
                                    <div>
                                        <div className="stat-value">{counts.total}</div>
                                        <div className="stat-label">Toplam kayıt</div>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon yellow">
                                        <Clock size={22} />
                                    </div>
                                    <div>
                                        <div className="stat-value">{counts.pending}</div>
                                        <div className="stat-label">Bekliyor (imalata alınacak)</div>
                                    </div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon green">
                                        <CheckCircle2 size={22} />
                                    </div>
                                    <div>
                                        <div className="stat-value">{counts.done}</div>
                                        <div className="stat-label">Üretimde (imalata alındı)</div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </header>

                    {error && (
                        <div
                            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 sm:text-base"
                            role="alert"
                        >
                            <AlertTriangle className="mt-0.5 shrink-0" size={20} />
                            {error}
                        </div>
                    )}

                    {loading && rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] py-20">
                            <Loader2 className="animate-spin text-[var(--primary)]" size={32} />
                            <p className="mt-4 text-[var(--muted)]">Yükleniyor…</p>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] py-16 text-center">
                            <Briefcase className="mx-auto text-slate-200" size={40} />
                            <p className="mt-3 font-semibold text-slate-700">Kayıt yok</p>
                            <p className="mx-auto mt-1 max-w-sm px-6 text-sm text-[var(--muted)]">
                                Teklif Takip üzerinden gönderim yapılınca burada görünür.
                            </p>
                        </div>
                    ) : (
                        <ul className="m-0 grid list-none grid-cols-1 items-start gap-5 p-0 lg:grid-cols-2 lg:gap-6">
                            {rows.map(r => (
                                <li key={r.id} className="min-w-0">
                                    <ProposalCard
                                        r={r}
                                        busy={busyId === r.id}
                                        onToggleImalat={handleToggleImalat}
                                        onRequestDelete={setDeleteTarget}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}

                {deleteTarget ? (
                    <div
                        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
                        role="presentation"
                        onClick={() => !deleteLoading && setDeleteTarget(null)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="del-title"
                            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl sm:rounded-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="border-b border-[var(--border)] px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
                                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-600">
                                    <AlertTriangle size={22} />
                                </div>
                                <h2 id="del-title" className="mt-4 text-lg font-bold text-slate-900">
                                    Kaydı sil?
                                </h2>
                                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                                    <span className="font-semibold text-slate-900">{deleteTarget.companyName}</span> satırı
                                    silinecek. Üretim kayıtları değişmez.
                                </p>
                                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-4 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                        Kaynak ID
                                    </p>
                                    <p className="mt-1 break-all font-mono text-xs text-slate-800">{deleteTarget.sourceProposalId}</p>
                                </div>
                            </div>
                            <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-slate-50/80 px-6 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-8">
                                <button
                                    type="button"
                                    className="rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-slate-700"
                                    disabled={deleteLoading}
                                    onClick={() => setDeleteTarget(null)}
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="button"
                                    className="rounded-lg bg-[var(--danger,#ef4444)] px-4 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                                    disabled={deleteLoading}
                                    onClick={handleConfirmDelete}
                                >
                                    {deleteLoading ? (
                                        <span className="inline-flex items-center gap-2">
                                            <Loader2 size={16} className="animate-spin" />
                                            Siliniyor
                                        </span>
                                    ) : (
                                        'Sil'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}
                </main>
            </>
        </AuthGuard>
    );
}
