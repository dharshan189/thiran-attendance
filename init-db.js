import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        // 1. Create table for the global application state
        await sql`
            CREATE TABLE IF NOT EXISTS tracker_state (
                id SERIAL PRIMARY KEY,
                active_meet_link TEXT DEFAULT '',
                conducted_count INTEGER DEFAULT 0
            );
        `;

        // Insert initial global state if it doesn't exist
        await sql`
            INSERT INTO tracker_state (id, active_meet_link, conducted_count)
            VALUES (1, '', 0)
            ON CONFLICT (id) DO NOTHING;
        `;

        // 2. Create table for attendance records
        await sql`
            CREATE TABLE IF NOT EXISTS attendance_records (
                id BIGINT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                meet_link TEXT,
                session_index INTEGER NOT NULL
            );
        `;

        // 3. Create table for users (Admins & Employees) for future use
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL
            );
        `;

        // 4. Seed the users table with the default admin and employees
        await sql`
            INSERT INTO users (username, full_name, password, role) VALUES 
            ('thiran', 'Thiran MD', 'admin@thiran', 'admin'),
            ('mogesh', 'Mogesh', 'thiran*2026', 'employee'),
            ('hari', 'Hari Haran', 'thiran*2026', 'employee'),
            ('mukunthan', 'Mukunthan', 'thiran*2026', 'employee'),
            ('prakathesh', 'Prakathesh', 'thiran*2026', 'employee'),
            ('rahav', 'Rahav V K', 'thiran*2026', 'employee'),
            ('lohith', 'Lohidharani G S', 'thiran*2026', 'employee'),
            ('nabeela', 'Shaik Nabeela Rayees', 'thiran*2026', 'employee'),
            ('keerthana', 'Keerthana P S', 'thiran*2026', 'employee'),
            ('kanmani', 'Kanmani G', 'thiran*2026', 'employee'),
            ('navasri', 'Navasri N', 'thiran*2026', 'employee'),
            ('akash', 'Akash M', 'thiran*2026', 'employee'),
            ('arpit', 'Arpit kumar P', 'thiran*2026', 'employee'),
            ('supriya', 'Supriya Jayam.B', 'thiran*2026', 'employee'),
            ('vishal', 'Vishal M', 'thiran*2026', 'employee')
            ON CONFLICT (username) DO NOTHING;
        `;

        return res.status(200).json({ success: true, message: 'PostgreSQL Database tables created and users seeded successfully!' });
    } catch (error) {
        console.error('Error initializing database:', error);
        return res.status(500).json({ error: 'Failed to initialize database.', message: error.message });
    }
}
