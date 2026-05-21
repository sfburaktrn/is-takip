'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import {
    buildExitCoefDisplayRows,
    exitCoefActiveIndex,
    type ExitCoefRow,
} from '@/lib/sshScoring';

/** Çıkış süre katsayısı — otomatik; tablo yalnızca bilgi (salt okunur). */
export function SshExitCoefPanel({
    cikisGun,
    coefficient,
    table,
}: {
    cikisGun: number | null;
    coefficient: number | null;
    table: ExitCoefRow[];
}) {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const rows = useMemo(() => buildExitCoefDisplayRows(table), [table]);
    const activeIdx = useMemo(() => exitCoefActiveIndex(cikisGun, table), [cikisGun, table]);

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
                          className="ssh-exit-coef__popover"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="ssh-exit-coef-title"
                          tabIndex={-1}
                      >
                          <header className="ssh-exit-coef__popover-head">
                              <div className="ssh-exit-coef__popover-titles">
                                  <h4 id="ssh-exit-coef-title" className="ssh-exit-coef__ref-title">
                                      Çıkış süre katsayısı tablosu
                                  </h4>
                                  <p className="ssh-exit-coef__ref-desc">
                                      Referans tablosu — değerler garanti başlangıç ile şikayet bildirim tarihi
                                      arasındaki gün sayısına göre otomatik hesaplanır.
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
                          {cikisGun != null && coefficient != null ? (
                              <p className="ssh-exit-coef__popover-active" role="status">
                                  Bu kayıt: <strong>{cikisGun} gün</strong> → katsayı{' '}
                                  <strong>{coefficient}</strong> (otomatik)
                              </p>
                          ) : (
                              <p className="ssh-exit-coef__popover-active ssh-exit-coef__popover-active--muted" role="status">
                                  Tarihler girilince gün ve katsayı otomatik hesaplanır.
                              </p>
                          )}
                          <div className="ssh-exit-coef__table-wrap ssh-exit-coef__table-wrap--readonly">
                              <table className="ssh-exit-coef__table">
                                  <thead>
                                      <tr>
                                          <th scope="col">Araç çıkış süresi</th>
                                          <th scope="col">Katsayı</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {rows.map((row, i) => (
                                          <tr
                                              key={`${row.minDays}-${row.maxDays ?? 'max'}`}
                                              className={i === activeIdx ? 'is-active' : ''}
                                          >
                                              <td>{row.süre}</td>
                                              <td>
                                                  <span className="ssh-exit-coef__coef">{row.coefficient}</span>
                                              </td>
                                          </tr>
                                      ))}
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
            <div className="ssh-field ssh-field--score ssh-field--computed ssh-score-card ssh-exit-coef-card">
                <div className="ssh-score-card__head">
                    <span className="ssh-field__label">Çıkış süre katsayısı</span>
                    <button
                        type="button"
                        className="ssh-info-fab"
                        onClick={() => setOpen(true)}
                        aria-label="Çıkış süre katsayısı referans tablosunu göster"
                        aria-haspopup="dialog"
                        title="Referans tablosu"
                    >
                        <span className="ssh-info-fab__ring" aria-hidden />
                        <span className="ssh-info-fab__ring ssh-info-fab__ring--delay" aria-hidden />
                        <Info size={18} strokeWidth={2.25} className="ssh-info-fab__icon" aria-hidden />
                    </button>
                </div>
                <p className="ssh-score-hint">
                    {cikisGun != null
                        ? `${cikisGun} güne göre tablodan otomatik`
                        : 'Garanti ve şikayet tarihi girilince hesaplanır'}
                </p>
                <div className={`ssh-score-value ${coefficient != null ? 'has-value' : ''}`}>
                    {coefficient != null ? coefficient : '—'}
                </div>
            </div>
            {popover}
        </>
    );
}
