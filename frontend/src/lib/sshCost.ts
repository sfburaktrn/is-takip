export type SshMalzemeSatir = {
    id: string;
    aciklama: string;
    birimTutar: number | null;
    miktar: number | null;
};

export type SshIscilikSatir = {
    id: string;
    aciklama: string;
    birimTutar: number | null;
    sureSaat: number | null;
};

export type SshMaliyetDetay = {
    karOraniYuzde: number | null;
    malzemeler: SshMalzemeSatir[];
    iscilik: SshIscilikSatir[];
};

export function newRowId(): string {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyMalzemeRow(): SshMalzemeSatir {
    return { id: newRowId(), aciklama: '', birimTutar: null, miktar: null };
}

export function emptyIscilikRow(): SshIscilikSatir {
    return { id: newRowId(), aciklama: '', birimTutar: null, sureSaat: null };
}

export function emptyMaliyetDetay(): SshMaliyetDetay {
    return {
        karOraniYuzde: 15,
        malzemeler: [emptyMalzemeRow()],
        iscilik: [emptyIscilikRow()],
    };
}

export function lineTotal(birim: number | null | undefined, qty: number | null | undefined): number {
    if (birim == null || qty == null || !Number.isFinite(birim) || !Number.isFinite(qty)) return 0;
    return birim * qty;
}

export function roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
}

export function calcMaliyetTotals(detay: SshMaliyetDetay) {
    const malzemeToplam = detay.malzemeler.reduce((s, r) => s + lineTotal(r.birimTutar, r.miktar), 0);
    const iscilikToplam = detay.iscilik.reduce((s, r) => s + lineTotal(r.birimTutar, r.sureSaat), 0);
    const araToplam = malzemeToplam + iscilikToplam;
    const kar = detay.karOraniYuzde != null && Number.isFinite(detay.karOraniYuzde) ? detay.karOraniYuzde : 0;
    const toplamTutar = araToplam * (1 + kar / 100);
    return {
        malzemeToplam: roundMoney(malzemeToplam),
        iscilikToplam: roundMoney(iscilikToplam),
        araToplam: roundMoney(araToplam),
        toplamTutar: roundMoney(toplamTutar),
    };
}

export function fmtTry(amount: number | null | undefined): string {
    if (amount == null || !Number.isFinite(amount)) return '—';
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function parseMaliyetDetay(raw: unknown): SshMaliyetDetay {
    if (!raw || typeof raw !== 'object') return emptyMaliyetDetay();
    const o = raw as Record<string, unknown>;
    const kar = o.karOraniYuzde;
    const karOraniYuzde =
        kar == null || kar === ''
            ? 15
            : Number.isFinite(Number(kar))
              ? Number(kar)
              : 15;

    const mapMalzeme = (rows: unknown): SshMalzemeSatir[] => {
        if (!Array.isArray(rows) || rows.length === 0) return [emptyMalzemeRow()];
        return rows.map((r, i) => {
            const row = r as Record<string, unknown>;
            return {
                id: String(row.id ?? `m-${i}`),
                aciklama: String(row.aciklama ?? ''),
                birimTutar: row.birimTutar == null || row.birimTutar === '' ? null : Number(row.birimTutar),
                miktar: row.miktar == null || row.miktar === '' ? null : Number(row.miktar),
            };
        });
    };

    const mapIscilik = (rows: unknown): SshIscilikSatir[] => {
        if (!Array.isArray(rows) || rows.length === 0) return [emptyIscilikRow()];
        return rows.map((r, i) => {
            const row = r as Record<string, unknown>;
            return {
                id: String(row.id ?? `i-${i}`),
                aciklama: String(row.aciklama ?? ''),
                birimTutar: row.birimTutar == null || row.birimTutar === '' ? null : Number(row.birimTutar),
                sureSaat: row.sureSaat == null || row.sureSaat === '' ? null : Number(row.sureSaat),
            };
        });
    };

    return {
        karOraniYuzde,
        malzemeler: mapMalzeme(o.malzemeler),
        iscilik: mapIscilik(o.iscilik),
    };
}

export function activeOnayPct(onaylanan: number | null, toplam: number): number | null {
    if (onaylanan == null || toplam <= 0) return null;
    const pct = (onaylanan / toplam) * 100;
    for (const p of [25, 50, 75, 100]) {
        if (Math.abs(pct - p) < 0.6) return p;
    }
    return null;
}
