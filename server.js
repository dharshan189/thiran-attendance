import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Higher limit for Base64 PDFs

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// INITIALIZE TABLES
app.get('/api/init', async (req, res) => {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id BIGINT PRIMARY KEY,
        name TEXT,
        status TEXT,
        session_index INTEGER
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id BIGSERIAL PRIMARY KEY,
        task_id TEXT UNIQUE,
        user_name TEXT,
        week TEXT,
        from_date TEXT,
        till_date TEXT,
        task_text TEXT,
        assignment_pdf TEXT,
        assignment_pdf_name TEXT,
        status TEXT,
        proof TEXT,
        file_name TEXT,
        timestamp TEXT
      );
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    client.release();
    res.json({ status: 'Success', message: 'Tables initialized' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// FETCH ALL DATA
app.get('/api/data', async (req, res) => {
  try {
    const client = await pool.connect();
    const attendance = await client.query('SELECT * FROM attendance_records');
    const tasks = await client.query('SELECT * FROM tasks ORDER BY id ASC');
    const config = await client.query("SELECT value FROM config WHERE key = 'conductedCount'");
    
    client.release();
    res.json({
      attendance: attendance.rows,
      tasks: tasks.rows.map(t => ({
        ...t,
        id: t.task_id, // Map task_id back to frontend ID
        text: t.task_text,
        user: t.user_name
      })),
      conductedCount: config.rows[0] ? parseInt(config.rows[0].value) : 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// SAVE/SYNC DATA
app.post('/api/save', async (req, res) => {
  const { attendance, tasks, conductedCount } = req.body;
  try {
    const client = await pool.connect();
    await client.query('BEGIN');
    
    // 1. Sync Attendance
    await client.query('TRUNCATE attendance_records');
    for (const rec of attendance) {
      await client.query(
        'INSERT INTO attendance_records (id, name, status, session_index) VALUES ($1, $2, $3, $4)',
        [rec.id, rec.name, rec.status, rec.sessionIndex]
      );
    }
    
    // 2. Sync Tasks (Using task_id to determine upsert)
    // For simplicity in this vanilla app, we'll truncate and re-insert 
    // or we could use a smarter sync. Given the "In-Memory Matrix" nature, 
    // a full sync is often expected.
    await client.query('DELETE FROM tasks');
    for (const task of tasks) {
      await client.query(
        `INSERT INTO tasks (
          task_id, user_name, week, from_date, till_date, task_text, 
          assignment_pdf, assignment_pdf_name, status, proof, file_name, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          task.id, task.user, task.week, task.fromDate, task.tillDate, task.text,
          task.assignmentPdf, task.assignmentPdfName, task.status, task.proof, task.fileName, task.timestamp
        ]
      );
    }
    
    // 3. Sync Config
    await client.query(
      "INSERT INTO config (key, value) VALUES ('conductedCount', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [conductedCount.toString()]
    );
    
    await client.query('COMMIT');
    client.release();
    res.json({ status: 'Success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
