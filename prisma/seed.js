import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

/* ----------------------------- Utils & helpers ---------------------------- */

function envOrThrow(name, allowEmpty = false) {
  const v = process.env[name];
  if (!allowEmpty && (!v || !String(v).trim())) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v ?? null;
}

async function hashPassword(raw) {
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
  return bcrypt.hash(raw, rounds);
}

/**
 * Ensure a user (active, not soft-deleted) exists by username.
 * - Creates user if not exists
 * - Ensures active UserDepartment in given department
 * - Ensures primaryUserDept is set to that UD
 * - Email is optional (nullable) per new schema
 */
async function ensureUserWithActiveDept({
  username,
  email, // optional
  passwordPlain,
  profile, // { firstNameTh, lastNameTh, firstNameEn, lastNameEn }
  roleId,
  orgId,
  employee,
  dept, // { id, positionLevel, positionName }
}) {
  // 1) Find or create user (active only)
  let user = await prisma.user.findFirst({
    where: { username, deletedAt: null },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username,
        email: email && email.trim() ? email : null, // optional
        passwordHash: await hashPassword(passwordPlain),
        firstNameTh: profile.firstNameTh,
        lastNameTh: profile.lastNameTh,
        firstNameEn: profile.firstNameEn,
        lastNameEn: profile.lastNameEn,
        roleId,
        orgId,
        employeeCode: employee.employeeCode ?? null,
        employeeType: employee.employeeType ?? null,
        contractType: employee.contractType ?? null,
        startDate: employee.startDate ?? new Date(),
      },
    });
  }

  // 2) Ensure active UserDepartment for this department
  let ud = await prisma.userDepartment.findFirst({
    where: {
      userId: user.id,
      departmentId: dept.id,
      isActive: true,
    },
  });

  if (!ud) {
    ud = await prisma.userDepartment.create({
      data: {
        userId: user.id,
        departmentId: dept.id,
        positionLevel: dept.positionLevel, // "STAFF" | "MANAGER" | ...
        positionName: dept.positionName ?? null,
        startedAt: new Date(),
        isActive: true,
      },
    });
  }

  // 3) Set primary if not set or different
  if (!user.primaryUserDeptId || user.primaryUserDeptId !== ud.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { primaryUserDeptId: ud.id },
    });
  }

  return { user, ud };
}

/* ------------------------------ Master seeding ----------------------------- */

