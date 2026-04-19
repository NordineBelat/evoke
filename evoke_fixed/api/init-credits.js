export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const { event_id, credits } = req.body || {};
  if (!event_id || !credits) return res.status(400).json({ error: 'event_id et credits requis' });

  try {
    const r = await fetch(`${SB_URL}/rest/v1/event_credits`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ event_id, credits: parseInt(credits), used: 0 })
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'Supabase error: ' + txt.substring(0, 200) });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
