import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const dir = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeAll(() => {
  process.env.MOCK_PRISMA = '1';
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'vitest-session-secret-min-32-chars-long!!';
  process.env.DISABLE_RATE_LIMIT = '1';
  const mod = nodeRequire(path.join(dir, '../../backend/src/index.js'));
  app = mod.app;
});

afterAll(async () => {
  const mod = nodeRequire(path.join(dir, '../../backend/src/index.js'));
  if (mod.prisma?.$disconnect) {
    await mod.prisma.$disconnect();
  }
});

async function loginAsTestUser() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
  return agent;
}

async function loginAsAdmin() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ username: 'adminuser', password: 'password' }).expect(200);
  return agent;
}

describe('Stock API (mock Prisma, supertest)', () => {
  it('GET /api/stock/groups oturumsuz → 401', async () => {
    await request(app).get('/api/stock/groups').expect(401);
  });

  it('Stok akışı: create → list → detail → movement → supplier → price', async () => {
    const agent = await loginAsTestUser();

    const groups = await agent.get('/api/stock/groups').expect(200);
    expect(Array.isArray(groups.body)).toBe(true);
    expect(groups.body.length).toBeGreaterThan(0);

    const created = await agent
      .post('/api/stock/items')
      .send({
        groupName: 'TEST GRUP',
        purchaseCode: 'P-001',
        description: 'Tekli bobin',
        unit: 'ADET',
        quantity: 10,
        supplierName: 'Rize Metal',
        supplierContact: '0555 000 00 00',
      })
      .expect(200);

    expect(created.body.id).toBeTruthy();
    const itemId = created.body.id as number;

    const list = await agent.get('/api/stock/items?limit=50&skip=0').expect(200);
    expect(list.body.total).toBeGreaterThan(0);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((x: { id: number }) => x.id === itemId)).toBe(true);

    const detail = await agent.get(`/api/stock/items/${itemId}`).expect(200);
    expect(detail.body.description).toBe('Tekli bobin');
    expect(detail.body.group?.name).toBeTruthy();
    expect(Array.isArray(detail.body.movements)).toBe(true);
    expect(Array.isArray(detail.body.priceHistory)).toBe(true);
    expect(Array.isArray(detail.body.supplierHistory)).toBe(true);

    const mv = await agent
      .post(`/api/stock/items/${itemId}/movement`)
      .send({ type: 'IN', quantity: 5, note: 'Test giriş' })
      .expect(200);
    expect(mv.body.type).toBe('IN');
    expect(mv.body.quantity).toBeTruthy();
    expect(mv.body.currentQuantity).toBeGreaterThan(0);

    const supp = await agent
      .post(`/api/stock/items/${itemId}/supplier`)
      .send({ supplierName: 'Yeni Tedarikçi', supplierContact: 'mail@test.com', note: 'değişti' })
      .expect(200);
    expect(supp.body.supplierName).toBe('Yeni Tedarikçi');

    const price = await agent
      .post(`/api/stock/items/${itemId}/price`)
      .send({ unitPrice: 123.45, note: 'fatura' })
      .expect(200);
    expect(price.body.stockItemId).toBe(itemId);
    expect(price.body.unitPrice).toBeTruthy();

    const detail2 = await agent.get(`/api/stock/items/${itemId}`).expect(200);
    expect(detail2.body.priceHistory.length).toBeGreaterThanOrEqual(1);
    expect(detail2.body.supplierHistory.length).toBeGreaterThanOrEqual(1);
    expect(detail2.body.movements.length).toBeGreaterThanOrEqual(1);
  });

  it('Admin: priceHistory ve supplierHistory silme', async () => {
    const agent = await loginAsAdmin();

    const created = await agent
      .post('/api/stock/items')
      .send({ groupName: 'DEL', purchaseCode: 'D-1', description: 'Silme kalemi' })
      .expect(200);
    const itemId = created.body.id as number;

    const supp = await agent
      .post(`/api/stock/items/${itemId}/supplier`)
      .send({ supplierName: 'A', supplierContact: 'B', note: 'N' })
      .expect(200);

    const price = await agent
      .post(`/api/stock/items/${itemId}/price`)
      .send({ unitPrice: 10, note: 'N' })
      .expect(200);

    await agent
      .delete(`/api/stock/items/${itemId}/supplier-history/${supp.body.id}`)
      .expect(200);
    await agent
      .delete(`/api/stock/items/${itemId}/price-history/${price.body.id}`)
      .expect(200);

    const detail = await agent.get(`/api/stock/items/${itemId}`).expect(200);
    expect(detail.body.supplierHistory.length).toBe(0);
    expect(detail.body.priceHistory.length).toBe(0);
  });
});

