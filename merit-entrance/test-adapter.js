const { PrismaNeon } = require('@prisma/adapter-neon');
const { Pool } = require('@neondatabase/serverless');

const adapter1 = new PrismaNeon({ connectionString: 'postgres://foo:bar@localhost:5432' });
console.log("adapter config inside:", adapter1.config.connectionString !== undefined);

const pool = new Pool({});
const adapter2 = new PrismaNeon(pool);
console.log("adapter config if pool passed:", typeof adapter2.config.connectionString);
