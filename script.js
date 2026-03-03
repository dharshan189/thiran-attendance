/* Thiran Attendance Tracker - Pure Array Concept (In-Memory Only) */
const EMPLOYEES_LIST = ['Mogesh', 'Hari Haran', 'Mukunthan', 'Prakathesh', 'Rahav V K', 'Lohidharani G S', 'Shaik Nabeela Rayees  ', 'Keerthana P S'];

let currentUser = null;
let attendanceRecordsArray = []; // Primary Storage: Array Concept
let activeMeetLink = '';
let conductedCount = 0;
let isTracking = false;
let trackerTimer = 0;
let trackingInterval = null;
let isInputActive = false;

// INIT
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    setInterval(refreshUI, 2000); // UI Refresh only
    lucide.createIcons();

    // wire up manual attendance buttons
    const presentBtn = document.getElementById('mark-present-btn');
    const absentBtn = document.getElementById('mark-absent-btn');
    if (presentBtn) {
        presentBtn.onclick = () => {
            const emp = document.getElementById('manual-emp-select').value;
            const meet = parseInt(document.getElementById('manual-meet-index').value, 10);
            manualAttendance(emp, meet, true);
        };
    }
    if (absentBtn) {
        absentBtn.onclick = () => {
            const emp = document.getElementById('manual-emp-select').value;
            const meet = parseInt(document.getElementById('manual-meet-index').value, 10);
            manualAttendance(emp, meet, false);
        };
    }

    window.addEventListener('beforeunload', (e) => {
        if (isTracking) {
            e.preventDefault();
            e.returnValue = 'Attendance tracking is in progress. Closing this tab will mark you as ABSENT. Continue?';
        }
    });
});

