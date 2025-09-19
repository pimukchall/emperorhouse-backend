import bcrypt from "bcrypt";

const baseInclude = {
  role: true,
  organization: true,
  primaryUserDept: { include: { department: true } },
  userDepartments: { include: { department: true } },
};

// ช่วยเลือกฟิลด์ sort ที่อนุญาต
function pickSort(field, allowed) {
  const f = String(field || "");
  return allowed.includes(f) ? f : allowed[0];
}

// คืน string ที่ safe สำหรับคอลัมน์ non-null (กัน null)
function safeStr(v, { allowNull = false } = {}) {
  if (v === undefined) return undefined;           // ไม่แตะ
  if (v === null) return allowNull ? null : "";    // กัน null สำหรับ non-null
  return String(v);
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET users (search/sort/paging + roleId + departmentId + includeDeleted)
 * - departmentId จะ filter ผ่าน relation: primaryUserDept หรือ userDepartments (active)
 */
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

/**
 * สร้างผู้ใช้ใหม่ ให้ตรง schema:
 * - firstNameTh/lastNameTh/firstNameEn/lastNameEn เป็น non-null → บังคับเป็น "" ถ้าไม่ส่ง/ว่าง
 * - ไม่เขียน user.departmentId (schema นี้ไม่ได้เก็บตรง) — primary ใช้ผ่าน userDepartments
 */
export async function createUserService({ prisma, data }) {
  const {
    email, password, roleId, orgId,
    firstNameTh, lastNameTh, firstNameEn, lastNameEn,
    name,
    employeeCode, employeeType, contractType,
    startDate, probationEndDate, resignedAt, birthDate, gender,
    avatarPath, signature,
    departmentId, // ใช้สร้าง assignment ที่จะเป็น Primary
  } = data;

  if (!email || !password || !roleId || !firstNameTh || !lastNameTh || !firstNameEn || !lastNameEn) {
    throw new Error("missing required user fields");
  }
  if (!departmentId) {
    throw new Error("departmentId required for primary assignment");
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
        employeeCode: safeStr(employeeCode, { allowNull: true }) ?? null,
        employeeType: safeStr(employeeType, { allowNull: true }) ?? null,
        contractType: safeStr(contractType, { allowNull: true }) ?? null,
        startDate: startDate ? new Date(startDate) : null,
        probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
        resignedAt: resignedAt ? new Date(resignedAt) : null,
        birthDate: birthDate ? new Date(birthDate) : null,
        gender: safeStr(gender, { allowNull: true }) ?? null,
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

    // ชี้ primary ไปยังแถวนี้ (ไม่มี isPrimary ในตาราง userDepartment)
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

/**
 * อัปเดตผู้ใช้:
 * - กัน null ในฟิลด์ non-null ด้วย safeStr
 * - แปลงวันที่
 * - ถ้ามี departmentId → ตั้ง primary ผ่าน userDepartments และ sync primaryUserDeptId
 */
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

  const depId = toInt(payloadIn.departmentId);
  delete payloadIn.departmentId;

  const updated = await prisma.$transaction(async (tx) => {
    // อัปเดตข้อมูลทั่วไปของ user
    await tx.user.update({ where: { id }, data: payloadIn });

    // ถ้ามี departmentId → ย้าย Primary โดยอัปเดต primaryUserDeptId เท่านั้น
    if (depId) {
      // หา/สร้าง assignment ของแผนกปลายทาง
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

      // ตั้ง Primary โดยอัปเดต pointer ในตาราง User
      await tx.user.update({ where: { id }, data: { primaryUserDeptId: target.id } });
    }

    return tx.user.findUnique({ where: { id }, include: baseInclude });
  });

  return updated;
}

export async function softDeleteUserService({ prisma, id }) {
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function setPrimaryDepartmentService({ prisma, id, udId }) {
  const ud = await prisma.userDepartment.findFirst({
    where: { id: udId, userId: id /* , endedAt: null */ },
    select: { id: true },
  });
  if (!ud) throw new Error("invalid udId");

  // ตั้ง Primary โดยชี้ pointer ที่ user เท่านั้น
  await prisma.user.update({ where: { id }, data: { primaryUserDeptId: udId } });

  return prisma.user.findUnique({ where: { id }, include: baseInclude });
}
