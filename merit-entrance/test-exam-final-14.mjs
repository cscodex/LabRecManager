import fetch from 'node-fetch';

async function run() {
    try {
        console.log("Fetching Exams from API...");
        // API path for getting exams list:
        const res = await fetch('http://localhost:3000/api/admin/exams', {
            headers: {
                 // Hack: many Next.js APIs check for session cookies or Authorization headers. 
                 // If the endpoint is protected, we might get 401. Let's trace it.
            }
        });
        const data = await res.json();
        
        if (!data.success) {
            console.log("Failed to fetch exams:", data.error);
            return;
        }

        const test09 = data.data.find(e => e.title === 'Test-09');
        if (test09) {
             console.log("🎉 SUCCESS! Test-09 found:", test09.id);
        } else {
             console.log("❌ FAILED. Test-09 not found.");
             console.log("Available exams:", data.data.map(e => e.title).join(', '));
        }
    } catch(e) {
        console.error(e);
    }
}
run();
