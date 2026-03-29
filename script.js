/* Thiran Attendance Tracker - Pure Array Concept (In-Memory Only) */
const EMPLOYEES_LIST = ['Mogesh', 'Hari Haran', 'Mukunthan', 'Prakathesh', 'Rahav V K', 'Lohidharani G S', 'Shaik Nabeela Rayees  ', 'Keerthana P S', 'Kanmani G', 'Navasri N', 'Akash M', 'Arpit kumar P', 'Supriya Jayam.B', 'Vishal M', 'Nisha', 'Sam'];

let currentUser = null;
let attendanceRecordsArray = []; // Primary Storage: Array Concept
let conductedCount = 0;
let tasksArray = []; // Task Management Storage
let selectedEmployees = new Set();

let isSyncing = false;

// Load data from PostgreSQL (Cloud Sync)
// Load data from PostgreSQL (Cloud Sync)
async function loadData() {
    if (isSyncing) return;
    try {
        isSyncing = true;
        const response = await fetch('/api/load');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        if (data) {
            attendanceRecordsArray = data.attendanceRecords || [];
            conductedCount = data.conductedCount || 0;
            tasksArray = data.tasksArray || [];
            // Cache locally for offline/re-entry
            localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecordsArray));
            localStorage.setItem('conductedCount', conductedCount.toString());
            localStorage.setItem('tasksArray', JSON.stringify(tasksArray));
        }
    } catch (error) {
        console.error('Cloud load failed, falling back to local storage', error);
        // Fallback to local
        const localRec = localStorage.getItem('attendanceRecords');
        if (localRec) attendanceRecordsArray = JSON.parse(localRec);
        const localCount = localStorage.getItem('conductedCount');
        if (localCount) conductedCount = parseInt(localCount, 10);
        const localTasks = localStorage.getItem('tasksArray');
        if (localTasks) tasksArray = JSON.parse(localTasks);
    } finally {
        isSyncing = false;
    }
}

// Save data to PostgreSQL (Cloud Sync)
async function saveData() {
    // Also update local for immediate feedback/offline support
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecordsArray));
    localStorage.setItem('conductedCount', conductedCount.toString());
    localStorage.setItem('tasksArray', JSON.stringify(tasksArray));

    try {
        isSyncing = true;
        await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attendanceRecords: attendanceRecordsArray,
                conductedCount: conductedCount,
                tasksArray: tasksArray
            })
        });
    } catch (error) {
        console.error('Cloud sync failed:', error);
    } finally {
        isSyncing = false;
    }
}

