const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const admin = await prisma.admin.findFirst();
  console.log(admin ? admin.id : 'No admin found');
}
run();
