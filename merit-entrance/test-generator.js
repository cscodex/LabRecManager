require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

async function run() {
  const result = await fetch('http://localhost:3000/api/admin/exams/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blueprintId: 'test',
      title: 'AI RAG Test Exam',
      duration: 60,
      createdById: '00000000-0000-0000-0000-000000000000',
    })
  });
  console.log(await result.json());
}
run();
