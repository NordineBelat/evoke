async function getUserIdFromToken(token, url, key) {
  if (!token) return null;
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': key }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase not configured' });

  const h = {
    'Authorization': `Bearer ${SB_KEY}`,
    'apikey': SB_KEY,
    'Content-Type': 'application/json'
  };

  // GET /api/event?id=xxx
  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const r = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}&select=*`, { headers: h });
      const rows = await r.json();
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(rows[0]);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // POST /api/event → créer ou mettre à jour (upsert)
  if (req.method === 'POST') {
    const body = req.body;
    if (!body || !body.id) return res.status(400).json({ error: 'event invalide' });

    // Construire l'objet avec uniquement les champs connus de la table
    const ev = {
      id: body.id,
      couple: body.couple || '',
      p1: body.p1 || '',
      p2: body.p2 || '',
      date: body.date || null,
      guests: body.guests || 0,
      credits: body.credits || 0,
      email: body.email || null,
      usedCredits: body.usedCredits || 0,
      songs: body.songs || [],
      token: body.token || null,       // null = pas de mot de passe galerie
      quiz: body.quiz || [],
      createdAt: body.createdAt || new Date().toISOString(),
      user_id: body.user_id || null
    };

    try {
      const r = await fetch(`${SB_URL}/rest/v1/events`, {
        method: 'POST',
        headers: { ...h, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(ev)
      });
      if (!r.ok) {
        const t = await r.text();
        console.error('[EVENT POST] Supabase error:', t);
        return res.status(502).json({ error: 'Erreur base de données: ' + t.substring(0, 300) });
      }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PATCH /api/event → mise à jour partielle
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id requis' });
    try {
      const r = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: h,
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
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = await getUserIdFromToken(token, SB_URL, SB_KEY);
    try {
      if (userId) {
        const checkR = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}&select=user_id`, { headers: h });
        const rows = await checkR.json();
        if (rows?.[0]?.user_id && rows[0].user_id !== userId) {
          return res.status(403).json({ error: 'Accès refusé' });
        }
      }
      await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: h });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
