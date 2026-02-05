
import * as admin from 'firebase-admin';

// Helper to parse Firebase private key from environment variable
function getFirebasePrivateKey(): string | undefined {
    const key = process.env.FIREBASE_PRIVATE_KEY;
    if (!key) return undefined;

    // If the key is already in proper PEM format (contains actual newlines), return as-is
    if (key.includes('-----BEGIN PRIVATE KEY-----') && key.includes('\n')) {
        return key;
    }

    // Handle escaped newlines (\\n -> \n) - common when set via environment variables
    // Also handle double-escaped (\\\\n) from some deployment platforms
    return key
        .replace(/\\\\n/g, '\n')  // Handle double-escaped newlines first
        .replace(/\\n/g, '\n');   // Then handle single-escaped newlines
}

// Only initialize if we have the required credentials
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = getFirebasePrivateKey();

if (!admin.apps.length) {
    if (projectId && clientEmail && privateKey) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log('Firebase Admin Initialized');
        } catch (error) {
            console.error('Firebase Admin Initialization Error:', error);
        }
    } else {
        console.warn('Firebase Admin: Missing credentials, skipping initialization');
        console.warn('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }
}

export const firebaseAdmin = admin;

