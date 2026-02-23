// --- STATE & LOCAL STORAGE --- //
function getTodayStr() { return new Date().toDateString(); }

let trackers = JSON.parse(localStorage.getItem('nt_trackers')) || [];
let groups = JSON.parse(localStorage.getItem('nt_groups')) || ['Genel', 'Hafta İçi', 'Hafta Sonu'];
let todayData = JSON.parse(localStorage.getItem('nt_today')) || { date: getTodayStr(), ms: 0 };

if (todayData.date !== getTodayStr()) {
    todayData = { date: getTodayStr(), ms: 0 };
    saveToday();
}

let activeFilter = 'Hepsi';
let tickInterval = null;

const colorMap = {
    cyan: { color: 'var(--neon-cyan)', glow: 'var(--neon-cyan-glow)', bg: 'var(--neon-cyan-bg)' },
    purple: { color: 'var(--neon-purple)', glow: 'var(--neon-purple-glow)', bg: 'var(--neon-purple-bg)' },
    blue: { color: 'var(--neon-blue)', glow: 'rgba(43,144,255,0.4)', bg: 'rgba(43,144,255,0.15)' }
};
let selectedColor = 'cyan';

// --- DOM ELEMENTS --- //
const domTotalToday = document.getElementById('val-total-today');
const domLiveCount = document.getElementById('live-count');
const domGroupsFilter = document.getElementById('groups-filter');
const domTrackersList = document.getElementById('trackers-list');

// Modal Elements
const modal = document.getElementById('modal-task');
const btnInitiate = document.getElementById('btn-initiate');
const btnCancelTask = document.getElementById('btn-cancel-task');
const btnSaveTask = document.getElementById('btn-save-task');
const inputTaskName = document.getElementById('input-task-name');
const selectTaskGroup = document.getElementById('select-task-group');
const btnNewGroup = document.getElementById('btn-new-group-prompt');
const inputTaskInterval = document.getElementById('input-task-interval');
const colorBtns = document.querySelectorAll('.color-btn');

// --- INITIALIZATION --- //
function init() {
    renderGroupsFilter();
    renderGroupSelectOptions();
    renderTrackers();
    updateTotalTodayDisplay();
    startGlobalTicker();
    requestNotificationPermission();
}

// --- SAVING --- //
function saveTrackers() { localStorage.setItem('nt_trackers', JSON.stringify(trackers)); }
function saveGroups() { localStorage.setItem('nt_groups', JSON.stringify(groups)); }
function saveToday() { localStorage.setItem('nt_today', JSON.stringify(todayData)); }

// --- NOTIFICATIONS --- //
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        // Try to trigger Service Worker Push if registered
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
                body,
                icon: 'vite.svg',
                vibrate: [200, 100, 200]
            });
        }).catch(() => {
            new Notification(title, { body, icon: 'vite.svg' });
        });
    }
}

// --- RENDERING --- //
function renderGroupSelectOptions() {
    selectTaskGroup.innerHTML = '';
    groups.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        selectTaskGroup.appendChild(opt);
    });
}

function renderGroupsFilter() {
    domGroupsFilter.innerHTML = '';
    const allGroups = ['Hepsi', ...groups];

    allGroups.forEach(g => {
        const btn = document.createElement('button');
        btn.className = `group-tab ${activeFilter === g ? 'active' : ''}`;
        btn.textContent = g;
        btn.onclick = () => {
            activeFilter = g;
            renderGroupsFilter();
            renderTrackers();
        };
        domGroupsFilter.appendChild(btn);
    });
}

function renderTrackers() {
    domTrackersList.innerHTML = '';

    let filtered = trackers;
    if (activeFilter !== 'Hepsi') {
        filtered = trackers.filter(t => t.group === activeFilter);
    }

    let liveCount = 0;

    filtered.forEach(tracker => {
        if (tracker.isRunning) liveCount++;

        const cMap = colorMap[tracker.color] || colorMap.cyan;
        const totalMs = tracker.isRunning ? tracker.elapsedMs + (Date.now() - tracker.lastStartTime) : tracker.elapsedMs;

        // Create UI item
        const item = document.createElement('div');
        item.className = `tracker-item ${tracker.isRunning ? 'active' : ''}`;
        item.style.setProperty('--item-color', cMap.color);
        item.style.setProperty('--item-glow', cMap.glow);
        item.style.setProperty('--item-bg', cMap.bg);

        item.innerHTML = `
      <div class="tracker-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${tracker.isRunning ? '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>' : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>'}
        </svg>
      </div>
      <div class="tracker-info">
        <h4>${tracker.name}</h4>
        <div class="tracker-time">${formatMs(totalMs)}</div>
      </div>
      <button class="play-pause-btn" data-id="${tracker.id}">
        <svg viewBox="0 0 24 24">
          ${tracker.isRunning
                ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
                : '<polygon points="5 3 19 12 5 21 5 3"/>'}
        </svg>
      </button>
    `;

        // Bind play/pause
        const btn = item.querySelector('.play-pause-btn');
        btn.onclick = () => toggleTracker(tracker.id);

        // Delete handling (Long Press / Context menu)
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (confirm(`"${tracker.name}" adlı görevi silmek istiyor musunuz?`)) {
                trackers = trackers.filter(t => t.id !== tracker.id);
                if (tracker.isRunning) updateTodayData(Date.now() - tracker.lastStartTime);
                saveTrackers();
                renderTrackers();
            }
        });

        domTrackersList.appendChild(item);
    });

    domLiveCount.textContent = `${liveCount} Aktif Görev`;
}

