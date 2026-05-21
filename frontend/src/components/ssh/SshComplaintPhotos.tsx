'use client';

import './SshComplaintPhotos.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, Upload, X } from 'lucide-react';
import { fileToWebp, isImageFile } from '@/lib/imageToWebp';
import {
    addSshComplaintPhoto,
    deleteSshComplaintPhoto,
    getSshComplaintPhotoUrl,
    SSH_MAX_PHOTOS,
    type SshComplaint,
    type SshComplaintPhoto,
} from '@/lib/api';

export type PendingSshPhoto = {
    localId: string;
    fileName: string;
    mimeType: string;
    dataBase64: string;
    previewUrl: string;
};

type FilledSlot =
    | { kind: 'pending'; photo: PendingSshPhoto }
    | { kind: 'saved'; photo: SshComplaintPhoto };

type PreviewState = {
    src: string;
    alt: string;
};

function FilledSlotView({
    slotNo,
    src,
    alt,
    busy,
    onPreview,
    onRemove,
}: {
    slotNo: number;
    src: string;
    alt: string;
    busy?: boolean;
    onPreview: () => void;
    onRemove: () => void;
}) {
    return (
        <div className="ssh-photo-slot is-filled">
            <span className="ssh-photo-slot__no">{slotNo}</span>
            <button type="button" className="ssh-photo-slot__thumb" onClick={onPreview} aria-label={`${alt} — büyüt`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt} />
            </button>
            <div className="ssh-photo-slot__overlay">
                <button
                    type="button"
                    className="ssh-photo-slot__del"
                    disabled={busy}
                    aria-label={`Slot ${slotNo} fotoğrafını kaldır`}
                    onClick={e => {
                        e.stopPropagation();
                        onRemove();
                    }}
                >
                    {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} strokeWidth={2} />}
                </button>
            </div>
        </div>
    );
}

