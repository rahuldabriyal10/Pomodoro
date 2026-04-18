// app.js
import { getLeaderboardData } from './firebase-service.js';

// --- STORAGE HELPERS & SETTINGS ---
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

const MODES = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const saved = readJSON("pomodoroSettings", null);
if (saved && saved.MODES) Object.assign(MODES, saved.MODES);

// --- STATE MACHINE ---
let currentMode = 'focus';
let timeRemaining = MODES.focus;
let timerInterval = null;
let isRunning = false;
let sessionCount = 0;

const savedState = readJSON("timerState", null);
if (savedState) {
    currentMode = savedState.currentMode || 'focus';
    timeRemaining = typeof savedState.timeRemaining === "number" ? savedState.timeRemaining : MODES[currentMode];
    sessionCount = savedState.sessionCount || 0;
}

let totalHistoricalSessions = Number(localStorage.getItem("totalSessions")) || 0;
let totalHistoricalMinutes = Number(localStorage.getItem("totalMinutes")) || 0;
let tasks = readJSON("tasks", []);

// --- DOM ELEMENTS ---
const el = {
    min: document.getElementById("minutes"),
    sec: document.getElementById("seconds"),
    prog: document.getElementById("progressBar"),
    container: document.getElementById("timerContainer"),
    tracker: document.getElementById("sessionTracker"),
    notify: document.getElementById("notifySound")
};

// --- UPDATE UI ---
function updateUI() {
    const m = Math.floor(timeRemaining / 60);
    const s = timeRemaining % 60;
    el.min.textContent = String(m).padStart(2, "0");
    el.sec.textContent = String(s).padStart(2, "0");

    const totalTime = MODES[currentMode];
    const percent = ((totalTime - timeRemaining) / totalTime) * 100;
    el.prog.style.width = `${percent}%`;
    el.tracker.textContent = `Sessions: ${sessionCount}/4`;

    localStorage.setItem("timerState", JSON.stringify({ currentMode, timeRemaining, sessionCount }));
}

// --- SWITCH MODE ---
function switchMode(newMode) {
    pauseTimer();
    currentMode = newMode;
    timeRemaining = MODES[newMode];
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`tab-${newMode}`);
    if (tab) tab.classList.add('active');
    el.container.className = `container theme-${newMode}`;
    updateUI();
}

// --- SESSION END & TIMER CONTROLS ---
function handleSessionEnd() {
    pauseTimer();
    if (el.notify) el.notify.play().catch(() => {});

    if (currentMode === 'focus') {
        sessionCount++;
        totalHistoricalSessions++;
        totalHistoricalMinutes += Math.floor(MODES.focus / 60);
        document.getElementById("totalSessionsStat").textContent = totalHistoricalSessions;
        document.getElementById("totalMinutesStat").textContent = totalHistoricalMinutes;
        localStorage.setItem("totalSessions", totalHistoricalSessions);
        localStorage.setItem("totalMinutes", totalHistoricalMinutes);
        switchMode(sessionCount % 4 === 0 ? 'long' : 'short');
    } else {
        switchMode('focus');
    }
    startTimer();
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) { handleSessionEnd(); return; }
        timeRemaining--;
        updateUI();
    }, 1000);
}

function pauseTimer() { clearInterval(timerInterval); isRunning = false; }
function resetTimer() { pauseTimer(); timeRemaining = MODES[currentMode]; updateUI(); }

document.getElementById("start").addEventListener("click", startTimer);
document.getElementById("pause").addEventListener("click", pauseTimer);
document.getElementById("reset").addEventListener("click", resetTimer);

// --- TASK LOGIC ---
const taskList = document.getElementById("taskList");
const taskInput = document.getElementById("taskInput");

