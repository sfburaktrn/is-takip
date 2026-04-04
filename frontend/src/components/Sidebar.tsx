'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getSearch, type SearchResponse } from '@/lib/api';
import {
    LayoutDashboard,
    Truck,
    ClipboardList,
    Building2,
    LineChart,
    Gauge,
    Settings,
    FileText,
    Menu,
    X,
    LogOut,
    Crown,
    User,
    Users,
    Search,
    History
} from 'lucide-react';

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

    useEffect(() => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!user || searchQ.trim().length < 2) {
            setSearchRes(null);
            setSearchError(null);
            setSearchLoading(false);
            return;
        }
        searchTimer.current = setTimeout(() => {
            setSearchLoading(true);
            setSearchError(null);
            setSearchRes(null);
            getSearch(searchQ.trim())
                .then(data => {
                    setSearchRes(data);
                })
                .catch(() => {
                    setSearchRes(null);
                    setSearchError('Arama yanıt vermedi. Backend (3001) çalışıyor mu ve giriş yaptınız mı?');
                })
                .finally(() => setSearchLoading(false));
        }, 320);
        return () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        };
    }, [searchQ, user]);

    const menuItems = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/urun-listesi', label: 'Ürün Listesi', icon: Truck },
        { href: '/ozet', label: 'Özet Görünüm', icon: ClipboardList },
        { href: '/firma-ozeti', label: 'Firma Özeti', icon: Building2 },
        { href: '/analiz', label: 'Analiz', icon: LineChart },
        { href: '/verimlilik', label: 'Verimlilik', icon: Gauge },
    ];

    const adminMenuItems = [
        { href: '/kapasite', label: 'Bölüm kapasitesi', icon: Users },
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
            {/* Mobile Toggle Button */}
            <button
                className="mobile-toggle"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Toggle Menu"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Overlay */}
            <div
                className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
                onClick={() => setIsOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-logo" style={{ padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ position: 'relative', width: '100%', height: '28px' }}>
                        <Image
                            src="/logo.png"
                            alt="Özünlü Logo"
                            fill
                            style={{ objectFit: 'contain' }}
                            priority
                        />
                    </div>
                    <div style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--muted)',
                        letterSpacing: '1px',
                        textAlign: 'center',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '12px',
                        width: '100%'
                    }}>
                        İMALAT TAKİP SİSTEMİ
                    </div>
                </div>

                {user && (
                    <div style={{ padding: '8px 12px 12px', position: 'relative', zIndex: 20 }}>
                        <div style={{ position: 'relative' }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: 'var(--muted)',
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                type="search"
                                placeholder="İmalat no, müşteri, şasi..."
                                value={searchQ}
                                onChange={e => {
                                    setSearchQ(e.target.value);
                                    setSearchOpen(true);
                                }}
                                onFocus={() => setSearchOpen(true)}
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 34px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    fontSize: '12px',
                                    background: 'var(--card-bg, #fff)',
                                }}
                            />
                        </div>
                        {searchOpen && searchQ.trim().length >= 2 && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    right: '12px',
                                    top: '100%',
                                    marginTop: '4px',
                                    maxHeight: '280px',
                                    overflowY: 'auto',
                                    background: 'var(--card-bg, #fff)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                                    zIndex: 50,
                                }}
                            >
                                {(() => {
                                    const all = [
                                        ...(searchRes?.dampers.map(d => ({ ...d, productType: 'DAMPER' as const })) ?? []),
                                        ...(searchRes?.dorses.map(d => ({ ...d, productType: 'DORSE' as const })) ?? []),
                                        ...(searchRes?.sasis.map(s => ({ ...s, productType: 'SASI' as const })) ?? []),
                                    ];
                                    if (searchLoading) {
                                        return (
                                            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                                                Aranıyor…
                                            </div>
                                        );
                                    }
                                    if (searchError) {
                                        return (
                                            <div style={{ padding: '12px', fontSize: '12px', color: '#b91c1c' }}>
                                                {searchError}
                                            </div>
                                        );
                                    }
                                    if (!searchRes) {
                                        return null;
                                    }
                                    if (all.length === 0) {
                                        return (
                                            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                                                Sonuç yok
                                            </div>
                                        );
                                    }
                                    return all.map(hit => (
                                        <Link
                                            key={`${hit.productType}-${hit.id}`}
                                            href={`/urun-listesi?type=${hit.productType}&expand=${hit.id}`}
                                            onClick={() => {
                                                setIsOpen(false);
                                                setSearchOpen(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                padding: '10px 12px',
                                                fontSize: '12px',
                                                borderBottom: '1px solid var(--border)',
                                                color: 'var(--foreground, #0f172a)',
                                                textDecoration: 'none',
                                            }}
                                        >
                                            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                                {typeLabel(hit.productType)}
                                            </span>
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
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                            onClick={() => setIsOpen(false)}
                            suppressHydrationWarning
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    {isAdmin && (
                        <>
                            <div style={{
                                padding: '10px 10px 4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'var(--muted)',
                                letterSpacing: '1px',
                                borderTop: '1px solid var(--border)',
                                marginTop: '2px'
                            }}>
                                YÖNETİM
                            </div>
                            {adminMenuItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                                    onClick={() => setIsOpen(false)}
                                    suppressHydrationWarning
                                >
                                    <item.icon size={20} />
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </>
                    )}
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: isAdmin
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(2, 35, 71, 0.1)',
                            color: isAdmin ? 'var(--danger)' : 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {isAdmin ? <Crown size={18} /> : <User size={18} />}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                {user?.fullName || 'Kullanıcı'}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: '11px' }}>
                                {isAdmin ? 'Yönetici' : 'Kullanıcı'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: 'var(--secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--muted)',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--danger)';
                            e.currentTarget.style.color = 'white';
                            e.currentTarget.style.borderColor = 'var(--danger)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--secondary)';
                            e.currentTarget.style.color = 'var(--muted)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                        }}
                    >
                        <LogOut size={16} /> Çıkış Yap
                    </button>
                </div>
            </aside>
        </>
    );
}
