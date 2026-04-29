

const supabaseUrl = 'https://samuyhnccbblehzqhmqb.supabase.co'
const supabaseKey = 'sb_publishable_-IGbDnjMiurLnF4s1-LIrg_hCp7R_J7'

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey)

// ================== GLOBAL VARIABLES ==================
const ALL_EMPLOYEES = [
    { name: "Lohidharani G S", username: "lohidharani", role: "HR Admin, Student Community Manager" },
    { name: "Brundavanam Bose", username: "bose", role: "Project Manager" },
    { name: "Mukunthan S", username: "mukunthan", role: "Ui/UX Designer" },
    { name: "Akash M", username: "akash", role: "Digital Media Manager" },
    { name: "Prakathesh C", username: "prakathesh", role: "Frontend Developer" },
    { name: "Kanmani G", username: "kanmani", role: "Quality Assurance Tester" },
    { name: "Shaik Nabeela Rayees", username: "shaik", role: "Backend Developer" },
    { name: "Arpit Kumar", username: "arpit", role: "Business Development manager" },
    { name: "P S Keerthana", username: "keerthana", role: "AI/ML Developer" },
    { name: "Mogesh J", username: "mogesh", role: "Data Analyst" },
    { name: "Navasri N", username: "navasri", role: "Content & Communication manager" },
    { name: "Nishanthini S", username: "nishanthini", role: "Event Coordinator" },
    { name: "Rahav V K", username: "rahav", role: "Product manager" },
    { name: "Samuel Ignatius", username: "samuel", role: "Junior Fullsatck developer" },
    { name: "Hari Haran V", username: "hari", role: "Research & Development Manager" }
];

let attendanceRecordsArray = []
let tasksArray = []
let conductedCount = 0

let currentUser = null
let currentRole = null

/** @type {Record<string, number> | null} name -> sort_order (1-based); null = use alphabetical */
let boosterPositionsCache = null
/** @type {string[] | null} admin-only draft order for the editor */
let adminBoosterDraftOrder = null

let _lastLiveSyncAt = 0
const LIVE_SYNC_MIN_INTERVAL_MS = 2500

/** Reload from Supabase and repaint (logged-in only). Debounced to avoid API spam when switching tabs. */
async function syncLiveDataFromServer() {
    if (!currentRole) return
    const now = Date.now()
    if (now - _lastLiveSyncAt < LIVE_SYNC_MIN_INTERVAL_MS) return
    _lastLiveSyncAt = now

    if (currentRole === 'employee' && currentUser) {
        await refreshEmployeeDashboard()
        return
    }
    if (currentRole === 'admin') {
        await loadData()
        await loadBoosterPositionsFromServer()
        renderAdmin()
        renderAdminTasks()
        renderUserTasks()
    }
}

function initLiveDataSync() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') syncLiveDataFromServer()
    })
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) syncLiveDataFromServer()
    })
    window.addEventListener('focus', () => {
        if (document.visibilityState === 'visible') syncLiveDataFromServer()
    })
    window.addEventListener('online', () => syncLiveDataFromServer())
}


// ================== LOAD DATA ==================
async function loadData() {
    try {
        const { data: attendance, error: err1 } = await supabaseClient.from('attendance')
            .select('*')

        const { data: tasks, error: err2 } = await supabaseClient.from('tasks')
            .select('*')

        if (err1) console.error(err1)
        if (err2) console.error(err2)

        attendanceRecordsArray = attendance || []
        tasksArray = tasks || []

        conductedCount = Math.max(
            0,
            ...attendanceRecordsArray.map(r => (r.sessionIndex || 0) + 1)
        )

    } catch (err) {
        console.error("Load error:", err)
    }
}


/** Supabase: CREATE TABLE booster_positions (name text PRIMARY KEY, sort_order int NOT NULL); */
async function loadBoosterPositionsFromServer() {
    const { data, error } = await supabaseClient.from('booster_positions').select('name, sort_order')
    if (error) {
        console.warn('booster_positions:', error.message)
        boosterPositionsCache = null
        return
    }
    boosterPositionsCache = {}
        ; (data || []).forEach(row => {
            boosterPositionsCache[row.name] = row.sort_order
        })
}


// ================== ATTENDANCE ==================
async function writeAttendanceRecord(empName, meetNum, present) {
    const index = Number(meetNum) - 1
    const { error: delErr } = await supabaseClient.from('attendance')
        .delete()
        .eq('name', empName)
        .eq('sessionIndex', index)
    if (delErr) throw delErr

    const { error: insErr } = await supabaseClient.from('attendance').insert([
        {
            name: empName,
            status: present ? 'Present' : 'Absent',
            sessionIndex: index
        }
    ])
    if (insErr) throw insErr
}


async function manualAttendance(empName, meetNum, present) {
    if (!empName) return alert("Select employee")
    if (!meetNum) return alert("Enter meeting number")

    await writeAttendanceRecord(empName, meetNum, present)

    await loadData()
    renderAdmin()
}


/** For one session: Mark Present → selected = Present, everyone else = Absent. Mark Absent → all = Absent. */
async function applySessionAttendanceForAll(meetNum, mode) {
    const num = meetNum != null && meetNum !== '' ? String(meetNum).trim() : ''
    if (!num) {
        alert("Enter meeting number")
        return
    }

    const sessionIndex = parseInt(num, 10) - 1
    if (Number.isNaN(sessionIndex) || sessionIndex < 0) {
        alert("Invalid meeting number")
        return
    }

    const selected = new Set(
        Array.from(document.querySelectorAll("#emp-dropdown .emp-checkbox:checked")).map(el => el.value)
    )

    const markP = document.getElementById("mark-present-btn")
    const markA = document.getElementById("mark-absent-btn")
    const setBusy = (busy) => {
        if (markP) markP.disabled = busy
        if (markA) markA.disabled = busy
    }

    setBusy(true)
    try {
        for (const empObj of ALL_EMPLOYEES) {
            const present = mode === 'present' && selected.has(empObj.name)
            await writeAttendanceRecord(empObj.name, num, present)
        }
        await loadData()
        renderAdmin()
        if (typeof Toastify !== 'undefined') {
            Toastify({ text: "Attendance saved", style: { background: "green" } }).showToast()
        }
    } catch (e) {
        console.error(e)
        const msg = e?.message || e?.error_description || JSON.stringify(e) || String(e)
        alert("Could not save attendance. Check Supabase policies and the attendance table columns.\n\n" + msg)
    } finally {
        setBusy(false)
    }
}


