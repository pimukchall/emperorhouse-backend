import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

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
    { code: "21000", nameTh: "ฝ่ายขาย และบริการลูกค้า (Acara)", nameEn: "Sales & Customer Service (Acara)", },
    { code: "22000", nameTh: "ฝ่ายขาย และบริการลูกค้า (Emperor)", nameEn: "Sales & Customer Service (Emperor)", },
    { code: "30000", nameTh: "ฝ่ายทรัพยากรมนุษย์", nameEn: "Human Resources" },
    { code: "41000", nameTh: "ฝ่ายออกแบบสถาปัตยกรรม", nameEn: "Architectural Design", },
    { code: "42000", nameTh: "ฝ่ายออกแบบตกแต่งภายใน", nameEn: "Interior Design", },
    { code: "50000", nameTh: "ฝ่ายบัญชีการเงิน", nameEn: "Accounting & Finance", },
    { code: "60000", nameTh: "ฝ่ายเทคโนโลยีสารสนเทศ",nameEn: "Information Technology", },
    { code: "70000", nameTh: "ฝ่ายบริหารกฎหมาย", nameEn: "Legal Department" },
    { code: "80000", nameTh: "ฝ่ายประเมินราคาและจัดซื้อ", nameEn: "Procurement & Estimation", },
    { code: "Leo10000", nameTh: "ฝ่ายโชว์รูม", nameEn: "Showroom" },
  ];
  await Promise.all(
    organizations.map((o) =>
      prisma.organization.upsert({
        where: { code: o.code },
        update: { nameTh: o.nameTh, nameEn: o.nameEn },
        create: o,
      })
    )
  );
}

async function ensureUserWithActiveDept({
  email,
  data,
  deptId,
  positionLevel,
  positionName,
}) {
  // หา user ที่ยังไม่ถูกลบ (deletedAt = null)
  let user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (!user) {
    user = await prisma.user.create({ data });
  }

  // หา assignment ที่ active (endedAt = null) ในแผนกนั้น
  let ud = await prisma.userDepartment.findFirst({
    where: { userId: user.id, departmentId: deptId, endedAt: null },
  });
  if (!ud) {
    ud = await prisma.userDepartment.create({
      data: {
        userId: user.id,
        departmentId: deptId,
        positionLevel,
        positionName,
        startedAt: new Date(),
      },
    });
  }

  // ตั้งเป็น primary ถ้ายังไม่ตั้งหรือคนละแผนก
  if (!user.primaryUserDeptId || user.primaryUserDeptId !== ud.id) {
    await prisma.user.update({
      where: { id: user.id },
      data: { primaryUserDeptId: ud.id },
    });
  }

  return { user, ud };
}

async function seedAdminAndQMR() {
  const adminEmail = "admin@example.com";
  const qmrEmail = "qmr@example.com";

  const [adminRole, userRole, qmsDept, orgHR] = await Promise.all([
    prisma.role.findUnique({ where: { name: "admin" } }),
    prisma.role.findUnique({ where: { name: "user" } }),
    prisma.department.findUnique({ where: { code: "QMS" } }),
    prisma.organization.findUnique({ where: { code: "30000" } }),
  ]);
  if (!adminRole || !userRole || !qmsDept || !orgHR) {
    throw new Error(
      "Missing masters: role/admin|user or department/QMS or organization/30000"
    );
  }

  // Admin (role=admin, MD @ QMS)
  await ensureUserWithActiveDept({
    email: adminEmail,
    data: {
      email: adminEmail,
      passwordHash: await bcrypt.hash("Admin@12345", 10),
      firstNameTh: "แอดมิน",
      lastNameTh: "ระบบ",
      firstNameEn: "System",
      lastNameEn: "Admin",
      roleId: adminRole.id,
      orgId: orgHR.id,
      employeeCode: "6801",
      employeeType: "MONTHLY",
      contractType: "PERMANENT",
      startDate: new Date(),
    },
    deptId: qmsDept.id,
    positionLevel: "MD",
    positionName: "Managing Director",
  });

  // QMR (role=user, MANAGER @ QMS)
  await ensureUserWithActiveDept({
    email: qmrEmail,
    data: {
      email: qmrEmail,
      passwordHash: await bcrypt.hash("Qmr@12345", 10),
      firstNameTh: "ผู้แทน",
      lastNameTh: "บริหารคุณภาพ",
      firstNameEn: "Quality",
      lastNameEn: "Representative",
      roleId: userRole.id,
      orgId: orgHR.id,
      employeeCode: "6802",
      employeeType: "MONTHLY",
      contractType: "PERMANENT",
      startDate: new Date(),
    },
    deptId: qmsDept.id,
    positionLevel: "MANAGER",
    positionName: "QMR",
  });

  console.log("✅ Seeded admin & QMR");
}

async function main() {
  await ensureMasters();
  await seedAdminAndQMR();
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
