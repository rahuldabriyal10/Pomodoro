// firebase-service.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// NEW: Added signOut
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. YOUR FIREBASE CONFIGURATION


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
                if (typeof window.closeModals === "function") {
                    setTimeout(() => window.closeModals(), 600); 
                }
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                authMessage.style.color = "#55ff55";
                authMessage.textContent = "Account created!";
            }
            setTimeout(() => window.location.reload(), 1200);
        } catch (error) {
            authMessage.style.color = "#ff5555";
            authMessage.textContent = error.message.replace("Firebase: ", "");
        }
    });
}

// 5. CLOUD TO LOCAL SYNC
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (authBtn) authBtn.textContent = "🟢"; 
        
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        
        if (snap.exists()) {
            const cloudData = snap.data();
            
            // NEW: Populate Profile Modal fields automatically
            const profileName = document.getElementById("profileDisplayName");
            const profileGoal = document.getElementById("profileStudyGoal");
            if (profileName) profileName.value = cloudData.displayName || user.email.split('@')[0];
            if (profileGoal) profileGoal.value = cloudData.studyGoal || "";

            // Sync Stats
            const localSessions = Number(localStorage.getItem("totalSessions")) || 0;
            if (cloudData.stats && cloudData.stats.totalSessions > localSessions) {
                localStorage.setItem("totalSessions", cloudData.stats.totalSessions);
                localStorage.setItem("totalMinutes", cloudData.stats.totalMinutes);
                
                const tsStat = document.getElementById("totalSessionsStat");
                const tmStat = document.getElementById("totalMinutesStat");
                if (tsStat) tsStat.textContent = cloudData.stats.totalSessions;
                if (tmStat) tmStat.textContent = cloudData.stats.totalMinutes;
            }

            // Sync Tasks
            if (cloudData.tasks) {
                localStorage.setItem("tasks", JSON.stringify(cloudData.tasks));
            }
        } else {
            // New User Fallback
            const profileName = document.getElementById("profileDisplayName");
            if (profileName) profileName.value = user.email.split('@')[0];
        }
    } else {
        if (authBtn) authBtn.textContent = "👤";
    }
});

// 6. LOCAL TO CLOUD SYNC (The "Storage Interceptor")
function syncToFirebase() {
    if (!auth.currentUser) return; 
    
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

const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key === 'totalSessions' || key === 'totalMinutes' || key === 'tasks') {
        syncToFirebase();
    }
};

// =====================================================================
// 7. B.Sc. DEGREE REQUIREMENTS (RELATIONAL DATABASE & LEADERBOARD)
// =====================================================================

// NEW: Exported Auth Functions for app.js
export const getCurrentUser = () => auth.currentUser;

export const logOutUser = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out:", error);
    }
};

// FEATURE: Create a Project (Category) for Relational ER Diagram
export const createProject = async (projectName) => {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const projectsRef = collection(userRef, "projects"); 
    await addDoc(projectsRef, {
      projectName: projectName,
      createdAt: new Date()
    });
    console.log("Project mapped successfully!");
  } catch (error) {
    console.error("Error creating project: ", error);
  }
};

// FEATURE: Add Task to a Specific Project
export const addTaskToProject = async (projectId, taskName) => {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const projectRef = doc(userRef, "projects", projectId);
    const tasksRef = collection(projectRef, "tasks");

    await addDoc(tasksRef, {
      taskName: taskName,
      status: "pending",
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error mapping task: ", error);
  }
};

// FEATURE: Update User Profile (Security & Access Rights)
// UPGRADED: Now accepts studyGoal
export const updateUserProfile = async (displayName, studyGoal = "") => {
  if (!auth.currentUser) return;
  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    await setDoc(userRef, { 
        displayName: displayName,
        studyGoal: studyGoal
    }, { merge: true });
    console.log("Profile updated successfully!");
  } catch (error) {
    console.error("Error updating profile:", error);
  }
};

// FEATURE: Fetch Leaderboard (Analytical Reporting)
export const getLeaderboardData = async () => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("stats.totalMinutes", "desc"), limit(10));
    
    const querySnapshot = await getDocs(q);
    const leaderboard = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      leaderboard.push({
        name: data.displayName || "Anonymous Scholar",
        minutes: data.stats?.totalMinutes || 0
      });
    });
    
    return leaderboard;
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return []; 
  }
};
// FEATURE: Password Reset (Security/UX)
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: "Reset link sent! Check your inbox." };
  } catch (error) {
    console.error("Error resetting password:", error);
    return { success: false, message: error.message.replace("Firebase: ", "") };
  }
};
// FEATURE: Session Logging (For Relational Reporting)
export const saveSessionRecord = async (sessionData) => {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const sessionsRef = collection(userRef, "sessions");
        
        await addDoc(sessionsRef, {
            ...sessionData,
            timestamp: new Date(),
            userId: auth.currentUser.uid // Explicit foreign key for your documentation
        });
        console.log("Session logged to cloud database.");
    } catch (error) {
        console.error("Error logging session:", error);
    }
};

// FEATURE: Fetch History (For Analytical Reports)
export const getSessionHistory = async () => {
    if (!auth.currentUser) return [];
    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        const sessionsRef = collection(userRef, "sessions");
        const q = query(sessionsRef, orderBy("timestamp", "desc"), limit(20));
        
        const querySnapshot = await getDocs(q);
        const history = [];
        querySnapshot.forEach((doc) => {
            history.push({ id: doc.id, ...doc.data() });
        });
        return history;
    } catch (error) {
        console.error("Error fetching history:", error);
        return [];
    }
};
