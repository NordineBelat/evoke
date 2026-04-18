const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token manquant' });

  const { url, key } = SB();

  try {
    // Chercher le token
    const tokenRes = await fetch(
      `${url}/rest/v1/email_verifications?token=eq.${encodeURIComponent(token)}&select=*`,
      { headers: { 'Authorization': `Bearer ${key}`, 'apikey': key } }
    );
    const tokens = await tokenRes.json();
    const record = tokens?.[0];

    if (!record) return res.status(404).json({ error: 'Lien invalide ou déjà utilisé' });
    if (new Date(record.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Lien expiré. Veuillez vous réinscrire.' });
    }

    // Activer le compte
    await fetch(`${url}/rest/v1/users?id=eq.${record.user_id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });

    // Supprimer le token
    await fetch(`${url}/rest/v1/email_verifications?token=eq.${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
    });

    // Rediriger vers login avec message de succès
    res.setHeader('Location', '/login?verified=1');
    return res.status(302).end();

  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
