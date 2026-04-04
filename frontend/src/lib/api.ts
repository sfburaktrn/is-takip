// API base URL
const getBaseUrl = () => {
    // In browser (client-side)
    if (typeof window !== 'undefined') {
        // Use relative path which will be handled by Next.js rewrites
        // This solves cross-domain cookie issues effectively
        return '/api';
    }

    // Server-side: use direct backend URL
    const backendUrl = process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    let url = backendUrl;
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (!url.endsWith('/api')) url += '/api';
    return url;
};

export const API_URL = getBaseUrl();
console.log('Using API URL:', API_URL);

// Types
export interface Damper {
    id: number;
    imalatNo: number | null;
    musteri: string;
    sasiNo: string | null;
    aracGeldiMi: boolean;
    aracMarka: string | null;
    model: string | null;
    tip: string;
    malzemeCinsi: string;
    m3: string | null;
    renk: string | null;
    adet: number;

    // Sub-steps
    plazmaProgrami: boolean;
    sacMalzemeKontrolu: boolean;
    plazmaKesim: boolean;
    damperSasiPlazmaKesim: boolean;
    presBukum: boolean;
    aracBraket: boolean;
    damperSasi: boolean;
    sasiYukleme: boolean;
    milAltKutuk: boolean;
    taban: boolean;
    yan: boolean;
    onGogus: boolean;
    arkaKapak: boolean;
    yuklemeMalzemesi: boolean;
    damperKurulmasi: boolean;
    damperKaynak: boolean;
    sasiKapakSiperlik: boolean;
    yukleme: boolean;
    hidrolik: boolean;
    boyaHazirlik: boolean;
    boya: boolean;
    elektrik: boolean;
    hava: boolean;
    tamamlama: boolean;
    sonKontrol: boolean;

    kurumMuayenesi: string;
    dmoMuayenesi: string;
    teslimat: boolean;

    branda: boolean;
    brandaMontaji: boolean;

    // Calculated statuses
    kesimBukumStatus?: string;
    sasiBitisStatus?: string;
    onHazirlikStatus?: string;
    montajStatus?: string;
    hidrolikStatus?: string;
    boyaBitisStatus?: string;
    tamamlamaBitisStatus?: string;
    sonKontrolStatus?: string;
    teslimatStatus?: string;

    createdAt?: string;
    updatedAt?: string;
    /** Üretime giriş (verimlilik metrikleri); yalnızca yeni kayıtlarda dolu */
    productionStartedAt?: string | null;
}

export interface DamperSummary {
    id: number;
    imalatNo: number;
    musteri: string;
    aracGeldiMi: boolean;
    aracMarka: string | null;
    model: string | null;
    tip: string;
    malzemeCinsi: string;
    m3: string | null;
    kesimBukum: string;
    sasiBitis: string;
    onHazirlik: string;
    montaj: string;
    hidrolik: string;
    boyaBitis: string;
    tamamlamaBitis: string;
    sonKontrol: string;
    kurumMuayenesi: string;
    dmoMuayenesi: string;
    teslimat: string;
}

export interface DorseSummary {
    id: number;
    imalatNo: number;
    musteri: string;
    cekiciGeldiMi: boolean;
    sasiNo: string | null;
    kalinlik: string | null;
    m3: string | null;
    kesimBukum: string;
    sasiBitis: string;
    onHazirlik: string;
    montaj: string; // includes hidrolik in backend but separate col in frontend?
    hidrolik: string; // we manually set this in backend
    boyaBitis: string;
    tamamlamaBitis: string;
    sonKontrol: string;
    kurumMuayenesi: string; // backend maps akmTseMuayenesi to this? or we rename?
    // In backend I mapped: kurumMuayenesi: dorse.akmTseMuayenesi
    dmoMuayenesi: string;
    teslimat: string;
    sasi?: {
        musteri: string;
        sasiNo: string | null;
        imalatNo?: number | null;
    } | null;
}

