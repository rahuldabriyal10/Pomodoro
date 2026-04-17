// --- STORAGE HELPERS ---
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

// --- LOAD SETTINGS FIRST ---
function loadSettings() {
    const saved = readJSON("pomodoroSettings", null);
    if (saved && saved.MODES) {
        Object.assign(MODES, saved.MODES);
    }
}

// --- CONFIGURATION ---
const MODES = {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60
};

loadSettings();

// --- STATE MACHINE ---
let currentMode = 'focus';
let timeRemaining = MODES.focus;
let timerInterval = null;
let isRunning = false;
let sessionCount = 0;

// --- LOAD TIMER STATE ---
const savedState = readJSON("timerState", null);
if (savedState) {
    currentMode = savedState.currentMode || 'focus';
    timeRemaining = typeof savedState.timeRemaining === "number"
        ? savedState.timeRemaining
        : MODES[currentMode];
    sessionCount = savedState.sessionCount || 0;
}

// --- STATS (PERSISTENT) ---
let totalHistoricalSessions = Number(localStorage.getItem("totalSessions")) || 0;
let totalHistoricalMinutes = Number(localStorage.getItem("totalMinutes")) || 0;

// --- TASKS (PERSISTENT) ---
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

const taskInput = document.getElementById("taskInput");
const taskList = document.getElementById("taskList");
const modalOverlay = document.getElementById("modalOverlay");
const taskModal = document.getElementById("taskModal");
const statsModal = document.getElementById("statsModal");
const taskBtn = document.getElementById("taskBtn");
const statsBtn = document.getElementById("statsBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

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

    // Save state
    localStorage.setItem("timerState", JSON.stringify({
        currentMode,
        timeRemaining,
        sessionCount
    }));
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

// --- SESSION END ---
function handleSessionEnd() {
    pauseTimer();
    if (el.notify) {
        el.notify.currentTime = 0;
        el.notify.play().catch(() => {
            // Ignore autoplay-related audio errors; the timer should keep working.
        });
    }

    if (currentMode === 'focus') {
        sessionCount++;

        totalHistoricalSessions++;
        totalHistoricalMinutes += Math.floor(MODES.focus / 60);

        document.getElementById("totalSessionsStat").textContent = totalHistoricalSessions;
        document.getElementById("totalMinutesStat").textContent = totalHistoricalMinutes;

        localStorage.setItem("totalSessions", totalHistoricalSessions);
        localStorage.setItem("totalMinutes", totalHistoricalMinutes);

        if (sessionCount % 4 === 0) {
            switchMode('long');
        } else {
            switchMode('short');
        }
    } else {
        switchMode('focus');
    }

    startTimer();
}

// --- TIMER CONTROLS ---
function startTimer() {
    if (isRunning) return;
    isRunning = true;

    timerInterval = setInterval(() => {
        if (timeRemaining <= 0) {
            handleSessionEnd();
            return;
        }
        timeRemaining--;
        updateUI();
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
}

function resetTimer() {
    pauseTimer();
    timeRemaining = MODES[currentMode];
    updateUI();
}

// --- EVENT LISTENERS ---
document.getElementById("start").addEventListener("click", startTimer);
document.getElementById("pause").addEventListener("click", pauseTimer);
document.getElementById("reset").addEventListener("click", resetTimer);

// --- TASK LOGIC ---
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

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
}

taskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addTask();
});

// --- MODALS ---
function openModal(modal) {
    if (!modalOverlay || !modal) return;

    modalOverlay.classList.add("active");
    taskModal.classList.remove("active");
    statsModal.classList.remove("active");
    modal.classList.add("active");
}

function closeModals() {
    if (!modalOverlay) return;

    modalOverlay.classList.remove("active");
    taskModal.classList.remove("active");
    statsModal.classList.remove("active");
}

taskBtn.addEventListener("click", () => openModal(taskModal));
statsBtn.addEventListener("click", () => openModal(statsModal));

modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
        closeModals();
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeModals();
    }
});

// Expose handlers for inline HTML event attributes.
window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.switchMode = switchMode;
window.closeModals = closeModals;

// --- MUSIC ---
const musicBtn = document.getElementById("musicBtn");
const bgMusic = document.getElementById("bgMusic");
const volumeSlider = document.getElementById("volumeSlider");
const musicSelector = document.getElementById("musicSelector");

const savedVolume = Number(localStorage.getItem("volume"));
const initialVolume = Number.isFinite(savedVolume) ? savedVolume : 0.5;
const savedTrack = localStorage.getItem("selectedTrack") || "music/101.mp3";

bgMusic.src = savedTrack;
bgMusic.volume = initialVolume;
volumeSlider.value = String(initialVolume);
musicSelector.value = savedTrack;

musicBtn.addEventListener("click", () => {
    if (bgMusic.paused) {
        bgMusic.play()
            .then(() => {
                musicBtn.textContent = "🔊";
            })
            .catch(() => {
                musicBtn.textContent = "🎵";
            });
    } else {
        bgMusic.pause();
        musicBtn.textContent = "🎵";
    }
});

volumeSlider.addEventListener("input", (e) => {
    bgMusic.volume = e.target.value;
    localStorage.setItem("volume", e.target.value);
});

musicSelector.addEventListener("change", (e) => {
    const wasPlaying = !bgMusic.paused;
    bgMusic.src = e.target.value;
    localStorage.setItem("selectedTrack", e.target.value);

    if (wasPlaying) {
        bgMusic.play().catch(() => {
            musicBtn.textContent = "🎵";
        });
    }
});

// --- FULLSCREEN ---
fullscreenBtn.addEventListener("click", async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            fullscreenBtn.textContent = "🡼";
        } else {
            await document.exitFullscreen();
            fullscreenBtn.textContent = "⛶";
        }
    } catch {
        fullscreenBtn.textContent = "⛶";
    }
});

document.addEventListener("fullscreenchange", () => {
    fullscreenBtn.textContent = document.fullscreenElement ? "🡼" : "⛶";
});

// --- INIT ---
renderTasks();
updateUI();

document.getElementById("totalSessionsStat").textContent = totalHistoricalSessions;
document.getElementById("totalMinutesStat").textContent = totalHistoricalMinutes;


// --- DRAG & DROP WIDGET LOGIC ---
let isDragging = false;
let dragOffsetX, dragOffsetY;

// 1. Listen for mouse down on your specific container
el.container.addEventListener('mousedown', (e) => {
    // Prevent dragging if clicking a button, input, or slider inside the container
    if (['BUTTON', 'INPUT', 'SELECT', 'OPTION'].includes(e.target.tagName)) {
        return; 
    }
    
    isDragging = true;
    
    // Get the container's current position
    const rect = el.container.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    
    // Remove smooth transitions so dragging doesn't lag behind the cursor
    el.container.style.transition = 'none'; 
});

// 2. Move the container when the mouse moves across the whole document
document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const newLeft = e.clientX - dragOffsetX;
    const newTop = e.clientY - dragOffsetY;
    
    // Override the CSS calc() positioning with exact pixel coordinates
    el.container.style.left = `${newLeft}px`;
    el.container.style.top = `${newTop}px`;
});

// 3. Drop the container when the mouse is released
document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        // Restore your smooth hover/theme transitions!
        el.container.style.transition = 'background 0.6s ease, box-shadow 0.6s ease';
    }
});