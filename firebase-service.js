// firebase-service.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. YOUR FIREBASE CONFIGURATION
// TODO: Replace with your actual Firebase project config
const firebaseConfig = {

  apiKey: "REMOVED_API_KEY",

  authDomain: "stellar-pomodoro.firebaseapp.com",

  projectId: "stellar-pomodoro",

  storageBucket: "stellar-pomodoro.firebasestorage.app",

  messagingSenderId: "82082541191",

  appId: "1:82082541191:web:16134b4cd01c3471865222",

  measurementId: "G-VJ3F6TH118"

};


// 2. INITIALIZE FIREBASE
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 3. UI ELEMENTS FOR AUTH
const authBtn = document.getElementById("authBtn");
const submitAuthBtn = document.getElementById("submitAuthBtn");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authMessage = document.getElementById("authMessage");
const toggleAuthMode = document.getElementById("toggleAuthMode");

let isLoginMode = true;

// Keep track of toggle state specifically for the auth action
if (toggleAuthMode) {
    toggleAuthMode.addEventListener("click", () => {
        isLoginMode = !isLoginMode;
        authMessage.textContent = "";
    });
}

// 4. AUTHENTICATION LOGIC
if (submitAuthBtn) {
    submitAuthBtn.addEventListener("click", async () => {
        const email = authEmail.value.trim();
        const password = authPassword.value.trim();
        
        if (!email || !password) {
            authMessage.textContent = "Please enter both email and password.";
            return;
        }

        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
                authMessage.style.color = "#55ff55";
                authMessage.textContent = "Logged in securely!";
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                authMessage.style.color = "#55ff55";
                authMessage.textContent = "Account created!";
            }
            // Refresh the page seamlessly to let app.js load the newly pulled cloud data
            setTimeout(() => window.location.reload(), 1200);
        } catch (error) {
            authMessage.style.color = "#ff5555";
            authMessage.textContent = error.message.replace("Firebase: ", "");
        }
    });
}

// 5. CLOUD TO LOCAL SYNC (On Login/Load)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (authBtn) authBtn.textContent = "🟢"; // Show logged in state visually
        
        // Pull latest data from Firestore
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
            const cloudData = snap.data();
            
            // If cloud has more sessions than local, update local to match cloud
            const localSessions = Number(localStorage.getItem("totalSessions")) || 0;
            if (cloudData.stats && cloudData.stats.totalSessions > localSessions) {
                localStorage.setItem("totalSessions", cloudData.stats.totalSessions);
                localStorage.setItem("totalMinutes", cloudData.stats.totalMinutes);
                
                // Update the DOM visually if the stats modal is opened
                const tsStat = document.getElementById("totalSessionsStat");
                const tmStat = document.getElementById("totalMinutesStat");
                if (tsStat) tsStat.textContent = cloudData.stats.totalSessions;
                if (tmStat) tmStat.textContent = cloudData.stats.totalMinutes;
            }

            // Sync tasks if cloud has them
            if (cloudData.tasks) {
                // Save silently; app.js will naturally load these on next refresh
                localStorage.setItem("tasks", JSON.stringify(cloudData.tasks));
            }
        }
    } else {
        if (authBtn) authBtn.textContent = "👤"; // Logged out state
    }
});

// 6. LOCAL TO CLOUD SYNC (The "Storage Interceptor")
// This safely grabs data EVERY time app.js saves something, completely invisibly.
function syncToFirebase() {
    if (!auth.currentUser) return; // Only sync if logged in
    
    const sessions = Number(localStorage.getItem("totalSessions")) || 0;
    const minutes = Number(localStorage.getItem("totalMinutes")) || 0;
    
    let tasksData = [];
    try {
        tasksData = JSON.parse(localStorage.getItem("tasks") || "[]");
    } catch (e) {}

    const userRef = doc(db, "users", auth.currentUser.uid);
    setDoc(userRef, {
        stats: { totalSessions: sessions, totalMinutes: minutes },
        tasks: tasksData,
        lastUpdated: new Date().toISOString()
    }, { merge: true }).catch(err => console.error("Sync Error:", err));
}

// We intercept the native localStorage.setItem function
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    // 1. Do exactly what app.js originally wants it to do (save locally)
    originalSetItem.apply(this, arguments);
    
    // 2. If it's important data, securely fire off a backup to the cloud
    if (key === 'totalSessions' || key === 'totalMinutes' || key === 'tasks') {
        syncToFirebase();
    }
};