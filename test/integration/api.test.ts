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
    process.env.IMALAT_VEHICLE_INGEST_SECRET = 'vitest-vehicle-ingest-token';
    const mod = nodeRequire(path.join(dir, '../../backend/src/index.js'));
    app = mod.app;
});

afterAll(async () => {
    const mod = nodeRequire(path.join(dir, '../../backend/src/index.js'));
    if (mod.prisma?.$disconnect) {
        await mod.prisma.$disconnect();
    }
});

describe('API (mock Prisma, supertest)', () => {
    it('GET /api/health → 200', async () => {
        const res = await request(app).get('/api/health').expect(200);
        expect(res.body.status).toBe('OK');
        expect(res.body.timestamp).toBeTruthy();
    });

    it('GET /api/health/db → 200 (mock $queryRaw)', async () => {
        const res = await request(app).get('/api/health/db').expect(200);
        expect(res.body.db).toBe('up');
    });

    it('GET /api/dropdowns → JSON şekil', async () => {
        const res = await request(app).get('/api/dropdowns').expect(200);
        expect(Array.isArray(res.body.tip)).toBe(true);
        expect(res.body.tip.length).toBeGreaterThan(0);
    });

    it('GET /api/dampers oturumsuz → 401', async () => {
        await request(app).get('/api/dampers').expect(401);
    });

    it('GET /api/auth/me oturumsuz → 401', async () => {
        await request(app).get('/api/auth/me').expect(401);
    });

    it('POST /api/auth/login eksik gövde → 400', async () => {
        const res = await request(app).post('/api/auth/login').send({}).expect(400);
        expect(res.body.error).toBeTruthy();
    });

    it('POST /api/auth/login hatalı kullanıcı → 401', async () => {
        await request(app)
            .post('/api/auth/login')
            .send({ username: 'yok', password: 'password' })
            .expect(401);
    });

    it('POST /api/auth/login doğru → 200 + oturum', async () => {
        const agent = request.agent(app);
        const res = await agent
            .post('/api/auth/login')
            .send({ username: 'testuser', password: 'password' })
            .expect(200);
        expect(res.body.username).toBe('testuser');
        const me = await agent.get('/api/auth/me').expect(200);
        expect(me.body.fullName).toBe('Test Kullanıcı');
        const dampers = await agent.get('/api/dampers').expect(200);
        expect(Array.isArray(dampers.body)).toBe(true);
    });

    it('Kapasite defaults oturumla → 45 saat/kişi', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
        const res = await agent.get('/api/capacity/defaults').expect(200);
        expect(res.body.hoursPerPersonWeek).toBe(45);
        expect(res.body.description).toContain('Pazartesi');
    });

    it('GET /api/capacity/week weekStart yok → 400', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
        const res = await agent.get('/api/capacity/week?type=DAMPER').expect(400);
        expect(res.body.error).toContain('weekStart');
    });

    it('Normal kullanıcı /api/users → 403', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
        await agent.get('/api/users').expect(403);
    });

    it('Admin kullanıcı /api/users listesi', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'adminuser', password: 'password' }).expect(200);
        const res = await agent.get('/api/users').expect(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
        expect(res.body.some((u: { isAdmin: boolean }) => u.isAdmin)).toBe(true);
    });

    it('POST /api/auth/logout oturumu temizler', async () => {
        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
        await agent.post('/api/auth/logout').expect(200);
        await agent.get('/api/auth/me').expect(401);
    });
});

