const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const { url, key } = SB();
  const ANON_KEY = process.env.SUPABASE_ANON_KEY || key;

  try {
    // 1. Authentifier via Supabase Auth
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const userId = authData.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentification échouée' });

    // 2. Récupérer le profil
    const profileRes = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=*`, {
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
    });
    const profiles = await profileRes.json();
    const profile = profiles?.[0];

    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    // 3. Vérifier statut
    if (profile.status === 'pending') {
      return res.status(403).json({ error: 'Veuillez confirmer votre adresse email avant de vous connecter.' });
    }
    if (profile.status === 'suspended') {
      return res.status(403).json({ error: 'Votre compte a été suspendu. Contactez le support.' });
    }

    // 4. Mettre à jour last_login
    await fetch(`${url}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_login: new Date().toISOString() })
    });

    return res.status(200).json({
      ok: true,
      token: authData.access_token,
      refresh_token: authData.refresh_token,
      user: {
        id: userId,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        accountType: profile.account_type,
        company: profile.company,
        plan: profile.plan,
        credits: profile.credits,
        creditsUsed: profile.credits_used,
        status: profile.status
      }
    });

  } catch (e) {
    console.error('[LOGIN] Error:', e);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