export function SshComplaintPhotos({
    complaintId,
    photos,
    onPhotosChange,
    pendingPhotos = [],
    onPendingPhotosChange,
}: {
    complaintId: number | null;
    photos: SshComplaintPhoto[];
    onPhotosChange: (complaint: SshComplaint) => void;
    pendingPhotos?: PendingSshPhoto[];
    onPendingPhotosChange?: (photos: PendingSshPhoto[]) => void;
}) {
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [preview, setPreview] = useState<PreviewState | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isCreateMode = complaintId == null;
    const sortedSaved = [...photos].sort((a, b) => a.displayOrder - b.displayOrder);
    const filled: FilledSlot[] = isCreateMode
        ? pendingPhotos.map(p => ({ kind: 'pending' as const, photo: p }))
        : sortedSaved.map(p => ({ kind: 'saved' as const, photo: p }));

    const totalCount = filled.length;
    const room = SSH_MAX_PHOTOS - totalCount;
    const nextSlotIndex = totalCount;

    useEffect(() => {
        if (!preview) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPreview(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [preview]);

    const processFiles = useCallback(
        async (files: FileList | null) => {
            if (!files?.length || room <= 0) return;
            const picked = Array.from(files).filter(isImageFile).slice(0, room);
            if (picked.length === 0) {
                alert('Lütfen geçerli bir görsel seçin (JPG, PNG, WebP…)');
                return;
            }

            if (isCreateMode) {
                if (!onPendingPhotosChange) return;
                try {
                    setAdding(true);
                    const next = [...pendingPhotos];
                    for (const file of picked) {
                        if (next.length >= SSH_MAX_PHOTOS) break;
                        next.push(await fileToWebp(file));
                    }
                    onPendingPhotosChange(next);
                } catch (e) {
                    alert(e instanceof Error ? e.message : 'Fotoğraf dönüştürülemedi');
                } finally {
                    setAdding(false);
                }
                return;
            }

            if (!complaintId) return;
            try {
                setAdding(true);
                let latest: SshComplaint | null = null;
                for (const file of picked) {
                    const webp = await fileToWebp(file);
                    latest = await addSshComplaintPhoto(complaintId, {
                        mimeType: webp.mimeType,
                        dataBase64: webp.dataBase64,
                        originalFileName: webp.fileName,
                    });
                    URL.revokeObjectURL(webp.previewUrl);
                }
                if (latest) onPhotosChange(latest);
            } catch (e) {
                alert(e instanceof Error ? e.message : 'Fotoğraf yüklenemedi');
            } finally {
                setAdding(false);
            }
        },
        [
            complaintId,
            isCreateMode,
            onPendingPhotosChange,
            onPhotosChange,
            pendingPhotos,
            room,
        ]
    );

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const list = e.target.files;
        if (!list?.length) return;
        void processFiles(list).finally(() => {
            e.target.value = '';
        });
    };

    const openFilePicker = () => {
        if (adding || room <= 0) return;
        fileInputRef.current?.click();
    };

    const removePending = (localId: string) => {
        if (!onPendingPhotosChange) return;
        const removed = pendingPhotos.find(p => p.localId === localId);
        if (removed) URL.revokeObjectURL(removed.previewUrl);
        onPendingPhotosChange(pendingPhotos.filter(p => p.localId !== localId));
    };

    const removeExisting = async (photoId: number) => {
        if (!complaintId) return;
        try {
            setDeletingId(photoId);
            const updated = await deleteSshComplaintPhoto(complaintId, photoId);
            onPhotosChange(updated);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Fotoğraf silinemedi');
        } finally {
            setDeletingId(null);
        }
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        void processFiles(e.dataTransfer.files);
    };

    return (
        <>
            <div className="ssh-photo-slots">
                <div className="ssh-photo-slots__head">
                    <div className="ssh-photo-slots__brand">
                        <span className="ssh-photo-slots__icon" aria-hidden>
                            <Camera size={16} strokeWidth={2} />
                        </span>
                        <div>
                            <h4 className="ssh-photo-slots__title">Şikayet fotoğrafları</h4>
                            <p className="ssh-photo-slots__desc">
                                En fazla {SSH_MAX_PHOTOS} görsel · WebP · tıkla veya sürükle-bırak
                            </p>
                        </div>
                    </div>
                    <div className="ssh-photo-slots__meta">
                        <div className="ssh-photo-slots__ring" aria-hidden>
                            <svg viewBox="0 0 36 36">
                                <circle className="ssh-photo-slots__ring-bg" cx="18" cy="18" r="15.5" />
                                <circle
                                    className="ssh-photo-slots__ring-fill"
                                    cx="18"
                                    cy="18"
                                    r="15.5"
                                    strokeDasharray={`${(totalCount / SSH_MAX_PHOTOS) * 97.4} 97.4`}
                                />
                            </svg>
                            <span className="ssh-photo-slots__ring-label">
                                {totalCount}
                                <small>/{SSH_MAX_PHOTOS}</small>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="ssh-photo-slots__track" aria-hidden>
                    {Array.from({ length: SSH_MAX_PHOTOS }, (_, i) => (
                        <span
                            key={i}
                            className={`ssh-photo-slots__dot${i < totalCount ? ' is-on' : ''}${i === nextSlotIndex && room > 0 ? ' is-next' : ''}`}
                        />
                    ))}
                </div>

                <div
                    className={`ssh-photo-slots__grid${dragOver ? ' is-dragover' : ''}${adding ? ' is-busy' : ''}`}
                    onDragEnter={e => {
                        e.preventDefault();
                        if (room > 0) setDragOver(true);
                    }}
                    onDragOver={e => {
                        e.preventDefault();
                        if (room > 0) setDragOver(true);
                    }}
                    onDragLeave={e => {
                        if (e.currentTarget === e.target) setDragOver(false);
                    }}
                    onDrop={onDrop}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        tabIndex={-1}
                        aria-hidden
                        className="ssh-photo-slots__file-hidden"
                        disabled={adding || room <= 0}
                        onChange={onFileInputChange}
                    />

                    {dragOver && room > 0 ? (
                        <div className="ssh-photo-slots__dropzone">
                            <Upload size={22} strokeWidth={1.75} />
                            <span>Bırakın</span>
                        </div>
                    ) : null}

                    {Array.from({ length: SSH_MAX_PHOTOS }, (_, index) => {
                        const item = filled[index];
                        const slotNo = index + 1;

                        if (item?.kind === 'pending') {
                            const p = item.photo;
                            return (
                                <FilledSlotView
                                    key={p.localId}
                                    slotNo={slotNo}
                                    src={p.previewUrl}
                                    alt={p.fileName}
                                    onPreview={() => setPreview({ src: p.previewUrl, alt: p.fileName })}
                                    onRemove={() => removePending(p.localId)}
                                />
                            );
                        }

                        if (item?.kind === 'saved') {
                            const photo = item.photo;
                            const src = getSshComplaintPhotoUrl(complaintId!, photo.id);
                            return (
                                <FilledSlotView
                                    key={photo.id}
                                    slotNo={slotNo}
                                    src={src}
                                    alt={photo.originalFileName || 'Şikayet fotoğrafı'}
                                    busy={deletingId === photo.id}
                                    onPreview={() =>
                                        setPreview({
                                            src,
                                            alt: photo.originalFileName || 'Şikayet fotoğrafı',
                                        })
                                    }
                                    onRemove={() => void removeExisting(photo.id)}
                                />
                            );
                        }

                        const isNext = index === nextSlotIndex && room > 0;

                        if (!isNext) {
                            return (
                                <div key={`empty-${index}`} className="ssh-photo-slot is-empty is-future">
                                    <span className="ssh-photo-slot__no">{slotNo}</span>
                                    <span className="ssh-photo-slot__ghost-icon" aria-hidden>
                                        <Camera size={14} strokeWidth={1.5} />
                                    </span>
                                </div>
                            );
                        }

                        return (
                            <button
                                key={`empty-${index}`}
                                type="button"
                                className="ssh-photo-slot is-empty is-next is-pickable"
                                disabled={adding}
                                onClick={openFilePicker}
                            >
                                <span className="ssh-photo-slot__no">{slotNo}</span>
                                <span className="ssh-photo-slot__add-icon">
                                    {adding ? (
                                        <Loader2 size={18} className="spin" />
                                    ) : (
                                        <ImagePlus size={18} strokeWidth={1.75} />
                                    )}
                                </span>
                                <span className="ssh-photo-slot__add-label">{adding ? '…' : 'Ekle'}</span>
                            </button>
                        );
                    })}
                </div>

                {isCreateMode && pendingPhotos.length > 0 ? (
                    <p className="ssh-photo-slots__note" role="status">
                        {pendingPhotos.length} fotoğraf seçildi — kayıt oluşturulunca sunucuya yüklenecek.
                    </p>
                ) : null}
            </div>

            {preview ? (
                <div
                    className="modal-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Fotoğraf önizleme"
                    onClick={() => setPreview(null)}
                >
                    <div className="ssh-photo-lightbox" onClick={e => e.stopPropagation()}>
                        <div className="ssh-photo-lightbox__toolbar">
                            <h3 className="ssh-photo-lightbox__title">{preview.alt}</h3>
                            <button
                                type="button"
                                className="ssh-photo-lightbox__close"
                                aria-label="Kapat"
                                onClick={() => setPreview(null)}
                            >
                                <X size={20} strokeWidth={2} />
                            </button>
                        </div>
                        <div className="ssh-photo-lightbox__body">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preview.src} alt={preview.alt} className="ssh-photo-lightbox__img" />
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