// INIT
document.addEventListener('DOMContentLoaded', async () => {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Initial data fetch
    await loadData();
    refreshUI(false);

    // Frequent UI Refresh for clock/animations
    setInterval(() => {
        refreshUI(false); // Don't reload data every time
    }, 2000);

    // Heartbeat Sync from Cloud
    setInterval(async () => {
        if (currentUser) {
            await loadData();
            refreshUI(false);
        }
    }, 15000);

    lucide.createIcons();

    // wire up dropdown toggle
    const dropdownBtn = document.getElementById('emp-dropdown-btn');
    const dropdown = document.getElementById('emp-dropdown');
    if (dropdownBtn && dropdown) {
        dropdownBtn.onclick = () => {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownBtn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    // wire up manual attendance buttons
    const presentBtn = document.getElementById('mark-present-btn');
    const absentBtn = document.getElementById('mark-absent-btn');
    if (presentBtn) {
        presentBtn.onclick = () => {
            const checkboxes = document.querySelectorAll('#emp-dropdown input[type="checkbox"]:checked');
            const selectedEmps = Array.from(checkboxes).map(cb => cb.value);
            const meet = parseInt(document.getElementById('manual-meet-index').value, 10);
            selectedEmps.forEach(emp => manualAttendance(emp, meet, true));
            // Uncheck after marking
            selectedEmployees.clear();
            updateSelectedCount();
        };
    }
    if (absentBtn) {
        absentBtn.onclick = () => {
            const checkboxes = document.querySelectorAll('#emp-dropdown input[type="checkbox"]:checked');
            const selectedEmps = Array.from(checkboxes).map(cb => cb.value);
            const meet = parseInt(document.getElementById('manual-meet-index').value, 10);
            selectedEmps.forEach(emp => manualAttendance(emp, meet, false));
            // Uncheck after marking
            selectedEmployees.clear();
            updateSelectedCount();
        };
    }

    // Wire up assignment form
    const taskForm = document.getElementById('assign-task-form');
    if (taskForm) {
        taskForm.onsubmit = (e) => {
            e.preventDefault();
            const user = document.getElementById('task-user-select').value;
            const week = document.getElementById('task-week-select').value;
            const fromDate = document.getElementById('task-from-date').value;
            const tillDate = document.getElementById('task-till-date').value;
            const text = document.getElementById('task-text').value;

            tasksArray.push({
                id: Date.now(),
                user,
                week,
                fromDate,
                tillDate,
                text,
                status: 'Pending',
                proof: null,
                fileName: null,
                timestamp: new Date().toLocaleString()
            });

            saveData();
            notify(`Task assigned to ${user}`, 'green');
            taskForm.reset();
            renderAdminTasks();
        };
    }

    // Populate task-week-select (1-100)
    const taskWeekSelect = document.getElementById('task-week-select');
    if (taskWeekSelect) {
        taskWeekSelect.innerHTML = Array.from({ length: 100 }, (_, i) => `<option value="Week ${i + 1}">Week ${i + 1}</option>`).join('');
    }

    // Populate manual-meet-index (1-100) for attendance
    const manualMeetIndex = document.getElementById('manual-meet-index');
    if (manualMeetIndex) {
        manualMeetIndex.innerHTML = Array.from({ length: 100 }, (_, i) => `<option value="${i + 1}">Meeting ${i + 1}</option>`).join('');
    }
});

function refreshUI(shouldReload = false) {
    if (shouldReload) loadData(); 
    if (currentUser) {
        if (currentUser.role === 'admin') {
            if (document.getElementById('admin-view')) renderAdmin();
        } else if (currentUser.role === 'employee') {
            if (document.getElementById('employee-view')) renderEmployee();
            if (document.getElementById('employee-tasks-view')) renderUserTasks();
        }
        if (document.getElementById('score-list-view')) renderScoreList();
        if (document.getElementById('admin-tasks-view')) renderAdminTasks();
        renderBoosterLeaderboard();
    }
}

function showView(viewId) {
    try {
        const views = document.querySelectorAll('.view');
        views.forEach(v => {
            v.style.display = 'none';
            v.classList.remove('fade-in');
        });

        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.style.display = (viewId === 'login-view') ? 'flex' : 'block';
            targetView.classList.add('fade-in');
            refreshUI();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } catch (err) {
        console.error('CRITICAL: showView Failed', err);
    }
}

// AUTH
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const user = document.getElementById('username')?.value?.trim();
        const pass = document.getElementById('password')?.value;

        if (user === 'thiran' && pass === 'admin@thiran') {
            currentUser = { name: 'Thiran MD', role: 'admin' };
            showView('admin-view');
            notify('Logged in as Administrator', 'blue');
        } else {
            const map = {
                'mogesh': 'Mogesh', 'hari': 'Hari Haran', 'mukunthan': 'Mukunthan', 'prakathesh': 'Prakathesh',
                'rahav': 'Rahav V K', 'lohith': 'Lohidharani G S', 'nabeela': 'Shaik Nabeela Rayees  ', 'keerthana': 'Keerthana P S',
                'kanmani': 'Kanmani G', 'navasri': 'Navasri N', 'akash': 'Akash M', 'arpit': 'Arpit kumar P', 'supriya': 'Supriya Jayam.B', 'vishal': 'Vishal M',
                'nisha': 'Nisha', 'sam': 'Sam'
            };
            const cleanUser = user?.toLowerCase();
            if (cleanUser && map[cleanUser] && pass === 'thiran*2026') {
                currentUser = { name: map[cleanUser], role: 'employee' };
                const welcomeText = document.getElementById('welcome-text');
                if (welcomeText) welcomeText.innerText = `Hello, ${currentUser.name}`;
                showView('employee-view');
                notify(`Welcome back, ${currentUser.name}!`, 'blue');
            } else {
                notify('Invalid credentials! Check name / pass.', 'red');
            }
        }
    };
}

function logout() {
    currentUser = null;
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showView('login-view');
    resetTracking();
    notify('Logged out successfully', 'blue');
}

