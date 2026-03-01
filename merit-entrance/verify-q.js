const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const q = await prisma.question.findFirst({
    where: { isAiGenerated: true },
    orderBy: { createdAt: 'desc' },
    include: { tags: { include: { tag: true }} }
  });
  console.log(JSON.stringify(q, null, 2));
}
run();
