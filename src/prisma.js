import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// ปิด connection ตอน process ออก
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});