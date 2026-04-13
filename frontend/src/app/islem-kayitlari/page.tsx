'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import { getAuditLogs, type AuditLogRow } from '@/lib/api';
import { History, Loader2, RefreshCcw } from 'lucide-react';

function renderChangeFields(details: unknown) {
    if (!details || typeof details !== 'object' || !('changes' in details)) return null;
    const ch = (details as { changes: { field: string }[] }).changes;
    if (!Array.isArray(ch)) return null;
    return (
        <div className="mt-2 text-[11px] font-mono text-slate-500">
            {ch.slice(0, 8).map(c => c.field).join(', ')}
            {ch.length > 8 ? '…' : ''}
        </div>
    );
}

function AuditMobileCard({ r }: { r: AuditLogRow }) {
    const who = r.user?.fullName || r.username || (r.userId ? `#${r.userId}` : '—');
    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs text-slate-500 mb-2">{new Date(r.createdAt).toLocaleString('tr-TR')}</div>
            <div className="font-semibold text-slate-900 text-sm mb-1">{who}</div>
            <div className="flex flex-wrap gap-2 text-xs mb-2">
                <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">{r.action}</span>
                <span className="text-slate-600">
                    {r.productType} #{r.productId}
                </span>
            </div>
            <p className="text-sm text-slate-600 leading-snug">{r.summary || '—'}</p>
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
            <main className="main-content analytics-page">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col sm:flex-row w-full justify-between items-stretch sm:items-start gap-4">
                        <div className="min-w-0 flex-1">
                            <h1 className="header-title">
                                <History size={32} className="inline mr-2 sm:mr-3 align-middle shrink-0" />
                                İşlem kayıtları
                            </h1>
                            <p className="header-subtitle max-w-3xl">
                                Damper, dorse ve şasi güncellemelerinde kimin hangi alanları değiştirdiğine dair ek kayıt
                                (ürün satırları silinmez; bu liste yalnızca denetim içindir).
                            </p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary analytics-touch-target w-full sm:w-auto justify-center shrink-0"
                            onClick={load}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                            Yenile
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="card" style={{ padding: '16px', color: '#b91c1c', marginBottom: '16px' }}>
                        {error}
                    </div>
                )}

                {loading && rows.length === 0 ? (
                    <div className="card py-8">
                        <OzunluLoading variant="compact" />
                    </div>
                ) : (
                    <>
                        <div className="md:hidden space-y-3 pb-2">
                            {rows.map(r => (
                                <AuditMobileCard key={r.id} r={r} />
                            ))}
                        </div>
                        <div className="card hidden md:block p-0 overflow-x-auto">
                            <table className="w-full border-collapse text-xs lg:text-[13px] min-w-[680px]">
                                <thead>
                                    <tr className="bg-[rgba(2,35,71,0.06)] text-left">
                                        <th className="p-2 lg:p-3 xl:px-4 whitespace-nowrap">Zaman</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Kullanıcı</th>
                                        <th className="p-2 lg:p-3 xl:px-4">Tür</th>
                                        <th className="p-2 lg:p-3 xl:px-4 whitespace-nowrap">Ürün</th>
                                        <th className="p-2 lg:p-3 xl:px-4 min-w-[200px]">Özet</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(r => (
                                        <tr key={r.id} className="border-t border-slate-200 align-top">
                                            <td className="p-2 lg:p-3 xl:px-4 whitespace-nowrap text-slate-600">
                                                {new Date(r.createdAt).toLocaleString('tr-TR')}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4">
                                                {r.user?.fullName || r.username || (r.userId ? `#${r.userId}` : '—')}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4">{r.action}</td>
                                            <td className="p-2 lg:p-3 xl:px-4 whitespace-nowrap">
                                                {r.productType} #{r.productId}
                                            </td>
                                            <td className="p-2 lg:p-3 xl:px-4 text-slate-600">
                                                {r.summary || '—'}
                                                {renderChangeFields(r.details)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 mt-4 sm:mt-5">
                    <span className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
                        Toplam {total} kayıt (sayfa başına {limit})
                    </span>
                    <div className="flex gap-2 justify-center sm:justify-end">
                        <button
                            type="button"
                            className="btn btn-secondary flex-1 sm:flex-none analytics-touch-target min-h-11 px-5"
                            disabled={skip === 0 || loading}
                            onClick={() => setSkip(s => Math.max(0, s - limit))}
                        >
                            Önceki
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary flex-1 sm:flex-none analytics-touch-target min-h-11 px-5"
                            disabled={skip + limit >= total || loading}
                            onClick={() => setSkip(s => s + limit)}
                        >
                            Sonraki
                        </button>
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
