import fetch from 'node-fetch';

async function run() {
    try {
        console.log('Sending manual fetch request for Test-09...');
        // Need to hit temp-rag-test again to get the server output
        const res = await fetch('http://localhost:3000/api/temp-rag-test');
        const text = await res.text();
        console.log("Raw Response:");
        console.log(text);
    } catch(e) {
        console.error("Fetch Error:", e);
    }
}
run();
