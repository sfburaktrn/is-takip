'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import {
    getPlanningProposals,
    getPlanningMeta,
    getPlanningAlerts,
    putProposalPlanning,
    type ProposalIngestRow,
    type PlanningProductType,
    type PlanningMetaStep,
    type PlanningAlertsResponse,
    type ProposalPlanSegmentRow,
} from '@/lib/api';
import {
    Loader2,
    Save,
    Building2,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Sparkles,
    RefreshCcw,
    ChevronLeft,
    ChevronRight,
    Layers,
    LayoutGrid,
} from 'lucide-react';
import {
    planningUnitCount,
    rangeForTimeline,
    segmentBarPercent,
    monthTitleTr,
    buildMonthGrid,
    stepBarGradient,
    type TimelineView,
} from './planningUtils';

function fmt(iso: string | null | undefined) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function fmtDateShort(iso: string | null | undefined) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function fmtLocalValue(v: string) {
    if (!v) return 'Tarih bekliyor';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return 'Tarih bekliyor';
    return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const t = d.getTime() - d.getTimezoneOffset() * 60000;
    return new Date(t).toISOString().slice(0, 16);
}

function dateOnlyForInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const t = d.getTime() - d.getTimezoneOffset() * 60000;
    return new Date(t).toISOString().slice(0, 10);
}

