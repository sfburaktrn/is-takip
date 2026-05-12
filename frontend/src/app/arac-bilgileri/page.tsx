'use client';

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import {
    getVehicleDeliveryEvents,
    deleteVehicleDeliveryRecords,
    getVehicleDeliveryDeletionLogs,
    type VehicleDeliveryEventRow,
    type VehicleDeliveryDeletionLogRow,
} from '@/lib/api';
import {
    CarFront,
    RefreshCw,
    Radio,
    LogIn,
    LogOut as LogOutIcon,
    Building2,
    Hash,
    Gauge,
    Fuel,
    Milestone,
    Search,
    AlertCircle,
    Trash2,
    ScrollText,
    X,
} from 'lucide-react';

const POLL_MS = 10_000;

type VdStatFilter = 'all' | 'sahada' | 'teslim';

function fmtDt(iso: string | null | undefined) {
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

function readVehicleSnapshot(pay: Record<string, unknown> | null | undefined) {
    if (!pay || typeof pay !== 'object') {
        return {
            brand: null as string | null,
            model: null as string | null,
            chassis: null as string | null,
            fuel: null as string | null,
            km: null as number | null,
        };
    }
    return {
        brand: typeof pay.vehicleBrand === 'string' ? pay.vehicleBrand : null,
        model: typeof pay.vehicleModel === 'string' ? pay.vehicleModel : null,
        chassis: typeof pay.chassisNo === 'string' ? pay.chassisNo : null,
        fuel: typeof pay.fuelLevel === 'string' ? pay.fuelLevel : null,
        km: typeof pay.mileageKm === 'number' ? pay.mileageKm : null,
    };
}

function dispStr(v: string | null | undefined) {
    if (v == null || String(v).trim() === '') return '—';
    return v;
}

function dispVehicle(brand: string | null, model: string | null) {
    const t = [brand, model].filter(Boolean).join(' ').trim();
    return t || '—';
}

function dispKm(k: number | null | undefined) {
    if (k == null || !Number.isFinite(k)) return '—';
    return k.toLocaleString('tr-TR');
}

/** Eski kayıtlar: yalnızca teslim gelmişse gövde bazen payloadJson'daydı. */
function legacyDeliveredPayload(row: VehicleDeliveryEventRow): Record<string, unknown> | null {
    const p = row.payloadJson;
    if (p && p.eventType === 'VEHICLE_DELIVERED') return p;
    return null;
}

function searchChassis(r: VehicleDeliveryEventRow): string {
    const parts = [r.payloadJson, r.deliveredPayloadJson, legacyDeliveredPayload(r)];
    for (const p of parts) {
        if (p && typeof p.chassisNo === 'string') return p.chassisNo;
    }
    return '';
}

/** API zaten tek satır / sourceDeliveryId döner; sıralama gösterim için birleştirme gerekmez. */
function sortDeliveryRows(rows: VehicleDeliveryEventRow[]): VehicleDeliveryEventRow[] {
    return [...rows].sort((a, b) => {
        const ta = Math.max(
            a.arrivedAt ? new Date(a.arrivedAt).getTime() : 0,
            a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0,
            new Date(a.updatedAt).getTime(),
        );
        const tb = Math.max(
            b.arrivedAt ? new Date(b.arrivedAt).getTime() : 0,
            b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0,
            new Date(b.updatedAt).getTime(),
        );
        return tb - ta;
    });
}

function VehicleCard({
    row,
    deleting,
    onDelete,
    highlighted,
}: {
    row: VehicleDeliveryEventRow;
    deleting: boolean;
    onDelete: () => Promise<void>;
    highlighted: boolean;
}) {
    const inboundSnap = readVehicleSnapshot(row.payloadJson);
    const delPay = row.deliveredPayloadJson ?? legacyDeliveredPayload(row);
    const deliveredSnap = readVehicleSnapshot(delPay);

    const onsite = !!(row.arrivedAt && !row.deliveredAt);
    const done = !!row.deliveredAt;

    return (
        <article id={`vd-row-${row.id}`} className={`vd-card ${highlighted ? 'vd-card-highlight' : ''}`}>
            <div className={`vd-accent ${done ? 'vd-accent-done' : onsite ? 'vd-accent-onsite' : 'vd-accent-partial'}`} />
            <div className="vd-card-inner">
                <div className="vd-card-head">
                    <div className="vd-icon-wrap">
                        <CarFront size={22} strokeWidth={2.2} />
                    </div>
                    <div className="vd-head-text">
                        <div className="vd-company">
                            <Building2 size={14} className="vd-company-icon" aria-hidden />
                            {row.companyName}
                        </div>
                        <div className="vd-id">
                            <Hash size={12} aria-hidden /> {row.sourceDeliveryId}
                        </div>
                    </div>
                    <div className="vd-status-wrap">
                        {done ? (
                            <span className="vd-pill vd-pill-done">
                                <LogOutIcon size={13} /> Teslim edildi
                            </span>
                        ) : onsite ? (
                            <span className="vd-pill vd-pill-onsite">
                                <Radio size={13} /> Sahada
                            </span>
                        ) : (
                            <span className="vd-pill vd-pill-wait">
                                <AlertCircle size={13} /> Kısmi kayıt
                            </span>
                        )}
                    </div>
                </div>

                {row.arrivedAt ? (
                    <div className="vd-section">
                        <div className="vd-section-title">
                            <LogIn size={15} /> Giriş
                        </div>
                        <p className="vd-section-hint">Sahaya girerken bildirilen araç okumaları</p>
                        <div className="vd-grid">
                            <div className="vd-kv">
                                <span className="vd-k">Varış zamanı</span>
                                <span className="vd-v">{fmtDt(row.arrivedAt)}</span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">Araç (giriş)</span>
                                <span className="vd-v">{dispVehicle(inboundSnap.brand, inboundSnap.model)}</span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">Şasi (giriş)</span>
                                <span className={`vd-v vd-mono ${!inboundSnap.chassis ? 'vd-v-empty' : ''}`}>
                                    {dispStr(inboundSnap.chassis)}
                                </span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">
                                    <Fuel size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Yakıt (giriş)
                                </span>
                                <span className={`vd-v ${!inboundSnap.fuel ? 'vd-v-empty' : ''}`}>
                                    {dispStr(inboundSnap.fuel)}
                                </span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">
                                    <Gauge size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    KM (giriş)
                                </span>
                                <span className={`vd-v ${inboundSnap.km == null ? 'vd-v-empty' : ''}`}>
                                    {dispKm(inboundSnap.km)}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}

                {row.deliveredAt ? (
                    <div className="vd-section vd-section-muted">
                        <div className="vd-section-title">
                            <LogOutIcon size={15} /> Teslim
                        </div>
                        <p className="vd-section-hint">Teslim / çıkış anındaki araç okumaları (girişten farklı olabilir)</p>
                        <div className="vd-grid">
                            <div className="vd-kv">
                                <span className="vd-k">
                                    <Milestone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Teslim zamanı
                                </span>
                                <span className="vd-v">{fmtDt(row.deliveredAt)}</span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">Araç (teslim)</span>
                                <span className="vd-v">{dispVehicle(deliveredSnap.brand, deliveredSnap.model)}</span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">Şasi (teslim)</span>
                                <span className={`vd-v vd-mono ${!deliveredSnap.chassis ? 'vd-v-empty' : ''}`}>
                                    {dispStr(deliveredSnap.chassis)}
                                </span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">
                                    <Fuel size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Yakıt (teslim)
                                </span>
                                <span className={`vd-v ${!deliveredSnap.fuel ? 'vd-v-empty' : ''}`}>
                                    {dispStr(deliveredSnap.fuel)}
                                </span>
                            </div>
                            <div className="vd-kv">
                                <span className="vd-k">
                                    <Gauge size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    KM (teslim)
                                </span>
                                <span className={`vd-v ${deliveredSnap.km == null ? 'vd-v-empty' : ''}`}>
                                    {dispKm(deliveredSnap.km)}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : null}

                <div className="vd-card-actions">
                    <button
                        type="button"
                        className="vd-del-btn"
                        disabled={deleting}
                        onClick={() => void onDelete()}
                    >
                        <Trash2 size={16} />
                        {deleting ? 'Siliniyor…' : 'İmalat kaydından sil'}
                    </button>
                </div>
            </div>

            <style jsx>{`
                .vd-card {
                    position: relative;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border);
                    background: linear-gradient(165deg, var(--card) 0%, var(--surface-subtle) 100%);
                    overflow: hidden;
                    box-shadow: var(--shadow-md);
                    transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease,
                        border-color 0.25s ease;
                }
                .vd-card:hover {
                    transform: translateY(-2px);
                    border-color: color-mix(in srgb, var(--foreground) 12%, var(--border));
                    box-shadow: var(--shadow-lg);
                }
                .vd-card-highlight {
                    border-color: rgba(16, 185, 129, 0.65);
                    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.28), 0 18px 36px -18px rgba(5, 150, 105, 0.35);
                }
                .vd-accent {
                    height: 4px;
                    width: 100%;
                }
                .vd-accent-done {
                    background: linear-gradient(
                        90deg,
                        var(--success),
                        color-mix(in srgb, var(--success) 58%, var(--card)),
                        color-mix(in srgb, var(--success) 72%, var(--card)),
                        color-mix(in srgb, var(--success) 58%, var(--card)),
                        var(--success)
                    );
                    background-size: 200% 100%;
                    animation: vdShimmer 5s linear infinite;
                }
                .vd-accent-onsite {
                    background: linear-gradient(
                        90deg,
                        var(--warning),
                        color-mix(in srgb, var(--warning) 55%, var(--card)),
                        color-mix(in srgb, var(--warning) 70%, var(--card)),
                        color-mix(in srgb, var(--warning) 55%, var(--card)),
                        var(--warning)
                    );
                    background-size: 200% 100%;
                    animation: vdShimmer 4s linear infinite;
                }
                .vd-accent-partial {
                    background: linear-gradient(
                        90deg,
                        var(--primary),
                        color-mix(in srgb, var(--primary) 50%, var(--card)),
                        color-mix(in srgb, var(--primary) 68%, var(--card)),
                        color-mix(in srgb, var(--primary) 50%, var(--card)),
                        var(--primary)
                    );
                    background-size: 200% 100%;
                    animation: vdShimmer 6s linear infinite;
                }
                @keyframes vdShimmer {
                    0% {
                        background-position: 200% 0;
                    }
                    100% {
                        background-position: -200% 0;
                    }
                }
                .vd-card-inner {
                    padding: 18px 20px 20px;
                }
                .vd-card-head {
                    display: flex;
                    align-items: flex-start;
                    gap: 14px;
                    margin-bottom: 16px;
                }
                .vd-icon-wrap {
                    flex-shrink: 0;
                    width: 48px;
                    height: 48px;
                    border-radius: 14px;
                    background: radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 55%),
                        linear-gradient(145deg, var(--primary), var(--primary-hover));
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 20px -8px rgba(2, 35, 71, 0.45);
                }
                .vd-head-text {
                    flex: 1;
                    min-width: 0;
                }
                .vd-company {
                    font-weight: 800;
                    font-size: 1.05rem;
                    letter-spacing: -0.02em;
                    color: var(--foreground);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                :global(.vd-company-icon) {
                    opacity: 0.45;
                    flex-shrink: 0;
                }
                .vd-id {
                    font-size: 11px;
                    color: var(--muted);
                    font-weight: 600;
                    margin-top: 6px;
                    font-family: ui-monospace, monospace;
                    letter-spacing: 0.02em;
                }
                .vd-status-wrap {
                    flex-shrink: 0;
                }
                .vd-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 800;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .vd-pill-done {
                    background: color-mix(in srgb, var(--success) 14%, var(--card));
                    color: var(--success);
                    border: 1px solid color-mix(in srgb, var(--success) 35%, var(--border));
                }
                .vd-pill-onsite {
                    background: color-mix(in srgb, var(--warning) 16%, var(--card));
                    color: var(--warning);
                    border: 1px solid color-mix(in srgb, var(--warning) 38%, var(--border));
                }
                .vd-pill-wait {
                    background: color-mix(in srgb, var(--primary) 12%, var(--card));
                    color: var(--primary);
                    border: 1px solid color-mix(in srgb, var(--primary) 32%, var(--border));
                }
                .vd-section {
                    padding: 14px;
                    border-radius: var(--radius-md);
                    background: var(--surface-subtle);
                    border: 1px solid var(--hairline);
                }
                .vd-section + .vd-section {
                    margin-top: 10px;
                }
                .vd-section-muted {
                    background: color-mix(in srgb, var(--foreground) 4%, var(--card));
                }
                .vd-section-title {
                    font-size: 11px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--muted);
                    margin-bottom: 6px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .vd-section-hint {
                    font-size: 12px;
                    font-weight: 550;
                    line-height: 1.38;
                    color: var(--muted);
                    opacity: 0.9;
                    margin: 0 0 12px 0;
                }
                .vd-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 10px 14px;
                }
                .vd-kv {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .vd-k {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: var(--muted);
                }
                .vd-v {
                    font-weight: 650;
                    font-size: 13px;
                    color: var(--foreground);
                    word-break: break-word;
                }
                .vd-v-empty {
                    opacity: 0.48;
                    font-weight: 600;
                }
                .vd-mono {
                    font-family: ui-monospace, monospace;
                    font-size: 12px;
                }
                .vd-card-actions {
                    margin-top: 16px;
                    padding-top: 14px;
                    border-top: 1px solid var(--hairline);
                }
                .vd-del-btn {
                    width: 100%;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 10px 14px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 750;
                    cursor: pointer;
                    border: 1px solid color-mix(in srgb, var(--danger) 35%, var(--border));
                    background: color-mix(in srgb, var(--danger) 10%, var(--card));
                    color: var(--danger);
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
                .vd-del-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    background: color-mix(in srgb, var(--danger) 14%, var(--card));
                }
                .vd-del-btn:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }
            `}</style>
        </article>
    );
}

function deletionLogDetails(d: VehicleDeliveryDeletionLogRow['details']) {
    if (!d || typeof d !== 'object') return null;
    return d as {
        sourceDeliveryId?: string;
        companyName?: string | null;
        deletedCount?: number;
    };
}

function AracBilgileriContent() {
    const searchParams = useSearchParams();
    const [rows, setRows] = useState<VehicleDeliveryEventRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [lastAt, setLastAt] = useState<Date | null>(null);
    const [deleteBusyKey, setDeleteBusyKey] = useState<string | null>(null);
    const [logsOpen, setLogsOpen] = useState(false);
    const [logItems, setLogItems] = useState<VehicleDeliveryDeletionLogRow[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            setErr(null);
            const { items } = await getVehicleDeliveryEvents(150);
            setRows(items);
            setLastAt(new Date());
        } catch {
            setErr('Veriler yüklenemedi. Oturum ve backend (3001) kontrolü yapın.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        const id = window.setInterval(() => void load(), POLL_MS);
        return () => window.clearInterval(id);
    }, [load]);

    const sortedRows = useMemo(() => sortDeliveryRows(rows), [rows]);

    const stats = useMemo(() => {
        let sahada = 0;
        let teslim = 0;
        for (const r of sortedRows) {
            if (r.deliveredAt) teslim++;
            if (r.arrivedAt && !r.deliveredAt) sahada++;
        }
        return { sahada, teslim, uniq: sortedRows.length };
    }, [sortedRows]);

    const [q, setQ] = useState('');
    const [statFilter, setStatFilter] = useState<VdStatFilter>('all');
    const eventIdParam = searchParams.get('eventId');
    const focusEventId = eventIdParam ? Number(eventIdParam) : null;

    useEffect(() => {
        if (!Number.isFinite(focusEventId)) return;
        const row = sortedRows.find((r) => r.id === focusEventId);
        if (!row) return;
        if (q.trim() !== row.sourceDeliveryId) {
            setQ(row.sourceDeliveryId);
        }
        const timer = window.setTimeout(() => {
            const el = document.getElementById(`vd-row-${focusEventId}`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
        return () => window.clearTimeout(timer);
    }, [focusEventId, sortedRows, q]);

    const filtered = useMemo(() => {
        const n = q.trim().toLocaleLowerCase('tr-TR');
        let list = !n
            ? sortedRows
            : sortedRows.filter((r) => {
                  const blob = `${r.companyName} ${r.sourceDeliveryId} ${searchChassis(r)}`.toLocaleLowerCase('tr-TR');
                  return blob.includes(n);
              });
        if (statFilter === 'sahada') {
            list = list.filter((r) => !!(r.arrivedAt && !r.deliveredAt));
        } else if (statFilter === 'teslim') {
            list = list.filter((r) => !!r.deliveredAt);
        }
        return list;
    }, [sortedRows, q, statFilter]);

    const pickStatFilter = useCallback((next: VdStatFilter) => {
        setStatFilter((prev) => (prev === next ? 'all' : next));
    }, []);

    const openDeletionLogs = useCallback(async () => {
        setLogsOpen(true);
        setLogsLoading(true);
        try {
            const { items } = await getVehicleDeliveryDeletionLogs(100);
            setLogItems(items);
        } catch {
            setLogItems([]);
            alert('Silme kayıtları yüklenemedi.');
        } finally {
            setLogsLoading(false);
        }
    }, []);

    const handleDeleteRow = useCallback(
        async (r: VehicleDeliveryEventRow) => {
            const ok = window.confirm(
                `"${r.companyName}" teslimatı (${r.sourceDeliveryId}) İmalat Takip kayıtlarından silinecek.\n\nTeklif Takip sistemindeki veriyi değiştirmez; yalnızca bu paneldeki görünümü kaldırır.\n\nDevam etmek istiyor musunuz?`,
            );
            if (!ok) return;
            try {
                setDeleteBusyKey(r.sourceDeliveryId);
                await deleteVehicleDeliveryRecords(r.sourceDeliveryId);
                await load();
            } catch (e) {
                alert(e instanceof Error ? e.message : 'Kayıt silinemedi.');
            } finally {
                setDeleteBusyKey(null);
            }
        },
        [load],
    );

    return (
        <>
            <Sidebar />
            <main className="main-content apple-app-page analytics-page" style={{ minHeight: '100vh', paddingBottom: 48 }}>
                <div className="apple-canvas">
                <div className="vd-page">
                    <header className="vd-hero">
                        <div className="vd-hero-glow" />
                        <div className="vd-hero-row">
                            <div>
                                <p className="vd-hero-eyebrow">
                                    <Radio size={14} className="vd-pulse" /> Canlı araç akışı
                                </p>
                                <h1 className="vd-hero-title">Araç bilgileri</h1>
                                <p className="vd-hero-sub">
                                    Teklif Takip üzerinden gelen giriş ve teslim olayları otomatik olarak burada güncellenir
                                    (~{Math.round(POLL_MS / 1000)} sn).
                                </p>
                            </div>
                            <div className="vd-hero-actions">
                                <button
                                    type="button"
                                    className="vd-btn vd-log-btn"
                                    onClick={() => void openDeletionLogs()}
                                    title="İmalat kaydı silme geçmişi"
                                    aria-label="Silme kayıtlarını aç"
                                >
                                    <ScrollText size={18} /> Silme kayıtları
                                </button>
                                <button type="button" className="vd-btn vd-btn-ghost" onClick={() => void load()} disabled={loading}>
                                    <RefreshCw size={18} className={loading ? 'vd-spin' : ''} /> Yenile
                                </button>
                                <div className="vd-live-badge">
                                    <span className="vd-live-dot" />
                                    {lastAt
                                        ? `Son güncelleme: ${lastAt.toLocaleTimeString('tr-TR', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              second: '2-digit',
                                          })}`
                                        : 'Bağlanıyor…'}
                                </div>
                            </div>
                        </div>
                        <div className="vd-stat-strip" role="toolbar" aria-label="Kayıt durumuna göre filtre">
                            <button
                                type="button"
                                className={`vd-stat${statFilter === 'all' ? ' vd-stat--active' : ''}`}
                                onClick={() => pickStatFilter('all')}
                                aria-pressed={statFilter === 'all'}
                            >
                                <span className="vd-stat-n">{stats.uniq}</span>
                                <span className="vd-stat-l">İş takip kaydı</span>
                            </button>
                            <button
                                type="button"
                                className={`vd-stat vd-stat-warn${statFilter === 'sahada' ? ' vd-stat--active' : ''}`}
                                onClick={() => pickStatFilter('sahada')}
                                aria-pressed={statFilter === 'sahada'}
                            >
                                <span className="vd-stat-n">{stats.sahada}</span>
                                <span className="vd-stat-l">Sahada (giriş, teslim yok)</span>
                            </button>
                            <button
                                type="button"
                                className={`vd-stat vd-stat-ok${statFilter === 'teslim' ? ' vd-stat--active' : ''}`}
                                onClick={() => pickStatFilter('teslim')}
                                aria-pressed={statFilter === 'teslim'}
                            >
                                <span className="vd-stat-n">{stats.teslim}</span>
                                <span className="vd-stat-l">Teslim kaydı oluşmuş</span>
                            </button>
                        </div>
                    </header>

                    <div className="vd-toolbar">
                        <div className="vd-search-wrap">
                            <Search size={18} className="vd-search-icon" />
                            <input
                                type="search"
                                placeholder="Firma, teslimat ID veya şasi ara…"
                                className="vd-search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                aria-label="Araç kayıtlarında ara"
                            />
                        </div>
                    </div>

                    {err ? (
                        <div className="vd-error card" role="alert" style={{ padding: 16, marginBottom: 20 }}>
                            {err}
                        </div>
                    ) : null}

                    {loading && rows.length === 0 ? (
                        <OzunluLoading variant="inline" />
                    ) : filtered.length === 0 ? (
                        <div className="vd-empty card">
                            <CarFront size={40} strokeWidth={1.25} opacity={0.35} />
                            {sortedRows.length === 0 ? (
                                <>
                                    <p style={{ marginTop: 12, fontWeight: 750, fontSize: '1.05rem' }}>Henüz kayıt yok</p>
                                    <p style={{ marginTop: 6, color: 'var(--muted)', fontSize: 14 }}>
                                        Teklif Takip ingest çalıştığında araç giriş ve teslim olayları bu alanda görünecek.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p style={{ marginTop: 12, fontWeight: 750, fontSize: '1.05rem' }}>Kayıt bulunamadı</p>
                                    <p style={{ marginTop: 6, color: 'var(--muted)', fontSize: 14 }}>
                                        Arama metnini veya üstteki özet kartlarından seçili filtreyi değiştirin.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="vd-grid-cards">
                            {filtered.map((r) => (
                                <VehicleCard
                                    key={r.sourceDeliveryId}
                                    row={r}
                                    deleting={deleteBusyKey === r.sourceDeliveryId}
                                    onDelete={() => handleDeleteRow(r)}
                                    highlighted={Number.isFinite(focusEventId) && r.id === focusEventId}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {logsOpen ? (
                    <div
                        className="vd-modal-backdrop"
                        role="presentation"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget) setLogsOpen(false);
                        }}
                    >
                        <div className="vd-modal" role="dialog" aria-labelledby="vd-log-title">
                            <div className="vd-modal-head">
                                <h2 id="vd-log-title" className="vd-modal-title">
                                    <ScrollText size={22} aria-hidden /> Silme kayıtları
                                </h2>
                                <button type="button" className="vd-modal-x" onClick={() => setLogsOpen(false)} aria-label="Kapat">
                                    <X size={22} />
                                </button>
                            </div>
                            <p className="vd-modal-hint">İmalat Takip içinde araç kartını silen kullanıcı ve zaman bilgisi.</p>
                            {logsLoading ? (
                                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>
                                    Yükleniyor…
                                </div>
                            ) : logItems.length === 0 ? (
                                <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>
                                    Henüz silme kaydı yok.
                                </div>
                            ) : (
                                <ul className="vd-log-list">
                                    {logItems.map((row) => {
                                        const det = deletionLogDetails(row.details);
                                        return (
                                            <li key={row.id} className="vd-log-item">
                                                <div className="vd-log-meta">
                                                    <span className="vd-log-user">{row.username ?? '—'}</span>
                                                    <time className="vd-log-time" dateTime={row.createdAt}>
                                                        {fmtDt(row.createdAt)}
                                                    </time>
                                                </div>
                                                <div className="vd-log-body">
                                                    {det?.sourceDeliveryId ? (
                                                        <span className="vd-log-chip">ID: {det.sourceDeliveryId}</span>
                                                    ) : null}
                                                    {det?.companyName ? (
                                                        <span className="vd-log-chip">{det.companyName}</span>
                                                    ) : null}
                                                    {det?.deletedCount != null ? (
                                                        <span className="vd-log-chip muted">{det.deletedCount} olay silindi</span>
                                                    ) : null}
                                                </div>
                                                {row.summary ? <div className="vd-log-sum">{row.summary}</div> : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                ) : null}

                <style jsx>{`
                    .vd-page {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 24px clamp(16px, 3vw, 28px);
                    }
                    .vd-hero {
                        position: relative;
                        padding: clamp(22px, 4vw, 34px);
                        border-radius: 24px;
                        border: 1px solid rgba(2, 35, 71, 0.1);
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(241, 245, 249, 0.9));
                        margin-bottom: 24px;
                        overflow: hidden;
                    }
                    .vd-hero-glow {
                        position: absolute;
                        width: 480px;
                        height: 480px;
                        right: -120px;
                        top: -200px;
                        background: radial-gradient(circle, rgba(99, 102, 241, 0.18), transparent 65%);
                        pointer-events: none;
                    }
                    .vd-hero-row {
                        position: relative;
                        display: flex;
                        flex-wrap: wrap;
                        align-items: flex-start;
                        justify-content: space-between;
                        gap: 20px;
                    }
                    .vd-hero-eyebrow {
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.12em;
                        color: var(--primary);
                        margin-bottom: 8px;
                    }
                    :global(.vd-pulse) {
                        animation: vdPulseDot 2s ease-in-out infinite;
                    }
                    @keyframes vdPulseDot {
                        0%,
                        100% {
                            opacity: 1;
                            transform: scale(1);
                        }
                        50% {
                            opacity: 0.65;
                            transform: scale(0.94);
                        }
                    }
                    .vd-hero-title {
                        font-size: clamp(1.55rem, 3.5vw, 2rem);
                        font-weight: 900;
                        letter-spacing: -0.03em;
                        color: var(--foreground);
                        line-height: 1.15;
                    }
                    .vd-hero-sub {
                        margin-top: 10px;
                        max-width: 520px;
                        font-size: 14px;
                        color: var(--muted);
                        line-height: 1.55;
                        font-weight: 600;
                    }
                    .vd-hero-actions {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-end;
                        gap: 10px;
                    }
                    .vd-btn {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        padding: 12px 18px;
                        border-radius: 14px;
                        font-weight: 800;
                        font-size: 14px;
                        cursor: pointer;
                        border: 1px solid rgba(2, 35, 71, 0.12);
                        background: rgba(255, 255, 255, 0.9);
                        color: var(--foreground);
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                    }
                    .vd-btn:hover:not(:disabled) {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 22px -10px rgba(2, 35, 71, 0.3);
                    }
                    .vd-btn:disabled {
                        opacity: 0.55;
                        cursor: not-allowed;
                    }
                    .vd-log-btn {
                        border-color: rgba(2, 35, 71, 0.22);
                        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(238, 242, 255, 0.96));
                    }
                    .vd-live-badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        padding: 8px 14px;
                        border-radius: 999px;
                        font-size: 12px;
                        font-weight: 700;
                        color: var(--muted);
                        border: 1px solid rgba(2, 35, 71, 0.08);
                        background: rgba(255, 255, 255, 0.75);
                    }
                    .vd-live-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background: var(--success);
                        box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
                        animation: vdLiveGlow 2s ease-in-out infinite;
                    }
                    @keyframes vdLiveGlow {
                        0% {
                            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.55);
                        }
                        70% {
                            box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
                        }
                        100% {
                            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
                        }
                    }
                    .vd-spin {
                        animation: vdspin 0.85s linear infinite;
                    }
                    @keyframes vdspin {
                        from {
                            transform: rotate(0);
                        }
                        to {
                            transform: rotate(360deg);
                        }
                    }
                    .vd-stat-strip {
                        position: relative;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 12px;
                        margin-top: 22px;
                    }
                    button.vd-stat {
                        display: block;
                        font: inherit;
                        text-align: left;
                        cursor: pointer;
                        color: inherit;
                        appearance: none;
                        -webkit-appearance: none;
                    }
                    button.vd-stat:focus-visible {
                        outline: 2px solid rgba(99, 102, 241, 0.55);
                        outline-offset: 2px;
                    }
                    .vd-stat {
                        flex: 1;
                        min-width: 140px;
                        padding: 14px 16px;
                        border-radius: 16px;
                        border: 1px solid rgba(2, 35, 71, 0.08);
                        background: rgba(255, 255, 255, 0.65);
                        transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
                    }
                    .vd-stat:hover {
                        transform: translateY(-2px);
                        border-color: rgba(99, 102, 241, 0.35);
                    }
                    .vd-stat--active {
                        border-color: rgba(99, 102, 241, 0.5);
                        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.14);
                        background: rgba(255, 255, 255, 0.92);
                    }
                    .vd-stat-n {
                        display: block;
                        font-size: 1.65rem;
                        font-weight: 900;
                        letter-spacing: -0.03em;
                        color: var(--primary);
                    }
                    .vd-stat-l {
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        color: var(--muted);
                        margin-top: 4px;
                    }
                    .vd-stat-warn .vd-stat-n {
                        color: var(--warning);
                    }
                    .vd-stat-ok .vd-stat-n {
                        color: var(--success);
                    }
                    .vd-toolbar {
                        margin-bottom: 20px;
                    }
                    .vd-search-wrap {
                        position: relative;
                        max-width: 440px;
                    }
                    .vd-search {
                        width: 100%;
                        padding: 14px 16px 14px 46px;
                        border-radius: 16px;
                        border: 1px solid rgba(2, 35, 71, 0.1);
                        font-size: 14px;
                        font-weight: 600;
                        background: rgba(255, 255, 255, 0.92);
                        outline: none;
                        transition: box-shadow 0.2s ease, border-color 0.2s ease;
                    }
                    .vd-search:focus {
                        border-color: rgba(99, 102, 241, 0.45);
                        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
                    }
                    .vd-grid-cards {
                        display: grid;
                        gap: 20px;
                        grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
                    }
                    :global(.vd-search-icon) {
                        position: absolute;
                        left: 16px;
                        top: 50%;
                        translate: 0 -50%;
                        color: var(--muted);
                        pointer-events: none;
                    }
                    .vd-empty {
                        padding: 48px 28px;
                        text-align: center;
                        border-radius: 20px;
                        border: 1px dashed rgba(2, 35, 71, 0.15);
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.85));
                    }
                    .vd-modal-backdrop {
                        position: fixed;
                        inset: 0;
                        z-index: 100;
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        padding: 20px;
                        background: rgba(15, 23, 42, 0.4);
                        backdrop-filter: blur(5px);
                        overflow-y: auto;
                    }
                    .vd-modal {
                        width: 100%;
                        max-width: 520px;
                        margin: clamp(24px, 6vh, 48px) auto;
                        border-radius: 22px;
                        border: 1px solid rgba(2, 35, 71, 0.12);
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.96));
                        box-shadow: 0 28px 64px -20px rgba(2, 35, 71, 0.4);
                        max-height: min(78vh, 620px);
                        display: flex;
                        flex-direction: column;
                        animation: vdModalIn 0.35s cubic-bezier(0.22, 1, 0.36, 1);
                    }
                    @keyframes vdModalIn {
                        from {
                            opacity: 0;
                            transform: translateY(16px) scale(0.98);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }
                    .vd-modal-head {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        padding: 18px 20px 12px;
                        border-bottom: 1px solid rgba(2, 35, 71, 0.08);
                    }
                    .vd-modal-title {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 1.1rem;
                        font-weight: 900;
                        color: var(--foreground);
                        margin: 0;
                    }
                    .vd-modal-x {
                        flex-shrink: 0;
                        width: 40px;
                        height: 40px;
                        border: none;
                        border-radius: 12px;
                        background: rgba(248, 250, 252, 0.9);
                        color: var(--muted);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.2s ease, color 0.2s ease;
                    }
                    .vd-modal-x:hover {
                        background: rgba(241, 245, 249, 1);
                        color: var(--foreground);
                    }
                    .vd-modal-hint {
                        padding: 0 20px 12px;
                        margin: 0;
                        font-size: 13px;
                        color: var(--muted);
                        font-weight: 600;
                        line-height: 1.45;
                    }
                    .vd-log-list {
                        list-style: none;
                        margin: 0;
                        padding: 8px 16px 20px;
                        overflow-y: auto;
                        flex: 1;
                    }
                    .vd-log-item {
                        padding: 14px;
                        margin-bottom: 10px;
                        border-radius: 14px;
                        border: 1px solid rgba(2, 35, 71, 0.08);
                        background: rgba(255, 255, 255, 0.75);
                    }
                    .vd-log-meta {
                        display: flex;
                        flex-wrap: wrap;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        margin-bottom: 8px;
                    }
                    .vd-log-user {
                        font-weight: 800;
                        font-size: 14px;
                        color: var(--primary);
                    }
                    .vd-log-time {
                        font-size: 12px;
                        font-weight: 650;
                        color: var(--muted);
                    }
                    .vd-log-body {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                    }
                    .vd-log-chip {
                        display: inline-block;
                        padding: 4px 10px;
                        border-radius: 8px;
                        font-size: 11px;
                        font-weight: 750;
                        background: rgba(2, 35, 71, 0.06);
                        color: var(--foreground);
                    }
                    .vd-log-chip.muted {
                        background: rgba(100, 116, 139, 0.12);
                        color: var(--muted);
                    }
                    .vd-log-sum {
                        margin-top: 8px;
                        font-size: 12px;
                        color: var(--muted);
                        font-weight: 600;
                        line-height: 1.4;
                    }
                `}</style>
            </div>
            </main>
        </>
    );
}

export default function AracBilgileriPage() {
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
                <AracBilgileriContent />
            </Suspense>
        </AuthGuard>
    );
}
