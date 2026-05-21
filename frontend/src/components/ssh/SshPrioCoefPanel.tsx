'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import type { PrioOptionRow } from '@/lib/sshScoring';

export function SshPrioCoefPanel({
    prioName,
    coefficient,
    suggested,
    table,
    onPick,
    onChangeCoef,
    onManualChange,
}: {
    prioName: string | null;
    coefficient: number | null;
    suggested: number | null;
    table: PrioOptionRow[];
    onPick: (name: string, coefficient: number) => void;
    onChangeCoef: (v: number | null) => void;
    onManualChange?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const selectedIdx = useMemo(() => {
        if (prioName) {
            const byName = table.findIndex(p => p.name === prioName);
            if (byName >= 0) return byName;
        }
        if (coefficient != null) return table.findIndex(p => p.coefficient === coefficient);
        return -1;
    }, [table, prioName, coefficient]);

    const selectedRow = useMemo(
        () => (selectedIdx >= 0 ? table[selectedIdx] : null),
        [table, selectedIdx]
    );

    const isAuto = coefficient != null && suggested != null && coefficient === suggested && !!prioName;

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        dialogRef.current?.focus();
    }, [open]);

    const pickRow = (row: PrioOptionRow) => {
        onPick(row.name, row.coefficient);
        onManualChange?.();
        setOpen(false);
    };

    const popover =
        open && mounted
            ? createPortal(
                  <div className="ssh-exit-coef__layer" role="presentation">
                      <button
                          type="button"
                          className="ssh-exit-coef__backdrop"
                          aria-label="Kapat"
                          onClick={() => setOpen(false)}
                      />
                      <div
                          ref={dialogRef}
                          className="ssh-exit-coef__popover ssh-exit-coef__popover--wide"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="ssh-prio-coef-title"
                          tabIndex={-1}
                      >
                          <header className="ssh-exit-coef__popover-head">
                              <div className="ssh-exit-coef__popover-titles">
                                  <h4 id="ssh-prio-coef-title" className="ssh-exit-coef__ref-title">
                                      Öncelik katsayısı tablosu
                                  </h4>
                                  <p className="ssh-exit-coef__ref-desc">
                                      Hatanın öncelik katsayısı aşağıdaki tabloya göre belirlenir. Satıra tıklayın.
                                  </p>
                              </div>
                              <button
                                  type="button"
                                  className="ssh-exit-coef__close"
                                  aria-label="Kapat"
                                  onClick={() => setOpen(false)}
                              >
                                  <X size={18} strokeWidth={2.25} />
                              </button>
                          </header>
                          {selectedRow ? (
                              <p className="ssh-exit-coef__popover-active ssh-exit-coef__popover-active--prio" role="status">
                                  <strong>{selectedRow.name}</strong> · katsayı <strong>{selectedRow.coefficient}</strong>
                                  {selectedRow.description ? (
                                      <>
                                          {' '}
                                          · <span className="ssh-prio-active-desc">{selectedRow.description}</span>
                                      </>
                                  ) : null}
                              </p>
                          ) : null}
                          <div className="ssh-exit-coef__table-wrap">
                              <table className="ssh-exit-coef__table">
                                  <thead>
                                      <tr>
                                          <th scope="col">Öncelik</th>
                                          <th scope="col">Katsayı</th>
                                          <th scope="col">Öncelik tanımı</th>
                                          <th scope="col" className="ssh-exit-coef__pick-col">
                                              Seç
                                          </th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {table.map((row, i) => {
                                          const isSelected = i === selectedIdx;
                                          return (
                                              <tr
                                                  key={row.name}
                                                  className={`ssh-exit-coef__row-btn ${isSelected ? 'is-selected' : ''}`}
                                                  title="Bu önceliği seçmek için tıklayın"
                                                  onClick={() => pickRow(row)}
                                                  onKeyDown={e => {
                                                      if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault();
                                                          pickRow(row);
                                                      }
                                                  }}
                                                  tabIndex={0}
                                                  role="button"
                                                  aria-label={`${row.name}, katsayı ${row.coefficient}, ${row.description ?? ''}`}
                                                  aria-pressed={isSelected}
                                              >
                                                  <td>
                                                      <span className="ssh-prio-row__name">{row.name}</span>
                                                  </td>
                                                  <td>
                                                      <span className="ssh-exit-coef__coef">{row.coefficient}</span>
                                                  </td>
                                                  <td className="ssh-prio-row__desc">{row.description ?? '—'}</td>
                                                  <td className="ssh-exit-coef__pick-hint" aria-hidden>
                                                      {isSelected ? 'Seçildi' : 'Tıkla →'}
                                                  </td>
                                              </tr>
                                          );
                                      })}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            <div className="ssh-field ssh-field--score ssh-score-card ssh-prio-coef-card">
                <div className="ssh-score-card__head">
                    <span className="ssh-field__label">Öncelik katsayısı</span>
                    <button
                        type="button"
                        className="ssh-info-fab ssh-info-fab--prio"
                        onClick={() => setOpen(true)}
                        aria-label="Öncelik katsayısı tablosunu aç"
                        aria-haspopup="dialog"
                        title="Tablodan seç"
                    >
                        <span className="ssh-info-fab__ring" aria-hidden />
                        <span className="ssh-info-fab__ring ssh-info-fab__ring--delay" aria-hidden />
                        <Info size={18} strokeWidth={2.25} className="ssh-info-fab__icon" aria-hidden />
                    </button>
                </div>
                <p className="ssh-score-hint">
                    {selectedRow?.description
                        ? selectedRow.description
                        : isAuto
                          ? `${prioName} · tablodan`
                          : prioName
                            ? `${prioName} · düzenlenebilir`
                            : suggested != null
                              ? `Tablodan seçin (ör. PRİO 1 → ${suggested})`
                              : 'ℹ ile tablodan öncelik seçin'}
                </p>
                <input
                    className="ssh-field__input ssh-field__input--num"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={coefficient == null ? '' : String(coefficient)}
                    onChange={e => {
                        const v = e.target.value;
                        onManualChange?.();
                        if (v === '') onChangeCoef(null);
                        else {
                            const n = parseInt(v, 10);
                            if (Number.isFinite(n) && n >= 1) onChangeCoef(n);
                        }
                    }}
                />
                {selectedRow ? (
                    <p className="ssh-exit-coef-card__foot ssh-prio-coef-card__foot" role="status" title={selectedRow.description}>
                        <span className="ssh-prio-coef-card__prio">{selectedRow.name}</span>
                        {selectedRow.description ? (
                            <span className="ssh-prio-coef-card__def">{selectedRow.description}</span>
                        ) : null}
                    </p>
                ) : null}
            </div>
            {popover}
        </>
    );
}
