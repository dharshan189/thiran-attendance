-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create table for attendance records
CREATE TABLE IF NOT EXISTS attendance_records (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    session_index INTEGER NOT NULL
);

-- 2. Create table for tasks
CREATE TABLE IF NOT EXISTS tasks (
    id BIGSERIAL PRIMARY KEY,
    task_id TEXT UNIQUE NOT NULL,
    user_name TEXT NOT NULL,
    week TEXT NOT NULL,
    from_date TEXT,
    till_date TEXT,
    task_text TEXT NOT NULL,
    assignment_pdf TEXT,
    assignment_pdf_name TEXT,
    status TEXT NOT NULL,
    proof TEXT,
    file_name TEXT,
    timestamp TEXT
);

-- 3. Create table for global configuration
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 4. Set initial conducted count if not exists
INSERT INTO config (key, value) VALUES ('conductedCount', '0') ON CONFLICT (key) DO NOTHING;
