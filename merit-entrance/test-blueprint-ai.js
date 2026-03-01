async function run() {
  const res = await fetch('http://localhost:3000/api/ai/generate-blueprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: "Create a 50 question NEET mock exam for Physics & Chemistry with 3 hard sections" })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
