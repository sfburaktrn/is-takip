'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

function useCloseOnOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open, onClose, ref]);
}

export function SshDropdown({
    label,
    sublabel,
    value,
    options,
    disabled,
    disabledText = 'Üst yapı tipini seçin',
    placeholder = 'Seçin',
    required,
    allowEmpty,
    allowCustom,
    onChange,
}: {
    label: string;
    sublabel?: string;
    value: string;
    options: string[];
    disabled?: boolean;
    disabledText?: string;
    placeholder?: string;
    required?: boolean;
    allowEmpty?: boolean;
    allowCustom?: boolean;
    onChange: (v: string) => void;
}) {
    const stored = (value ?? '').trim();
    const [open, setOpen] = useState(false);
    const [customMode, setCustomMode] = useState(
        () => !!allowCustom && stored !== '' && !options.includes(stored)
    );
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!allowCustom) return;
        if (!stored) setCustomMode(false);
        else if (!options.includes(stored)) setCustomMode(true);
    }, [stored, options, allowCustom]);

    useCloseOnOutside(rootRef, open, () => setOpen(false));

    const triggerText = disabled
        ? disabledText
        : customMode
          ? stored || 'Kendin yaz…'
          : stored || placeholder;

    const isPlaceholder = !disabled && !stored && !customMode;

    const pick = (next: string, custom: boolean) => {
        if (custom) {
            setCustomMode(true);
            setOpen(false);
            return;
        }
        setCustomMode(false);
        onChange(next);
        setOpen(false);
    };

    return (
        <div className="ssh-field ssh-choice" ref={rootRef}>
            <span className="ssh-field__label">
                {label}
                {required ? <span className="ssh-field__req">*</span> : null}
                {sublabel ? <span className="ssh-field__sublabel">{sublabel}</span> : null}
            </span>
            <button
                type="button"
                className={`ssh-choice__trigger ${isPlaceholder ? 'is-placeholder' : ''} ${open ? 'is-open' : ''}`}
                disabled={disabled}
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen(o => !o)}
            >
                <span className="ssh-choice__text">{triggerText}</span>
                <ChevronDown size={17} strokeWidth={2.25} className="ssh-choice__chev" aria-hidden />
            </button>
            {open && !disabled ? (
                <div className="ssh-choice__menu" role="listbox">
                    {allowEmpty ? (
                        <button
                            type="button"
                            role="option"
                            className={`ssh-choice__item is-muted ${!stored && !customMode ? 'is-selected' : ''}`}
                            onClick={() => pick('', false)}
                        >
                            <span className="ssh-choice__mark" aria-hidden>
                                {!stored && !customMode ? <Check size={15} strokeWidth={2.5} /> : null}
                            </span>
                            Boş bırak
                        </button>
                    ) : null}
                    {options.map(opt => (
                        <button
                            key={opt}
                            type="button"
                            role="option"
                            className={`ssh-choice__item ${stored === opt && !customMode ? 'is-selected' : ''}`}
                            onClick={() => pick(opt, false)}
                        >
                            <span className="ssh-choice__mark" aria-hidden>
                                {stored === opt && !customMode ? <Check size={15} strokeWidth={2.5} /> : null}
                            </span>
                            <span className="ssh-choice__item-label">{opt}</span>
                        </button>
                    ))}
                    {allowCustom ? (
                        <button
                            type="button"
                            role="option"
                            className={`ssh-choice__item is-action ${customMode ? 'is-selected' : ''}`}
                            onClick={() => pick('', true)}
                        >
                            <span className="ssh-choice__mark" aria-hidden />
                            Kendin yaz…
                        </button>
                    ) : null}
                </div>
            ) : null}
            {allowCustom && customMode && !disabled ? (
                <input
                    className="ssh-field__input ssh-choice__custom"
                    value={value ?? ''}
                    placeholder="Değeri yazın"
                    autoFocus
                    onChange={e => onChange(e.target.value)}
                />
            ) : null}
        </div>
    );
}

export function SshModernSelect(props: {
    label: string;
    sublabel?: string;
    value: string;
    options: string[];
    disabled?: boolean;
    disabledHint?: string;
    placeholder?: string;
    required?: boolean;
    allowEmpty?: boolean;
    onChange: (v: string) => void;
}) {
    return (
        <SshDropdown
            {...props}
            disabledText={props.disabledHint}
            placeholder={props.placeholder ?? 'Seçin'}
        />
    );
}

export function SshBolgePick(props: {
    label: string;
    sublabel: string;
    value: string;
    options: string[];
    disabled: boolean;
    disabledHint?: string;
    onChange: (v: string) => void;
}) {
    return (
        <SshDropdown
            label={props.label}
            sublabel={props.sublabel}
            value={props.value}
            options={props.options}
            disabled={props.disabled}
            disabledText={props.disabledHint}
            placeholder="Seçin"
            allowEmpty
            allowCustom
            onChange={props.onChange}
        />
    );
}
