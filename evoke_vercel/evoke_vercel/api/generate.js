const BASE = 'https://api.musicgpt.com/api/public/v1';

const STYLE_MAP = {
  'acoustique folk':      'acoustic folk, fingerpicking guitar, warm, storytelling',
  'afrobeat':             'afrobeat, west african rhythms, upbeat, percussion, groovy',
  'blues':                'blues, soulful, electric guitar, emotional, heartfelt',
  'bossa nova':           'bossa nova, brazilian jazz, soft guitar, romantic, intimate',
  'classique orchestral': 'orchestral, cinematic, strings, piano, grand, emotional',
  'country':              'country, acoustic guitar, heartfelt, southern, warm',
  'électro doux':         'electronic, soft synths, dreamy, ambient pop, gentle beats',
  'gospel':               'gospel, choir, uplifting, soulful, joyful, spiritual',
  'jazz intime':          'jazz, intimate, piano, double bass, romantic, lounge',
  'lo-fi chill':          'lo-fi, chill beats, soft piano, warm, relaxed, nostalgic',
  'pop romantique':       'romantic pop, emotional, piano, heartfelt ballad, love song',
  'rap & hip-hop':        'hip-hop, rap, modern beats, rhythmic, urban, storytelling',
  'reggae':               'reggae, jamaican, upbeat, positive vibes, guitar, rhythm',
  'rock acoustique':      'acoustic rock, guitar, powerful, emotional, anthemic',
  'soul & r&b':           'soul, r&b, smooth, emotional vocals, groove, love',
  'variété française':    'french chanson, romantic, poetic, piano, heartfelt',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY    = process.env.MUSICGPT_API_KEY;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!KEY) return res.status(500).json({ error: 'API not configured' });

  const { message, name, style, voice, event_id } = req.body || {};
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
        if (used >= credits) return res.status(403).json({ error: 'credits_exhausted', credits, used });
        await fetch(`${SB_URL}/rest/v1/rpc/increment_used`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_event_id: event_id })
        });
      }
    } catch (e) { console.warn('[GENERATE] Supabase error:', e.message); }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const styleTags  = STYLE_MAP[style?.toLowerCase()] || 'romantic pop, emotional, piano, love song';
  const voiceLabel = voice === 'male' ? 'male' : 'female';
  const guestLine = message.trim();

  // On laisse MusicGPT composer les paroles entièrement.
  // Le message de l'invité est une inspiration à intégrer, pas les paroles brutes.
  const prompt = `Compose a complete and emotional wedding song in the style: ${styleTags}.
Voice: ${voiceLabel}.
The song must have full original lyrics: two verses, a chorus, and a bridge.
Naturally weave this personal message from a wedding guest into the lyrics (in a verse or the chorus): "${guestLine}"
Do NOT repeat this message as-is. Use it as inspiration and expand it into beautiful, poetic song lyrics.
The song should feel like a real, complete wedding song. Duration: 90 seconds.`;

  try {
    const r = await fetch(`${BASE}/MusicAI`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, music_style: styleTags, gender: voiceLabel, make_instrumental: false, vocal_only: false, output_length: 90 })
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