function calculateAttendanceScore(empName, count) {
    let score = 100;
    const empRecs = attendanceRecordsArray.filter(r => r.name === empName);

    // Process sessions sequentially to apply penalties and rewards
    for (let i = 0; i < count; i++) {
        const isPresent = empRecs.some(r => r.sessionIndex === i);
        if (isPresent) {
            score = Math.min(100, score + 1.5);
        } else {
            score = Math.max(0, score - 6);
        }
    }
    return score % 1 === 0 ? score : parseFloat(score.toFixed(1));
}

function renderAdmin() {
    const head = document.getElementById('table-headers');
    // ensure manual attendance select is populated each time admin view renders
    populateManualAttendance();
    const body = document.getElementById('table-body');
    const presentCount = EMPLOYEES_LIST.filter(emp => attendanceRecordsArray.some(r => r.name === emp && r.sessionIndex === conductedCount)).length;

    if (head) {
        head.innerHTML = '<th class="sticky-col">Employee Name</th>';
        for (let i = 1; i <= 50; i++) head.innerHTML += `<th>Meet ${i}</th>`;
    }

    let totalScore = 0;
    let criticalCount = 0;

    body.innerHTML = '';
    EMPLOYEES_LIST.forEach(emp => {
        const score = calculateAttendanceScore(emp, conductedCount);
        totalScore += score;
        if (score < 60) criticalCount++;

        let row = `<tr><td class="sticky-col">${emp}</td>`;

        const empRecs = attendanceRecordsArray.filter(r => r.name === emp);
        for (let i = 0; i < 50; i++) {
            const hasAttended = empRecs.find(r => r.sessionIndex === i);
            if (hasAttended) row += `<td><span class="badge-present">Present</span></td>`;
            else if (i < conductedCount) row += `<td><span class="badge-absent">Absent</span></td>`;
            else row += `<td><span style="opacity: 0.1; color: var(--text-muted);">—</span></td>`;
        }
        body.innerHTML += row + '</tr>';
    });

    // Update Summary Stats
    const totalEmpEl = document.getElementById('stat-total-emp');
    const avgPctEl = document.getElementById('stat-avg-pct');
    const criticalEl = document.getElementById('stat-critical');

    if (totalEmpEl) totalEmpEl.innerText = EMPLOYEES_LIST.length;
    if (avgPctEl) avgPctEl.innerText = Math.round(totalScore / EMPLOYEES_LIST.length) + '%';
    if (criticalEl) criticalEl.innerText = criticalCount;
}

// EMPLOYEE CORE
function renderEmployee() {
    const strip = document.getElementById('progress-strip');
    const hHead = document.getElementById('user-table-headers');
    const hBody = document.getElementById('user-table-body');

    // Show attendance history for employees
    const historySection = document.querySelector('#employee-view .table-container');
    if (historySection) historySection.style.display = 'block';
    const progressSection = document.getElementById('progress-strip').parentElement;
    if (progressSection) progressSection.style.display = 'block';

    const myRecs = attendanceRecordsArray.filter(r => r.name === currentUser.name);

    // Update User Percentage Badge
    const score = calculateAttendanceScore(currentUser.name, conductedCount);
    const badge = document.getElementById('user-pct-badge');
    if (badge) {
        badge.innerText = score + '%';
        badge.style.color = score >= 80 ? '#22c55e' : (score >= 60 ? 'var(--primary)' : '#ef4444');
    }

    if (hHead && hBody) {
        hHead.innerHTML = '<th class="sticky-col">Status Category</th>';
        let bodyHtml = `<td class="sticky-col">Session Result</td>`;

        for (let i = 0; i < 50; i++) {
            hHead.innerHTML += `<th>Meet ${i + 1}</th>`;
            const rec = myRecs.find(r => r.sessionIndex === i);
            if (rec) bodyHtml += `<td><span class="badge-present">Present</span></td>`;
            else if (i < conductedCount) bodyHtml += `<td><span class="badge-absent">Absent</span></td>`;
            else bodyHtml += `<td><span style="opacity:0.1; color:var(--text-muted);">—</span></td>`;
        }
        hBody.innerHTML = `<tr>${bodyHtml}</tr>`;
    }

    strip.innerHTML = '';
    for (let i = 0; i < 50; i++) {
        const rec = myRecs.find(r => r.sessionIndex === i);
        let stateClass = '';
        let iconContent = '';
        if (rec) {
            stateClass = 'active';
            iconContent = '<i data-lucide="check-circle" size="20" color="#22d3ee"></i><span style="font-size:0.65rem; color:#22d3ee; font-weight:700">PRESENT</span>';
        } else if (i < conductedCount) {
            iconContent = '<i data-lucide="x-circle" size="20" color="#f87171"></i><span style="font-size:0.65rem; color:#f87171; font-weight:700">ABSENT</span>';
        } else {
            iconContent = '<i data-lucide="clock" size="20" style="opacity:0.3"></i><span style="font-size:0.65rem; opacity:0.3;">UPCOMING</span>';
        }

        strip.innerHTML += `
            <div class="progress-item ${stateClass}">
                <span style="font-size:0.7rem; font-weight:700; opacity:0.5;">MEET ${i + 1}</span>
                ${iconContent}
            </div>
        `;
    }
    lucide.createIcons();
}

