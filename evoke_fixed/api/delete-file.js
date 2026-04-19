export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Storage not configured' });

  const { url } = req.body || {};
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL manquante' });

  // Extraire le nom du fichier depuis l'URL publique Supabase
  // Format : https://xxx.supabase.co/storage/v1/object/public/wedding-music/FILENAME.mp3
  const match = url.match(/\/wedding-music\/(.+)$/);
  if (!match) return res.status(400).json({ error: 'URL invalide' });

  const filename = match[1];

  try {
    const r = await fetch(
      `${SB_URL}/storage/v1/object/wedding-music/${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SB_KEY}`,
          'apikey': SB_KEY
        }
      }
    );

    if (!r.ok) {
      const txt = await r.text();
      console.warn('[DELETE-FILE] Supabase error:', r.status, txt);
      // On retourne quand même OK — le fichier est peut-être déjà supprimé
    }

    return res.status(200).json({ ok: true, filename });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
