const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

async function getUserFromToken(token, url, key) {
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': key }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, key } = SB();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const authUser = await getUserFromToken(token, url, key);
  if (!authUser?.id) return res.status(401).json({ error: 'Token invalide' });

  const { newEmail } = req.body || {};
  if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return res.status(400).json({ error: 'Email invalide' });
  }
  if (newEmail === authUser.email) {
    return res.status(400).json({ error: 'C\'est déjà votre email actuel' });
  }

  // Vérifier que le nouvel email n'est pas déjà utilisé
  const checkR = await fetch(`${url}/rest/v1/users?email=eq.${encodeURIComponent(newEmail)}&select=id`, {
    headers: { 'Authorization': `Bearer ${key}`, 'apikey': key }
  });
  const existing = await checkR.json().catch(() => []);
  if (existing?.length > 0) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé par un autre compte' });
  }

  // Générer un token de confirmation
  const confToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Stocker la demande
  await fetch(`${url}/rest/v1/email_verifications`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({
      user_id: authUser.id,
      token: confToken,
      expires_at: expiry,
      new_email: newEmail
    })
  });

  // Envoyer email de confirmation à l'adresse ACTUELLE
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const baseUrl = process.env.APP_URL || 'https://evoke-app.com';
  const confirmLink = `${baseUrl}/api/auth-verify-email-change?token=${confToken}`;

  if (RESEND_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'EVOKE <noreply@evoke-app.com>',
        to: [authUser.email],
        subject: '⚠️ Confirmation de changement d\'email — EVOKE',
        html: `
<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:2rem;background:#f2f2f7;border-radius:16px">
  <div style="background:#111118;border-radius:12px;padding:1.5rem;text-align:center;margin-bottom:1.5rem">
    <div style="font-size:1.3rem;font-weight:800;color:white">EVOKE</div>
  </div>
  <h2 style="font-size:1rem;color:#111118;margin-bottom:.8rem">Confirmation de changement d'email</h2>
  <p style="color:#6b7280;font-size:.85rem;line-height:1.6;margin-bottom:1rem">
    Une demande de changement d'email a été effectuée pour votre compte.<br>
    <strong>Nouvel email demandé :</strong> ${newEmail}
  </p>
  <p style="color:#6b7280;font-size:.85rem;line-height:1.6;margin-bottom:1.5rem">
    Si vous êtes à l'origine de cette demande, cliquez sur le bouton ci-dessous pour confirmer.<br>
    Si ce n'est pas vous, ignorez cet email — votre email actuel ne sera pas modifié.
  </p>
  <a href="${confirmLink}" style="display:block;background:#111118;color:white;text-decoration:none;border-radius:10px;padding:14px;font-size:.85rem;font-weight:800;text-align:center;margin-bottom:1rem">
    ✓ Confirmer le changement d'email
  </a>
  <p style="color:#9ca3af;font-size:.72rem;text-align:center">Ce lien expire dans 24 heures.</p>
</div>`
      })
    });
  }

  return res.status(200).json({ ok: true, message: 'Email de confirmation envoyé à votre adresse actuelle' });
}