function renderTasks() {
    taskList.innerHTML = "";
    tasks.forEach(task => {
        const li = document.createElement("li");
        li.className = `task-item ${task.completed ? "completed" : ""}`;
        li.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center; cursor:pointer;" onclick="toggleTask(${task.id})">
                <input type="checkbox" ${task.completed ? "checked" : ""} style="pointer-events:none;">
                <span class="task-text">${task.text}</span>
            </div>
            <button onclick="deleteTask(${task.id})">✖</button>
        `;
        taskList.appendChild(li);
    });
    localStorage.setItem("tasks", JSON.stringify(tasks));
}

function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    tasks.push({ id: Date.now(), text, completed: false });
    taskInput.value = "";
    renderTasks();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) task.completed = !task.completed;
    renderTasks();
}

function deleteTask(id) { tasks = tasks.filter(t => t.id !== id); renderTasks(); }
taskInput.addEventListener("keypress", (e) => { if (e.key === "Enter") addTask(); });

// --- MODALS & UI HOOKS ---
const modalOverlay = document.getElementById("modalOverlay");
const modals = ["taskModal", "statsModal", "authModal", "leaderboardModal"];

function openModal(modalId) {
    if (!modalOverlay) return;
    modalOverlay.classList.add("active");
    modals.forEach(id => {
        const m = document.getElementById(id);
        if (m) m.classList.remove("active");
    });
    const target = document.getElementById(modalId);
    if (target) target.classList.add("active");
}

function closeModals() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove("active");
    modals.forEach(id => {
        const m = document.getElementById(id);
        if (m) m.classList.remove("active");
    });
}

document.getElementById("taskBtn")?.addEventListener("click", () => openModal("taskModal"));
document.getElementById("statsBtn")?.addEventListener("click", () => openModal("statsModal"));
document.getElementById("authBtn")?.addEventListener("click", () => openModal("authModal"));

modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModals(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

const toggleAuthMode = document.getElementById("toggleAuthMode");
const authTitle = document.getElementById("authTitle");
const submitAuthBtn = document.getElementById("submitAuthBtn");

if (toggleAuthMode && authTitle && submitAuthBtn) {
    let isLoginMode = true;
    toggleAuthMode.addEventListener("click", () => {
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? "🔑 Login" : "📝 Register";
        submitAuthBtn.textContent = isLoginMode ? "Sign In" : "Sign Up";
        toggleAuthMode.textContent = isLoginMode ? "Need an account? Register" : "Have an account? Login";
    });
}

// --- LEADERBOARD LOGIC ---
const loadLeaderboard = async () => {
    const leaderboardList = document.getElementById("leaderboardList");
    if (!leaderboardList) return;

    leaderboardList.innerHTML = "<li>Loading top scholars... ⏳</li>";
    const topUsers = await getLeaderboardData();
    leaderboardList.innerHTML = "";

    if (topUsers.length === 0) {
        leaderboardList.innerHTML = "<li>No data yet! Play some sessions!</li>";
        return;
    }

    topUsers.forEach((user, index) => {
        const li = document.createElement("li");
        li.className = "task-item"; 
        const rank = index === 0 ? "🏆" : `#${index + 1}`;
        li.innerHTML = `
            <span style="font-weight: bold;">${rank} ${user.name}</span>
            <span style="font-weight: bold;">${user.minutes} mins</span>
        `;
        leaderboardList.appendChild(li);
    });
};

document.getElementById("leaderboardBtn")?.addEventListener("click", () => {
    openModal("leaderboardModal");
    loadLeaderboard();
});

// --- MUSIC & MEDIA ---
const bgMusic = document.getElementById("bgMusic");
const musicBtn = document.getElementById("musicBtn");
const volumeSlider = document.getElementById("volumeSlider");
const musicSelector = document.getElementById("musicSelector");

// Load saved settings from memory
const savedVolume = Number(localStorage.getItem("volume"));
const initialVolume = Number.isFinite(savedVolume) ? savedVolume : 0.5;
const savedTrack = localStorage.getItem("selectedTrack") || "music/101.mp3";

if (bgMusic) {
    bgMusic.src = savedTrack;
    bgMusic.volume = initialVolume;
}

if (volumeSlider) volumeSlider.value = String(initialVolume);
if (musicSelector) musicSelector.value = savedTrack;

// Play / Pause Button
if (musicBtn) {
    musicBtn.addEventListener("click", () => {
        if (bgMusic.paused) {
            bgMusic.play()
                .then(() => { musicBtn.textContent = "🔊"; })
                .catch(() => { musicBtn.textContent = "🎵"; });
        } else {
            bgMusic.pause();
            musicBtn.textContent = "🎵";
        }
    });
}

// Volume Slider
if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
        bgMusic.volume = e.target.value;
        localStorage.setItem("volume", e.target.value);
    });
}

// Dropdown Track Selector
if (musicSelector) {
    musicSelector.addEventListener("change", (e) => {
        const wasPlaying = !bgMusic.paused;
        bgMusic.src = e.target.value;
        localStorage.setItem("selectedTrack", e.target.value);

        // If music was already playing, auto-play the new track
        if (wasPlaying) {
            bgMusic.play().catch(() => {
                musicBtn.textContent = "🎵";
            });
        }
    });
}
// --- DRAG & DROP ---
let isDragging = false, dragOffsetX, dragOffsetY;
el.container.addEventListener('mousedown', (e) => {
    if (['BUTTON', 'INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) return; 
    isDragging = true;
    const rect = el.container.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    el.container.style.transition = 'none'; 
});
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    el.container.style.left = `${e.clientX - dragOffsetX}px`;
    el.container.style.top = `${e.clientY - dragOffsetY}px`;
});
document.addEventListener('mouseup', () => {
    if (isDragging) { isDragging = false; el.container.style.transition = 'background 0.6s ease'; }
});

// Expose globals
window.addTask = addTask; window.toggleTask = toggleTask; window.deleteTask = deleteTask; 
window.switchMode = switchMode; window.closeModals = closeModals;

// Init
renderTasks(); updateUI();
document.getElementById("totalSessionsStat").textContent = totalHistoricalSessions;
document.getElementById("totalMinutesStat").textContent = totalHistoricalMinutes;
// --- FULLSCREEN ---
const fullscreenBtn = document.getElementById("fullscreenBtn");

if (fullscreenBtn) {
    fullscreenBtn.addEventListener("click", async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                fullscreenBtn.textContent = "🡼"; // Change icon to 'exit fullscreen'
            } else {
                await document.exitFullscreen();
                fullscreenBtn.textContent = "⛶"; // Change icon back to 'enter fullscreen'
            }
        } catch (err) {
            console.error("Error attempting to enable fullscreen:", err);
            fullscreenBtn.textContent = "⛶";
        }
    });

    // Listen for the "Escape" key exiting fullscreen natively
    document.addEventListener("fullscreenchange", () => {
        if (fullscreenBtn) {
            fullscreenBtn.textContent = document.fullscreenElement ? "🡼" : "⛶";
        }
    });
}