async function ensureMasters() {
  // Roles
  const roles = [
    { name: "admin", labelTh: "ผู้ดูแลระบบ", labelEn: "Administrator" },
    { name: "user", labelTh: "ผู้ใช้งาน", labelEn: "User" },
  ];
  await Promise.all(
    roles.map((r) =>
      prisma.role.upsert({
        where: { name: r.name },
        update: { labelTh: r.labelTh, labelEn: r.labelEn },
        create: r,
      })
    )
  );

  // Departments
  const departments = [
    { code: "MK", nameTh: "การตลาดและการขาย", nameEn: "Marketing and Sales" },
    { code: "CS", nameTh: "บริการลูกค้า", nameEn: "Customer Service" },
    { code: "AD", nameTh: "สถาปัตยกรรม", nameEn: "Architectural Design" },
    { code: "DD", nameTh: "ออกแบบ", nameEn: "Design Development" },
    { code: "CM", nameTh: "บริหารงานก่อสร้าง", nameEn: "Construction Management" },
    { code: "CO", nameTh: "การดำเนินงานลูกค้า", nameEn: "Customer Operations" },
    { code: "QS", nameTh: "ประเมินราคา", nameEn: "Quantity Surveyor" },
    { code: "PU", nameTh: "จัดซื้อ", nameEn: "Procurement" },
    { code: "AC", nameTh: "บัญชี", nameEn: "Accounts" },
    { code: "HR", nameTh: "ทรัพยากรบุคคล", nameEn: "Human Resources" },
    { code: "IT", nameTh: "เทคโนโลยีสารสนเทศ", nameEn: "Information Technology" },
    { code: "QMS", nameTh: "ระบบบริหารคุณภาพ", nameEn: "Quality Management System" },
    { code: "MGT", nameTh: "ฝ่ายบริหาร", nameEn: "Management" },
    { code: "TAU", nameTh: "Taurus", nameEn: "Taurus" },
    { code: "LA", nameTh: "Leo Angelo", nameEn: "Leo Angelo" },
  ];
  await Promise.all(
    departments.map((d) =>
      prisma.department.upsert({
        where: { code: d.code },
        update: { nameTh: d.nameTh, nameEn: d.nameEn },
        create: d,
      })
    )
  );

  // Organizations
  const organizations = [
    { code: "0", nameTh: "ฝ่ายบริหาร", nameEn: "Administration" },
    { code: "10000", nameTh: "ฝ่ายก่อสร้าง", nameEn: "Construction" },
    { code: "10003", nameTh: "ชลบุรี", nameEn: "Chonburi" },
    { code: "10005", nameTh: "บางแสน", nameEn: "Bangsaen" },
    { code: "10008", nameTh: "ปัญญาธรรมอินทรา", nameEn: "Panyathum Inthra" },
    { code: "10010", nameTh: "เพชรบุรี", nameEn: "Phetchaburi" },
    { code: "10011", nameTh: "สมุทรสาคร", nameEn: "Samutsakhon" },
    { code: "10012", nameTh: "อุดรธานี", nameEn: "Udon Thani" },
    { code: "10013", nameTh: "ศาลายา", nameEn: "Salaya" },
    { code: "10014", nameTh: "ลาดพร้าววังหิน", nameEn: "Ladprao Wanghin" },
    { code: "10015", nameTh: "รามคำแหง", nameEn: "Ramkhamhaeng" },
    { code: "10016", nameTh: "ท่าข้าม16", nameEn: "Tha Kham 16" },
    { code: "11000", nameTh: "ฝ่ายขาย", nameEn: "Sales" },
    { code: "11001", nameTh: "โกดังสายไหม", nameEn: "Warehouse Saimai" },
    { code: "20000", nameTh: "ฝ่ายการตลาด", nameEn: "Marketing" },
    { code: "21000", nameTh: "ฝ่ายขาย และบริการลูกค้า (Acara)", nameEn: "Sales & Customer Service (Acara)" },
    { code: "22000", nameTh: "ฝ่ายขาย และบริการลูกค้า (Emperor)", nameEn: "Sales & Customer Service (Emperor)" },
    { code: "30000", nameTh: "ฝ่ายทรัพยากรมนุษย์", nameEn: "Human Resources" },
    { code: "41000", nameTh: "ฝ่ายออกแบบสถาปัตยกรรม", nameEn: "Architectural Design" },
    { code: "42000", nameTh: "ฝ่ายออกแบบตกแต่งภายใน", nameEn: "Interior Design" },
    { code: "50000", nameTh: "ฝ่ายบัญชีการเงิน", nameEn: "Accounting & Finance" },
    { code: "60000", nameTh: "ฝ่ายเทคโนโลยีสารสนเทศ", nameEn: "Information Technology" },
    { code: "70000", nameTh: "ฝ่ายบริหารกฎหมาย", nameEn: "Legal Department" },
    { code: "80000", nameTh: "ฝ่ายประเมินราคาและจัดซื้อ", nameEn: "Procurement & Estimation" },
    { code: "Leo10000", nameTh: "ฝ่ายโชว์รูม", nameEn: "Showroom" },
  ];

  await Promise.all(
    organizations.map(async (o) => {
      const existing = await prisma.organization.findFirst({
        where: { code: o.code, deletedAt: null },
      });
      if (existing) {
        await prisma.organization.update({
          where: { id: existing.id },
          data: { nameTh: o.nameTh, nameEn: o.nameEn },
        });
      } else {
        await prisma.organization.create({
          data: { ...o, deletedAt: null },
        });
      }
    })
  );

  // EvalCycle (MID_YEAR ของปีปัจจุบัน)
  const year = new Date().getFullYear();
  await prisma.evalCycle.upsert({
    where: { code: `${year}_MID_YEAR` },
    update: {},
    create: {
      code: `${year}_MID_YEAR`,
      year,
      stage: "MID_YEAR",
      openAt: new Date(Date.UTC(year, 0, 1)),
      closeAt: new Date(Date.UTC(year, 5, 30)),
      isActive: true,
      isMandatory: true,
    },
  });
}

