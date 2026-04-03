export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Storage not configured' });

  const { audioUrl, author, style } = req.body || {};
  if (!audioUrl || typeof audioUrl !== 'string') return res.status(400).json({ error: 'URL audio manquante' });
  if (!author || typeof author !== 'string' || author.length > 80) return res.status(400).json({ error: 'Auteur invalide' });

  try {
    const ar = await fetch(audioUrl);
    if (!ar.ok) throw new Error('fetch audio');
    const buf = await ar.arrayBuffer();
    const safe = author.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    const fn = `${Date.now()}_${safe}.mp3`;
    const ur = await fetch(`${SB_URL}/storage/v1/object/wedding-music/${fn}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'audio/mpeg', 'x-upsert': 'false' },
      body: buf
    });
    if (!ur.ok) return res.status(502).json({ error: 'Erreur stockage' });
    return res.status(200).json({ publicUrl: `${SB_URL}/storage/v1/object/public/wedding-music/${fn}` });
  } catch (e) {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
