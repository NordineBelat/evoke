const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

async function getUserIdFromToken(token, url, key) {
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { 'Authorization': `Bearer ${token}`, 'apikey': key } });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { url, key } = SB();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const userId = await getUserIdFromToken(token, url, key);
  if (!userId) return res.status(401).json({ error: 'Token invalide' });

  const h = { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };

  try {
    // Récupérer tous les événements pour supprimer les fichiers audio
    const evR = await fetch(`${url}/rest/v1/events?user_id=eq.${userId}&select=songs`, { headers: h });
    const evs = await evR.json().catch(() => []);

    // Supprimer les fichiers audio Supabase
    const allSongs = (Array.isArray(evs) ? evs : []).flatMap(e => e.songs || []).filter(s => s.url?.includes('supabase'));
    await Promise.allSettled(allSongs.map(s =>
      fetch(`${url}/storage/v1/object/wedding-music/${s.url.split('/wedding-music/')[1]}`, { method: 'DELETE', headers: h })
    ));

    // Supprimer les données (cascade via FK)
    await fetch(`${url}/rest/v1/users?id=eq.${userId}`, { method: 'DELETE', headers: h });

    // Supprimer le compte auth
    await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: h });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
