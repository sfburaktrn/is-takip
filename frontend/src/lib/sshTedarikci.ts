/** Hata kaynağı Tedarikçi mi (Türkçe İ normalize). */
export function isTedarikciHataKaynagi(v?: string | null): boolean {
    const s = String(v ?? '')
        .trim()
        .toUpperCase()
        .replace(/İ/g, 'I');
    return s === 'TEDARIKCI' || s.includes('TEDARIK');
}
