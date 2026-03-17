import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Prevent Vercel from caching the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'POST') {
        try {
            const { attendanceRecords, activeMeetLink, conductedCount } = req.body;

            // 1. Update the global state
            await sql`
                UPDATE tracker_state
                SET active_meet_link = ${activeMeetLink || ''},
                    conducted_count = ${conductedCount || 0}
                WHERE id = 1;
            `;

            // 2. Sync Attendance Records
            if (!attendanceRecords || attendanceRecords.length === 0) {
                // If array is empty, admin pressed "Reset Matrix"
                await sql`DELETE FROM attendance_records;`;
            } else {
                // To keep database clean, we remove records that were manually deleted by Admin (un-checked)
                const idsLiteral = '{' + attendanceRecords.map(r => r.id).join(',') + '}';
                
                await sql`
                    DELETE FROM attendance_records 
                    WHERE NOT (id = ANY(${idsLiteral}::bigint[]));
                `;

                // UPSERT (Insert or Update if exists) all records provided
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

            res.status(200).json({ success: true, message: 'Synced to PostgreSQL successfully' });
        } catch (error) {
            console.error('Error saving to Postgres:', error);
            res.status(500).json({ error: 'Failed to save data to PostgreSQL database' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
