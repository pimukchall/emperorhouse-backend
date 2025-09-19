// src/services/users.service.js
import bcrypt from "bcrypt";

/** ===== include มาตรฐานเวลาอ่าน user ===== */
const baseInclude = {
  role: true,
  organization: true,
  primaryUserDept: { include: { department: true } },
  userDepartments: { include: { department: true } },
};

// ---------- Helpers ----------
function pickSort(field, allowed) {
  const f = String(field || "");
  return allowed.includes(f) ? f : allowed[0];
}
function safeStr(v, { allowNull = false } = {}) {
  if (v === undefined) return undefined;
  if (v === null) return allowNull ? null : "";
  return String(v);
}
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------- ENUM Normalizers ----------
const EMPLOYEE_TYPES = ["DAILY", "MONTHLY"];
const CONTRACT_TYPES = ["PERMANENT", "TEMPORARY", "PROBATION"];
const GENDERS = ["MALE", "FEMALE", "OTHER"];

function normEnum(v, allowed) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const s = String(v).toUpperCase().trim();
  return allowed.includes(s) ? s : null;
}

/** ===================== ใหม่: Generator รหัสพนักงานตามสเป็ค ===================== */
/** คืนเลขปี พ.ศ. 2 หลักท้าย (string) */
function beYY(date = new Date()) {
  const be = date.getFullYear() + 543;
  return String(be).slice(-2);
}

/**
 * หาเลขรัน 2 หลักสูงสุดภายใต้ prefix แล้ว +1 (00–99)
 * - prefix: สำหรับถาวรใช้ 'YY', สำหรับสัญญาใช้ 'C-YY'
 * - pattern: RegExp ที่จับกลุ่มเลขรันไว้ใน group 1
 */
async function nextSeq2Digits(prisma, prefix, pattern) {
  const rows = await prisma.user.findMany({
    where: { employeeCode: { startsWith: prefix } },
    select: { employeeCode: true },
  });

  let max = -1;
  for (const r of rows) {
    const code = r.employeeCode || "";
    const m = code.match(pattern);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) max = Math.max(max, n);
    }
  }
  const next = max + 1;
  if (next > 99) {
    const err = new Error("EMPLOYEE_CODE_CAP_REACHED");
    err.status = 409;
    throw err;
  }
  return String(next).padStart(2, "0");
}

/** gen สำหรับพนักงานประจำ → "YYSS" */
async function genPermanentCode(prisma) {
  const yy = beYY();
  const prefix = yy;
  const seq = await nextSeq2Digits(prisma, prefix, new RegExp(`^${yy}(\\d{2})$`));
  return `${yy}${seq}`;
}

/** gen สำหรับสัญญา (ไม่ถาวร) → "C-YYSS" */
async function genContractCode(prisma) {
  const yy = beYY();
  const prefix = `C-${yy}`;
  const seq = await nextSeq2Digits(prisma, prefix, new RegExp(`^C-${yy}(\\d{2})$`));
  return `C-${yy}${seq}`;
}

/** ตรวจ uniqueness ของ employeeCode (ยกเว้น id ปัจจุบันถ้ามี) */
async function assertEmployeeCodeUnique(prisma, employeeCode, excludeUserId) {
  if (!employeeCode || String(employeeCode).trim() === "") return;
  const where = excludeUserId
    ? { employeeCode: String(employeeCode).trim(), NOT: { id: excludeUserId } }
    : { employeeCode: String(employeeCode).trim() };
  const found = await prisma.user.findFirst({ where, select: { id: true } });
  if (found) {
    const err = new Error("EMPLOYEE_CODE_EXISTS");
    err.status = 409;
    throw err;
  }
}

