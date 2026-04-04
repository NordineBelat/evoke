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

  // ── Générer le QR code via api.qrserver.com ───────────────────────────────
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(guestLink)}&color=111118&bgcolor=ffffff&margin=10`;

  // Télécharger le QR code pour l'attacher en pièce jointe
  let qrBase64 = null;
  try {
    const qrRes = await fetch(qrUrl);
    if (qrRes.ok) {
      const qrBuf = await qrRes.arrayBuffer();
      qrBase64 = Buffer.from(qrBuf).toString('base64');
    }
  } catch (e) { console.warn('QR fetch failed:', e.message); }

  // ── Template HTML du mail ─────────────────────────────────────────────────
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f2f2f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:#111118;padding:36px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:white;letter-spacing:-.02em;">EVOKE</div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:4px;letter-spacing:.1em;text-transform:uppercase;">Cadeaux musicaux personnalisés</div>
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
          <div style="font-size:13px;color:#374151;">🎵 &nbsp;Une mélodie unique est composée en quelques secondes</div>
          <div style="font-size:13px;color:#374151;">💌 &nbsp;La chanson est envoyée directement dans votre galerie</div>
        </div>
      </div>

      <!-- QR Code section -->
      <div style="background:#111118;border-radius:14px;padding:28px;margin-bottom:24px;text-align:center;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:6px;">À afficher le jour J</div>
        <div style="font-size:17px;font-weight:800;color:white;margin-bottom:4px;">${p1} &amp; ${p2}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.45);margin-bottom:20px;">${dateFormatted}</div>
        <div style="background:white;border-radius:12px;padding:16px;display:inline-block;">
          <img src="${qrUrl}" width="200" height="200" alt="QR Code" style="display:block;border-radius:4px;">
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:16px;line-height:1.5;">
          Scannez ce QR code pour composer<br>une mélodie pour les mariés
        </div>
      </div>

      <!-- Bouton lien invités -->
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">Lien à partager avec vos invités</div>
        <a href="${guestLink}" style="display:block;background:#111118;color:white;text-decoration:none;border-radius:10px;padding:14px 20px;font-size:13px;font-weight:700;text-align:center;">
          🎵 &nbsp;Composer une mélodie
        </a>
      </div>

      <!-- Bouton galerie -->
      <div style="margin-bottom:32px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:8px;">Votre galerie privée</div>
        <a href="${galleryLink}" style="display:block;background:#3ecf6a;color:white;text-decoration:none;border-radius:10px;padding:14px 20px;font-size:13px;font-weight:700;text-align:center;">
          🎧 &nbsp;Accéder à la galerie
        </a>
      </div>

      <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:0;">
        Le QR code en pièce jointe peut être imprimé et affiché lors de votre mariage.
        Vos invités n'auront qu'à le scanner pour vous offrir leur mélodie.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:24px 40px;border-top:1px solid #f3f4f6;text-align:center;">
      <div style="font-size:13px;font-weight:700;color:#111118;margin-bottom:4px;">L'équipe EVOKE</div>
      <div style="font-size:11px;color:#9ca3af;">Cadeaux musicaux personnalisés</div>
    </div>

  </div>
</body>
</html>`;

  // ── Construire l'objet email ──────────────────────────────────────────────
  const emailPayload = {
    from: 'EVOKE <onboarding@resend.dev>',
    to: [to],
    subject: `🎵 EVOKE — Vos mélodies de mariage, ${p1} & ${p2}`,
    html
  };

  // Attacher le QR code en pièce jointe si disponible
  if (qrBase64) {
    emailPayload.attachments = [{
      filename: `evoke-qrcode-${p1.toLowerCase()}-${p2.toLowerCase()}.png`,
      content: qrBase64,
      content_type: 'image/png'
    }];
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d.message || 'Resend error' });
    return res.status(200).json({ ok: true, id: d.id });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
