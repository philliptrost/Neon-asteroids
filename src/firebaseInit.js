import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAPBVnz6y4-xO-BcO0zakfIkhSPrUBPxrM",
    authDomain: "neon-92cfd.firebaseapp.com",
    projectId: "neon-92cfd",
    storageBucket: "neon-92cfd.firebasestorage.app",
    messagingSenderId: "815609610399",
    appId: "1:815609610399:web:140e92288eb72e287422aa",
    measurementId: "G-MZE4XJ5LMR"
};

let app = null;
let analytics = null;

// Only initialize Firebase in production context so it doesn't pollute localhost testing
if (window.location.hostname !== 'localhost') {
    app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
}

export { app, analytics };
