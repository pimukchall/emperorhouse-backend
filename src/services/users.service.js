import bcrypt from "bcrypt";

/* =========================
   ENUM & Helpers
========================= */
const EMPLOYEE_TYPES = ["DAILY", "MONTHLY"];
const CONTRACT_TYPES = ["PERMANENT", "TEMPORARY", "PROBATION"];
const GENDERS = ["MALE", "FEMALE", "OTHER"];

/** Prefix ตาม contractType (อัปเดตตามสเปคใหม่) */
const CONTRACT_PREFIX = {
  PERMANENT: "",         // YYNN
  TEMPORARY: "C-",       // C-YYNN
  PROBATION: "Trainee-", // Trainee-YYNN
};

function safeStr(v, { allowNull = false, allowEmpty = true } = {}) {
  if (v === undefined || v === null) return allowNull ? null : "";
  const s = String(v).trim();
  if (!allowEmpty && !s) throw new Error("REQUIRED_FIELD_EMPTY");
  return s;
}
function normEnum(v, valid) {
  if (!v) return null;
  const s = String(v || "").toUpperCase();
  if (!valid.includes(s)) throw new Error(`INVALID_ENUM: ${s}`);
  return s;
}
function beYY(date = new Date()) {
  const be = date.getFullYear() + 543;
  return String(be).slice(-2);
}

/** ดึงเฉพาะ "เลขท้าย" จาก employeeCode (เช่น 6801 จาก C-6801 หรือ Trainee-6801 หรือ 6801) */
function extractCodeNumber(code) {
  if (!code) return null;
  const m = String(code).match(/(\d+)$/);
  return m ? m[1] : null;
}

/** เช็คว่าเลข YYNN นี้ถูกใช้แล้วหรือยัง (ไม่สน prefix) */
async function isNumericInUse(prisma, yynn, excludeUserId = null) {
  const where = {
    employeeCode: { endsWith: yynn },
    ...(excludeUserId ? { id: { not: Number(excludeUserId) } } : {}),
  };
  const hit = await prisma.user.findFirst({ where, select: { id: true } });
  return !!hit;
}

/** หาเลขรัน NN ที่ “ยังไม่ถูกใช้” (cross-prefix) */
async function findNextSeq(prisma, yy) {
  for (let i = 0; i <= 99; i++) {
    const nn = String(i).padStart(2, "0");
    const yynn = `${yy}${nn}`;
    const used = await isNumericInUse(prisma, yynn, null);
    if (!used) return nn;
  }
  const err = new Error("EMPLOYEE_CODE_CAP_REACHED");
  err.status = 409;
  throw err;
}

/** gen เลขพนักงานแบบ cross-prefix (fallback = C-) */
async function genEmployeeCode(prisma, contractType) {
  const yy = beYY();
  const ct = normEnum(contractType, CONTRACT_TYPES);
  const pf = CONTRACT_PREFIX[ct] ?? "C-"; // default C-
  const nn = await findNextSeq(prisma, yy); // หาตัวที่ยังไม่ถูกใช้ที่ไหนเลย
  return `${pf}${yy}${nn}`;
}
export { genEmployeeCode };

/* =========================
   Base include
========================= */
export const baseInclude = {
  role: true,
  organization: true,
  primaryUserDept: { include: { department: true } },
  userDepartments: { include: { department: true } },
};

