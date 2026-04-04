'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import { getAuditLogs, type AuditLogRow } from '@/lib/api';
import { History, Loader2, RefreshCcw } from 'lucide-react';

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
            <main className="main-content">
                <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
                    <div className="flex flex-col sm:flex-row w-full justify-between items-start sm:items-center gap-3">
                        <div>
                            <h1 className="header-title">
                                <History size={32} style={{ display: 'inline', marginRight: '12px' }} />
                                İşlem kayıtları
                            </h1>
                            <p className="header-subtitle">
                                Damper, dorse ve şasi güncellemelerinde kimin hangi alanları değiştirdiğine dair ek kayıt
                                (ürün satırları silinmez; bu liste yalnızca denetim içindir).
                            </p>
                        </div>
                        <button type="button" className="btn btn-primary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                <div className="card" style={{ padding: '0', overflow: 'auto' }}>
                    {loading && rows.length === 0 ? (
                        <div style={{ padding: '48px', textAlign: 'center' }}>
                            <Loader2 className="animate-spin" size={36} />
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '720px' }}>
                            <thead>
                                <tr style={{ background: 'rgba(2,35,71,0.06)', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px' }}>Zaman</th>
                                    <th style={{ padding: '12px 16px' }}>Kullanıcı</th>
                                    <th style={{ padding: '12px 16px' }}>Tür</th>
                                    <th style={{ padding: '12px 16px' }}>Ürün</th>
                                    <th style={{ padding: '12px 16px' }}>Özet</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}>
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                            {new Date(r.createdAt).toLocaleString('tr-TR')}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {r.user?.fullName || r.username || (r.userId ? `#${r.userId}` : '—')}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>{r.action}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {r.productType} #{r.productId}
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                                            {r.summary || '—'}
                                            {(() => {
                                                const d = r.details;
                                                if (!d || typeof d !== 'object' || !('changes' in d)) return null;
                                                const ch = (d as { changes: { field: string }[] }).changes;
                                                if (!Array.isArray(ch)) return null;
                                                return (
                                                    <div style={{ marginTop: '6px', fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                                                        {ch.slice(0, 6).map(c => c.field).join(', ')}
                                                        {ch.length > 6 ? '…' : ''}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        Toplam {total} kayıt (sayfa başına {limit})
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={skip === 0 || loading}
                            onClick={() => setSkip(s => Math.max(0, s - limit))}
                        >
                            Önceki
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
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
