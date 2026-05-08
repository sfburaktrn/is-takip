'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import OzunluLoading from '@/components/OzunluLoading';

/**
 * Ana URL: oturum yoksa login, varsa ürün listesi.
 * Not: Köke edge redirect koymak herkesi /urun-listesi'ye atar; şifresiz ziyaretçi doğrudan /login görmemiş olurdu.
 */
export default function Home() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;
        if (user) {
            router.replace('/urun-listesi');
        } else {
            router.replace('/login');
        }
    }, [user, isLoading, router]);

    return <OzunluLoading variant="fullscreen" />;
}
