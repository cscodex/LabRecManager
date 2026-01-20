// Prisma config for MeritEntrance
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use direct URL for migrations (non-pooler)
    url: process.env["MERIT_DIRECT_URL"],
  },
});
