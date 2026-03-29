import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Prevent Vercel from caching the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'GET') {
        try {
            try {
                const stateResult = await sql`SELECT * FROM tracker_state WHERE id = 1;`;
                const recordsResult = await sql`SELECT * FROM attendance_records;`;
                const tasksResult = await sql`SELECT * FROM tasks;`;

                const state = stateResult.rows[0] || { conducted_count: 0 };
                
                const records = recordsResult.rows.map(row => ({
                    id: Number(row.id),
                    name: row.name,
                    status: row.status,
                    meetLink: row.meet_link,
                    sessionIndex: row.session_index
                }));

                const tasks = tasksResult.rows.map(row => ({
                    id: Number(row.id),
                    user: row.user_name,
                    week: row.week,
                    fromDate: row.from_date ? row.from_date.toISOString().split('T')[0] : null,
                    tillDate: row.till_date ? row.till_date.toISOString().split('T')[0] : null,
                    text: row.task_text,
                    status: row.status,
                    proof: row.proof_data,
                    fileName: row.file_name,
                    timestamp: row.timestamp
                }));

                res.status(200).json({
                    attendanceRecords: records,
                    conductedCount: state.conducted_count,
                    tasksArray: tasks
                });
            } catch (err) {
                console.error("Fetch Error:", err);
                res.status(200).json({ attendanceRecords: [], conductedCount: 0, tasksArray: [] });
            }
        } catch (error) {
            console.error('Error fetching from Cloud:', error);
            res.status(500).json({ error: 'Postgres Read Error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}