function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result)
        r.onerror = () => reject(new Error('Could not read file'))
        r.readAsDataURL(file)
    })
}


/** DB columns (add in Supabase if missing): assignment_pdf text, assignment_file_name text */
function buildTaskRow(user, text, week, assignmentPdf, assignmentFileName) {
    const row = {
        user: user,
        text: text,
        week: week,
        status: 'Pending',
        timestamp: new Date().toISOString()
    }
    if (assignmentPdf && assignmentFileName) {
        row.assignment_pdf = assignmentPdf
        row.assignment_file_name = assignmentFileName
    }
    return row
}


async function insertTaskRows(rows) {
    const { error } = await supabaseClient.from('tasks').insert(rows)
    if (error) {
        console.error(error)
        alert('Could not create task(s): ' + (error.message || '') + '\n\nIf needed, add columns assignment_pdf (text) and assignment_file_name (text) to table tasks.')
        throw error
    }
}


async function addTask(user, text, week, assignmentPdf, assignmentFileName) {
    if (!user || !text) return alert("Fill all fields")

    await insertTaskRows([buildTaskRow(user, text, week, assignmentPdf, assignmentFileName)])
    await loadData()
    renderAdminTasks()
}


// ================== UPDATE TASK ==================
async function updateTaskStatus(id, status) {
    await supabaseClient.from('tasks')
        .update({ status: status })
        .eq('id', id)

    await loadData()
    renderAdminTasks()
}


// ================== DELETE TASK ==================
async function deleteTask(id) {
    await supabaseClient.from('tasks')
        .delete()
        .eq('id', id)

    await loadData()
    renderAdminTasks()
}


// ================== SUBMIT TASK FILE ==================
async function submitTaskFile(taskId, file) {
    const reader = new FileReader()

    reader.onload = async function (e) {
        const { error } = await supabaseClient.from('tasks')
            .update({
                status: 'Submitted',
                proof: e.target.result,
                assignment_file_name: file.name,
                completionTime: Date.now()
            })
            .eq('id', taskId)

        if (error) {
            console.error(error)
            alert('Could not upload proof: ' + (error.message || ''))
            return
        }

        await loadData()
        renderUserTasks()
        renderAdminTasks()
        if (typeof Toastify !== 'undefined') Toastify({ text: 'Proof uploaded', style: { background: 'green' } }).showToast()
    }

    reader.onerror = () => alert('Could not read the selected file')
    reader.readAsDataURL(file)
}


function employeeScorePercent(empName) {
    let score = 100;
    let maxSession = Math.max(0, ...attendanceRecordsArray.map(r => r.sessionIndex || 0));
    let hasBeenAbsent = false;

    for (let i = 0; i <= maxSession; i++) {
        const rec = attendanceRecordsArray.find(r => r.name === empName && r.sessionIndex === i);
        if (rec) {
            if (rec.status === "Absent") {
                score -= 6;
                hasBeenAbsent = true;
            } else if (rec.status === "Present" && hasBeenAbsent) {
                score += 2.5;
            }
        }
    }

    // Ensure score is clamped between 0 and 100 and clean up decimals
    const finalScore = Math.max(0, Math.min(100, score));
    return Number.isInteger(finalScore) ? finalScore : parseFloat(finalScore.toFixed(1));
}


// ================== RENDER ADMIN ATTENDANCE ==================
function renderMatrix() {
    const headers = document.getElementById("table-headers")
    const body = document.getElementById("table-body")
    if (!headers || !body) return

    let maxSession = Math.max(0, ...attendanceRecordsArray.map(r => r.sessionIndex || 0))

    let htmlHeader = "<th>Employee Name</th><th>Role</th>"
    for (let i = 0; i <= maxSession; i++) htmlHeader += `<th>Session ${i + 1}</th>`
    htmlHeader += "<th>Performance %</th>"
    headers.innerHTML = htmlHeader

    let htmlBody = ""
    ALL_EMPLOYEES.forEach(empObj => {
        let emp = empObj.name
        let score = employeeScorePercent(emp)
        let rowHtml = `<td>${emp}</td><td><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(empObj.role || '')}</span></td>`
        for (let i = 0; i <= maxSession; i++) {
            const rec = attendanceRecordsArray.find(r => r.name === emp && r.sessionIndex === i)
            if (rec && rec.status === "Present") {
                rowHtml += "<td style='color:green; font-weight:bold;'>✔ Present</td>"
            } else if (rec && rec.status === "Absent") {
                rowHtml += "<td style='color:red; font-weight:bold;'>✘ Absent</td>"
            } else {
                rowHtml += "<td style='color:gray;'>-</td>"
            }
        }
        rowHtml += `<td><span style="padding: 4px 8px; border-radius:4px; font-weight:bold; background:${score >= 80 ? 'rgba(34, 197, 94, 0.2)' : score >= 60 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'};">${score}%</span></td>`
        htmlBody += `<tr>${rowHtml}</tr>`
    })
    body.innerHTML = htmlBody
}


function updateSummaryStats() {
    const totalEmpEl = document.getElementById("stat-total-emp")
    if (totalEmpEl) totalEmpEl.innerText = ALL_EMPLOYEES.length

    const scores = ALL_EMPLOYEES.map(e => employeeScorePercent(e.name))
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100
    const statAvg = document.getElementById("stat-avg-pct")
    if (statAvg) statAvg.innerText = `${avg}%`

    const critical = scores.filter(s => s < 60).length
    const statCritical = document.getElementById("stat-critical")
    if (statCritical) statCritical.innerText = String(critical)
}


