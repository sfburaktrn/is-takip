'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import { SshBolgePick, SshModernSelect } from '@/components/ssh/SshChoiceField';
import Sidebar from '@/components/Sidebar';
import OzunluLoading from '@/components/OzunluLoading';
import {
    createSshComplaint,
    deleteSshComplaint,
    getNextSshTalepNo,
    getSshComplaints,
    getSshPartCodes,
    getSshStats,
    updateSshComplaint,
    type SshComplaint,
    type SshComplaintInput,
    type SshPartCodes,
    type SshStats,
    type SshStatus,
} from '@/lib/api';
import {
    AlertCircle,
    AlertTriangle,
    BarChart3,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    FileText,
    Headphones,
    Inbox,
    Loader2,
    Plus,
    RefreshCcw,
    Save,
    Search,
    Shield,
    Trash2,
    TrendingUp,
    Truck,
    Wallet,
    Wrench,
    X,
} from 'lucide-react';

type StatusFilter = 'ALL' | SshStatus;

function fmtCurrency(v: number | null | undefined) {
    if (v == null || Number.isNaN(v)) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v);
}

function fmtPct(rate: number) {
    return `${(rate * 100).toFixed(0)}%`;
}

function toDateInput(iso: string | null | undefined) {
    if (!iso) return '';
    try {
        return iso.slice(0, 10);
    } catch {
        return '';
    }
}

function todayInput() {
    return new Date().toISOString().slice(0, 10);
}

function normalizeStatusValue(raw?: string | null): SshStatus {
    const s = String(raw ?? 'AÇIK')
        .trim()
        .toUpperCase()
        .replace(/İ/g, 'I');
    if (s === 'KAPALI' || s.startsWith('KAPAL')) return 'KAPALI';
    return 'AÇIK';
}

function SshStatusToggle({
    value,
    onChange,
    compact,
}: {
    value: SshStatus;
    onChange: (s: SshStatus) => void;
    compact?: boolean;
}) {
    return (
        <div className={`ssh-status-toggle ${compact ? 'ssh-status-toggle--compact' : ''}`} role="group" aria-label="Şikayet durumu">
            <button
                type="button"
                className={`ssh-status-toggle__btn ssh-status-toggle__btn--open ${value === 'AÇIK' ? 'is-active' : ''}`}
                onClick={() => onChange('AÇIK')}
            >
                Açık
            </button>
            <button
                type="button"
                className={`ssh-status-toggle__btn ssh-status-toggle__btn--closed ${value === 'KAPALI' ? 'is-active' : ''}`}
                onClick={() => onChange('KAPALI')}
            >
                Kapalı
            </button>
        </div>
    );
}

/** Bölge 1–3 ve arıza tipi; dolu alanlar "/" ile birleştirilir. */
function buildArizaKoduLive(
    b1?: string | null,
    b2?: string | null,
    b3?: string | null,
    arizaTipi?: string | null
) {
    return [b1, b2, b3, arizaTipi]
        .map(s => (s ?? '').trim())
        .filter(Boolean)
        .join('/');
}

function partProductFromUstYapi(ust?: string | null): 'damper' | 'dorse' | null {
    const u = (ust ?? '').trim().toUpperCase();
    if (u === 'DAMPER') return 'damper';
    if (u === 'DORSE') return 'dorse';
    return null;
}

function withLegacyOption(options: string[], current?: string | null) {
    const cur = (current ?? '').trim();
    if (!cur || options.includes(cur)) return options;
    return [cur, ...options];
}

const EMPTY_FORM: SshComplaintInput = {
    talepTipi: '',
    sikayetBildirimTarihi: todayInput(),
    garantiBaslangicTarihi: todayInput(),
    musteriAdi: '',
    ilgiliKisi: '',
    ilgiliKisiTel: '',
    ustYapiTipi: '',
    sasiMarka: '',
    sasiModel: '',
    aracPlakasi: '',
    sasiNo: '',
    imalatNo: '',
    arizaBolge1: '',
    arizaBolge2: '',
    arizaBolge3: '',
    arizaTipi: '',
    hataKaynagi: '',
    arizaAciklamasi: '',
    tekrarEdenHataSayisi: undefined,
    aracCikisSuresiGun: null,
    cikisSureKatsayisi: null,
    oncelikKatsayisi: null,
    etkiKatsayisi: null,
    analizPuani: null,
    kritikPuan: null,
    fabrikaGarantiKarari: '',
    garantiTipi: '',
    toplamTutar: null,
    onaylananTutar: null,
    faturaTarihi: '',
    onarim: '',
    onarimTarihi: '',
    kokNeden: '',
    kaliciOnlem: '',
    kaliciOnlemTarihi: '',
    status: 'AÇIK',
};

