import { describe, it, expect, beforeAll } from 'vitest';
import { makeClient } from '../helpers/testClient.js';

let client;
const email = `ud_${Date.now()}@example.com`;
const pass  = 'User@12345';

async function ensureLoggedIn(agent) {
  // สมัคร (ถ้าซ้ำจะได้ 400), แล้วล็อกอิน
  await agent.post('/auth/register').send({
    email,
    password: pass,
    firstNameTh: 'ผู้ใช้',
    lastNameTh: 'หลายแผนก',
    firstNameEn: 'Multi',
    lastNameEn: 'Dept',
  }).catch(() => {});
  await agent.post('/auth/login').send({ email, password: pass });
}

describe('User-Departments Routes (smoke)', () => {
  beforeAll(async () => {
    client = await makeClient();
    await ensureLoggedIn(client);
  });

  it('list assignments ของตัวเอง → 200 (อาจ data ว่าง)', async () => {
    const me = await client.get('/auth/me');
    expect(me.status).toBe(200);
    const uid = me.body?.data?.id;
    const res = await client.get(`/api/users/${uid}/departments`);
    expect(res.status).toBe(200);
  });

  it('promote guard → ไม่ควร 401 (ยอมรับ 200/400/403/404 ตามข้อมูลและสิทธิ์)', async () => {
    const me = await client.get('/auth/me');
    const uid = me.body?.data?.id;

    // ใช้ udId=0 ให้ระบบตอบ 400/403/404 (แล้วแต่กติกา) แทน 401
    const res = await client
      .post(`/api/users/${uid}/departments/0/promote`)
      .send({ toLevel: 'MANAGER', reason: 'Unit test' });

    expect([200, 400, 403, 404]).toContain(res.status);
  });
});
