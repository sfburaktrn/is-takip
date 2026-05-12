'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PenLine } from 'lucide-react';

export type ProductNoteKind = 'DAMPER' | 'DORSE' | 'SASI';

type ProductLocalNoteProps = {
    kind: ProductNoteKind;
    productId: number;
    value: string | null | undefined;
    onPersist: (nextText: string | null) => Promise<void>;
};

function comparableSaved(raw: string | null | undefined): string {
    const t = (raw ?? '').trim();
    return t === '' ? '' : t.slice(0, 8000);
}

const SAVE_DEBOUNCE_MS = 900;

export function ProductLocalNote({ kind, productId, value, onPersist }: ProductLocalNoteProps) {
    void kind;
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
        // value senkronu aşağıdaki effect'te; productId değişiminde yalnızca ürün sıfırlanır
        // eslint-disable-next-line react-hooks/exhaustive-deps -- value ayrı effect ile
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

    return (
        <div className="apple-product-note" onClick={e => e.stopPropagation()}>
            <div className="apple-product-note__top">
                <span className="apple-product-note__icon">
                    <PenLine size={18} strokeWidth={2} />
                </span>
                <div className="apple-product-note__title-row">
                    <div className="apple-product-note__title-group">
                        <h4 className="apple-product-note__title">Hızlı not</h4>
                    </div>
                    {saving ? <span className="apple-product-note__saving">Kaydediliyor…</span> : null}
                </div>
            </div>
            <textarea
                value={text}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder="Örn: müşteri aradı, yedek parça bekleniyor, özel boya kodu…"
                rows={4}
                maxLength={8000}
                className="input apple-product-note__textarea"
            />
            <div className="apple-product-note__hint">
                Yazmayı bıraktıktan sonra kaydedilir (~1 sn) veya alan dışına tıklayınca hemen kaydedilir
            </div>
        </div>
    );
}
