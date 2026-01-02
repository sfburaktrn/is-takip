// API base URL
const getBaseUrl = () => {
    // In browser (client-side)
    if (typeof window !== 'undefined') {
        // Check if we're on localhost (development)
        if (window.location.hostname === 'localhost') {
            return 'http://localhost:3001/api';
        }
        // Production: use proxy to avoid cross-domain cookie issues
        return '/api/proxy';
    }

    // Server-side: use direct backend URL
    let url = process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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
    m3: number | null;
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
    m3: number | null;
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

export interface Stats {
    total: number;
    tamamlanan: number;
    devamEden: number;
    baslamayan: number;
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
    m3: number;
    count: number;
    tamamlanan: number;
    devamEden: number;
    baslamayan: number;
    stepStats: StepStats;
}

export interface CompanyDamper {
    id: number;
    imalatNo: number;
    musteri: string;
    m3: number;
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
    kesimBukum: StepStat;
    sasiBitis: StepStat;
    onHazirlik: StepStat;
    montaj: StepStat;
    hidrolik: StepStat;
    boyaBitis: StepStat;
    tamamlamaBitis: StepStat;
    sonKontrol: StepStat;
    kurumMuayenesi: StepStat;
    dmoMuayenesi: StepStat;
    teslimat: StepStat;
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
        throw new Error(`API Error: ${res.status} ${res.statusText} - ${text.substring(0, 100)}`);
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

export async function getStats(): Promise<Stats> {
    const res = await fetch(`${API_URL}/stats`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Stats>(res);
}

export async function getDropdowns(): Promise<Dropdowns> {
    const res = await fetch(`${API_URL}/dropdowns`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<Dropdowns>(res);
}

export async function getCompanySummary(): Promise<CompanySummary[]> {
    const res = await fetch(`${API_URL}/company-summary`, { cache: 'no-store', credentials: 'include' });
    return handleResponse<CompanySummary[]>(res);
}

export async function deleteCompanyM3Group(companyName: string, m3: number): Promise<void> {
    const res = await fetch(`${API_URL}/company-m3`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ companyName, m3 }),
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
