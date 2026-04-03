// Fonction pour lire / créer / mettre à jour un événement dans Supabase
export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const headers = {
    'Authorization': `Bearer ${SB_KEY}`,
    'apikey': SB_KEY,
    'Content-Type': 'application/json'
  };

  // GET /api/event?id=xxx → lire un événement
  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const r = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}&select=*`, { headers });
      const rows = await r.json();
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(rows[0]);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // POST /api/event → créer ou mettre à jour un événement
  if (req.method === 'POST') {
    const ev = req.body;
    if (!ev || !ev.id) return res.status(400).json({ error: 'event invalide' });
    try {
      const r = await fetch(`${SB_URL}/rest/v1/events`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(ev)
      });
      if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: t }); }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PATCH /api/event → mettre à jour partiellement (ex: ajouter une chanson, usedCredits)
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const r = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });
      if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: t }); }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // DELETE /api/event?id=xxx
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export séparé pour GET /api/events (liste tous les événements)
export { listEvents };
async function listEvents(req, res) {
  // Cette fonction n'est pas utilisée directement — voir api/events.js
}
