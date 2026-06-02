'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import {
    completeAllMaintenanceForCompany,
    completeMaintenanceSchedule,
    getMaintenanceCompanies,
    getMaintenanceSchedules,
    getMaintenanceStats,
    rebuildMaintenanceData,
    updateMaintenanceCompany,
    updateMaintenanceReminder,
    REMINDER_STATUS_LABELS,
    REMINDER_STATUS_ORDER,
    type MaintenanceDeliveryLogEntry,
    type MaintenanceCompanyRow,
    type MaintenanceProductType,
    type MaintenanceScheduleRow,
    type MaintenanceScheduleStatus,
    type MaintenanceStats,
    type ReminderStatus,
} from '@/lib/api';
import { AlertTriangle, Bell, Building2, CheckCircle2, Filter, Mail, Phone, PhoneCall, Save, Search, StickyNote, TimerReset, Truck, Wrench, Wrench as WrenchDone, X } from 'lucide-react';

function reminderBadgeClass(status: ReminderStatus) {
    if (status === 'SERVICED') return 'bakim-rstatus bakim-rstatus--serviced';
    if (status === 'CONTACTED') return 'bakim-rstatus bakim-rstatus--contacted';
    if (status === 'ACKNOWLEDGED') return 'bakim-rstatus bakim-rstatus--ack';
    return 'bakim-rstatus bakim-rstatus--pending';
}

type ProductTypeFilter = 'ALL' | MaintenanceProductType;
type StatusFilter = 'ALL' | MaintenanceScheduleStatus;

function formatDueText(s: Pick<MaintenanceScheduleRow, 'status' | 'daysUntilDue' | 'daysOverdue'>) {
    if (s.status === 'COMPLETED') return 'Tamamlandı';
    if (s.daysUntilDue === 0) return 'Bugün bakım günü';
    if (s.daysUntilDue > 30) return `Bakıma ${s.daysUntilDue} gün var`;
    if (s.daysUntilDue > 0) return `Bakıma ${s.daysUntilDue} gün kaldı`;
    return `${s.daysOverdue} gün gecikti`;
}

function statusBadgeClass(status: MaintenanceScheduleStatus) {
    if (status === 'COMPLETED') return 'badge badge-success';
    if (status === 'OVERDUE') return 'badge badge-danger';
    if (status === 'DUE_SOON') return 'badge badge-warning';
    if (status === 'CANCELLED') return 'badge badge-muted';
    return 'badge badge-muted';
}

function countdownClass(urgency: MaintenanceScheduleRow['urgency']) {
    if (urgency === 'overdue') return 'bakim-countdown bakim-countdown--overdue';
    if (urgency === 'soon') return 'bakim-countdown bakim-countdown--soon';
    if (urgency === 'completed') return 'bakim-countdown bakim-countdown--done';
    return 'bakim-countdown';
}

function deliveryFieldLabel(key: string) {
    if (key === 'teslimat') return 'Teslimat';
    if (key === 'teslimEden') return 'Teslim eden';
    if (key === 'teslimAlan') return 'Teslim alan';
    if (key === 'teslimSasiNo') return 'Teslim şasi no';
    return key;
}

function formatDeliveryLogValue(e: MaintenanceDeliveryLogEntry) {
    if (e.fieldKey === 'teslimat') return e.toValue === true ? 'Tamamlandı' : 'Geri alındı';
    if (typeof e.toValue === 'boolean') return e.toValue ? 'Evet' : 'Hayır';
    return String(e.toValue ?? '—');
}

export default function BakimTakipPage() {
    return (
        <Suspense fallback={<OzunluLoading />}>
            <BakimTakipInner />
        </Suspense>
    );
}

