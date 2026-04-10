import fs from 'fs';

async function generateTest09() {
    console.log("Fetching blueprints to find one we can use as a base...");
    
    const bpRes = await fetch('http://localhost:3000/api/admin/blueprints');
    const bpData = await bpRes.json();
    
    if (!bpData.success || !bpData.data || bpData.data.length === 0) {
        console.error("No blueprints exist yet. Please create one manually in the UI first with RAG materials attached.");
        return;
    }
    
    // Grab the first Blueprint 
    const blueprint = bpData.data[0];
    console.log(`Using Blueprint: ${blueprint.name} (${blueprint.id})`);
    
    console.log("Looking up an admin user to assign as creator...");
    // Just a raw graphql-like cheat or fetch an admin id from the users table.
    // Instead of querying DB from Node, let's use the UI's session or a hardcoded ID if we know one.
    // Given we are running locally, let's assume we can hit the generate endpoint.
    
    console.log("Sending generate request to /api/admin/exams/generate...");
    const genRes = await fetch('http://localhost:3000/api/admin/exams/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
             blueprintId: blueprint.id,
             title: "Test-09",
             description: "RAG Generated AI Test for CBSE Computer Science",
             duration: 60,
             createdById: "cm7g8lud70000mve51q2a07h5", // Hardcoded ID from an earlier request or typical local admin
             allowAiGenerationForMissing: true
        })
    });
    
    const genData = await genRes.json();
    console.log("Generation Result:");
    console.log(JSON.stringify(genData, null, 2));
}

generateTest09().catch(console.error);
