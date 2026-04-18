const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

function checkSuperAdmin(req) {
  const token = req.headers['x-admin-token'];
  return token === process.env.SUPER_ADMIN_TOKEN;
}

export default async function handler(req, res) {
  if (!checkSuperAdmin(req)) return res.status(401).json({ error: 'Accès non autorisé' });

  const { url, key } = SB();
  const h = { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };
  const { action } = req.query;

  // ── GET stats ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'stats') {
    try {
      const [usersR, eventsR] = await Promise.all([
        fetch(`${url}/rest/v1/users?select=id,plan,status,credits_used`, { headers: h }),
        fetch(`${url}/rest/v1/events?select=id,songs`, { headers: h })
      ]);
      const users = await usersR.json().catch(() => []);
      const events = await eventsR.json().catch(() => []);
      const u = Array.isArray(users) ? users : [];
      const e = Array.isArray(events) ? events : [];
      return res.status(200).json({
        totalUsers: u.length,
        activeUsers: u.filter(x => x.status === 'active').length,
        pendingUsers: u.filter(x => x.status === 'pending').length,
        suspendedUsers: u.filter(x => x.status === 'suspended').length,
        planStarter: u.filter(x => x.plan === 'starter').length,
        planPro: u.filter(x => x.plan === 'pro').length,
        planMax: u.filter(x => x.plan === 'max').length,
        totalEvents: e.length,
        totalSongs: e.reduce((acc, ev) => acc + (ev.songs?.length || 0), 0),
        totalCreditsUsed: u.reduce((acc, x) => acc + (x.credits_used || 0), 0)
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── GET users ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'users') {
    try {
      const r = await fetch(`${url}/rest/v1/users?select=*&order=created_at.desc`, { headers: h });
      const users = await r.json().catch(() => []);
      if (!Array.isArray(users)) return res.status(200).json([]);
      const enriched = await Promise.all(users.map(async u => {
        try {
          const evR = await fetch(`${url}/rest/v1/events?user_id=eq.${u.id}&select=id,songs,couple,date`, { headers: h });
          const events = await evR.json().catch(() => []);
          const evArr = Array.isArray(events) ? events : [];
          return {
            id: u.id, email: u.email,
            firstName: u.first_name, lastName: u.last_name,
            accountType: u.account_type, company: u.company,
            siret: u.siret, phone: u.phone,
            plan: u.plan, credits: u.credits, creditsUsed: u.credits_used,
            status: u.status, createdAt: u.created_at, lastLogin: u.last_login,
            eventsCount: evArr.length,
            songsCount: evArr.reduce((acc, e) => acc + (e.songs?.length || 0), 0)
          };
        } catch {
          return {
            id: u.id, email: u.email,
            firstName: u.first_name, lastName: u.last_name,
            accountType: u.account_type, company: u.company,
            siret: u.siret, phone: u.phone,
            plan: u.plan, credits: u.credits, creditsUsed: u.credits_used,
            status: u.status, createdAt: u.created_at, lastLogin: u.last_login,
            eventsCount: 0, songsCount: 0
          };
        }
      }));
      return res.status(200).json(enriched);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── GET user-detail ───────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'user-detail') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    try {
      const [uR, evR] = await Promise.all([
        fetch(`${url}/rest/v1/users?id=eq.${userId}&select=*`, { headers: h }),
        fetch(`${url}/rest/v1/events?user_id=eq.${userId}&select=*&order=created_at.desc`, { headers: h })
      ]);
      const users = await uR.json().catch(() => []);
      const events = await evR.json().catch(() => []);
      if (!users[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
      return res.status(200).json({ user: users[0], events: Array.isArray(events) ? events : [] });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── GET impersonate — génère un token de connexion pour un user ───────────
  if (req.method === 'GET' && action === 'impersonate') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    try {
      // Générer un lien magique via Supabase Auth Admin
      const r = await fetch(`${url}/auth/v1/admin/users/${userId}/magiclink`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ redirect_to: 'https://evoke-app.com/dashboard' })
      });
      if (!r.ok) {
        // Fallback: générer un token de session directement
        const tokenR = await fetch(`${url}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: h,
          body: JSON.stringify({ type: 'magiclink', email: userId, redirect_to: 'https://evoke-app.com/dashboard' })
        });
        if (!tokenR.ok) return res.status(502).json({ error: 'Impossible de générer le lien' });
        const d = await tokenR.json();
        return res.status(200).json({ link: d.action_link || d.hashed_token });
      }
      const d = await r.json();
      return res.status(200).json({ link: d.action_link || 'ok' });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── PATCH user ────────────────────────────────────────────────────────────
  if (req.method === 'PATCH' && action === 'user') {
    const { userId, status, plan, credits } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    const updates = {};
    if (status) updates.status = status;
    if (plan !== undefined) updates.plan = plan;
    if (credits !== undefined) updates.credits = parseInt(credits);
    try {
      const r = await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH', headers: h, body: JSON.stringify(updates)
      });
      if (!r.ok) { const t = await r.text(); return res.status(502).json({ error: t }); }
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── DELETE user ───────────────────────────────────────────────────────────
  if (req.method === 'DELETE' && action === 'user') {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    try {
      await fetch(`${url}/rest/v1/users?id=eq.${userId}`, { method: 'DELETE', headers: h });
      await fetch(`${url}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: h });
      return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(400).json({ error: 'Action invalide' });
}
