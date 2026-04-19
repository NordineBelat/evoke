const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url, key } = SB();
  const token = req.headers.authorization?.replace('Bearer ', '');
  const userId = await getUserIdFromToken(token, url, key);

  if (!userId) return res.status(401).json({ error: 'Non authentifié' });

  try {
    const r = await fetch(
      `${url}/rest/v1/events?user_id=eq.${userId}&select=*&order=created_at.desc`,
      { headers: { 'Authorization': `Bearer ${key}`, 'apikey': key } }
    );
    const rows = await r.json();
    return res.status(200).json((rows || []).map(normalize));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