function renderAdmin() {
    renderMatrix()
    updateSummaryStats()
    renderBoosterTables()
    renderAdminBoosterEditorPanel()
}


function renderEmployeeAttendance() {
    const headers = document.getElementById("user-table-headers")
    const body = document.getElementById("user-table-body")
    const strip = document.getElementById("progress-strip")
    if (!headers || !body || !strip) return

    if (!currentUser || currentRole !== "employee") {
        headers.innerHTML = ""
        body.innerHTML = ""
        strip.innerHTML = ""
        return
    }

    const emp = currentUser
    let maxSession = Math.max(0, ...attendanceRecordsArray.map(r => r.sessionIndex || 0))

    let htmlHeader = "<th>Player</th>"
    for (let i = 0; i <= maxSession; i++) htmlHeader += `<th>Session ${i + 1}</th>`
    htmlHeader += "<th>Performance %</th>"
    headers.innerHTML = htmlHeader

    let score = employeeScorePercent(emp)
    let rowHtml = `<td style="text-align:left !important; font-weight:700;">${escapeHtml(emp)}</td>`
    for (let i = 0; i <= maxSession; i++) {
        const rec = attendanceRecordsArray.find(r => r.name === emp && r.sessionIndex === i)
        if (rec && rec.status === "Present") {
            rowHtml += "<td style='color:green; font-weight:bold;'>✔ Present</td>"
        } else if (rec && rec.status === "Absent") {
            rowHtml += "<td style='color:red; font-weight:bold;'>✘ Absent</td>"
        } else {
            rowHtml += "<td style='color:gray;'>-</td>"
        }
    }
    rowHtml += `<td><span style="padding: 4px 8px; border-radius:4px; font-weight:bold; background:${score >= 80 ? 'rgba(34, 197, 94, 0.2)' : score >= 60 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color:${score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'};">${score}%</span></td>`
    body.innerHTML = `<tr>${rowHtml}</tr>`

    let stripHtml = ""
    for (let i = 0; i <= maxSession; i++) {
        const rec = attendanceRecordsArray.find(r => r.name === emp && r.sessionIndex === i)
        let label = "—"
        let extraClass = ""
        if (rec && rec.status === "Present") {
            label = "✔"
            extraClass = " active"
        } else if (rec && rec.status === "Absent") {
            label = "✘"
            extraClass = " strip-absent"
        }
        stripHtml += `<div class="progress-item${extraClass}" title="Session ${i + 1}: ${rec ? rec.status : "Not marked"}">
            <span style="font-size:1.35rem;font-weight:800;">${label}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);font-weight:700;">S${i + 1}</span>
        </div>`
    }
    strip.innerHTML = stripHtml || '<p style="color:var(--text-muted);font-size:0.9rem;">No sessions yet.</p>'
}


async function refreshEmployeeDashboard() {
    await loadData()
    if (currentRole !== "employee" || !currentUser) return
    const badge = document.getElementById("user-pct-badge")
    if (badge) badge.innerText = `${employeeScorePercent(currentUser)}%`
    const ptsBadge = document.getElementById("user-pts-badge")
    if (ptsBadge) ptsBadge.innerText = getSessionBreakdown(currentUser).pts
    await loadBoosterPositionsFromServer()
    renderEmployeeAttendance()
    renderBoosterTables()
    renderUserTasks()
}


// ================== BOOSTER LEAGUE (IPL-style points table, A–Z) ==================
function getSessionBreakdown(empName) {
    let maxSession = Math.max(0, ...attendanceRecordsArray.map(r => r.sessionIndex || 0))
    const P = maxSession + 1
    let W = 0
    let L = 0
    let NR = 0
    for (let i = 0; i <= maxSession; i++) {
        const rec = attendanceRecordsArray.find(r => r.name === empName && r.sessionIndex === i)
        if (rec && rec.status === 'Present') W++
        else if (rec && rec.status === 'Absent') L++
        else NR++
    }
    const pts = 2 * W
    const nrr = P > 0 ? (W - L) / P : 0
    return { P, W, L, NR, pts, nrr }
}


function formatNrr(n) {
    const sign = n >= 0 ? '+' : ''
    return sign + n.toFixed(3)
}


// ================== RENDER ADMIN TASKS ==================
function escapeHtml(str) {
    if (str == null) return ''
    const d = document.createElement('div')
    d.textContent = String(str)
    return d.innerHTML
}


function getOrderedEmployees() {
    if (!boosterPositionsCache || Object.keys(boosterPositionsCache).length === 0) {
        return [...ALL_EMPLOYEES].sort((a, b) => a.name.localeCompare(b.name))
    }
    return [...ALL_EMPLOYEES].sort((a, b) => {
        const oa = boosterPositionsCache[a.name] ?? 100000
        const ob = boosterPositionsCache[b.name] ?? 100000
        if (oa !== ob) return oa - ob
        return a.name.localeCompare(b.name)
    })
}


function buildBoosterTableHtml(highlightName) {
    const sorted = getOrderedEmployees()
    let rows = ''
    sorted.forEach((emp, idx) => {
        const { P, W, L, NR, pts, nrr } = getSessionBreakdown(emp.name)
        const perf = employeeScorePercent(emp.name)
        const isYou = highlightName && emp.name === highlightName
        const rowClass = isYou ? 'booster-row-self' : ''
        rows += `<tr class="${rowClass}">
            <td class="booster-pos">${idx + 1}</td>
            <td class="booster-team">
                <div style="font-weight:700;">${escapeHtml(emp.name)}</div>
                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:400;">${escapeHtml(emp.role || '')}</div>
            </td>
            <td class="booster-num">${P}</td>
            <td class="booster-num">${W}</td>
            <td class="booster-num">${L}</td>
            <td class="booster-num">${NR}</td>
            <td class="booster-num booster-pts">${pts}</td>
            <td class="booster-num booster-nrr">${formatNrr(nrr)}</td>
            <td class="booster-num booster-form">${perf}%</td>
        </tr>`
    })
    return `<div class="booster-ipl-wrap">
        <table class="booster-ipl-table">
            <thead>
                <tr>
                    <th scope="col">Pos</th>
                    <th scope="col">Players</th>
                    <th scope="col">P</th>
                    <th scope="col">W</th>
                    <th scope="col">L</th>
                    <th scope="col">NR</th>
                    <th scope="col">Pts</th>
                    <th scope="col">NRR</th>
                    <th scope="col">Form</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`
}


