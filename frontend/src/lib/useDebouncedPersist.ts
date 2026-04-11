import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_MS = 380;

/** Sunucu yanıtı geciktiğinde eski cevabın güncel yazımın üzerine yazmasını engeller. */
export function applyServerRowIfFieldMatches<T extends { id: number }>(
    list: T[],
    rowId: number,
    field: keyof T,
    snapshot: unknown,
    serverRow: T
): T[] {
    return list.map((row) => {
        if (row.id !== rowId) return row;
        if (!Object.is(row[field], snapshot)) return row;
        return serverRow;
    });
}

/**
 * Kart içi hızlı yazımda her tuşta API çağrısını biriktirir.
 * `schedule` son çalıştırılacak fonksiyonu saklar; `flush` bekleyen kaydı hemen çalıştırır (blur vb.).
 */
export function useDebouncedPersist(defaultDelayMs = DEFAULT_MS) {
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const pending = useRef(new Map<string, () => Promise<void>>());

    const flush = useCallback(async (key: string) => {
        const t = timers.current.get(key);
        if (t) {
            clearTimeout(t);
            timers.current.delete(key);
        }
        const fn = pending.current.get(key);
        pending.current.delete(key);
        if (fn) await fn();
    }, []);

    const schedule = useCallback(
        (key: string, run: () => Promise<void>, delayMs = defaultDelayMs) => {
            pending.current.set(key, run);
            const old = timers.current.get(key);
            if (old) clearTimeout(old);
            const tid = setTimeout(() => {
                timers.current.delete(key);
                const fn = pending.current.get(key);
                pending.current.delete(key);
                if (fn) void fn();
            }, delayMs);
            timers.current.set(key, tid);
        },
        [defaultDelayMs]
    );

    useEffect(() => {
        return () => {
            const keys = new Set([...timers.current.keys(), ...pending.current.keys()]);
            keys.forEach((key) => {
                const t = timers.current.get(key);
                if (t) clearTimeout(t);
                timers.current.delete(key);
                const fn = pending.current.get(key);
                pending.current.delete(key);
                if (fn) void fn();
            });
        };
    }, []);

    return { schedule, flush };
}
