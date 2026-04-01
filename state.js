-0

const { sql } = require('@vercel/postgres');

const STATE_KEY = 'attendance_hub';

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
}

module.exports = async function handler(req, res) {
  try {
    await ensureTable();

    if (req.method === 'GET') {
      const result = await sql`SELECT state, updated_at FROM app_state WHERE id = ${STATE_KEY} LIMIT 1;`;
      if (!result.rows.length) {
        return res.status(200).json({
          attendance: [],
          tasks: [],
          conductedCount: 0,
          lastUpdated: null,
        });
      }

      const row = result.rows[0];
      return res.status(200).json({
        ...row.state,
        lastUpdated: row.updated_at,
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const nextState = {
        attendance: Array.isArray(body.attendance) ? body.attendance : [],
        tasks: Array.isArray(body.tasks) ? body.tasks : [],
        conductedCount: Number.isFinite(body.conductedCount) ? body.conductedCount : 0,
      };

      await sql`
        INSERT INTO app_state (id, state, updated_at)
        VALUES (${STATE_KEY}, ${JSON.stringify(nextState)}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET state = EXCLUDED.state, updated_at = NOW();
      `;

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: 'Failed to process database request.' });
  }
};