'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import {
    LayoutDashboard,
    Truck,
    ClipboardList,
    Building2,
    LineChart,
    Settings,
    FileText,
    Menu,
    X,
    LogOut,
    Crown,
    User
} from 'lucide-react';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const { user, isAdmin, logout } = useAuth();

    const menuItems = [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/urun-listesi', label: 'Ürün Listesi', icon: Truck },
        { href: '/ozet', label: 'Özet Görünüm', icon: ClipboardList },
        { href: '/firma-ozeti', label: 'Firma Özeti', icon: Building2 },
        { href: '/analiz', label: 'Analiz', icon: LineChart },
    ];

    // Admin menu items
    const adminMenuItems = [
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

                    {/* Admin Menu Items */}
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
