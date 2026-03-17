import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Prevent Vercel from caching the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'GET') {
        try {
            // First time setup check (just in case they forgot to visit `/api/init-db`)
            try {
                const stateResult = await sql`SELECT * FROM tracker_state WHERE id = 1;`;
                const recordsResult = await sql`SELECT * FROM attendance_records;`;

                const state = stateResult.rows[0] || { active_meet_link: '', conducted_count: 0 };
                
                // Format records securely
                const records = recordsResult.rows.map(row => ({
                    id: Number(row.id),
                    name: row.name,
                    status: row.status,
                    meetLink: row.meet_link,
                    sessionIndex: row.session_index
                }));

                res.status(200).json({
                    attendanceRecords: records,
                    activeMeetLink: state.active_meet_link,
                    conductedCount: state.conducted_count
                });
            } catch (err) {
                console.error("Tables might not exist yet:", err);
                // Return defaults if tables aren't created yet to prevent crashing
                res.status(200).json({
                    attendanceRecords: [],
                    activeMeetLink: '',
                    conductedCount: 0
                });
            }
        } catch (error) {
            console.error('Error fetching from Postgres:', error);
            res.status(500).json({ error: 'Failed to load data from PostgreSQL database' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
