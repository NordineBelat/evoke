const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

function checkSuperAdmin(req) {
  const token = req.headers['x-admin-token'];
  return token === process.env.SUPER_ADMIN_TOKEN;
}

export default async function handler(req, res) {
  if (!checkSuperAdmin(req)) return res.status(401).json({ error: 'Accès non autorisé' });

  const { url, key } = SB();
  const { action } = req.query;

  // GET /api/superadmin?action=users — liste tous les utilisateurs avec KPIs
  if (req.method === 'GET' && action === 'users') {
    try {
      const r = await fetch(`${url}/rest/v1/users?select=*&order=created_at.desc`, {
        headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
      });
      const users = await r.json();

      // Pour chaque user, compter ses événements
      const enriched = await Promise.all(users.map(async u => {
        const evR = await fetch(
          `${url}/rest/v1/events?user_id=eq.${u.id}&select=id,songs,created_at`,
          { headers: { 'Authorization': `Bearer ${key}`, 'apikey': key } }
        );
        const events = await evR.json().catch(() => []);
        const totalSongs = events.reduce((acc, e) => acc + (e.songs?.length || 0), 0);
        return {
          id: u.id,
          email: u.email,
          firstName: u.first_name,
          lastName: u.last_name,
          accountType: u.account_type,
          company: u.company,
          plan: u.plan,
          credits: u.credits,
          creditsUsed: u.credits_used,
          status: u.status,
          createdAt: u.created_at,
          lastLogin: u.last_login,
          eventsCount: events.length,
          songsCount: totalSongs
        };
      }));

      return res.status(200).json(enriched);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // PATCH /api/superadmin?action=user — modifier un utilisateur
  if (req.method === 'PATCH' && action === 'user') {
    const { userId, status, plan, credits } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requis' });

    const updates = {};
    if (status) updates.status = status;
    if (plan) updates.plan = plan;
    if (credits !== undefined) updates.credits = parseInt(credits);

    try {
      const r = await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!r.ok) return res.status(502).json({ error: 'Erreur mise à jour' });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET /api/superadmin?action=stats — KPIs globaux
  if (req.method === 'GET' && action === 'stats') {
    try {
      const [usersR, eventsR] = await Promise.all([
        fetch(`${url}/rest/v1/users?select=id,plan,status,credits_used`, {
          headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
        }),
        fetch(`${url}/rest/v1/events?select=id,songs`, {
          headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
        })
      ]);

      const users = await usersR.json();
      const events = await eventsR.json();
      const totalSongs = events.reduce((acc, e) => acc + (e.songs?.length || 0), 0);
      const totalCreditsUsed = users.reduce((acc, u) => acc + (u.credits_used || 0), 0);

      return res.status(200).json({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        pendingUsers: users.filter(u => u.status === 'pending').length,
        suspendedUsers: users.filter(u => u.status === 'suspended').length,
        planStarter: users.filter(u => u.plan === 'starter').length,
        planPro: users.filter(u => u.plan === 'pro').length,
        planMax: users.filter(u => u.plan === 'max').length,
        totalEvents: events.length,
        totalSongs,
        totalCreditsUsed
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET /api/superadmin?action=user-events&userId=xxx
  if (req.method === 'GET' && action === 'user-events') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    try {
      const r = await fetch(
        `${url}/rest/v1/events?user_id=eq.${userId}&select=*&order=created_at.desc`,
        { headers: { 'Authorization': `Bearer ${key}`, 'apikey': key } }
      );
      const events = await r.json();
      return res.status(200).json(events || []);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Action invalide' });
}