export interface Stats {
    total: number;
    tamamlanan: number;
    devamEden: number;
    baslamayan: number;
    stokSasiCount?: number;
    musteriSasiCount?: number;
    tamamlananStok?: number;
    devamEdenStok?: number;
    tamamlananMusteri?: number;
    devamEdenMusteri?: number;
}

export interface Dropdowns {
    aracGeldiMi: string[];
    tip: string[];
    malzemeCinsi: string[];
    aracMarka: string[];
    model: string[];
    kurumMuayenesi: string[];
    dmoMuayenesi: string[];
}

export interface CompanyVariant {
    name: string;
    total: number;
    totalM3: number;
    tamamlanan: number;
    devamEden: number;
    baslamayan: number;
}

export interface M3Group {
    m3: string;
    count: number;
    tamamlanan: number;
    devamEden: number;
    baslamayan: number;
    stepStats: StepStats;
}

export interface CompanyDamper {
    [key: string]: any;
    id: number;
    imalatNo: number;
    musteri: string;
    m3: string;
    progress: number;
    status: string;
    kesimBukumStatus: string;
    sasiBitisStatus: string;
    onHazirlikStatus: string;
    montajStatus: string;
    hidrolikStatus: string;
    boyaBitisStatus: string;
    tamamlamaBitisStatus: string;
    sonKontrolStatus: string;
}

export interface StepStat {
    baslamadi: number;
    devamEdiyor: number;
    tamamlandi: number;
    total: number;
}

export interface StepStats {
    [key: string]: StepStat | undefined;
    kesimBukum?: StepStat;
    sasiBitis?: StepStat;
    onHazirlik?: StepStat;
    montaj?: StepStat;
    hidrolik?: StepStat;
    boya?: StepStat; // Dorse
    boyaBitis?: StepStat; // Damper
    tamamlama?: StepStat; // Dorse
    tamamlamaBitis?: StepStat; // Damper
    sonKontrol?: StepStat;
    kurumMuayenesi?: StepStat;
    dmoMuayenesi?: StepStat;
    teslimat?: StepStat;
}

export interface CompanySummary {
    baseCompany: string;
    totalOrders: number;
    totalM3: number;
    tamamlanan: number;
    devamEden: number;
    baslamayan: number;
    variants: CompanyVariant[];
    m3Groups: M3Group[];
    dampers: CompanyDamper[];
    stepStats: StepStats;
}

// Helper to handle response
async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${text.substring(0, 500)}`);
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        // Handle redirect to login or non-JSON response
        const text = await res.text();
        console.error('Received non-JSON response:', text.substring(0, 200));
        if (res.redirected || text.includes('<!DOCTYPE') || text.includes('<html')) {
            throw new Error('Session expired or invalid API endpoint');
        }
        throw new Error('Invalid response format (not JSON)');
    }
    return res.json();
}

// API Functions
export async function getDampers(): Promise<Damper[]> {
    const res = await fetch(`${API_URL}/dampers`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Damper[]>(res);
}

export async function getDamper(id: number): Promise<Damper> {
    const res = await fetch(`${API_URL}/dampers/${id}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Damper>(res);
}

