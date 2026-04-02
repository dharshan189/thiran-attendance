// ================== SUPABASE SETUP ==================


const supabaseUrl = 'https://samuyhnccbblehzqhmqb.supabase.co'
const supabaseKey = 'sb_publishable_-IGbDnjMiurLnF4s1-LIrg_hCp7R_J7'

const supabase = createClient(supabaseUrl, supabaseKey)


// ================== GLOBAL VARIABLES ==================
let attendanceRecordsArray = []
let tasksArray = []
let conductedCount = 0


// ================== LOAD DATA ==================
async function loadData() {
    try {
        const { data: attendance, error: err1 } = await supabase
            .from('attendance')
            .select('*')

        const { data: tasks, error: err2 } = await supabase
            .from('tasks')
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


// ================== ATTENDANCE ==================
async function manualAttendance(empName, meetNum, present) {
    if (!empName) return alert("Select employee")
    if (!meetNum) return alert("Enter meeting number")

    const index = meetNum - 1

    // Delete existing record
    await supabase
        .from('attendance')
        .delete()
        .eq('name', empName)
        .eq('sessionIndex', index)

    // Insert new if present
    if (present) {
        await supabase.from('attendance').insert([
            {
                name: empName,
                status: 'Present',
                sessionIndex: index
            }
        ])
    }

    if (index >= conductedCount) {
        conductedCount = index + 1
    }

    await loadData()
    renderAdmin()
}


// ================== ADD TASK ==================
async function addTask(user, text, week) {
    if (!user || !text) return alert("Fill all fields")

    await supabase.from('tasks').insert([
        {
            user: user,
            text: text,
            week: week,
            status: 'Pending',
            timestamp: new Date().toISOString()
        }
    ])

    await loadData()
    renderAdminTasks()
}


// ================== UPDATE TASK ==================
async function updateTaskStatus(id, status) {
    await supabase
        .from('tasks')
        .update({ status: status })
        .eq('id', id)

    await loadData()
    renderAdminTasks()
}


// ================== DELETE TASK ==================
async function deleteTask(id) {
    await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

    await loadData()
    renderAdminTasks()
}


// ================== SUBMIT TASK FILE ==================
async function submitTaskFile(taskId, file) {
    const reader = new FileReader()

    reader.onload = async function (e) {
        await supabase
            .from('tasks')
            .update({
                status: 'Submitted',
                proof: e.target.result,
                fileName: file.name,
                completionTime: Date.now()
            })
            .eq('id', taskId)

        await loadData()
        renderUserTasks()
    }

    reader.readAsDataURL(file)
}


// ================== RENDER ADMIN ATTENDANCE ==================
function renderAdmin() {
    const container = document.getElementById("adminAttendance")
    if (!container) return

    container.innerHTML = ""

    attendanceRecordsArray.forEach(r => {
        const div = document.createElement("div")
        div.innerHTML = `<b>${r.name}</b> - ${r.status}`
        container.appendChild(div)
    })
}


// ================== RENDER ADMIN TASKS ==================
function renderAdminTasks() {
    const container = document.getElementById("adminTasks")
    if (!container) return

    container.innerHTML = ""

    tasksArray.forEach(t => {
        const div = document.createElement("div")

        div.innerHTML = `
            <p>
                <b>${t.user}</b>: ${t.text} (${t.status})
                <button onclick="updateTaskStatus('${t.id}','Completed')">✔</button>
                <button onclick="deleteTask('${t.id}')">❌</button>
            </p>
        `

        container.appendChild(div)
    })
}


// ================== RENDER USER TASKS ==================
function renderUserTasks() {
    const container = document.getElementById("userTasks")
    if (!container) return

    container.innerHTML = ""

    tasksArray.forEach(t => {
        const div = document.createElement("div")

        div.innerHTML = `
            <p>
                ${t.text} - ${t.status}
                <input type="file" onchange="handleFileUpload('${t.id}', this)">
            </p>
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


// ================== INIT ==================
window.onload = async () => {
    await loadData()
    renderAdmin()
    renderAdminTasks()
    renderUserTasks()
}