/* =========================
   LIST
========================= */
export async function listUsersService({
  prisma,
  page = 1,
  limit = 20,
  q = "",
  includeDeleted = false,
  roleId = "",
  departmentId = "",
  sortBy = "id",
  sort = "asc",
}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (p - 1) * l;

  const qq = (q || "").trim();
  const ors = [];
  if (qq) {
    // รองรับ Prisma รุ่นเก่า (ไม่ใช้ mode: "insensitive")
    ors.push({ email: { contains: qq } });
    ors.push({ name: { contains: qq } });
    ors.push({ employeeCode: { contains: qq } });
    ors.push({ firstNameTh: { contains: qq } });
    ors.push({ lastNameTh: { contains: qq } });
    ors.push({ firstNameEn: { contains: qq } });
    ors.push({ lastNameEn: { contains: qq } });
  }

  const ands = [];
  if (!includeDeleted) ands.push({ deletedAt: null });
  if (qq) ands.push({ OR: ors });
  if (roleId) ands.push({ roleId: Number(roleId) }); // filter ด้วย scalar field ของ relation
  if (departmentId) {
    ands.push({
      userDepartments: { some: { departmentId: Number(departmentId), endedAt: null } },
    });
  }

  const where = { AND: ands };

  const validSort = new Set(["id", "email", "name", "employeeCode", "createdAt"]);
  const sortField = validSort.has(String(sortBy)) ? String(sortBy) : "id";
  const orderBy = { [sortField]: String(sort).toLowerCase() === "desc" ? "desc" : "asc" };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip,
      take: l,
      select: {
        id: true,
        email: true,
        name: true,
        role: { select: { id: true, name: true } },
        employeeCode: true,
        contractType: true,
        deletedAt: true,
        primaryUserDept: {
          select: {
            id: true,
            positionLevel: true,
            positionName: true,
            department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: items, meta: { page: p, pages: Math.max(1, Math.ceil(total / l)), total } };
}

/* =========================
   GET ONE
========================= */
export async function getUserService({ prisma, id }) {
  const user = await prisma.user.findUnique({ where: { id: Number(id) }, include: baseInclude });
  if (!user) throw new Error("USER_NOT_FOUND");
  return user;
}

/* =========================
   CREATE
========================= */
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

  if (!email || !password || !roleId) throw new Error("missing required user fields");
  if (!departmentId) throw new Error("departmentId required for primary assignment");

  const _contractType = normEnum(contractType, CONTRACT_TYPES);

  // ตัดสินใจรหัสพนักงาน (ตรวจซ้ำด้วยเลขท้าย)
  let finalEmpCode = safeStr(employeeCode, { allowNull: true }) ?? null;
  if (finalEmpCode && String(finalEmpCode).trim() !== "") {
    await assertEmployeeCodeUnique(prisma, finalEmpCode, null);
  } else {
    finalEmpCode = await genEmployeeCode(prisma, _contractType);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: String(email),
        passwordHash,
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
        // relations
        role: { connect: { id: Number(roleId) } },
        ...(orgId ? { organization: { connect: { id: Number(orgId) } } } : {}),
      },
    });

    // ตั้งสังกัดแรก (primary)
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

    await tx.user.update({ where: { id: u.id }, data: { primaryUserDeptId: ud.id } });

    return tx.user.findUnique({ where: { id: u.id }, include: baseInclude });
  });

  return created;
}

/* =========================
   UPDATE
========================= */
export async function updateUserService({ prisma, id, data }) {
  const user = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const inData = { ...data };

  // ----- สร้าง payload เฉพาะฟิลด์ที่ "ส่งมา" -----
  const out = { updatedAt: new Date() };
  const setIfDefined = (key, val) => {
    if (val !== undefined) out[key] = val;
  };
  const setNonNullString = (key, val) => {
    if (val !== undefined) out[key] = safeStr(val, { allowNull: false }) ?? "";
  };
  const setNullableString = (key, val) => {
    if (val !== undefined) out[key] = safeStr(val, { allowNull: true }) ?? null;
  };
  const setNullableDate = (key, val) => {
    if (val !== undefined) out[key] = val ? new Date(val) : null;
  };

  // ---------- ENUMs ----------
  if ("employeeType" in inData) {
    inData.employeeType = normEnum(inData.employeeType, EMPLOYEE_TYPES);
    setIfDefined("employeeType", inData.employeeType);
  }
  if ("contractType" in inData) {
    inData.contractType = normEnum(inData.contractType, CONTRACT_TYPES);
    setIfDefined("contractType", inData.contractType);
    // เปลี่ยน contractType → regen code ใหม่เสมอ (เลขท้ายไม่ชน cross-prefix)
    if (inData.contractType) {
      out.employeeCode = await genEmployeeCode(prisma, inData.contractType);
    }
  }
  if ("gender" in inData) {
    inData.gender = normEnum(inData.gender, GENDERS);
    setIfDefined("gender", inData.gender);
  }

  // ---------- Non-null strings ----------
  setNonNullString("email", inData.email);
  setNonNullString("name", inData.name);
  setNonNullString("firstNameTh", inData.firstNameTh);
  setNonNullString("lastNameTh", inData.lastNameTh);
  setNonNullString("firstNameEn", inData.firstNameEn);
  setNonNullString("lastNameEn", inData.lastNameEn);

  // ---------- Nullable strings ----------
  setNullableString("avatarPath", inData.avatarPath);
  setIfDefined("signature", inData.signature ?? undefined); // Buffer/null

  // ---------- Dates (nullable) ----------
  setNullableDate("birthDate", inData.birthDate);
  setNullableDate("startDate", inData.startDate);
  setNullableDate("probationEndDate", inData.probationEndDate);
  setNullableDate("resignedAt", inData.resignedAt);

  // ---------- Employee code (ถ้าส่งมาให้ตรวจซ้ำแบบเลขท้าย และยกเว้นตัวเอง) ----------
  if ("employeeCode" in inData && inData.employeeCode) {
    await assertEmployeeCodeUnique(prisma, inData.employeeCode, Number(id));
    setIfDefined("employeeCode", inData.employeeCode);
  }

  // ---------- Relations ----------
  if ("roleId" in inData) {
    if (inData.roleId) out.role = { connect: { id: Number(inData.roleId) } };
  }
  if ("orgId" in inData) {
    if (inData.orgId === null || inData.orgId === 0 || inData.orgId === "0") {
      out.organization = { disconnect: true };
    } else {
      out.organization = { connect: { id: Number(inData.orgId) } };
    }
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: out,
    include: baseInclude,
  });

  return updated;
}

