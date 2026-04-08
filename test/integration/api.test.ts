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