function renderBoosterTables() {
    const mainEl = document.getElementById('main-booster-list')
    if (mainEl) {
        const highlight = currentRole === 'employee' ? currentUser : null
        mainEl.innerHTML = buildBoosterTableHtml(highlight)
    }
}


function renderAdminBoosterEditorPanel() {
    const container = document.getElementById('admin-booster-editor')
    if (!container) return
    if (currentRole !== 'admin') {
        container.style.display = 'none'
        return
    }
    container.style.display = 'block'
    
    if (!adminBoosterDraftOrder) {
        adminBoosterDraftOrder = getOrderedEmployees().map(e => e.name)
    }

    const listHtml = adminBoosterDraftOrder.map((name, idx) => {
        return `<div class="booster-editor-row" 
                     draggable="true" 
                     data-index="${idx}"
                     style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); cursor:grab; background:rgba(255,255,255,0.02);">
            <div style="display:flex; align-items:center; gap:1rem;">
              <span style="color:var(--text-muted); font-size:0.8rem; font-family:monospace; width:20px;">${idx + 1}</span>
              <span style="font-weight:600;">${name}</span>
            </div>
            <span style="color:var(--text-muted); font-size:1.2rem;">⋮⋮</span>
        </div>`
    }).join('')

    container.innerHTML = `
        <div style="padding:1.25rem; background:rgba(251, 191, 36, 0.05); border-bottom:1px solid rgba(251, 191, 36, 0.1); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h4 style="margin:0; color:#fbbf24; font-size:1.1rem; font-weight:700;">Reorder League Standings</h4>
            <p style="margin:0.25rem 0 0 0; font-size:0.8rem; color:var(--text-muted);">Drag and drop names to adjust positions</p>
          </div>
          <div style="display:flex; gap:0.75rem;">
            <button onclick="resetBoosterOrderDraft()" class="btn-outline" style="padding:0.5rem 1rem; font-size:0.85rem; border-color:rgba(255,255,255,0.1);">Reset</button>
            <button onclick="saveBoosterOrder()" class="btn-primary" style="padding:0.5rem 1.25rem; font-size:0.85rem; background:#fbbf24; color:#000;">Save New Order</button>
          </div>
        </div>
        <div id="booster-drag-list" style="max-height:400px; overflow-y:auto;">
          ${listHtml}
        </div>
    `

    const rows = container.querySelectorAll('.booster-editor-row')
    rows.forEach(row => {
        row.addEventListener('dragstart', handleBoosterDragStart)
        row.addEventListener('dragover', handleBoosterDragOver)
        row.addEventListener('drop', handleBoosterDrop)
        row.addEventListener('dragend', handleBoosterDragEnd)
    })
}

let draggedIdx = null

function handleBoosterDragStart(e) {
    draggedIdx = parseInt(this.getAttribute('data-index'))
    this.style.opacity = '0.4'
    e.dataTransfer.effectAllowed = 'move'
}

function handleBoosterDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const targetRow = e.target.closest('.booster-editor-row')
    if (targetRow) {
        targetRow.style.borderTop = '2px solid #fbbf24'
    }
}

function handleBoosterDragEnd(e) {
    this.style.opacity = '1'
    const rows = document.querySelectorAll('.booster-editor-row')
    rows.forEach(row => row.style.borderTop = '')
}

function handleBoosterDrop(e) {
    e.preventDefault()
    const targetRow = e.target.closest('.booster-editor-row')
    if (!targetRow) return
    
    const targetIdx = parseInt(targetRow.getAttribute('data-index'))
    if (draggedIdx === targetIdx) return

    const item = adminBoosterDraftOrder.splice(draggedIdx, 1)[0]
    adminBoosterDraftOrder.splice(targetIdx, 0, item)
    
    renderAdminBoosterEditorPanel()
}


function boosterMoveOrder(index, delta) {
    if (currentRole !== 'admin' || !adminBoosterDraftOrder) return
    const arr = [...adminBoosterDraftOrder]
    const j = index + delta
    if (j < 0 || j >= arr.length) return
        ;[arr[index], arr[j]] = [arr[j], arr[index]]
    adminBoosterDraftOrder = arr
    renderAdminBoosterEditorPanel()
}


function resetBoosterOrderDraft() {
    if (currentRole !== 'admin') return
    adminBoosterDraftOrder = [...ALL_EMPLOYEES].sort((a, b) => a.name.localeCompare(b.name)).map(e => e.name)
    renderAdminBoosterEditorPanel()
}


async function saveBoosterOrder() {
    if (currentRole !== 'admin' || !adminBoosterDraftOrder) return
    const rows = adminBoosterDraftOrder.map((name, i) => ({ name, sort_order: i + 1 }))
    const { error } = await supabaseClient.from('booster_positions').upsert(rows, { onConflict: 'name' })
    if (error) {
        console.error(error)
        alert('Could not save order. In Supabase, create table: booster_positions (name text PRIMARY KEY, sort_order int NOT NULL), and allow insert/update for anon key.\n\n' + error.message)
        return
    }
    boosterPositionsCache = {}
    rows.forEach(r => { boosterPositionsCache[r.name] = r.sort_order })
    renderBoosterTables()
    renderAdminBoosterEditorPanel()
    if (typeof Toastify !== 'undefined') Toastify({ text: 'Booster order saved for all employees', style: { background: 'green' } }).showToast()
}


