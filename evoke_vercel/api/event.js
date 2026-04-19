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

// Convertit une row snake_case Supabase en camelCase pour le frontend
function normalize(row) {
  if (!row) return row;
  return {
    id: row.id,
    couple: row.couple,
    p1: row.p1,
    p2: row.p2,
    date: row.date,
    guests: row.guests,
    credits: row.credits,
    email: row.email,
    usedCredits: row.used_credits,
    songs: row.songs,
    token: row.token,
    quiz: row.quiz,
    createdAt: row.created_at,
    user_id: row.user_id
  };
}

// Convertit les champs camelCase du frontend en snake_case pour Supabase
function toSnake(body) {
  const ev = {};
  if (body.id !== undefined)          ev.id           = body.id;
  if (body.couple !== undefined)      ev.couple       = body.couple;
  if (body.p1 !== undefined)          ev.p1           = body.p1;
  if (body.p2 !== undefined)          ev.p2           = body.p2;
  if (body.date !== undefined)        ev.date         = body.date;
  if (body.guests !== undefined)      ev.guests       = body.guests;
  if (body.credits !== undefined)     ev.credits      = body.credits;
  if (body.email !== undefined)       ev.email        = body.email;
  if (body.usedCredits !== undefined) ev.used_credits = body.usedCredits;
  if (body.songs !== undefined)       ev.songs        = body.songs;
  if (body.token !== undefined)       ev.token        = body.token;
  if (body.quiz !== undefined)        ev.quiz         = body.quiz;
  if (body.createdAt !== undefined)   ev.created_at   = body.createdAt;
  if (body.user_id !== undefined)     ev.user_id      = body.user_id;
  return ev;
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
      return res.status(200).json(normalize(rows[0]));
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // POST /api/event → créer ou mettre à jour (upsert)
  if (req.method === 'POST') {
    const body = req.body;
    if (!body || !body.id) return res.status(400).json({ error: 'event invalide' });

    const ev = {
      id:           body.id,
      couple:       body.couple      || '',
      p1:           body.p1          || '',
      p2:           body.p2          || '',
      date:         body.date        || null,
      guests:       body.guests      || 0,
      credits:      body.credits     || 0,
      email:        body.email       || null,
      used_credits: body.usedCredits || 0,
      songs:        body.songs       || [],
      token:        body.token       || null,
      quiz:         body.quiz        || [],
      created_at:   body.createdAt   || new Date().toISOString(),
      user_id:      body.user_id     || null
    };

    try {
      const r = await fetch(`${SB_URL}/rest/v1/events`, {
        method: 'POST',
        headers: { ...h, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
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
      const snakeUpdates = toSnake(updates);
      const r = await fetch(`${SB_URL}/rest/v1/events?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: h,
        body: JSON.stringify(snakeUpdates)
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
