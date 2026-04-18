const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token manquant' });

  const { url, key } = SB();
  const h = { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };

  try {
    const tokenR = await fetch(`${url}/rest/v1/email_verifications?token=eq.${encodeURIComponent(token)}&select=*`, { headers: h });
    const records = await tokenR.json();
    const record = records?.[0];

    if (!record) return res.status(404).send('<h2>Lien invalide ou déjà utilisé</h2>');
    if (new Date(record.expires_at) < new Date()) return res.status(410).send('<h2>Lien expiré</h2>');
    if (!record.new_email) return res.status(400).send('<h2>Données invalides</h2>');

    // Mettre à jour l'email dans auth et dans users
    await Promise.all([
      fetch(`${url}/auth/v1/admin/users/${record.user_id}`, {
        method: 'PUT', headers: h, body: JSON.stringify({ email: record.new_email, email_confirm: true })
      }),
      fetch(`${url}/rest/v1/users?id=eq.${record.user_id}`, {
        method: 'PATCH', headers: h, body: JSON.stringify({ email: record.new_email })
      })
    ]);

    // Supprimer le token
    await fetch(`${url}/rest/v1/email_verifications?token=eq.${encodeURIComponent(token)}`, { method: 'DELETE', headers: h });

    res.setHeader('Location', '/login?email_changed=1');
    return res.status(302).end();
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
