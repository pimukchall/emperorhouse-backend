export function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function pickSort(field, allowed) {
  const f = String(field || "");
  return allowed.includes(f) ? f : allowed[0];
}

export function ilikeContains(value) {
  const v = String(value ?? "").trim();
  return v ? { contains: v, mode: "insensitive" } : undefined;
}
