require('dotenv').config({ path: '.env' });
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL);

async function run() {
    try {
        console.log('Reading setup_tags_schema.sql...');
        const sqlContent = fs.readFileSync(path.join(__dirname, 'setup_tags_schema.sql'), 'utf-8');

        console.log('Executing Schema Setup...');
        // Execute the SQL content using sql(query, params) signature or just sql(query) if supported as function
        // Based on previous error "use sql.query", we will use that.
        // However, neon driver export might be different. 
        // Let's try to use the `neon` client directly as a function if it supports it, 
        // or use `sql` as a tagged template with a dynamic string if possible (usually not).
        // BUT, the error message `use sql.query("SELECT $1", ...)` implies the object returned by `neon(...)` has a `.query` method?
        // Let's try `await sql(sqlContent)` one more time but correct.
        // Wait, the error said: `This function can now be called only as a tagged-template function...`
        // It means `sql` IS the function and it enforces tagged template usage.
        // It does NOT have a `.query` method on itself if it is a function. 
        // The error `use sql.query` likely refers to a DIFFERENT way of using the library or a different object.
        // IF `sql` is just a function, then `sql("SELECT...", [])` should work if the library supports it.
        // The error said: `not sql("SELECT $1", [value], options)`. 
        // This means we CANNOT call it as a function.
        // We MUST use it as a tag: `sql`...``
        // But we have a string in a variable. 
        // Use `sql(sqlContent)`? No.
        // `sql([sqlContent])`?  (Fake tagged template call) -> `sql([sqlContent], ...)`
        // Tagged templates receive `(strings, ...values)`.
        // So `sql([sqlContent])` mimics ``sql`${sqlContent}` `` where absolute string is used?
        // No, ``sql`${var}` `` -> `strings=['', ''], values=[var]`.
        // ``sql`SELECT *` `` -> `strings=['SELECT *'], values=[]`.
        // So we can call `sql([sqlContent])`.

        // Use sql as a function for raw strings if supported, or use the query method as suggested by error
        // The error message said: use sql.query("SELECT $1", [value], options).
        await sql(sqlContent, []);

        console.log('Successfully executed setup_tags_schema.sql');
    } catch (error) {
        console.error('Error executing SQL:', error);
        process.exit(1);
    }
}

run();
