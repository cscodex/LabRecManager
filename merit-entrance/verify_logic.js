
const OneHour = 60 * 60 * 1000;
const now = Date.now();
const expiry = new Date(now + OneHour);

console.log('--- Token Logic Verification ---');
console.log('Current Time (Date.now()):', now);
console.log('Current Time (ISO):', new Date().toISOString());
console.log('Expiry Time (ISO):', expiry.toISOString());

// Simulate DB storage (stored as string usually, or Date object)
const storedExpiry = expiry.toISOString();

// Verification Logic from route.ts
// if (student.verification_expires && new Date(student.verification_expires) < new Date())
const verifyDate = new Date(storedExpiry);
const checkNow = new Date();

console.log('Verification Check:');
console.log('Stored Expiry (parsed):', verifyDate.toISOString());
console.log('Current Check Time:', checkNow.toISOString());

if (verifyDate < checkNow) {
    console.log('RESULT: EXPIRED (Incorrect behavior for fresh token)');
} else {
    console.log('RESULT: VALID (Correct behavior)');
}

console.log('--- Timezone Check ---');
console.log('Local Time String:', new Date().toString());