function renderAdminTasks() {
    const container = document.getElementById("admin-task-list")
    if (!container) return

    container.innerHTML = ""

    tasksArray.forEach(t => {
        const div = document.createElement("div")
        const safeText = escapeHtml(t.text)
        const tid = String(t.id).replace(/'/g, "\\'")
        const hasAssign = !!taskAssignmentUrl(t)
        const hasProof = !!taskProofUrl(t)
        const assignName = escapeHtml(taskAssignmentName(t))
        const proofName = escapeHtml(taskProofFileName(t))

        const assignRow = hasAssign ? `
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-top:0.5rem;">
                <span style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;width:100%;">Assignment file</span>
                <button type="button" class="btn-primary" style="padding:0.45rem 0.9rem;font-size:0.8rem;" onclick="openTaskAssignmentPdf('${tid}')">View</button>
                <button type="button" class="btn-outline" style="padding:0.45rem 0.9rem;font-size:0.8rem;" onclick="downloadTaskAssignmentPdf('${tid}')">Download (${assignName})</button>
            </div>` : `
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">No assignment file attached.</div>`

        const proofRow = hasProof ? `
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-top:0.65rem;padding-top:0.65rem;border-top:1px solid rgba(255,255,255,0.06);">
                <span style="font-size:0.72rem;font-weight:700;color:#f472b6;text-transform:uppercase;width:100%;">Employee proof</span>
                <button type="button" class="btn-primary" style="padding:0.45rem 0.9rem;font-size:0.8rem;background:rgba(244,114,182,0.15);color:#f9a8d4;border:1px solid rgba(244,114,182,0.35);" onclick="openTaskSubmissionProof('${tid}')">View proof</button>
                <button type="button" class="btn-outline" style="padding:0.45rem 0.9rem;font-size:0.8rem;border-color:#f472b6;color:#f472b6;" onclick="downloadTaskSubmissionProof('${tid}')">Download (${proofName})</button>
            </div>` : `
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.65rem;padding-top:0.65rem;border-top:1px solid rgba(255,255,255,0.06);">No employee proof submitted yet.</div>`

        div.innerHTML = `
            <div class="glass-card" style="padding:1.1rem 1.25rem;border:1px solid var(--card-border);margin:0;">
                <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:0.75rem;align-items:flex-start;">
                    <div>
                        <p style="margin:0;font-weight:700;font-size:1rem;">${escapeHtml(t.user)}</p>
                        <p style="margin:0.35rem 0 0;font-size:0.8rem;color:var(--text-muted);">Week ${escapeHtml(String(t.week))} · <strong>${escapeHtml(t.status)}</strong></p>
                    </div>
                    <div style="display:flex;gap:0.5rem;flex-shrink:0;">
                        <button type="button" class="btn-outline" style="padding:0.45rem 0.75rem;font-size:0.8rem;" onclick="updateTaskStatus('${tid}','Completed')">✔ Complete</button>
                        <button type="button" class="btn-outline" style="padding:0.45rem 0.75rem;font-size:0.8rem;border-color:#ef4444;color:#ef4444;" onclick="deleteTask('${tid}')">Delete</button>
                    </div>
                </div>
                <div style="margin-top:0.75rem;line-height:1.5;font-size:0.92rem;">${safeText}</div>
                ${assignRow}
                ${proofRow}
            </div>
        `
        container.appendChild(div)
    })
}


// ================== RENDER USER TASKS ==================
function renderUserTasks() {
    const container = document.getElementById("user-task-list")
    if (!container) return

    container.innerHTML = ""

    const mine = currentUser
        ? tasksArray.filter(t => t.user === currentUser)
        : []

    mine.forEach(t => {
        const div = document.createElement("div")
        const safeText = escapeHtml(t.text)
        const tid = String(t.id).replace(/'/g, "\\'")
        const domId = String(t.id).replace(/[^a-zA-Z0-9]/g, '')
        const hasAssign = !!taskAssignmentUrl(t)
        const assignName = escapeHtml(taskAssignmentName(t))
        const hasProof = !!taskProofUrl(t)
        const proofF = escapeHtml(taskProofFileName(t))
        const assignBtns = hasAssign ? `
            <div style="display:flex;flex-wrap:wrap;gap:0.65rem;align-items:center;margin:0.75rem 0 1rem;">
                <button type="button" class="btn-primary" style="padding:0.5rem 1rem;font-size:0.85rem;" onclick="openTaskAssignmentPdf('${tid}')">View assignment</button>
                <button type="button" class="btn-outline" style="padding:0.5rem 1rem;font-size:0.85rem;" onclick="downloadTaskAssignmentPdf('${tid}')">Download (${assignName})</button>
            </div>
        ` : ''
        const myProofBtns = hasProof ? `
            <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.65rem;">
                <span style="font-size:0.75rem;color:#f472b6;font-weight:700;text-transform:uppercase;">Your submission</span>
                <button type="button" class="btn-outline" style="padding:0.45rem 0.85rem;font-size:0.8rem;" onclick="openTaskSubmissionProof('${tid}')">View</button>
                <button type="button" class="btn-outline" style="padding:0.45rem 0.85rem;font-size:0.8rem;" onclick="downloadTaskSubmissionProof('${tid}')">Download (${proofF})</button>
            </div>
        ` : ''
        div.innerHTML = `
            <div class="glass-card" style="padding:1.25rem 1.5rem;margin-bottom:0;border:1px solid var(--card-border);">
                <p style="margin:0 0 0.5rem;font-size:0.8rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">Week ${escapeHtml(String(t.week))} · ${escapeHtml(t.status)}</p>
                <div style="line-height:1.55;margin-bottom:0.5rem;">${safeText}</div>
                ${assignBtns}
                ${myProofBtns}
                <div style="border-top:1px solid var(--card-border);padding-top:0.85rem;margin-top:0.25rem;" class="user-proof-upload">
                    <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:0.5rem;font-weight:600;">Upload proof of completion</label>
                    <input type="file" id="userproof_${domId}" style="display:none;" accept="*/*" onchange="handleFileUpload('${tid}', this); syncUserProofLabel('userproof_${domId}')">
                    <div style="display:flex;flex-wrap:wrap;gap:0.65rem;align-items:center;">
                        <button type="button" class="btn-primary" style="padding:0.55rem 1.1rem;font-size:0.88rem;" onclick="document.getElementById('userproof_${domId}').click()">📤 Choose file &amp; upload</button>
                        <span id="userprooflabel_${domId}" class="user-proof-filename" style="font-size:0.82rem;color:var(--text-muted);">No file chosen — pick a file to upload</span>
                    </div>
                </div>
            </div>
        `
        container.appendChild(div)
    })
}


// ================== FILE HANDLER ==================
function handleFileUpload(taskId, input) {
    const file = input.files[0]
    if (!file) return

    submitTaskFile(taskId, file)
}


function syncUserProofLabel(inputId) {
    const input = document.getElementById(inputId)
    if (!input || !input.files?.[0]) return
    const domId = inputId.replace('userproof_', '')
    const span = document.getElementById(`userprooflabel_${domId}`)
    if (span) span.textContent = `Selected: ${input.files[0].name} — uploading…`
}


function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => {
        if (v) v.style.display = 'none'
    })
    const view = document.getElementById(viewId)
    if (view) {
        view.style.display = viewId === 'login-view' ? 'flex' : 'block'
    }
    
    // Auto-render logic for specific views
    if (viewId === 'booster-league-view') {
        renderBoosterTables()
        renderAdminBoosterEditorPanel()
    }
    if (viewId === 'admin-tasks-view') {
        renderAdminTaskList()
    }
}


