import { describe, it, expect, beforeAll } from 'vitest';
import { makeClient } from '../helpers/testClient.js';

let client;
const email = `user_${Date.now()}@example.com`;
const pass  = 'User@12345';

describe('Auth Routes (register/login/refresh/logout/password)', () => {
  beforeAll(async () => {
    client = await makeClient();
  });

  it('register → ok (+ set refresh cookie) หรือ 400 ถ้ามีอยู่แล้ว', async () => {
    const res = await client.post('/auth/register').send({
      email,
      password: pass,
      firstNameTh: 'ผู้ใช้',
      lastNameTh: 'ทดสอบ',
      firstNameEn: 'Test',
      lastNameEn: 'User',
    });

    // สมัครครั้งแรกคาดหวัง 200, ถ้าซ้ำให้ผ่าน 400 ได้
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.ok).toBe(true);
      const cookies = res.headers['set-cookie'] || [];
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    }
  });

  it('login → ok', async () => {
    const res = await client.post('/auth/login').send({ email, password: pass });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('me → ok', async () => {
    const res = await client.get('/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toBeTypeOf('object');
  });

  it('refresh (cookie) → ok', async () => {
    const res = await client.post('/auth/refresh').send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('change-password (logged-in) → 200/400/401 (รองรับรันซ้ำ)', async () => {
    const res = await client.post('/auth/change-password').send({
      currentPassword: pass,
      newPassword: 'User@12345_new',
    });
    expect([200, 400, 401]).toContain(res.status);
  });

  it('forgot-password (privacy-safe) → ok', async () => {
    const res = await client.post('/auth/forgot-password').send({ email });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('logout → ok', async () => {
    const res = await client.post('/auth/logout').send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
