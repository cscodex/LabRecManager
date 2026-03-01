import { prisma } from './src/lib/prisma';
import "dotenv/config";

async function run() {
  console.log("Fetching reference materials...");
  try {
    const res = await prisma.referenceMaterial.findMany({
      include: {
        _count: { select: { chunks: true } }
      }
    });
    console.log("Result length:", res.length);
    console.log("Result data:", JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Prisma error:", e);
  }
}

run();
