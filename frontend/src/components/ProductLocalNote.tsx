'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PenLine, Sparkles } from 'lucide-react';

export type ProductNoteKind = 'DAMPER' | 'DORSE' | 'SASI';

type ProductLocalNoteProps = {
    kind: ProductNoteKind;
    productId: number;
    value: string | null | undefined;
    label?: string;
    onPersist: (nextText: string | null) => Promise<void>;
};

function comparableSaved(raw: string | null | undefined): string {
    const t = (raw ?? '').trim();
    return t === '' ? '' : t.slice(0, 8000);
}

const SAVE_DEBOUNCE_MS = 900;

export function ProductLocalNote({ kind, productId, value, label, onPersist }: ProductLocalNoteProps) {
    const [text, setText] = useState(() => value ?? '');
    const [saving, setSaving] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef<string>(comparableSaved(value));
    const textRef = useRef(text);
    textRef.current = text;
    /** Sunucudan gelen value ile text'i ezmeyi yazarken engelle */
    const dirtyRef = useRef(false);
    const onPersistRef = useRef(onPersist);
    onPersistRef.current = onPersist;

    useEffect(() => {
        dirtyRef.current = false;
        const next = value ?? '';
        setText(next);
        lastSavedRef.current = comparableSaved(next);
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
    }, [productId]);

    useEffect(() => {
        if (dirtyRef.current) return;
        const next = value ?? '';
        setText(next);
        lastSavedRef.current = comparableSaved(next);
    }, [value]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    const flushSave = useCallback(async (raw: string) => {
        const trimmed = raw.trim();
        const next: string | null = trimmed === '' ? null : trimmed.slice(0, 8000);
        const serialized = comparableSaved(next);
        if (serialized === lastSavedRef.current) return;
        setSaving(true);
        try {
            await onPersistRef.current(next);
            lastSavedRef.current = serialized;
            dirtyRef.current = false;
        } catch (e) {
            console.error('cardNote save failed', e);
        } finally {
            setSaving(false);
        }
    }, []);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            saveTimerRef.current = null;
            void flushSave(textRef.current);
        }, SAVE_DEBOUNCE_MS);
    }, [flushSave]);

    const onChange = (next: string) => {
        const v = next.slice(0, 8000);
        dirtyRef.current = true;
        setText(v);
        scheduleSave();
    };

    const onBlur = () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }
        void flushSave(textRef.current);
    };

    const defaultLabel = kind === 'DAMPER' ? 'Damper' : kind === 'DORSE' ? 'Dorse' : 'Şasi';

    return (
        <div
            onClick={e => e.stopPropagation()}
            style={{
                position: 'relative',
                marginBottom: '20px',
                padding: '16px 18px 14px',
                borderRadius: '14px',
                background: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 45%, #fde68a 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                boxShadow: '0 10px 28px rgba(2, 35, 71, 0.08), inset 0 1px 0 rgba(255,255,255,0.65)',
                transform: 'rotate(-0.4deg)',
                maxWidth: '100%',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '50%',
                    marginLeft: '-28px',
                    width: '56px',
                    height: '14px',
                    background: 'linear-gradient(90deg, rgba(99,102,241,0.5), rgba(168,85,247,0.45))',
                    opacity: 0.85,
                    borderRadius: '2px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                }}
                aria-hidden
            />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                <span
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(2, 35, 71, 0.08)',
                        color: 'var(--primary)',
                        flexShrink: 0,
                    }}
                >
                    <PenLine size={18} strokeWidth={2} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <h4
                                style={{
                                    margin: 0,
                                    fontSize: '15px',
                                    fontWeight: 700,
                                    color: '#78350f',
                                    letterSpacing: '-0.02em',
                                }}
                            >
                                Hızlı not
                            </h4>
                            <Sparkles size={14} style={{ color: '#b45309', opacity: 0.85 }} aria-hidden />
                        </div>
                        {saving && (
                            <span style={{ fontSize: '11px', color: '#92400e', opacity: 0.9 }}>Kaydediliyor…</span>
                        )}
                    </div>
                    <p
                        style={{
                            margin: '4px 0 0',
                            fontSize: '12px',
                            lineHeight: 1.45,
                            color: '#92400e',
                            opacity: 0.92,
                        }}
                    >
                        <strong>{label ?? defaultLabel}</strong> — hatırlatma metni veritabanına kaydedilir; üretim adımları ve diğer alanlar
                        aynı kalır.
                    </p>
                </div>
            </div>
            <textarea
                value={text}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder="Örn: müşteri aradı, yedek parça bekleniyor, özel boya kodu…"
                rows={4}
                maxLength={8000}
                className="input"
                style={{
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '88px',
                    fontSize: '14px',
                    lineHeight: 1.5,
                    background: 'rgba(255,255,255,0.72)',
                    border: '1px solid rgba(180, 83, 9, 0.25)',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    color: '#422006',
                }}
            />
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#92400e', opacity: 0.75 }}>
                Yazmayı bıraktıktan sonra kaydedilir (~1 sn) veya alan dışına tıklayınca hemen kaydedilir
            </div>
        </div>
    );
}
