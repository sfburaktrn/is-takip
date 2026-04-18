let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx) sharedCtx = new AC();
    return sharedCtx;
}

/** Tarayıcı ses politikası: genelde kullanıcı tıklamasından sonra çağrılmalı. */
export function unlockNotificationAudio(): Promise<void> {
    const ctx = getCtx();
    if (!ctx) return Promise.resolve();
    return ctx.resume().catch(() => {});
}

export function playNotificationChime(): void {
    try {
        const ctx = getCtx();
        if (!ctx) return;
        const t0 = ctx.currentTime;
        const notes = [
            { f: 784, at: 0, dur: 0.1 },
            { f: 988, at: 0.08, dur: 0.11 },
            { f: 1175, at: 0.18, dur: 0.14 }
        ];
        for (const n of notes) {
            const start = t0 + n.at;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.f, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.085, start + 0.018);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + n.dur + 0.02);
        }
    } catch {
        /* sessiz */
    }
}