function renderScoreList() {
    const list = document.getElementById('performance-list-container');
    if (!list) return;

    // Calculate scores and sort by highest
    const rankings = EMPLOYEES_LIST.map(emp => {
        const empRecs = attendanceRecordsArray.filter(r => r.name === emp);
        const score = calculateAttendanceScore(emp, conductedCount);
        const presentCount = empRecs.length;
        const absences = Math.max(0, conductedCount - presentCount);
        return { name: emp, score, presents: presentCount, absences };
    }).sort((a, b) => b.score - a.score);

    list.innerHTML = '';
    rankings.forEach((entry, idx) => {
        const color = entry.score >= 80 ? '#22c55e' : (entry.score >= 60 ? 'var(--primary)' : '#ef4444');
        const bg = entry.score >= 80 ? 'rgba(34, 197, 94, 0.05)' : (entry.score >= 60 ? 'rgba(250, 204, 21, 0.05)' : 'rgba(239, 68, 68, 0.05)');

        list.innerHTML += `
            <div class="glass-card" style="padding: 1.25rem 2rem; display: flex; align-items: center; justify-content: space-between; border-radius: 1rem; border-color: ${bg === 'transparent' ? 'var(--card-border)' : color}33; background: ${bg};">
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                    <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-muted); opacity: 0.5; width: 30px;">#${idx + 1}</span>
                    <div>
                        <h4 style="font-size: 1.1rem; font-weight: 600;">${entry.name}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">${entry.presents} Present · ${entry.absences} Absent</p>
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 1.5rem; font-weight: 800; color: ${color};">${entry.score}%</span>
                    <p style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.1em; margin-top: 0.2rem;">Attendance Health</p>
                </div>
            </div>
        `;
    });
}

function resetMatrix() {
    if (confirm('CRITICAL: Delete all attendance records forever?')) {
        attendanceRecordsArray = [];
        conductedCount = 0;
        saveData(); // Persist the reset
        notify('Matrix Reset Successfully', 'red');
        renderAdmin();
    }
}