function logout() {
    currentUser = null
    currentRole = null
    adminBoosterDraftOrder = null
    showView('login-view')
    const form = document.getElementById('login-form')
    if (form) form.reset()
    renderAdminBoosterEditorPanel()

    // Reset sidebar state
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');

    if (typeof Toastify !== 'undefined') Toastify({ text: "Logged out", style: { background: "blue" } }).showToast()
}


function taskAssignmentUrl(t) {
    return t?.assignment_pdf ?? t?.assignmentPdf ?? null
}


function taskAssignmentName(t) {
    return t?.assignment_file_name ?? t?.assignmentFileName ?? 'assignment.pdf'
}


function taskProofUrl(t) {
    return t?.proof ?? null
}


function taskProofFileName(t) {
    return t?.assignment_file_name ?? t?.assignmentFileName ?? t?.fileName ?? t?.file_name ?? 'submission'
}


function openTaskSubmissionProof(taskId) {
    const task = tasksArray.find(x => String(x.id) === String(taskId))
    if (!task) return
    const url = taskProofUrl(task)
    if (!url) {
        alert('No proof uploaded for this task yet.')
        return
    }
    openProofModal(url, taskProofFileName(task))
}


function downloadTaskSubmissionProof(taskId) {
    const task = tasksArray.find(x => String(x.id) === String(taskId))
    if (!task) return
    const url = taskProofUrl(task)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = taskProofFileName(task)
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
}


