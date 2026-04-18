const SB = () => ({ url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, firstName, lastName, accountType, company, siret, phone } = req.body || {};

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email invalide' });
  if (accountType === 'professional' && !company) return res.status(400).json({ error: 'Nom de société requis' });

  const { url, key } = SB();

  try {
    // 1. Créer l'utilisateur via Supabase Auth
    const authRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        email_confirm: false, // On gère la validation nous-mêmes
        user_metadata: { firstName, lastName }
      })
    });

    const authData = await authRes.json();
    if (!authRes.ok) {
      if (authData.message?.includes('already registered') || authData.msg?.includes('already exists')) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      }
      return res.status(400).json({ error: authData.message || authData.msg || 'Erreur création compte' });
    }

    const userId = authData.id;

    // 2. Créer le profil dans la table users
    const profileRes = await fetch(`${url}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`, 'apikey': key,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        account_type: accountType || 'individual',
        company: company || null,
        siret: siret || null,
        phone: phone || null,
        plan: 'none',
        credits: 0,
        credits_used: 0,
        status: 'pending',
        created_at: new Date().toISOString()
      })
    });

    if (!profileRes.ok) {
      const t = await profileRes.text();
      console.error('[REGISTER] Profile creation failed:', t);
    }

    // 3. Générer token de validation email
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    await fetch(`${url}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`, 'apikey': key,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ user_id: userId, token, expires_at: expiry })
    });

    // 4. Envoyer email de validation
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const baseUrl = process.env.APP_URL || 'https://evoke-app.com';
    const verifyLink = `${baseUrl}/verify-email?token=${token}`;

    if (RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'EVOKE <noreply@evoke-app.com>',
          to: [email],
          subject: '✦ Confirmez votre adresse email — EVOKE',
          html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:#111118;padding:32px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-.02em;">EVOKE</div>
      <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:4px;letter-spacing:.1em;text-transform:uppercase;">Génération musicale pour événements</div>
    </div>
    <div style="padding:40px;">
      <h1 style="font-size:20px;font-weight:800;color:#111118;margin:0 0 8px;">Bienvenue, ${firstName} !</h1>
      <p style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.6;">Confirmez votre adresse email pour activer votre compte EVOKE.</p>
      <a href="${verifyLink}" style="display:block;background:#111118;color:white;text-decoration:none;border-radius:12px;padding:16px;font-size:14px;font-weight:800;text-align:center;margin-bottom:24px;">
        ✦ &nbsp;Confirmer mon adresse email
      </a>
      <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">Ce lien est valable 24 heures. Si vous n'avez pas créé de compte EVOKE, ignorez cet email.</p>
    </div>
    <div style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
      <div style="font-size:11px;color:#9ca3af;">© 2025 EVOKE — evoke-app.com</div>
    </div>
  </div>
</body>
</html>`
        })
      });
    }

    return res.status(201).json({ ok: true, message: 'Compte créé. Vérifiez votre email.' });

  } catch (e) {
    console.error('[REGISTER] Error:', e);
    return res.status(500).json({ error: 'Erreur serveur: ' + e.message });
  }
}
