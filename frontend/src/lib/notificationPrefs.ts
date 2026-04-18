const SOUND_KEY = 'ozunlu-notification-sound';

export function getNotificationSoundEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const v = window.localStorage.getItem(SOUND_KEY);
        if (v === null || v === '') return true;
        return v === '1';
    } catch {
        return false;
    }
}

export function setNotificationSoundEnabled(on: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(SOUND_KEY, on ? '1' : '0');
    } catch {
        /* ignore */
    }
}
