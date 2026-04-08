import { describe, expect, it } from 'vitest';
import { trIncludes, trNorm, trStartsWithStok } from '@frontend/lib/trSearch';

describe('trNorm', () => {
  it('null/undefined boş string', () => {
    expect(trNorm(null)).toBe('');
    expect(trNorm(undefined)).toBe('');
  });

  it('Türkçe I/ı büyük küçük', () => {
    expect(trNorm('İSTANBUL')).toContain('i');
    expect(trNorm('istanbul').length).toBeGreaterThan(0);
  });
});

describe('trStartsWithStok', () => {
  it('stok öneki (küçük harf)', () => {
    expect(trStartsWithStok('Stok damper')).toBe(true);
    expect(trStartsWithStok('STOK X')).toBe(true);
  });

  it('normal müşteri false', () => {
    expect(trStartsWithStok('Özünlü A.Ş.')).toBe(false);
    expect(trStartsWithStok(null)).toBe(false);
  });
});

describe('trIncludes', () => {
  it('boş iğne her zaman true', () => {
    expect(trIncludes('abc', '  ')).toBe(true);
    expect(trIncludes(null, '')).toBe(true);
  });

  it('basit alt string', () => {
    expect(trIncludes('Rize Metal', 'metal')).toBe(true);
    expect(trIncludes('Rize Metal', 'yok')).toBe(false);
  });

  it('varyantlar: kullanıcı farklı klavye ile arayabilir (en az bir eşleşme)', () => {
    const hay = 'RİZE SANAYİ';
    expect(trIncludes(hay, 'rize')).toBe(true);
  });
});
