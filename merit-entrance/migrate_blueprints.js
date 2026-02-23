const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const connectionString = process.env.MERIT_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
    console.error("No database connection string found.");
    process.exit(1);
}

const sql = neon(connectionString);

async function main() {
    try {
        console.log("Starting Blueprint Schema Migration...");

        // 1. Create Blueprint Sections table
        await sql`
      CREATE TABLE IF NOT EXISTS blueprint_sections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blueprint_id UUID NOT NULL REFERENCES exam_blueprints(id) ON DELETE CASCADE,
        name JSONB NOT NULL,
        "order" INTEGER NOT NULL
      );
    `;
        console.log("✅ Created blueprint_sections table");

        // 2. Modify Blueprint Rules table
        // Add section_id
        try {
            await sql`ALTER TABLE blueprint_rules ADD COLUMN section_id UUID REFERENCES blueprint_sections(id) ON DELETE CASCADE;`;
            console.log("✅ Added section_id to blueprint_rules");
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log("ℹ️ section_id already exists in blueprint_rules");
            } else {
                throw e;
            }
        }

        // Since we are adding sections, any existing rules without sections are invalid. Delete them.
        await sql`DELETE FROM blueprint_rules WHERE section_id IS NULL;`;

        // Now make section_id NOT NULL
        await sql`ALTER TABLE blueprint_rules ALTER COLUMN section_id SET NOT NULL;`;
        console.log("✅ Made section_id NOT NULL in blueprint_rules");

        console.log("🎉 Migration successful!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    }
}

main();
