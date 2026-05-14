'use client';

import { useEffect } from 'react';

const CHROME_CLASS = 'app-chrome-glass';
const SCROLL_THRESHOLD_PX = 20;
const MQ = '(max-width: 1024px)';

/**
 * Mobil / dar ekranda aşağı kaydırınca sabit üst kontroller (menü, bildirim, ses)
 * sayfayla daha uyumlu görünsün diye `html` üzerinde cam/şeffaf sınıfı açar.
 */
export default function ScrollChromeEffect() {
    useEffect(() => {
        if (typeof window === 'undefined' || typeof document === 'undefined') return;

        const root = document.documentElement;
        const mq = window.matchMedia(MQ);

        const sync = () => {
            const narrow = mq.matches;
            const y = window.scrollY || root.scrollTop || 0;
            const glass = narrow && y > SCROLL_THRESHOLD_PX;
            root.classList.toggle(CHROME_CLASS, glass);
        };

        sync();
        window.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync, { passive: true });
        mq.addEventListener('change', sync);

        return () => {
            window.removeEventListener('scroll', sync);
            window.removeEventListener('resize', sync);
            mq.removeEventListener('change', sync);
            root.classList.remove(CHROME_CLASS);
        };
    }, []);

    return null;
}
