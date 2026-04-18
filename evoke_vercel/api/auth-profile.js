const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

async function getUserFromToken(token, url, key) {
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${token}`, 'apikey': key }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id || null;
}

export default async function handler(req, res) {
  const { url, key } = SB();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const userId = await getUserFromToken(token, url, key);
  if (!userId) return res.status(401).json({ error: 'Token invalide' });

  // GET — récupérer le profil
  if (req.method === 'GET') {
    const r = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=*`, {
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
    });
    const rows = await r.json();
    if (!rows?.[0]) return res.status(404).json({ error: 'Profil introuvable' });
    const p = rows[0];
    return res.status(200).json({
      id: p.id,
      email: p.email,
      firstName: p.first_name,
      lastName: p.last_name,
      accountType: p.account_type,
      company: p.company,
      siret: p.siret,
      phone: p.phone,
      address: p.address,
      zip: p.zip,
      city: p.city,
      plan: p.plan,
      credits: p.credits,
      creditsUsed: p.credits_used,
      status: p.status,
      createdAt: p.created_at
    });
  }

  // PATCH — mettre à jour le profil
  if (req.method === 'PATCH') {
    const { firstName, lastName, company, siret, phone, accountType } = req.body || {};
    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (company !== undefined) updates.company = company;
    if (siret !== undefined) updates.siret = siret;
    if (phone !== undefined) updates.phone = phone;
    if (req.body.city !== undefined) updates.city = req.body.city;
    if (req.body.zip !== undefined) updates.zip = req.body.zip;
    if (req.body.siret !== undefined) updates.siret = req.body.siret;
    if (accountType) updates.account_type = accountType;

    const r = await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!r.ok) return res.status(502).json({ error: 'Erreur mise à jour' });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
