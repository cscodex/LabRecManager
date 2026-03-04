const fs = require('fs');
const path = require('path');

const files = [
    'src/app/student/forgot-password/page.tsx',
    'src/app/student/reset-password/page.tsx',
    'src/app/student/verify-email/page.tsx',
    'src/app/student/register/page.tsx',
    'src/app/admin/forgot-password/page.tsx',
    'src/app/admin/reset-password/page.tsx'
];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // Add imports
    if (!content.includes('useSettingsStore')) {
        content = content.replace(/import \{.*\} from 'react';/, match => {
            if (!match.includes('useEffect')) {
                return match.replace('{', '{ useEffect,');
            }
            return match;
        });

        // If react wasn't matched and no useEffect
        if (!content.includes('import { useEffect')) {
            if (content.includes('import { useState } from \'react\'')) {
                content = content.replace(/import \{ useState \} from 'react';/, "import { useState, useEffect } from 'react';");
            } else if (content.includes('import { Suspense, useState, useEffect } from \'react\'')) {
                // do nothing
            } else {
                content = content.replace(/import .* from 'react';/, match => "import { useEffect } from 'react';\n" + match);
            }
        }

        content = content.replace(/import .* from 'lucide-react';/, match => `import { useSettingsStore } from '@/lib/store';\n` + match);
    }

    // Add state 
    if (!content.includes('const { siteName')) {
        content = content.replace(/export default function \w+\(\) \{/, match =>
            match + `\n    const { siteName, siteLogoUrl, fetchSettings, isLoaded } = useSettingsStore();\n    useEffect(() => {\n        if (!isLoaded) fetchSettings();\n    }, [isLoaded, fetchSettings]);\n`
        );
    }

    // Replace footer
    content = content.replace(/© 2026 Merit Entrance/g, "© {new Date().getFullYear()} {siteName}");

    // Replace register text
    content = content.replace(/Join Merit Entrance today/g, "Join {siteName} today");

    // Replace BookOpen Logo
    const logoRegex = /<div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">\s*<BookOpen className="w-8 h-8 text-blue-600" \/>\s*<\/div>/g;
    const replacement = `{siteLogoUrl ? (\n                        <img src={siteLogoUrl} alt={siteName} className="mx-auto w-16 h-16 object-contain bg-white rounded-2xl p-2 shadow-lg mb-4" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />\n                    ) : (\n                        <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">\n                            <BookOpen className="w-8 h-8 text-blue-600" />\n                        </div>\n                    )}`;

    content = content.replace(logoRegex, replacement);

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
});
