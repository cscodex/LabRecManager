async function run() {
  const bpRes = await fetch('http://localhost:3000/api/admin/blueprints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "RAG Automated Demo V2",
      description: "Demo RAG Blueprint",
      createdById: "18ab2fd0-7503-457a-8ba4-d04645052a9b", // Valid ID
      generationMethod: "generate_novel",
      sections: [{
        name: "AI Generated Section",
        rules: [{
          questionType: "MCQ",
          numberOfQuestions: 1, // Let's just create 1 question for testing
          difficulty: 3,
          marksPerQuestion: 4,
          negativeMarks: 1,
          topicTagIds: [] // General Knowledge fallback
        }]
      }]
    })
  });
  
  const bpData = await bpRes.json();
  console.log("Blueprint Response:", bpData.success ? "SUCCESS" : bpData.error);
  if (!bpData.success) return;

  console.log("WAITING for DB replication... Triggering Exam Draft engine...");
  await new Promise(r => setTimeout(r, 1000));
  
  const genRes = await fetch('http://localhost:3000/api/admin/exams/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blueprintId: bpData.data.id,
      title: 'AI RAG Demo Exam V2',
      duration: 30,
      createdById: "18ab2fd0-7503-457a-8ba4-d04645052a9b"
    })
  });
  const finalRes = await genRes.json();
  console.log("Generation Result Status:", finalRes.success);
  if (finalRes.error) console.error(finalRes.error);
  if (finalRes.examId) {
    console.log("Generated Exam ID:", finalRes.examId);
    const fetchExam = await fetch(`http://localhost:3000/api/admin/exams/${finalRes.examId}`);
    const examData = await fetchExam.json();
    console.log("EXAM DATA PREVIEW:", JSON.stringify(examData.data?.sections[0]?.questions, null, 2));
  }
}
run();