// Manual attendance helpers
function populateManualAttendance() {
    const container = document.getElementById('emp-dropdown');
    if (!container) return;
    container.innerHTML = '';

    // Add "Select All" Option
    const selectAllLabel = document.createElement('label');
    selectAllLabel.style.display = 'flex';
    selectAllLabel.style.alignItems = 'center';
    selectAllLabel.style.gap = '0.75rem';
    selectAllLabel.style.padding = '0.75rem 1rem';
    selectAllLabel.style.borderBottom = '1px solid var(--card-border)';
    selectAllLabel.style.marginBottom = '0.5rem';
    selectAllLabel.style.cursor = 'pointer';
    selectAllLabel.style.fontWeight = '700';
    selectAllLabel.style.color = 'var(--primary)';
    selectAllLabel.style.textTransform = 'none';

    const selectAllCb = document.createElement('input');
    selectAllCb.type = 'checkbox';
    selectAllCb.style.accentColor = 'var(--primary)';
    // Check if everything is already selected
    selectAllCb.checked = EMPLOYEES_LIST.every(emp => selectedEmployees.has(emp));

    selectAllCb.onchange = () => {
        if (selectAllCb.checked) {
            EMPLOYEES_LIST.forEach(emp => selectedEmployees.add(emp));
        } else {
            selectedEmployees.clear();
        }
        populateManualAttendance(); // Re-render to update all checkboxes
        updateSelectedCount();
    };

    selectAllLabel.appendChild(selectAllCb);
    const selectAllText = document.createElement('span');
    selectAllText.textContent = 'Select All Employees';
    selectAllLabel.appendChild(selectAllText);
    selectAllLabel.onclick = (e) => e.stopPropagation();
    container.appendChild(selectAllLabel);

    EMPLOYEES_LIST.forEach(emp => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '0.75rem';
        label.style.fontSize = '0.9rem';
        label.style.cursor = 'pointer';
        label.style.padding = '0.75rem 1rem';
        label.style.borderRadius = '0.5rem';
        label.style.transition = 'background 0.2s';
        label.style.width = '100%';
        label.style.margin = '0'; // Override global label margin
        label.style.textTransform = 'none'; // Override global uppercase
        label.style.color = 'var(--text-main)'; // Set explicit color
        label.style.fontWeight = '400';

        label.onmouseover = () => label.style.background = 'rgba(255,255,255,0.05)';
        label.onmouseout = () => label.style.background = 'transparent';
        label.onclick = (e) => e.stopPropagation();

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = emp;
        checkbox.style.margin = '0';
        checkbox.style.flexShrink = '0';
        checkbox.style.accentColor = 'var(--primary)';
        checkbox.checked = selectedEmployees.has(emp);
        checkbox.onchange = () => {
            if (checkbox.checked) {
                selectedEmployees.add(emp);
            } else {
                selectedEmployees.delete(emp);
            }
            updateSelectedCount();
        };
        label.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = emp;
        label.appendChild(span);
        container.appendChild(label);
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkedCount = selectedEmployees.size;
    const span = document.getElementById('selected-count');
    if (span) {
        span.textContent = checkedCount > 0 ? `${checkedCount} selected` : 'Select Employees';
    }
}

/**
 * Mark or clear attendance manually for a specific employee/meeting.
 * @param {string} empName
 * @param {number} meetNum 1-based
 * @param {boolean} present if true add present record, if false remove record
 */
function manualAttendance(empName, meetNum, present) {
    if (!empName) return notify('Choose an employee first', 'red');
    if (!meetNum || meetNum < 1 || meetNum > 50) return notify('Invalid meeting number', 'red');
    const index = meetNum - 1;
    // remove any existing record for that slot
    attendanceRecordsArray = attendanceRecordsArray.filter(r => !(r.name === empName && r.sessionIndex === index));
    if (present) {
        attendanceRecordsArray.push({ id: Date.now(), name: empName, status: 'Present', sessionIndex: index });
    }
    if (index >= conductedCount) {
        conductedCount = index + 1;
    }

    notify(`Manual attendance ${present ? 'added' : 'cleared'} for ${empName} (Meet ${meetNum})`, present ? 'green' : 'red');
    saveData(); // Persist the attendance change
    renderAdmin();
}

function downloadSheet() {
    notify('Compiling spreadsheet...', 'blue');
    let tableHtml = `<html><head><style>
        table{border-collapse:collapse; font-family:sans-serif;} 
        th{background:#f1f5f9; padding:10px; border:1px solid #ddd; font-weight:bold;}
        td{padding:8px; border:1px solid #ddd; text-align:center;} 
        .present{background:#22c55e; color:white; font-weight:bold;} 
        .absent{background:#ef4444; color:white; font-weight:bold;}
    </style></head><body><table>`;

    tableHtml += '<tr><th style="text-align:left;">Employee Name</th>';
    for (let i = 1; i <= 50; i++) tableHtml += `<th>Meeting ${i}</th>`;
    tableHtml += '</tr>';

    EMPLOYEES_LIST.forEach(emp => {
        tableHtml += `<tr><td style="text-align:left; font-weight:bold;">${emp}</td>`;
        const empRecs = attendanceRecordsArray.filter(r => r.name === emp);
        for (let i = 0; i < 50; i++) {
            const hasAttended = empRecs.find(r => r.sessionIndex === i);
            if (hasAttended) tableHtml += '<td class="present">Present</td>';
            else if (i < conductedCount) tableHtml += '<td class="absent">Absent</td>';
            else tableHtml += '<td>-</td>';
        }
        tableHtml += '</tr>';
    });
    tableHtml += '</table></body></html>';

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Thiran_Attendance_${new Date().toLocaleDateString().replace(/\//g, '-')}.xls`;
    link.click();
}

function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false });
    if (document.getElementById('admin-clock')) document.getElementById('admin-clock').innerText = time;
    if (document.getElementById('user-clock')) document.getElementById('user-clock').innerText = time;
}

