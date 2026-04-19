// File d'attente simple via Supabase
// Table: generation_queue (id TEXT, event_id TEXT, status TEXT, created_at TIMESTAMPTZ)

export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const headers = {
    'Authorization': `Bearer ${SB_KEY}`,
    'apikey': SB_KEY,
    'Content-Type': 'application/json'
  };

  // GET /api/queue?event_id=xxx → combien de personnes en cours de génération sur cet event
  if (req.method === 'GET') {
    const { event_id } = req.query;
    try {
      // Nettoyer les entrées de plus de 3 minutes (générations abandonnées)
      const cutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      await fetch(`${SB_URL}/rest/v1/generation_queue?created_at=lt.${cutoff}`, {
        method: 'DELETE', headers
      });

      // Compter les générations actives sur cet événement
      const r = await fetch(
        `${SB_URL}/rest/v1/generation_queue?event_id=eq.${encodeURIComponent(event_id)}&status=eq.active&select=id`,
        { headers: { ...headers, 'Prefer': 'count=exact' } }
      );
      const count = parseInt(r.headers.get('content-range')?.split('/')[1] || '0');
      return res.status(200).json({ active: count });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // POST /api/queue → rejoindre la file
  if (req.method === 'POST') {
    const { queue_id, event_id } = req.body || {};
    if (!queue_id || !event_id) return res.status(400).json({ error: 'queue_id et event_id requis' });
    try {
      await fetch(`${SB_URL}/rest/v1/generation_queue`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: queue_id, event_id, status: 'active', created_at: new Date().toISOString() })
      });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // DELETE /api/queue?queue_id=xxx → quitter la file
  if (req.method === 'DELETE') {
    const { queue_id } = req.query;
    if (!queue_id) return res.status(400).json({ error: 'queue_id requis' });
    try {
      await fetch(`${SB_URL}/rest/v1/generation_queue?id=eq.${encodeURIComponent(queue_id)}`, {
        method: 'DELETE', headers
      });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
