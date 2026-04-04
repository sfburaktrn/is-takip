/**
 * Backend /api/search ile aynı mantık: İ/i/I/ı ve klavye farkları (RİZE vs RIZE vs rize).
 */
function expandTrSearchTerms(s: string): string[] {
    const t = s.trim().normalize('NFKC');
    if (t.length < 2) return [];
    const out = new Set<string>();
    const add = (x: string) => {
        const v = x.trim().normalize('NFKC');
        if (v.length >= 2) out.add(v);
    };
    add(t);
    add(t.toLocaleLowerCase('tr-TR'));
    add(t.toLocaleUpperCase('tr-TR'));
    add(t.toLocaleLowerCase('en-US'));
    add(t.toLocaleUpperCase('en-US'));
    if (/i/.test(t)) {
        add(t.replace(/i/g, 'İ'));
        add(t.replace(/i/g, 'ı'));
    }
    if (/I/.test(t) && !/İ/.test(t)) {
        add(t.replace(/I/g, 'İ'));
        add(t.replace(/I/g, 'ı'));
    }
    if (/ı/.test(t)) {
        add(t.replace(/ı/g, 'i'));
        add(t.replace(/ı/g, 'I'));
    }
    if (/İ/.test(t)) {
        add(t.replace(/İ/g, 'i'));
        add(t.replace(/İ/g, 'I'));
    }
    return [...out];
}

/**
 * Türkçe büyük/küçük harf (İ/I/ı/i) uyumlu karşılaştırma için metni normalize eder.
 */
export function trNorm(s: string | null | undefined): string {
    return String(s ?? '').toLocaleLowerCase('tr-TR');
}

/** Büyük/küçük harf duyarsız, Türkçe + İngilizce klavye varyantlarıyla includes */
export function trIncludes(haystack: string | null | undefined, needle: string): boolean {
    const n = needle.trim();
    if (!n) return true;
    const h = String(haystack ?? '');
    const hTr = h.toLocaleLowerCase('tr-TR');
    const hEn = h.toLocaleLowerCase('en-US');
    for (const v of expandTrSearchTerms(n)) {
        const vTr = v.toLocaleLowerCase('tr-TR');
        const vEn = v.toLocaleLowerCase('en-US');
        if (hTr.includes(vTr) || hEn.includes(vEn)) return true;
    }
    return false;
}

/** Stok / müşteri ayrımı gibi ASCII sabit önekler için */
export function trStartsWithStok(musteri: string | null | undefined): boolean {
    return trNorm(musteri).startsWith('stok');
}
