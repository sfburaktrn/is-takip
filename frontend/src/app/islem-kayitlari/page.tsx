'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { getAuditLogs, type AuditLogRow } from '@/lib/api';
import { History, Loader2, RefreshCcw, AlertTriangle } from 'lucide-react';

function renderChangeFields(details: unknown) {
    if (!details || typeof details !== 'object' || !('changes' in details)) return null;
    const ch = (details as { changes: { field: string }[] }).changes;
    if (!Array.isArray(ch)) return null;
    return (
        <div className="apple-audit-fields">
            {ch.slice(0, 8).map(c => c.field).join(', ')}
            {ch.length > 8 ? '…' : ''}
        </div>
    );
}

function AuditMobileCard({ r }: { r: AuditLogRow }) {
    const who = r.user?.fullName || r.username || (r.userId ? `#${r.userId}` : '—');
    return (
        <article className="apple-audit-card">
            <div className="apple-audit-card__time">{new Date(r.createdAt).toLocaleString('tr-TR')}</div>
            <div className="apple-audit-card__who">{who}</div>
            <div className="apple-audit-meta">
                <span className="apple-audit-action-pill">{r.action}</span>
                <span className="apple-audit-product">
                    {r.productType} #{r.productId}
                </span>
            </div>
            <p className="apple-audit-summary">{r.summary || '—'}</p>
            {renderChangeFields(r.details)}
        </article>
    );
}

export default function IslemKayitlariPage() {
    const [rows, setRows] = useState<AuditLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [skip, setSkip] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const limit = 40;

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getAuditLogs({ limit, skip });
            setRows(res.rows);
            setTotal(res.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [skip]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <AuthGuard requireAdmin>
            <Sidebar />
            <main className="main-content apple-app-page analytics-page">
                <div className="apple-canvas">
                    <header className="header header--stack apple-page-hero">
                        <div className="flex flex-col sm:flex-row w-full justify-between items-stretch sm:items-start gap-4">
                            <div className="min-w-0 flex-1">
                                <h1 className="header-title">
                                    <History size={28} className="page-title-leading-icon shrink-0" />
                                    İşlem kayıtları
                                </h1>
                                <p className="header-subtitle">
                                    Damper, dorse ve şasi güncellemelerinde kimin hangi alanları değiştirdiğine dair ek
                                    kayıt (ürün satırları silinmez; bu liste yalnızca denetim içindir).
                                </p>
                            </div>
                            <div className="header-toolbar w-full sm:w-auto">
                                <button
                                    type="button"
                                    className="btn btn-primary analytics-touch-target w-full sm:w-auto justify-center shrink-0"
                                    onClick={load}
                                >
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                                    Yenile
                                </button>
                            </div>
                        </div>
                    </header>

                    {error && (
                        <div className="apple-banner apple-banner--danger" role="alert">
                            <AlertTriangle size={20} />
                            {error}
                        </div>
                    )}

                    {loading && rows.length === 0 ? (
                        <div className="card card--p-lg">
                            <OzunluLoading variant="compact" />
                        </div>
                    ) : (
                        <>
                            <div className="md:hidden space-y-3 pb-2">
                                {rows.map(r => (
                                    <AuditMobileCard key={r.id} r={r} />
                                ))}
                            </div>
                            <div className="apple-table-scroll hidden md:block">
                                <div className="apple-audit-table-wrap">
                                    <table className="apple-data-table min-w-[680px] w-full">
                                        <thead>
                                            <tr className="apple-data-thead-row">
                                                <th className="apple-data-th whitespace-nowrap">Zaman</th>
                                                <th className="apple-data-th">Kullanıcı</th>
                                                <th className="apple-data-th">Tür</th>
                                                <th className="apple-data-th whitespace-nowrap">Ürün</th>
                                                <th className="apple-data-th min-w-[200px]">Özet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(r => (
                                                <tr key={r.id} className="apple-data-tr">
                                                    <td className="apple-data-td apple-data-td--muted">
                                                        {new Date(r.createdAt).toLocaleString('tr-TR')}
                                                    </td>
                                                    <td className="apple-data-td">
                                                        {r.user?.fullName || r.username || (r.userId ? `#${r.userId}` : '—')}
                                                    </td>
                                                    <td className="apple-data-td">
                                                        <span className="apple-audit-action-pill">{r.action}</span>
                                                    </td>
                                                    <td className="apple-data-td whitespace-nowrap">
                                                        {r.productType} #{r.productId}
                                                    </td>
                                                    <td className="apple-data-td apple-data-td--muted">
                                                        {r.summary || '—'}
                                                        {renderChangeFields(r.details)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="apple-audit-pagination">
                        <span className="apple-audit-pagination__meta">
                            Toplam {total} kayıt (sayfa başına {limit})
                        </span>
                        <div className="apple-audit-pagination__actions">
                            <button
                                type="button"
                                className="btn btn-secondary analytics-touch-target min-h-11 px-5 flex-1 sm:flex-none"
                                disabled={skip === 0 || loading}
                                onClick={() => setSkip(s => Math.max(0, s - limit))}
                            >
                                Önceki
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary analytics-touch-target min-h-11 px-5 flex-1 sm:flex-none"
                                disabled={skip + limit >= total || loading}
                                onClick={() => setSkip(s => s + limit)}
                            >
                                Sonraki
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
