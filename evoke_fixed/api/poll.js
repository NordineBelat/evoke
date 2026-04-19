const BASE = 'https://api.musicgpt.com/api/public/v1';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const KEY = process.env.MUSICGPT_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'API not configured' });

  const { task_id } = req.query;
  if (!task_id) return res.status(400).json({ error: 'task_id manquant' });

  try {
    const r = await fetch(`${BASE}/byId?task_id=${task_id}&conversionType=MUSIC_AI`, {
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
    });

    const txt = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: txt });

    let d;
    try { d = JSON.parse(txt); }
    catch { return res.status(502).json({ error: 'Réponse non-JSON' }); }

    const conv = d.conversion || d;
    const status = conv.status || 'UNKNOWN';
    const audioUrl =
      (conv.conversion_path_1 && conv.conversion_path_1 !== '' ? conv.conversion_path_1 : null) ||
      (conv.conversion_path_2 && conv.conversion_path_2 !== '' ? conv.conversion_path_2 : null) ||
      null;

    return res.status(200).json({ status, audioUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
