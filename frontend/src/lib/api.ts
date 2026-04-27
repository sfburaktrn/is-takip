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

    teslimSasiNo?: string | null;
    teslimEden?: string | null;
    teslimAlan?: string | null;
    /** Otomatik = musteri (kilitli) */
    teslimAlanFirma?: string | null;
    teslimNot?: string | null;
    teslimAt?: string | null;

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
    /** Kart üzerindeki serbest not (veritabanı) */
    cardNote?: string | null;
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
    teslimEdilen?: number;
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
    dorseFren?: string[];
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

/** Uyku sonrası proxy/container uyanırken gelen 502/503/504 ve geçici ağ kopmaları */
const RETRYABLE_HTTP = new Set([408, 429, 502, 503, 504]);
const MAX_API_ATTEMPTS = 5;
const API_RETRY_BASE_MS = 550;

function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

export async function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_API_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(input, init);
            if (res.ok || !RETRYABLE_HTTP.has(res.status)) {
                return res;
            }
            await res.text().catch(() => {});
            lastError = new Error(`HTTP ${res.status}`);
        } catch (e) {
            // If the caller aborted (timeout/navigation), do NOT retry; it will never succeed.
            if (e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'AbortError') {
                throw e;
            }
            lastError = e;
        }
        if (attempt < MAX_API_ATTEMPTS - 1) {
            const backoff = API_RETRY_BASE_MS * Math.pow(1.65, attempt) + Math.random() * 300;
            await sleep(backoff);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// API Functions
export async function getDampers(): Promise<Damper[]> {
    const res = await apiFetch(`${API_URL}/dampers`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Damper[]>(res);
}

export async function getDamper(id: number): Promise<Damper> {
    const res = await apiFetch(`${API_URL}/dampers/${id}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Damper>(res);
}

export async function createDamper(data: Partial<Damper>): Promise<Damper> {
    const res = await apiFetch(`${API_URL}/dampers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Damper>(res);
}

export async function updateDamper(id: number, data: Partial<Damper>): Promise<Damper> {
    const res = await apiFetch(`${API_URL}/dampers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Damper>(res);
}

export async function deleteDamper(id: number): Promise<void> {
    const res = await apiFetch(`${API_URL}/dampers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete damper');
}

export async function getDampersSummary(): Promise<DamperSummary[]> {
    const res = await apiFetch(`${API_URL}/dampers-summary`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<DamperSummary[]>(res);
}

export async function getDorsesSummary(): Promise<DorseSummary[]> {
    const res = await apiFetch(`${API_URL}/dorses-summary`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<DorseSummary[]>(res);
}

export async function getStats(type: 'DAMPER' | 'DORSE' | 'SASI' = 'DAMPER'): Promise<Stats> {
    const res = await apiFetch(`${API_URL}/stats?type=${type}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Stats>(res);
}

export async function getDropdowns(): Promise<Dropdowns> {
    const res = await apiFetch(`${API_URL}/dropdowns`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dropdowns>(res);
}

export async function getCompanySummary(type: 'DAMPER' | 'DORSE' | 'SASI' = 'DAMPER'): Promise<CompanySummary[]> {
    const res = await apiFetch(`${API_URL}/company-summary?type=${type}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<CompanySummary[]>(res);
}

export async function deleteCompanyM3Group(companyName: string, m3: string, type: 'DAMPER' | 'DORSE' = 'DAMPER'): Promise<void> {
    const res = await apiFetch(`${API_URL}/company-m3`, {
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
    /** Wabco / Knorr — tamamlama adımındaki boolean fren alanından ayrı */
    frenMarka?: string | null;

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

    frenProgrami: boolean;
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

    teslimSasiNo?: string | null;
    teslimEden?: string | null;
    teslimAlan?: string | null;
    /** Otomatik = musteri (kilitli) */
    teslimAracSahibi?: string | null;
    teslimNot?: string | null;
    teslimAt?: string | null;

    branda: boolean;
    brandaMontaji: boolean;

    createdAt?: string;
    updatedAt?: string;
    productionStartedAt?: string | null;
    cardNote?: string | null;

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
    cardNote?: string | null;

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
    const res = await apiFetch(`${API_URL}/analytics/verimlilik?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<VerimlilikResponse>(res);
}

export type PlanningProductType = 'DAMPER' | 'DORSE';

/** Teklif plan segmenti (onaylı teklif üretim planı). */
export interface ProposalPlanSegmentRow {
    id: number;
    proposalIngestId: number;
    unitIndex: number;
    mainStepKey: string;
    plannedStart: string;
    plannedEnd: string;
    durationDays: number | null;
}

/** Teklif Takip'ten gelen onaylı teklif özeti. */
export interface ProposalIngestRow {
    id: number;
    sourceProposalId: string;
    companyName: string;
    proposalDate: string;
    quantity: number;
    equipment: string | null;
    vehicle: string | null;
    volume: string | null;
    thickness: string | null;
    deliveryDate: string | null;
    contactPerson: string | null;
    notes: string | null;
    ownerEmail: string | null;
    pushedAt: string;
    pushedBy: string | null;
    approvalLoggedAt: string | null;
    imalataAlindi: boolean;
    teknikPdfUrl: string | null;
    manufacturingNot: string | null;
    manufacturingAciliyet: 'Normal' | 'Acil' | 'Çok Acil' | null;
    planningProductType?: PlanningProductType | null;
    expectedDeliveryDays?: number | null;
    targetDeliveryDate?: string | null;
    planSegments?: ProposalPlanSegmentRow[];
    createdAt: string;
    updatedAt: string;
}

export interface PlanningMetaStep {
    mainStepKey: string;
    label: string;
}

export interface PlanningMetaResponse {
    productType: PlanningProductType;
    steps: PlanningMetaStep[];
}

export interface PlanningAlertsResponse {
    overdue: Array<{
        id: number;
        companyName: string;
        deadline: string;
        planningProductType: string | null;
        imalataAlindi: boolean;
    }>;
    dueSoon: Array<{
        id: number;
        companyName: string;
        deadline: string;
        planningProductType: string | null;
        imalataAlindi: boolean;
    }>;
    soonDays: number;
}

export interface PutProposalPlanningBody {
    planningProductType?: PlanningProductType | null;
    expectedDeliveryDays?: number | null;
    targetDeliveryDate?: string | null;
    segments?: Array<{
        unitIndex?: number;
        mainStepKey: string;
        plannedStart: string;
        plannedEnd: string;
        durationDays?: number | null;
    }>;
}

export async function getProposalIngestList(limit = 300): Promise<ProposalIngestRow[]> {
    const q = new URLSearchParams({ limit: String(limit) });
    const res = await apiFetch(`${API_URL}/integrations/teklif-takip/proposals?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<ProposalIngestRow[]>(res);
}

export async function patchProposalIngest(id: number, imalataAlindi: boolean): Promise<ProposalIngestRow> {
    const res = await apiFetch(`${API_URL}/integrations/teklif-takip/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imalataAlindi }),
    });
    return handleResponse<ProposalIngestRow>(res);
}

export async function deleteProposalIngest(id: number): Promise<void> {
    const res = await apiFetch(`${API_URL}/integrations/teklif-takip/proposals/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${text.substring(0, 500)}`);
    }
}

/** Mevcut işlerde "İmalata alındı" işaretli onaylı teklifler + plan segmentleri. */
export async function getPlanningProposals(limit = 300): Promise<ProposalIngestRow[]> {
    const q = new URLSearchParams({ limit: String(limit) });
    const res = await apiFetch(`${API_URL}/planning/proposals?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<ProposalIngestRow[]>(res);
}

export async function getPlanningMeta(type: PlanningProductType): Promise<PlanningMetaResponse> {
    const q = new URLSearchParams({ type });
    const res = await apiFetch(`${API_URL}/planning/meta?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<PlanningMetaResponse>(res);
}

export async function getPlanningAlerts(soonDays = 3): Promise<PlanningAlertsResponse> {
    const q = new URLSearchParams({ soonDays: String(soonDays) });
    const res = await apiFetch(`${API_URL}/planning/alerts?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<PlanningAlertsResponse>(res);
}

export async function putProposalPlanning(id: number, body: PutProposalPlanningBody): Promise<ProposalIngestRow> {
    const res = await apiFetch(`${API_URL}/planning/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<ProposalIngestRow>(res);
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
    const res = await apiFetch(`${API_URL}/capacity/defaults`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<CapacityScheduleDefaults>(res);
}

export async function getCapacityWeek(
    type: VerimlilikProductType,
    weekStart: string
): Promise<CapacityWeekResponse> {
    const q = new URLSearchParams({ type, weekStart });
    const res = await apiFetch(`${API_URL}/capacity/week?${q.toString()}`, {
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
    const res = await apiFetch(`${API_URL}/capacity/week`, {
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
    const res = await apiFetch(`${API_URL}/capacity/week?${q.toString()}`, {
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
    const res = await apiFetch(`${API_URL}/analytics/ai-insight`, {
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
    const res = await apiFetch(`${API_URL}/search?${params.toString()}`, {
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
    const res = await apiFetch(`${API_URL}/audit-logs?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<AuditLogsResponse>(res);
}

export interface NotificationItem {
    id: number;
    kind: string;
    productType: string;
    productId: number;
    title: string;
    body: string | null;
    createdAt: string;
    readAt: string | null;
    actor: { username: string; fullName: string } | null;
}

export interface NotificationsResponse {
    items: NotificationItem[];
    total: number;
    limit: number;
    skip: number;
}

export async function getNotifications(params?: {
    limit?: number;
    skip?: number;
    unreadOnly?: boolean;
    kind?: 'NEW_PRODUCT' | 'PROPOSAL_TEKLIF';
}): Promise<NotificationsResponse> {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.skip != null) q.set('skip', String(params.skip));
    if (params?.unreadOnly) q.set('unreadOnly', '1');
    if (params?.kind) q.set('kind', params.kind);
    const res = await apiFetch(`${API_URL}/notifications?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<NotificationsResponse>(res);
}

export async function getUnreadNotificationCount(params?: {
    forPopup?: boolean;
}): Promise<{ count: number; windowHours?: number }> {
    const q = new URLSearchParams();
    if (params?.forPopup) q.set('forPopup', '1');
    const qs = q.toString();
    const res = await apiFetch(`${API_URL}/notifications/unread-count${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<{ count: number; windowHours?: number }>(res);
}

export async function getUnreadNotificationBreakdown(): Promise<{
    product: number;
    proposal: number;
    total: number;
}> {
    const res = await apiFetch(`${API_URL}/notifications/unread-breakdown`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<{ product: number; proposal: number; total: number }>(res);
}

export async function markNotificationRead(id: number): Promise<{ ok: boolean }> {
    const res = await apiFetch(`${API_URL}/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
    });
    return handleResponse<{ ok: boolean }>(res);
}

export async function syncProposalNotifications(): Promise<{ ok: boolean; scanned?: number; created?: number; skipped?: string; error?: string }> {
    const res = await apiFetch(`${API_URL}/notifications/debug/sync-proposals`, {
        method: 'POST',
        credentials: 'include',
    });
    return handleResponse<{ ok: boolean; scanned?: number; created?: number; skipped?: string; error?: string }>(res);
}

export async function markAllNotificationsRead(params?: {
    onlyPopupRecent?: boolean;
}): Promise<{ marked: number }> {
    const q = new URLSearchParams();
    if (params?.onlyPopupRecent) q.set('onlyPopupRecent', '1');
    const qs = q.toString();
    const res = await apiFetch(`${API_URL}/notifications/read-all${qs ? `?${qs}` : ''}`, {
        method: 'POST',
        credentials: 'include',
    });
    return handleResponse<{ marked: number }>(res);
}

export function isProposalNotification(n: Pick<NotificationItem, 'kind' | 'productType'>): boolean {
    return n.kind === 'PROPOSAL_TEKLIF' || n.productType === 'PROPOSAL';
}

export function notificationItemHref(n: NotificationItem): string {
    if (isProposalNotification(n)) {
        return `/mevcut-isler?highlight=${n.productId}`;
    }
    return `/urun-listesi?type=${encodeURIComponent(n.productType)}&expand=${n.productId}`;
}

/** Stok takip */
export interface StockGroupRow {
    id: number;
    name: string;
    sortOrder: number;
    itemCount: number;
}

export interface StockItemRow {
    id: number;
    groupId: number;
    group: { id: number; name: string };
    purchaseCode: string | null;
    description: string;
    unit: string | null;
    quantity: string | null;
    supplierName: string | null;
    supplierContact: string | null;
    createdAt: string;
    updatedAt: string;
    latestUnitPrice: number | null;
    previousUnitPrice: number | null;
    priceChangePercent: number | null;
}

export interface StockItemsResponse {
    items: StockItemRow[];
    total: number;
    limit: number;
    skip: number;
}

export interface StockMovementRow {
    id: number;
    type: 'IN' | 'OUT';
    quantity: number;
    balanceAfter: number | null;
    note: string | null;
    recordedAt: string;
    user: { username: string; fullName: string } | null;
}

export interface StockSupplierHistoryRow {
    id: number;
    prevSupplierName: string | null;
    prevSupplierContact: string | null;
    supplierName: string | null;
    supplierContact: string | null;
    note: string | null;
    recordedAt: string;
    user: { username: string; fullName: string } | null;
}

export interface StockPriceHistoryPoint {
    id: number;
    recordedAt: string;
    unitPrice: number;
    note: string | null;
    supplierName: string | null;
    supplierContact: string | null;
}

export interface StockItemDetail {
    id: number;
    groupId: number;
    group: { id: number; name: string };
    purchaseCode: string | null;
    description: string;
    unit: string | null;
    quantity: number | null;
    supplierName: string | null;
    supplierContact: string | null;
    createdAt: string;
    updatedAt: string;
    latestUnitPrice: number | null;
    previousUnitPrice: number | null;
    priceChangePercent: number | null;
    priceChangeAbs: number | null;
    priceHistory: StockPriceHistoryPoint[];
    movements: StockMovementRow[];
    supplierHistory: StockSupplierHistoryRow[];
}

export async function getStockGroups(): Promise<StockGroupRow[]> {
    const res = await apiFetch(`${API_URL}/stock/groups`, { credentials: 'include', cache: 'no-store' });
    return handleResponse<StockGroupRow[]>(res);
}

export async function getStockItems(params?: {
    groupId?: number;
    q?: string;
    limit?: number;
    skip?: number;
}): Promise<StockItemsResponse> {
    const q = new URLSearchParams();
    if (params?.groupId != null) q.set('groupId', String(params.groupId));
    if (params?.q != null && params.q.trim().length >= 2) q.set('q', params.q.trim());
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.skip != null) q.set('skip', String(params.skip));
    const qs = q.toString();
    const res = await apiFetch(`${API_URL}/stock/items${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<StockItemsResponse>(res);
}

export async function createStockItem(body: {
    groupId?: number;
    groupName?: string;
    purchaseCode?: string | null;
    description: string;
    unit?: string | null;
    quantity?: string | number | null;
    supplierName?: string | null;
    supplierContact?: string | null;
}): Promise<Record<string, unknown>> {
    const res = await apiFetch(`${API_URL}/stock/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<Record<string, unknown>>(res);
}

export async function updateStockItem(
    id: number,
    body: Partial<{
        groupId: number;
        purchaseCode: string | null;
        description: string;
        unit: string | null;
        quantity: string | number | null;
        supplierName: string | null;
        supplierContact: string | null;
    }>
): Promise<Record<string, unknown>> {
    const res = await apiFetch(`${API_URL}/stock/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<Record<string, unknown>>(res);
}

export async function addStockItemPrice(
    id: number,
    body: { unitPrice: number; note?: string | null }
): Promise<{ id: number; stockItemId: number; recordedAt: string; unitPrice: unknown; note: string | null }> {
    const res = await apiFetch(`${API_URL}/stock/items/${id}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse(res);
}

export async function getStockItemDetail(id: number): Promise<StockItemDetail> {
    const res = await apiFetch(`${API_URL}/stock/items/${id}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<StockItemDetail>(res);
}

export async function addStockMovement(
    id: number,
    body: { type: 'IN' | 'OUT'; quantity: number; note?: string | null }
): Promise<StockMovementRow & { currentQuantity: number }> {
    const res = await apiFetch(`${API_URL}/stock/items/${id}/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse(res);
}

export async function changeStockSupplier(
    id: number,
    body: { supplierName?: string | null; supplierContact?: string | null; note?: string | null }
): Promise<StockSupplierHistoryRow> {
    const res = await apiFetch(`${API_URL}/stock/items/${id}/supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    return handleResponse<StockSupplierHistoryRow>(res);
}

export async function deleteStockSupplierHistory(itemId: number, histId: number): Promise<{ ok: true }> {
    const res = await apiFetch(`${API_URL}/stock/items/${itemId}/supplier-history/${histId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    return handleResponse<{ ok: true }>(res);
}

export async function deleteStockPriceHistory(itemId: number, histId: number): Promise<{ ok: true }> {
    const res = await apiFetch(`${API_URL}/stock/items/${itemId}/price-history/${histId}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    return handleResponse<{ ok: true }>(res);
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
    const res = await apiFetch(`${API_URL}/analytics/stale-products?days=${days}`, {
        credentials: 'include',
        cache: 'no-store',
    });
    return handleResponse<StaleProductsResponse>(res);
}

export interface StepEventTimelineResponse {
    productType: string;
    productId: number;
    createdAt?: string | null;
    productionStartedAt: string | null;
    productionEndAt?: string | null;
    steps: Array<{ key: string; label: string }>;
    events: Array<{ key: string; completedAt: string }>;
    ranges?: Array<{ key: string; startedAt: string | null; completedAt: string | null }>;
}

export async function getStepEvents(productType: 'DAMPER' | 'DORSE' | 'SASI', productId: number): Promise<StepEventTimelineResponse> {
    const q = new URLSearchParams({ productType, productId: String(productId) });
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    const res = await apiFetch(`${API_URL}/analytics/step-events?${q.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
    }).finally(() => clearTimeout(t));
    return handleResponse<StepEventTimelineResponse>(res);
}

export async function putCapacityTarget(body: {
    productType: VerimlilikProductType;
    weekStart: string;
    mainStepKey: string;
    targetCount: number;
}): Promise<Record<string, unknown>> {
    const res = await apiFetch(`${API_URL}/capacity/target`, {
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
    const res = await apiFetch(`${API_URL}/capacity/target?${q.toString()}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    await handleResponse(res);
}

export async function getDorses(): Promise<Dorse[]> {
    const res = await apiFetch(`${API_URL}/dorses`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dorse[]>(res);
}

export async function createDorse(data: Partial<Dorse>): Promise<Dorse> {
    const res = await apiFetch(`${API_URL}/dorses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Dorse>(res);
}

export async function updateDorse(id: number, data: Partial<Dorse>): Promise<Dorse> {
    const res = await apiFetch(`${API_URL}/dorses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Dorse>(res);
}

export async function deleteDorse(id: number): Promise<void> {
    const res = await apiFetch(`${API_URL}/dorses/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete dorse');
}

export async function getSasis(unlinkedOnly = false): Promise<Sasi[]> {
    const url = unlinkedOnly ? `${API_URL}/sasis?unlinkedOnly=true` : `${API_URL}/sasis`;
    const res = await apiFetch(url, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Sasi[]>(res);
}

export async function getSasi(id: number): Promise<Sasi> {
    const res = await apiFetch(`${API_URL}/sasis/${id}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Sasi>(res);
}

export async function createSasi(data: Partial<Sasi>): Promise<Sasi> {
    const res = await apiFetch(`${API_URL}/sasis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Sasi>(res);
}

export async function updateSasi(id: number, data: Partial<Sasi>): Promise<Sasi> {
    const res = await apiFetch(`${API_URL}/sasis/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    return handleResponse<Sasi>(res);
}

export async function deleteSasi(id: number): Promise<void> {
    const res = await apiFetch(`${API_URL}/sasis/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete sasi');
}

export async function getDorse(id: number): Promise<Dorse> {
    const res = await apiFetch(`${API_URL}/dorses/${id}`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dorse>(res);
}

export async function linkSasi(dorseId: number, sasiId: number): Promise<Dorse> {
    const res = await apiFetch(`${API_URL}/dorses/${dorseId}/link-sasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sasiId }),
    });
    return handleResponse<Dorse>(res);
}

export async function unlinkSasi(dorseId: number): Promise<Dorse> {
    const res = await apiFetch(`${API_URL}/dorses/${dorseId}/link-sasi`, {
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
            { key: 'dorseElektrik', label: 'Dorse Elektrik' },
            { key: 'fren', label: 'Fren' },
            { key: 'tamamlama', label: 'Tamamlama' },
            { key: 'frenProgrami', label: 'Fren Programı' },
            { key: 'brandaMontaji', label: 'Branda Montajı' },
            { key: 'aracKontrolBypassAyari', label: 'Araç kontrol bypass ayarı' },
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
