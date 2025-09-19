import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { AVATAR_BASE } from "../config/paths.js";

/** ----- utils ----- */
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};
const pick = (obj, keys) =>
  keys.reduce((a, k) => (obj[k] !== undefined ? ((a[k] = obj[k]), a) : a), {});

/** ----- GET /profile ----- */
export async function getProfileController(req, res) {
  const id = req.session?.user?.id;
  if (!id) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarPath: true,
      // employee master (อ่านได้):
      employeeCode: true,
      employeeType: true,
      contractType: true,
      startDate: true,
      probationEndDate: true,
      resignedAt: true,
      birthDate: true,
      gender: true,
      // ไม่ดึง signature ตรง ๆ (อาจใหญ่) — FE ควรมี endpoint แยกถ้าต้องการภาพ
      role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
      organization: { select: { id: true, code: true, nameTh: true, nameEn: true } },
      primaryUserDept: {
        select: {
          id: true,
          positionLevel: true,
          positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        },
      },
    },
  });
  if (!u) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, data: u });
}

/** ----- PUT /profile ----- */
export async function updateProfileController(req, res) {
  const id = req.session?.user?.id;
  if (!id) return res.status(401).json({ ok: false, error: "Unauthorized" });

  // whitelist เฉพาะฟิลด์ที่อนุญาตให้เจ้าของบัญชีแก้ได้เอง
  const allowed = [
    "name",
    "employeeCode",
    "employeeType",
    "contractType",
    "startDate",
    "probationEndDate",
    "resignedAt",
    "birthDate",
    "gender",
    "orgId",
  ];
  const body = pick(req.body || {}, allowed);

  // แปลงวันที่
  const dateFields = ["startDate", "probationEndDate", "resignedAt", "birthDate"];
  for (const f of dateFields) {
    if (f in body) body[f] = toDate(body[f]);
  }

  // note: ไม่อนุญาตแก้ roleId / deletedAt / primaryUserDeptId จาก endpoint นี้
  try {
    const u = await prisma.user.update({ where: { id }, data: body });
    res.json({ ok: true, data: { id: u.id } });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

/** ----- POST /profile/signature ----- 
 * รับ base64 data URL, เก็บไฟล์ preview + เก็บ binary ลง DB (user.signature)
 */
export async function saveSignatureController(req, res) {
  const id = req.session?.user?.id;
  if (!id) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const base64 = req.body?.signature;
  if (typeof base64 !== "string" || !base64.startsWith("data:image")) {
    return res.status(400).json({ ok: false, error: "Invalid signature data" });
  }
  try {
    const [, content] = base64.split(",");
    const buf = Buffer.from(content, "base64");

    // เก็บไฟล์สำหรับพรีวิว (path สาธารณะ)
    const fname = `sig-${id}-${Date.now()}.png`;
    const abs = path.join(AVATAR_BASE, fname);
    fs.writeFileSync(abs, buf);

    // เก็บ binary ลง DB (ตาม schema: Bytes?)
    await prisma.user.update({
      where: { id },
      data: { signature: buf }, // จะใช้เฉพาะเวลา export เอกสาร/ตรวจความถูกต้อง
    });

    res.json({ ok: true, url: `/files/avatars/${fname}` });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

/** ----- PUT /profile/avatar (multipart) ----- */
export async function uploadAvatarController(req, res) {
  const userId = req.session?.user?.id;
  if (!userId) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (!req.file) return res.status(400).json({ ok: false, error: "File 'avatar' is required" });

  const tmpPath = req.file.path; // …/uploads/avatars/temp-xxxx.ext
  try {
    const ext = (path.extname(tmpPath) || ".png").toLowerCase();
    const finalName = `u${userId}_${Date.now()}${ext}`;
    const finalAbs = path.join(AVATAR_BASE, finalName);

    fs.renameSync(tmpPath, finalAbs);
    const relUrl = `/files/avatars/${finalName}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatarPath: relUrl },
    });

    res.json({ ok: true, path: relUrl, url: relUrl });
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {}
    res.status(400).json({ ok: false, error: e.message });
  }
}

/** ----- GET /profile/files/user/avatar/:id ----- */
export async function getAvatarFileController(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).end();

  const u = await prisma.user.findUnique({
    where: { id },
    select: { avatarPath: true },
  });
  if (!u?.avatarPath) return res.status(404).end();

  const base = path.basename(u.avatarPath);
  const abs = path.join(AVATAR_BASE, base);
  if (!fs.existsSync(abs)) return res.status(404).end();
  res.sendFile(abs);
}