// --- CORE LOGIC --- //
function formatMs(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatHoursMins(ms) {
    const totalMins = Math.floor(ms / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours}h ${mins}m`;
}

function updateTodayData(addMs) {
    if (todayData.date !== getTodayStr()) {
        todayData = { date: getTodayStr(), ms: addMs };
    } else {
        todayData.ms += addMs;
    }
    saveToday();
}

function updateTotalTodayDisplay() {
    // Add running time of active trackers to todayData for display only
    let runningAdd = 0;
    trackers.forEach(t => {
        if (t.isRunning) runningAdd += (Date.now() - t.lastStartTime);
    });
    domTotalToday.textContent = formatHoursMins(todayData.ms + runningAdd);
}

function toggleTracker(id) {
    const tracker = trackers.find(t => t.id === id);
    if (!tracker) return;

    const now = Date.now();
    if (tracker.isRunning) {
        // PAUSE
        const delta = now - tracker.lastStartTime;
        tracker.elapsedMs += delta;
        updateTodayData(delta); // save delta to today stats
        tracker.isRunning = false;
    } else {
        // PLAY
        tracker.lastStartTime = now;
        tracker.isRunning = true;

        // Only one tracker at a time? User said they can start multiple ("hepsini ayrı ayrı başlatıp durdurabileceğim").
        // So no auto-pausing others.
    }

    saveTrackers();
    renderTrackers();
}

function startGlobalTicker() {
    if (tickInterval) clearInterval(tickInterval);

    tickInterval = setInterval(() => {
        let needsRender = false;
        const now = Date.now();

        trackers.forEach(tracker => {
            if (tracker.isRunning) {
                needsRender = true;
                const currentMs = tracker.elapsedMs + (now - tracker.lastStartTime);

                // Check notifications
                if (tracker.interval > 0) {
                    const intervalMs = tracker.interval * 60000;
                    if (currentMs - tracker.lastNotifiedMs >= intervalMs) {
                        tracker.lastNotifiedMs = currentMs; // update next milestone
                        sendNotification('Zaman Hatırlatıcısı', `"${tracker.name}" için ${tracker.interval} dakika doldu!`);
                        saveTrackers(); // implicitly saves lastNotifiedMs
                    }
                }
            }
        });

        if (needsRender) {
            renderTrackers(); // DOM re-render every second for timers
            updateTotalTodayDisplay(); // Update top stats live
        }
    }, 1000);
}

// --- EVENTS --- //

btnInitiate.onclick = () => {
    modal.classList.add('show');
    inputTaskName.value = '';
    document.getElementById('group-color-picker').style.display = 'flex';
    selectedColor = 'cyan';
    updateColorBtns();
};

btnCancelTask.onclick = () => modal.classList.remove('show');

btnSaveTask.onclick = () => {
    const name = inputTaskName.value.trim();
    const group = selectTaskGroup.value;
    const interval = parseInt(inputTaskInterval.value) || 0;

    if (!name) { alert('Görev adı girmelisiniz!'); return; }

    const newTask = {
        id: 'trk_' + Date.now(),
        name,
        group,
        interval, // in minutes
        color: selectedColor,
        elapsedMs: 0,
        lastStartTime: 0,
        lastNotifiedMs: 0,
        isRunning: false
    };

    trackers.unshift(newTask);
    saveTrackers();

    // prompt permission if interval > 0
    if (interval > 0) requestNotificationPermission();

    modal.classList.remove('show');
    renderTrackers();
};

btnNewGroup.onclick = () => {
    const groupName = prompt('Yeni grup adını giriniz:');
    if (groupName && groupName.trim()) {
        const val = groupName.trim();
        if (!groups.includes(val)) {
            groups.push(val);
            saveGroups();
            renderGroupsFilter();
            renderGroupSelectOptions();
            selectTaskGroup.value = val;
        }
    }
};

function updateColorBtns() {
    colorBtns.forEach(b => {
        if (b.dataset.color === selectedColor) b.classList.add('active');
        else b.classList.remove('active');
    });
}

colorBtns.forEach(btn => {
    btn.onclick = () => {
        selectedColor = btn.dataset.color;
        updateColorBtns();
    };
});

// Run Init
init();
