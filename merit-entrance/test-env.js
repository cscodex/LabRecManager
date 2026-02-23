require('dotenv').config({ path: '.env' });
console.log("MERIT_DATABASE_URL:", process.env.MERIT_DATABASE_URL ? "Exists length " + process.env.MERIT_DATABASE_URL.length : "Missing");