/* -------------------------------- User seeding ------------------------------- */

async function seedUsers() {
  const [roleAdmin, roleUser, deptQMS, deptIT, orgHR] = await Promise.all([
    prisma.role.findUnique({ where: { name: "admin" } }),
    prisma.role.findUnique({ where: { name: "user" } }),
    prisma.department.findUnique({ where: { code: "QMS" } }),
    prisma.department.findUnique({ where: { code: "IT" } }),
    prisma.organization.findFirst({ where: { code: "30000", deletedAt: null } }), // ← เปลี่ยนเป็น findFirst
  ]);
  if (!roleAdmin || !roleUser || !deptQMS || !deptIT || !orgHR) {
    throw new Error("Missing masters: role/admin|user or department/QMS|IT or organization/30000");
  }

  // Admin (role=admin, MD @ QMS)
  await ensureUserWithActiveDept({
    username: envOrThrow("SEED_ADMIN_USERNAME"),
    email: process.env.SEED_ADMIN_EMAIL ?? null,  // optional
    passwordPlain: envOrThrow("SEED_ADMIN_PASSWORD"),
    profile: {
      firstNameTh: "แอดมิน",
      lastNameTh: "ระบบ",
      firstNameEn: "System",
      lastNameEn: "Admin",
    },
    roleId: roleAdmin.id,
    orgId: orgHR.id,
    employee: {
      employeeCode: "6801",
      employeeType: "MONTHLY",
      contractType: "PERMANENT",
      startDate: new Date(),
    },
    dept: {
      id: deptQMS.id,
      positionLevel: "MD",
      positionName: "Managing Director",
    },
  });

  // QMR (role=user, MANAGER @ QMS)
  await ensureUserWithActiveDept({
    username: envOrThrow("SEED_QMR_USERNAME"),
    email: process.env.SEED_QMR_EMAIL ?? null, // optional
    passwordPlain: envOrThrow("SEED_QMR_PASSWORD"),
    profile: {
      firstNameTh: "ผู้แทน",
      lastNameTh: "บริหารคุณภาพ",
      firstNameEn: "Quality",
      lastNameEn: "Representative",
    },
    roleId: roleUser.id,
    orgId: orgHR.id,
    employee: {
      employeeCode: "6802",
      employeeType: "MONTHLY",
      contractType: "PERMANENT",
      startDate: new Date(),
    },
    dept: {
      id: deptQMS.id,
      positionLevel: "MANAGER",
      positionName: "QMR",
    },
  });

  // IT Staff (role=user, STAFF @ IT)
  await ensureUserWithActiveDept({
    username: envOrThrow("SEED_IT_USERNAME"),
    email: process.env.SEED_IT_EMAIL ?? null, // optional
    passwordPlain: envOrThrow("SEED_IT_PASSWORD"),
    profile: {
      firstNameTh: "พนักงาน",
      lastNameTh: "ไอที",
      firstNameEn: "IT",
      lastNameEn: "Staff",
    },
    roleId: roleUser.id,
    orgId: orgHR.id,
    employee: {
      employeeCode: "9901",
      employeeType: "MONTHLY",
      contractType: "PERMANENT",
      startDate: new Date(),
    },
    dept: {
      id: deptIT.id,
      positionLevel: "STAFF",
      positionName: "Developer",
    },
  });

  console.log("✅ Seeded users (admin, qmr, it staff)");
}

/* --------------------------------- Entrypoint -------------------------------- */

async function main() {
  await ensureMasters();
  await seedUsers();
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
