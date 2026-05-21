'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { etkiRowDescription, type EtkiOptionRow } from '@/lib/sshScoring';

export function SshEtkiCoefPanel({
    etkiAdi,
    coefficient,
    suggested,
    table,
    onPick,
    onChangeCoef,
    onManualChange,
}: {
    etkiAdi: string | null;
    coefficient: number | null;
    suggested: number | null;
    table: EtkiOptionRow[];
    onPick: (name: string, score: number) => void;
    onChangeCoef: (v: number | null) => void;
    onManualChange?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);

    const selectedIdx = useMemo(() => {
        if (etkiAdi) {
            const byName = table.findIndex(e => e.name === etkiAdi);
            if (byName >= 0) return byName;
        }
        if (coefficient != null) return table.findIndex(e => e.score === coefficient);
        return -1;
    }, [table, etkiAdi, coefficient]);

    const selectedRow = useMemo(() => (selectedIdx >= 0 ? table[selectedIdx] : null), [table, selectedIdx]);
    const isAuto = coefficient != null && suggested != null && coefficient === suggested && !!etkiAdi;

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

    const pickRow = (row: EtkiOptionRow) => {
        onPick(row.name, row.score);
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
                          className="ssh-exit-coef__popover ssh-exit-coef__popover--wide ssh-exit-coef__popover--etki"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="ssh-etki-coef-title"
                          tabIndex={-1}
                      >
                          <header className="ssh-exit-coef__popover-head">
                              <div className="ssh-exit-coef__popover-titles">
                                  <h4 id="ssh-etki-coef-title" className="ssh-exit-coef__ref-title">
                                      Etki puanı tablosu
                                  </h4>
                                  <p className="ssh-exit-coef__ref-desc">
                                      Hatanın etki puanı aşağıdaki tabloya göre tespit edilir. Satıra tıklayın.
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
                              <p className="ssh-exit-coef__popover-active ssh-exit-coef__popover-active--etki" role="status">
                                  <strong>{selectedRow.name}</strong> · puan <strong>{selectedRow.score}</strong>
                                  {etkiRowDescription(selectedRow) ? (
                                      <>
                                          {' '}
                                          · <span className="ssh-etki-active-desc">{etkiRowDescription(selectedRow)}</span>
                                      </>
                                  ) : null}
                              </p>
                          ) : null}
                          <div className="ssh-exit-coef__table-wrap">
                              <table className="ssh-exit-coef__table">
                                  <thead>
                                      <tr>
                                          <th scope="col">Etki adı</th>
                                          <th scope="col">Etki puanı</th>
                                          <th scope="col">Etkinin tanımı</th>
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
                                                  title="Bu etkiyi seçmek için tıklayın"
                                                  onClick={() => pickRow(row)}
                                                  onKeyDown={e => {
                                                      if (e.key === 'Enter' || e.key === ' ') {
                                                          e.preventDefault();
                                                          pickRow(row);
                                                      }
                                                  }}
                                                  tabIndex={0}
                                                  role="button"
                                                  aria-label={`${row.name}, puan ${row.score}, ${etkiRowDescription(row)}`}
                                                  aria-pressed={isSelected}
                                              >
                                                  <td>
                                                      <span className="ssh-etki-row__name">{row.name}</span>
                                                  </td>
                                                  <td>
                                                      <span className="ssh-exit-coef__coef">{row.score}</span>
                                                  </td>
                                                  <td className="ssh-etki-row__desc">{etkiRowDescription(row) || '—'}</td>
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
            <div className="ssh-field ssh-field--score ssh-score-card ssh-etki-coef-card">
                <div className="ssh-score-card__head">
                    <span className="ssh-field__label">Etki katsayısı</span>
                    <button
                        type="button"
                        className="ssh-info-fab ssh-info-fab--etki"
                        onClick={() => setOpen(true)}
                        aria-label="Etki puanı tablosunu aç"
                        aria-haspopup="dialog"
                        title="Tablodan seç"
                    >
                        <span className="ssh-info-fab__ring" aria-hidden />
                        <span className="ssh-info-fab__ring ssh-info-fab__ring--delay" aria-hidden />
                        <Info size={18} strokeWidth={2.25} className="ssh-info-fab__icon" aria-hidden />
                    </button>
                </div>
                <p className="ssh-score-hint">
                    {selectedRow && etkiRowDescription(selectedRow)
                        ? etkiRowDescription(selectedRow)
                        : isAuto
                          ? `${etkiAdi} · tablodan`
                          : etkiAdi
                            ? `${etkiAdi} · düzenlenebilir`
                            : suggested != null
                              ? `Tablodan seçin (ör. ${suggested})`
                              : 'ℹ ile tablodan etki seçin'}
                </p>
                <input
                    className="ssh-field__input ssh-field__input--num"
                    type="number"
                    min={1}
                    max={10}
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
                    <p
                        className="ssh-exit-coef-card__foot ssh-etki-coef-card__foot"
                        role="status"
                        title={etkiRowDescription(selectedRow)}
                    >
                        <span className="ssh-etki-coef-card__name">{selectedRow.name}</span>
                        {etkiRowDescription(selectedRow) ? (
                            <span className="ssh-etki-coef-card__def">{etkiRowDescription(selectedRow)}</span>
                        ) : null}
                    </p>
                ) : null}
            </div>
            {popover}
        </>
    );
}
