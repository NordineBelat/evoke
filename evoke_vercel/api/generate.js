const BASE = 'https://api.musicgpt.com/api/public/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY    = process.env.MUSICGPT_API_KEY;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!KEY) return res.status(500).json({ error: 'API not configured' });

  const { message, name, voice, event_id } = req.body || {};
  if (!message || message.length < 3) return res.status(400).json({ error: 'Message trop court' });

  // ── Vérification crédits Supabase ─────────────────────────────────────────
  if (SB_URL && SB_KEY && event_id) {
    try {
      const cr = await fetch(
        `${SB_URL}/rest/v1/event_credits?event_id=eq.${encodeURIComponent(event_id)}&select=credits,used`,
        { headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY } }
      );
      const rows = await cr.json();
      if (rows && rows.length > 0) {
        const { credits, used } = rows[0];
        if (used >= credits) return res.status(403).json({ error: 'credits_exhausted' });
        await fetch(`${SB_URL}/rest/v1/rpc/increment_used`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_event_id: event_id })
        });
      }
    } catch (e) { console.warn('[GENERATE] Supabase error:', e.message); }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const voiceLabel = voice === 'male' ? 'male' : 'female';
  const guestMessage = message.trim();

  // ── Étape 1 : Générer les paroles via MusicGPT prompt_to_lyrics ───────────
  // On construit un prompt qui demande des paroles en français
  // et intègre le message de l'invité + le style détecté
  const lyricsPrompt = `Chanson de mariage en français. Message de l'invité à intégrer dans les paroles : "${guestMessage}". Créer des paroles complètes avec couplet, refrain et pont. Paroles poétiques et émouvantes.`;

  let lyrics = '';
  let musicStyle = 'romantic pop';

  // Détecter le style dans le message de l'invité (mots-clés simples)
  const msg = guestMessage.toLowerCase();
  if (msg.includes('blues')) musicStyle = 'blues';
  else if (msg.includes('jazz')) musicStyle = 'jazz';
  else if (msg.includes('rap') || msg.includes('hip-hop') || msg.includes('hiphop')) musicStyle = 'hip-hop';
  else if (msg.includes('reggae')) musicStyle = 'reggae';
  else if (msg.includes('rock')) musicStyle = 'rock';
  else if (msg.includes('gospel')) musicStyle = 'gospel';
  else if (msg.includes('soul') || msg.includes('r&b') || msg.includes('rnb')) musicStyle = 'soul r&b';
  else if (msg.includes('classique') || msg.includes('orchestral')) musicStyle = 'orchestral classical';
  else if (msg.includes('country')) musicStyle = 'country';
  else if (msg.includes('bossa') || msg.includes('bossa nova')) musicStyle = 'bossa nova';
  else if (msg.includes('folk') || msg.includes('acoustique')) musicStyle = 'acoustic folk';
  else if (msg.includes('electro') || msg.includes('électro')) musicStyle = 'electronic pop';
  else if (msg.includes('lo-fi') || msg.includes('lofi')) musicStyle = 'lo-fi';
  else if (msg.includes('variété') || msg.includes('chanson française')) musicStyle = 'french chanson';
  else if (msg.includes('afrobeat') || msg.includes('afro')) musicStyle = 'afrobeat';
  else if (msg.includes('pop')) musicStyle = 'pop';

  try {
    const lyricsRes = await fetch(
      `${BASE}/prompt_to_lyrics?prompt=${encodeURIComponent(lyricsPrompt)}`,
      { headers: { 'Authorization': `Bearer ${KEY}` } }
    );
    if (lyricsRes.ok) {
      const lyricsData = await lyricsRes.json();
      if (lyricsData.lyrics) {
        lyrics = lyricsData.lyrics;
        console.log('[GENERATE] Paroles générées par MusicGPT, style:', musicStyle);
      }
    } else {
      console.warn('[GENERATE] prompt_to_lyrics failed:', lyricsRes.status);
    }
  } catch (e) {
    console.warn('[GENERATE] prompt_to_lyrics error:', e.message);
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Étape 2 : Générer la musique avec les paroles ─────────────────────────
  // Prompt adapté au style pour orienter MusicGPT correctement
  const stylePrompts = {
    'blues':             `A soulful blues wedding song, ${voiceLabel} voice, slow and emotional, heartfelt guitar, deep feeling, 90 seconds.`,
    'jazz':              `An intimate jazz wedding song, ${voiceLabel} voice, romantic piano and double bass, warm and sophisticated, 90 seconds.`,
    'hip-hop':           `A hip-hop wedding song, ${voiceLabel} voice, modern beats, rhythmic flow, punchy and celebratory, 90 seconds.`,
    'reggae':            `A reggae wedding song, ${voiceLabel} voice, upbeat positive vibes, jamaican rhythm, joyful and warm, 90 seconds.`,
    'rock':              `An acoustic rock wedding song, ${voiceLabel} voice, powerful guitar, anthemic and emotional, 90 seconds.`,
    'gospel':            `A gospel wedding song, ${voiceLabel} voice, uplifting choir energy, joyful and spiritual, 90 seconds.`,
    'soul r&b':          `A soul and r&b wedding song, ${voiceLabel} voice, smooth groove, emotional and romantic, 90 seconds.`,
    'orchestral classical': `A cinematic orchestral wedding song, ${voiceLabel} voice, grand strings and piano, majestic and emotional, 90 seconds.`,
    'country':           `A country wedding song, ${voiceLabel} voice, acoustic guitar, heartfelt and warm, southern charm, 90 seconds.`,
    'bossa nova':        `A bossa nova wedding song, ${voiceLabel} voice, soft brazilian guitar, intimate and romantic, 90 seconds.`,
    'acoustic folk':     `An acoustic folk wedding song, ${voiceLabel} voice, fingerpicking guitar, storytelling, warm and tender, 90 seconds.`,
    'electronic pop':    `An electronic pop wedding song, ${voiceLabel} voice, dreamy synths, modern and romantic, gentle beats, 90 seconds.`,
    'lo-fi':             `A lo-fi wedding song, ${voiceLabel} voice, soft warm beats, nostalgic and tender, chill and emotional, 90 seconds.`,
    'french chanson':    `A french chanson wedding song, ${voiceLabel} voice, poetic and romantic, accordion and piano, heartfelt, 90 seconds.`,
    'afrobeat':          `An afrobeat wedding song, ${voiceLabel} voice, west african rhythms, upbeat and joyful, celebratory energy, 90 seconds.`,
    'pop':               `A romantic pop wedding song, ${voiceLabel} voice, catchy and emotional, modern production, heartfelt, 90 seconds.`,
    'romantic pop':      `A romantic pop wedding song, ${voiceLabel} voice, emotional piano ballad, heartfelt and celebratory, 90 seconds.`,
  };
  const prompt = stylePrompts[musicStyle] || `A beautiful ${musicStyle} wedding song, ${voiceLabel} voice, emotional and celebratory, 90 seconds.`;

  try {
    const r = await fetch(`${BASE}/MusicAI`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        lyrics,
        music_style: musicStyle,
        gender: voiceLabel,
        make_instrumental: false,
        vocal_only: false,
        output_length: 90
      })
    });

    const txt = await r.text();
    if (!r.ok) return res.status(502).json({ error: 'MusicGPT ' + r.status + ': ' + txt.substring(0, 300) });

    const d = JSON.parse(txt);
    if (!d.task_id) return res.status(502).json({ error: 'Pas de task_id: ' + txt.substring(0, 300) });

    return res.status(200).json({ task_id: d.task_id, name: name || 'Invité', eta: d.eta || 90 });

  } catch (e) {
    return res.status(500).json({ error: 'Fetch error: ' + e.message });
  }
}
