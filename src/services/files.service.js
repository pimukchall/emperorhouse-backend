import { prisma } from "../prisma.js";

// ดึงโปรไฟล์ (อ่านอย่างเดียว)
export async function getProfileService({ prisma: p = prisma, userId }) {
  if (!userId) return null;
  return p.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true, email: true, name: true, avatarPath: true,
      employeeCode: true, employeeType: true, contractType: true,
      startDate: true, probationEndDate: true, resignedAt: true, birthDate: true, gender: true,
      organization: { select: { id: true, code: true, nameTh: true, nameEn: true } },
      primaryUserDept: {
        select: {
          id: true, positionLevel: true, positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        },
      },
    },
  });
}

// แก้ไขโปรไฟล์เฉพาะฟิลด์ที่อนุญาต
export async function updateProfileService({ prisma: p = prisma, userId, data }) {
  if (!userId) throw new Error("Unauthorized");
  const allow = [
    "name","avatarPath",
    "employeeCode","employeeType","contractType",
    "startDate","probationEndDate","resignedAt","birthDate","gender",
    "orgId"
  ];
  const payload = {};
  for (const k of allow) if (k in data) payload[k] = data[k];
  if ("orgId" in payload) payload.orgId = payload.orgId ? Number(payload.orgId) : null;
  for (const k of ["startDate","probationEndDate","resignedAt","birthDate"]) {
    if (k in payload) payload[k] = payload[k] ? new Date(payload[k]) : null;
  }
  return p.user.update({ where: { id: userId }, data: payload });
}

// เซฟลายเซ็นจาก base64 → Bytes (ตัวเลือก)
export async function saveSignatureService({ prisma: p = prisma, userId, signatureBase64 }) {
  if (!userId) throw new Error("Unauthorized");
  if (!signatureBase64) throw new Error("signature required");
  const base64 = signatureBase64.replace(/^data:\w+\/\w+;base64,/, "");
  const buf = Buffer.from(base64, "base64");
  return p.user.update({ where: { id: userId }, data: { signature: buf } });
}
