'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/damper-listesi', label: 'Damper Listesi', icon: '🚛' },
    { href: '/ozet', label: 'Özet Görünüm', icon: '📋' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                🏭 İmalat Takip
            </div>

            <nav className="sidebar-menu">
                {menuItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '20px' }}>{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px'
                    }}>
                        👤
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>Yönetici</div>
                        <div style={{ color: 'var(--muted)', fontSize: '12px' }}>Özünlü Damper</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
