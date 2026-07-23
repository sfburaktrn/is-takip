'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import OzunluLoading from '@/components/OzunluLoading';

interface AuthGuardProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
    const { user, isLoading, isAdmin, isWarehouse } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (isWarehouse && !pathname.startsWith('/stok-takip')) {
                router.push('/stok-takip');
            } else if (requireAdmin && !isAdmin) {
                router.push(isWarehouse ? '/stok-takip' : '/urun-listesi');
            }
        }
    }, [user, isLoading, isAdmin, isWarehouse, requireAdmin, router, pathname]);

    if (isLoading) {
        return <OzunluLoading variant="fullscreen" />;
    }

    if (!user) {
        return null;
    }

    if (isWarehouse && !pathname.startsWith('/stok-takip')) {
        return null;
    }

    if (requireAdmin && !isAdmin) {
        return null;
    }

    return <>{children}</>;
}
