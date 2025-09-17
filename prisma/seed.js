import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // roles
  const roles = [
    { name: 'admin', labelTh: 'ผู้ดูแลระบบ', labelEn: 'Administrator' },
    { name: 'staff', labelTh: 'พนักงาน', labelEn: 'Staff' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }

  // departments
  const departments = [
    { code: 'HR', nameTh: 'ทรัพยากรบุคคล', nameEn: 'Human Resources' },
    { code: 'ACC', nameTh: 'บัญชี', nameEn: 'Accounting' },
  ];
  for (const d of departments) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }

  // admin user
  const adminEmail = 'admin@example.com';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail }});
  if (!existing) {
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' }});
    const hrDept = await prisma.department.findUnique({ where: { code: 'HR' }});
    const passwordHash = await bcrypt.hash('Admin@12345', 10);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstNameTh: 'แอดมิน',
        lastNameTh: 'ระบบ',
        firstNameEn: 'System',
        lastNameEn: 'Admin',
        roleId: adminRole.id,
        departmentId: hrDept.id,
      }
    });
    console.log('Seeded admin:', adminEmail, 'password: Admin@12345');
  } else {
    console.log('Admin already exists, skip.');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
