import { changeLevelService } from "../../src/services/user-departments.service.js";

function makeTx() {
  return {
    userDepartment: {
      update: vi.fn().mockResolvedValue({ id: 1 }),
    },
    positionChangeLog: {
      create: vi.fn().mockResolvedValue({ id: 99 }),
    },
  };
}
function makePrisma({ ud, dupMD = false }) {
  const tx = makeTx();
  return {
    $transaction: (cb) => cb(tx),
    userDepartment: {
      findUnique: vi.fn().mockResolvedValue(ud),
      findFirst: vi.fn().mockResolvedValue(dupMD ? { id: 123 } : null),
    },
  };
}

test("change level success", async () => {
  const prisma = makePrisma({ ud: { id: 1, userId: 10, endedAt: null, positionLevel: "ASST", positionName: "X", departmentId: 2, department: { code: "HR" } } });
  const out = await changeLevelService({
    prisma, actor: { roleName: "admin" }, userId: 10, udId: 1, toLevel: "MANAGER", positionName: "Lead", reason: "OK", kind: "PROMOTE"
  });
  expect(out.id).toBe(1);
});

test("reject QMR outside QMS", async () => {
  const prisma = makePrisma({ ud: { id: 1, userId: 10, endedAt: null, positionLevel: "ASST", positionName: "X", departmentId: 2, department: { code: "HR" } } });
  await expect(changeLevelService({
    prisma, actor: { roleName: "admin" }, userId: 10, udId: 1, toLevel: "MANAGER", positionName: "QMR", reason: "", kind: "PROMOTE"
  })).rejects.toThrow("QMR_QMS");
});

test("reject duplicate MD", async () => {
  const prisma = makePrisma({ ud: { id: 1, userId: 10, endedAt: null, positionLevel: "ASST", positionName: "X", departmentId: 2, department: { code: "QMS" } }, dupMD: true });
  await expect(changeLevelService({
    prisma, actor: { roleName: "admin" }, userId: 10, udId: 1, toLevel: "MD", positionName: "Head", reason: "", kind: "PROMOTE"
  })).rejects.toThrow("MD_EXISTS");
});
