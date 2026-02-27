const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_zm1Up2KyGqaH@ep-fancy-snow-ahvol2ei-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fetchPlan() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const res = await client.query(`SELECT title, content->>'en' as text FROM admin_notes`);
    if (res.rows.length === 0) {
      console.log("No notes found.");
    } else {
      res.rows.forEach(row => {
          console.log(`\n=== TITLE: ${row.title} ===`);
          console.log(`${row.text}`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

fetchPlan();
