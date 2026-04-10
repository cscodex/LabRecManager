import fetch from 'node-fetch';

async function run() {
    try {
        console.log("Fetching Exams from API...");
        const res = await fetch('http://localhost:3000/api/admin/exams');
        const data = await res.json();
        const test09 = data.data.find(e => e.title === 'Test-09');
        if (test09) {
             console.log("SUCCESS! Test-09 found:", test09.id);
        } else {
             console.log("FAILED. Test-09 not found. Top exams:", data.data.slice(0, 3).map(e => e.title));
        }
    } catch(e) {
        console.error(e);
    }
}
run();