function openProofModal(dataUrl, filename) {
    const modal = document.getElementById('proof-modal')
    const area = document.getElementById('modal-content-area')
    const fnEl = document.getElementById('modal-filename')
    const dl = document.getElementById('modal-download')
    if (!modal || !area) return

    const name = filename || 'Assignment.pdf'
    if (fnEl) fnEl.textContent = name

    const isPdf = dataUrl.startsWith('data:application/pdf') || name.toLowerCase().endsWith('.pdf')
    const isText = dataUrl.startsWith('data:text/plain') || name.toLowerCase().endsWith('.txt')

    if (isPdf) {
        area.innerHTML = `<iframe title="PDF" src="${dataUrl.replace(/"/g, '&quot;')}" style="width:100%;min-height:75vh;border:0;border-radius:0.5rem;background:#111;"></iframe>`
    } else if (isText) {
        try {
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : ''
            const bin = atob(base64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            const txt = new TextDecoder('utf-8').decode(bytes)
            area.innerHTML = `<pre style="white-space:pre-wrap;color:var(--text-main);text-align:left;width:100%;max-height:75vh;overflow:auto;padding:1rem;background:#0a0a0a;border-radius:0.5rem;border:1px solid var(--card-border);">${escapeHtml(txt)}</pre>`
        } catch {
            area.innerHTML = `<iframe title="Document" src="${dataUrl.replace(/"/g, '&quot;')}" style="width:100%;min-height:75vh;border:0;border-radius:0.5rem;background:#111;"></iframe>`
        }
    } else {
        area.innerHTML = `<iframe title="Document" src="${dataUrl.replace(/"/g, '&quot;')}" style="width:100%;min-height:75vh;border:0;border-radius:0.5rem;background:#111;"></iframe>`
    }

    if (dl) {
        dl.href = dataUrl
        dl.setAttribute('download', name)
    }
    modal.style.display = 'flex'
}


function openTaskAssignmentPdf(taskId) {
    const task = tasksArray.find(x => String(x.id) === String(taskId))
    if (!task) return
    const url = taskAssignmentUrl(task)
    if (!url) {
        alert('No assignment file on this task.')
        return
    }
    openProofModal(url, taskAssignmentName(task))
}


function downloadTaskAssignmentPdf(taskId) {
    const task = tasksArray.find(x => String(x.id) === String(taskId))
    if (!task) return
    const url = taskAssignmentUrl(task)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = taskAssignmentName(task)
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
}


function closeProof() {
    const modal = document.getElementById('proof-modal')
    const area = document.getElementById('modal-content-area')
    if (area) area.innerHTML = ''
    if (modal) modal.style.display = 'none'
}


async function resetMatrix() {
    if (!confirm('Delete all attendance records from the database?')) return
    const { error } = await supabaseClient.from('attendance').delete().gte('sessionIndex', 0)
    if (error) {
        console.error(error)
        alert('Could not reset: ' + (error.message || 'unknown error'))
        return
    }
    await loadData()
    renderAdmin()
    if (typeof Toastify !== 'undefined') Toastify({ text: "Attendance data cleared", style: { background: "green" } }).showToast()
}


function downloadSheet() {
    const headers = document.getElementById("table-headers")
    const body = document.getElementById("table-body")
    if (!headers || !body) {
        alert('No table to export')
        return
    }
    const headCells = Array.from(headers.querySelectorAll('th')).map(th => `"${th.innerText.replace(/"/g, '""')}"`)
    const rows = Array.from(body.querySelectorAll('tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => `"${td.innerText.replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(',')
    )
    const csv = [headCells.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-matrix-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
}


function initTaskWeekSelect() {
    const sel = document.getElementById('task-week-select')
    if (!sel || sel.options.length) return
    for (let w = 1; w <= 100; w++) {
        const opt = document.createElement('option')
        opt.value = String(w)
        opt.textContent = `Week ${w}`
        sel.appendChild(opt)
    }
}


function updateAttendanceEmpDropdownLabel() {
    const el = document.getElementById('selected-count')
    if (!el) return
    const n = document.querySelectorAll('.emp-checkbox:checked').length
    el.innerText = n === 0 ? 'Select Employees' : `${n} selected`
}


function syncAttendanceEmpSelectAllCheckbox() {
    const boxes = document.querySelectorAll('.emp-checkbox')
    const selectAll = document.getElementById('emp-checkbox-select-all')
    if (!selectAll || !boxes.length) return
    const total = boxes.length
    const checked = document.querySelectorAll('.emp-checkbox:checked').length
    selectAll.checked = checked === total && total > 0
    selectAll.indeterminate = checked > 0 && checked < total
}


function updateTaskEmpDropdownLabel() {
    const el = document.getElementById('task-selected-count')
    if (!el) return
    const n = document.querySelectorAll('#task-emp-dropdown .task-emp-checkbox:checked').length
    el.innerText = n === 0 ? 'Select Employees' : `${n} selected`
}


function syncTaskEmpSelectAllCheckbox() {
    const boxes = document.querySelectorAll('#task-emp-dropdown .task-emp-checkbox')
    const selectAll = document.getElementById('task-emp-select-all')
    if (!selectAll || !boxes.length) return
    const total = boxes.length
    const checked = document.querySelectorAll('#task-emp-dropdown .task-emp-checkbox:checked').length
    selectAll.checked = checked === total && total > 0
    selectAll.indeterminate = checked > 0 && checked < total
}


function initUI() {
    setInterval(() => {
        const time = new Date().toLocaleTimeString()
        const aClock = document.getElementById('admin-clock')
        const uClock = document.getElementById('user-clock')
        if (aClock) aClock.innerText = time
        if (uClock) uClock.innerText = time
    }, 1000)

    initTaskWeekSelect()

    const dropdownBtn = document.getElementById("emp-dropdown-btn")
    const dropdown = document.getElementById("emp-dropdown")
    if (dropdownBtn && dropdown) {
        dropdownBtn.onclick = () => {
            dropdown.style.display = dropdown.style.display === "none" ? "block" : "none"
        }
        let html = `<div style="padding: 8px 5px; border-bottom: 1px solid var(--card-border); margin-bottom: 4px; position: sticky; top: 0; background: var(--card-bg); z-index: 2;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">
                <input type="checkbox" id="emp-checkbox-select-all" title="Select all employees">
                <span>Select all</span>
            </label>
        </div>`
        ALL_EMPLOYEES.forEach(empObj => {
            html += `<div style="padding: 5px; cursor: pointer; display: flex; gap: 8px;"><input type="checkbox" value="${escapeHtml(empObj.name)}" class="emp-checkbox">${escapeHtml(empObj.name)}</div>`
        })
        dropdown.innerHTML = html
        dropdown.addEventListener('change', (e) => {
            const t = e.target
            if (t.id === 'emp-checkbox-select-all') {
                document.querySelectorAll('.emp-checkbox').forEach(cb => { cb.checked = t.checked })
                t.indeterminate = false
                updateAttendanceEmpDropdownLabel()
                return
            }
            if (t.classList && t.classList.contains('emp-checkbox')) {
                syncAttendanceEmpSelectAllCheckbox()
                updateAttendanceEmpDropdownLabel()
            }
        })
        updateAttendanceEmpDropdownLabel()
    }

    const taskDropdownBtn = document.getElementById("task-emp-dropdown-btn")
    const taskDropdown = document.getElementById("task-emp-dropdown")
    if (taskDropdownBtn && taskDropdown) {
        taskDropdownBtn.onclick = () => {
            taskDropdown.style.display = taskDropdown.style.display === "none" ? "block" : "none"
        }
        let th = `<div style="padding: 8px 5px; border-bottom: 1px solid var(--card-border); margin-bottom: 4px; position: sticky; top: 0; background: var(--card-bg); z-index: 2;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">
                <input type="checkbox" id="task-emp-select-all" title="Select all employees">
                <span>Select all</span>
            </label>
        </div>`
        ALL_EMPLOYEES.forEach(empObj => {
            th += `<div style="padding: 5px; cursor: pointer; display: flex; gap: 8px;"><input type="checkbox" value="${escapeHtml(empObj.name)}" class="task-emp-checkbox">${escapeHtml(empObj.name)}</div>`
        })
        taskDropdown.innerHTML = th
        taskDropdown.addEventListener('change', (e) => {
            const t = e.target
            if (t.id === 'task-emp-select-all') {
                document.querySelectorAll('#task-emp-dropdown .task-emp-checkbox').forEach(cb => { cb.checked = t.checked })
                t.indeterminate = false
                updateTaskEmpDropdownLabel()
                return
            }
            if (t.classList && t.classList.contains('task-emp-checkbox')) {
                syncTaskEmpSelectAllCheckbox()
                updateTaskEmpDropdownLabel()
            }
        })
        updateTaskEmpDropdownLabel()
    }

    const markP = document.getElementById("mark-present-btn")
    if (markP) {
        markP.onclick = async () => {
            const idxEl = document.getElementById("manual-meet-index")
            const meetNum = idxEl ? idxEl.value : ''
            await applySessionAttendanceForAll(meetNum, 'present')
        }
    }
    const markA = document.getElementById("mark-absent-btn")
    if (markA) {
        markA.onclick = async () => {
            const idxEl = document.getElementById("manual-meet-index")
            const meetNum = idxEl ? idxEl.value : ''
            await applySessionAttendanceForAll(meetNum, 'absent_all')
        }
    }

    document.getElementById('assign-task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const weekEl = document.getElementById('task-week-select')
        const textEl = document.getElementById('task-text')
        const week = weekEl ? weekEl.value : ''
        const text = textEl ? textEl.value.trim() : ''
        const selected = Array.from(document.querySelectorAll('#task-emp-dropdown .task-emp-checkbox:checked')).map(el => el.value)
        if (!selected.length || !text) {
            alert('Select at least one employee and enter a task description')
            return
        }

        const pdfInput = document.getElementById('task-assignment-pdf')
        const attachFile = pdfInput?.files?.[0]
        let assignmentPdf = null
        let assignmentFileName = null
        if (attachFile) {
            const okPdf = attachFile.type === 'application/pdf' || attachFile.name.toLowerCase().endsWith('.pdf')
            const okTxt = attachFile.type === 'text/plain' || attachFile.name.toLowerCase().endsWith('.txt')
            if (!okPdf && !okTxt) {
                alert('Attachment must be a .pdf or .txt file')
                return
            }
            try {
                assignmentPdf = await readFileAsDataURL(attachFile)
                assignmentFileName = attachFile.name
            } catch {
                alert('Could not read the attached file')
                return
            }
        }

        try {
            const rows = selected.map(u => buildTaskRow(u, text, week, assignmentPdf, assignmentFileName))
            await insertTaskRows(rows)
            await loadData()
            renderAdminTasks()
        } catch {
            return
        }

        if (textEl) textEl.value = ''
        if (pdfInput) pdfInput.value = ''
        document.querySelectorAll('#task-emp-dropdown .task-emp-checkbox').forEach(cb => { cb.checked = false })
        const tsa = document.getElementById('task-emp-select-all')
        if (tsa) { tsa.checked = false; tsa.indeterminate = false }
        updateTaskEmpDropdownLabel()
        if (typeof Toastify !== 'undefined') Toastify({ text: 'Task(s) assigned', style: { background: 'green' } }).showToast()
    })

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault()
        const user = document.getElementById('username').value.trim().toLowerCase()
        const pass = document.getElementById('password').value.trim()

        if (user === 'thiran' && pass === 'admin@thiran') {
            currentUser = 'admin'
            currentRole = 'admin'
            adminBoosterDraftOrder = null
            await loadBoosterPositionsFromServer()

            // Sidebar links
            const adminLinks = document.getElementById('admin-nav-links')
            const empLinks = document.getElementById('employee-nav-links')
            if (adminLinks) adminLinks.style.display = 'flex'
            if (empLinks) empLinks.style.display = 'none'

            showView('admin-view')
            renderAdmin()
            if (typeof Toastify !== 'undefined') Toastify({ text: "Admin Login Successful", style: { background: "green" } }).showToast()
            return
        }

        const validEmp = ALL_EMPLOYEES.find(emp => emp.username === user)
        if (validEmp && pass === 'thiran*2026') {
            currentUser = validEmp.name
            currentRole = 'employee'

            // Sidebar links
            const adminLinks = document.getElementById('admin-nav-links')
            const empLinks = document.getElementById('employee-nav-links')
            if (adminLinks) adminLinks.style.display = 'none'
            if (empLinks) empLinks.style.display = 'flex'

            const welcomeText = document.getElementById('welcome-text')
            if (welcomeText) welcomeText.innerText = `Hello, ${validEmp.name}`
            const welcomeRole = document.getElementById('welcome-role')
            if (welcomeRole) welcomeRole.innerText = validEmp.role || ''
            showView('employee-view')
            await refreshEmployeeDashboard()
            if (typeof Toastify !== 'undefined') Toastify({ text: `Welcome ${validEmp.name}`, style: { background: "green" } }).showToast()
        } else {
            if (typeof Toastify !== 'undefined') Toastify({ text: "Invalid Credentials!", style: { background: "red" } }).showToast()
        }
    })

    document.getElementById('toggle-password')?.addEventListener('click', () => {
        const pwd = document.getElementById('password')
        const icon = document.getElementById('password-toggle-icon')
        if (pwd && icon) {
            if (pwd.type === 'password') {
                pwd.type = 'text'
                icon.innerText = '🙈'
            } else {
                pwd.type = 'password'
                icon.innerText = '👁️'
            }
        }
    })
}


