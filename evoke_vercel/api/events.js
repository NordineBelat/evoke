export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const r = await fetch(`${SB_URL}/rest/v1/events?select=*&order=createdAt.desc`, {
      headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY }
    });
    const rows = await r.json();
    return res.status(200).json(rows || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
