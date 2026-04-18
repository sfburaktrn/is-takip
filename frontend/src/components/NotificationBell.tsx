'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
    getNotifications,
    getUnreadNotificationCount,
    isProposalNotification,
    markAllNotificationsRead,
    markNotificationRead,
    notificationItemHref,
    type NotificationItem
} from '@/lib/api';
import { getNotificationSoundEnabled, setNotificationSoundEnabled } from '@/lib/notificationPrefs';
import { playNotificationChime, unlockNotificationAudio } from '@/lib/notificationSound';
import { Bell, Briefcase, ChevronRight, Factory, Loader2, Volume2, VolumeX, X } from 'lucide-react';

const POLL_MS = 45000;
const PANEL_LIMIT = 24;

function productTypeLabel(t: string) {
    if (t === 'DAMPER') return 'Damper';
    if (t === 'DORSE') return 'Dorse';
    if (t === 'SASI') return 'Şasi';
    if (t === 'PROPOSAL') return 'Teklif';
    return t;
}

function NotificationListBlock({
    title,
    subtitle,
    icon: Icon,
    items,
    emptyHint,
    onNavigate}: {
    title: string;
    subtitle: string;
    icon: typeof Factory;
    items: NotificationItem[];
    emptyHint: string;
    onNavigate: (n: NotificationItem) => void;
}) {
    if (items.length === 0) {
        return (
            <div className="notification-panel-section">
                <div className="notification-panel-section-head">
                    <Icon size={16} strokeWidth={2} aria-hidden />
                    <div>
                        <div className="notification-panel-section-title">{title}</div>
                        <div className="notification-panel-section-sub">{subtitle}</div>
                    </div>
                </div>
                <p className="notification-panel-empty">{emptyHint}</p>
            </div>
        );
    }
    return (
        <div className="notification-panel-section">
            <div className="notification-panel-section-head">
                <Icon size={16} strokeWidth={2} aria-hidden />
                <div>
                    <div className="notification-panel-section-title">{title}</div>
                    <div className="notification-panel-section-sub">{subtitle}</div>
                </div>
                <span className="notification-panel-count">{items.length}</span>
            </div>
            <ul className="notification-panel-list">
                {items.map((n) => (
                    <li key={n.id} className="notification-panel-li">
                        <Link
                            href={notificationItemHref(n)}
                            onClick={() => onNavigate(n)}
                            className={`notification-panel-link ${n.readAt ? 'is-read' : 'is-unread'}`}
                        >
                            <div className="notification-panel-link-title">{n.title}</div>
                            {n.body && <div className="notification-panel-link-body">{n.body}</div>}
                            <div className="notification-panel-link-meta">
                                <span className="notification-panel-tag">
                                    {productTypeLabel(n.productType)} #{n.productId}
                                </span>
                                <span>{new Date(n.createdAt).toLocaleString('tr-TR')}</span>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function NotificationBell() {
    const { user, isLoading } = useAuth();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [unread, setUnread] = useState(0);
    const [items, setItems] = useState<NotificationItem[]>([]);
    const [panelLoading, setPanelLoading] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const [bump, setBump] = useState(false);
    const prevUnreadRef = useRef<number | null>(null);
    const [welcomeOpen, setWelcomeOpen] = useState(false);
    const [welcomeCount, setWelcomeCount] = useState(0);
    const [welcomeRecentCount, setWelcomeRecentCount] = useState(0);
    const [welcomePopupHours, setWelcomePopupHours] = useState(72);
    const [welcomeSound, setWelcomeSound] = useState(false);
    const [soundOn, setSoundOn] = useState(false);

    const hidden = isLoading || !user || pathname === '/login';

    useEffect(() => {
        setSoundOn(getNotificationSoundEnabled());
    }, [user]);

    const refreshUnread = useCallback(async () => {
        if (!user) return 0;
        try {
            const d = await getUnreadNotificationCount();
            setUnread(d.count);
            return d.count;
        } catch {
            setUnread(0);
            return 0;
        }
    }, [user]);

    useEffect(() => {
        if (!user) {
            setUnread(0);
            prevUnreadRef.current = null;
            return;
        }
        void refreshUnread();
        const id = setInterval(() => {
            void refreshUnread();
        }, POLL_MS);
        return () => clearInterval(id);
    }, [user, pathname, refreshUnread]);

    useEffect(() => {
        if (!user) return;
        if (prevUnreadRef.current === null) {
            prevUnreadRef.current = unread;
            return;
        }
        if (unread > prevUnreadRef.current && getNotificationSoundEnabled()) {
            void unlockNotificationAudio().then(() => playNotificationChime());
        }
        if (unread > prevUnreadRef.current) {
            setBump(true);
            const t = window.setTimeout(() => setBump(false), 700);
            prevUnreadRef.current = unread;
            return () => clearTimeout(t);
        }
        prevUnreadRef.current = unread;
    }, [user, unread]);

    /** Oturum başına bir kez: okunmamış bildirim varsa (eski/yeni fark etmeksizin) açılış uyarısı. */
    useEffect(() => {
        if (!user || typeof window === 'undefined') return;
        if (pathname === '/login') return;
        const bootKey = `ozunlu-notify-boot-${user.id}`;
        if (sessionStorage.getItem(bootKey)) return;
        Promise.all([
            getUnreadNotificationCount(),
            getUnreadNotificationCount({ forPopup: true }).catch(() => ({ count: 0, windowHours: 72 }))
        ])
            .then(([total, recent]) => {
                try {
                    sessionStorage.setItem(bootKey, '1');
                } catch {
                    /* ignore */
                }
                if (total.count > 0) {
                    setWelcomeCount(total.count);
                    setWelcomeRecentCount(recent.count || 0);
                    if (typeof recent.windowHours === 'number') setWelcomePopupHours(recent.windowHours);
                    setWelcomeSound(getNotificationSoundEnabled());
                    setWelcomeOpen(true);
                }
            })
            .catch(() => {});
    }, [user, pathname]);

    useEffect(() => {
        if (!welcomeOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setWelcomeOpen(false);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [welcomeOpen]);

    const loadPanel = useCallback(async () => {
        if (!user) return;
        setPanelLoading(true);
        try {
            const res = await getNotifications({ limit: PANEL_LIMIT, skip: 0, unreadOnly: true });
            setItems(res.items);
        } catch {
            setItems([]);
        } finally {
            setPanelLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadPanel();
        }
    }, [open, user, loadPanel]);

    useEffect(() => {
        if (!open && !welcomeOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, welcomeOpen]);

    const onItemNavigate = async (n: NotificationItem) => {
        if (!n.readAt) {
            try {
                await markNotificationRead(n.id);
                setItems((prev) => prev.filter((x) => x.id !== n.id));
                void refreshUnread();
            } catch {
                /* sessiz */
            }
        }
        setOpen(false);
    };

    const productItems = items.filter((n) => !isProposalNotification(n));
    const proposalItems = items.filter((n) => isProposalNotification(n));

    const closeWelcome = () => setWelcomeOpen(false);

    const confirmWelcome = async () => {
        setNotificationSoundEnabled(welcomeSound);
        setSoundOn(welcomeSound);
        if (welcomeSound) {
            await unlockNotificationAudio();
            playNotificationChime();
        }
        try {
            await markAllNotificationsRead({ onlyPopupRecent: true });
        } catch {
            /* sessiz */
        }
        const c = await refreshUnread();
        prevUnreadRef.current = c;
        setWelcomeOpen(false);
    };

    if (hidden) return null;

    return (
        <div ref={rootRef} className="notification-bell-host">
            {welcomeOpen && (
                <div
                    className="notification-welcome-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="notify-welcome-title"
                    onClick={closeWelcome}
                >
                    <div className="notification-welcome-card" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="notification-welcome-close" onClick={closeWelcome} aria-label="Kapat">
                            <X size={18} />
                        </button>
                        <div className="notification-welcome-icon-wrap" aria-hidden>
                            <Bell size={28} strokeWidth={2} />
                        </div>
                        <h2 id="notify-welcome-title" className="notification-welcome-title">
                            Okunmamış bildiriminiz var
                        </h2>
                        <p className="notification-welcome-text">
                            Hesabınızda toplam <strong>{welcomeCount}</strong> okunmamış bildirim var; lütfen kontrol edin.
                            {welcomeRecentCount > 0 && welcomeRecentCount < welcomeCount ? (
                                <> Bunların <strong>{welcomeRecentCount}</strong> tanesi son {welcomePopupHours} saat içinde geldi.</>
                            ) : null}
                            {' '}Okundu bilgisi hesabınıza özeldir; aynı kayıt başka bir kullanıcı için ayrı okunmamış sayılır.
                            &quot;Tamam&quot; butonu son {welcomePopupHours} saatteki bildirimleri okundu işaretler; tamamını görmek için
                            bildirim merkezine gidin.
                        </p>
                        <label className="notification-welcome-check">
                            <input
                                type="checkbox"
                                checked={welcomeSound}
                                onChange={(e) => setWelcomeSound(e.target.checked)}
                            />
                            <span>Yeni bildirim geldiğinde kısa ses çal (tarayıcı izin verirse)</span>
                        </label>
                        <div className="notification-welcome-actions">
                            <button type="button" className="btn btn-secondary" onClick={confirmWelcome}>
                                Tamam
                            </button>
                            <Link href="/bildirimler" className="btn btn-primary" onClick={confirmWelcome}>
                                Bildirim merkezine git
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            <div className="notification-bell-toolbar">
                <button
                    type="button"
                    className={`notification-bell-trigger ${bump ? 'is-bump' : ''}`}
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-label={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
                >
                    <Bell size={20} strokeWidth={2} aria-hidden />
                    {unread > 0 && (
                        <span className={`notification-bell-badge ${bump ? 'is-pop' : ''}`} title="Okunmamış">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    className={`notification-sound-toggle ${soundOn ? 'is-on' : ''}`}
                    onClick={async () => {
                        const next = !getNotificationSoundEnabled();
                        setNotificationSoundEnabled(next);
                        setSoundOn(next);
                        if (next) {
                            await unlockNotificationAudio();
                            playNotificationChime();
                        }
                    }}
                    title={soundOn ? 'Sesli bildirim açık' : 'Sesli bildirim kapalı'}
                    aria-pressed={soundOn}
                    aria-label={soundOn ? 'Sesli bildirimi kapat' : 'Sesli bildirimi aç'}
                >
                    {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
            </div>

            {open && (
                <div
                    className="notification-bell-panel"
                    role="dialog"
                    aria-label="Bildirimler"
                >
                    <div className="notification-bell-panel-header">
                        <div>
                            <div className="notification-bell-panel-title">Bildirimler</div>
                            <div className="notification-bell-panel-sub">
                                Yalnızca okunmamışlar. Tüm geçmiş için &quot;Tümü&quot; ile bildirim merkezine gidin.
                            </div>
                        </div>
                        <Link
                            href="/bildirimler"
                            onClick={() => setOpen(false)}
                            className="notification-bell-panel-all"
                        >
                            Tümü
                            <ChevronRight size={14} aria-hidden />
                        </Link>
                    </div>

                    <div className="notification-bell-panel-body">
                        {panelLoading ? (
                            <div className="notification-bell-panel-loading">
                                <Loader2 size={22} className="animate-spin" aria-label="Yükleniyor" />
                            </div>
                        ) : (
                            <>
                                <NotificationListBlock
                                    title="Üretim"
                                    subtitle="Yeni damper, dorse, şasi"
                                    icon={Factory}
                                    items={productItems}
                                    emptyHint="Okunmamış üretim bildirimi yok."
                                    onNavigate={onItemNavigate}
                                />
                                <NotificationListBlock
                                    title="Mevcut işler"
                                    subtitle="Teklif takipten gelen onaylı teklifler"
                                    icon={Briefcase}
                                    items={proposalItems}
                                    emptyHint="Okunmamış teklif bildirimi yok."
                                    onNavigate={onItemNavigate}
                                />
                            </>
                        )}
                    </div>

                    <div className="notification-bell-panel-footer">
                        Okundu işaretlenen satırlar bu kutudan kalkar; tam liste yalnızca bildirim merkezinde.
                    </div>
                </div>
            )}
        </div>
    );
}
