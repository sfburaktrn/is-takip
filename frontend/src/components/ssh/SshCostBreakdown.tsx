'use client';

import './SshCostBreakdown.css';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BadgeCheck, CircleDollarSign, Plus, Trash2 } from 'lucide-react';
import {
    activeOnayPct,
    calcMaliyetTotals,
    emptyIscilikRow,
    emptyMalzemeRow,
    fmtTry,
    lineTotal,
    roundMoney,
    type SshIscilikSatir,
    type SshMaliyetDetay,
    type SshMalzemeSatir,
} from '@/lib/sshCost';

const ONAY_PCTS = [25, 50, 75, 100] as const;

const DECIMAL_DRAFT = /^\d*[.,]?\d*$/;

function parseDecimalText(raw: string): number | null {
    const v = raw.trim().replace(',', '.');
    if (v === '' || v === '.') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Artır/azalt okları yok; doğrudan yazılır, blur/Enter ile sayıya çevrilir. */
function DecimalTextInput({
    value,
    onChange,
    className,
    id,
    placeholder,
    max,
}: {
    value: number | null;
    onChange: (v: number | null) => void;
    className?: string;
    id?: string;
    placeholder?: string;
    max?: number;
}) {
    const [text, setText] = useState(() => (value == null ? '' : String(value)));
    const focusedRef = useRef(false);

    useEffect(() => {
        if (!focusedRef.current) {
            setText(value == null ? '' : String(value));
        }
    }, [value]);

    const commit = (raw: string) => {
        let n = parseDecimalText(raw);
        if (n != null && max != null) n = Math.min(max, n);
        onChange(n);
        setText(n == null ? '' : String(n));
    };

    return (
        <input
            id={id}
            className={className}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={placeholder}
            value={text}
            onFocus={() => {
                focusedRef.current = true;
            }}
            onBlur={() => {
                focusedRef.current = false;
                commit(text);
            }}
            onChange={e => {
                const v = e.target.value;
                if (v === '' || DECIMAL_DRAFT.test(v)) setText(v);
            }}
            onKeyDown={e => {
                if (e.key === 'Enter') e.currentTarget.blur();
            }}
        />
    );
}

function MoneyInput({
    value,
    onChange,
    placeholder,
    variant = 'table',
    id,
}: {
    value: number | null;
    onChange: (v: number | null) => void;
    placeholder?: string;
    variant?: 'table' | 'hero';
    id?: string;
}) {
    return (
        <div className={`ssh-cost-money${variant === 'hero' ? ' ssh-cost-money--hero' : ''}`}>
            <span className="ssh-cost-money__sym" aria-hidden>
                ₺
            </span>
            <DecimalTextInput
                id={id}
                className={variant === 'hero' ? 'ssh-cost-onay__amount-input' : 'ssh-cost-money__input'}
                value={value}
                onChange={onChange}
                placeholder={placeholder ?? '0,00'}
            />
        </div>
    );
}

function CostTableSection<T extends { id: string }>({
    title,
    columns,
    rows,
    onAdd,
    onRemove,
    renderRow,
    footerTotal,
}: {
    title: string;
    columns: { key: string; label: string; align?: 'right' }[];
    rows: T[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    renderRow: (row: T, index: number) => ReactNode;
    footerTotal: number;
}) {
    return (
        <section className="ssh-cost-section">
            <div className="ssh-cost-section__head">
                <h4 className="ssh-cost-section__title">{title}</h4>
                <button type="button" className="ssh-cost-add-btn" onClick={onAdd}>
                    <Plus size={16} strokeWidth={2.25} />
                    Satır ekle
                </button>
            </div>
            <div className="ssh-cost-table-wrap">
                <table className="ssh-cost-table ssh-cost-table--cards-mobile">
                    <thead>
                        <tr>
                            <th className="ssh-cost-table__col-no">S.No</th>
                            {columns.map(c => (
                                <th key={c.key} className={c.align === 'right' ? 'ssh-cost-table__col-num' : undefined}>
                                    {c.label}
                                </th>
                            ))}
                            <th className="ssh-cost-table__col-action" aria-label="İşlem" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={row.id}>
                                <td className="ssh-cost-table__col-no" data-label="S.No">{i + 1}</td>
                                {renderRow(row, i)}
                                <td className="ssh-cost-table__col-action" data-label="İşlem">
                                    <button
                                        type="button"
                                        className="ssh-cost-remove-btn"
                                        aria-label="Satırı sil"
                                        disabled={rows.length <= 1}
                                        onClick={() => onRemove(row.id)}
                                    >
                                        <Trash2 size={15} strokeWidth={2} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={columns.length + 1} className="ssh-cost-table__foot-label">
                                TOPLAM
                            </td>
                            <td className="ssh-cost-table__foot-value">{fmtTry(footerTotal)}</td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </section>
    );
}

export function SshCostBreakdown({
    detay,
    onChange,
    toplamTutar,
    onaylananTutar,
    onOnaylananChange,
}: {
    detay: SshMaliyetDetay;
    onChange: (d: SshMaliyetDetay) => void;
    toplamTutar: number;
    onaylananTutar: number | null;
    onOnaylananChange: (v: number | null) => void;
}) {
    const totals = calcMaliyetTotals(detay);
    const activePct = activeOnayPct(onaylananTutar, toplamTutar);
    const karTutar = roundMoney(toplamTutar - totals.araToplam);
    const onayBarPct =
        toplamTutar > 0 && onaylananTutar != null
            ? Math.min(100, Math.round((onaylananTutar / toplamTutar) * 100))
            : 0;

    const updateMalzeme = (id: string, patch: Partial<SshMalzemeSatir>) => {
        onChange({
            ...detay,
            malzemeler: detay.malzemeler.map(r => (r.id === id ? { ...r, ...patch } : r)),
        });
    };

    const updateIscilik = (id: string, patch: Partial<SshIscilikSatir>) => {
        onChange({
            ...detay,
            iscilik: detay.iscilik.map(r => (r.id === id ? { ...r, ...patch } : r)),
        });
    };

    return (
        <div className="ssh-cost-breakdown">
            <CostTableSection
                title="Malzeme"
                columns={[
                    { key: 'aciklama', label: 'Malzeme' },
                    { key: 'birim', label: 'Birim tutar', align: 'right' },
                    { key: 'miktar', label: 'Miktar', align: 'right' },
                    { key: 'toplam', label: 'Toplam tutar', align: 'right' },
                ]}
                rows={detay.malzemeler}
                onAdd={() => onChange({ ...detay, malzemeler: [...detay.malzemeler, emptyMalzemeRow()] })}
                onRemove={id =>
                    onChange({
                        ...detay,
                        malzemeler:
                            detay.malzemeler.length <= 1
                                ? detay.malzemeler
                                : detay.malzemeler.filter(r => r.id !== id),
                    })
                }
                footerTotal={totals.malzemeToplam}
                renderRow={row => (
                    <>
                        <td data-label="Malzeme">
                            <input
                                className="ssh-cost-cell-input"
                                type="text"
                                placeholder="Malzeme adı"
                                value={row.aciklama}
                                onChange={e => updateMalzeme(row.id, { aciklama: e.target.value })}
                            />
                        </td>
                        <td className="ssh-cost-table__col-num" data-label="Birim tutar">
                            <MoneyInput
                                value={row.birimTutar}
                                onChange={v => updateMalzeme(row.id, { birimTutar: v })}
                            />
                        </td>
                        <td className="ssh-cost-table__col-num" data-label="Miktar">
                            <DecimalTextInput
                                className="ssh-cost-cell-input ssh-cost-cell-input--num"
                                placeholder="0"
                                value={row.miktar}
                                onChange={v => updateMalzeme(row.id, { miktar: v })}
                            />
                        </td>
                        <td className="ssh-cost-table__col-num ssh-cost-line-total" data-label="Toplam tutar">
                            {fmtTry(lineTotal(row.birimTutar, row.miktar))}
                        </td>
                    </>
                )}
            />

            <CostTableSection
                title="İşçilik"
                columns={[
                    { key: 'aciklama', label: 'İşçilik' },
                    { key: 'birim', label: 'Birim tutar', align: 'right' },
                    { key: 'sure', label: 'Süre (saat)', align: 'right' },
                    { key: 'toplam', label: 'Toplam tutar', align: 'right' },
                ]}
                rows={detay.iscilik}
                onAdd={() => onChange({ ...detay, iscilik: [...detay.iscilik, emptyIscilikRow()] })}
                onRemove={id =>
                    onChange({
                        ...detay,
                        iscilik: detay.iscilik.length <= 1 ? detay.iscilik : detay.iscilik.filter(r => r.id !== id),
                    })
                }
                footerTotal={totals.iscilikToplam}
                renderRow={row => (
                    <>
                        <td data-label="İşçilik">
                            <input
                                className="ssh-cost-cell-input"
                                type="text"
                                placeholder="İşçilik türü"
                                value={row.aciklama}
                                onChange={e => updateIscilik(row.id, { aciklama: e.target.value })}
                            />
                        </td>
                        <td className="ssh-cost-table__col-num" data-label="Birim tutar">
                            <MoneyInput
                                value={row.birimTutar}
                                onChange={v => updateIscilik(row.id, { birimTutar: v })}
                            />
                        </td>
                        <td className="ssh-cost-table__col-num" data-label="Süre (saat)">
                            <DecimalTextInput
                                className="ssh-cost-cell-input ssh-cost-cell-input--num"
                                placeholder="0"
                                value={row.sureSaat}
                                onChange={v => updateIscilik(row.id, { sureSaat: v })}
                            />
                        </td>
                        <td className="ssh-cost-table__col-num ssh-cost-line-total" data-label="Toplam tutar">
                            {fmtTry(lineTotal(row.birimTutar, row.sureSaat))}
                        </td>
                    </>
                )}
            />

            <div className="ssh-cost-footer">
                <div className="ssh-cost-sum-stack">
                    <div className="ssh-cost-kar-bar ssh-cost-kar-bar--pre-total">
                        <div className="ssh-cost-kar-bar__text">
                            <span className="ssh-cost-kar-bar__label">Yedek parça / servis kar</span>
                            <span className="ssh-cost-kar-bar__sub">
                                Ara toplam {fmtTry(totals.araToplam)} üzerinden uygulanır
                            </span>
                        </div>
                        <div className="ssh-cost-kar">
                            <DecimalTextInput
                                id="ssh-kar-orani"
                                className="ssh-cost-kar__input"
                                placeholder="15"
                                value={detay.karOraniYuzde}
                                onChange={v =>
                                    onChange({
                                        ...detay,
                                        karOraniYuzde: v,
                                    })
                                }
                            />
                            <span className="ssh-cost-kar__pct">%</span>
                        </div>
                    </div>

                    <section className="ssh-cost-total-card" aria-labelledby="ssh-toplam-heading">
                    <div className="ssh-cost-total-card__head">
                        <span className="ssh-cost-total-card__icon" aria-hidden>
                            <CircleDollarSign size={20} strokeWidth={2} />
                        </span>
                        <div>
                            <h4 id="ssh-toplam-heading" className="ssh-cost-total-card__title">
                                Toplam tutar
                            </h4>
                            <p className="ssh-cost-total-card__formula">
                                Malzeme + işçilik + %{detay.karOraniYuzde ?? 0} kar
                            </p>
                        </div>
                    </div>
                    <ul className="ssh-cost-total-card__lines">
                        <li>
                            <span>Malzeme</span>
                            <span>{fmtTry(totals.malzemeToplam)}</span>
                        </li>
                        <li>
                            <span>İşçilik</span>
                            <span>{fmtTry(totals.iscilikToplam)}</span>
                        </li>
                        <li>
                            <span>Kar (%{detay.karOraniYuzde ?? 0})</span>
                            <span>{fmtTry(karTutar)}</span>
                        </li>
                    </ul>
                    <div className="ssh-cost-total-card__grand">
                        <span className="ssh-cost-total-card__grand-label">Genel toplam</span>
                        <span className="ssh-cost-total-card__grand-value">{fmtTry(toplamTutar)}</span>
                    </div>
                    </section>
                </div>

                <section className="ssh-cost-onay-card" aria-labelledby="ssh-onay-heading">
                    <div className="ssh-cost-onay-card__glow" aria-hidden />
                    <div className="ssh-cost-onay-card__top">
                        <div className="ssh-cost-onay-card__brand">
                            <span className="ssh-cost-onay-card__icon" aria-hidden>
                                <BadgeCheck size={20} strokeWidth={2} />
                            </span>
                            <div>
                                <h4 id="ssh-onay-heading" className="ssh-cost-onay-card__title">
                                    Onaylanan tutar
                                </h4>
                                <p className="ssh-cost-onay-card__desc">
                                    Garanti / fabrika onayı için nihai tutar
                                </p>
                            </div>
                        </div>
                        {activePct != null ? (
                            <span className="ssh-cost-onay-card__badge">%{activePct} seçili</span>
                        ) : null}
                    </div>

                    <div className="ssh-cost-onay-card__amount-wrap">
                        <label className="ssh-cost-onay-card__amount-label" htmlFor="ssh-onaylanan">
                            Tutar
                        </label>
                        <MoneyInput
                            id="ssh-onaylanan"
                            value={onaylananTutar}
                            onChange={onOnaylananChange}
                            placeholder="0,00"
                            variant="hero"
                        />
                    </div>

                    <div className="ssh-cost-onay-card__meter">
                        <div className="ssh-cost-onay-card__meter-head">
                            <span>Toplamın payı</span>
                            <span>{onayBarPct}%</span>
                        </div>
                        <div className="ssh-cost-onay-card__meter-track">
                            <div
                                className="ssh-cost-onay-card__meter-fill"
                                style={{ width: `${onayBarPct}%` }}
                            />
                        </div>
                        <span className="ssh-cost-onay-card__meter-cap">{fmtTry(toplamTutar)} tavan</span>
                    </div>

                    <div className="ssh-cost-onay-card__pcts" role="group" aria-label="Toplamın yüzdesi">
                        {ONAY_PCTS.map(p => (
                            <button
                                key={p}
                                type="button"
                                className={`ssh-cost-onay-pill${activePct === p ? ' is-active' : ''}`}
                                onClick={() => onOnaylananChange(roundMoney((toplamTutar * p) / 100))}
                            >
                                <span className="ssh-cost-onay-pill__pct">%{p}</span>
                                <span className="ssh-cost-onay-pill__amt">
                                    {fmtTry(roundMoney((toplamTutar * p) / 100))}
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="ssh-cost-onay-card__hint">
                        Yüzde kısayolları genel toplamı baz alır; tutarı doğrudan da yazabilirsiniz.
                    </p>
                </section>
            </div>
        </div>
    );
}
