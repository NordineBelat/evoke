const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

async function getUserIdFromToken(token, url, key) {
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
  const { url, key } = SB();
  const h = { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };

  // GET /api/credits?userId=xxx — historique crédits d'un utilisateur
  if (req.method === 'GET') {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Non authentifié' });
    const userId = await getUserIdFromToken(token, url, key);
    if (!userId) return res.status(401).json({ error: 'Token invalide' });

    try {
      const r = await fetch(
        `${url}/rest/v1/credit_history?user_id=eq.${userId}&order=created_at.desc&limit=50`,
        { headers: h }
      );
      const rows = await r.json();
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/credits — ajouter des crédits (super admin uniquement)
  if (req.method === 'POST') {
    // Vérifier token super admin
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken || adminToken !== process.env.SUPER_ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Accès non autorisé' });
    }

    const { userId, amount, reason, adminNote } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId requis' });
    if (!amount || isNaN(parseInt(amount))) return res.status(400).json({ error: 'Montant invalide' });
    if (!reason) return res.status(400).json({ error: 'Motif requis' });

    const credits = parseInt(amount);
    if (credits === 0) return res.status(400).json({ error: 'Le montant ne peut pas être 0' });

    try {
      // Récupérer crédits actuels
      const uR = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=credits,credits_used,first_name,last_name,email`, { headers: h });
      const users = await uR.json();
      const user = users?.[0];
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const newCredits = (user.credits || 0) + credits;
      if (newCredits < 0) return res.status(400).json({ error: 'Impossible — solde insuffisant' });

      // Mettre à jour les crédits
      await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
        method: 'PATCH', headers: h,
        body: JSON.stringify({ credits: newCredits })
      });

      // Enregistrer dans l'historique
      await fetch(`${url}/rest/v1/credit_history`, {
        method: 'POST',
        headers: { ...h, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          user_id: userId,
          amount: credits,
          balance_after: newCredits,
          type: credits > 0 ? 'add' : 'remove',
          reason: reason,
          admin_note: adminNote || null,
          source: 'admin',
          created_at: new Date().toISOString()
        })
      });

      return res.status(200).json({
        ok: true,
        newBalance: newCredits,
        user: { name: user.first_name + ' ' + user.last_name, email: user.email }
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
