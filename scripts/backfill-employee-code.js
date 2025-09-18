import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// แปลงเป็นปี พ.ศ. 2 หลัก
function thaiYearYY(d = new Date()) {
  const th = d.getFullYear() + 543;
  return String(th % 100).padStart(2, '0'); // เช่น "68"
}

// หาเลข running ล่าสุดของปีนั้น ๆ
async function nextRunningForYear(yy) {
  const prefix = `${yy}-`;
  const last = await prisma.user.findFirst({
    where: { employeeCode: { startsWith: prefix } },
    orderBy: { employeeCode: 'desc' },
    select: { employeeCode: true },
  });
  const lastNo = last ? parseInt((last.employeeCode.split('-')[1] || '0'), 10) : 0;
  return lastNo + 1;
}

async function main() {
  const yy = thaiYearYY();
  let running = await nextRunningForYear(yy);

  // หาพนักงานที่ยังไม่มี employeeCode
  const users = await prisma.user.findMany({
    where: { employeeCode: null },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (users.length === 0) {
    console.log('ℹ️ ไม่มี user ที่ employeeCode เป็น null');
    return;
  }

  for (const u of users) {
    const code = `${yy}-${String(running).padStart(4, '0')}`;
    await prisma.user.update({
      where: { id: u.id },
      data: { employeeCode: code },
    });
    console.log('✅ assign', u.id, '→', code);
    running++;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error backfilling employeeCode:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
