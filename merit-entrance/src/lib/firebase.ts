
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyAJval308nD9puoLQezOKdTym2FV_o4fW4",
    authDomain: "exam-prep-platform.firebaseapp.com",
    projectId: "exam-prep-platform",
    storageBucket: "exam-prep-platform.firebasestorage.app",
    messagingSenderId: "988933362874",
    appId: "1:988933362874:web:385aa9732dffd7fa175e83",
    measurementId: "G-4N5Y981JD9"
};

// Initialize Firebase (singleton pattern)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
