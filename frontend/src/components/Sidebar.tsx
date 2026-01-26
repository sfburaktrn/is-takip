'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const { user, isAdmin, logout } = useAuth();

    const menuItems = [
        { href: '/', label: 'Dashboard', icon: '📊' },
        { href: '/urun-listesi', label: 'Ürün Listesi', icon: '🚛' },
        { href: '/ozet', label: 'Özet Görünüm', icon: '📋' },
        { href: '/firma-ozeti', label: 'Firma Özeti', icon: '🏢' },
        { href: '/analiz', label: 'Analiz', icon: '📈' },
    ];

    // Admin menu items
    const adminMenuItems = [
        { href: '/ayarlar', label: 'Ayarlar', icon: '⚙️' },
        { href: '/giris-loglari', label: 'Giriş Logları', icon: '📝' },
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
                <span style={{ fontSize: '24px' }}>{isOpen ? '✕' : '☰'}</span>
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
                        color: 'rgba(255,255,255,0.5)',
                        letterSpacing: '1px',
                        textAlign: 'center',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        paddingTop: '12px',
                        width: '100%'
                    }}>
                        İMALAT TAKİP SİSTEMİ
                    </div>
                </div>

                <nav className="sidebar-menu">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                            onClick={() => setIsOpen(false)}
                            suppressHydrationWarning
                        >
                            <span style={{ fontSize: '20px' }}>{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}

                    {/* Admin Menu Items */}
                    {isAdmin && (
                        <>
                            <div style={{
                                padding: '10px 10px 4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: 'rgba(255,255,255,0.4)',
                                letterSpacing: '1px',
                                borderTop: '1px solid rgba(255,255,255,0.1)',
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
                                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                                    <span>{item.label}</span>
                                </Link>
                            ))}
                        </>
                    )}
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: isAdmin
                                ? 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
                                : 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px'
                        }}>
                            {isAdmin ? '👑' : '👤'}
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
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            color: '#fca5a5',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        🚪 Çıkış Yap
                    </button>
                </div>
            </aside>
        </>
    );
}