/** ===================== LIST / GET ===================== */
export async function listUsersService({
  prisma,
  q = "",
  page = 1,
  pageSize = 20,
  sortBy = "id",
  sort = "desc",
  roleId,
  departmentId,
  includeDeleted = false,
}) {
  const where = {
    ...(q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
            { firstNameTh: { contains: q } },
            { lastNameTh: { contains: q } },
            { firstNameEn: { contains: q } },
            { lastNameEn: { contains: q } },
            { employeeCode: { contains: q } },
          ],
        }
      : {}),
    ...(roleId ? { roleId: Number(roleId) } : {}),
    ...(includeDeleted ? {} : { deletedAt: null }),
  };

  const depId = toInt(departmentId);
  if (depId) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { primaryUserDept: { is: { departmentId: depId, endedAt: null } } },
          { userDepartments: { some: { departmentId: depId, endedAt: null } } },
        ],
      },
    ];
  }

  const sortField = pickSort(sortBy, ["id", "email", "name", "createdAt"]);
  const orderBy = { [sortField]: String(sort).toLowerCase() === "asc" ? "asc" : "desc" };

  const [total, data] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: baseInclude,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    }),
  ]);

  return { data, page, pageSize, total };
}

export async function getUserService({ prisma, id }) {
  return prisma.user.findFirst({ where: { id, deletedAt: null }, include: baseInclude });
}

/** ===================== CREATE ===================== */
export async function createUserService({ prisma, data }) {
  const {
    email, password, roleId, orgId,
    firstNameTh, lastNameTh, firstNameEn, lastNameEn,
    name,
    employeeCode, employeeType, contractType,
    startDate, probationEndDate, resignedAt, birthDate, gender,
    avatarPath, signature,
    departmentId,
  } = data;

  if (!email || !password || !roleId || !firstNameTh || !lastNameTh || !firstNameEn || !lastNameEn) {
    throw new Error("missing required user fields");
  }
  if (!departmentId) {
    throw new Error("departmentId required for primary assignment");
  }

  // normalize ENUMs ก่อน เพื่อใช้ตัดสินใจ gen code
  const _contractType = normEnum(contractType, CONTRACT_TYPES);

  // ตัดสินใจรหัสพนักงาน:
  // - ถ้าส่งมาเอง → ต้องไม่ซ้ำ
  // - ถ้าไม่ส่ง → gen ตามสเป็ค (PERMANENT = YYSS, อื่น ๆ = C-YYSS)
  let finalEmpCode = safeStr(employeeCode, { allowNull: true }) ?? null;
  if (finalEmpCode && String(finalEmpCode).trim() !== "") {
    await assertEmployeeCodeUnique(prisma, finalEmpCode);
  } else {
    if (_contractType === "PERMANENT") {
      finalEmpCode = await genPermanentCode(prisma);
    } else {
      finalEmpCode = await genContractCode(prisma);
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: String(email),
        passwordHash,
        roleId: Number(roleId),
        orgId: orgId ? Number(orgId) : null,

        name: safeStr(name, { allowNull: false }) ?? "",
        firstNameTh: safeStr(firstNameTh, { allowNull: false }),
        lastNameTh: safeStr(lastNameTh, { allowNull: false }),
        firstNameEn: safeStr(firstNameEn, { allowNull: false }),
        lastNameEn: safeStr(lastNameEn, { allowNull: false }),

        employeeCode: finalEmpCode,
        employeeType: normEnum(employeeType, EMPLOYEE_TYPES),
        contractType: _contractType,

        startDate: startDate ? new Date(startDate) : null,
        probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
        resignedAt: resignedAt ? new Date(resignedAt) : null,
        birthDate: birthDate ? new Date(birthDate) : null,

        gender: normEnum(gender, GENDERS),

        avatarPath: safeStr(avatarPath, { allowNull: true }) ?? null,
        signature: signature || null,
      },
    });

    // สร้าง assignment ตัวแรก
    const ud = await tx.userDepartment.create({
      data: {
        userId: u.id,
        departmentId: Number(departmentId),
        positionLevel: "STAF",
        positionName: null,
        startedAt: new Date(),
        endedAt: null,
      },
      select: { id: true },
    });

    // ตั้ง primary
    await tx.user.update({
      where: { id: u.id },
      data: { primaryUserDeptId: ud.id },
    });

    return tx.user.findUnique({
      where: { id: u.id },
      include: baseInclude,
    });
  });

  return created;
}