export async function createDamper(data: Partial<Damper>): Promise<Damper> {
    const res = await fetch(`${API_URL}/dampers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Damper>(res);
}

export async function updateDamper(id: number, data: Partial<Damper>): Promise<Damper> {
    const res = await fetch(`${API_URL}/dampers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Damper>(res);
}

export async function deleteDamper(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/dampers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete damper');
}

export async function getDampersSummary(): Promise<DamperSummary[]> {
    const res = await fetch(`${API_URL}/dampers-summary`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<DamperSummary[]>(res);
}

export async function getDorsesSummary(): Promise<DorseSummary[]> {
    const res = await fetch(`${API_URL}/dorses-summary`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<DorseSummary[]>(res);
}

export async function getStats(type: 'DAMPER' | 'DORSE' | 'SASI' = 'DAMPER'): Promise<Stats> {
    const res = await fetch(`${API_URL}/stats?type=${type}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Stats>(res);
}

export async function getDropdowns(): Promise<Dropdowns> {
    const res = await fetch(`${API_URL}/dropdowns`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dropdowns>(res);
}

export async function getCompanySummary(type: 'DAMPER' | 'DORSE' | 'SASI' = 'DAMPER'): Promise<CompanySummary[]> {
    const res = await fetch(`${API_URL}/company-summary?type=${type}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<CompanySummary[]>(res);
}

export async function deleteCompanyM3Group(companyName: string, m3: string, type: 'DAMPER' | 'DORSE' = 'DAMPER'): Promise<void> {
    const res = await fetch(`${API_URL}/company-m3`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ companyName, m3, type }),
    });
    if (!res.ok) throw new Error('Failed to delete company M3 group');
}

// Step Groups for UI
export const STEP_GROUPS = [
    {
        key: 'kesimBukum',
        name: 'KESİM - BÜKÜM',
        statusKey: 'kesimBukumStatus',
        subSteps: [
            { key: 'plazmaProgrami', label: 'Plazma Programı' },
            { key: 'sacMalzemeKontrolu', label: 'Sac Malzeme Kontrolü' },
            { key: 'plazmaKesim', label: 'Plazma Kesim' },
            { key: 'damperSasiPlazmaKesim', label: 'Damper Şasi Plazma Kesim' },
            { key: 'presBukum', label: 'Pres Büküm' },
        ],
    },
    {
        key: 'sasiBitis',
        name: 'ŞASİ BİTİŞ',
        statusKey: 'sasiBitisStatus',
        subSteps: [
            { key: 'aracBraket', label: 'Araç Braket' },
            { key: 'damperSasi', label: 'Damper Şasi' },
            { key: 'sasiYukleme', label: 'Şasi Yükleme' },
        ],
    },
    {
        key: 'onHazirlik',
        name: 'ÖN HAZIRLIK',
        statusKey: 'onHazirlikStatus',
        subSteps: [
            { key: 'milAltKutuk', label: 'Mil Alt Kütük' },
            { key: 'taban', label: 'Taban' },
            { key: 'yan', label: 'Yan' },
            { key: 'onGogus', label: 'Ön Göğüs' },
            { key: 'arkaKapak', label: 'Arka Kapak' },
            { key: 'yuklemeMalzemesi', label: 'Yükleme Malzemesi' },
        ],
    },
    {
        key: 'montaj',
        name: 'MONTAJ',
        statusKey: 'montajStatus',
        subSteps: [
            { key: 'damperKurulmasi', label: 'Damper Kurulması' },
            { key: 'damperKaynak', label: 'Damper Kaynak' },
            { key: 'sasiKapakSiperlik', label: 'Şasi Kapak-Siperlik' },
            { key: 'yukleme', label: 'Yükleme' },
        ],
    },
    {
        key: 'hidrolik',
        name: 'HİDROLİK',
        statusKey: 'hidrolikStatus',
        subSteps: [
            { key: 'hidrolik', label: 'Hidrolik' },
        ],
    },
    {
        key: 'boyaBitis',
        name: 'BOYA BİTİŞ',
        statusKey: 'boyaBitisStatus',
        subSteps: [
            { key: 'boyaHazirlik', label: 'Boya Hazırlık' },
            { key: 'boya', label: 'Boya' },
        ],
    },
    {
        key: 'tamamlamaBitis',
        name: 'TAMAMLAMA BİTİŞ',
        statusKey: 'tamamlamaBitisStatus',
        subSteps: [
            { key: 'elektrik', label: 'Elektrik' },
            { key: 'hava', label: 'Hava' },
            { key: 'tamamlama', label: 'Tamamlama' },
            { key: 'brandaMontaji', label: 'Branda Montajı' },
        ],
    },
    {
        key: 'sonKontrol',
        name: 'SON KONTROL',
        statusKey: 'sonKontrolStatus',
        subSteps: [
            { key: 'sonKontrol', label: 'Son Kontrol' },
        ],
    },
];

export interface Dorse {
    id: number;
    imalatNo: number | null;
    musteri: string;
    cekiciGeldiMi: boolean;
    dingil: string | null;
    lastik: string | null;
    tampon: string | null;
    kalinlik: string | null;
    m3: string | null;
    renk: string | null;
    adet: number;
    sasiNo: string | null;
    silindir: string | null;
    malzemeCinsi: string | null;

    // Sub-steps
    plazmaProgrami: boolean;
    sacMalzemeKontrolu: boolean;
    plazmaKesim: boolean;
    presBukum: boolean;
    dorseSasi: boolean;

    milAltKutuk: boolean;
    taban: boolean;
    yan: boolean;
    onGogus: boolean;
    arkaKapak: boolean;
    yuklemeMalzemesi: boolean;

    dorseKurulmasi: boolean;
    dorseKaynak: boolean;
    kapakSiperlik: boolean;
    yukleme: boolean;
    hidrolik: boolean;

    boyaHazirlik: boolean;
    dorseSasiBoyama: boolean;

    fren: boolean;
    dorseElektrik: boolean;
    tamamlama: boolean;
    cekiciElektrik: boolean;
    cekiciHidrolik: boolean;
    aracKontrolBypassAyari: boolean;

    sonKontrol: boolean;
    tipOnay: boolean;
    fatura: boolean;
    akmTseMuayenesi: string;
    dmoMuayenesi: string;
    tahsilat: boolean;
    teslimat: boolean;

    branda: boolean;
    brandaMontaji: boolean;

    createdAt?: string;
    updatedAt?: string;
    productionStartedAt?: string | null;

    // RELATIONSHIP
    sasiId?: number | null;
    sasi?: Sasi | null;
}


export interface Sasi {
    id: number;
    imalatNo: number | null;
    musteri: string;
    sasiNo: string | null;
    tampon: string | null;
    dingil: string | null;
    adet: number;

    // Sub-steps
    plazmaProgrami: boolean;
    sacMalzemeKontrolu: boolean;
    plazmaKesim: boolean;
    presBukum: boolean;

    lenjorenMontaji: boolean;
    robotKaynagi: boolean;

    saseFiksturCatim: boolean;
    kaynak: boolean;
    dingilMontaji: boolean;
    genelKaynak: boolean;
    tesisatCubugu: boolean;
    mekanikAyak: boolean;
    korukMontaji: boolean;
    lastikMontaji: boolean;

    // Calculated statuses
    kesimBukumStatus?: string;
    onHazirlikStatus?: string;
    montajStatus?: string;

    createdAt?: string;
    updatedAt?: string;
    productionStartedAt?: string | null;

    // RELATIONSHIP
    isLinked?: boolean;
    linkedDorseId?: number;
    linkedDorseMusteri?: string;
}

export type VerimlilikProductType = 'DAMPER' | 'DORSE' | 'SASI';

export interface VerimlilikStepRow {
    mainStepKey: string;
    label: string;
    current: number;
    previous: number;
    delta: number;
    deltaPercent: number | null;
    capacityNormalHours: number | null;
    capacityOvertimeHours: number | null;
    capacityTotalHours: number | null;
    efficiency: number | null;
    previousCapacityTotalHours: number | null;
    previousEfficiency: number | null;
    avgHeadcountInPeriod: number | null;
    /** Dönemle örtüşen haftalarda girilen hedef adet (orantılı toplam) */
    targetInPeriod?: number | null;
    previousTargetInPeriod?: number | null;
    targetVariance?: number | null;
    previousTargetVariance?: number | null;
}

export interface VerimlilikScheduleDefaults {
    workDaysPerWeek: number;
    netHoursPerDay: number;
    hoursPerPersonWeek: number;
    description: string;
}

export interface VerimlilikResponse {
    productType: string;
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    steps: VerimlilikStepRow[];
    trackedProductCountWithT0: number;
    scheduleDefaults: VerimlilikScheduleDefaults;
}

export async function getVerimlilik(
    type: VerimlilikProductType,
    fromIso: string,
    toIso: string
): Promise<VerimlilikResponse> {
    const q = new URLSearchParams({ type, from: fromIso, to: toIso });
    const res = await fetch(`${API_URL}/analytics/verimlilik?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<VerimlilikResponse>(res);
}

export interface CapacityScheduleDefaults {
    workDaysPerWeek: number;
    netHoursPerDay: number;
    hoursPerPersonWeek: number;
    description: string;
}

export interface CapacityWeekRow {
    mainStepKey: string;
    label: string;
    headcount: number;
    normalHours: number;
    overtimeHours: number;
    targetCount: number;
}

export interface CapacityWeekResponse {
    productType: string;
    weekStart: string;
    hoursPerPersonWeek: number;
    rows: CapacityWeekRow[];
}

export async function getCapacityDefaults(): Promise<CapacityScheduleDefaults> {
    const res = await fetch(`${API_URL}/capacity/defaults`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<CapacityScheduleDefaults>(res);
}

export async function getCapacityWeek(
    type: VerimlilikProductType,
    weekStart: string
): Promise<CapacityWeekResponse> {
    const q = new URLSearchParams({ type, weekStart });
    const res = await fetch(`${API_URL}/capacity/week?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<CapacityWeekResponse>(res);
}

export async function putCapacityWeek(body: {
    productType: VerimlilikProductType;
    weekStart: string;
    mainStepKey: string;
    headcount: number;
    normalHours: number;
    overtimeHours: number;
}): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_URL}/capacity/week`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<Record<string, unknown>>(res);
}

export async function deleteCapacityWeek(
    type: VerimlilikProductType,
    weekStart: string,
    mainStepKey: string
): Promise<void> {
    const q = new URLSearchParams({ type, weekStart, mainStepKey });
    const res = await fetch(`${API_URL}/capacity/week?${q.toString()}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    await handleResponse(res);
}