function notify(text, color) {
    Toastify({ text, duration: 4000, gravity: "top", position: "right", style: { background: color === 'red' ? '#ef4444' : (color === 'green' ? '#22c55e' : '#6366f1'), borderRadius: '12px', padding: '12px 24px', fontWeight: '600' } }).showToast();
}

// Password Eye Toggle
document.getElementById('toggle-password').onclick = function () {
    const input = document.getElementById('password');
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    this.innerHTML = isPass ? '<i data-lucide="eye-off" size="16"></i>' : '<i data-lucide="eye" size="16"></i>';
    lucide.createIcons();
};

// TASK MANAGEMENT LOGIC
function renderAdminTasks() {
    const selector = document.getElementById('task-user-select');
    if (selector && selector.innerHTML === '') {
        selector.innerHTML = EMPLOYEES_LIST.map(e => `<option value="${e}">${e}</option>`).join('');
    }

    const list = document.getElementById('admin-task-list');
    if (!list) return;

    if (tasksArray.length === 0) {
        list.innerHTML = '<p style="text-align:center; opacity:0.3; padding:2rem;">No tasks assigned yet.</p>';
        return;
    }

    list.innerHTML = '';
    [...tasksArray].reverse().forEach(task => {
        const isSubmitted = task.status === 'Submitted';
        list.innerHTML += `
            <div class="glass-card" style="padding:1.5rem; border-color: ${isSubmitted ? 'var(--primary)' : 'var(--card-border)'};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
                    <div>
                        <span style="font-size:0.7rem; font-weight:800; color:var(--primary); text-transform:uppercase;">${task.week} · ${task.user}</span>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.5rem;">
                            <i data-lucide="calendar" size="12"></i> ${task.fromDate} to ${task.tillDate}
                        </div>
                        <h4 style="font-size:1.05rem; margin-top:0.25rem;">${task.text}</h4>
                    </div>
                    <span class="${isSubmitted ? 'badge-present' : 'badge-absent'}">${task.status}</span>
                </div>
                ${task.proof ? `
                    <div style="margin-top:1rem; padding:1rem; background:rgba(255,255,255,0.03); border-radius:0.5rem; border:1px dashed var(--card-border);">
                        <p style="font-size:0.8rem; margin-bottom:0.75rem;"><i data-lucide="paperclip" size="14" style="vertical-align:middle;"></i> Proof Submitted: <b>${task.fileName}</b></p>
                        ${task.proof.startsWith('data:image') ? `
                            <img src="${task.proof}" onclick="openProof('${task.proof}', '${task.fileName}')" style="max-width:100%; border-radius:0.5rem; border:1px solid var(--card-border); cursor:zoom-in; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        ` : `
                            <div style="display:flex; align-items:center; gap:0.5rem; color:var(--primary); font-weight:600;">
                                <i data-lucide="file-text" size="18"></i>
                                <button onclick="openProof('${task.proof}', '${task.fileName}')" style="background:none; border:none; color:var(--primary); font-size:0.9rem; font-weight:600; text-decoration:underline; cursor:pointer; padding:0;">View Document Content</button>
                            </div>
                        `}
                    </div>
                ` : ''}
                <div style="margin-top:1rem; font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
                    <span>Assigned: ${task.timestamp}</span>
                    <span style="cursor:pointer; color:#f87171" onclick="deleteTask(${task.id})">Delete Task</span>
                </div>
            </div>
        `;
    });
    lucide.createIcons();
}

function deleteTask(id) {
    if (confirm('Delete this task assignment?')) {
        tasksArray = tasksArray.filter(t => t.id !== id);
        saveData();
        renderAdminTasks();
        notify('Task deleted', 'red');
    }
}