function fromDateInputToIso(dateStr: string): string | null {
    if (!dateStr) return null;
    const d = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function fromDatetimeLocalToIso(v: string): string | null {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

type StepFormRow = { plannedStart: string; plannedEnd: string; durationDays: string };

type PreviewSegment = {
    unitIndex: number;
    step: PlanningMetaStep;
    index: number;
    start: Date;
    end: Date;
};

function emptyStepMap(steps: PlanningMetaStep[]): Record<string, StepFormRow> {
    const m: Record<string, StepFormRow> = {};
    for (const s of steps) {
        m[s.mainStepKey] = { plannedStart: '', plannedEnd: '', durationDays: '' };
    }
    return m;
}

function hydrateUnitForms(
    row: ProposalIngestRow,
    steps: PlanningMetaStep[],
    unitCount: number
): Record<number, Record<string, StepFormRow>> {
    const out: Record<number, Record<string, StepFormRow>> = {};
    for (let u = 1; u <= unitCount; u++) {
        out[u] = emptyStepMap(steps);
    }
    for (const seg of row.planSegments || []) {
        const raw = (seg as ProposalPlanSegmentRow).unitIndex;
        const ui = typeof raw === 'number' && raw >= 1 && raw <= unitCount ? raw : 1;
        const key = seg.mainStepKey;
        if (out[ui]?.[key]) {
            out[ui][key] = {
                plannedStart: toDatetimeLocalValue(seg.plannedStart),
                plannedEnd: toDatetimeLocalValue(seg.plannedEnd),
                durationDays: seg.durationDays != null ? String(seg.durationDays) : '',
            };
        }
    }
    return out;
}

function AlertsStrip({ alerts }: { alerts: PlanningAlertsResponse | null }) {
    if (!alerts || (alerts.overdue.length === 0 && alerts.dueSoon.length === 0)) return null;
    return (
        <div className="plan-alerts flex flex-col gap-2.5 mb-5">
            {alerts.overdue.length > 0 && (
                <div
                    role="status"
                    className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/95 to-white px-4 py-3.5 flex gap-3 shadow-sm"
                >
                    <AlertTriangle className="shrink-0 text-red-600 mt-0.5" size={20} />
                    <div className="min-w-0">
                        <div className="font-bold text-red-900 text-sm">Geciken plan hedefi</div>
                        <ul className="mt-2 pl-4 text-xs text-red-950 space-y-0.5">
                            {alerts.overdue.map((x) => (
                                <li key={x.id}>
                                    <strong>{x.companyName}</strong> — {fmt(x.deadline)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
            {alerts.dueSoon.length > 0 && (
                <div
                    role="status"
                    className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-white px-4 py-3.5 flex gap-3 shadow-sm"
                >
                    <Clock className="shrink-0 text-amber-700 mt-0.5" size={20} />
                    <div className="min-w-0">
                        <div className="font-bold text-amber-950 text-sm">
                            Yaklaşan teslim ({alerts.soonDays} gün içinde)
                        </div>
                        <ul className="mt-2 pl-4 text-xs text-amber-950 space-y-0.5">
                            {alerts.dueSoon.map((x) => (
                                <li key={x.id}>
                                    <strong>{x.companyName}</strong> — {fmt(x.deadline)}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

const WEEKDAYS_TR = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const planPanel =
    'rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]';

const planSubPanel = 'rounded-2xl border border-slate-200/80 bg-slate-50/70 shadow-sm shadow-slate-200/40';

const planInput =
    'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[var(--primary)]/50 focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/10';

const planInputCompact =
    'mt-1.5 h-10 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition focus:border-[var(--primary)]/50 focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/10';

const planPrimaryBtn =
    'inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--primary)]/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:brightness-100';

const planSecondaryBtn =
    'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

function urgencyTone(level: ProposalIngestRow['manufacturingAciliyet']) {
    if (level === 'Çok Acil') {
        return {
            label: level,
            className: 'border-rose-200 bg-rose-50 text-rose-700',
        };
    }
    if (level === 'Acil') {
        return {
            label: level,
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
    }
    return {
        label: level || 'Normal',
        className: 'border-slate-200 bg-slate-100 text-slate-600',
    };
}

function urgencyToneOnDark(level: ProposalIngestRow['manufacturingAciliyet']) {
    if (level === 'Çok Acil') return 'border-rose-400/30 bg-rose-500/15 text-rose-100';
    if (level === 'Acil') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
    return 'border-white/15 bg-white/10 text-slate-100';
}

type PlanMetricCardProps = {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon: ReactNode;
    tone?: 'primary' | 'slate' | 'emerald' | 'amber';
};

function PlanMetricCard({ label, value, hint, icon, tone = 'slate' }: PlanMetricCardProps) {
    const toneMap = {
        primary: {
            wrap: 'border-[color-mix(in_srgb,var(--primary)_12%,white)] bg-[color-mix(in_srgb,var(--primary)_5%,white)]',
            icon: 'bg-[var(--primary)]/12 text-[var(--primary)]',
        },
        slate: {
            wrap: 'border-slate-200/80 bg-white',
            icon: 'bg-slate-100 text-slate-700',
        },
        emerald: {
            wrap: 'border-emerald-200/80 bg-emerald-50/70',
            icon: 'bg-emerald-100 text-emerald-700',
        },
        amber: {
            wrap: 'border-amber-200/80 bg-amber-50/80',
            icon: 'bg-amber-100 text-amber-700',
        },
    }[tone];

    return (
        <div className={`rounded-2xl border px-4 py-4 text-start shadow-sm ${toneMap.wrap}`}>
            <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${toneMap.icon}`}>
                    {icon}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                    <div className="mt-1 break-words text-base font-semibold text-slate-900">{value}</div>
                    {hint ? <div className="mt-1 break-words text-xs leading-relaxed text-slate-500">{hint}</div> : null}
                </div>
            </div>
        </div>
    );
}

type QueueProposalCardProps = {
    row: ProposalIngestRow;
    unitCount: number;
    active: boolean;
    onSelect: (id: number) => void;
};

function QueueProposalCard({ row, unitCount, active, onSelect }: QueueProposalCardProps) {
    const urgency = urgencyTone(row.manufacturingAciliyet);
    const hasPlan = (row.planSegments?.length ?? 0) > 0;
    const equipmentSummary = [row.equipment, row.vehicle, row.volume].filter(Boolean).join(' · ');

    return (
        <button
            type="button"
            onClick={() => onSelect(row.id)}
            className={`w-full rounded-[28px] border p-6 text-start transition-all ${
                active
                    ? 'border-[color-mix(in_srgb,var(--primary)_24%,white)] bg-[color-mix(in_srgb,var(--primary)_8%,white)] shadow-lg shadow-[var(--primary)]/10 ring-1 ring-[color-mix(in_srgb,var(--primary)_16%,white)]'
                    : 'border-slate-200/80 bg-white shadow-sm hover:border-slate-300 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="break-words text-base font-semibold leading-snug text-slate-900">{row.companyName}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {equipmentSummary || `Teklif #${row.sourceProposalId}`}
                    </div>
                </div>
                <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${urgency.className}`}
                >
                    {urgency.label}
                </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 text-start">
                <div className="rounded-2xl bg-slate-50/90 px-3.5 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Miktar</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{row.quantity} adet</div>
                </div>
                <div className="rounded-2xl bg-slate-50/90 px-3.5 py-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Araç planı</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{unitCount} araç</div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        hasPlan ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                    {hasPlan ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {hasPlan ? 'Plan taslağı var' : 'Plan bekliyor'}
                </span>
                <span className="text-[11px] font-medium text-slate-500">Teslim {fmtDateShort(row.deliveryDate)}</span>
            </div>
        </button>
    );
}

type StepPlanCardProps = {
    step: PlanningMetaStep;
    index: number;
    row: StepFormRow;
    onChange: (patch: Partial<StepFormRow>) => void;
};

function StepPlanCard({ step, index, row, onChange }: StepPlanCardProps) {
    const isPlanned = Boolean(row.plannedStart && row.plannedEnd);
    const durationSummary = row.durationDays.trim() ? `${row.durationDays} gün planlandı` : 'Süre bekleniyor';

    return (
        <article className="group relative self-start overflow-hidden rounded-[30px] border border-slate-200/80 bg-white p-6 text-start shadow-[0_24px_40px_-28px_rgba(15,23,42,0.45)] transition duration-200 hover:border-slate-300 hover:shadow-md sm:p-7">
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: stepBarGradient(step.mainStepKey, index) }} />

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Bölüm {index + 1}</div>
                    <h3 className="mt-1 break-words text-base font-semibold text-slate-900">{step.label}</h3>
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">
                        {isPlanned
                            ? `${fmtLocalValue(row.plannedStart)} - ${fmtLocalValue(row.plannedEnd)}`
                            : 'Başlangıç ve bitiş girildiğinde burada özetlenecek.'}
                    </p>
                </div>
                <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        isPlanned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                >
                    {isPlanned ? 'Planlı' : 'Taslak'}
                </span>
            </div>

            <div className="mt-7 flex min-w-0 flex-col gap-7 lg:flex-row lg:items-stretch lg:gap-10">
                <div className="w-full shrink-0 rounded-[24px] border border-slate-200/80 bg-slate-50/90 p-5 lg:w-[14rem] lg:max-w-full">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Süre parametresi</div>
                    <div className="mt-2 text-sm font-semibold text-slate-700">{durationSummary}</div>
                    <label className="mt-4 block w-full max-w-full lg:max-w-none">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Süre (gün)</span>
                        <input
                            type="number"
                            min={1}
                            value={row.durationDays}
                            onChange={(e) => onChange({ durationDays: e.target.value })}
                            className={planInputCompact}
                        />
                    </label>
                </div>

                <div className="min-w-0 flex-1 rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Plan aralığı</div>
                    <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <label className="block min-w-0 lg:min-w-[min(100%,17rem)]">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Başlangıç</span>
                            <input
                                type="datetime-local"
                                value={row.plannedStart}
                                onChange={(e) => onChange({ plannedStart: e.target.value })}
                                className={planInputCompact}
                            />
                        </label>
                        <label className="block min-w-0 lg:min-w-[min(100%,17rem)]">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Bitiş</span>
                            <input
                                type="datetime-local"
                                value={row.plannedEnd}
                                onChange={(e) => onChange({ plannedEnd: e.target.value })}
                                className={planInputCompact}
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-start gap-x-5 gap-y-2 border-t border-slate-100 pb-2 pt-5 text-start text-xs leading-relaxed text-slate-500">
                <span className="font-medium text-slate-700">
                    {isPlanned ? 'Tarih aralığı hazır' : 'Başlangıç ve bitiş bekleniyor'}
                </span>
                <span>{row.plannedStart ? `Başlangıç ${fmtLocalValue(row.plannedStart)}` : 'Başlangıç boş'}</span>
                <span>{row.plannedEnd ? `Bitiş ${fmtLocalValue(row.plannedEnd)}` : 'Bitiş boş'}</span>
            </div>
        </article>
    );
}

export default function PlanlamaPage() {
    const [rows, setRows] = useState<ProposalIngestRow[]>([]);
    const [alerts, setAlerts] = useState<PlanningAlertsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const [productType, setProductType] = useState<PlanningProductType>('DAMPER');
    const [metaSteps, setMetaSteps] = useState<PlanningMetaStep[]>([]);
    const [expectedDays, setExpectedDays] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [unitStepForms, setUnitStepForms] = useState<Record<number, Record<string, StepFormRow>>>({});
    const [activeUnitIndex, setActiveUnitIndex] = useState(1);
    const [anchorDate, setAnchorDate] = useState('');

    const [timelineView, setTimelineView] = useState<TimelineView>('month');
    const [timelineAnchor, setTimelineAnchor] = useState(() => new Date());

    const selected = useMemo(
        () => (selectedId == null ? null : rows.find((r) => r.id === selectedId) ?? null),
        [rows, selectedId]
    );

    const unitCount = useMemo(() => planningUnitCount(selected?.quantity), [selected?.quantity]);

    const { start: rangeStart, end: rangeEnd } = useMemo(
        () => rangeForTimeline(timelineAnchor, timelineView),
        [timelineAnchor, timelineView]
    );

    const monthGrid = useMemo(
        () =>
            buildMonthGrid(
                timelineAnchor.getFullYear(),
                timelineAnchor.getMonth(),
                new Date()
            ),
        [timelineAnchor]
    );

    const loadAll = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const [list, al] = await Promise.all([getPlanningProposals(400), getPlanningAlerts(4)]);
            setRows(list);
            setAlerts(al);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Veri yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAll();
    }, [loadAll]);

    const loadMeta = useCallback(async (t: PlanningProductType) => {
        const m = await getPlanningMeta(t);
        setMetaSteps(m.steps);
        return m.steps;
    }, []);

    useEffect(() => {
        const row = selectedId == null ? null : rows.find((r) => r.id === selectedId);
        if (!row) return;
        const t = (row.planningProductType as PlanningProductType) || 'DAMPER';
        setProductType(t);
        setExpectedDays(row.expectedDeliveryDays != null ? String(row.expectedDeliveryDays) : '');
        setTargetDate(dateOnlyForInput(row.targetDeliveryDate ?? null));
        setActiveUnitIndex(1);

        let cancelled = false;
        void (async () => {
            const steps = await loadMeta(t);
            if (cancelled) return;
            const uc = planningUnitCount(row.quantity);
            setUnitStepForms(hydrateUnitForms(row, steps, uc));
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedId, rows, loadMeta]);

    const onChangeProductType = async (t: PlanningProductType) => {
        setProductType(t);
        const steps = await loadMeta(t);
        const uc = unitCount;
        setUnitStepForms((prev) => {
            const next: Record<number, Record<string, StepFormRow>> = {};
            for (let u = 1; u <= uc; u++) {
                const base = emptyStepMap(steps);
                const old = prev[u] || {};
                for (const s of steps) {
                    if (old[s.mainStepKey]) base[s.mainStepKey] = { ...base[s.mainStepKey], ...old[s.mainStepKey] };
                }
                next[u] = base;
            }
            return next;
        });
    };

    const applySequentialDays = () => {
        if (!anchorDate || !metaSteps.length) return;
        const startMs = new Date(`${anchorDate}T08:00:00`).getTime();
        if (Number.isNaN(startMs)) return;
        let cursor = startMs;
        setUnitStepForms((prev) => {
            const u = activeUnitIndex;
            const cur = { ...(prev[u] || {}) };
            for (const s of metaSteps) {
                const daysStr = cur[s.mainStepKey]?.durationDays || '1';
                const days = Math.max(1, parseInt(daysStr, 10) || 1);
                const spanMs = days * 24 * 60 * 60 * 1000;
                const startIso = new Date(cursor).toISOString();
                const endIso = new Date(cursor + spanMs - 60 * 1000).toISOString();
                cur[s.mainStepKey] = {
                    plannedStart: toDatetimeLocalValue(startIso),
                    plannedEnd: toDatetimeLocalValue(endIso),
                    durationDays: String(days),
                };
                cursor += spanMs;
            }
            return { ...prev, [u]: cur };
        });
    };

    const updateStep = (unitIdx: number, key: string, patch: Partial<StepFormRow>) => {
        setUnitStepForms((prev) => {
            const u = { ...(prev[unitIdx] || {}) };
            const cur = u[key] || { plannedStart: '', plannedEnd: '', durationDays: '' };
            u[key] = { ...cur, ...patch };
            return { ...prev, [unitIdx]: u };
        });
    };

    const handleSave = async () => {
        if (!selected) return;
        setSaving(true);
        setError(null);
        try {
            const segments: Array<{
                unitIndex: number;
                mainStepKey: string;
                plannedStart: string;
                plannedEnd: string;
                durationDays: number | null;
            }> = [];

            for (let u = 1; u <= unitCount; u++) {
                for (const s of metaSteps) {
                    const row = unitStepForms[u]?.[s.mainStepKey];
                    if (!row?.plannedStart || !row?.plannedEnd) continue;
                    const ps = fromDatetimeLocalToIso(row.plannedStart);
                    const pe = fromDatetimeLocalToIso(row.plannedEnd);
                    if (!ps || !pe) continue;
                    let durationDays: number | null = null;
                    if (row.durationDays.trim()) {
                        const n = parseInt(row.durationDays, 10);
                        if (Number.isFinite(n)) durationDays = n;
                    }
                    segments.push({
                        unitIndex: u,
                        mainStepKey: s.mainStepKey,
                        plannedStart: ps,
                        plannedEnd: pe,
                        durationDays,
                    });
                }
            }

            let exp: number | null = null;
            if (expectedDays.trim() !== '') {
                const n = parseInt(expectedDays, 10);
                if (Number.isFinite(n) && n >= 0 && n <= 3650) exp = n;
            }

            const updated = await putProposalPlanning(selected.id, {
                planningProductType: productType,
                expectedDeliveryDays: exp,
                targetDeliveryDate: fromDateInputToIso(targetDate) ?? null,
                segments,
            });
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setUnitStepForms(hydrateUnitForms(updated, metaSteps, planningUnitCount(updated.quantity)));
            const al = await getPlanningAlerts(4);
            setAlerts(al);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Kayıt başarısız');
        } finally {
            setSaving(false);
        }
    };

    const shiftTimeline = (dir: -1 | 1) => {
        setTimelineAnchor((prev) => {
            const d = new Date(prev);
            if (timelineView === 'month') {
                d.setMonth(d.getMonth() + dir);
            } else {
                d.setDate(d.getDate() + dir * 7);
            }
            return d;
        });
    };

    const dayColumns = useMemo(() => {
        const cols: Date[] = [];
        const x = new Date(rangeStart);
        while (x < rangeEnd) {
            cols.push(new Date(x));
            x.setDate(x.getDate() + 1);
        }
        return cols;
    }, [rangeStart, rangeEnd]);

    const planPreview = useMemo(() => {
        const byUnit: Record<number, PreviewSegment[]> = {};
        let plannedSteps = 0;
        let plannedUnits = 0;

        for (let u = 1; u <= unitCount; u += 1) {
            const segments: PreviewSegment[] = [];
            for (const [index, step] of metaSteps.entries()) {
                const row = unitStepForms[u]?.[step.mainStepKey];
                if (!row?.plannedStart || !row?.plannedEnd) continue;
                const start = new Date(row.plannedStart);
                const end = new Date(row.plannedEnd);
                if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
                segments.push({ unitIndex: u, step, index, start, end });
            }
            if (segments.length > 0) plannedUnits += 1;
            plannedSteps += segments.length;
            byUnit[u] = segments.sort((a, b) => a.start.getTime() - b.start.getTime());
        }

        return {
            byUnit,
            plannedSteps,
            plannedUnits,
            totalSteps: metaSteps.length * unitCount,
        };
    }, [metaSteps, unitCount, unitStepForms]);

    const queueStats = useMemo(
        () => ({
            readyCount: rows.filter((r) => (r.planSegments?.length ?? 0) > 0).length,
            urgentCount: rows.filter((r) => r.manufacturingAciliyet === 'Acil' || r.manufacturingAciliyet === 'Çok Acil').length,
            alertCount: (alerts?.overdue.length ?? 0) + (alerts?.dueSoon.length ?? 0),
        }),
        [alerts, rows]
    );

    const completionPercent = planPreview.totalSteps > 0 ? Math.round((planPreview.plannedSteps / planPreview.totalSteps) * 100) : 0;
    const activeUnitPlannedSteps = planPreview.byUnit[activeUnitIndex]?.length ?? 0;
    const activeUnitForm = unitStepForms[activeUnitIndex] || {};
    const selectedUrgency = selected ? urgencyTone(selected.manufacturingAciliyet) : null;
    const activeUnitSegments = planPreview.byUnit[activeUnitIndex] || [];
    const activeUnitWindow =
        activeUnitSegments.length > 0
            ? `${fmt(activeUnitSegments[0].start.toISOString())} - ${fmt(
                  activeUnitSegments[activeUnitSegments.length - 1].end.toISOString()
              )}`
            : 'Henüz zaman penceresi oluşturulmadı';
    const selectedSummary = selected ? [selected.equipment, selected.vehicle, selected.volume].filter(Boolean).join(' · ') : '';
    const selectedContact = selected ? [selected.contactPerson, selected.ownerEmail].filter(Boolean).join(' · ') : '';
    const timelineAnchorDayMs = new Date(
        timelineAnchor.getFullYear(),
        timelineAnchor.getMonth(),
        timelineAnchor.getDate()
    ).getTime();

    const nowMs = Date.now();
    const timelineLabel = useMemo(() => {
        if (timelineView === 'month') return monthTitleTr(timelineAnchor);
        const endVisible = new Date(rangeEnd.getTime() - 24 * 60 * 60 * 1000);
        return `${rangeStart.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
        })} - ${endVisible.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: 'short',
        })}`;
    }, [rangeEnd, rangeStart, timelineAnchor, timelineView]);

    return (
        <AuthGuard>
            <div className="app-shell">
                <Sidebar />
                <main className="main-content">
                    <div className="content-inner max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8">
                        {/* Hero */}
                        <header className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/90 to-[color-mix(in_srgb,var(--primary)_6%,white)] shadow-lg shadow-slate-200/60 mb-6">
                            <div
                                className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full opacity-[0.12]"
                                style={{ background: 'var(--primary)' }}
                            />
                            <div className="relative flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
                                <div className="flex items-start gap-4 min-w-0">
                                    <div
                                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                                        style={{
                                            background: 'linear-gradient(135deg, var(--primary), #0f2847)',
                                        }}
                                    >
                                        <LayoutGrid size={28} strokeWidth={1.75} />
                                    </div>
                                    <div className="min-w-0">
                                        <h1 className="header-title m-0 text-2xl sm:text-3xl tracking-tight">
                                            Üretim planı
                                        </h1>
                                        <p className="header-subtitle mt-2 max-w-2xl text-sm sm:text-[15px] leading-relaxed text-slate-600">
                                            <span className="font-semibold text-slate-800">Üretim planı bekleyenler</span>{' '}
                                            yalnızca{' '}
                                            <Link href="/mevcut-isler" className="font-semibold text-[var(--primary)] underline-offset-2 hover:underline">
                                                Mevcut işler
                                            </Link>
                                            ’de <strong>İmalata alındı</strong> açıldığında listelenir. Miktar kadar{' '}
                                            <strong>ayrı araç</strong> satırı planlanır; zaman çizelgesi bölümleri
                                            gösterir.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`${planSecondaryBtn} shrink-0`}
                                    onClick={() => void loadAll()}
                                    disabled={loading}
                                >
                                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                                    Yenile
                                </button>
                            </div>
                        </header>

                        <AlertsStrip alerts={alerts} />

                        {error && (
                            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div className={`${planPanel} flex justify-center px-6 py-12`}>
                                <OzunluLoading variant="compact" />
                            </div>
                        ) : (
                            <section className={`${planPanel} overflow-hidden`}>
                                    <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/70 px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                                                <Layers size={20} />
                                            </span>
                                            <div>
                                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                    Plan kuyruğu
                                                </div>
                                                <div className="mt-1 text-xl font-semibold text-slate-900">Bekleyen teklifler</div>
                                            </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5 xl:min-w-[540px]">
                                            <PlanMetricCard
                                                label="Toplam"
                                                value={rows.length}
                                                icon={<Layers size={18} />}
                                                tone="slate"
                                            />
                                            <PlanMetricCard
                                                label="Taslaklı"
                                                value={queueStats.readyCount}
                                                icon={<CheckCircle2 size={18} />}
                                                tone="emerald"
                                            />
                                            <PlanMetricCard
                                                label="Kritik"
                                                value={Math.max(queueStats.urgentCount, queueStats.alertCount)}
                                                icon={<AlertTriangle size={18} />}
                                                tone="amber"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-5">
                                        {rows.length === 0 ? (
                                            <p className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm leading-relaxed text-slate-500">
                                                Kuyruk boş.{' '}
                                                <Link href="/mevcut-isler" className="font-semibold text-[var(--primary)]">
                                                    Mevcut işler
                                                </Link>
                                                ’de <strong>İmalata alındı</strong> ile ekleyin.
                                            </p>
                                        ) : (
                                            <div className="grid gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3 xl:gap-6 2xl:grid-cols-4 2xl:gap-6">
                                                {rows.map((r) => (
                                                    <QueueProposalCard
                                                        key={r.id}
                                                        row={r}
                                                        unitCount={planningUnitCount(r.quantity)}
                                                        active={selectedId === r.id}
                                                        onSelect={setSelectedId}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                <div className="border-t border-slate-200/80 bg-slate-50/45">
                                    {!selected ? (
                                        <div className="flex min-h-[520px] flex-col items-center justify-center px-8 py-16 text-center">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-[28px] bg-[var(--primary)]/10 text-[var(--primary)]">
                                                <LayoutGrid size={30} />
                                            </div>
                                            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
                                                Planlama için teklif seçin
                                            </h2>
                                            <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                                                Yukarıdaki kuyruktan bir teklif seçtiğinizde teslim hedefleri, araç bazlı zaman
                                                çizelgesi ve bölüm plan kartları burada açılır.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-8 p-5 sm:p-6 xl:p-8">
                                            <header className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-start text-white shadow-xl shadow-slate-900/10">
                                                <div className="flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-start lg:gap-10">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                                                                Aktif teklif
                                                            </span>
                                                            {selectedUrgency ? (
                                                                <span
                                                                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${urgencyToneOnDark(
                                                                        selected.manufacturingAciliyet
                                                                    )}`}
                                                                >
                                                                    {selectedUrgency.label}
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        <div className="mt-5 flex items-start gap-4">
                                                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-white/10 text-white ring-1 ring-white/10">
                                                                <Building2 size={28} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h2 className="break-words text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-[1.9rem]">
                                                                    {selected.companyName}
                                                                </h2>
                                                                <p className="mt-3 max-w-3xl break-words text-sm leading-relaxed text-slate-300">
                                                                    {selectedSummary || 'Teklif detayında ekipman/araç özeti girilmemiş.'}
                                                                </p>
                                                                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-300">
                                                                    <span>Teklif: {fmt(selected.proposalDate)}</span>
                                                                    <span>Teslim: {fmt(selected.deliveryDate)}</span>
                                                                    {selectedContact ? <span>İlgili: {selectedContact}</span> : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-full shrink-0 rounded-[28px] border border-white/10 bg-white/5 p-5 lg:max-w-[22.5rem]">
                                                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                                                            Plan durumu
                                                        </div>
                                                        <div className="mt-4 grid gap-3">
                                                            <div className="rounded-2xl bg-white/5 px-4 py-3.5">
                                                                <div className="text-[10px] font-bold uppercase tracking-wide text-white/50">
                                                                    Kapsam
                                                                </div>
                                                                <div className="mt-1 text-xl font-semibold">
                                                                    {planPreview.plannedSteps} / {planPreview.totalSteps} adım
                                                                </div>
                                                            </div>
                                                            <div className="rounded-2xl bg-white/5 px-4 py-3.5">
                                                                <div className="text-[10px] font-bold uppercase tracking-wide text-white/50">
                                                                    Düzenlenen araç
                                                                </div>
                                                                <div className="mt-1 text-xl font-semibold">
                                                                    Araç {activeUnitIndex} / {unitCount}
                                                                </div>
                                                            </div>
                                                            <div className="rounded-2xl bg-white/5 px-4 py-3.5">
                                                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-white/50">
                                                                    <span>Tamamlama</span>
                                                                    <span>%{completionPercent}</span>
                                                                </div>
                                                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                                                                    <div
                                                                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-400"
                                                                        style={{ width: `${completionPercent}%` }}
                                                                    />
                                                                </div>
                                                                <p className="mt-3 text-xs leading-relaxed text-slate-300">{activeUnitWindow}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </header>

                                            <div className="grid gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-4 xl:gap-6">
                                                <PlanMetricCard
                                                    label="Teklif teslimi"
                                                    value={fmt(selected.deliveryDate)}
                                                    hint="Müşteriye verilen hedef tarih"
                                                    icon={<Clock size={20} />}
                                                    tone="slate"
                                                />
                                                <PlanMetricCard
                                                    label="Miktar"
                                                    value={`${selected.quantity} adet`}
                                                    hint={`Bu sipariş için ${unitCount} araç kartı açılır`}
                                                    icon={<Layers size={20} />}
                                                    tone="slate"
                                                />
                                                <PlanMetricCard
                                                    label="Plan hedefi"
                                                    value={targetDate ? fmtDateShort(fromDateInputToIso(targetDate)) : 'Henüz tanımlanmadı'}
                                                    hint="Operasyon hedef tarihi"
                                                    icon={<AlertTriangle size={20} />}
                                                    tone="amber"
                                                />
                                                <PlanMetricCard
                                                    label="Tamamlanan"
                                                    value={`${activeUnitPlannedSteps} / ${metaSteps.length} bölüm`}
                                                    hint="Aktif araç için dolu adımlar"
                                                    icon={<Sparkles size={20} />}
                                                    tone="primary"
                                                />
                                            </div>

                                            <section className={`${planSubPanel} p-5 sm:p-6`}>
                                                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                            Araç seçimi
                                                        </div>
                                                        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                                                            Araç bazlı plan akışı
                                                        </h3>
                                                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                                                            Takvim ve zaman çizelgesi büyütüldü. Ürün türünü değiştirerek farklı operasyon
                                                            adımlarına geçebilir, aktif araç sekmesinden planı ayrı ayrı yönetebilirsiniz.
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(['DAMPER', 'DORSE'] as const).map((t) => (
                                                            <button
                                                                key={t}
                                                                type="button"
                                                                onClick={() => void onChangeProductType(t)}
                                                                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                                                                    productType === t
                                                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                                                                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                                                }`}
                                                            >
                                                                {t === 'DAMPER' ? 'Damper' : 'Dorse'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="mt-5 flex flex-wrap gap-3">
                                                    {Array.from({ length: unitCount }, (_, i) => i + 1).map((u) => (
                                                        <button
                                                            key={u}
                                                            type="button"
                                                            onClick={() => setActiveUnitIndex(u)}
                                                            className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                                                                activeUnitIndex === u
                                                                    ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_12%,white)] text-[var(--primary)] shadow-sm'
                                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                                                            }`}
                                                        >
                                                            Araç {u}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                                                    <div className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
                                                        <div className="mb-4 flex items-center justify-between">
                                                            <button
                                                                type="button"
                                                                aria-label="Önceki ay"
                                                                className="rounded-2xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                                                                onClick={() =>
                                                                    setTimelineAnchor((d) => {
                                                                        const x = new Date(d);
                                                                        x.setMonth(x.getMonth() - 1);
                                                                        return x;
                                                                    })
                                                                }
                                                            >
                                                                <ChevronLeft size={20} />
                                                            </button>
                                                            <span className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">
                                                                {monthTitleTr(timelineAnchor)}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                aria-label="Sonraki ay"
                                                                className="rounded-2xl p-2.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                                                                onClick={() =>
                                                                    setTimelineAnchor((d) => {
                                                                        const x = new Date(d);
                                                                        x.setMonth(x.getMonth() + 1);
                                                                        return x;
                                                                    })
                                                                }
                                                            >
                                                                <ChevronRight size={20} />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                            {WEEKDAYS_TR.map((w) => (
                                                                <div key={w} className="py-1.5">
                                                                    {w}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-2 grid grid-cols-7 gap-1.5">
                                                            {monthGrid.map((c, idx) => {
                                                                const isAnchor = c.date.getTime() === timelineAnchorDayMs;
                                                                return (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        onClick={() => setTimelineAnchor(new Date(c.date))}
                                                                        className={`aspect-square rounded-2xl text-sm font-semibold transition ${
                                                                            isAnchor
                                                                                ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                                                                                : c.isToday
                                                                                  ? 'bg-[var(--primary)] text-white shadow-md'
                                                                                  : c.inMonth
                                                                                    ? 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                                                                                    : 'bg-slate-50/50 text-slate-300 hover:bg-slate-100'
                                                                        }`}
                                                                    >
                                                                        {c.date.getDate()}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={`${planSecondaryBtn} mt-4 w-full`}
                                                            onClick={() => setTimelineAnchor(new Date())}
                                                        >
                                                            Bugüne git
                                                        </button>
                                                    </div>

                                                    <div className="space-y-5">
                                                        <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm">
                                                            <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                                                <div>
                                                                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                                        Zaman çizelgesi
                                                                    </div>
                                                                    <h4 className="mt-1 text-xl font-semibold text-slate-900">
                                                                        {timelineLabel}
                                                                    </h4>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                                                        {(['week', 'month'] as const).map((v) => (
                                                                            <button
                                                                                key={v}
                                                                                type="button"
                                                                                onClick={() => setTimelineView(v)}
                                                                                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                                                                    timelineView === v
                                                                                        ? 'bg-slate-900 text-white shadow'
                                                                                        : 'text-slate-500 hover:text-slate-900'
                                                                                }`}
                                                                            >
                                                                                {v === 'week' ? 'Hafta' : 'Ay'}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className={planSecondaryBtn}
                                                                        onClick={() => shiftTimeline(-1)}
                                                                    >
                                                                        <ChevronLeft size={16} />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className={planSecondaryBtn}
                                                                        onClick={() => shiftTimeline(1)}
                                                                    >
                                                                        <ChevronRight size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="overflow-x-auto rounded-[24px] border border-slate-200/80 bg-slate-50/70">
                                                                <div className="min-w-[940px]">
                                                                    <div className="flex border-b border-slate-200/80 bg-white/85">
                                                                        <div className="w-32 shrink-0 px-4 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                                            Araç
                                                                        </div>
                                                                        <div className="flex min-w-0 flex-1">
                                                                            {dayColumns.map((d) => (
                                                                                <div
                                                                                    key={d.toISOString()}
                                                                                    className="min-w-[32px] flex-1 border-l border-slate-200/70 px-1 py-3 text-center"
                                                                                >
                                                                                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                                        {d.toLocaleDateString('tr-TR', { weekday: 'short' }).slice(0, 2)}
                                                                                    </div>
                                                                                    <div className="mt-1 text-[11px] font-semibold text-slate-600">
                                                                                        {d.getDate()}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {Array.from({ length: unitCount }, (_, i) => i + 1).map((u) => (
                                                                        <div key={u} className="flex border-b border-slate-200/60 last:border-b-0">
                                                                            <div className="flex w-32 shrink-0 items-center border-r border-slate-200/70 bg-white px-4 text-sm font-semibold text-slate-800">
                                                                                Araç {u}
                                                                            </div>
                                                                            <div className="relative min-h-[68px] min-w-0 flex-1 bg-white">
                                                                                <div className="absolute inset-0 flex">
                                                                                    {dayColumns.map((d) => (
                                                                                        <div
                                                                                            key={`${u}-${d.getTime()}`}
                                                                                            className="min-w-[32px] flex-1 border-l border-slate-100"
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                                <div className="relative h-full w-full py-3">
                                                                                    {(planPreview.byUnit[u] || []).map((seg) => {
                                                                                        const lay = segmentBarPercent(
                                                                                            rangeStart,
                                                                                            rangeEnd,
                                                                                            seg.start,
                                                                                            seg.end
                                                                                        );
                                                                                        if (!lay) return null;
                                                                                        return (
                                                                                            <div
                                                                                                key={`${u}-${seg.step.mainStepKey}`}
                                                                                                title={`${seg.step.label}: ${fmt(seg.start.toISOString())} – ${fmt(seg.end.toISOString())}`}
                                                                                                className="absolute z-[1] truncate rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white shadow-md"
                                                                                                style={{
                                                                                                    left: `${lay.left}%`,
                                                                                                    width: `${lay.width}%`,
                                                                                                    top: 14,
                                                                                                    background: stepBarGradient(seg.step.mainStepKey, seg.index),
                                                                                                }}
                                                                                            >
                                                                                                {seg.step.label}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                    {u === activeUnitIndex &&
                                                                                        rangeStart.getTime() <= nowMs &&
                                                                                        nowMs <= rangeEnd.getTime() && (
                                                                                            <div
                                                                                                className="pointer-events-none absolute bottom-0 top-0 z-[2] w-px bg-rose-500"
                                                                                                style={{
                                                                                                    left: `${((nowMs - rangeStart.getTime()) / (rangeEnd.getTime() - rangeStart.getTime())) * 100}%`,
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="grid gap-4 xl:grid-cols-3">
                                                            <section className={`${planSubPanel} p-5`}>
                                                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                                    Teslim parametreleri
                                                                </div>
                                                                <div className="mt-4 space-y-4">
                                                                    <label className="block">
                                                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                                            Ort. teslim (gün)
                                                                        </span>
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            max={3650}
                                                                            value={expectedDays}
                                                                            onChange={(e) => setExpectedDays(e.target.value)}
                                                                            className={planInput}
                                                                            placeholder="Örn. 45"
                                                                        />
                                                                    </label>
                                                                    <label className="block">
                                                                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                                            Plan hedef tarihi
                                                                        </span>
                                                                        <input
                                                                            type="date"
                                                                            value={targetDate}
                                                                            onChange={(e) => setTargetDate(e.target.value)}
                                                                            className={planInput}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </section>

                                                            <section className={`${planSubPanel} p-5`}>
                                                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                                    Hızlı doldur
                                                                </div>
                                                                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                                                                    Aktif aracın tüm adımlarını verdiğiniz tarihten başlayarak sıralı
                                                                    biçimde doldurur.
                                                                </p>
                                                                <label className="mt-4 block">
                                                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                                                        Başlangıç tarihi
                                                                    </span>
                                                                    <input
                                                                        type="date"
                                                                        value={anchorDate}
                                                                        onChange={(e) => setAnchorDate(e.target.value)}
                                                                        className={planInput}
                                                                    />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    className={`${planPrimaryBtn} mt-4 w-full`}
                                                                    onClick={applySequentialDays}
                                                                    disabled={!anchorDate}
                                                                >
                                                                    <Sparkles size={16} />
                                                                    Bu araç için sıralı doldur
                                                                </button>
                                                            </section>

                                                            <section className={`${planSubPanel} p-5`}>
                                                                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                                    Aktif araç özeti
                                                                </div>
                                                                <div className="mt-4 space-y-3">
                                                                    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                                                                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                            Planlanan bölüm
                                                                        </div>
                                                                        <div className="mt-1 text-sm font-semibold text-slate-900">
                                                                            {activeUnitPlannedSteps} / {metaSteps.length}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                                                                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                            Zaman penceresi
                                                                        </div>
                                                                        <div className="mt-1 text-sm font-semibold leading-relaxed text-slate-900">
                                                                            {activeUnitWindow}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
                                                                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                                            Taslak notu
                                                                        </div>
                                                                        <div className="mt-1 text-sm leading-relaxed text-slate-600">
                                                                            {selected.notes || 'Bu teklif için ek operasyon notu girilmemiş.'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </section>
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>

                                            <section className={`${planSubPanel} overflow-hidden`}>
                                                <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 sm:px-6 xl:flex-row xl:items-end xl:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                                                            Bölüm kartları
                                                        </div>
                                                        <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                                                            Araç {activeUnitIndex} için operasyon planı
                                                        </h3>
                                                        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
                                                            Form alanları büyütüldü ve kartlar seyrekleştirildi. Böylece başlangıç,
                                                            bitiş ve süre alanları daha okunur ve kullanıcı dostu hale geldi.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={planPrimaryBtn}
                                                        onClick={() => void handleSave()}
                                                        disabled={saving}
                                                    >
                                                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                                        Tüm araçları kaydet
                                                    </button>
                                                </div>

                                                <div className="p-4 sm:p-5 lg:p-6">
                                                    <div className="rounded-[30px] border border-slate-200/80 bg-slate-100/80 p-4 shadow-inner shadow-slate-200/40 sm:p-5">
                                                        {metaSteps.length === 0 ? (
                                                            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/90 px-5 py-10 text-sm leading-relaxed text-slate-500">
                                                                Seçili ürün tipi için planlanacak operasyon adımı bulunamadı.
                                                            </div>
                                                        ) : (
                                                            <div className="grid auto-rows-max grid-cols-1 items-start gap-7 xl:grid-cols-2 xl:gap-8">
                                                                {metaSteps.map((s, index) => {
                                                                    const row = activeUnitForm[s.mainStepKey] || {
                                                                        plannedStart: '',
                                                                        plannedEnd: '',
                                                                        durationDays: '',
                                                                    };
                                                                    return (
                                                                        <StepPlanCard
                                                                            key={s.mainStepKey}
                                                                            step={s}
                                                                            index={index}
                                                                            row={row}
                                                                            onChange={(patch) =>
                                                                                updateStep(activeUnitIndex, s.mainStepKey, patch)
                                                                            }
                                                                        />
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}