describe('Vehicle delivery ingest (Bearer IMALAT_VEHICLE_INGEST_SECRET)', () => {
    const AUTH = { Authorization: 'Bearer vitest-vehicle-ingest-token' };

    it('POST VEHICLE_INBOUND geçerli → 201 processed', async () => {
        const res = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send({
                eventType: 'VEHICLE_INBOUND',
                sourceDeliveryId: 'vt-inbound-1',
                companyName: 'Örnek Ltd.',
                vehicleBrand: 'Mercedes',
                vehicleModel: 'Axor',
                chassisNo: 'ABC123',
                fuelLevel: '3/4',
                mileageKm: 125000,
                arrivedAt: '2026-05-08T10:00:00.000Z',
            })
            .expect(201);
        expect(res.body).toEqual({
            ok: true,
            processed: true,
            already_processed: false,
        });
    });

    it('POST VEHICLE_DELIVERED geçerli → 201 processed', async () => {
        const res = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send({
                eventType: 'VEHICLE_DELIVERED',
                sourceDeliveryId: 'vt-delivered-1',
                companyName: 'Örnek Ltd.',
                deliveredAt: '2026-05-09T15:30:00.000Z',
            })
            .expect(201);
        expect(res.body.ok).toBe(true);
        expect(res.body.already_processed).toBe(false);
    });

    it('POST yanlış Bearer → 401', async () => {
        const res = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set({ Authorization: 'Bearer wrong-secret' })
            .send({
                eventType: 'VEHICLE_INBOUND',
                sourceDeliveryId: 'x',
                companyName: 'Co',
                arrivedAt: '2026-05-08T10:00:00.000Z',
            })
            .expect(401);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Yetkisiz/i);
    });

    it('aynı inbound (aynı tarih ve firma) ikinci kez → 200 already_processed', async () => {
        const body = {
            eventType: 'VEHICLE_INBOUND',
            sourceDeliveryId: 'vt-dup',
            companyName: 'Dup A.Ş.',
            arrivedAt: '2026-05-07T08:00:00.000Z',
        };
        const first = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send(body)
            .expect(201);
        expect(first.body.already_processed).toBe(false);
        const second = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send(body)
            .expect(200);
        expect(second.body).toEqual({
            ok: true,
            processed: true,
            already_processed: true,
        });
    });

    it('inbound sonra delivered (aynı sourceDeliveryId) → tek liste satırı, ikinci ingest 200', async () => {
        const sid = `vt-onecard-${Date.now()}`;
        await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send({
                eventType: 'VEHICLE_INBOUND',
                sourceDeliveryId: sid,
                companyName: 'Kart A.Ş.',
                arrivedAt: '2026-05-08T10:00:00.000Z',
            })
            .expect(201);
        const delRes = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send({
                eventType: 'VEHICLE_DELIVERED',
                sourceDeliveryId: sid,
                companyName: 'Kart A.Ş.',
                deliveredAt: '2026-05-08T18:00:00.000Z',
                vehicleBrand: 'Mercedes',
                vehicleModel: 'Actros',
                chassisNo: 'DEL-CH-1',
                fuelLevel: '1/4',
                mileageKm: 130001,
            })
            .expect(200);
        expect(delRes.body.ok).toBe(true);
        expect(delRes.body.already_processed).toBe(false);

        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
        const list = await agent.get('/api/vehicle-delivery-events?limit=400').expect(200);
        const matches = list.body.items.filter((it: { sourceDeliveryId: string }) => it.sourceDeliveryId === sid);
        expect(matches.length).toBe(1);
        expect(matches[0].arrivedAt).toBeTruthy();
        expect(matches[0].deliveredAt).toBeTruthy();
        expect(matches[0].deliveredPayloadJson).toBeTruthy();
        expect(matches[0].deliveredPayloadJson.eventType).toBe('VEHICLE_DELIVERED');
        expect(matches[0].deliveredPayloadJson.mileageKm).toBe(130001);
    });

    it('delivered sonra inbound (aynı sourceDeliveryId) → tek satırda hem tarih', async () => {
        const sid = `vt-rev-${Date.now()}`;
        await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send({
                eventType: 'VEHICLE_DELIVERED',
                sourceDeliveryId: sid,
                companyName: 'Ters Sıra Ltd.',
                deliveredAt: '2026-05-10T12:00:00.000Z',
            })
            .expect(201);
        await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send({
                eventType: 'VEHICLE_INBOUND',
                sourceDeliveryId: sid,
                companyName: 'Ters Sıra Ltd.',
                arrivedAt: '2026-05-10T11:30:00.000Z',
            })
            .expect(200);

        const agent = request.agent(app);
        await agent.post('/api/auth/login').send({ username: 'testuser', password: 'password' }).expect(200);
        const list = await agent.get('/api/vehicle-delivery-events?limit=400').expect(200);
        const matches = list.body.items.filter((it: { sourceDeliveryId: string }) => it.sourceDeliveryId === sid);
        expect(matches.length).toBe(1);
        expect(matches[0].arrivedAt).toBeTruthy();
        expect(matches[0].deliveredAt).toBeTruthy();
    });

    it('aynı delivered iki kez → 200 already_processed', async () => {
        const sid = `vt-dup-del-${Date.now()}`;
        const body = {
            eventType: 'VEHICLE_DELIVERED',
            sourceDeliveryId: sid,
            companyName: 'Dup Del A.Ş.',
            deliveredAt: '2026-05-11T09:15:00.000Z',
        };
        const first = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send(body)
            .expect(201);
        expect(first.body.already_processed).toBe(false);
        const second = await request(app)
            .post('/api/integrations/vehicle-delivery-ingest')
            .set(AUTH)
            .send(body)
            .expect(200);
        expect(second.body).toEqual({ ok: true, processed: true, already_processed: true });
    });
});
