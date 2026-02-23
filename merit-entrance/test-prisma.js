const { PrismaClient } = require('@prisma/client');
try {
  let p = new PrismaClient({
    datasourceUrl: "postgresql://foo:bar@localhost:5432/db"
  });
  console.log("datasourceUrl worked");
} catch(e) { console.log(e.message) }

try {
  let p = new PrismaClient({
    datasources: { db: { url: "postgresql://foo:bar@localhost:5432/db" } }
  });
  console.log("datasources worked");
} catch(e) { console.log(e.message) }
