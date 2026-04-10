import fetch from 'node-fetch';

async function run() {
    try {
        console.log("Fetching blueprints from live server...");
        const bpRes = await fetch('http://localhost:3000/api/admin/blueprints');
        const bpData = await bpRes.json();
        
        const blueprint = bpData.data[0];
        console.log("Using Blueprint:", blueprint.id);
        
        console.log("Triggering live RAG generate route...");
        const res = await fetch('http://localhost:3000/api/admin/exams/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                 blueprintId: blueprint.id,
                 title: 'Test-09',
                 description: 'RAG Generated AI Test for CBSE Computer Science',
                 duration: 60,
                 createdById: "cm7g8lud70000mve51q2a07h5", // fallback
                 allowAiGenerationForMissing: true
            })
        });
        
        const text = await res.text();
        console.log("Raw Response:");
        console.log(text);
    } catch(e) {
        console.error("Fetch Error:", e);
    }
}
run();
