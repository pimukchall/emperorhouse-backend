import { signAccessToken, verifyAccessToken } from "../../src/auth/tokens.js";

test("access token roundtrip", () => {
  const t = signAccessToken({ sub: 1, role: "admin" });
  const p = verifyAccessToken(t);
  expect(p.sub).toBe(1);
  expect(p.role).toBe("admin");
});