/** Takvim günü farkı (başlangıç → bitiş, negatif yok). */
export function calendarDaysBetween(start?: string | null, end?: string | null): number | null {
    if (!start || !end) return null;
    const s = new Date(`${start.slice(0, 10)}T12:00:00`);
    const e = new Date(`${end.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
    return Math.max(0, diff);
}

/** Araç çıkış süresi (gün) = şikayet bildirim − garanti başlangıç. */
export function calcAracCikisSuresiGun(
    sikayetBildirimTarihi?: string | null,
    garantiBaslangicTarihi?: string | null
): number | null {
    return calendarDaysBetween(garantiBaslangicTarihi, sikayetBildirimTarihi);
}

export type ExitCoefRow = { maxDays: number | null; coefficient: number };

/** Varsayılan çıkış süre katsayısı tablosu (Hata risk değerleri). */
export type PrioOptionRow = { name: string; coefficient: number; description?: string };

export const DEFAULT_PRIO_OPTIONS: PrioOptionRow[] = [
    { name: 'PRİO 1', coefficient: 10, description: 'Müşteri Şikayetleri' },
    { name: 'PRİO 2', coefficient: 7, description: 'Özünlü Ürün Auditleri' },
    { name: 'PRİO 3', coefficient: 4, description: 'Müşteri Ürün Denetimleri' },
    { name: 'PRİO 4', coefficient: 1, description: 'Dinamik Çekliste' },
];

export type EtkiOptionRow = { name: string; score: number; description?: string; tanim?: string };

export const DEFAULT_ETKI_OPTIONS: EtkiOptionRow[] = [
    { name: 'UYARISIZ TEHLİKELİ', score: 10, description: 'Uyarısız Hayati Tehlike yaratır' },
    { name: 'UYARILI TEHLİKELİ', score: 9, description: 'Uyarılı Hayati Tehlike yaratır' },
    { name: 'ÇOK YÜKSEK', score: 8, description: 'Araç/Parça Çalışmaz. Fonksiyonunu tamamen yerine getiremez' },
    {
        name: 'YÜKSEK',
        score: 7,
        description:
            'Araç/Parça Düşük performansla çalışır. Fonksiyonunu tamamen kaybetme riski yüksek ve müşteride ciddi memnuniyetsizlik yaratır.',
    },
    {
        name: 'ORTA',
        score: 6,
        description: 'Araç/Parça Orta düzeyde performans kaybı ile çalışır. Müşteride memnuniyetsizlik oluşturur.',
    },
    {
        name: 'DÜŞÜK',
        score: 5,
        description:
            'Araç/Parça Düşük Performans ile çalışabilir fakat rahatsızlık ve konforsuzluk oluşturarak Müşteride BİRAZ memnuniyetsizlik yaratır',
    },
    {
        name: 'ÇOK DÜŞÜK',
        score: 4,
        description: 'Yüzey/Estetik/Montaj uygunsuzluğu vardır. BİRÇOK müşteri tarafından farkedilir',
    },
    {
        name: 'ÖNEMSİZ',
        score: 3,
        description: 'Yüzey/Estetik/Montaj uygunsuzluğu vardır. BAZI müşteriler tarafından farkedilir',
    },
    {
        name: 'ÇOK ÖNEMSİZ',
        score: 2,
        description: 'Yüzey/Estetik/Montaj uygunsuzluğu vardır. ÇOK AZ müşteri tarafından farkedilir',
    },
    { name: 'ETKİSİZ', score: 1, description: 'Etkisi yoktur' },
];

/** API satırında description eksikse varsayılan tablodan tamamlar. */
export function mergeEtkiOptionsTable(api?: EtkiOptionRow[] | null): EtkiOptionRow[] {
    const src = api?.length ? api : DEFAULT_ETKI_OPTIONS;
    return src.map(row => {
        const fallback = DEFAULT_ETKI_OPTIONS.find(b => b.name === row.name);
        const description = (row.description ?? row.tanim ?? fallback?.description ?? '').trim();
        return { ...row, score: row.score ?? fallback?.score ?? 0, description };
    });
}

export function etkiRowDescription(row: EtkiOptionRow): string {
    return (row.description ?? row.tanim ?? '').trim();
}

export function etkiScoreFromName(etkiAdi?: string | null, table: EtkiOptionRow[] = DEFAULT_ETKI_OPTIONS): number | null {
    if (!etkiAdi?.trim()) return null;
    const found = table.find(e => e.name === etkiAdi.trim());
    return found ? found.score : null;
}

export function prioCoefficientFromName(oncelikPrio?: string | null, table: PrioOptionRow[] = DEFAULT_PRIO_OPTIONS): number | null {
    if (!oncelikPrio?.trim()) return null;
    const found = table.find(p => p.name === oncelikPrio.trim());
    return found ? found.coefficient : null;
}

export const DEFAULT_EXIT_COEF_TABLE: ExitCoefRow[] = [
    { maxDays: 91, coefficient: 10 },
    { maxDays: 181, coefficient: 8 },
    { maxDays: 271, coefficient: 6 },
    { maxDays: 366, coefficient: 4 },
    { maxDays: 1825, coefficient: 2 },
    { maxDays: null, coefficient: 1 },
];

export function exitTimeCoefficient(days: number | null, table: ExitCoefRow[]): number | null {
    if (days == null || !Number.isFinite(days)) return null;
    for (const row of table) {
        if (row.maxDays == null) return row.coefficient;
        if (days < row.maxDays) return row.coefficient;
    }
    return 1;
}

export function buildExitCoefDisplayRows(table: ExitCoefRow[]) {
    const sorted = [...table].sort(
        (a, b) => (a.maxDays ?? Number.MAX_SAFE_INTEGER) - (b.maxDays ?? Number.MAX_SAFE_INTEGER)
    );
    let min = 0;
    return sorted.map(row => {
        const max = row.maxDays;
        let süre: string;
        if (max == null) {
            süre = `${min} gün ve üzeri`;
        } else if (min === 0) {
            süre = `${max - 1} günden az`;
        } else {
            süre = `${min} – ${max - 1} gün`;
        }
        const out = { süre, coefficient: row.coefficient, minDays: min, maxDays: max };
        if (max != null) min = max;
        return out;
    });
}

/** Analiz puanı = öncelik katsayısı × etki katsayısı × tekrar eden hata sayısı */
export function calcAnalizPuani(
    oncelikKatsayisi?: number | null,
    etkiKatsayisi?: number | null,
    tekrarEdenHataSayisi?: number | null
): number | null {
    if (oncelikKatsayisi == null || etkiKatsayisi == null || !Number.isFinite(oncelikKatsayisi) || !Number.isFinite(etkiKatsayisi)) {
        return null;
    }
    const tekrar =
        tekrarEdenHataSayisi == null || tekrarEdenHataSayisi === undefined
            ? 1
            : Number.isFinite(tekrarEdenHataSayisi)
              ? tekrarEdenHataSayisi
              : null;
    if (tekrar == null || tekrar < 1) return null;
    return oncelikKatsayisi * etkiKatsayisi * tekrar;
}

/** Kritik puan = analiz puanı × çıkış süre katsayısı */
export function calcKritikPuan(analizPuani?: number | null, cikisSureKatsayisi?: number | null): number | null {
    if (analizPuani == null || cikisSureKatsayisi == null || !Number.isFinite(analizPuani) || !Number.isFinite(cikisSureKatsayisi)) {
        return null;
    }
    return analizPuani * cikisSureKatsayisi;
}

export function exitCoefActiveIndex(days: number | null, table: ExitCoefRow[]): number {
    if (days == null || !Number.isFinite(days)) return -1;
    const sorted = [...table].sort(
        (a, b) => (a.maxDays ?? Number.MAX_SAFE_INTEGER) - (b.maxDays ?? Number.MAX_SAFE_INTEGER)
    );
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].maxDays == null) return i;
        if (days < sorted[i].maxDays!) return i;
    }
    return sorted.length - 1;
}
