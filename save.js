// Vercel serverless function to save attendance data
import { sharedData } from './storage';

export default function handler(req, res) {
    // Prevent Vercel from caching the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'POST') {
        const { attendanceRecords, activeMeetLink, conductedCount } = req.body;
        sharedData.attendanceRecords = attendanceRecords || [];
        sharedData.activeMeetLink = activeMeetLink || '';
        sharedData.conductedCount = conductedCount || 0;
        res.status(200).json({ success: true });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