function BakimTakipInner() {
    const searchParams = useSearchParams();
    const initialView = useMemo(() => {
        const v = (searchParams?.get('view') || '').toLowerCase();
        return v === 'firms' || v === 'companies' ? 'COMPANIES' : 'SCHEDULES';
    }, [searchParams]);
    const highlightId = useMemo(() => {
        const raw = searchParams?.get('highlight');
        const n = raw ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) ? n : null;
    }, [searchParams]);
    const initialCompanyId = useMemo(() => {
        const raw = searchParams?.get('companyId');
        const n = raw ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) ? n : null;
    }, [searchParams]);

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MaintenanceStats | null>(null);
    const [items, setItems] = useState<MaintenanceScheduleRow[]>([]);
    const [companies, setCompanies] = useState<MaintenanceCompanyRow[]>([]);
    const [q, setQ] = useState('');
    const [productType, setProductType] = useState<ProductTypeFilter>('ALL');
    const [status, setStatus] = useState<StatusFilter>('ALL');
    const [companyId, setCompanyId] = useState<number | null>(initialCompanyId);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [view, setView] = useState<'SCHEDULES' | 'COMPANIES'>(initialView);
    const [expandedCompanies, setExpandedCompanies] = useState<Record<number, boolean>>({});
    const [editing, setEditing] = useState<MaintenanceCompanyRow | null>(null);
    const [draft, setDraft] = useState<{ displayName: string; email: string; phone: string; phone2: string; notes: string } | null>(null);
    const [saving, setSaving] = useState(false);
    const [reminderBusyId, setReminderBusyId] = useState<number | null>(null);
    const [noteModal, setNoteModal] = useState<{ company: MaintenanceCompanyRow; targetStatus: ReminderStatus } | null>(null);
    const [noteDraft, setNoteDraft] = useState('');

    const loadSchedules = useCallback(async () => {
        setLoading(true);
        try {
            const [s, list, comps] = await Promise.all([
                getMaintenanceStats(),
                getMaintenanceSchedules({
                    productType: productType === 'ALL' ? undefined : productType,
                    status: status === 'ALL' ? undefined : status,
                    companyId: companyId ?? undefined,
                    q: q.trim() ? q.trim() : undefined,
                }),
                getMaintenanceCompanies(),
            ]);
            setStats(s);
            setItems(list);
            setCompanies(comps);
        } catch (e) {
            console.error('[bakim] load failed:', e);
            setStats(null);
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [companyId, productType, q, status]);

    const loadCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await getMaintenanceCompanies();
            setCompanies(rows);
        } catch (e) {
            console.error('[bakim] companies load failed:', e);
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (view === 'COMPANIES') void loadCompanies();
        else void loadSchedules();
    }, [loadCompanies, loadSchedules, view]);

    const highlighted = useMemo(() => (highlightId ? items.find((i) => i.id === highlightId) : null), [highlightId, items]);

    const handleRebuild = async () => {
        if (!confirm('Tüm firmalar ve teslim edilmiş damper/dorse bakım planları yeniden taranacak. Devam?')) return;
        setSyncing(true);
        try {
            const r = await rebuildMaintenanceData();
            const msg = r.schedules
                ? `Firmalar güncellendi. Bakım: ${r.schedules.created} yeni, ${r.schedules.updated} güncellendi (${r.schedules.scanned} teslim edilmiş ürün tarandı).`
                : 'Senkron tamamlandı.';
            alert(msg);
            if (view === 'COMPANIES') await loadCompanies();
            else await loadSchedules();
        } catch (e) {
            console.error('[bakim] rebuild failed:', e);
            alert('Senkron başarısız. Backend loglarına bakın.');
        } finally {
            setSyncing(false);
        }
    };

    const handleCompleteAll = async (group: { company: MaintenanceScheduleRow['company']; rows: MaintenanceScheduleRow[] }) => {
        const pending = group.rows.filter((r) => r.status !== 'COMPLETED').length;
        if (pending === 0) {
            alert('Bu firmada tamamlanmamış bakım kaydı yok.');
            return;
        }
        if (!confirm(`${group.company.displayName} firmasına ait ${pending} bakım kaydının tümü "Bakım yapıldı" olarak işaretlenecek. Devam?`)) return;
        setBusyId(-group.company.id);
        try {
            await completeAllMaintenanceForCompany(group.company.id);
            await loadSchedules();
        } catch (e) {
            console.error('[bakim] complete-all failed:', e);
            alert('Firma bakımları tamamlanamadı.');
        } finally {
            setBusyId(null);
        }
    };

    const handleComplete = async (row: MaintenanceScheduleRow) => {
        const ok = confirm(`${row.company.displayName} için bu bakım kaydını “Bakım yapıldı” olarak işaretlemek istiyor musunuz?`);
        if (!ok) return;
        const note = prompt('Bakım notu (opsiyonel):', '');
        setBusyId(row.id);
        try {
            await completeMaintenanceSchedule(row.id, note ?? undefined);
            await loadSchedules();
        } catch (e) {
            console.error('[bakim] complete failed:', e);
            alert('Bakım tamamlanamadı.');
        } finally {
            setBusyId(null);
        }
    };

    const applyReminderUpdate = (companyId: number, updated: Awaited<ReturnType<typeof updateMaintenanceReminder>>) => {
        setCompanies((prev) =>
            prev.map((row) =>
                row.id === companyId
                    ? {
                          ...row,
                          reminderStatus: updated.reminderStatus,
                          storedReminderStatus: updated.reminderStatus,
                          reminderNote: updated.reminderNote,
                          reminderHandledAt: updated.reminderHandledAt,
                          reminderHandledBy: updated.reminderHandledBy,
                      }
                    : row
            )
        );
    };

    const handleReminderStatus = async (c: MaintenanceCompanyRow, next: ReminderStatus, withNote = false) => {
        if (withNote) {
            setNoteModal({ company: c, targetStatus: next });
            setNoteDraft(c.reminderNote ?? '');
            return;
        }
        setReminderBusyId(c.id);
        try {
            const updated = await updateMaintenanceReminder(c.id, next);
            applyReminderUpdate(c.id, updated);
        } catch (e) {
            console.error('[bakim] reminder update failed:', e);
            alert('Hatırlatma durumu güncellenemedi.');
        } finally {
            setReminderBusyId(null);
        }
    };

    const saveNoteModal = async () => {
        if (!noteModal) return;
        const { company, targetStatus } = noteModal;
        setReminderBusyId(company.id);
        try {
            const updated = await updateMaintenanceReminder(company.id, targetStatus, noteDraft);
            applyReminderUpdate(company.id, updated);
            setNoteModal(null);
            setNoteDraft('');
        } catch (e) {
            console.error('[bakim] reminder note failed:', e);
            alert('Not kaydedilemedi.');
        } finally {
            setReminderBusyId(null);
        }
    };

    const handleReminderNote = (c: MaintenanceCompanyRow) => {
        setNoteModal({ company: c, targetStatus: c.storedReminderStatus ?? c.reminderStatus });
        setNoteDraft(c.reminderNote ?? '');
    };

    const renderReminder = (c: MaintenanceCompanyRow) => {
        const rStatus = c.reminderStatus;
        return (
            <div className="bakim-reminder">
                <div className="bakim-reminder__row">
                    <span className={reminderBadgeClass(rStatus)} title="Hatırlatma durumu">
                        {REMINDER_STATUS_LABELS[rStatus]}
                    </span>
                    <div className="bakim-reminder__steps">
                        {REMINDER_STATUS_ORDER.map((st, idx) => {
                            const active = REMINDER_STATUS_ORDER.indexOf(rStatus) >= idx;
                            return (
                                <span
                                    key={st}
                                    className={`bakim-reminder__dot ${active ? 'is-active' : ''}`}
                                    title={REMINDER_STATUS_LABELS[st]}
                                />
                            );
                        })}
                    </div>
                </div>
                <div className="bakim-reminder__btns">
                    <button
                        type="button"
                        className={`bakim-rbtn ${rStatus === 'ACKNOWLEDGED' ? 'is-on' : ''}`}
                        disabled={reminderBusyId === c.id}
                        onClick={() => void handleReminderStatus(c, 'ACKNOWLEDGED')}
                    >
                        <CheckCircle2 size={14} aria-hidden /> Görüldü
                    </button>
                    <button
                        type="button"
                        className={`bakim-rbtn ${rStatus === 'CONTACTED' ? 'is-on' : ''}`}
                        disabled={reminderBusyId === c.id}
                        onClick={() => void handleReminderStatus(c, 'CONTACTED', true)}
                    >
                        <PhoneCall size={14} aria-hidden /> İletişime geçildi
                    </button>
                    <button
                        type="button"
                        className={`bakim-rbtn ${rStatus === 'SERVICED' ? 'is-on' : ''}`}
                        disabled={reminderBusyId === c.id}
                        onClick={() => void handleReminderStatus(c, 'SERVICED', true)}
                    >
                        <WrenchDone size={14} aria-hidden /> Bakım yapıldı
                    </button>
                    <button
                        type="button"
                        className="bakim-rbtn bakim-rbtn--note"
                        disabled={reminderBusyId === c.id}
                        onClick={() => void handleReminderNote(c)}
                    >
                        <StickyNote size={14} aria-hidden /> {c.reminderNote ? 'Notu düzenle' : 'Not düş'}
                    </button>
                </div>
                {(c.reminderNote || c.reminderHandledBy) && (
                    <div className="bakim-reminder__meta">
                        {c.reminderHandledBy && (
                            <span>
                                {c.reminderHandledBy.name}
                                {c.reminderHandledAt ? ` · ${new Date(c.reminderHandledAt).toLocaleDateString('tr-TR')}` : ''}
                            </span>
                        )}
                        {c.reminderNote && <span className="bakim-reminder__note">“{c.reminderNote}”</span>}
                        {rStatus !== 'PENDING' && (
                            <button
                                type="button"
                                className="bakim-reminder__reset"
                                disabled={reminderBusyId === c.id}
                                onClick={() => void handleReminderStatus(c, 'PENDING')}
                            >
                                Sıfırla
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const openEdit = (c: MaintenanceCompanyRow) => {
        setEditing(c);
        setDraft({
            displayName: c.displayName ?? '',
            email: c.email ?? '',
            phone: c.phone ?? '',
            phone2: c.phone2 ?? '',
            notes: c.notes ?? '',
        });
    };

    const closeEdit = () => {
        setEditing(null);
        setDraft(null);
        setSaving(false);
    };

    const saveEdit = async () => {
        if (!editing || !draft) return;
        setSaving(true);
        try {
            await updateMaintenanceCompany(editing.id, {
                displayName: draft.displayName,
                email: draft.email || null,
                phone: draft.phone || null,
                phone2: draft.phone2 || null,
                notes: draft.notes || null,
            });
            await loadCompanies();
            closeEdit();
        } catch (e) {
            console.error('[bakim] company save failed:', e);
            alert('Firma kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    const filteredCompanies = useMemo(() => {
        if (view !== 'COMPANIES') return [];
        const query = q.trim().toLowerCase();
        if (!query) return companies;
        return companies.filter((c) => {
            const hay = `${c.displayName} ${c.normalizedKey} ${c.email ?? ''} ${c.phone ?? ''} ${c.phone2 ?? ''}`.toLowerCase();
            return hay.includes(query);
        });
    }, [companies, q, view]);

    const schedulesGrouped = useMemo(() => {
        if (view !== 'SCHEDULES') return [];
        const qTrim = q.trim().toLowerCase();
        const byCompany = new Map<number, { company: MaintenanceScheduleRow['company']; rows: MaintenanceScheduleRow[] }>();
        for (const row of items) {
            if (qTrim && !row.company.displayName.toLowerCase().includes(qTrim) && !row.company.normalizedKey.toLowerCase().includes(qTrim)) {
                // q filtrelemesi backend'de var, ama burada firma kartı başlığı için de güvenli filtre
            }
            const id = row.company.id;
            const curr = byCompany.get(id);
            if (!curr) byCompany.set(id, { company: row.company, rows: [row] });
            else curr.rows.push(row);
        }
        const groups = [...byCompany.values()].map((g) => {
            const rows = [...g.rows].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
            const counts = {
                total: rows.length,
                dueSoon: rows.filter((r) => r.urgency === 'soon').length,
                overdue: rows.filter((r) => r.urgency === 'overdue').length,
                completed: rows.filter((r) => r.status === 'COMPLETED').length,
            };
            const nextDue = rows.find((r) => r.status !== 'COMPLETED') || rows[0];
            return { company: g.company, rows, counts, nextDue };
        });
        groups.sort((a, b) => {
            const ao = a.counts.overdue - b.counts.overdue;
            if (ao !== 0) return ao > 0 ? -1 : 1;
            const as = a.counts.dueSoon - b.counts.dueSoon;
            if (as !== 0) return as > 0 ? -1 : 1;
            return new Date(a.nextDue?.dueAt || 0).getTime() - new Date(b.nextDue?.dueAt || 0).getTime();
        });
        return groups;
    }, [items, q, view]);

    const companyReminderMap = useMemo(() => {
        const m = new Map<number, MaintenanceCompanyRow>();
        for (const c of companies) m.set(c.id, c);
        return m;
    }, [companies]);

    const toggleCompany = (companyId: number) => {
        setExpandedCompanies((prev) => ({ ...prev, [companyId]: !prev[companyId] }));
    };

    return (
        <AuthGuard>
            <Sidebar />
            <main className="main-content apple-app-page ssh-takip-page">
                <div className="apple-canvas">
                    <header className="apple-page-hero ssh-hero">
                        <div className="header-row">
                            <div className="header-left">
                                <div className="header-title">Bakım Takip</div>
                                <div className="header-subtitle">
                                    Teslimattan 1 yıl sonra bakım hatırlatması. Bildirim çanı ve bu listede yaklaşan / geciken kayıtlar görünür.
                                </div>
                            </div>
                            <div className="header-toolbar">
                                <button
                                    className="ssh-primary-btn is-secondary"
                                    onClick={() => void handleRebuild()}
                                    disabled={loading || syncing}
                                    type="button"
                                >
                                    <Bell size={16} aria-hidden /> {syncing ? 'Senkron…' : 'Verileri senkronize et'}
                                </button>
                                <button
                                    className="ssh-primary-btn is-secondary"
                                    onClick={() => void (view === 'COMPANIES' ? loadCompanies() : loadSchedules())}
                                    disabled={loading}
                                    type="button"
                                >
                                    <TimerReset size={16} aria-hidden /> Yenile
                                </button>
                                <div className="bakim-toolbar-tabs">
                                    <button
                                        className={`ssh-primary-btn is-secondary ${view === 'SCHEDULES' ? 'is-active-analiz' : ''}`}
                                        onClick={() => setView('SCHEDULES')}
                                        type="button"
                                    >
                                        <Wrench size={16} aria-hidden /> Bakımlar
                                    </button>
                                    <button
                                        className={`ssh-primary-btn is-secondary ${view === 'COMPANIES' ? 'is-active-analiz' : ''}`}
                                        onClick={() => setView('COMPANIES')}
                                        type="button"
                                    >
                                        <Building2 size={16} aria-hidden /> Firmalar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    {loading && items.length === 0 && companies.length === 0 ? (
                        <OzunluLoading />
                    ) : (
                        <section className="ssh-panel">
                            {view === 'SCHEDULES' && (
                                <div className="bakim-kpi-grid">
                                    <div className="bakim-kpi bakim-kpi--primary">
                                        <div className="bakim-kpi__icon">
                                            <Wrench size={20} aria-hidden />
                                        </div>
                                        <div className="bakim-kpi__body">
                                            <div className="bakim-kpi__num">{stats?.total ?? 0}</div>
                                            <div className="bakim-kpi__label">Toplam</div>
                                            <div className="bakim-kpi__desc">Aktif bakım planı</div>
                                        </div>
                                    </div>
                                    <div className="bakim-kpi bakim-kpi--warn">
                                        <div className="bakim-kpi__icon">
                                            <AlertTriangle size={20} aria-hidden />
                                        </div>
                                        <div className="bakim-kpi__body">
                                            <div className="bakim-kpi__num">{stats?.dueSoon ?? 0}</div>
                                            <div className="bakim-kpi__label">Yaklaşan</div>
                                            <div className="bakim-kpi__desc">30 gün içinde</div>
                                        </div>
                                    </div>
                                    <div className="bakim-kpi bakim-kpi--danger">
                                        <div className="bakim-kpi__icon">
                                            <TimerReset size={20} aria-hidden />
                                        </div>
                                        <div className="bakim-kpi__body">
                                            <div className="bakim-kpi__num">{stats?.overdue ?? 0}</div>
                                            <div className="bakim-kpi__label">Geciken</div>
                                        </div>
                                    </div>
                                    <div className="bakim-kpi bakim-kpi--success">
                                        <div className="bakim-kpi__icon">
                                            <CheckCircle2 size={20} aria-hidden />
                                        </div>
                                        <div className="bakim-kpi__body">
                                            <div className="bakim-kpi__num">{stats?.completed ?? 0}</div>
                                            <div className="bakim-kpi__label">Tamamlanan</div>
                                            <div className="bakim-kpi__desc">Tüm zamanlar</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bakim-filter">
                                <div className="bakim-filter__head">
                                    <div className="bakim-filter__icon">
                                        {view === 'COMPANIES' ? <Search size={18} aria-hidden /> : <Filter size={18} aria-hidden />}
                                    </div>
                                    <div className="bakim-filter__titles">
                                        <div className="bakim-filter__title">{view === 'COMPANIES' ? 'Firma arama' : 'Filtreler'}</div>
                                        <div className="bakim-filter__desc">{view === 'COMPANIES' ? 'Firma adı, e-posta veya telefon.' : 'Firma, ürün tipi ve durum.'}</div>
                                    </div>
                                    <span className="bakim-filter__count">
                                        {view === 'COMPANIES' ? `${filteredCompanies.length} firma` : highlighted ? `Vurgulanan: #${highlighted.id}` : `${items.length} kayıt`}
                                    </span>
                                </div>

                                <form
                                    className="bakim-filter__body"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        void (view === 'COMPANIES' ? loadCompanies() : loadSchedules());
                                    }}
                                >
                                    <div className="bakim-field bakim-field--grow">
                                        <label className="bakim-field__label">
                                            <Search size={13} aria-hidden /> Arama
                                        </label>
                                        <input
                                            className="bakim-input"
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                            placeholder={view === 'COMPANIES' ? 'Örn: EFATUR, 05xx, mail@' : 'Firma adı…'}
                                        />
                                    </div>
                                    {view === 'SCHEDULES' && (
                                        <>
                                            <div className="bakim-field">
                                                <label className="bakim-field__label">Ürün tipi</label>
                                                <select
                                                    className="bakim-input bakim-select"
                                                    value={productType}
                                                    onChange={(e) => setProductType(e.target.value as ProductTypeFilter)}
                                                >
                                                    <option value="ALL">Tümü</option>
                                                    <option value="DAMPER">Damper</option>
                                                    <option value="DORSE">Dorse</option>
                                                </select>
                                            </div>
                                            <div className="bakim-field">
                                                <label className="bakim-field__label">Durum</label>
                                                <select
                                                    className="bakim-input bakim-select"
                                                    value={status}
                                                    onChange={(e) => setStatus(e.target.value as StatusFilter)}
                                                >
                                                    <option value="ALL">Tümü</option>
                                                    <option value="SCHEDULED">Planlandı</option>
                                                    <option value="DUE_SOON">Yaklaştı</option>
                                                    <option value="OVERDUE">Gecikti</option>
                                                    <option value="COMPLETED">Tamamlandı</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                    <div className="bakim-filter__actions">
                                        <button className="ssh-primary-btn" disabled={loading} type="submit">
                                            <TimerReset size={16} aria-hidden /> Uygula
                                        </button>
                                        {view === 'SCHEDULES' && companyId != null && (
                                            <button
                                                className="ssh-primary-btn is-secondary"
                                                onClick={() => setCompanyId(null)}
                                                disabled={loading}
                                                type="button"
                                            >
                                                Filtreyi kaldır
                                            </button>
                                        )}
                                    </div>
                                </form>
                            </div>

                            <div className="ssh-panel" style={{ marginBottom: 0 }}>
                                {view === 'SCHEDULES' && items.length === 0 ? (
                                    <div className="ssh-glass-card">
                                        <div className="ssh-card-title">Bakım kaydı bulunamadı</div>
                                        <p className="ssh-card-desc">
                                            Teslim edilmiş damper/dorse için plan oluşmamış olabilir. &quot;Verileri senkronize et&quot; ile tüm firmaları ve teslim
                                            kayıtlarını yeniden tarayın.
                                        </p>
                                        <button className="ssh-primary-btn" type="button" onClick={() => void handleRebuild()} disabled={syncing}>
                                            <Bell size={16} aria-hidden /> Verileri senkronize et
                                        </button>
                                    </div>
                                ) : view === 'SCHEDULES' ? (
                                    schedulesGrouped.map((g) => {
                                        const expanded = expandedCompanies[g.company.id] ?? (g.counts.overdue > 0 || g.counts.dueSoon > 0);
                                        return (
                                            <section key={g.company.id} className="ssh-glass-card bakim-company-card">
                                                <button
                                                    className="bakim-company-card__head"
                                                    type="button"
                                                    onClick={() => toggleCompany(g.company.id)}
                                                >
                                                    <div className="bakim-company-card__title">
                                                        <div className="bakim-company-card__name">{g.company.displayName}</div>
                                                        <div className="bakim-company-card__sub">{g.company.normalizedKey}</div>
                                                    </div>
                                                    <div className="bakim-company-card__chips">
                                                        {companyReminderMap.get(g.company.id) && (
                                                            <span className={reminderBadgeClass(companyReminderMap.get(g.company.id)!.reminderStatus)}>
                                                                {REMINDER_STATUS_LABELS[companyReminderMap.get(g.company.id)!.reminderStatus]}
                                                            </span>
                                                        )}
                                                        {g.counts.overdue > 0 && <span className="badge badge-danger">Geciken {g.counts.overdue}</span>}
                                                        {g.counts.dueSoon > 0 && <span className="badge badge-warning">Yaklaşan {g.counts.dueSoon}</span>}
                                                        <span className="badge badge-muted">Toplam {g.counts.total}</span>
                                                        <span className={`bakim-company-card__chev ${expanded ? 'is-open' : ''}`}>▾</span>
                                                    </div>
                                                </button>

                                                <div className={`bakim-company-card__body ${expanded ? 'is-open' : 'is-closed'}`}>
                                                    {companyReminderMap.get(g.company.id) && renderReminder(companyReminderMap.get(g.company.id)!)}
                                                    {g.counts.completed < g.counts.total && (
                                                        <div className="bakim-completeall">
                                                            <button
                                                                type="button"
                                                                className="ssh-primary-btn"
                                                                onClick={() => void handleCompleteAll(g)}
                                                                disabled={busyId === -g.company.id}
                                                            >
                                                                <CheckCircle2 size={16} aria-hidden />
                                                                {busyId === -g.company.id ? 'İşleniyor…' : 'Hepsinin bakımı yapıldı'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="bakim-company-card__grid">
                                                        {g.rows.map((row) => (
                                                            <div
                                                                key={row.id}
                                                                className={`bakim-mini-card ${row.id === highlightId ? 'is-highlight' : ''}`}
                                                            >
                                                                <div className="bakim-mini-card__top">
                                                                    <div className={countdownClass(row.urgency)}>
                                                                        <div className="bakim-countdown__label">Hatırlatma</div>
                                                                        <div className="bakim-countdown__value">{formatDueText(row)}</div>
                                                                        <div className="bakim-countdown__meta">
                                                                            Bakım tarihi: {new Date(row.dueAt).toLocaleDateString('tr-TR')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bakim-mini-card__meta">
                                                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                                                            <span className={statusBadgeClass(row.status)}>{row.status}</span>
                                                                            <span className="badge badge-muted">
                                                                                <Truck size={12} aria-hidden style={{ marginRight: 4, verticalAlign: -2 }} />
                                                                                {row.productType}
                                                                                {row.productSummary?.imalatNo != null ? ` #${row.productSummary.imalatNo}` : ` #${row.productId}`}
                                                                            </span>
                                                                            {row.productSummary?.m3 && <span className="badge badge-muted">{row.productSummary.m3} m³</span>}
                                                                        </div>
                                                                        <div className="bakim-schedule-meta" style={{ marginTop: 10 }}>
                                                                            <span>
                                                                                <strong>Teslim:</strong> {new Date(row.deliveredAt).toLocaleDateString('tr-TR')}
                                                                            </span>
                                                                            {(row.productSummary?.teslimSasiNo || row.productSummary?.sasiNo) && (
                                                                                <span>
                                                                                    <strong>Şasi:</strong> {row.productSummary.teslimSasiNo || row.productSummary.sasiNo}
                                                                                </span>
                                                                            )}
                                                                            {row.productType === 'DAMPER' && row.productSummary?.tip && (
                                                                                <span>
                                                                                    <strong>Tip:</strong> {row.productSummary.tip}
                                                                                </span>
                                                                            )}
                                                                            {row.productType === 'DORSE' && row.productSummary?.dingil && (
                                                                                <span>
                                                                                    <strong>Dingil:</strong> {row.productSummary.dingil}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {row.deliveryLog && row.deliveryLog.length > 0 && (
                                                                    <details className="bakim-delivery-log">
                                                                        <summary>Teslimat geçmişi ({row.deliveryLog.length})</summary>
                                                                        <ul>
                                                                            {row.deliveryLog.map((e, i) => (
                                                                                <li key={`${e.fieldKey}-${i}`}>
                                                                                    <span className="bakim-delivery-log__time">
                                                                                        {new Date(e.at).toLocaleString('tr-TR')}
                                                                                    </span>
                                                                                    <span className="bakim-delivery-log__field">{deliveryFieldLabel(e.fieldKey)}</span>
                                                                                    <span>{formatDeliveryLogValue(e)}</span>
                                                                                    {e.username && <span className="muted"> · {e.username}</span>}
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </details>
                                                                )}

                                                                <div className="bakim-mini-card__actions">
                                                                    <Link
                                                                        className="ssh-primary-btn is-secondary"
                                                                        href={`/urun-listesi?type=${encodeURIComponent(row.productType)}&expand=${row.productId}`}
                                                                    >
                                                                        Ürün
                                                                    </Link>
                                                                    {row.status !== 'COMPLETED' && (
                                                                        <button
                                                                            className="ssh-primary-btn"
                                                                            type="button"
                                                                            onClick={() => void handleComplete(row)}
                                                                            disabled={busyId === row.id}
                                                                        >
                                                                            {busyId === row.id ? '…' : 'Bakım yapıldı'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </section>
                                        );
                                    })
                                ) : filteredCompanies.length === 0 ? (
                                    <div className="ssh-glass-card">
                                        <div className="ssh-card-title">Firma bulunamadı</div>
                                        <p className="ssh-card-desc">Aramayı değiştirin veya &quot;Verileri senkronize et&quot; ile yeniden tarayın.</p>
                                        <button className="ssh-primary-btn" type="button" onClick={() => void handleRebuild()} disabled={syncing}>
                                            <Bell size={16} aria-hidden /> Verileri senkronize et
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bakim-firma-grid">
                                        {filteredCompanies.map((c) => {
                                            const initials = c.displayName.trim().slice(0, 2).toUpperCase();
                                            return (
                                                <div key={c.id} className="bakim-firma-card">
                                                    <div className="bakim-firma-card__head">
                                                        <div className="bakim-firma-card__avatar">{initials}</div>
                                                        <div style={{ minWidth: 0, flex: 1 }}>
                                                            <div className="bakim-firma-card__name">{c.displayName}</div>
                                                            <div className="bakim-firma-card__key">{c.normalizedKey}</div>
                                                        </div>
                                                    </div>

                                                    <div className="bakim-firma-card__contact">
                                                        <a className={`bakim-contact ${c.email ? '' : 'is-empty'}`} href={c.email ? `mailto:${c.email}` : undefined}>
                                                            <Mail size={14} aria-hidden /> {c.email || 'e-posta yok'}
                                                        </a>
                                                        <a className={`bakim-contact ${c.phone ? '' : 'is-empty'}`} href={c.phone ? `tel:${c.phone}` : undefined}>
                                                            <Phone size={14} aria-hidden /> {c.phone || 'telefon yok'}
                                                        </a>
                                                        {c.phone2 && (
                                                            <a className="bakim-contact" href={`tel:${c.phone2}`}>
                                                                <Phone size={14} aria-hidden /> {c.phone2}
                                                            </a>
                                                        )}
                                                    </div>

                                                    <div className="bakim-firma-card__actions">
                                                        <button
                                                            className="ssh-primary-btn is-secondary"
                                                            onClick={() => {
                                                                setView('SCHEDULES');
                                                                setCompanyId(c.id);
                                                            }}
                                                            type="button"
                                                        >
                                                            <Wrench size={15} aria-hidden /> Bakımlar
                                                        </button>
                                                        <button className="ssh-primary-btn" type="button" onClick={() => openEdit(c)}>
                                                            Düzenle
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>

                {editing && draft && (
                    <div className="bakim-modal-overlay" onClick={closeEdit} role="presentation">
                        <div className="bakim-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                            <div className="bakim-modal__head">
                                <div className="bakim-modal__head-icon">
                                    <Building2 size={20} aria-hidden />
                                </div>
                                <div className="bakim-modal__head-text">
                                    <div className="bakim-modal__title">Firma düzenle</div>
                                    <div className="bakim-modal__subtitle">{editing.displayName} · {editing.normalizedKey}</div>
                                </div>
                                <button className="bakim-modal__close" onClick={closeEdit} type="button" aria-label="Kapat">
                                    <X size={18} aria-hidden />
                                </button>
                            </div>

                            <div className="bakim-modal__body">
                                <div className="bakim-modal__grid">
                                    <div className="bakim-field bakim-field--full">
                                        <label className="bakim-field__label">Firma adı</label>
                                        <input
                                            className="bakim-input"
                                            value={draft.displayName}
                                            onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
                                        />
                                    </div>
                                    <div className="bakim-field">
                                        <label className="bakim-field__label">
                                            <Mail size={13} aria-hidden /> E-posta
                                        </label>
                                        <input
                                            className="bakim-input"
                                            value={draft.email}
                                            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                                            placeholder="mail@firma.com"
                                        />
                                    </div>
                                    <div className="bakim-field">
                                        <label className="bakim-field__label">
                                            <Phone size={13} aria-hidden /> Telefon
                                        </label>
                                        <input
                                            className="bakim-input"
                                            value={draft.phone}
                                            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                                            placeholder="05xx xxx xx xx"
                                        />
                                    </div>
                                    <div className="bakim-field">
                                        <label className="bakim-field__label">
                                            <Phone size={13} aria-hidden /> Telefon 2
                                        </label>
                                        <input
                                            className="bakim-input"
                                            value={draft.phone2}
                                            onChange={(e) => setDraft({ ...draft, phone2: e.target.value })}
                                            placeholder="Opsiyonel"
                                        />
                                    </div>
                                    <div className="bakim-field bakim-field--full">
                                        <label className="bakim-field__label">Not</label>
                                        <textarea
                                            className="bakim-input bakim-textarea"
                                            value={draft.notes}
                                            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                                            rows={3}
                                            placeholder="İletişim notu, yetkili kişi, özel koşullar…"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bakim-modal__footer">
                                <button className="ssh-primary-btn is-secondary" type="button" onClick={closeEdit} disabled={saving}>
                                    Vazgeç
                                </button>
                                <button className="ssh-primary-btn" type="button" onClick={() => void saveEdit()} disabled={saving}>
                                    <Save size={16} aria-hidden /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {noteModal && (
                    <div
                        className="bakim-modal-overlay"
                        onClick={() => {
                            if (reminderBusyId !== noteModal.company.id) setNoteModal(null);
                        }}
                        role="presentation"
                    >
                        <div className="bakim-modal bakim-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                            <div className="bakim-modal__head">
                                <div className="bakim-modal__head-icon">
                                    <StickyNote size={20} aria-hidden />
                                </div>
                                <div className="bakim-modal__head-text">
                                    <div className="bakim-modal__title">Firma notu</div>
                                    <div className="bakim-modal__subtitle">
                                        {noteModal.company.displayName} · {REMINDER_STATUS_LABELS[noteModal.targetStatus]}
                                    </div>
                                </div>
                                <button
                                    className="bakim-modal__close"
                                    onClick={() => setNoteModal(null)}
                                    type="button"
                                    aria-label="Kapat"
                                    disabled={reminderBusyId === noteModal.company.id}
                                >
                                    <X size={18} aria-hidden />
                                </button>
                            </div>

                            <div className="bakim-modal__body">
                                <div className="bakim-field">
                                    <label className="bakim-field__label">Not</label>
                                    <textarea
                                        className="bakim-input bakim-textarea"
                                        value={noteDraft}
                                        onChange={(e) => setNoteDraft(e.target.value)}
                                        rows={4}
                                        autoFocus
                                        placeholder="Örn: 06.03 tarihinde arandı, randevu verilecek…"
                                    />
                                </div>
                            </div>

                            <div className="bakim-modal__footer">
                                <button
                                    className="ssh-primary-btn is-secondary"
                                    type="button"
                                    onClick={() => setNoteModal(null)}
                                    disabled={reminderBusyId === noteModal.company.id}
                                >
                                    Vazgeç
                                </button>
                                <button
                                    className="ssh-primary-btn"
                                    type="button"
                                    onClick={() => void saveNoteModal()}
                                    disabled={reminderBusyId === noteModal.company.id}
                                >
                                    <Save size={16} aria-hidden /> {reminderBusyId === noteModal.company.id ? 'Kaydediliyor…' : 'Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </AuthGuard>
    );
}

