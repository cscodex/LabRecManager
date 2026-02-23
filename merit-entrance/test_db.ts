import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  try {
    const bp = await prisma.examBlueprint.findMany()
    console.log("Blueprints:", bp)
  } catch (e: any) {
    console.error("Error:", e.message)
  } finally {
    await prisma.$disconnect()
  }
}
main()
