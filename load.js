// Vercel serverless function to load attendance data
import { sharedData } from './storage';

export default function handler(req, res) {
    // Prevent Vercel from caching the response
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    if (req.method === 'GET') {
        res.status(200).json(sharedData);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
