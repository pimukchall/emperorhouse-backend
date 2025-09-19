import request from 'supertest';

/**
 * Return a supertest agent bound to the running app or a provided instance.
 * We assume the express app is exported from src/index.js as `app`.
 */
export async function makeClient(app) {
  if (!app) {
    const mod = await import('../../src/index.js');
    if (!mod.app) {
      throw new Error('Expected export `app` from src/index.js');
    }
    return request.agent(mod.app);
  }
  return request.agent(app);
}
