import { prisma } from './src/lib/prisma';
import "dotenv/config";
async function run() {
  const admin = await prisma.admin.findFirst();
  console.log("AdminId:", admin?.id);
}
run();
