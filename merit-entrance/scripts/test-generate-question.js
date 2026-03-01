const fetch = require('node-fetch');

// This script tests the AI Question Generation API route.

async function testGeneration() {
    const payload = {
        topic: "Thermodynamics: Work Done in Isothermal Process",
        difficulty: 4,
        styleProfile: "jee_main",
        referenceText: `
      In thermodynamics, an isothermal process is a type of thermodynamic process in which the temperature of a system remains constant: ΔT = 0.
      For an ideal gas, the work done W during an isothermal expansion from volume V1 to volume V2 is given by the equation:
      W = n R T ln(V2 / V1) 
      where n is the number of moles, R is the universal gas constant, and T is the absolute temperature.
      If the gas expands, work is done by the gas and W is positive. If the gas is compressed, W is negative.
    `
    };

    try {
        const response = await fetch('http://localhost:3000/api/ai/generate-question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("Response Status:", response.status);
        console.log("Data:\n", JSON.stringify(data, null, 2));

    } catch (err) {
        console.error("Test failed:", err);
    }
}

testGeneration();
