const BASE = 'https://api.musicgpt.com/api/public/v1';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const KEY     = process.env.MUSICGPT_API_KEY;
  const GROQ    = process.env.GROQ_API_KEY;
  const SB_URL  = process.env.SUPABASE_URL;
  const SB_KEY  = process.env.SUPABASE_SERVICE_KEY;

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

  // ── Génération des paroles via Groq (gratuit) ─────────────────────────────
  let lyrics = '';
  let musicStyle = 'romantic pop';

  if (GROQ) {
    try {
      const groqRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are a professional wedding song lyricist.

A wedding guest wrote this message: "${guestMessage}"

Your tasks:
1. Detect the music style mentioned (if any). If none, use "romantic pop".
2. Write complete wedding song lyrics with: [verse], [chorus], [verse], [chorus], [bridge], [chorus].
3. Naturally weave the guest's message into the lyrics — do NOT copy it word for word, transform it into beautiful poetic lyrics.
4. Keep lyrics warm, emotional, celebratory.
5. Max 250 words.

Respond ONLY with this JSON (no markdown, no explanation):
{"style":"detected style in english","lyrics":"full lyrics here with section tags"}`
          }]
        })
      });
      const groqData = await groqRes.json();
      const raw = groqData.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(raw.trim());
      lyrics = parsed.lyrics || '';
      musicStyle = parsed.style || 'romantic pop';
    } catch (e) {
      console.warn('[GENERATE] Groq error:', e.message);
      // Fallback si Groq échoue
      lyrics = '';
      musicStyle = 'romantic pop';
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const prompt = `A beautiful ${musicStyle} wedding song, ${voiceLabel} voice, emotional and celebratory, 90 seconds.`;

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
