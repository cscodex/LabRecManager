const axios = require('axios');
const jwt = require('jsonwebtoken');

// Assuming JWT_SECRET is 'your_jwt_secret_here' or default
const token = jwt.sign(
    { id: 'd4e5f6a7-b8c9-0123-def0-234567890123', role: 'instructor', schoolId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    process.env.JWT_SECRET || 'your_jwt_secret_here', // We can check process.env or provide a default if we know it
    { expiresIn: '1h' }
);

async function test() {
    try {
        console.log('Fetching modules...');
        const res = await axios.get('http://localhost:5001/api/training/modules', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        console.log('SUCCESS:', res.data);
    } catch (err) {
        console.error('ERROR RESPONSE:', err.response?.status, err.response?.data);
        console.error('ERROR MSG:', err.message);
    }
}
test();
