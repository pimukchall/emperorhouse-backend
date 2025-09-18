import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  /* ---------- Roles ---------- */
  const roles = [
    { name: 'admin', labelTh: 'ผู้ดูแลระบบ', labelEn: 'Administrator' },
    { name: 'staff', labelTh: 'พนักงาน', labelEn: 'Staff' },
    { name: 'dev',   labelTh: 'นักพัฒนา', labelEn: 'Developer' },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: r,
    });
  }

  /* ---------- Departments (รหัสตัวอักษร) ---------- */
  const departments = [
    { code: 'MK',  nameTh: 'การตลาดและการขาย', nameEn: 'Marketing and Sales' },
    { code: 'CS',  nameTh: 'บริการลูกค้า',       nameEn: 'Customer Service' },
    { code: 'AD',  nameTh: 'สถาปัตยกรรม',       nameEn: 'Architectural Design' },
    { code: 'DD',  nameTh: 'ออกแบบ',            nameEn: 'Design Development' },
    { code: 'CM',  nameTh: 'บริหารงานก่อสร้าง', nameEn: 'Construction Management' },
    { code: 'CO',  nameTh: 'งานพาณิชย์',        nameEn: 'Commercial Operations' },
    { code: 'QS',  nameTh: 'ประเมินราคา',       nameEn: 'Quantity Surveyor' },
    { code: 'PU',  nameTh: 'จัดซื้อ',           nameEn: 'Procurement' },
    { code: 'AC',  nameTh: 'บัญชี',             nameEn: 'Accounts' },
    { code: 'HR',  nameTh: 'ทรัพยากรบุคคล',     nameEn: 'Human Resources' },
    { code: 'IT',  nameTh: 'เทคโนโลยีสารสนเทศ', nameEn: 'Information Technology' },
    { code: 'QMS', nameTh: 'ระบบบริหารคุณภาพ',  nameEn: 'Quality Management System' },
    { code: 'QMR', nameTh: 'ผู้แทนบริหารคุณภาพ', nameEn: 'Quality Management Representative' },
    { code: 'MD',  nameTh: 'กรรมการผู้จัดการ',  nameEn: 'Managing Director' },
    { code: 'MGT', nameTh: 'ฝ่ายบริหาร',         nameEn: 'Management' },
    { code: 'TAU', nameTh: 'Taurus',             nameEn: 'Taurus' },
    { code: 'LA',  nameTh: 'Leo Angelo',         nameEn: 'Leo Angelo' },
  ];
  for (const d of departments) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: {},
      create: d,
    });
  }

  /* ---------- Organizations (รหัสตัวเลข) ---------- */
  const organizations = [
    { code: '0',      nameTh: 'ฝ่ายบริหาร', nameEn: 'Administration' },
    { code: '10000',  nameTh: 'ฝ่ายก่อสร้าง', nameEn: 'Construction' },
    { code: '10003',  nameTh: 'ชลบุรี', nameEn: 'Chonburi' },
    { code: '10005',  nameTh: 'บางแสน', nameEn: 'Bangsaen' },
    { code: '10008',  nameTh: 'ปัญญาธรรมอินทรา', nameEn: 'Panyathum Inthra' },
    { code: '10010',  nameTh: 'เพชรบุรี', nameEn: 'Phetchaburi' },
    { code: '10011',  nameTh: 'สมุทรสาคร', nameEn: 'Samutsakhon' },
    { code: '10012',  nameTh: 'อุดรธานี', nameEn: 'Udon Thani' },
    { code: '10013',  nameTh: 'ศาลายา', nameEn: 'Salaya' },
    { code: '10014',  nameTh: 'ลาดพร้าววังหิน', nameEn: 'Ladprao Wanghin' },
    { code: '10015',  nameTh: 'รามคำแหง', nameEn: 'Ramkhamhaeng' },
    { code: '10016',  nameTh: 'ท่าข้าม16', nameEn: 'Tha Kham 16' },
    { code: '11000',  nameTh: 'ฝ่ายขาย', nameEn: 'Sales' },
    { code: '11001',  nameTh: 'โกดังสายไหม', nameEn: 'Warehouse Saimai' },
    { code: '20000',  nameTh: 'ฝ่ายการตลาด', nameEn: 'Marketing' },
    { code: '21000',  nameTh: 'ฝ่ายขาย และบริการลูกค้า (Acara)', nameEn: 'Sales & Customer Service (Acara)' },
    { code: '22000',  nameTh: 'ฝ่ายขาย และบริการลูกค้า (Emperor)', nameEn: 'Sales & Customer Service (Emperor)' },
    { code: '30000',  nameTh: 'ฝ่ายทรัพยากรมนุษย์', nameEn: 'Human Resources' },
    { code: '41000',  nameTh: 'ฝ่ายออกแบบสถาปัตยกรรม', nameEn: 'Architectural Design' },
    { code: '42000',  nameTh: 'ฝ่ายออกแบบตกแต่งภายใน', nameEn: 'Interior Design' },
    { code: '50000',  nameTh: 'ฝ่ายบัญชีการเงิน', nameEn: 'Accounting & Finance' },
    { code: '60000',  nameTh: 'ฝ่ายเทคโนโลยีสารสนเทศ', nameEn: 'Information Technology' },
    { code: '70000',  nameTh: 'ฝ่ายบริหารกฎหมาย', nameEn: 'Legal Department' },
    { code: '80000',  nameTh: 'ฝ่ายประเมินราคาและจัดซื้อ', nameEn: 'Procurement & Estimation' },
    { code: 'Leo10000', nameTh: 'ฝ่ายโชว์รูม', nameEn: 'Showroom' },
  ];
  for (const o of organizations) {
    await prisma.organization.upsert({
      where: { code: o.code },
      update: {},
      create: o,
    });
  }

  /* ---------- Admin User ---------- */
  const adminEmail = 'admin@example.com';

  const existing = await prisma.user.findFirst({
    where: { email: adminEmail, deletedAt: null },
  });

  if (!existing) {
    const adminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
    const hrDept = await prisma.department.findFirst({ where: { code: 'HR' } }); // Department = Human Resources
    const hrOrg = await prisma.organization.findFirst({ where: { code: '30000' } }); // Organization = Human Resources (unit)
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
        orgId: hrOrg.id,
        employeeCode: '68-0001',
        positionName: 'System Administrator',
        positionLevel: 'ADMIN',
        employeeType: 'MONTHLY',
        contractType: 'PERMANENT',
        startDate: new Date(),
      },
    });

    console.log('✅ Seeded admin:', adminEmail, 'password: Admin@12345');
  } else {
    console.log('ℹ️ Admin already exists, skip.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
