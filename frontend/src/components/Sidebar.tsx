'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getSearch, type SearchResponse } from '@/lib/api';
import type { LucideIcon } from 'lucide-react';
import {
    Truck,
    ClipboardList,
    Building2,
    LineChart,
    Gauge,
    Briefcase,
    Settings,
    FileText,
    Menu,
    X,
    LogOut,
    Crown,
    User,
    Users,
    Search,
    History,
    Package,
    CarFront,
    ShieldAlert,
} from 'lucide-react';

function cn(...classes: (string | false | undefined | null)[]) {
    return classes.filter(Boolean).join(' ');
}

type SidebarNavItem = {
    key?: string;
    href: string;
    label: string;
    icon: LucideIcon;
};

function typeLabel(t: string) {
    if (t === 'DAMPER') return 'Damper';
    if (t === 'DORSE') return 'Dorse';
    if (t === 'SASI') return 'Şasi';
    return t;
}

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const { user, isAdmin, logout } = useAuth();
    const [searchQ, setSearchQ] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchRes, setSearchRes] = useState<SearchResponse | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchReqId = useRef(0);

    const trimmedSearchQ = searchQ.trim();
    const canSearch = Boolean(user && trimmedSearchQ.length >= 2);
    const displayRes = canSearch ? searchRes : null;
    const displayError = canSearch ? searchError : null;
    const displayLoading = canSearch && searchLoading;

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!canSearch) {
            return () => {
                if (searchTimer.current) clearTimeout(searchTimer.current);
            };
        }
        searchTimer.current = setTimeout(() => {
            const myId = ++searchReqId.current;
            setSearchLoading(true);
            setSearchError(null);
            setSearchRes(null);
            getSearch(trimmedSearchQ)
                .then(data => {
                    if (searchReqId.current !== myId) return;
                    setSearchRes(data);
                })
                .catch(() => {
                    if (searchReqId.current !== myId) return;
                    setSearchRes(null);
                    setSearchError('Arama yanıt vermedi. Backend (3001) çalışıyor mu ve giriş yaptınız mı?');
                })
                .finally(() => {
                    if (searchReqId.current !== myId) return;
                    setSearchLoading(false);
                });
        }, 320);
        return () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        };
    }, [canSearch, trimmedSearchQ, user]);

    const menuItems: SidebarNavItem[] = [
        { href: '/urun-listesi', label: 'Ürün Listesi', icon: Truck },
        { href: '/ozet', label: 'Özet Görünüm', icon: ClipboardList },
        { href: '/firma-ozeti', label: 'Firma Özeti', icon: Building2 },
        { href: '/analiz', label: 'Analiz', icon: LineChart },
        { href: '/verimlilik', label: 'Verimlilik', icon: Gauge },
        { href: '/kapasite', label: 'Bölüm kapasitesi', icon: Users },
        { key: 'mevcutIsler', href: '/mevcut-isler', label: 'Mevcut işler', icon: Briefcase },
        { key: 'aracBilgileri', href: '/arac-bilgileri', label: 'Araç bilgileri', icon: CarFront },
        { href: '/arac-hasar-kaydi', label: 'Araç hasar kaydı', icon: ShieldAlert },
        { href: '/stok-takip', label: 'Stok takip', icon: Package },
    ];

    const adminOnlyMenuItems = [
        { href: '/islem-kayitlari', label: 'İşlem kayıtları', icon: History },
        { href: '/ayarlar', label: 'Ayarlar', icon: Settings },
        { href: '/giris-loglari', label: 'Giriş Logları', icon: FileText },
    ];

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    return (
        <>
            <button
                className="mobile-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Menüyü aç veya kapat"
                type="button"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div
                className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
                onClick={() => setIsOpen(false)}
                role="presentation"
            />

            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="sidebar-brand__logo">
                        <Image
                            src="/logo.png"
                            alt="Özünlü Logo"
                            fill
                            style={{ objectFit: 'contain' }}
                            priority
                        />
                    </div>
                    <div className="sidebar-brand__tagline">İmalat Takip Sistemi</div>
                </div>

                {user && (
                    <div className="sidebar-search-block">
                        <div className="sidebar-search-inner">
                            <Search className="sidebar-search-icon" size={16} aria-hidden />
                            <input
                                type="search"
                                className="sidebar-search-input"
                                placeholder="İmalat no, müşteri…"
                                value={searchQ}
                                onChange={e => {
                                    setSearchQ(e.target.value);
                                    setSearchOpen(true);
                                }}
                                onFocus={() => setSearchOpen(true)}
                                aria-label="Kenar çubuğunda ara"
                            />
                        </div>
                        {searchOpen && canSearch && (
                            <div className="sidebar-search-panel">
                                {(() => {
                                    const all = [
                                        ...(displayRes?.dampers.map(d => ({ ...d, productType: 'DAMPER' as const })) ?? []),
                                        ...(displayRes?.dorses.map(d => ({ ...d, productType: 'DORSE' as const })) ?? []),
                                        ...(displayRes?.sasis.map(s => ({ ...s, productType: 'SASI' as const })) ?? []),
                                    ];
                                    if (displayLoading) {
                                        return <div className="sidebar-search-msg">Aranıyor…</div>;
                                    }
                                    if (displayError) {
                                        return <div className="sidebar-search-msg sidebar-search-msg--error">{displayError}</div>;
                                    }
                                    if (!displayRes) {
                                        return null;
                                    }
                                    if (all.length === 0) {
                                        return <div className="sidebar-search-msg">Sonuç yok</div>;
                                    }
                                    return all.map(hit => (
                                        <Link
                                            key={`${hit.productType}-${hit.id}`}
                                            href={`/urun-listesi?type=${hit.productType}&expand=${hit.id}`}
                                            className="sidebar-search-link"
                                            onClick={() => {
                                                setIsOpen(false);
                                                setSearchOpen(false);
                                            }}
                                        >
                                            <span className="sidebar-search-link__type">{typeLabel(hit.productType)}</span>
                                            {' · '}
                                            #{hit.imalatNo ?? hit.id} — {hit.musteri || '—'}
                                            {hit.sasiNo ? ` · ${hit.sasiNo}` : ''}
                                        </Link>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                )}

                <nav className="sidebar-menu">
                    {menuItems.map(item => {
                        const isActive = pathname === item.href;
                        const isLiveHub = item.key === 'mevcutIsler' || item.key === 'aracBilgileri';
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn('sidebar-item', isActive && 'active', isLiveHub && 'sidebar-item--live')}
                                onClick={() => setIsOpen(false)}
                                suppressHydrationWarning
                            >
                                {isLiveHub ? (
                                    <span className="sidebar-live-wrap" aria-hidden>
                                        <item.icon size={18} strokeWidth={2} />
                                    </span>
                                ) : (
                                    <item.icon size={18} strokeWidth={2} />
                                )}
                                <span style={{ minWidth: 0, flex: 1 }}>{item.label}</span>
                                {isLiveHub ? <span className="sidebar-live-pill">Canlı</span> : null}
                            </Link>
                        );
                    })}
                </nav>

                <div className="sidebar-footer sidebar-footer-inner">
                    {user && isAdmin && (
                        <>
                            <div className="sidebar-section-label">Yönetim</div>
                            {adminOnlyMenuItems.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn('sidebar-item', pathname === item.href && 'active')}
                                    onClick={() => setIsOpen(false)}
                                    suppressHydrationWarning
                                >
                                    <item.icon size={18} strokeWidth={2} />
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </>
                    )}
                    {user && (
                        <>
                            <div className={cn('sidebar-user-row', isAdmin && 'sidebar-user-row--after-admin')}>
                                <div
                                    className={cn(
                                        'sidebar-user-avatar',
                                        isAdmin ? 'sidebar-user-avatar--admin' : 'sidebar-user-avatar--user',
                                    )}
                                >
                                    {isAdmin ? <Crown size={17} /> : <User size={17} />}
                                </div>
                                <div className="sidebar-user-meta">
                                    <div className="sidebar-user-name">{user.fullName || 'Kullanıcı'}</div>
                                    <div className="sidebar-user-role">{isAdmin ? 'Yönetici' : 'Kullanıcı'}</div>
                                </div>
                            </div>
                            <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
                                <LogOut size={16} aria-hidden />
                                Çıkış
                            </button>
                        </>
                    )}
                </div>
            </aside>
        </>
    );
}
