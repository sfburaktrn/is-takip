import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('frontend stock api helpers (URL + retry)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getStockItems: q < 2 iken querystringe yazmaz', async () => {
    process.env.SERVER_API_URL = 'http://backend.test:3001';

    const calls: string[] = [];
    // @ts-expect-error test
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ items: [], total: 0, limit: 2000, skip: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const mod = await import('@frontend/lib/api');
    await mod.getStockItems({ q: 'a', limit: 10, skip: 0 });

    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('/stock/items?');
    expect(calls[0]).toContain('limit=10');
    expect(calls[0]).not.toContain('q=');
  });

  it('getStockItems: q >= 2 iken querystringe yazar', async () => {
    process.env.SERVER_API_URL = 'http://backend.test:3001';

    const calls: string[] = [];
    // @ts-expect-error test
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ items: [], total: 0, limit: 10, skip: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const mod = await import('@frontend/lib/api');
    await mod.getStockItems({ q: 'bo', limit: 10, skip: 0 });

    expect(calls.length).toBe(1);
    expect(calls[0]).toContain('q=bo');
  });

  it('apiFetch: retryable HTTP (503) sonrası başarılı olunca döner', async () => {
    process.env.SERVER_API_URL = 'http://backend.test:3001';

    let n = 0;
    // @ts-expect-error test
    globalThis.fetch = vi.fn(async () => {
      n++;
      if (n === 1) {
        return new Response('temporary', { status: 503, headers: { 'content-type': 'text/plain' } });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const mod = await import('@frontend/lib/api');
    const res = await mod.apiFetch('http://x.test/any');
    expect(res.ok).toBe(true);
    expect(n).toBeGreaterThanOrEqual(2);
  });
});

