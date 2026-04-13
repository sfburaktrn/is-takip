'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import OzunluLoading from '@/components/OzunluLoading';

interface AuthGuardProps {
    children: React.ReactNode;
    requireAdmin?: boolean;
}

export default function AuthGuard({ children, requireAdmin = false }: AuthGuardProps) {
    const { user, isLoading, isAdmin } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
            } else if (requireAdmin && !isAdmin) {
                router.push('/');
            }
        }
    }, [user, isLoading, isAdmin, requireAdmin, router]);

    if (isLoading) {
        return <OzunluLoading variant="fullscreen" />;
    }

    if (!user) {
        return null;
    }

    if (requireAdmin && !isAdmin) {
        return null;
    }

    return <>{children}</>;
}