function complaintToForm(c: SshComplaint): SshComplaintInput {
    return {
        talepTipi: c.talepTipi,
        sikayetBildirimTarihi: toDateInput(c.sikayetBildirimTarihi),
        garantiBaslangicTarihi: toDateInput(c.garantiBaslangicTarihi),
        musteriAdi: c.musteriAdi,
        ilgiliKisi: c.ilgiliKisi ?? '',
        ilgiliKisiTel: c.ilgiliKisiTel ?? '',
        ustYapiTipi: c.ustYapiTipi,
        sasiMarka: c.sasiMarka ?? '',
        sasiModel: c.sasiModel ?? '',
        aracPlakasi: c.aracPlakasi ?? '',
        sasiNo: c.sasiNo ?? '',
        imalatNo: c.imalatNo ?? '',
        arizaBolge1: c.arizaBolge1 ?? '',
        arizaBolge2: c.arizaBolge2 ?? '',
        arizaBolge3: c.arizaBolge3 ?? '',
        arizaTipi: c.arizaTipi ?? '',
        hataKaynagi: c.hataKaynagi ?? '',
        arizaAciklamasi: c.arizaAciklamasi ?? '',
        tekrarEdenHataSayisi: c.tekrarEdenHataSayisi,
        aracCikisSuresiGun: c.aracCikisSuresiGun,
        cikisSureKatsayisi: c.cikisSureKatsayisi,
        oncelikKatsayisi: c.oncelikKatsayisi,
        etkiKatsayisi: c.etkiKatsayisi,
        analizPuani: c.analizPuani,
        kritikPuan: c.kritikPuan,
        fabrikaGarantiKarari: c.fabrikaGarantiKarari ?? '',
        garantiTipi: c.garantiTipi ?? '',
        toplamTutar: c.toplamTutar,
        onaylananTutar: c.onaylananTutar,
        faturaTarihi: toDateInput(c.faturaTarihi),
        onarim: c.onarim ?? '',
        onarimTarihi: toDateInput(c.onarimTarihi),
        kokNeden: c.kokNeden ?? '',
        kaliciOnlem: c.kaliciOnlem ?? '',
        kaliciOnlemTarihi: toDateInput(c.kaliciOnlemTarihi),
        status: c.status,
    };
}