function refreshUI() {
    if (currentUser) {
        if (currentUser.role === 'admin') {
            if (document.getElementById('admin-view')) renderAdmin();
        } else if (currentUser.role === 'employee') {
            if (document.getElementById('employee-view')) renderEmployee();
        }
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
                'rahav': 'Rahav V K', 'lohith': 'Lohidharani G S', 'nabeela': 'Shaik Nabeela Rayees  ', 'keerthana': 'Keerthana P S'
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

// ADMIN CORE
function renderAdmin() {
    const head = document.getElementById('table-headers');
    // ensure manual attendance select is populated each time admin view renders
    populateManualAttendance();
    const body = document.getElementById('table-body');
    const linkInput = document.getElementById('meet-link-input');
    const postBtn = document.getElementById('post-btn');
    const terminateBtn = document.getElementById('terminate-btn');
    const glassCard = document.getElementById('broadcast-card');

    const presentCount = EMPLOYEES_LIST.filter(emp => attendanceRecordsArray.some(r => r.name === emp && r.sessionIndex === conductedCount)).length;

    if (activeMeetLink) {
        if (glassCard) {
            glassCard.style.background = 'rgba(34, 197, 94, 0.05)';
            glassCard.style.borderColor = 'rgba(34, 197, 94, 0.2)';
        }
        const broadcastTitle = document.getElementById('broadcast-title');
        if (broadcastTitle) broadcastTitle.innerHTML = `Live Session Active <span style="font-size:0.85rem; color:var(--secondary); background:rgba(34,211,238,0.1); padding:2px 8px; border-radius:6px; margin-left:10px;">${presentCount} / ${EMPLOYEES_LIST.length} ATTENDED</span>`;
        if (postBtn) postBtn.innerText = 'Update Link';
        if (terminateBtn) terminateBtn.style.display = 'flex';
        if (linkInput && !linkInput.value && !isInputActive) linkInput.value = activeMeetLink;
    } else {
        if (glassCard) {
            glassCard.style.background = 'rgba(99, 102, 241, 0.05)';
            glassCard.style.borderColor = 'rgba(99, 102, 241, 0.2)';
        }
        const broadcastTitle = document.getElementById('broadcast-title');
        if (broadcastTitle) broadcastTitle.innerText = 'Broadcast Meeting Link';
        if (postBtn) postBtn.innerText = 'Post Link';
        if (terminateBtn) terminateBtn.style.display = 'none';
    }

    if (head) {
        head.innerHTML = '<th class="sticky-col">Employee Name</th>';
        for (let i = 1; i <= 50; i++) head.innerHTML += `<th>Meet ${i}</th>`;
    }

    body.innerHTML = '';
    EMPLOYEES_LIST.forEach(emp => {
        let row = `<tr><td class="sticky-col">${emp}</td>`;
        const empRecs = attendanceRecordsArray.filter(r => r.name === emp);
        for (let i = 0; i < 50; i++) {
            const hasAttended = empRecs.find(r => r.sessionIndex === i);
            if (hasAttended) row += `<td><span class="badge-present">Present</span></td>`;
            else if (i < conductedCount) row += `<td><span class="badge-absent">Absent</span></td>`;
            else if (i === conductedCount && activeMeetLink) row += `<td><span style="color: var(--secondary); font-size:0.7rem; font-weight:800; letter-spacing:0.05em;">TRACKING</span></td>`;
            else row += `<td><span style="opacity: 0.1; color: var(--text-muted);">—</span></td>`;
        }
        body.innerHTML += row + '</tr>';
    });
}

// EMPLOYEE CORE
function renderEmployee() {
    const status = document.getElementById('tracking-status');
    const display = document.getElementById('active-link-display');
    const linkText = document.getElementById('current-link-text');
    const joinBtn = document.getElementById('join-btn');
    const strip = document.getElementById('progress-strip');
    const hHead = document.getElementById('user-table-headers');
    const hBody = document.getElementById('user-table-body');

    if (isTracking) {
        const remaining = Math.max(0, 1200 - trackerTimer);
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        status.innerHTML = `
            <div style="background: rgba(99, 102, 241, 0.1); padding: 1rem; border-radius: 1rem; display: inline-block; margin-bottom: 1rem;">
                <span style="color: var(--secondary); font-weight: 700; font-size: 1.25rem;">${mins}m ${secs}s Remaining</span>
            </div>
            <br/>
            <span style="color: var(--text-main); font-weight: 600;">ACTIVE TRACKING IN PROGRESS</span><br/>
            <p style="font-size: 0.9rem; color: #f87171; margin-top: 0.5rem; font-weight: 600;">⚠️ DO NOT CLOSE THIS TAB OR MINIMIZE</p>
        `;
        joinBtn.innerHTML = `<i data-lucide="refresh-cw" class="spin-fast" style="margin-right:0.6rem"></i> Session Live...`;
        joinBtn.disabled = true;
        joinBtn.className = 'btn-outline';
        joinBtn.style.borderColor = 'var(--secondary)';
    } else if (activeMeetLink) {
        status.innerText = 'Admin has posted a live meeting link. Join now to start your 20-min session.';
        display.style.display = 'flex';
        linkText.innerText = activeMeetLink;
        joinBtn.innerText = 'Attend Meeting';
        joinBtn.disabled = false;
        joinBtn.className = 'btn-primary';
    } else {
        status.innerHTML = `<i data-lucide="clock" size="18" style="vertical-align: middle; margin-right: 0.5rem; opacity: 0.5;"></i> Waiting for Admin to post the meeting link...`;
        display.style.display = 'none';
        joinBtn.disabled = true;
        joinBtn.className = 'btn-primary';
        joinBtn.style.opacity = '0.5';
    }

    const myRecs = attendanceRecordsArray.filter(r => r.name === currentUser.name);
    if (hHead && hBody) {
        hHead.innerHTML = '<th class="sticky-col">Status Category</th>';
        let bodyHtml = `<td class="sticky-col">Session Result</td>`;

        for (let i = 0; i < 50; i++) {
            hHead.innerHTML += `<th>Meet ${i + 1}</th>`;
            const rec = myRecs.find(r => r.sessionIndex === i);
            if (rec) bodyHtml += `<td><span class="badge-present">Present</span></td>`;
            else if (i < conductedCount) bodyHtml += `<td><span class="badge-absent">Absent</span></td>`;
            else if (i === conductedCount && activeMeetLink) bodyHtml += `<td><span style="color:var(--primary); font-size:0.7rem; font-weight:700">TRACKING</span></td>`;
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
        } else if (i === conductedCount && activeMeetLink) {
            iconContent = '<i data-lucide="refresh-cw" class="spin-fast" size="20" style="color:var(--primary)"></i><span style="font-size:0.65rem; color:var(--primary); font-weight:700">IN PROGRESS</span>';
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

function startTracking() {
    const alreadyPresentForThisLink = attendanceRecordsArray.some(r => r.name === currentUser.name && r.meetLink === activeMeetLink);
    if (alreadyPresentForThisLink) return notify('Already attended this session!', 'red');

    isTracking = true;
    trackerTimer = 0;
    window.open(activeMeetLink, '_blank');
    notify('Background Tracking Started (20 Min Limit)', 'blue');

    trackingInterval = setInterval(() => {
        trackerTimer++;
        renderEmployee();
        if (trackerTimer >= 1200) {
            attendanceRecordsArray.push({ id: Date.now(), name: currentUser.name, status: 'Present', meetLink: activeMeetLink, sessionIndex: conductedCount });
            resetTracking();
            notify('SUCCESS! 20-min Attendance Confirmed', 'green');
            renderEmployee();
        }
    }, 1000);
    renderEmployee();
}

function resetTracking() {
    clearInterval(trackingInterval);
    isTracking = false;
    trackerTimer = 0;
}

// HELPERS
if (document.getElementById('meet-link-input')) {
    document.getElementById('meet-link-input').onfocus = () => { isInputActive = true; };
    document.getElementById('meet-link-input').onblur = () => { isInputActive = false; };
}

function updateMeetLink() {
    const link = document.getElementById('meet-link-input').value;
    if (!link.includes('meet.google.com')) return notify('Error: Invalid Google Meet link!', 'red');
    activeMeetLink = link;
    notify('Meet Link Posted Globally!', 'green');
    renderAdmin();
}

function terminateSession() {
    if (activeMeetLink) conductedCount++;
    activeMeetLink = '';
    document.getElementById('meet-link-input').value = '';
    notify('Global Media Session Ended', 'red');
    renderAdmin();
}

function resetMatrix() {
    if (confirm('CRITICAL: Delete all attendance records forever?')) {
        attendanceRecordsArray = [];
        conductedCount = 0;
        activeMeetLink = '';
        notify('Matrix Reset Successfully', 'red');
        renderAdmin();
    }
}

// Manual attendance helpers
function populateManualAttendance() {
    const select = document.getElementById('manual-emp-select');
    if (!select) return;
    select.innerHTML = '<option value="">Select Employee</option>';
    EMPLOYEES_LIST.forEach(emp => {
        select.innerHTML += `<option value="${emp}">${emp}</option>`;
    });
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
        attendanceRecordsArray.push({ id: Date.now(), name: empName, status: 'Present', meetLink: activeMeetLink || 'manual', sessionIndex: index });
    }
    // bump conductedCount if we're marking a future session
    if (index >= conductedCount) {
        conductedCount = index + 1;
    }
    notify(`Manual attendance ${present ? 'added' : 'cleared'} for ${empName} (Meet ${meetNum})`, present ? 'green' : 'red');
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
            else if (i === conductedCount && activeMeetLink) tableHtml += '<td>Tracking</td>';
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
