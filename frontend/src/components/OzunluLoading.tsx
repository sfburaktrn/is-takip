'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import styles from './OzunluLoading.module.css';

const LABEL = 'ÖZÜNLÜ';

type OzunluLoadingProps = {
  /** fullscreen: tüm ekran | inline: ana içerik ortası | compact: kart/panel içi şeffaf arka plan */
  variant?: 'fullscreen' | 'inline' | 'compact';
  className?: string;
};

/**
 * Gerçek yükleme yüzdesi olmadığında süreye bağlı yumuşak ilerleme (hızlı başlar, yavaşlar).
 * Bileşen kaldırıldığında ekran zaten kapanır.
 */
function useAsymptoticProgress(active: boolean) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;
    let start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const p = Math.min(94, 100 * (1 - Math.exp(-t * 0.72)));
      setProgress(p);
      if (p < 93.5) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return progress;
}

export default function OzunluLoading({ variant = 'fullscreen', className }: OzunluLoadingProps) {
  const progress = useAsymptoticProgress(true);
  const clipEnd = `${Math.max(0, 100 - progress)}%`;
  const barScale = Math.min(1, progress / 100);

  const rootClass = [
    styles.root,
    variant === 'inline' ? styles.rootInline : '',
    variant === 'compact' ? styles.rootCompact : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClass}
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={
        {
          ['--clip-end' as string]: clipEnd,
          ['--bar-scale' as string]: String(barScale)
        } as CSSProperties
      }
    >
      <span className={styles.srOnly}>Yükleniyor</span>
      <div
        className={[styles.wordBlock, variant === 'compact' ? styles.wordBlockCompact : ''].filter(Boolean).join(' ')}
        aria-hidden
      >
        <span className={styles.track}>{LABEL}</span>
        <span className={styles.fill}>{LABEL}</span>
      </div>
      <div className={styles.barTrack} aria-hidden>
        <div className={styles.barFill} />
      </div>
    </div>
  );
}
