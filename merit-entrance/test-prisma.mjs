import { PrismaClient } from '@prisma/client';
import "dotenv/config"; // will load .env

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  try {
    const materials = await prisma.referenceMaterial.findMany();
    console.log("Materials count from Prisma:", materials.length);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