export async function postAiInsight(body: {
    type: VerimlilikProductType;
    from: string;
    to: string;
}): Promise<{ text: string; model: string }> {
    const res = await fetch(`${API_URL}/analytics/ai-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<{ text: string; model: string }>(res);
}

export interface SearchHit {
    productType: 'DAMPER' | 'DORSE' | 'SASI';
    id: number;
    imalatNo: number | null;
    musteri: string | null;
    sasiNo?: string | null;
}

export interface SearchResponse {
    q: string;
    dampers: SearchHit[];
    dorses: SearchHit[];
    sasis: SearchHit[];
}

export async function getSearch(q: string): Promise<SearchResponse> {
    const params = new URLSearchParams({ q });
    const res = await fetch(`${API_URL}/search?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<SearchResponse>(res);
}

export interface AuditLogRow {
    id: number;
    userId: number | null;
    username: string | null;
    action: string;
    productType: string;
    productId: number;
    summary: string | null;
    details: unknown;
    createdAt: string;
    user?: { username: string; fullName: string } | null;
}

export interface AuditLogsResponse {
    rows: AuditLogRow[];
    total: number;
    limit: number;
    skip: number;
}

export async function getAuditLogs(params?: {
    limit?: number;
    skip?: number;
    productType?: string;
    productId?: number;
}): Promise<AuditLogsResponse> {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.productType) q.set('productType', params.productType);
    if (params?.productId != null) q.set('productId', String(params.productId));
    const res = await fetch(`${API_URL}/audit-logs?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<AuditLogsResponse>(res);
}

export interface StaleProductsResponse {
    days: number;
    cutoff: string;
    dampers: Array<{ productType: 'DAMPER'; id: number; imalatNo: number | null; musteri: string; updatedAt: string }>;
    dorses: Array<{ productType: 'DORSE'; id: number; imalatNo: number | null; musteri: string; updatedAt: string }>;
    sasis: Array<{
        productType: 'SASI';
        id: number;
        imalatNo: number | null;
        musteri: string | null;
        sasiNo: string | null;
        updatedAt: string;
    }>;
}

export async function getStaleProducts(days = 14): Promise<StaleProductsResponse> {
    const res = await fetch(`${API_URL}/analytics/stale-products?days=${days}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<StaleProductsResponse>(res);
}

export async function putCapacityTarget(body: {
    productType: VerimlilikProductType;
    weekStart: string;
    mainStepKey: string;
    targetCount: number;
}): Promise<Record<string, unknown>> {
    const res = await fetch(`${API_URL}/capacity/target`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<Record<string, unknown>>(res);
}

export async function deleteCapacityTarget(
    type: VerimlilikProductType,
    weekStart: string,
    mainStepKey: string
): Promise<void> {
    const q = new URLSearchParams({ type, weekStart, mainStepKey });
    const res = await fetch(`${API_URL}/capacity/target?${q.toString()}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    await handleResponse(res);
}

export async function getDorses(): Promise<Dorse[]> {
    const res = await fetch(`${API_URL}/dorses`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dorse[]>(res);
}

export async function createDorse(data: Partial<Dorse>): Promise<Dorse> {
    const res = await fetch(`${API_URL}/dorses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Dorse>(res);
}

export async function updateDorse(id: number, data: Partial<Dorse>): Promise<Dorse> {
    const res = await fetch(`${API_URL}/dorses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Dorse>(res);
}

export async function deleteDorse(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/dorses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete dorse');
}

export async function getSasis(unlinkedOnly = false): Promise<Sasi[]> {
    const url = unlinkedOnly ? `${API_URL}/sasis?unlinkedOnly=true` : `${API_URL}/sasis`;
    const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Sasi[]>(res);
}

export async function getSasi(id: number): Promise<Sasi> {
    const res = await fetch(`${API_URL}/sasis/${id}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Sasi>(res);
}

export async function createSasi(data: Partial<Sasi>): Promise<Sasi> {
    const res = await fetch(`${API_URL}/sasis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Sasi>(res);
}

export async function updateSasi(id: number, data: Partial<Sasi>): Promise<Sasi> {
    const res = await fetch(`${API_URL}/sasis/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Sasi>(res);
}

export async function deleteSasi(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/sasis/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete sasi');
}

export async function getDorse(id: number): Promise<Dorse> {
    const res = await fetch(`${API_URL}/dorses/${id}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dorse>(res);
}

export async function linkSasi(dorseId: number, sasiId: number): Promise<Dorse> {
    const res = await fetch(`${API_URL}/dorses/${dorseId}/link-sasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sasiId }),
    });
    return handleResponse<Dorse>(res);
}

export async function unlinkSasi(dorseId: number): Promise<Dorse> {
    const res = await fetch(`${API_URL}/dorses/${dorseId}/link-sasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sasiId: null }),
    });
    return handleResponse<Dorse>(res);
}

export const DORSE_STEP_GROUPS = [
    {
        key: 'kesimBukum',
        name: 'KESİM - BÜKÜM',
        subSteps: [
            { key: 'plazmaProgrami', label: 'Plazma Programı' },
            { key: 'sacMalzemeKontrolu', label: 'Sac Malzeme Kontrolü' },
            { key: 'plazmaKesim', label: 'Plazma Kesim' },
            { key: 'presBukum', label: 'Pres Büküm' },
            { key: 'dorseSasi', label: 'Dorse Şasi' },
        ],
    },
    {
        key: 'onHazirlik',
        name: 'ÖN HAZIRLIK',
        subSteps: [
            { key: 'milAltKutuk', label: 'Mil Alt Kütük' },
            { key: 'taban', label: 'Taban' },
            { key: 'yan', label: 'Yan' },
            { key: 'onGogus', label: 'Ön Göğüs' },
            { key: 'arkaKapak', label: 'Arka Kapak' },
            { key: 'yuklemeMalzemesi', label: 'Yükleme Malzemesi' },
        ],
    },
    {
        key: 'montaj',
        name: 'MONTAJ',
        subSteps: [
            { key: 'dorseKurulmasi', label: 'Dorse Kurulması' },
            { key: 'dorseKaynak', label: 'Dorse Kaynak' },
            { key: 'kapakSiperlik', label: 'Kapak Siperlik' },
            { key: 'yukleme', label: 'Yükleme' },
            { key: 'hidrolik', label: 'Hidrolik' },
        ],
    },
    {
        key: 'boya',
        name: 'BOYA',
        subSteps: [
            { key: 'boyaHazirlik', label: 'Boya Hazırlık' },
            { key: 'dorseSasiBoyama', label: 'Dorse Şasi Boyama' },
        ],
    },
    {
        key: 'cekici',
        name: 'ÇEKİCİ',
        subSteps: [
            { key: 'cekiciElektrik', label: 'Çekici Elektrik' },
            { key: 'cekiciHidrolik', label: 'Çekici Hidrolik' },
        ],
    },
    {
        key: 'tamamlama',
        name: 'TAMAMLAMA',
        subSteps: [
            { key: 'fren', label: 'Fren' },
            { key: 'dorseElektrik', label: 'Dorse Elektrik' },
            { key: 'tamamlama', label: 'Tamamlama' },
            { key: 'aracKontrolBypassAyari', label: 'Araç kontrol bypass ayarı' },
            { key: 'brandaMontaji', label: 'Branda Montajı' },
        ],
    },
    {
        key: 'sonKontrol',
        name: 'SON KONTROL',
        subSteps: [
            { key: 'sonKontrol', label: 'Son Kontrol' },
            { key: 'tipOnay', label: 'Tip Onay' },
            { key: 'fatura', label: 'Fatura' },
            { key: 'akmTseMuayenesi', label: 'Akm-Tse Muayenesi' },
            { key: 'dmoMuayenesi', label: 'Dmo Muayenesi' },
            { key: 'tahsilat', label: 'Tahsilat' },
            { key: 'teslimat', label: 'Teslimat' },
        ],
    },
];

export const SASI_STEP_GROUPS = [
    {
        key: 'kesimBukum',
        name: 'KESİM - BÜKÜM',
        statusKey: 'kesimBukumStatus',
        subSteps: [
            { key: 'plazmaProgrami', label: 'Plazma Programı' },
            { key: 'sacMalzemeKontrolu', label: 'Sac Malzeme Kontrolü' },
            { key: 'plazmaKesim', label: 'Plazma Kesim' },
            { key: 'presBukum', label: 'Pres Büküm' },
        ],
    },
    {
        key: 'onHazirlik',
        name: 'ÖN HAZIRLIK',
        statusKey: 'onHazirlikStatus',
        subSteps: [
            { key: 'lenjorenMontaji', label: 'Lenjorenlerin Montajı' },
            { key: 'robotKaynagi', label: 'Robot Kaynağı' },
        ],
    },
    {
        key: 'montaj',
        name: 'MONTAJ',
        statusKey: 'montajStatus',
        subSteps: [
            { key: 'saseFiksturCatim', label: 'Şase fikstüründe çatım' },
            { key: 'kaynak', label: 'Kaynak' },
            { key: 'dingilMontaji', label: 'Dingil Montajı' },
            { key: 'genelKaynak', label: 'Genel Kaynakların Yapılması' },
            { key: 'tesisatCubugu', label: 'Tesisat çubuğu' },
            { key: 'mekanikAyak', label: 'Mekanik ayak' },
            { key: 'korukMontaji', label: 'Körüklerin Montajı' },
            { key: 'lastikMontaji', label: 'Lastik montajı' },
        ],
    },
];
