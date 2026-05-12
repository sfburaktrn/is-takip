import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export type AppleSegThumb = { x: number; y: number; w: number; h: number };

/**
 * iOS benzeri segment: aktif düğüme göre kayan arka plan (transform + boyut).
 */
export function useAppleSegmentedThumb(
    trackRef: RefObject<HTMLElement | null>,
    activeIndex: number,
): AppleSegThumb {
    const [thumb, setThumb] = useState<AppleSegThumb>({ x: 0, y: 0, w: 0, h: 0 });

    const measure = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        const buttons = [...track.querySelectorAll<HTMLButtonElement>('.apple-segmented-btn')];
        const btn = buttons[activeIndex];
        if (!btn) {
            setThumb({ x: 0, y: 0, w: 0, h: 0 });
            return;
        }
        const tr = track.getBoundingClientRect();
        const br = btn.getBoundingClientRect();
        setThumb({
            x: br.left - tr.left,
            y: br.top - tr.top,
            w: br.width,
            h: br.height,
        });
    }, [trackRef, activeIndex]);

    useLayoutEffect(() => {
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            measure();
            inner = requestAnimationFrame(() => measure());
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [measure]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
        ro?.observe(track);
        window.addEventListener('resize', measure);
        track.addEventListener('scroll', measure, { passive: true });
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', measure);
            track.removeEventListener('scroll', measure);
        };
    }, [measure, trackRef]);

    return thumb;
}
