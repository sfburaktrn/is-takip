'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import {
    getCapacityWeek,
    putCapacityWeek,
    deleteCapacityWeek,
    putCapacityTarget,
    deleteCapacityTarget,
    getCapacityDefaults,
    type VerimlilikProductType,
    type CapacityWeekRow,
} from '@/lib/api';
import {
    Users,
    Loader2,
    Save,
    Trash2,
    Sparkles,
    Gauge,
    Package,
    Truck,
    Layers,
    CalendarDays,
    UserRound,
    Clock,
    Target,
    Lightbulb,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';

function mondayOfDateInput(isoDay: string): string {
    const d = new Date(isoDay + 'T12:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
}

const fieldInput =
    'w-full min-h-11 rounded-xl border border-slate-200/90 bg-white px-3 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';

const fieldInputSm =
    'min-h-10 rounded-xl border border-slate-200/90 bg-white px-2.5 text-sm text-slate-900 shadow-sm transition focus:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';

const tableInput =
    'rounded-xl border border-slate-200/90 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm transition focus:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';

/** Standart buton iskeleti; yazı ortalı, köşe yarıçapı önceki forma yakın */
const kapBtnPill =
    'inline-flex max-w-full items-center justify-center rounded-xl text-center ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0';

/** İçerik tam ortada; hover’da hafif kalkış + basışta scale */
const kapBtnMotion =
    'transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:hover:transform-none ' +
    'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.97] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)]/35';

/** Yukarı zıplamayan varyant */
const kapBtnMotionSoft =
    'transition-all duration-300 ease-out motion-reduce:transition-none motion-reduce:hover:transform-none ' +
    'hover:shadow-md active:scale-[0.97] ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)]/35';

const kapBtnDisabled =
    'disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100';

/** Büyük buton */
const kapBtnCenterMd =
    `${kapBtnPill} min-h-10 px-4 py-2.5 text-xs font-semibold leading-none tracking-tight sm:px-5 sm:text-sm`;

/** Tablo / sıkı alan */
const kapBtnCenterSm =
    `${kapBtnPill} min-h-9 px-3 py-2 text-[11px] font-semibold leading-none tracking-tight sm:px-3.5 sm:text-xs`;

/** Sadece ikon */
const kapBtnIconPill =
    `${kapBtnPill} h-9 w-9 shrink-0 ${kapBtnMotion}`;

type KapasiteRowProps = {
    r: CapacityWeekRow;
    hoursPerPerson: number;
    savingKey: string | null;
    updateRow: (mainStepKey: string, patch: Partial<CapacityWeekRow>) => void;
    applyStandardHours: (mainStepKey: string) => void;
    saveRow: (mainStepKey: string) => Promise<void>;
    clearRow: (mainStepKey: string) => Promise<void>;
    saveTargetRow: (mainStepKey: string) => Promise<void>;
    clearTargetRow: (mainStepKey: string) => Promise<void>;
};

type KapBtnContentProps = {
    icon: ReactNode;
    label: string;
};

function KapBtnContent({ icon, label }: KapBtnContentProps) {
    return (
        <span className="flex w-full items-center justify-center">
            <span className="grid max-w-full min-w-0 grid-cols-[1rem_auto_1rem] items-center gap-1">
                <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
                <span className="min-w-0 whitespace-nowrap text-center leading-none">{label}</span>
                <span aria-hidden className="block h-4 w-4" />
            </span>
        </span>
    );
}

function KapasiteMobileCard(p: KapasiteRowProps) {
    const { r, hoursPerPerson, savingKey, updateRow, applyStandardHours, saveRow, clearRow, saveTargetRow, clearTargetRow } = p;
    return (
        <article className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 ring-1 ring-slate-100 transition hover:shadow-lg hover:shadow-slate-200/60">
            <div
                className="h-1.5 w-full bg-gradient-to-r from-[var(--primary)] via-violet-500 to-fuchsia-500 opacity-90"
                aria-hidden
            />
            <div className="p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <span className="mb-1 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Bölüm
                        </span>
                        <h3 className="text-base font-semibold leading-snug text-slate-900">{r.label}</h3>
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="rounded-xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <UserRound size={14} className="text-[var(--primary)]" />
                            Ekip
                        </div>
                        <label className="block text-xs font-medium text-slate-600">
                            Kişi sayısı
                            <input
                                type="number"
                                min={0}
                                value={r.headcount}
                                onChange={e => updateRow(r.mainStepKey, { headcount: parseInt(e.target.value, 10) || 0 })}
                                className={`mt-1.5 ${fieldInput}`}
                            />
                        </label>
                    </div>

                    <div className="rounded-xl bg-gradient-to-br from-indigo-50/60 to-white p-4 ring-1 ring-indigo-100/80">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Clock size={14} className="text-indigo-600" />
                            Saatler
                        </div>
                        <label className="block text-xs font-medium text-slate-600">
                            Normal saat (toplam)
                            <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_148px] items-stretch gap-2">
                                <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={r.normalHours}
                                    onChange={e => updateRow(r.mainStepKey, { normalHours: parseFloat(e.target.value) || 0 })}
                                    className={`min-w-0 ${fieldInput}`}
                                />
                                <button
                                    type="button"
                                    className={`${kapBtnMotion} ${kapBtnCenterSm} min-w-0 w-full border border-indigo-200/80 bg-white text-indigo-800 shadow-sm hover:bg-indigo-50/90`}
                                    onClick={() => applyStandardHours(r.mainStepKey)}
                                    title={`Kişi × ${hoursPerPerson} saat`}
                                >
                                    <KapBtnContent
                                        icon={<Sparkles size={15} className="text-amber-500" />}
                                        label={`${hoursPerPerson}h/kişi`}
                                    />
                                </button>
                            </div>
                        </label>
                        <label className="mt-4 block text-xs font-medium text-slate-600">
                            Mesai saat
                            <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={r.overtimeHours}
                                onChange={e => updateRow(r.mainStepKey, { overtimeHours: parseFloat(e.target.value) || 0 })}
                                className={`mt-1.5 ${fieldInput}`}
                            />
                        </label>
                    </div>

                    <div className="rounded-xl bg-emerald-50/40 p-4 ring-1 ring-emerald-100/90">
                        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <Target size={14} className="text-emerald-600" />
                            Haftalık hedef
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_180px_2.5rem] items-stretch gap-2">
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={r.targetCount}
                                onChange={e => updateRow(r.mainStepKey, { targetCount: parseInt(e.target.value, 10) || 0 })}
                                className={`min-w-0 w-full ${fieldInput}`}
                            />
                            <button
                                type="button"
                                className={`${kapBtnMotion} ${kapBtnDisabled} ${kapBtnCenterMd} min-w-0 w-full bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700`}
                                disabled={savingKey === `t-${r.mainStepKey}`}
                                onClick={() => saveTargetRow(r.mainStepKey)}
                            >
                                <KapBtnContent
                                    icon={
                                        savingKey === `t-${r.mainStepKey}` ? (
                                            <Loader2 size={17} className="animate-spin" />
                                        ) : (
                                            <Save size={17} />
                                        )
                                    }
                                    label="Hedef kaydet"
                                />
                            </button>
                            <button
                                type="button"
                                title="Hedefi sil"
                                className={`${kapBtnIconPill} ${kapBtnDisabled} border border-emerald-200 bg-white text-emerald-800 hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                                disabled={savingKey === `t-${r.mainStepKey}`}
                                onClick={() => clearTargetRow(r.mainStepKey)}
                            >
                                <Trash2 size={17} className="shrink-0" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-[minmax(0,1fr)_112px] gap-2 border-t border-slate-100 pt-5">
                    <button
                        type="button"
                        className={`${kapBtnMotion} ${kapBtnDisabled} ${kapBtnCenterMd} min-w-0 w-full bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/25 hover:brightness-110`}
                        disabled={savingKey === r.mainStepKey}
                        onClick={() => saveRow(r.mainStepKey)}
                    >
                        <KapBtnContent
                            icon={savingKey === r.mainStepKey ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            label="Kapasite kaydet"
                        />
                    </button>
                    <button
                        type="button"
                        className={`${kapBtnMotion} ${kapBtnDisabled} ${kapBtnCenterMd} min-w-0 w-full border-2 border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
                        disabled={savingKey === r.mainStepKey}
                        onClick={() => clearRow(r.mainStepKey)}
                    >
                        <KapBtnContent icon={<Trash2 size={18} />} label="Sil" />
                    </button>
                </div>
            </div>
        </article>
    );
}

const productTabs: { type: VerimlilikProductType; label: string; icon: typeof Package }[] = [
    { type: 'DAMPER', label: 'Damper', icon: Package },
    { type: 'DORSE', label: 'Dorse', icon: Truck },
    { type: 'SASI', label: 'Şasi', icon: Layers },
];

export default function KapasitePage() {
    const [productType, setProductType] = useState<VerimlilikProductType>('DAMPER');
    const [weekInput, setWeekInput] = useState(() => mondayOfDateInput(new Date().toISOString().slice(0, 10)));
    const [rows, setRows] = useState<CapacityWeekRow[]>([]);
    const [hoursPerPerson, setHoursPerPerson] = useState(45);
    const [scheduleDesc, setScheduleDesc] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    const weekStart = useMemo(() => mondayOfDateInput(weekInput), [weekInput]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setMessage(null);
            const [defs, data] = await Promise.all([getCapacityDefaults(), getCapacityWeek(productType, weekStart)]);
            setHoursPerPerson(data.hoursPerPersonWeek);
            setScheduleDesc(defs.description);
            setRows(data.rows.map(r => ({ ...r, targetCount: r.targetCount ?? 0 })));
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Yüklenemedi' });
        } finally {
            setLoading(false);
        }
    }, [productType, weekStart]);

    useEffect(() => {
        load();
    }, [load]);

    const updateRow = (mainStepKey: string, patch: Partial<CapacityWeekRow>) => {
        setRows(prev => prev.map(r => (r.mainStepKey === mainStepKey ? { ...r, ...patch } : r)));
    };

    const applyStandardHours = (mainStepKey: string) => {
        const r = rows.find(x => x.mainStepKey === mainStepKey);
        if (!r) return;
        const nh = r.headcount * hoursPerPerson;
        updateRow(mainStepKey, { normalHours: nh });
    };

    const saveRow = async (mainStepKey: string) => {
        const r = rows.find(x => x.mainStepKey === mainStepKey);
        if (!r) return;
        try {
            setSavingKey(mainStepKey);
            setMessage(null);
            await putCapacityWeek({
                productType,
                weekStart,
                mainStepKey,
                headcount: r.headcount,
                normalHours: r.normalHours,
                overtimeHours: r.overtimeHours,
            });
            setMessage({ type: 'ok', text: `${r.label} kaydedildi` });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Kayıt hatası' });
        } finally {
            setSavingKey(null);
        }
    };

    const clearRow = async (mainStepKey: string) => {
        if (!confirm('Bu bölümün kapasite kaydını silmek istiyor musunuz?')) return;
        try {
            setSavingKey(mainStepKey);
            await deleteCapacityWeek(productType, weekStart, mainStepKey);
            updateRow(mainStepKey, { headcount: 0, normalHours: 0, overtimeHours: 0 });
            setMessage({ type: 'ok', text: 'Satır temizlendi' });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Silinemedi' });
        } finally {
            setSavingKey(null);
        }
    };

    const saveTargetRow = async (mainStepKey: string) => {
        const r = rows.find(x => x.mainStepKey === mainStepKey);
        if (!r) return;
        try {
            setSavingKey(`t-${mainStepKey}`);
            setMessage(null);
            await putCapacityTarget({
                productType,
                weekStart,
                mainStepKey,
                targetCount: r.targetCount,
            });
            setMessage({ type: 'ok', text: `${r.label} hedefi kaydedildi` });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Hedef kaydı hatası' });
        } finally {
            setSavingKey(null);
        }
    };

    const clearTargetRow = async (mainStepKey: string) => {
        if (!confirm('Bu bölümün haftalık hedef kaydını silmek istiyor musunuz?')) return;
        try {
            setSavingKey(`t-${mainStepKey}`);
            await deleteCapacityTarget(productType, weekStart, mainStepKey);
            updateRow(mainStepKey, { targetCount: 0 });
            setMessage({ type: 'ok', text: 'Hedef temizlendi' });
        } catch (e) {
            setMessage({ type: 'err', text: e instanceof Error ? e.message : 'Hedef silinemedi' });
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <AuthGuard>
            <Sidebar />
            <main className="main-content analytics-page min-h-0">
                {/* Hero */}
                <div className="relative mb-10 overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/40 p-6 shadow-lg shadow-slate-200/30 sm:mb-12 sm:p-8">
                    <div
                        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--primary)]/10 blur-3xl"
                        aria-hidden
                    />
                    <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="inline-flex items-center gap-3">
                                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/30">
                                    <Users size={26} strokeWidth={2} />
                                </span>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Bölüm kapasitesi</h1>
                                    <p className="mt-1 text-sm text-slate-600 sm:text-base">
                                        Haftalık kişi, saat ve hedef — Verimlilik raporunun temeli.
                                    </p>
                                </div>
                            </div>
                            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                                Haftalık kişi sayısı, çalışma saatleri ve isteğe bağlı hedef adet; verim ve hedef sapması bu
                                verilerle hesaplanır.
                            </p>
                        </div>
                        <Link
                            href="/verimlilik"
                            className={`${kapBtnMotionSoft} ${kapBtnCenterMd} mt-1 w-full shrink-0 border-2 border-slate-200/90 bg-white text-slate-800 shadow-md hover:border-[var(--primary)]/50 hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/60 sm:mt-2 sm:w-auto sm:self-start`}
                        >
                            <KapBtnContent
                                icon={<Gauge size={18} className="text-[var(--primary)]" strokeWidth={2} />}
                                label="Verimlilik raporu"
                            />
                        </Link>
                    </div>
                </div>

                {/* Bilgi */}
                <div className="mb-12 flex gap-4 rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-50/90 to-orange-50/40 p-5 sm:mb-14 sm:p-6 shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <Lightbulb size={22} />
                    </span>
                    <div className="min-w-0 text-sm leading-relaxed text-amber-950/90">
                        <strong className="font-semibold text-amber-950">Varsayılan çalışma:</strong> Pazartesi–Cumartesi
                        09:00–17:30 (TR), 12:30–13:30 mola → kişi başı haftalık <strong>{hoursPerPerson}</strong> net saat.
                        Mesaiyi ayrı girin; normal saati değiştirmek için hücreyi düzenleyin veya &quot;{hoursPerPerson}
                        h/kişi&quot; ile kişi sayısından doldurun.
                        {scheduleDesc && (
                            <span className="mt-2 block text-xs text-amber-900/75 sm:text-[13px]">{scheduleDesc}</span>
                        )}
                    </div>
                </div>

                {message && (
                    <div
                        role="status"
                        className={`mb-12 flex items-start gap-3 rounded-2xl border px-4 py-3.5 sm:mb-14 sm:px-5 ${
                            message.type === 'ok'
                                ? 'border-emerald-200/80 bg-emerald-50/90 text-emerald-900'
                                : 'border-red-200/80 bg-red-50/90 text-red-900'
                        }`}
                    >
                        {message.type === 'ok' ? (
                            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={22} />
                        ) : (
                            <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={22} />
                        )}
                        <p className="text-sm font-medium leading-snug">{message.text}</p>
                    </div>
                )}

                {/* Araç çubuğu — tablodan ayrışması için alt boşluk geniş */}
                <div className="mb-16 rounded-2xl border border-slate-200/80 bg-white p-5 pt-7 shadow-md shadow-slate-200/25 sm:mb-20 sm:p-6 sm:pt-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
                        <div className="w-full space-y-4 rounded-2xl border border-slate-100/80 bg-slate-50/55 p-5 pt-6 sm:p-6">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ürün türü</span>
                            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/90 p-1.5 ring-1 ring-slate-200/60">
                                {productTabs.map(({ type, label, icon: Icon }) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setProductType(type)}
                                        className={`analytics-touch-target inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold leading-none tracking-tight transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:scale-100 sm:px-3 sm:text-xs ${
                                            productType === type
                                                ? 'bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/25 ring-2 ring-[var(--primary)]/20'
                                                : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                                        }`}
                                    >
                                        <Icon size={14} strokeWidth={2} className="shrink-0" />
                                        <span className="min-w-0 whitespace-nowrap">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid w-full grid-cols-1 gap-4 rounded-2xl border border-slate-100/80 bg-slate-50/55 p-5 pt-6 sm:grid-cols-[minmax(200px,1fr)_auto] sm:items-end sm:p-6 lg:w-auto lg:shrink-0">
                            <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <CalendarDays size={14} className="text-[var(--primary)]" />
                                    Hafta
                                </span>
                                <input
                                    type="date"
                                    value={weekInput}
                                    onChange={e => setWeekInput(e.target.value)}
                                    className={`${fieldInput} sm:max-w-xs`}
                                />
                            </label>
                            <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 sm:justify-start">
                                <span className="font-medium text-slate-500">Pazartesi:</span>
                                <span className="ml-2 font-mono font-semibold text-slate-900">{weekStart}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200/80 bg-white py-20 shadow-inner">
                        <Loader2 className="animate-spin text-[var(--primary)]" size={44} strokeWidth={2} />
                        <p className="text-sm font-medium text-slate-500">Kapasite verileri yükleniyor…</p>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-6 pb-12 pt-1 lg:hidden">
                            {rows.map(r => (
                                <KapasiteMobileCard
                                    key={r.mainStepKey}
                                    r={r}
                                    hoursPerPerson={hoursPerPerson}
                                    savingKey={savingKey}
                                    updateRow={updateRow}
                                    applyStandardHours={applyStandardHours}
                                    saveRow={saveRow}
                                    clearRow={clearRow}
                                    saveTargetRow={saveTargetRow}
                                    clearTargetRow={clearTargetRow}
                                />
                            ))}
                        </div>

                        <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/30 lg:block">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1060px] border-collapse text-[13px]">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                            <th className="sticky left-0 z-[1] border-b border-slate-200/80 bg-slate-50 px-3 py-3 pl-4 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.08)]">
                                                Bölüm
                                            </th>
                                            <th className="border-b border-slate-200/80 px-2.5 py-3">Kişi</th>
                                            <th className="min-w-[205px] border-b border-slate-200/80 px-2.5 py-3">Normal saat</th>
                                            <th className="border-b border-slate-200/80 px-2.5 py-3">Mesai</th>
                                            <th
                                                className="min-w-[250px] border-b border-slate-200/80 px-2.5 py-3 pr-3"
                                                title="Haftalık hedef (Verimlilik)"
                                            >
                                                Hedef
                                            </th>
                                            <th className="min-w-[195px] border-b border-slate-200/80 px-3 py-3 pr-4 text-right">
                                                İşlem
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((r, idx) => (
                                            <tr
                                                key={r.mainStepKey}
                                                className={`border-b border-slate-100 transition-colors hover:bg-indigo-50/25 ${
                                                    idx % 2 === 1 ? 'bg-slate-50/40' : ''
                                                }`}
                                            >
                                                <td
                                                    className={`sticky left-0 z-[1] border-r border-slate-100/80 px-3 py-2.5 pl-4 font-semibold text-slate-800 shadow-[4px_0_8px_-4px_rgba(15,23,42,0.06)] ${
                                                        idx % 2 === 1 ? 'bg-slate-50/90' : 'bg-white'
                                                    }`}
                                                >
                                                    {r.label}
                                                </td>
                                                <td className="px-2.5 py-2 align-middle">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={r.headcount}
                                                        onChange={e =>
                                                            updateRow(r.mainStepKey, { headcount: parseInt(e.target.value, 10) || 0 })
                                                        }
                                                        className={`${tableInput} w-[4rem] text-center tabular-nums`}
                                                    />
                                                </td>
                                                <td className="px-2.5 py-2 align-middle">
                                                    <div className="grid grid-cols-[5rem_128px] items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={0.5}
                                                            value={r.normalHours}
                                                            onChange={e =>
                                                                updateRow(r.mainStepKey, {
                                                                    normalHours: parseFloat(e.target.value) || 0,
                                                                })
                                                            }
                                                            className={`${tableInput} w-full min-w-0 tabular-nums`}
                                                        />
                                                        <button
                                                            type="button"
                                                            className={`${kapBtnMotion} ${kapBtnCenterSm} min-w-0 w-full border border-indigo-200 bg-indigo-50/90 text-indigo-800 hover:bg-indigo-100`}
                                                            onClick={() => applyStandardHours(r.mainStepKey)}
                                                            title={`Kişi × ${hoursPerPerson} saat`}
                                                        >
                                                            <KapBtnContent
                                                                icon={<Sparkles size={14} className="text-amber-500" />}
                                                                label={`${hoursPerPerson}h/kişi`}
                                                            />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-2.5 py-2 align-middle">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step={0.5}
                                                        value={r.overtimeHours}
                                                        onChange={e =>
                                                            updateRow(r.mainStepKey, {
                                                                overtimeHours: parseFloat(e.target.value) || 0,
                                                            })
                                                        }
                                                        className={`${tableInput} w-[5rem] tabular-nums`}
                                                    />
                                                </td>
                                                <td className="min-w-[250px] px-2.5 py-2.5 align-middle">
                                                    <div className="grid grid-cols-[4rem_150px_2.25rem] items-center gap-1.5">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={1}
                                                            value={r.targetCount}
                                                            onChange={e =>
                                                                updateRow(r.mainStepKey, {
                                                                    targetCount: parseInt(e.target.value, 10) || 0,
                                                                })
                                                            }
                                                            className={`${tableInput} w-full min-w-0 text-center tabular-nums`}
                                                        />
                                                        <button
                                                            type="button"
                                                            className={`${kapBtnMotion} ${kapBtnDisabled} ${kapBtnCenterSm} min-w-0 w-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`}
                                                            disabled={savingKey === `t-${r.mainStepKey}`}
                                                            onClick={() => saveTargetRow(r.mainStepKey)}
                                                        >
                                                            <KapBtnContent
                                                                icon={
                                                                    savingKey === `t-${r.mainStepKey}` ? (
                                                                        <Loader2 size={15} className="animate-spin" />
                                                                    ) : (
                                                                        <Save size={15} />
                                                                    )
                                                                }
                                                                label="Hedef kaydet"
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Hedefi sil"
                                                            className={`${kapBtnIconPill} ${kapBtnDisabled} border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600`}
                                                            disabled={savingKey === `t-${r.mainStepKey}`}
                                                            onClick={() => clearTargetRow(r.mainStepKey)}
                                                        >
                                                            <Trash2 size={16} className="shrink-0" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 pr-4 text-right align-middle">
                                                    <div className="ml-auto grid grid-cols-[110px_78px] items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            className={`${kapBtnMotion} ${kapBtnDisabled} ${kapBtnCenterSm} min-w-0 w-full bg-[var(--primary)] text-white shadow-md hover:brightness-110`}
                                                            disabled={savingKey === r.mainStepKey}
                                                            onClick={() => saveRow(r.mainStepKey)}
                                                        >
                                                            <KapBtnContent
                                                                icon={
                                                                    savingKey === r.mainStepKey ? (
                                                                        <Loader2 size={15} className="animate-spin" />
                                                                    ) : (
                                                                        <Save size={15} />
                                                                    )
                                                                }
                                                                label="Kaydet"
                                                            />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`${kapBtnMotion} ${kapBtnDisabled} ${kapBtnCenterSm} min-w-0 w-full border-2 border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700`}
                                                            disabled={savingKey === r.mainStepKey}
                                                            onClick={() => clearRow(r.mainStepKey)}
                                                        >
                                                            <KapBtnContent icon={<Trash2 size={15} />} label="Sil" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </AuthGuard>
    );
}
