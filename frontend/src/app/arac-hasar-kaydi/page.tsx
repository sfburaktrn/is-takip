'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import {
    addVehicleDamagePhoto,
    createVehicleDamage,
    deleteVehicleDamage,
    deleteVehicleDamagePhoto,
    getVehicleDamages,
    notifyVehicleDamageSlackCreated,
    updateVehicleDamage,
    type VehicleDamageRecord,
    type VehicleDamageStatus,
} from '@/lib/api';
import { Camera, Check, ChevronDown, CircleCheckBig, Filter, Loader2, Plus, Save, ShieldAlert, Sparkles, UserRoundCog, Wrench, X } from 'lucide-react';

const STEP_ORDER: VehicleDamageStatus[] = ['KAYDI_GIRILDI', 'SURECTE', 'TAMAMLANDI'];
const REPAIR_LOCATIONS = [
    { value: '', label: 'Seçiniz' },
    { value: 'SERVIS', label: 'Serviste yapılacak' },
    { value: 'IC_BUENYE', label: 'Kendi iç bünyemizde yapılacak' },
];
const SERVICE_DIRECTIONS = [
    { value: '', label: 'Seçiniz' },
    { value: 'ARAC_SERVISE_GIDECEK', label: 'Araç servise gidecek' },
    { value: 'SERVIS_FABRIKAYA_GELECEK', label: 'Servis fabrikaya gelecek' },
];

type PendingPhoto = {
    fileName: string;
    mimeType: string;
    dataBase64: string;
    previewUrl: string;
};

function statusLabel(s: VehicleDamageStatus) {
    if (s === 'KAYDI_GIRILDI') return 'Hasar Kaydı Oluşturuldu';
    if (s === 'SURECTE') return 'Süreçte';
    return 'Tamamlandı';
}

type StatusFilter = 'ALL' | VehicleDamageStatus;

function filterChipLabel(s: StatusFilter) {
    if (s === 'ALL') return 'Tümü';
    if (s === 'KAYDI_GIRILDI') return 'Kayıt girildi';
    if (s === 'SURECTE') return 'Süreçte';
    return 'Tamamlandı';
}

const FILTER_KEYS: StatusFilter[] = ['ALL', 'KAYDI_GIRILDI', 'SURECTE', 'TAMAMLANDI'];

function fmtCurrency(v: number | null) {
    if (v == null) return '—';
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(v);
}

function fmtAuditDt(iso: string | null | undefined) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
        return '—';
    }
}

function calendarDaysSinceStart(startIso: string): number {
    const start = new Date(startIso);
    const end = new Date();
    const s0 = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const e0 = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.max(0, Math.round((e0 - s0) / 86400000));
}

function resolutionDayLabel(createdIso: string, completedIso: string): string {
    const s = new Date(createdIso);
    const e = new Date(completedIso);
    const s0 = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
    const e0 = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate());
    const d = Math.round((e0 - s0) / 86400000);
    if (d <= 0) return 'Aynı gün içinde hasar giderildi.';
    if (d === 1) return '1 günde hasar giderildi.';
    return `${d} günde hasar giderildi.`;
}