/* =========================
   SOFT DELETE & RESTORE
========================= */
export async function softDeleteUserService({ prisma, id, hard = false }) {
  if (hard) {
    await prisma.userDepartment.deleteMany({ where: { userId: Number(id) } }).catch(() => {});
    return prisma.user.delete({ where: { id: Number(id) } });
  }
  return prisma.user.update({
    where: { id: Number(id) },
    data: { deletedAt: new Date() },
    include: baseInclude,
  });
}
export async function restoreUserService({ prisma, id }) {
  return prisma.user.update({
    where: { id: Number(id) },
    data: { deletedAt: null },
    include: baseInclude,
  });
}

/* =========================
   SET PRIMARY DEPARTMENT
========================= */
export async function setPrimaryDepartmentService({ prisma, userId, departmentId }) {
  const uid = Number(userId);
  const did = Number(departmentId);
  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user) throw new Error("USER_NOT_FOUND");

  let ud = await prisma.userDepartment.findFirst({
    where: { userId: uid, departmentId: did, endedAt: null },
    select: { id: true },
  });

  if (!ud) {
    ud = await prisma.userDepartment.create({
      data: {
        userId: uid,
        departmentId: did,
        positionLevel: "STAF",
        positionName: null,
        startedAt: new Date(),
        endedAt: null,
      },
      select: { id: true },
    });
  }

  await prisma.user.update({ where: { id: uid }, data: { primaryUserDeptId: ud.id } });
  return prisma.user.findUnique({ where: { id: uid }, include: baseInclude });
}

/* =========================
   SELF UPDATE PROFILE
========================= */
export async function selfUpdateProfileService({ prisma, userId, data }) {
  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const allowed = [
    "name", "firstNameTh", "lastNameTh", "firstNameEn", "lastNameEn",
    "birthDate", "gender", "avatarPath", "signature",
  ];
  const out = { updatedAt: new Date() };
  for (const key of allowed) {
    if (data[key] !== undefined) {
      if (key === "birthDate") out[key] = data[key] ? new Date(data[key]) : null;
      else if (key === "avatarPath") out[key] = safeStr(data[key], { allowNull: true }) ?? null;
      else out[key] = data[key];
    }
  }

  return prisma.user.update({
    where: { id: Number(userId) },
    data: out,
    include: baseInclude,
  });
}

/* =========================
   UNIQUE CHECK (เลขท้ายเท่านั้น)
========================= */
export async function assertEmployeeCodeUnique(prisma, code, excludeUserId = null) {
  const num = extractCodeNumber(code);
  if (!num) return; // ไม่มีเลข → ไม่ตรวจ
  const exists = await prisma.user.findFirst({
    where: {
      employeeCode: { endsWith: num },
      ...(excludeUserId ? { id: { not: Number(excludeUserId) } } : {}),
    },
    select: { id: true },
  });
  if (exists) {
    const err = new Error("DUPLICATE_EMPLOYEE_CODE");
    err.status = 409;
    throw err;
  }
}
