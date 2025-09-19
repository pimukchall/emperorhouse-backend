export async function healthService() {
  return { status: "ok", ts: new Date().toISOString() };
}
