'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Eski URL; ana sayfa /kapasite */
export default function KapasiteRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/kapasite');
    }, [router]);
    return (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
            Yönlendiriliyor…
        </div>
    );
}
