export {
  isAdmin,
  hasRole, 
  levelRank, 
  hasLevelAtLeast,  
  isMD,             
  inDepartmentAny, 
  inDepartment,
  inQMS
} from "../middlewares/roles.js";

export const PositionLevels = ["STAF", "SVR", "ASST", "MANAGER", "MD"];

export const LevelRankMap = { STAF: 0, SVR: 1, ASST: 2, MANAGER: 3, MD: 4 };

export function canSetLevel(actor, toLevel) {
  const lv = String(toLevel || "").toUpperCase();
  if (!LevelRankMap.hasOwnProperty(lv)) return false;

  // admin ได้สูงสุด
  if (isAdmin(actor)) return true;

  // MD ตาม "ตำแหน่ง" (ไม่ใช่ role) → ตั้งได้ถึง MD
  if (isMD(actor)) return LevelRankMap[lv] <= LevelRankMap["MD"];

  // ถ้าอยากรองรับ manager แบบ "ตำแหน่ง" (ไม่ใช่ role) ให้ใช้ hasLevelAtLeast
  if (hasLevelAtLeast(actor, "MANAGER")) {
    return LevelRankMap[lv] <= LevelRankMap["MANAGER"];
  }

  // อื่น ๆ จำกัดไว้ไม่เกิน ASST
  return LevelRankMap[lv] <= LevelRankMap["ASST"];
}

// NOTE: ฟังก์ชันนี้ฝั่ง server เท่านั้น (ต้องส่ง prisma เข้ามา)
export async function noAnotherMDinDepartment(prisma, departmentId, excludeUdId = null) {
  const dup = await prisma.userDepartment.findFirst({
    where: {
      departmentId: Number(departmentId),
      endedAt: null, isActive: true,
      positionLevel: "MD",
      ...(excludeUdId ? { NOT: { id: Number(excludeUdId) } } : {}),
    },
    select: { id: true },
  });
  return !dup;
}
