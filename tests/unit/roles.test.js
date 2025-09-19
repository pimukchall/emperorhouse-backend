import { canSetLevel, ensureQmrInQms, noAnotherMDinDepartment } from "../../src/utils/roles.js";

test("canSetLevel admin can set MD", () => {
  expect(canSetLevel({ roleName: "admin" }, "MD")).toBe(true);
});
test("QMR must be in QMS", () => {
  expect(ensureQmrInQms({ code: "QMS" })).toBe(true);
  expect(ensureQmrInQms({ code: "HR" })).toBe(false);
});
test("noAnotherMDinDepartment checks via prisma", async () => {
  const prisma = {
    userDepartment: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  const ok = await noAnotherMDinDepartment(prisma, 1);
  expect(ok).toBe(true);
});
