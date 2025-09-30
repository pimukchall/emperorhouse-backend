export async function healthService() {
  return { ok: true, status: "UP", ts: new Date().toISOString() };
}