function DamageAuditTrail({ item }: { item: VehicleDamageRecord }) {
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setTick(t => t + 1), 60_000);
        return () => window.clearInterval(id);
    }, []);

    const süreçStartIso =
        item.processStartedAt ?? (item.status === 'SURECTE' ? item.createdAt : null);
    const süreçDays =
        item.status === 'SURECTE' && süreçStartIso != null ? calendarDaysSinceStart(süreçStartIso) : null;
    const legacySüreç = item.status === 'SURECTE' && item.processStartedAt == null;

    const completedEndIso = item.completedAt ?? (item.isCompleted ? item.updatedAt : null);

    return (
        <div className="damage-audit">
            <div className="audit-title">Kayıt bilgisi</div>
            <div className="audit-rows">
                <div className="audit-row">
                    <span className="audit-k">Hasar kaydı oluşturuldu</span>
                    <span className="audit-v">
                        {fmtAuditDt(item.createdAt)} · <span className="audit-user">{item.createdByUsername ?? '—'}</span>
                    </span>
                </div>
                <div className="audit-row">
                    <span className="audit-k">Sürece geçiş</span>
                    <span className="audit-v">
                        {item.processStartedAt ? (
                            <>
                                {fmtAuditDt(item.processStartedAt)} ·{' '}
                                <span className="audit-user">{item.processStartedByUsername ?? '—'}</span>
                            </>
                        ) : (
                            <span className="audit-muted">Henüz sürece alınmadı (onarım yeri seçilince başlar)</span>
                        )}
                    </span>
                </div>
                {item.isCompleted ? (
                    <>
                        <div className="audit-row">
                            <span className="audit-k">Hasar giderildi</span>
                            <span className="audit-v">
                                {item.completedAt ? (
                                    <>
                                        {fmtAuditDt(item.completedAt)} ·{' '}
                                        <span className="audit-user">{item.completedByUsername ?? '—'}</span>
                                    </>
                                ) : (
                                    <span className="audit-muted">Tamamlandı (tarih bu güncellemeden önce)</span>
                                )}
                            </span>
                        </div>
                        {completedEndIso ? (
                            <div className="audit-resolution">{resolutionDayLabel(item.createdAt, completedEndIso)}</div>
                        ) : null}
                    </>
                ) : null}
                {item.status === 'SURECTE' && süreçDays !== null ? (
                    <div className="audit-surecte-live">
                        <span className="audit-ping" aria-hidden />
                        <span>
                            Süreç devam ediyor · <strong>{süreçDays} gün</strong>
                            {legacySüreç ? (
                                <span className="audit-hint"> (süreç başlangıcı kayıt tarihinden; eski kayıtlar)</span>
                            ) : null}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function toBase64(buf: ArrayBuffer) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function fileToWebp(file: File): Promise<PendingPhoto> {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas başlatılamadı');
    ctx.drawImage(imageBitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(v => (v ? resolve(v) : reject(new Error('WebP dönüşümü başarısız'))), 'image/webp', 0.86);
    });
    const dataBase64 = toBase64(await blob.arrayBuffer());
    const previewUrl = URL.createObjectURL(blob);
    return { fileName: file.name.replace(/\.[^/.]+$/, '') + '.webp', mimeType: 'image/webp', dataBase64, previewUrl };
}

function DamageCard({
    item,
    onUpdated,
    onDeleted,
}: {
    item: VehicleDamageRecord;
    onUpdated: (row: VehicleDamageRecord) => void;
    onDeleted: (id: number) => void;
}) {
    const [repairLocation, setRepairLocation] = useState(item.repairLocation || '');
    const [serviceDirection, setServiceDirection] = useState(item.serviceDirection || '');
    const [partCost, setPartCost] = useState(item.partCost == null ? '' : String(item.partCost));
    const [laborCost, setLaborCost] = useState(item.laborCost == null ? '' : String(item.laborCost));
    const [notes, setNotes] = useState(item.notes || '');
    const [processOwner, setProcessOwner] = useState(item.processOwner || '');
    const [requiresPart, setRequiresPart] = useState(Boolean(item.requiresPart));
    const [isCompleted, setIsCompleted] = useState(item.isCompleted);
    const [saving, setSaving] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState(false);
    const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
    const [addingPhoto, setAddingPhoto] = useState(false);
    const [collapsed, setCollapsed] = useState(true);

    const activeIndex = STEP_ORDER.indexOf(item.status);
    const lineTotal =
        item.cost != null ? Number(item.cost) : (Number(partCost) || 0) + (Number(laborCost) || 0);

    const save = async () => {
        try {
            setSaving(true);
            const updated = await updateVehicleDamage(item.id, {
                processOwner: processOwner.trim() || null,
                requiresPart,
                partCost: requiresPart ? (partCost.trim() === '' ? null : Number(partCost)) : null,
                laborCost: laborCost.trim() === '' ? null : Number(laborCost),
                repairLocation: repairLocation || null,
                serviceDirection: repairLocation === 'SERVIS' ? (serviceDirection || null) : null,
                notes: notes.trim() || null,
            });
            onUpdated(updated);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Güncelleme başarısız');
        } finally {
            setSaving(false);
        }
    };

    const markDone = async () => {
        try {
            setSaving(true);
            const updated = await updateVehicleDamage(item.id, { isCompleted: true });
            onUpdated(updated);
            setIsCompleted(true);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Süreç tamamlanamadı');
        } finally {
            setSaving(false);
        }
    };

    const removePhoto = async (photoId: number) => {
        try {
            setDeletingPhotoId(photoId);
            const updated = await deleteVehicleDamagePhoto(item.id, photoId);
            onUpdated(updated);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Foto silinemedi');
        } finally {
            setDeletingPhotoId(null);
        }
    };

    const uploadPhoto = async (files: FileList | null) => {
        if (!files || item.photos.length >= 3) return;
        const room = 3 - item.photos.length;
        const picked = Array.from(files).slice(0, room);
        try {
            setAddingPhoto(true);
            let latest = item;
            for (const file of picked) {
                const webp = await fileToWebp(file);
                latest = await addVehicleDamagePhoto(item.id, {
                    mimeType: webp.mimeType,
                    dataBase64: webp.dataBase64,
                    originalFileName: webp.fileName,
                });
                URL.revokeObjectURL(webp.previewUrl);
            }
            onUpdated(latest);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Fotoğraf yüklenemedi');
        } finally {
            setAddingPhoto(false);
        }
    };

    const removeRecord = async () => {
        const ok = window.confirm(`"${item.sasiNo}" hasar kaydı silinsin mi? Bu işlem geri alınamaz.`);
        if (!ok) return;
        try {
            setDeletingRecord(true);
            await deleteVehicleDamage(item.id);
            onDeleted(item.id);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Kayıt silinemedi');
        } finally {
            setDeletingRecord(false);
        }
    };

    return (
        <article className="damage-card">
            <div className="card-top">
                <div className={collapsed ? 'card-line' : ''}>
                    {collapsed ? (
                        <>
                            <span className="card-line-chassis">Şasi: {item.sasiNo}</span>
                            <span className="card-line-sep">·</span>
                            <span className="card-line-cost">Maliyet: {fmtCurrency(lineTotal)}</span>
                        </>
                    ) : (
                        <>
                            <div className="card-title">Şasi: {item.sasiNo}</div>
                            <div className="card-sub">{item.responsibles.join(', ')}</div>
                        </>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        type="button"
                        className="save-btn"
                        style={{ padding: '6px 10px' }}
                        onClick={() => setCollapsed(v => !v)}
                    >
                        <ChevronDown size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform .2s ease' }} />
                        {collapsed ? 'Aç' : 'Kapat'}
                    </button>
                    <span className={`pill pill-${item.status.toLowerCase()}`}>
                        <span className="pulse-dot" />
                        {statusLabel(item.status)}
                    </span>
                </div>
            </div>

            {!collapsed ? (
            <>
            <div className="steps">
                {STEP_ORDER.map((step, idx) => (
                    <div key={step} className={`step ${idx <= activeIndex ? 'active' : ''}`}>
                        <span>{idx < activeIndex ? <Check size={14} /> : idx + 1}</span>
                        {statusLabel(step)}
                    </div>
                ))}
            </div>

            <div className="grid4">
                <label>
                    Süreç ile ilgilenen kişi
                    <input value={processOwner} onChange={e => setProcessOwner(e.target.value)} placeholder="Örn: Ahmet Yılmaz" />
                </label>
                <label className="checkbox-field">
                    <input type="checkbox" checked={requiresPart} onChange={e => setRequiresPart(e.target.checked)} />
                    Parça gerekiyor mu?
                </label>
                <label>
                    Onarım yeri
                    <select value={repairLocation} onChange={e => setRepairLocation(e.target.value)}>
                        {REPAIR_LOCATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </label>
                {repairLocation === 'SERVIS' ? (
                    <label>
                        Servis akışı
                        <select value={serviceDirection} onChange={e => setServiceDirection(e.target.value)}>
                            {SERVICE_DIRECTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </label>
                ) : null}
                {requiresPart ? (
                    <label>
                        Parça maliyeti (TL)
                        <input type="number" min="0" step="0.01" value={partCost} onChange={e => setPartCost(e.target.value)} />
                    </label>
                ) : null}
                <label>
                    İşçilik maliyeti (TL)
                    <input type="number" min="0" step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)} />
                </label>
            </div>

            <label>
                Not
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </label>

            <div className="photo-row">
                {item.photos.map(photo => (
                    <div key={photo.id} className="photo-item">
                        <img src={photo.dataUrl} alt="Hasar fotoğrafı" />
                        <button type="button" disabled={deletingPhotoId === photo.id} onClick={() => void removePhoto(photo.id)}>
                            {deletingPhotoId === photo.id ? 'Siliniyor...' : 'Sil'}
                        </button>
                    </div>
                ))}
                {item.photos.length < 3 ? (
                    <label className="add-photo">
                        <Camera size={16} />
                        {addingPhoto ? 'Yükleniyor...' : 'Foto ekle'}
                        <input type="file" accept="image/*" multiple onChange={e => void uploadPhoto(e.target.files)} />
                    </label>
                ) : null}
            </div>

            <div className="card-foot">
                <div className="money">Toplam: {fmtCurrency((Number(partCost || 0) + Number(laborCost || 0)) || 0)}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        className="save-btn"
                        style={{ borderColor: '#fecaca', color: '#991b1b', background: '#fff5f5' }}
                        onClick={() => void removeRecord()}
                        disabled={deletingRecord}
                    >
                        {deletingRecord ? <Loader2 size={16} className="spin" /> : null} Kaydı Sil
                    </button>
                    <button type="button" className="save-btn" onClick={() => void save()} disabled={saving}>
                        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Kaydet
                    </button>
                    <button
                        type="button"
                        className="save-btn"
                        style={{ borderColor: '#86efac', color: '#166534', background: '#f0fdf4' }}
                        onClick={() => void markDone()}
                        disabled={saving || isCompleted}
                    >
                        Süreci Tamamla (Hasar Giderildi)
                    </button>
                </div>
            </div>
            </>
            ) : null}
            <DamageAuditTrail item={item} />
        </article>
    );
}

function AracHasarKaydiPageContent() {
    const [rows, setRows] = useState<VehicleDamageRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [sasiNo, setSasiNo] = useState('');
    const [responsibles, setResponsibles] = useState<string[]>(['']);
    const [processOwner, setProcessOwner] = useState('');
    const [requiresPart, setRequiresPart] = useState(false);
    const [partCost, setPartCost] = useState('');
    const [laborCost, setLaborCost] = useState('');
    const [repairLocation, setRepairLocation] = useState('');
    const [serviceDirection, setServiceDirection] = useState('');
    const [notes, setNotes] = useState('');
    const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

    const load = useCallback(async () => {
        try {
            const list = await getVehicleDamages();
            setRows(list);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Hasar kayıtları alınamadı');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        return () => pendingPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
    }, [pendingPhotos]);

    const completedCount = useMemo(() => rows.filter(r => r.status === 'TAMAMLANDI').length, [rows]);

    const filteredRows = useMemo(() => {
        if (statusFilter === 'ALL') return rows;
        return rows.filter(r => r.status === statusFilter);
    }, [rows, statusFilter]);

    const setUpdatedRow = (updated: VehicleDamageRecord) => {
        setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    };
    const removeRow = (id: number) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const changeResponsible = (idx: number, value: string) => {
        setResponsibles(prev => prev.map((v, i) => (i === idx ? value : v)));
    };
    const addResponsible = () => setResponsibles(prev => (prev.length >= 3 ? prev : [...prev, '']));
    const removeResponsible = (idx: number) => setResponsibles(prev => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

    const onSelectPhotos = async (files: FileList | null) => {
        if (!files) return;
        const list = Array.from(files).slice(0, 3);
        try {
            const converted = await Promise.all(list.map(fileToWebp));
            setPendingPhotos(prev => {
                prev.forEach(p => URL.revokeObjectURL(p.previewUrl));
                return converted.slice(0, 3);
            });
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Fotoğraf dönüştürülemedi');
        }
    };

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setCreating(true);
            const cleanResponsibles = responsibles.map(v => v.trim()).filter(Boolean);
            if (cleanResponsibles.length < 1 || cleanResponsibles.length > 3) {
                alert('En az 1 en fazla 3 sorumlu giriniz');
                return;
            }
            if (!sasiNo.trim()) {
                alert('Şasi no zorunlu');
                return;
            }
            const created = await createVehicleDamage({
                sasiNo: sasiNo.trim(),
                responsibles: cleanResponsibles,
                processOwner: processOwner.trim() || null,
                requiresPart,
                partCost: requiresPart ? (partCost.trim() === '' ? null : Number(partCost)) : null,
                laborCost: laborCost.trim() === '' ? null : Number(laborCost),
                repairLocation: repairLocation || null,
                serviceDirection: repairLocation === 'SERVIS' ? (serviceDirection || null) : null,
                notes: notes.trim() || null,
                isCompleted: false,
            });

            let current = created;
            for (const photo of pendingPhotos.slice(0, 3)) {
                current = await addVehicleDamagePhoto(created.id, {
                    mimeType: photo.mimeType,
                    dataBase64: photo.dataBase64,
                    originalFileName: photo.fileName,
                });
            }

            try {
                await notifyVehicleDamageSlackCreated(
                    created.id,
                    pendingPhotos.slice(0, 3).map(p => ({
                        mimeType: p.mimeType,
                        dataBase64: p.dataBase64,
                        originalFileName: p.fileName,
                    }))
                );
            } catch {
                /* Slack yapılandırılmamış veya geçici hata — kayıt yine de oluştu */
            }

            setRows(prev => [current, ...prev]);
            setSasiNo('');
            setResponsibles(['']);
            setProcessOwner('');
            setRequiresPart(false);
            setPartCost('');
            setLaborCost('');
            setRepairLocation('');
            setServiceDirection('');
            setNotes('');
            pendingPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
            setPendingPhotos([]);
            setShowCreateForm(false);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Kayıt oluşturulamadı');
        } finally {
            setCreating(false);
        }
    };

    return (
        <>
            <Sidebar />
            <main className="main-content analytics-page">
                <div className="damage-wrap">
                    <header className="hero">
                        <div className="hero-glow" />
                        <div>
                            <p className="eyebrow"><Sparkles size={14} /> Araç Hasar Yönetimi</p>
                            <h1>Araç Hasar Kaydı</h1>
                            <p>Akış: Kaydı girildi, süreçte, tamamlandı. Her kart canlı olarak ilerler.</p>
                        </div>
                        <div className="hero-right">
                            <button type="button" className="open-form-btn" onClick={() => setShowCreateForm(v => !v)}>
                                {showCreateForm ? <X size={16} /> : <Plus size={16} />}
                                {showCreateForm ? 'Formu Kapat' : 'Hasar Kaydı Ekle'}
                            </button>
                            <div className="stats">
                                <div><strong>{rows.length}</strong><span>Toplam Kayıt</span></div>
                                <div><strong>{completedCount}</strong><span>Tamamlanan</span></div>
                            </div>
                        </div>
                    </header>

                    {showCreateForm ? (
                    <form className="create-card" onSubmit={create}>
                        <h2><Wrench size={17} /> Yeni Hasar Kaydı Aç</h2>
                        <div className="grid4">
                            <label>
                                Şasi No *
                                <input required value={sasiNo} onChange={e => setSasiNo(e.target.value)} />
                            </label>
                            <label>
                                Süreç ile ilgilenen kişi
                                <input value={processOwner} onChange={e => setProcessOwner(e.target.value)} placeholder="Örn: Hasan Kaya" />
                            </label>
                            <label className="checkbox-field">
                                <input type="checkbox" checked={requiresPart} onChange={e => setRequiresPart(e.target.checked)} />
                                Parça gerekiyor mu?
                            </label>
                            <label>
                                Onarım yeri
                                <select value={repairLocation} onChange={e => setRepairLocation(e.target.value)}>
                                    {REPAIR_LOCATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                            </label>
                            {repairLocation === 'SERVIS' ? (
                                <label>
                                    Servis akışı
                                    <select value={serviceDirection} onChange={e => setServiceDirection(e.target.value)}>
                                        {SERVICE_DIRECTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            {requiresPart ? (
                                <label>
                                    Parça maliyeti (TL)
                                    <input type="number" min="0" step="0.01" value={partCost} onChange={e => setPartCost(e.target.value)} />
                                </label>
                            ) : null}
                            <label>
                                İşçilik maliyeti (TL)
                                <input type="number" min="0" step="0.01" value={laborCost} onChange={e => setLaborCost(e.target.value)} />
                            </label>
                            <label>
                                Toplam maliyet (TL)
                                <input value={String((Number(partCost || 0) + Number(laborCost || 0)) || 0)} readOnly />
                            </label>
                        </div>

                        <div className="responsibles">
                            <span><UserRoundCog size={15} /> Hasara sebep olan kişi(ler)</span>
                            {responsibles.map((value, idx) => (
                                <div key={idx} className="resp-row">
                                    <input
                                        placeholder={`Kişi ${idx + 1}`}
                                        value={value}
                                        onChange={e => changeResponsible(idx, e.target.value)}
                                        required={idx === 0}
                                    />
                                    <button type="button" onClick={() => removeResponsible(idx)} disabled={responsibles.length === 1}>Sil</button>
                                </div>
                            ))}
                            <button type="button" className="ghost-btn" onClick={addResponsible} disabled={responsibles.length >= 3}>Kişi Ekle</button>
                        </div>

                        <label>
                            Not
                            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                        </label>

                        <div className="uploader">
                            <label className="upload-label">
                                <Camera size={16} /> Fotoğraflar (max 3, WebP)
                                <input type="file" accept="image/*" multiple onChange={e => void onSelectPhotos(e.target.files)} />
                            </label>
                            <div className="pending-grid">
                                {pendingPhotos.map((p, i) => <img key={i} src={p.previewUrl} alt="Önizleme" />)}
                            </div>
                        </div>

                        <button className="primary-btn" type="submit" disabled={creating}>
                            {creating ? <Loader2 size={16} className="spin" /> : <CircleCheckBig size={16} />} Kaydı Oluştur
                        </button>
                    </form>
                    ) : null}

                    {!loading ? (
                        <section className="filter-bar" aria-label="Durum filtresi">
                            <span className="filter-label">
                                <Filter size={14} aria-hidden /> Durum
                            </span>
                            <div className="filter-chips">
                                {FILTER_KEYS.map(key => (
                                    <button
                                        key={key}
                                        type="button"
                                        className={`filter-chip ${statusFilter === key ? 'active' : ''} ${key !== 'ALL' ? `chip-${key.toLowerCase()}` : 'chip-all'}`}
                                        onClick={() => setStatusFilter(key)}
                                    >
                                        {filterChipLabel(key)}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    <section className="cards">
                        {loading ? (
                            <div className="empty">Yükleniyor...</div>
                        ) : rows.length === 0 ? (
                            <div className="empty">Henüz hasar kaydı yok.</div>
                        ) : filteredRows.length === 0 ? (
                            <div className="empty">Bu durum için kayıt yok. Farklı bir filtre seçin.</div>
                        ) : (
                            filteredRows.map(r => <DamageCard key={r.id} item={r} onUpdated={setUpdatedRow} onDeleted={removeRow} />)
                        )}
                    </section>
                </div>
                <style jsx global>{`
                    .damage-wrap { max-width: 1200px; margin: 0 auto; padding: 20px; display: grid; gap: 18px; }
                    .hero { position: relative; overflow: hidden; border: 1px solid rgba(99,102,241,.26); border-radius: 22px; padding: 22px; background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%); display:flex; justify-content: space-between; gap: 16px; align-items: center; }
                    .hero-glow { position: absolute; inset: -100px -80px auto auto; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,.35), rgba(99,102,241,0)); animation: pulse 2.2s ease-in-out infinite; pointer-events: none; }
                    .eyebrow { margin: 0; display:inline-flex; align-items:center; gap:8px; color:#4338ca; font-size:12px; font-weight:800; text-transform: uppercase; }
                    h1 { margin: 6px 0; }
                    .hero p { margin: 0; color: var(--muted); }
                    .hero-right { display:flex; flex-direction: column; align-items: flex-end; gap: 10px; z-index: 2; }
                    .open-form-btn { border: 1px solid rgba(99,102,241,.4); background: linear-gradient(135deg, #fff, #e0e7ff); color: #3730a3; border-radius: 12px; padding: 10px 14px; display:flex; align-items:center; gap: 8px; font-weight: 800; cursor:pointer; box-shadow: 0 10px 20px -16px #4338ca; }
                    .stats { display: flex; gap: 10px; }
                    .stats div { min-width: 110px; padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: rgba(255,255,255,.9); backdrop-filter: blur(2px); }
                    .stats strong { font-size: 24px; display:block; }
                    .stats span { font-size: 12px; color: var(--muted); }
                    .create-card, .damage-card { border: 1px solid rgba(2,35,71,.12); border-radius: 18px; background: linear-gradient(170deg, #fff, #f8fafc); padding: 16px; box-shadow: 0 14px 30px -24px rgba(2,35,71,.45); }
                    .create-card { display:grid; gap: 14px; animation: slideIn .28s ease-out; }
                    .create-card h2 { margin: 0; display:flex; align-items:center; gap: 8px; }
                    .grid4 { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 12px; }
                    label { display:grid; gap: 6px; font-size: 12px; color: var(--muted); font-weight: 700; }
                    input, select, textarea { width:100%; border:1px solid var(--border); border-radius: 12px; padding: 10px 11px; font-size: 14px; background:#fff; color: var(--foreground); transition: all .2s; }
                    input:focus, select:focus, textarea:focus { outline:none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.14); }
                    .checkbox-field { display:flex; align-items:center; gap: 8px; color: var(--foreground); font-size: 14px; font-weight: 700; }
                    .checkbox-field input { width: auto; }
                    .responsibles { display:grid; gap: 8px; }
                    .responsibles > span { display:flex; align-items:center; gap: 7px; font-weight: 800; color: var(--foreground); }
                    .resp-row { display:flex; gap: 8px; }
                    .resp-row button, .ghost-btn, .save-btn, .photo-item button, .add-photo { border: 1px solid var(--border); border-radius: 10px; background:#fff; cursor:pointer; }
                    .resp-row button, .ghost-btn { padding: 8px 10px; font-size: 12px; font-weight: 700; }
                    .uploader { display:grid; gap: 8px; }
                    .upload-label { display:inline-flex; align-items:center; gap:8px; color: var(--foreground); font-weight: 800; }
                    .upload-label input { margin-left: 8px; padding: 0; border: 0; }
                    .pending-grid { display:flex; gap:8px; flex-wrap: wrap; }
                    .pending-grid img { width: 92px; height: 92px; object-fit: cover; border: 1px solid var(--border); border-radius: 10px; }
                    .primary-btn { width: fit-content; border:0; border-radius: 12px; background: linear-gradient(135deg, #0f2f60, #1d4ed8); color:#fff; padding: 10px 14px; display:flex; align-items:center; gap: 8px; font-weight: 800; cursor:pointer; box-shadow: 0 10px 24px -14px #1d4ed8; }
                    .filter-bar { display:flex; flex-wrap:wrap; align-items:center; gap: 10px 14px; padding: 12px 14px; border: 1px solid rgba(99,102,241,.2); border-radius: 14px; background: rgba(255,255,255,.85); }
                    .filter-label { display:inline-flex; align-items:center; gap: 6px; font-size: 12px; font-weight: 800; color: #4338ca; text-transform: uppercase; letter-spacing: .04em; }
                    .filter-chips { display:flex; flex-wrap:wrap; gap: 8px; }
                    .filter-chip { border: 1px solid var(--border); border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 700; background: #fff; cursor:pointer; color: var(--foreground); transition: border-color .15s, box-shadow .15s, background .15s; }
                    .filter-chip:hover { border-color: #a5b4fc; }
                    .filter-chip.active { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.18); }
                    .filter-chip.chip-all.active { background: linear-gradient(135deg, #eef2ff, #e0e7ff); color: #3730a3; }
                    .filter-chip.chip-kaydi_girildi.active { background: #e0e7ff; color: #3730a3; border-color: #a5b4fc; }
                    .filter-chip.chip-surecte.active { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
                    .filter-chip.chip-tamamlandi.active { background: #dcfce7; color: #166534; border-color: #86efac; }
                    .cards { display:grid; gap: 12px; }
                    .damage-card { display:grid; gap: 12px; }
                    .card-top { display:flex; justify-content: space-between; gap: 10px; align-items: center; }
                    .card-title { font-size: 18px; font-weight: 900; }
                    .card-sub { color: var(--muted); margin-top: 4px; font-size: 13px; }
                    .card-line { display:flex; flex-wrap:wrap; align-items:center; gap: 6px 10px; font-size: 14px; font-weight: 800; color: var(--foreground); line-height: 1.35; }
                    .card-line-chassis { font-family: ui-monospace, 'Cascadia Code', monospace; letter-spacing: .02em; }
                    .card-line-sep { color: var(--muted); font-weight: 600; }
                    .card-line-cost { color: #0f2f60; font-variant-numeric: tabular-nums; }
                    .pill { display:inline-flex; align-items:center; gap: 6px; border-radius: 999px; padding: 6px 10px; font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: .03em; }
                    .pill-kaydi_girildi { background: #e0e7ff; color:#3730a3; }
                    .pill-surecte { background: #fef3c7; color:#92400e; }
                    .pill-tamamlandi { background: #dcfce7; color:#166534; }
                    .pulse-dot { width:8px; height:8px; border-radius:50%; background: currentColor; opacity:.85; animation: blink 1.1s ease-in-out infinite; }
                    .steps { display:grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
                    .step { border: 1px dashed var(--border); border-radius: 10px; padding: 10px; text-align:center; color: var(--muted); font-size: 12px; font-weight: 700; }
                    .step span { width: 24px; height: 24px; margin: 0 auto 6px; border-radius: 999px; display:flex; align-items:center; justify-content:center; background: #eef2ff; color:#334155; }
                    .step.active { color: var(--foreground); border-style: solid; border-color: #6366f1; background: rgba(238,242,255,.45); }
                    .step.active span { background: #6366f1; color: #fff; }
                    .photo-row { display:flex; gap: 8px; flex-wrap: wrap; }
                    .photo-item { display:grid; gap: 6px; width: 110px; }
                    .photo-item img { width: 110px; height: 90px; object-fit: cover; border-radius: 10px; border: 1px solid var(--border); }
                    .photo-item button { padding: 4px; font-size: 12px; border-color: #fecaca; color:#991b1b; background:#fff5f5; }
                    .add-photo { width: 110px; height: 90px; display:flex; flex-direction: column; align-items:center; justify-content:center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--muted); border-style: dashed; }
                    .add-photo input { display:none; }
                    .card-foot { display:flex; justify-content: space-between; align-items:center; }
                    .money { font-size: 18px; font-weight: 900; color: #0f2f60; }
                    .save-btn { padding: 8px 12px; display:flex; align-items:center; gap: 6px; font-weight: 800; }
                    .damage-audit { margin-top: 4px; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(15,47,96,.12); background: linear-gradient(180deg, rgba(248,250,252,.95), rgba(241,245,249,.85)); display:grid; gap: 10px; }
                    .audit-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
                    .audit-rows { display:grid; gap: 8px; font-size: 13px; }
                    .audit-row { display:flex; flex-wrap: wrap; align-items: baseline; gap: 8px 14px; justify-content: space-between; }
                    .audit-k { color: var(--muted); font-weight: 700; flex: 0 0 auto; }
                    .audit-v { color: var(--foreground); font-weight: 600; text-align: right; flex: 1 1 200px; }
                    .audit-user { font-weight: 800; color: #0f2f60; }
                    .audit-muted { color: var(--muted); font-weight: 600; font-style: italic; }
                    .audit-resolution { font-size: 14px; font-weight: 800; color: #166534; padding: 8px 10px; border-radius: 10px; background: rgba(220,252,231,.65); border: 1px solid rgba(34,197,94,.25); }
                    .audit-surecte-live { display:flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 700; color: #92400e; padding: 8px 10px; border-radius: 10px; background: rgba(254,243,199,.5); border: 1px solid rgba(245,158,11,.35); }
                    .audit-hint { font-weight: 600; font-size: 12px; color: #a16207; }
                    .audit-ping { flex-shrink: 0; width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; animation: auditPing 1.5s ease-out infinite; }
                    @keyframes auditPing { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55); } 70% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }
                    .empty { border: 1px dashed var(--border); border-radius: 14px; color: var(--muted); text-align:center; padding: 24px; }
                    .spin { animation: rotate .9s linear infinite; }
                    @keyframes rotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
                    @keyframes blink { 0%,100%{opacity:.4} 50%{opacity:1} }
                    @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
                    @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
                `}</style>
            </main>
        </>
    );
}

export default function AracHasarKaydiPage() {
    return (
        <AuthGuard>
            <AracHasarKaydiPageContent />
        </AuthGuard>
    );
}