/** ===================== UPDATE ===================== */
export async function updateUserService({ prisma, id, data }) {
  const allow = [
    "name", "email", "roleId", "orgId",
    "firstNameTh", "lastNameTh", "firstNameEn", "lastNameEn",
    "employeeCode", "employeeType", "contractType",
    "startDate", "probationEndDate", "resignedAt", "birthDate", "gender",
    "avatarPath", "signature", "password", "departmentId",
  ];
  const payloadIn = {};
  for (const k of allow) if (k in data) payloadIn[k] = data[k];

  if ("password" in payloadIn) {
    payloadIn.passwordHash = await bcrypt.hash(String(payloadIn.password || ""), 10);
    delete payloadIn.password;
  }
  if ("orgId" in payloadIn) payloadIn.orgId = payloadIn.orgId ? Number(payloadIn.orgId) : null;

  // กัน null สำหรับฟิลด์ non-null
  if ("name" in payloadIn) payloadIn.name = safeStr(payloadIn.name, { allowNull: false }) ?? "";
  if ("firstNameTh" in payloadIn) payloadIn.firstNameTh = safeStr(payloadIn.firstNameTh, { allowNull: false });
  if ("lastNameTh" in payloadIn) payloadIn.lastNameTh = safeStr(payloadIn.lastNameTh, { allowNull: false });
  if ("firstNameEn" in payloadIn) payloadIn.firstNameEn = safeStr(payloadIn.firstNameEn, { allowNull: false });
  if ("lastNameEn" in payloadIn) payloadIn.lastNameEn = safeStr(payloadIn.lastNameEn, { allowNull: false });

  // แปลงวันที่
  for (const k of ["startDate", "probationEndDate", "resignedAt", "birthDate"]) {
    if (k in payloadIn) payloadIn[k] = payloadIn[k] ? new Date(payloadIn[k]) : null;
  }

  // Normalize ENUMs
  if ("employeeType" in payloadIn) payloadIn.employeeType = normEnum(payloadIn.employeeType, EMPLOYEE_TYPES);
  if ("contractType" in payloadIn) payloadIn.contractType = normEnum(payloadIn.contractType, CONTRACT_TYPES);
  if ("gender" in payloadIn) payloadIn.gender = normEnum(payloadIn.gender, GENDERS);

  // ถ้ามี employeeCode ที่จะอัปเดต → ต้องไม่ซ้ำกับคนอื่น
  if ("employeeCode" in payloadIn && payloadIn.employeeCode) {
    await assertEmployeeCodeUnique(prisma, payloadIn.employeeCode, id);
  }

  const depId = toInt(payloadIn.departmentId);
  delete payloadIn.departmentId;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: payloadIn });

    if (depId) {
      // หา/สร้าง assignment target
      let target = await tx.userDepartment.findFirst({
        where: { userId: id, departmentId: depId, endedAt: null },
        select: { id: true },
      });
      if (!target) {
        target = await tx.userDepartment.create({
          data: {
            userId: id,
            departmentId: depId,
            positionLevel: "STAF",
            positionName: null,
            startedAt: new Date(),
            endedAt: null,
          },
          select: { id: true },
        });
      }
      await tx.user.update({ where: { id }, data: { primaryUserDeptId: target.id } });
    }

    return tx.user.findUnique({ where: { id }, include: baseInclude });
  });

  return updated;
}

/** ===================== SOFT/RESTORE/HARD ===================== */
export async function softDeleteUserService({ prisma, id }) {
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function restoreUserService({ prisma, id }) {
  await prisma.user.update({ where: { id }, data: { deletedAt: null } });
}

export async function hardDeleteUserService({ prisma, id }) {
  await prisma.userDepartment.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });
}

export async function setPrimaryDepartmentService({ prisma, id, udId }) {
  const ud = await prisma.userDepartment.findFirst({
    where: { id: udId, userId: id },
    select: { id: true },
  });
  if (!ud) throw new Error("invalid udId");
  await prisma.user.update({ where: { id }, data: { primaryUserDeptId: udId } });
  return prisma.user.findUnique({ where: { id }, include: baseInclude });
}