function renderUserTasks() {
    const list = document.getElementById('user-task-list');
    if (!list) return;

    const myTasks = tasksArray.filter(t => t.user === currentUser.name);

    if (myTasks.length === 0) {
        list.innerHTML = '<p style="text-align:center; opacity:0.3; padding:4rem;">You have no assigned tasks at the moment.</p>';
        return;
    }

    list.innerHTML = '';
    myTasks.forEach(task => {
        const isSubmitted = task.status === 'Submitted';
        list.innerHTML += `
            <div class="glass-card" style="padding:2rem; margin-bottom:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                    <div>
                        <span style="background:rgba(99,102,241,0.1); padding:0.35rem 1rem; border-radius:2rem; font-size:0.8rem; font-weight:700; color:var(--primary);">${task.week}</span>
                        <span style="margin-left:1rem; font-size:0.8rem; font-weight:600; opacity:0.7;">
                            <i data-lucide="calendar" size="14"></i> ${task.fromDate} — ${task.tillDate}
                        </span>
                    </div>
                    <span class="${isSubmitted ? 'badge-present' : 'badge-absent'}">${isSubmitted ? 'Task Completed' : 'Pending Action'}</span>
                </div>
                <h3 style="font-size:1.25rem; margin-bottom:1rem; line-height:1.4;">${task.text}</h3>
                
                ${!isSubmitted ? `
                    <div style="margin-top:2rem; padding:1.5rem; border:1px dashed var(--card-border); border-radius:1rem; text-align:center;">
                        <input type="file" id="file-${task.id}" style="display:none" onchange="handleSubmission(${task.id}, this)">
                        <button onclick="document.getElementById('file-${task.id}').click()" class="btn-outline" style="width:100%; justify-content:center;">
                            <i data-lucide="upload-cloud" size="18"></i> Upload Proof (Photo/File)
                        </button>
                        <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.75rem;">Max size: 2MB · PNG, JPG or PDF</p>
                    </div>
                ` : `
                    <div style="margin-top:1.5rem; display:flex; align-items:center; justify-content:space-between; padding:1.25rem; background:rgba(34, 197, 94, 0.05); border-radius:0.75rem; border:1px solid rgba(34, 197, 94, 0.15);">
                        <div style="color:#22c55e; display:flex; align-items:center; gap:0.5rem; font-weight:600;">
                            <i data-lucide="check-circle" size="20"></i> ${task.fileName} Received
                        </div>
                        <button onclick="deleteSubmission(${task.id})" class="btn-outline" style="border-color:#f87171; color:#f87171; padding:0.4rem 0.75rem; font-size:0.75rem; min-width:auto;">
                            <i data-lucide="trash-2" size="14"></i> Delete & Re-submit
                        </button>
                    </div>
                `}
            </div>
        `;
    });
    lucide.createIcons();
}

function handleSubmission(taskId, input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) return notify('File too large! Max 2MB.', 'red');

    const reader = new FileReader();
    reader.onload = (e) => {
        const task = tasksArray.find(t => t.id === taskId);
        if (task) {
            task.status = 'Submitted';
            task.completionTime = Date.now();
            task.proof = e.target.result;
            task.fileName = file.name;
            saveData();
            notify('Task proof submitted successfully!', 'green');
            renderUserTasks();
            renderBoosterLeaderboard();
        }
    };
    reader.readAsDataURL(file);
}

function deleteSubmission(taskId) {
    if (confirm('Are you sure you want to delete this submission? You can upload a new proof after deleting.')) {
        const task = tasksArray.find(t => t.id === taskId);
        if (task) {
            task.status = 'Pending';
            task.proof = null;
            task.fileName = null;
            saveData();
            notify('Submission deleted. You can re-submit now.', 'red');
            renderUserTasks();
        }
    }
}

function openProof(data, filename) {
    const modal = document.getElementById('proof-modal');
    const content = document.getElementById('modal-content-area');
    const dlBtn = document.getElementById('modal-download');
    const filenameLabel = document.getElementById('modal-filename');

    if (!modal || !content || !dlBtn || !filenameLabel) return;

    filenameLabel.textContent = filename;
    dlBtn.href = data;
    dlBtn.download = filename;

    if (data.startsWith('data:image')) {
        content.innerHTML = `<img src="${data}" style="max-width:100%; height:auto; border-radius:0.5rem; box-shadow:0 10px 30px rgba(0,0,0,0.5);">`;
    } else if (data.indexOf('application/pdf') !== -1) {
        content.innerHTML = `<embed src="${data}" type="application/pdf" width="100%" height="100%" style="border-radius:0.5rem;">`;
    } else {
        content.innerHTML = `
            <div style="text-align:center; padding:3rem;">
                <i data-lucide="file-text" size="64" style="color:var(--primary); margin-bottom:1.5rem;"></i>
                <p style="font-size:1.1rem; font-weight:600;">This file format cannot be previewed directly.</p>
                <p style="font-size:0.9rem; color:var(--text-muted); margin-top:0.5rem;">Please use the button below to download and view it.</p>
            </div>
        `;
        lucide.createIcons();
    }

    modal.style.display = 'flex';
    lucide.createIcons();
}

