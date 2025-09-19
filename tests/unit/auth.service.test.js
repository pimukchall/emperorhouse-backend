import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken } from '../../src/services/auth.service.js';

describe('auth.service tokens', () => {
  it('signs access and refresh tokens', async () => {
    const at = signAccessToken({ sub: 1, role: 'user' });
    const rt = signRefreshToken({ sub: 1 });
    expect(typeof at).toBe('string');
    expect(typeof rt).toBe('string');
  });
});
