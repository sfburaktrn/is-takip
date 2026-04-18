'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import AuthGuard from '@/components/AuthGuard';
import OzunluLoading from '@/components/OzunluLoading';
import {
    createTestNotification,
    getNotifications,
    getUnreadNotificationBreakdown,
    isProposalNotification,
    markAllNotificationsRead,
    markNotificationRead,
    notificationItemHref,
    syncProposalNotifications,
    type NotificationItem
} from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Bell, Briefcase, CheckCheck, Factory, LayoutGrid, Loader2, RefreshCcw, Zap } from 'lucide-react';

type Category = 'all' | 'NEW_PRODUCT' | 'PROPOSAL_TEKLIF';

function dayKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayLabel(d: Date, today: Date) {
    if (dayKey(d) === dayKey(today)) return 'Bugün';
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    if (dayKey(d) === dayKey(y)) return 'Dün';
    return d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function productTypeLabel(t: string) {
    if (t === 'DAMPER') return 'Damper';
    if (t === 'DORSE') return 'Dorse';
    if (t === 'SASI') return 'Şasi';
    if (t === 'PROPOSAL') return 'Teklif özeti';
    return t;
}

export default function BildirimlerPage() {
    const { isAdmin } = useAuth();
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [total, setTotal] = useState(0);
    const [skip, setSkip] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [markingAll, setMarkingAll] = useState(false);
    const [creatingTest, setCreatingTest] = useState(false);
    const [category, setCategory] = useState<Category>('all');
    const [breakdown, setBreakdown] = useState({ product: 0, proposal: 0, total: 0 });
    const limit = 40;

    const refreshBreakdown = useCallback(() => {
        getUnreadNotificationBreakdown()
            .then(setBreakdown)
            .catch(() => setBreakdown({ product: 0, proposal: 0, total: 0 }));
    }, []);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await getNotifications({
                limit,
                skip,
                unreadOnly,
                kind: category === 'all' ? undefined : category
            });
            setItems(res.items);
            setTotal(res.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Yüklenemedi');
            setItems([]);
        } finally {
            setLoading(false);
            refreshBreakdown();
        }
    }, [skip, unreadOnly, category, refreshBreakdown]);

    useEffect(() => {
        load();
    }, [load]);

    const grouped = useMemo(() => {
        const today = new Date();
        const map = new Map<string, NotificationItem[]>();
        for (const n of items) {
            const d = new Date(n.createdAt);
            const k = dayKey(d);
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(n);
        }
        const keys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
        return keys.map((k) => {
            const rows = map.get(k)!;
            const first = rows[0];
            return {
                key: k,
                label: dayLabel(new Date(first.createdAt), today),
                rows
            };
        });
    }, [items]);

    const handleOpen = async (n: NotificationItem) => {
        if (!n.readAt) {
            try {
                await markNotificationRead(n.id);
                setItems((prev) =>
                    prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
                );
                refreshBreakdown();
            } catch {
                /* yine de hedefe git */
            }
        }
    };

    const handleMarkAll = async () => {
        try {
            setMarkingAll(true);
            await markAllNotificationsRead();
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'İşlem başarısız');
        } finally {
            setMarkingAll(false);
        }
    };

    const categoryTabs: { id: Category; label: string; icon: typeof LayoutGrid; hint: string }[] = [
        { id: 'all', label: 'Tümü', icon: LayoutGrid, hint: 'Üretim ve teklif' },
        { id: 'NEW_PRODUCT', label: 'Üretim', icon: Factory, hint: 'Damper · Dorse · Şasi' },
        { id: 'PROPOSAL_TEKLIF', label: 'Mevcut işler', icon: Briefcase, hint: 'Teklif takip' }
    ];

    return (
        <AuthGuard>
            <Sidebar />
            <main className="main-content analytics-page notify-page">
                <header className="notify-page-header">
                    <div className="notify-page-hero">
                        <div className="notify-page-hero-text">
                            <h1 className="header-title notify-page-title">
                                <span className="notify-page-title-icon" aria-hidden>
                                    <Bell size={30} strokeWidth={2} />
                                </span>
                                Bildirim merkezi
                            </h1>
                            <p className="header-subtitle notify-page-sub">
                                Yeni ürün kayıtları ile teklif takipten gelen onaylı teklif özetleri ayrı kategorilerde
                                listelenir. Okundu bilgisi size özeldir; bildirim geçmişi veritabanında saklanır.
                            </p>
                        </div>
                        <div className="notify-page-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                    setUnreadOnly((v) => !v);
                                    setSkip(0);
                                }}
                            >
                                {unreadOnly ? 'Tümünü göster' : 'Yalnız okunmamış'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleMarkAll}
                                disabled={markingAll || total === 0}
                            >
                                {markingAll ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
                                Tümünü okundu say
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={async () => {
                                    try {
                                        await syncProposalNotifications();
                                    } catch {}
                                    await load();
                                }}
                                disabled={loading}
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                                Yenile
                            </button>
                            {isAdmin && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={async () => {
                                        try {
                                            setCreatingTest(true);
                                            await createTestNotification('PROPOSAL_TEKLIF');
                                            await load();
                                        } catch (e) {
                                            setError(e instanceof Error ? e.message : 'Test bildirimi oluşturulamadı');
                                        } finally {
                                            setCreatingTest(false);
                                        }
                                    }}
                                    disabled={creatingTest}
                                    title="Bildirim sisteminin çalıştığını hızlıca doğrulamak için"
                                >
                                    {creatingTest ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                    Test bildirim oluştur
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="notify-summary-grid">
                        <div className="notify-summary-card notify-summary-total">
                            <div className="notify-summary-label">Okunmamış (toplam)</div>
                            <div className="notify-summary-value">{breakdown.total}</div>
                            <div className="notify-summary-hint">Zil rozeti bu sayıyı gösterir</div>
                        </div>
                        <div className="notify-summary-card notify-summary-product">
                            <div className="notify-summary-label">
                                <Factory size={16} className="inline mr-1 align-text-bottom" aria-hidden />
                                Üretim
                            </div>
                            <div className="notify-summary-value">{breakdown.product}</div>
                            <div className="notify-summary-hint">Yeni damper / dorse / şasi</div>
                        </div>
                        <div className="notify-summary-card notify-summary-proposal">
                            <div className="notify-summary-label">
                                <Briefcase size={16} className="inline mr-1 align-text-bottom" aria-hidden />
                                Mevcut işler
                            </div>
                            <div className="notify-summary-value">{breakdown.proposal}</div>
                            <div className="notify-summary-hint">Teklif takip kuyruğu</div>
                        </div>
                    </div>

                    <div className="notify-category-bar" role="tablist" aria-label="Bildirim kategorisi">
                        {categoryTabs.map((t) => {
                            const Icon = t.icon;
                            const active = category === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    className={`notify-category-tab ${active ? 'is-active' : ''}`}
                                    onClick={() => {
                                        setCategory(t.id);
                                        setSkip(0);
                                    }}
                                >
                                    <Icon size={17} strokeWidth={2} aria-hidden />
                                    <span className="notify-category-tab-label">{t.label}</span>
                                    <span className="notify-category-tab-hint">{t.hint}</span>
                                </button>
                            );
                        })}
                    </div>
                </header>

                {error && <div className="notify-error-banner">{error}</div>}

                {loading && items.length === 0 ? (
                    <OzunluLoading />
                ) : items.length === 0 ? (
                    <div className="notify-empty-card">
                        <Bell size={40} strokeWidth={1.5} className="notify-empty-icon" aria-hidden />
                        <p className="notify-empty-title">
                            {unreadOnly ? 'Okunmamış bildirim yok' : 'Bu görünümde kayıt yok'}
                        </p>
                        <p className="notify-empty-text">
                            {category === 'PROPOSAL_TEKLIF'
                                ? 'Teklif Takip üzerinden yeni onaylı teklif geldiğinde burada listelenir.'
                                : category === 'NEW_PRODUCT'
                                  ? 'Yeni ürün eklendiğinde bildirim oluşur.'
                                  : 'Henüz bildirim yok veya filtre sonucu boş.'}
                        </p>
                    </div>
                ) : (
                    <div className="notify-timeline">
                        {grouped.map((g) => (
                            <section key={g.key} className="notify-day-section">
                                <h2 className="notify-day-heading">{g.label}</h2>
                                <ul className="notify-day-list">
                                    {g.rows.map((n) => {
                                        const proposal = isProposalNotification(n);
                                        return (
                                            <li key={n.id}>
                                                <Link
                                                    href={notificationItemHref(n)}
                                                    onClick={() => handleOpen(n)}
                                                    className={`notify-item-card ${n.readAt ? 'is-read' : 'is-unread'} ${proposal ? 'is-proposal' : 'is-product'}`}
                                                >
                                                    <div className="notify-item-accent" aria-hidden />
                                                    <div className="notify-item-body">
                                                        <div className="notify-item-top">
                                                            <span className={`notify-item-pill ${proposal ? 'pill-proposal' : 'pill-product'}`}>
                                                                {proposal ? 'Mevcut işler' : 'Üretim'}
                                                            </span>
                                                            {!n.readAt && <span className="notify-item-new">Yeni</span>}
                                                        </div>
                                                        <div className="notify-item-title">{n.title}</div>
                                                        {n.body && <p className="notify-item-desc">{n.body}</p>}
                                                        <div className="notify-item-meta">
                                                            <span className="notify-item-tag">
                                                                {productTypeLabel(n.productType)} #{n.productId}
                                                            </span>
                                                            <span className="notify-item-dot">·</span>
                                                            <time dateTime={n.createdAt}>
                                                                {new Date(n.createdAt).toLocaleString('tr-TR')}
                                                            </time>
                                                            {n.actor && (
                                                                <>
                                                                    <span className="notify-item-dot">·</span>
                                                                    <span>{n.actor.fullName || n.actor.username}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}

                {total > limit && (
                    <div className="notify-pagination">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={skip === 0 || loading}
                            onClick={() => setSkip((s) => Math.max(0, s - limit))}
                        >
                            Önceki
                        </button>
                        <span className="notify-pagination-info">
                            {skip + 1}–{Math.min(skip + items.length, total)} / {total}
                        </span>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={skip + limit >= total || loading}
                            onClick={() => setSkip((s) => s + limit)}
                        >
                            Sonraki
                        </button>
                    </div>
                )}
            </main>
        </AuthGuard>
    );
}