function closeProof() {
    const modal = document.getElementById('proof-modal');
    if (modal) modal.style.display = 'none';
}

function renderBoosterLeaderboard() {
    const adminList = document.getElementById('admin-booster-list');
    const userList = document.getElementById('user-booster-list');
    if (!adminList && !userList) return;

    // Get all employees (exclude admin)
    const employees = EMPLOYEES_LIST;

    // Find stats for each employee
    const stats = employees.map(name => {
        const userTasks = tasksArray.filter(t => t.user === name);
        const completed = userTasks.filter(t => t.status === 'Submitted');
        const pending = userTasks.length - completed.length;

        // Speed score (higher is faster)
        let speedFactor = 0;
        if (completed.length > 0) {
            // Find earliest completion
            const earliest = [...completed].sort((a, b) => a.completionTime - b.completionTime)[0];
            speedFactor = earliest ? 1 / (earliest.completionTime / 1000000000000) : 0;
        }

        return {
            name,
            played: userTasks.length,
            won: completed.length,
            lost: pending,
            pts: completed.length * 2, // 2 points per completed task
            speed: speedFactor,
            bestTime: completed.length > 0 ? Math.min(...completed.map(t => t.completionTime)) : Infinity
        };
    });

    // Sort by Name Alphabetically
    stats.sort((a, b) => a.name.localeCompare(b.name));

    const tableHtml = `
        <table style="width: 100%; border-collapse: collapse; min-width: 600px; color: white;">
            <thead>
                <tr style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.6); text-transform: uppercase; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em;">
                    <th style="padding: 1.25rem 1rem; text-align: left; width: 60px;">Pos</th>
                    <th style="padding: 1.25rem 1rem; text-align: left;">Player</th>
                    <th style="padding: 1.25rem 1rem; text-align: center; width: 60px;">T</th>
                    <th style="padding: 1.25rem 1rem; text-align: center; width: 60px;">W</th>
                    <th style="padding: 1.25rem 1rem; text-align: center; width: 60px;">L</th>
                    <th style="padding: 1.25rem 1rem; text-align: center; width: 80px;">Speed</th>
                    <th style="padding: 1.25rem 1rem; text-align: center; width: 80px; color: #fbbf24;">Pts</th>
                </tr>
            </thead>
            <tbody>
                ${stats.map((row, i) => {
        const rowClass = (i < 4) ? 'style="background: rgba(16, 185, 129, 0.03);"' : '';
        return `
                        <tr ${rowClass} style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='${i < 4 ? 'rgba(16, 185, 129, 0.03)' : 'transparent'}'">
                            <td style="padding: 1.25rem 1rem; font-weight: 700; ${i < 4 ? 'color: #10b981;' : 'color: rgba(255,255,255,0.5);'}">${i + 1}</td>
                            <td style="padding: 1.25rem 1rem;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="width: 32px; height: 32px; background: ${i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; color: ${i === 0 ? '#000' : '#fff'};">
                                        ${row.name.charAt(0)}
                                    </div>
                                    <span style="font-weight: 700; font-size: 1rem;">${row.name}</span>
                                </div>
                            </td>
                            <td style="padding: 1.25rem 1rem; text-align: center; font-weight: 600;">${row.played}</td>
                            <td style="padding: 1.25rem 1rem; text-align: center; font-weight: 700; color: #10b981;">${row.won}</td>
                            <td style="padding: 1.25rem 1rem; text-align: center; font-weight: 600; color: #f87171; opacity: 0.7;">${row.lost}</td>
                            <td style="padding: 1.25rem 1rem; text-align: center; font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.7);">${row.bestTime === Infinity ? '-' : (1 / (row.bestTime / 1000000000000)).toFixed(3)}</td>
                            <td style="padding: 1.25rem 1rem; text-align: center; font-weight: 900; color: #fbbf24; font-size: 1.1rem;">${row.pts}</td>
                        </tr>
                    `;
    }).join('')}
            </tbody>
        </table>
    `;

    if (adminList) adminList.innerHTML = tableHtml;
    if (userList) userList.innerHTML = tableHtml;

    lucide.createIcons();
}
