import fs from 'fs';

async function generateTest09() {
    console.log("Generating Blueprint for Test-09...");
    
    // 1. Fetch materials
    const kbRes = await fetch('http://localhost:3000/api/admin/knowledge-base?limit=100');
    const kbData = await kbRes.json();
    const materials = kbData.materials || [];
    
    // Look for CBSE computer science
    const csMaterial = materials.find(m => m.title.toLowerCase().includes('computer')) || materials[0];
    
    if (!csMaterial) {
        console.error("No knowledge base materials available to use for RAG.");
        return;
    }
    
    console.log(`Selected RAG Material: ${csMaterial.title} (${csMaterial.id})`);
    
    // 2. Generate blueprint
    const bpRes = await fetch('http://localhost:3000/api/ai/generate-blueprint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'cookie': 'session=dummy_for_local_test' // Might need auth depending on api
        },
        body: JSON.stringify({
            prompt: "Create a blueprint for CBSE Computer Science Class 12 Test-09. Include 1 section with 5 single choice MCQs.",
            materialIds: [csMaterial.id]
        })
    });
    
    const bpData = await bpRes.json();
    console.log("Blueprint Data:", JSON.stringify(bpData, null, 2));
    
    if (!bpData.success) {
        console.error("Failed to generate blueprint.");
        return;
    }
    
    // 3. Save Blueprint into DB to spawn exam
    const saveRes = await fetch('http://localhost:3000/api/admin/blueprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: "Test-09 CBSE Computer Science",
            description: "Generated via automated RAG testing script",
            generationMethod: 'generate_novel',
            board: 'CBSE',
            classLevel: '12th',
            subject: 'Computer Science',
            sections: bpData.data.sections,
            materialIds: [csMaterial.id]
        })
    });
    
    const saveData = await saveRes.json();
    console.log("Saved Blueprint:", saveData);
    
    if (saveData.success) {
        console.log(`\n✅ Blueprint saved! ID: ${saveData.data.id}`);
        console.log(`You can now go to the Admin panel -> Blueprints -> Spawn Exam to generate the actual questions for Test-09.`);
    }
}

generateTest09().catch(console.error);
