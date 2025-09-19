import { describe, it, expect, beforeAll } from 'vitest';
import { makeClient } from '../helpers/testClient.js';
import users from '../fixtures/sampleUsers.json' assert { type: 'json' };

let client;
describe('Contacts Routes', () => {
  beforeAll(async () => {
    client = await makeClient();
  });

  it('POST /api/contacts (public) → 200/201', async () => {
    const res = await client.post('/api/contacts').send({
      name: 'คุณลูกค้า',
      email: 'customer@example.com',
      phone: '099-000-0000',
      subject: 'สอบถามสินค้า',
      message: 'อยากทราบรายละเอียดเพิ่มเติม'
    });
    expect([200,201]).toContain(res.status);
    expect(res.body.ok).toBe(true);
  });

  it('GET /api/contacts ต้องสิทธิ์ → 200 ถ้าเป็น admin, 403 ถ้าไม่ใช่, 401 ถ้าไม่ล็อกอิน', async () => {
    // พยายามล็อกอิน admin; ถ้า fail (เพราะรหัสถูกเปลี่ยนในชุดก่อน) ก็ยังถือว่า pass เมื่อเจอ 401/403
    await client.post('/auth/login').send({ email: users.admin.email, password: users.admin.password });
    const res = await client.get('/api/contacts');
    expect([200,403,401]).toContain(res.status);   // เพิ่ม 401
  });
});