// Expose for HTML onclick / inline handlers
window.showView = showView
window.logout = logout
window.handleFileUpload = handleFileUpload
window.updateTaskStatus = updateTaskStatus
window.deleteTask = deleteTask
window.resetMatrix = resetMatrix
window.downloadSheet = downloadSheet
window.closeProof = closeProof
window.openTaskAssignmentPdf = openTaskAssignmentPdf
window.downloadTaskAssignmentPdf = downloadTaskAssignmentPdf
window.openTaskSubmissionProof = openTaskSubmissionProof
window.downloadTaskSubmissionProof = downloadTaskSubmissionProof
window.syncUserProofLabel = syncUserProofLabel
window.boosterMoveOrder = boosterMoveOrder
window.saveBoosterOrder = saveBoosterOrder
window.resetBoosterOrderDraft = resetBoosterOrderDraft


async function openEmployeeDashboard() {
    if (currentRole === 'employee') await refreshEmployeeDashboard()
    showView('employee-view')
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

function scrollToBooster() {
    const el = document.getElementById('employee-booster-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goBackFromBooster() {
    if (currentRole === 'admin') showView('admin-view')
    else showView('employee-view')
}

window.toggleSidebar = toggleSidebar
window.scrollToBooster = scrollToBooster
window.goBackFromBooster = goBackFromBooster
window.openEmployeeDashboard = openEmployeeDashboard


window.onload = async () => {
    initLiveDataSync()
    initUI()
    await loadData()
    await loadBoosterPositionsFromServer()
    renderAdmin()
    renderAdminTasks()
    renderUserTasks()
    showView('login-view')
}
