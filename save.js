import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Prevent Vercel from caching the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'POST') {
        try {
            const { attendanceRecords, conductedCount, tasksArray } = req.body;
            console.log(`Saving cloud state: ${attendanceRecords?.length} records, ${tasksArray?.length} tasks.`);

            // 1. Update global state
            await sql`INSERT INTO tracker_state (id, conducted_count) VALUES (1, ${conductedCount || 0}) ON CONFLICT (id) DO UPDATE SET conducted_count = EXCLUDED.conducted_count;`;

            // 2. Sync Attendance Records
            if (!attendanceRecords || attendanceRecords.length === 0) {
                await sql`DELETE FROM attendance_records;`;
            } else {
                const attIds = attendanceRecords.map(r => r.id);
                await sql`DELETE FROM attendance_records WHERE NOT (id = ANY(${attIds}::bigint[]));`;
                for (const rec of attendanceRecords) {
                    await sql`
                        INSERT INTO attendance_records (id, name, status, meet_link, session_index)
                        VALUES (${rec.id}, ${rec.name}, ${rec.status}, ${rec.meetLink || null}, ${rec.sessionIndex})
                        ON CONFLICT (id) DO UPDATE SET 
                            status = EXCLUDED.status, 
                            meet_link = EXCLUDED.meet_link, 
                            session_index = EXCLUDED.session_index;
                    `;
                }
            }

            // 3. Sync Tasks
            if (!tasksArray || tasksArray.length === 0) {
                await sql`DELETE FROM tasks;`;
            } else {
                const taskIds = tasksArray.map(t => t.id);
                await sql`DELETE FROM tasks WHERE NOT (id = ANY(${taskIds}::bigint[]));`;
                for (const t of tasksArray) {
                    await sql`
                        INSERT INTO tasks (id, user_name, week, from_date, till_date, task_text, status, proof_data, file_name, timestamp)
                        VALUES (
                            ${t.id}, ${t.user}, ${t.week}, ${t.fromDate || null}, ${t.tillDate || null}, 
                            ${t.text}, ${t.status}, ${t.proof || null}, ${t.fileName || null}, ${t.timestamp}
                        )
                        ON CONFLICT (id) DO UPDATE SET 
                            status = EXCLUDED.status, 
                            proof_data = EXCLUDED.proof_data, 
                            file_name = EXCLUDED.file_name;
                    `;
                }
            }

            console.log("Cloud sync successful.");
            res.status(200).json({ success: true, message: 'Cloud Sync Complete!' });
        } catch (error) {
            console.error('CRITICAL Error saving to Cloud:', error);
            res.status(500).json({ error: 'Postgres Write Error', message: error.message });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
