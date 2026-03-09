// Vercel serverless function to load attendance data
import { sharedData } from './storage';

export default function handler(req, res) {
    if (req.method === 'GET') {
        res.status(200).json(sharedData);
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}