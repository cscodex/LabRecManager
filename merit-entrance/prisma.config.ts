import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env["MERIT_DATABASE_URL"] || process.env["MERIT_DIRECT_URL"] || process.env["DATABASE_URL"],
    },
});