function DistBlock({
    title,
    desc,
    rows,
    icon,
}: {
    title: string;
    desc: string;
    rows: { name: string; count: number; rate: number }[];
    icon: React.ReactNode;
}) {
    const max = Math.max(...rows.map(r => r.count), 1);
    return (
        <div className="ssh-glass-card ssh-dist-card">
            <div className="ssh-card-head">
                <div className="ssh-card-head-icon">{icon}</div>
                <div>
                    <h3 className="ssh-card-title">{title}</h3>
                    <p className="ssh-card-desc">{desc}</p>
                </div>
            </div>
            {rows.length === 0 ? (
                <div className="ssh-mini-empty">
                    <Inbox size={28} strokeWidth={1.5} />
                    <span>Henüz veri yok</span>
                </div>
            ) : (
                <ul className="ssh-dist-list">
                    {rows.map(row => (
                        <li key={row.name}>
                            <div className="ssh-dist-row-top">
                                <span className="ssh-dist-name" title={row.name}>
                                    {row.name}
                                </span>
                                <span className="ssh-dist-meta">
                                    {row.count} · {fmtPct(row.rate)}
                                </span>
                            </div>
                            <div className="ssh-dist-bar" aria-hidden>
                                <span className="ssh-dist-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SshPanel({ stats }: { stats: SshStats | null }) {
    if (!stats) return null;
    return (
        <section className="ssh-panel">
            <div className="stats-grid ssh-kpi-grid">
                <div className="stat-card stat-card--accent-primary ssh-kpi-card">
                    <div className="analiz-stat-icon analiz-stat-icon--primary">
                        <ClipboardList size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <div className="stat-value stat-value--default">{stats.total}</div>
                        <div className="stat-label stat-label--default">Toplam şikayet</div>
                    </div>
                </div>
                <div className="stat-card stat-card--accent-warning ssh-kpi-card">
                    <div className="analiz-stat-icon analiz-stat-icon--warning">
                        <AlertCircle size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <div className="stat-value stat-value--default">{stats.acik}</div>
                        <div className="stat-label stat-label--default">Açık şikayet</div>
                    </div>
                </div>
                <div className="stat-card stat-card--accent-success ssh-kpi-card">
                    <div className="analiz-stat-icon analiz-stat-icon--success">
                        <CheckCircle2 size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <div className="stat-value stat-value--default">{stats.kapali}</div>
                        <div className="stat-label stat-label--default">Kapalı şikayet</div>
                    </div>
                </div>
                <div className="stat-card stat-card--accent-danger ssh-kpi-card">
                    <div className="analiz-stat-icon analiz-stat-icon--danger">
                        <Wallet size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <div className="stat-value stat-value--default">{fmtCurrency(stats.aracBasiMaliyet)}</div>
                        <div className="stat-label stat-label--default">Araç başı maliyet</div>
                    </div>
                </div>
            </div>

            <div className="ssh-panel-row">
                <DistBlock
                    title="Arıza tipi"
                    desc="En sık görülen 5 arıza tipi"
                    rows={stats.arizaTipiDagilimi}
                    icon={<Wrench size={18} strokeWidth={2} />}
                />
                <DistBlock
                    title="Hata kaynağı"
                    desc="Kaynak bazlı dağılım"
                    rows={stats.hataKaynagiDagilimi}
                    icon={<TrendingUp size={18} strokeWidth={2} />}
                />
            </div>

            <div className="ssh-glass-card ssh-last5-card">
                <div className="ssh-card-head">
                    <div className="ssh-card-head-icon">
                        <AlertCircle size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <h3 className="ssh-card-title">Son 5 şikayet</h3>
                        <p className="ssh-card-desc">Kritik puana göre sıralı</p>
                    </div>
                </div>
                {stats.son5.length === 0 ? (
                    <div className="ssh-mini-empty">
                        <Inbox size={28} strokeWidth={1.5} />
                        <span>Kayıt yok</span>
                    </div>
                ) : (
                    <div className="ssh-table-wrap">
                        <table className="ssh-table">
                            <thead>
                                <tr>
                                    <th>Talep No</th>
                                    <th>Müşteri</th>
                                    <th>Plaka</th>
                                    <th>Arıza tipi</th>
                                    <th>Kaynak</th>
                                    <th>Kritik</th>
                                    <th>Garanti</th>
                                    <th>Statü</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.son5.map(row => (
                                    <tr key={row.id}>
                                        <td className="ssh-td-mono">{row.talepNo}</td>
                                        <td>{row.musteriAdi}</td>
                                        <td>{row.aracPlakasi || '—'}</td>
                                        <td className="ssh-td-wrap">{row.arizaTipi || '—'}</td>
                                        <td>{row.hataKaynagi || '—'}</td>
                                        <td>
                                            <span className="ssh-kritik-badge">{row.kritikPuan ?? '—'}</span>
                                        </td>
                                        <td>{row.garantiTipi || '—'}</td>
                                        <td>
                                            <span className={`ssh-status-pill ssh-status-${row.status === 'KAPALI' ? 'closed' : 'open'}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </section>
    );
}

function SshFormBlock({
    step,
    title,
    desc,
    icon,
    accent,
    children,
}: {
    step: number;
    title: string;
    desc: string;
    icon: React.ReactNode;
    accent: string;
    children: React.ReactNode;
}) {
    return (
        <section className="ssh-form-block" style={{ '--ssh-accent': accent } as React.CSSProperties}>
            <div className="ssh-form-block__rule" aria-hidden />
            <header className="ssh-form-block__head">
                <span className="ssh-form-block__step">{step}</span>
                <div className="ssh-form-block__icon">{icon}</div>
                <div className="ssh-form-block__titles">
                    <h3 className="ssh-form-block__title">{title}</h3>
                    <p className="ssh-form-block__desc">{desc}</p>
                </div>
            </header>
            <div className="ssh-form-block__body">{children}</div>
        </section>
    );
}

function SshFormSections({
    form,
    setForm,
    talepNo,
    partCodes,
}: {
    form: SshComplaintInput;
    setForm: React.Dispatch<React.SetStateAction<SshComplaintInput>>;
    /** Mevcut kayıt no veya yeni kayıt için önizleme (otomatik atanır). */
    talepNo?: string | null;
    partCodes: SshPartCodes | null;
}) {
    const set = (key: keyof SshComplaintInput, value: unknown) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const arizaKoduLive = useMemo(
        () => buildArizaKoduLive(form.arizaBolge1, form.arizaBolge2, form.arizaBolge3, form.arizaTipi),
        [form.arizaBolge1, form.arizaBolge2, form.arizaBolge3, form.arizaTipi]
    );

    const product = useMemo(() => partProductFromUstYapi(form.ustYapiTipi), [form.ustYapiTipi]);
    const catalog = product && partCodes ? partCodes[product] : null;

    const bolge1Options = useMemo(
        () => withLegacyOption(catalog?.level1 ?? [], form.arizaBolge1),
        [catalog, form.arizaBolge1]
    );
    const bolge2Options = useMemo(() => {
        if (!catalog || !form.arizaBolge1) return withLegacyOption([], form.arizaBolge2);
        const l2s = Object.keys(catalog.tree[form.arizaBolge1] ?? {}).sort((a, b) => a.localeCompare(b, 'tr'));
        return withLegacyOption(l2s, form.arizaBolge2);
    }, [catalog, form.arizaBolge1, form.arizaBolge2]);
    const bolge3Options = useMemo(() => {
        if (!catalog || !form.arizaBolge1 || !form.arizaBolge2) return withLegacyOption([], form.arizaBolge3);
        const l3s = catalog.tree[form.arizaBolge1]?.[form.arizaBolge2] ?? [];
        return withLegacyOption(l3s, form.arizaBolge3);
    }, [catalog, form.arizaBolge1, form.arizaBolge2, form.arizaBolge3]);

    const text = (key: keyof SshComplaintInput, label: string, opts?: { required?: boolean; placeholder?: string }) => (
        <label className="ssh-field">
            <span className="ssh-field__label">
                {label}
                {opts?.required ? <span className="ssh-field__req">*</span> : null}
            </span>
            <input
                className="ssh-field__input"
                value={String(form[key] ?? '')}
                placeholder={opts?.placeholder}
                onChange={e => set(key, e.target.value)}
            />
        </label>
    );

    const num = (key: keyof SshComplaintInput, label: string, short?: boolean) => (
        <label className={`ssh-field ${short ? 'ssh-field--score' : ''}`}>
            <span className="ssh-field__label">{label}</span>
            <input
                className="ssh-field__input ssh-field__input--num"
                type="number"
                inputMode="numeric"
                value={form[key] == null || form[key] === '' ? '' : String(form[key])}
                onChange={e => set(key, e.target.value === '' ? null : Number(e.target.value))}
            />
        </label>
    );

    const dateField = (key: keyof SshComplaintInput, label: string) => (
        <label className="ssh-field">
            <span className="ssh-field__label">{label}</span>
            <input
                className="ssh-field__input"
                type="date"
                value={toDateInput(String(form[key] ?? ''))}
                onChange={e => set(key, e.target.value)}
            />
        </label>
    );

    return (
        <div className="ssh-form-sections">
            <SshFormBlock step={1} title="Talep" desc="Şikayet kaydının temel bilgileri" icon={<FileText size={18} strokeWidth={2} />} accent="#0071e3">
                <div className="ssh-form-grid">
                    <div className="ssh-code-preview ssh-talep-no-field">
                        <span className="ssh-field__label">Talep no</span>
                        <div className={`ssh-code-preview__box ${talepNo ? 'has-value' : ''}`}>
                            {talepNo ?? 'Otomatik atanacak…'}
                        </div>
                    </div>
                    {text('talepTipi', 'Talep tipi', { placeholder: 'Örn. NORMAL' })}
                    {dateField('sikayetBildirimTarihi', 'Şikayet bildirim tarihi')}
                </div>
            </SshFormBlock>
            <SshFormBlock step={2} title="Ürün ve müşteri" desc="Araç, müşteri ve garanti başlangıcı" icon={<Truck size={18} strokeWidth={2} />} accent="#5856d6">
                <div className="ssh-form-grid">
                    {dateField('garantiBaslangicTarihi', 'Garanti başlangıç tarihi')}
                    {text('musteriAdi', 'Müşteri adı', { required: true })}
                    {text('ilgiliKisi', 'İlgili kişi')}
                    {text('ilgiliKisiTel', 'İlgili kişi tel.')}
                    <SshModernSelect
                        label="Üst yapı tipi"
                        value={form.ustYapiTipi ?? ''}
                        options={withLegacyOption(['DAMPER', 'DORSE'], form.ustYapiTipi)}
                        required
                        onChange={v =>
                            setForm(prev => ({
                                ...prev,
                                ustYapiTipi: v,
                                arizaBolge1: '',
                                arizaBolge2: '',
                                arizaBolge3: '',
                            }))
                        }
                    />
                    {text('sasiMarka', 'Şasi / kamyon marka')}
                    {text('sasiModel', 'Şasi / kamyon model')}
                    {text('aracPlakasi', 'Araç plakası')}
                    {text('sasiNo', 'Şasi no')}
                    {text('imalatNo', 'İmalat no')}
                </div>
            </SshFormBlock>
            <SshFormBlock
                step={3}
                title="Arıza"
                desc={product ? `${product === 'damper' ? 'Damper' : 'Dorse'} montaj grupları` : 'Üst yapı tipini seçin'}
                icon={<AlertTriangle size={18} strokeWidth={2} />}
                accent="#ff9500"
            >
                <div className="ssh-form-grid">
                    <SshBolgePick
                        label="Arıza bölgesi 1"
                        sublabel="Ana montaj"
                        value={form.arizaBolge1 ?? ''}
                        options={bolge1Options}
                        disabled={!catalog}
                        onChange={v => setForm(prev => ({ ...prev, arizaBolge1: v, arizaBolge2: '', arizaBolge3: '' }))}
                    />
                    <SshBolgePick
                        label="Arıza bölgesi 2"
                        sublabel="Ön montaj"
                        value={form.arizaBolge2 ?? ''}
                        options={bolge2Options}
                        disabled={!catalog}
                        onChange={v => setForm(prev => ({ ...prev, arizaBolge2: v, arizaBolge3: '' }))}
                    />
                    <SshBolgePick
                        label="Arıza bölgesi 3"
                        sublabel="Alt montaj"
                        value={form.arizaBolge3 ?? ''}
                        options={bolge3Options}
                        disabled={!catalog}
                        onChange={v => setForm(prev => ({ ...prev, arizaBolge3: v }))}
                    />
                    <SshModernSelect
                        label="Arıza tipi"
                        value={form.arizaTipi ?? ''}
                        options={withLegacyOption(partCodes?.arizaTipleri ?? [], form.arizaTipi)}
                        disabled={!partCodes}
                        onChange={v => set('arizaTipi', v)}
                    />
                    <div className="ssh-code-preview span-2">
                        <span className="ssh-field__label">Arıza kodu</span>
                        <div className={`ssh-code-preview__box ${arizaKoduLive ? 'has-value' : ''}`}>
                            {arizaKoduLive || 'Bölge ve tip yazıldıkça oluşur…'}
                        </div>
                    </div>
                    {text('hataKaynagi', 'Hata kaynağı')}
                    <label className="ssh-field span-2">
                        <span className="ssh-field__label">Arıza açıklaması</span>
                        <textarea className="ssh-field__input ssh-field__textarea" rows={3} value={form.arizaAciklamasi ?? ''} onChange={e => set('arizaAciklamasi', e.target.value)} />
                    </label>
                </div>
            </SshFormBlock>
            <SshFormBlock step={4} title="Puanlama" desc="Skor alanları — manuel giriş" icon={<BarChart3 size={18} strokeWidth={2} />} accent="#ff2d55">
                <div className="ssh-score-grid">
                    {num('tekrarEdenHataSayisi', 'Tekrar eden hata', true)}
                    {num('aracCikisSuresiGun', 'Çıkış süresi (gün)', true)}
                    {num('cikisSureKatsayisi', 'Çıkış katsayısı', true)}
                    {num('oncelikKatsayisi', 'Öncelik katsayısı', true)}
                    {num('etkiKatsayisi', 'Etki katsayısı', true)}
                    {num('analizPuani', 'Analiz puanı', true)}
                    {num('kritikPuan', 'Kritik puan', true)}
                </div>
            </SshFormBlock>
            <SshFormBlock step={5} title="Garanti kararı" desc="Fabrika kararı ve maliyet" icon={<Shield size={18} strokeWidth={2} />} accent="#34c759">
                <div className="ssh-form-grid">
                    {text('fabrikaGarantiKarari', 'Fabrika garanti kararı')}
                    {text('garantiTipi', 'Garanti tipi')}
                    <label className="ssh-field">
                        <span className="ssh-field__label">Toplam tutar</span>
                        <input className="ssh-field__input ssh-field__input--num" type="number" min={0} step="0.01" value={form.toplamTutar ?? ''} onChange={e => set('toplamTutar', e.target.value === '' ? null : Number(e.target.value))} />
                    </label>
                    <label className="ssh-field">
                        <span className="ssh-field__label">Onaylanan tutar</span>
                        <input className="ssh-field__input ssh-field__input--num" type="number" min={0} step="0.01" value={form.onaylananTutar ?? ''} onChange={e => set('onaylananTutar', e.target.value === '' ? null : Number(e.target.value))} />
                    </label>
                    {dateField('faturaTarihi', 'Fatura tarihi')}
                </div>
            </SshFormBlock>
            <SshFormBlock step={6} title="Çözüm ve önlem" desc="Onarım, kök neden ve kalıcı önlem" icon={<Wrench size={18} strokeWidth={2} />} accent="#022347">
                <div className="ssh-form-grid">
                    <label className="ssh-field span-2">
                        <span className="ssh-field__label">Onarım</span>
                        <textarea className="ssh-field__input ssh-field__textarea" rows={3} value={form.onarim ?? ''} onChange={e => set('onarim', e.target.value)} />
                    </label>
                    {dateField('onarimTarihi', 'Onarım tarihi')}
                    <label className="ssh-field span-2">
                        <span className="ssh-field__label">Kök neden</span>
                        <textarea className="ssh-field__input ssh-field__textarea" rows={3} value={form.kokNeden ?? ''} onChange={e => set('kokNeden', e.target.value)} />
                    </label>
                    <label className="ssh-field span-2">
                        <span className="ssh-field__label">Kalıcı önlem</span>
                        <textarea className="ssh-field__input ssh-field__textarea" rows={3} value={form.kaliciOnlem ?? ''} onChange={e => set('kaliciOnlem', e.target.value)} />
                    </label>
                    {dateField('kaliciOnlemTarihi', 'Kalıcı önlem tarihi')}
                </div>
            </SshFormBlock>
        </div>
    );
}

function SshComplaintCard({
    item,
    partCodes,
    onUpdated,
    onDeleted,
}: {
    item: SshComplaint;
    partCodes: SshPartCodes | null;
    onUpdated: (c: SshComplaint) => void;
    onDeleted: (id: number) => void;
}) {
    const [collapsed, setCollapsed] = useState(true);
    const [form, setForm] = useState<SshComplaintInput>(() => complaintToForm(item));
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        setForm(complaintToForm(item));
    }, [item]);

    const save = async () => {
        try {
            setSaving(true);
            const payload = { ...form, status: normalizeStatusValue(form.status) };
            const updated = await updateSshComplaint(item.id, payload);
            onUpdated(updated);
            setCollapsed(true);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    const patchStatus = async (next: SshStatus) => {
        const normalized = normalizeStatusValue(next);
        setForm(prev => ({ ...prev, status: normalized }));
        try {
            const updated = await updateSshComplaint(item.id, { status: normalized });
            onUpdated(updated);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Durum güncellenemedi');
            setForm(complaintToForm(item));
        }
    };

    const remove = async () => {
        if (!window.confirm(`${item.talepNo} silinsin mi?`)) return;
        try {
            setDeleting(true);
            await deleteSshComplaint(item.id);
            onDeleted(item.id);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Silinemedi');
        } finally {
            setDeleting(false);
        }
    };

    const initials = (item.musteriAdi || '?').trim().slice(0, 1).toUpperCase();

    return (
        <article className={`ssh-record-card ${collapsed ? 'is-collapsed' : 'is-expanded'}`}>
            <button type="button" className="ssh-record-card__head" onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed}>
                <div className="ssh-record-card__identity">
                    <span className="ssh-record-card__avatar" aria-hidden>{initials}</span>
                    <div>
                        <div className="ssh-record-card__talep">{item.talepNo}</div>
                        <p className="ssh-record-card__meta">
                            <span>{item.musteriAdi}</span>
                            {item.aracPlakasi ? <span className="ssh-record-card__dot">·</span> : null}
                            {item.aracPlakasi ? <span>{item.aracPlakasi}</span> : null}
                        </p>
                    </div>
                </div>
                <div className="ssh-record-card__badges">
                    {item.kritikPuan != null ? <span className="ssh-kritik-badge">Kritik {item.kritikPuan}</span> : null}
                    <ChevronDown size={18} className={`ssh-record-card__chev ${collapsed ? '' : 'is-open'}`} />
                </div>
            </button>
            {!collapsed && (
                <div className="ssh-record-card__body">
                    <div className="ssh-record-card__divider" aria-hidden />
                    <SshFormSections form={form} setForm={setForm} talepNo={item.talepNo} partCodes={partCodes} />
                    <div className="ssh-record-card__actions">
                        <button type="button" className="ssh-btn ssh-btn--danger" onClick={remove} disabled={deleting}>
                            {deleting ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                            Sil
                        </button>
                        <button type="button" className="ssh-btn ssh-btn--primary" onClick={save} disabled={saving}>
                            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                            Kaydet
                        </button>
                    </div>
                </div>
            )}
            <div className="ssh-card-status-bar" onClick={e => e.stopPropagation()}>
                <span className="ssh-card-status-bar__label">Durum</span>
                <SshStatusToggle
                    compact
                    value={normalizeStatusValue(form.status)}
                    onChange={s => void patchStatus(s)}
                />
            </div>
        </article>
    );
}

export default function SshTakipPage() {
    const [stats, setStats] = useState<SshStats | null>(null);
    const [items, setItems] = useState<SshComplaint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [searchInput, setSearchInput] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState<SshComplaintInput>({ ...EMPTY_FORM });
    const [creating, setCreating] = useState(false);
    const [nextTalepNo, setNextTalepNo] = useState<string | null>(null);
    const [partCodes, setPartCodes] = useState<SshPartCodes | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getSshPartCodes()
            .then(data => {
                if (!cancelled) setPartCodes(data);
            })
            .catch(() => {
                if (!cancelled) setPartCodes(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const t = window.setTimeout(() => setSearchQ(searchInput.trim()), 300);
        return () => window.clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        if (!showCreate) {
            setNextTalepNo(null);
            return;
        }
        let cancelled = false;
        void getNextSshTalepNo()
            .then(r => {
                if (!cancelled) setNextTalepNo(r.talepNo);
            })
            .catch(() => {
                if (!cancelled) setNextTalepNo(null);
            });
        return () => {
            cancelled = true;
        };
    }, [showCreate, items.length]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const [st, list] = await Promise.all([
                getSshStats(),
                getSshComplaints({
                    status: statusFilter === 'ALL' ? undefined : statusFilter,
                    q: searchQ || undefined,
                }),
            ]);
            setStats(st);
            setItems(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Veriler yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchQ]);

    useEffect(() => {
        void load();
    }, [load]);

    const refreshStats = async () => {
        try {
            const st = await getSshStats();
            setStats(st);
        } catch {
            /* ignore */
        }
    };

    const handleCreate = async () => {
        if (!createForm.musteriAdi?.trim()) {
            alert('Müşteri adı zorunludur');
            return;
        }
        try {
            setCreating(true);
            const created = await createSshComplaint({
                ...createForm,
                status: normalizeStatusValue(createForm.status),
            });
            setItems(prev => [created, ...prev]);
            setShowCreate(false);
            setCreateForm({ ...EMPTY_FORM, sikayetBildirimTarihi: todayInput(), garantiBaslangicTarihi: todayInput() });
            await refreshStats();
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Kayıt oluşturulamadı');
        } finally {
            setCreating(false);
        }
    };

    const filterChips: { key: StatusFilter; label: string }[] = [
        { key: 'ALL', label: 'Tümü' },
        { key: 'AÇIK', label: 'Açık' },
        { key: 'KAPALI', label: 'Kapalı' },
    ];

    if (loading && stats === null && !error) {
        return (
            <AuthGuard>
                <Sidebar />
                <main className="main-content apple-app-page">
                    <OzunluLoading />
                </main>
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <Sidebar />
            <main className="main-content apple-app-page ssh-takip-page">
                <div className="apple-canvas">
                    <header className="apple-page-hero ssh-hero">
                        <div className="ssh-hero-row">
                            <div className="ssh-hero-text">
                                <div className="ssh-hero-badge">
                                    <Headphones size={22} strokeWidth={1.75} />
                                </div>
                                <div>
                                    <h1 className="header-title">Satış Sonrası Hizmetler</h1>
                                    <p className="header-subtitle">SSH şikayet takibi · kritik puan ve garanti süreçleri</p>
                                </div>
                            </div>
                            <button type="button" className="ssh-ghost-btn" onClick={() => void load()} disabled={loading}>
                                <RefreshCcw size={16} className={loading ? 'spin' : ''} />
                                Yenile
                            </button>
                        </div>
                    </header>
                    <div className="ssh-hero-divider" aria-hidden>
                        <span className="ssh-hero-divider__line" />
                        <span className="ssh-hero-divider__glow" />
                    </div>

                    {error && <div className="ssh-error-banner">{error}</div>}

                    <div className="ssh-command-bar">
                        <div className="apple-segmented ssh-segmented">
                            {filterChips.map(c => (
                                <button
                                    key={c.key}
                                    type="button"
                                    className={`apple-segmented-btn ${statusFilter === c.key ? 'is-active-brand' : ''}`}
                                    onClick={() => setStatusFilter(c.key)}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                        <div className="ssh-command-actions">
                            <label className="ssh-search">
                                <Search size={17} strokeWidth={2} />
                                <input
                                    placeholder="Talep no, müşteri, plaka…"
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                />
                            </label>
                            <button
                                type="button"
                                className={`ssh-primary-btn ${showCreate ? 'is-secondary' : ''}`}
                                onClick={() => setShowCreate(v => !v)}
                            >
                                {showCreate ? <X size={17} strokeWidth={2.5} /> : <Plus size={17} strokeWidth={2.5} />}
                                {showCreate ? 'İptal' : 'Yeni şikayet'}
                            </button>
                        </div>
                    </div>

                    <SshPanel stats={stats} />

                    {showCreate && (
                        <section className="ssh-create-card">
                            <header className="ssh-create-card__head">
                                <div className="ssh-create-card__icon">
                                    <Plus size={20} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h2>Yeni şikayet kaydı</h2>
                                    <p>Tüm alanları manuel doldurun; arıza kodu otomatik oluşur.</p>
                                    {nextTalepNo ? (
                                        <p className="ssh-create-card__talep-no">
                                            Talep no: <strong>{nextTalepNo}</strong>
                                            <span className="ssh-create-card__talep-hint"> (kayıtta atanır)</span>
                                        </p>
                                    ) : null}
                                </div>
                            </header>
                            <div className="ssh-create-card__divider" aria-hidden />
                            <SshFormSections form={createForm} setForm={setCreateForm} talepNo={nextTalepNo} partCodes={partCodes} />
                            <div className="ssh-create-foot">
                                <div className="ssh-card-status-bar ssh-card-status-bar--inline">
                                    <span className="ssh-card-status-bar__label">Durum</span>
                                    <SshStatusToggle
                                        compact
                                        value={normalizeStatusValue(createForm.status)}
                                        onChange={s => setCreateForm(prev => ({ ...prev, status: s }))}
                                    />
                                </div>
                                <button type="button" className="ssh-primary-btn" onClick={() => void handleCreate()} disabled={creating}>
                                    {creating ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                                    Oluştur
                                </button>
                            </div>
                        </section>
                    )}

                    <div className="ssh-section-rule">
                        <span className="ssh-section-rule__line" />
                        <span className="ssh-section-rule__label">Şikayet kayıtları</span>
                        <span className="ssh-section-rule__line" />
                    </div>

                    <section className="ssh-list">
                        {loading && items.length === 0 ? (
                            <OzunluLoading />
                        ) : items.length === 0 ? (
                            <div className="ssh-empty-card">
                                <div className="ssh-empty-card-icon"><Inbox size={36} strokeWidth={1.5} /></div>
                                <h3>Henüz şikayet kaydı yok</h3>
                                <p>Yeni şikayet oluşturarak SSH takibine başlayın.</p>
                                <button type="button" className="ssh-primary-btn" onClick={() => setShowCreate(true)}>
                                    <Plus size={17} strokeWidth={2.5} /> Yeni şikayet
                                </button>
                            </div>
                        ) : (
                            items.map(item => (
                                <SshComplaintCard
                                    key={item.id}
                                    item={item}
                                    partCodes={partCodes}
                                    onUpdated={c => {
                                        setItems(prev => prev.map(x => (x.id === c.id ? c : x)));
                                        void refreshStats();
                                    }}
                                    onDeleted={id => {
                                        setItems(prev => prev.filter(x => x.id !== id));
                                        void refreshStats();
                                    }}
                                />
                            ))
                        )}
                    </section>
                </div>
            </main>
        </AuthGuard>
    );
}
