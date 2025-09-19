import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { sendMail, renderAdminResetEmail } from "../lib/mailer.js";

export const router = Router();

// ---------- helpers ----------
const toInt = (v) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);
const parseBool = (v) => v === "1" || v === "true" || v === true;

const baseSelect = {
  id: true,
  name: true,
  email: true,
  firstNameTh: true,
  lastNameTh: true,
  firstNameEn: true,
  lastNameEn: true,
  avatarPath: true,
  role: { select: { id: true, name: true, labelTh: true, labelEn: true } },
  primaryUserDept: {
    select: {
      id: true,
      positionLevel: true,
      positionName: true,
      department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
    },
  },
  // เพิ่ม: list ของ assignment ที่ยัง active (endedAt=null)
  userDepartments: {
    where: { endedAt: null },
    select: {
      id: true,
      positionLevel: true,
      positionName: true,
      department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
    },
  },
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
};

// ---------- LIST: GET /users ----------
router.get("/", requireAuth, async (req, res) => {
  try {
    const {
      q,
      roleId,
      departmentId,
      includeDeleted,
      page = "1",
      limit = "20",
      sortBy = "id",
      sort = "asc",
    } = req.query;

    const where = {
      ...(parseBool(includeDeleted) ? {} : { deletedAt: null }),
      ...(toInt(roleId) ? { roleId: toInt(roleId) } : {}),
      ...(toInt(departmentId)
        ? {
            userDepartments: {
              some: { departmentId: toInt(departmentId), endedAt: null },
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: String(q) } },
              { email: { contains: String(q) } },
              { firstNameTh: { contains: String(q) } },
              { lastNameTh: { contains: String(q) } },
              { firstNameEn: { contains: String(q) } },
              { lastNameEn: { contains: String(q) } },
            ],
          }
        : {}),
    };

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * take;

    const [total, items] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: baseSelect,
        orderBy: { [sortBy]: sort === "desc" ? "desc" : "asc" },
        skip,
        take,
      }),
    ]);

    res.json({
      ok: true,
      data: items,
      meta: {
        page: pageNum,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- READ: GET /users/:id ----------
router.get("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const includeDeleted = parseBool(req.query.includeDeleted);
  const me = req.session.user;

  const user = await prisma.user.findFirst({
    where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
    select: baseSelect,
  });
  if (!user) return res.status(404).json({ ok: false, error: "Not found" });

  if (!includeDeleted && user.deletedAt && me.roleName !== "admin") {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  res.json({ ok: true, data: user });
});

// ---------- CREATE (admin): POST /users ----------
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      passwordHash: rawHash,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
      roleId,
      departmentId,
    } = req.body || {};

    if (!email || !roleId || !departmentId) {
      return res
        .status(400)
        .json({ ok: false, error: "email, roleId, departmentId required" });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists && !exists.deletedAt) {
      return res.status(409).json({ ok: false, error: "Email already in use" });
    }

    const dept = await prisma.department.findUnique({
      where: { id: Number(departmentId) },
    });
    if (!dept)
      return res.status(400).json({ ok: false, error: "Invalid departmentId" });

    let passwordHash = rawHash || null;
    if (!passwordHash && password)
      passwordHash = await bcrypt.hash(password, 10);
    if (!passwordHash)
      return res
        .status(400)
        .json({ ok: false, error: "Provide password or passwordHash" });

    const displayName =
      (name ?? "").trim() ||
      [firstNameTh, lastNameTh].filter(Boolean).join(" ").trim() ||
      [firstNameEn, lastNameEn].filter(Boolean).join(" ").trim() ||
      "";

    const createdId = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: displayName,
          email,
          passwordHash,
          firstNameTh: firstNameTh || "",
          lastNameTh: lastNameTh || "",
          firstNameEn: firstNameEn || "",
          lastNameEn: lastNameEn || "",
          roleId: Number(roleId),
        },
        select: { id: true },
      });
      const ud = await tx.userDepartment.create({
        data: {
          userId: u.id,
          departmentId: Number(departmentId),
          positionLevel: "STAF",
          startedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.user.update({
        where: { id: u.id },
        data: { primaryUserDeptId: ud.id },
      });
      return u.id;
    });

    const full = await prisma.user.findUnique({
      where: { id: createdId },
      select: baseSelect,
    });
    res.status(201).json({ ok: true, data: full });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- UPDATE: PATCH /users/:id ----------
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.session.user;

    const target = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, primaryUserDeptId: true },
    });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    const isAdmin = me.roleName === "admin";
    const isSelf = me.id === id;
    if (!isAdmin && !isSelf)
      return res.status(403).json({ ok: false, error: "Forbidden" });

    const {
      name,
      email,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
      roleId,
      departmentId,
    } = req.body || {};

    const data = {};
    if (isAdmin) {
      if (email) data.email = email;
      if (roleId !== undefined) data.roleId = Number(roleId);
    }
    if (name !== undefined) data.name = String(name ?? "").trim();
    if (firstNameTh !== undefined) data.firstNameTh = firstNameTh;
    if (lastNameTh !== undefined) data.lastNameTh = lastNameTh;
    if (firstNameEn !== undefined) data.firstNameEn = firstNameEn;
    if (lastNameEn !== undefined) data.lastNameEn = lastNameEn;

    let movedPrimary = false;
    if (isAdmin && departmentId !== undefined) {
      const dept = await prisma.department.findUnique({
        where: { id: Number(departmentId) },
      });
      if (!dept)
        return res
          .status(400)
          .json({ ok: false, error: "Invalid departmentId" });

      const now = new Date();
      const active = await prisma.userDepartment.findFirst({
        where: {
          userId: id,
          departmentId: Number(departmentId),
          endedAt: null,
        },
      });
      if (!active) {
        // ปิด primary เดิมถ้ามี
        if (target.primaryUserDeptId) {
          await prisma.userDepartment.update({
            where: { id: target.primaryUserDeptId },
            data: { endedAt: now },
          });
        }
        const ud = await prisma.userDepartment.create({
          data: {
            userId: id,
            departmentId: Number(departmentId),
            positionLevel: "STAF",
            startedAt: now,
          },
        });
        data.primaryUserDeptId = ud.id;
      } else {
        // ใช้ active เดิมเป็น primary
        data.primaryUserDeptId = active.id;
      }
      movedPrimary = true;
    }

    if (Object.keys(data).length === 0 && !movedPrimary) {
      return res.status(400).json({ ok: false, error: "No updatable fields" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: baseSelect,
    });

    if (me?.id === id) {
      req.session.user = {
        ...req.session.user,
        name: updated.name ?? req.session.user.name,
        primaryUserDeptId:
          updated.primaryUserDept?.id ?? req.session.user.primaryUserDeptId,
        deptCode:
          updated.primaryUserDept?.department?.code ??
          req.session.user.deptCode,
      };
    }
    res.json({ ok: true, data: updated });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- DELETE /users/:id ----------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.session.user;
    const hard = parseBool(req.query.hard);

    const target = await prisma.user.findFirst({
      where: { id },
      select: { id: true, deletedAt: true, roleId: true },
    });
    if (!target) return res.status(404).json({ ok: false, error: "Not found" });

    if (me.roleName !== "admin" && me.id !== id) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    if (hard) {
      await prisma.user.delete({ where: { id } });
      return res.json({ ok: true, deleted: true, hard: true });
    }

    if (!target.deletedAt) {
      await prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return res.json({ ok: true, deleted: true });
    } else {
      await prisma.user.update({ where: { id }, data: { deletedAt: null } });
      return res.json({ ok: true, restored: true });
    }
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// ---------- ADMIN RESET PASSWORD ----------
router.post("/:id/reset-password", requireRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const newPassword = String(req.body?.newPassword || "").trim();
  if (!newPassword || newPassword.length < 8) {
    return res
      .status(400)
      .json({ ok: false, error: "newPassword (>=8) required" });
  }
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return res.status(404).json({ ok: false, error: "Not found" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  // แจ้งอีเมลผู้ใช้ (best-effort)
  if (u.email) {
    try {
      const msg = renderAdminResetEmail({ name: u.name || "" });
      await sendMail({
        to: u.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
    } catch (err) {
      console.error("send admin reset email failed:", err);
    }
  }
  res.json({ ok: true });
});

export default router;
