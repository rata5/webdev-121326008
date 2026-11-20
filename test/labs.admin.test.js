// Adding a lab (AC-7, AC-8): an admin may, nobody else may, and the rule lives in the lab service.
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { setup, rowCounts } from './helpers.js';

let db; let app; let services;
beforeEach(async () => {
  ({ db, app, services } = await setup());
});

async function signedIn(email, role = 'user') {
  const agent = request.agent(app);
  await agent.post('/api/auth/signup').send({ email, password: 'correct-horse' }).expect(201);
  await db.run('UPDATE users SET role = $1 WHERE email = $2', [role, email]);
  return agent;
}

const robotics = { name: 'Robotics Lab', room: '1301', capacity: 18 };

describe('AC-7 an admin adds a lab', () => {
  it('AC-7 POST /api/labs by an admin answers 201, adds one row and the lab shows in the list', async () => {
    const admin = await signedIn('admin@tu-sofia.bg', 'admin');
    const res = await admin.post('/api/labs').send(robotics);
    expect(res.status).toBe(201);
    expect(await db.query("SELECT name, room, capacity FROM labs WHERE name = 'Robotics Lab'")).toEqual([robotics]);
    const list = await admin.get('/api/labs?date=2026-11-02').expect(200);
    expect(list.body.labs.map((l) => l.name)).toContain('Robotics Lab');
  });

  it('AC-7 a lab without a name or room, or with a capacity that is not 1 to 500, is refused with VALIDATION', async () => {
    const admin = { id: 1, role: 'admin' };
    const bad = [{}, { ...robotics, name: ' ' }, { ...robotics, room: '' }, { ...robotics, name: 'x'.repeat(61) }, { ...robotics, room: 'x'.repeat(21) },
      { ...robotics, capacity: 0 }, { ...robotics, capacity: 501 }, { ...robotics, capacity: 2.5 }, { ...robotics, capacity: 'many' }];
    for (const input of bad) {
      let code = 'no error';
      try { await services.labService.addLab(admin, input); } catch (err) { code = err.code; }
      expect(code).toBe('VALIDATION');
    }
    await expect(services.labService.addLab(admin)).rejects.toThrow();
    expect((await rowCounts(db)).labs).toBe(3);
  });
});

describe('AC-8 nobody else adds a lab', () => {
  it('AC-8 POST /api/labs by a user answers 403 and adds no row', async () => {
    const ana = await signedIn('ana@tu-sofia.bg');
    const res = await ana.post('/api/labs').send(robotics);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Only an admin can add a lab');
    expect((await rowCounts(db)).labs).toBe(3);
  });

  it('AC-8 POST /api/labs without a session answers 401 and adds no row', async () => {
    await request(app).post('/api/labs').send(robotics).expect(401);
    expect((await rowCounts(db)).labs).toBe(3);
  });
});