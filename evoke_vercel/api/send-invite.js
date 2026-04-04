export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: 'Resend not configured' });

  const { to, p1, p2, date, guestLink, galleryLink } = req.body || {};
  if (!to || !p1 || !p2 || !guestLink || !galleryLink)
    return res.status(400).json({ error: 'Paramètres manquants' });

  const dateFormatted = date
    ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'votre mariage';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    
    <!-- Header -->
    <div style="background:#111118;padding:36px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-.02em;">EVOKE</div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;letter-spacing:.1em;text-transform:uppercase;">Cadeaux musicaux pour votre mariage</div>
    </div>

    <!-- Body -->
    <div style="padding:40px;">
      <h1 style="font-size:22px;font-weight:800;color:#111118;margin:0 0 8px;line-height:1.2;">
        ${p1} &amp; ${p2} 💍
      </h1>
      <p style="font-size:14px;color:#6b7280;margin:0 0 24px;">Mariage du ${dateFormatted}</p>

      <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 20px;">
        Bonjour,<br><br>
        Vos invités peuvent désormais vous offrir un cadeau musical unique grâce à <strong>EVOKE</strong>. 
        En quelques secondes, chacun compose une mélodie personnalisée rien que pour vous, 
        avec leurs propres mots transformés en chanson.
      </p>

      <!-- Comment ça marche -->
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:28px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:12px;">Comment ça marche</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:13px;color:#374151;">✍️ &nbsp;L'invité écrit un message personnel pour vous</div>
          <div style="font-size:13px;color:#374151;">🎵 &nbsp;L'IA compose une mélodie unique en quelques secondes</div>
          <div style="font-size:13px;color:#374151;">💌 &nbsp;La chanson est envoyée directement dans votre galerie</div>
        </div>
      </div>

      <!-- Lien invités -->
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">Lien à partager avec vos invités</div>
        <a href="${guestLink}" style="display:block;background:#111118;color:white;text-decoration:none;border-radius:10px;padding:14px 20px;font-size:13px;font-weight:700;text-align:center;">
          🎵 &nbsp;Composer une mélodie
        </a>
        <div style="font-size:11px;color:#9ca3af;margin-top:6px;text-align:center;">${guestLink}</div>
      </div>

      <!-- Lien galerie -->
      <div style="margin-bottom:32px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">Votre galerie privée</div>
        <a href="${galleryLink}" style="display:block;background:#f0fdf4;border:1.5px solid #3ecf6a;color:#166534;text-decoration:none;border-radius:10px;padding:14px 20px;font-size:13px;font-weight:700;text-align:center;">
          🎧 &nbsp;Accéder à la galerie
        </a>
        <div style="font-size:11px;color:#9ca3af;margin-top:6px;text-align:center;">Retrouvez toutes les mélodies de vos invités</div>
      </div>

      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">
        Partagez le lien de composition à vos invités par message, email ou en QR code le jour J. 
        Toutes les mélodies seront automatiquement disponibles dans votre galerie.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#111118;margin-bottom:4px;">L'équipe EVOKE</div>
      <div style="font-size:11px;color:#9ca3af;">Cadeaux musicaux personnalisés pour les mariages</div>
    </div>

  </div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'EVOKE <onboarding@resend.dev>',
        to: [to],
        subject: `🎵 EVOKE — Vos mélodies de mariage, ${p1} & ${p2}`,
        html
      })
    });

    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d.message || 'Resend error' });
    return res.status(200).json({ ok: true, id: d.id });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
