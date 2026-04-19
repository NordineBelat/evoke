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
  // Chaque style a plusieurs variantes complètement différentes (prod, tempo, instruments, effets vocaux)
  // On pioche aléatoirement pour maximiser la diversité entre chaque génération

  const styleVariants = {
    'hip-hop': [
      `Hardcore hip-hop wedding song, ${voiceLabel} voice, aggressive 808 bass, hard-hitting trap drums, dark cinematic strings, gritty and raw energy, punchy rhymes, 90 seconds.`,
      `Lyrical technical hip-hop wedding song, ${voiceLabel} voice, complex multi-syllable flow, jazzy boom-bap production, live bass guitar, intricate wordplay, sophisticated and clever, 90 seconds.`,
      `Autotune melodic rap wedding song, ${voiceLabel} voice, heavy autotune effect, emotional trap melodies, lush synth pads, emo rap atmosphere, 808 slides, dreamy and heartfelt, 90 seconds.`,
      `Old school hip-hop wedding song, ${voiceLabel} voice, vintage boom-bap beats, vinyl crackle, classic east coast production, soulful samples, laid-back groove, nostalgic, 90 seconds.`,
      `Drill style wedding song, ${voiceLabel} voice, dark sliding 808s, hi-hat rolls, ominous piano, menacing instrumental, heavy bass drops, intense urban energy, 90 seconds.`,
      `West coast hip-hop wedding song, ${voiceLabel} voice, g-funk synths, funky bass line, smooth laid-back flow, California vibes, classic west coast production, 90 seconds.`,
    ],
    'blues': [
      `Delta blues wedding song, ${voiceLabel} voice, raw acoustic slide guitar, dusty and emotional, sparse minimal production, deep soulful feeling, storytelling, 90 seconds.`,
      `Chicago electric blues wedding song, ${voiceLabel} voice, distorted electric guitar, driving rhythm section, harmonica, gritty urban sound, powerful and passionate, 90 seconds.`,
      `Slow jazz blues wedding song, ${voiceLabel} voice, mellow piano chords, double bass, brushed drums, smoky intimate atmosphere, melancholic and romantic, 90 seconds.`,
      `Blues rock wedding song, ${voiceLabel} voice, heavy electric guitar riffs, driving drumkit, raw energy mixed with emotion, powerful anthemic feeling, 90 seconds.`,
      `Soul blues wedding song, ${voiceLabel} voice, gospel-influenced melodies, organ, expressive vocal runs, deep emotional resonance, rich soulful production, 90 seconds.`,
    ],
    'jazz': [
      `Bebop jazz wedding song, ${voiceLabel} voice, fast complex chord changes, virtuoso piano, upright bass walking lines, swinging brushed drums, sophisticated and energetic, 90 seconds.`,
      `Smooth jazz wedding song, ${voiceLabel} voice, silky saxophone, electric piano, soft groove, contemporary jazz production, warm and sensual, perfect for slow dancing, 90 seconds.`,
      `Bossa nova jazz wedding song, ${voiceLabel} voice, nylon string guitar, subtle percussion, Brazilian jazz harmonies, intimate whisper, gentle and romantic, 90 seconds.`,
      `Big band jazz wedding song, ${voiceLabel} voice, full brass section, saxophones, trumpets, trombones, swinging big band arrangement, celebratory and joyful, 90 seconds.`,
      `Noir jazz wedding song, ${voiceLabel} voice, moody piano, muted trumpet, late night atmosphere, cinematic and mysterious, deeply romantic, 90 seconds.`,
    ],
    'rock': [
      `Indie rock wedding song, ${voiceLabel} voice, jangly guitar arpeggios, driving bass, energetic drums, anthemic chorus, warm and sincere, stadium-ready emotional, 90 seconds.`,
      `Hard rock wedding song, ${voiceLabel} voice, powerful electric guitar riffs, heavy drumming, distorted bass, raw powerful energy, passionate and loud, 90 seconds.`,
      `Acoustic rock wedding song, ${voiceLabel} voice, fingerpicked and strummed acoustic guitar, emotional dynamics, intimate verses, explosive chorus, heartfelt, 90 seconds.`,
      `Progressive rock wedding song, ${voiceLabel} voice, complex time signatures, layered guitars, dramatic build-ups, epic instrumental passages, cinematic and grand, 90 seconds.`,
      `Shoegaze wedding song, ${voiceLabel} voice, walls of distorted guitar reverb, dreamy ethereal atmosphere, hazy melodies, blissful noise, romantic and hypnotic, 90 seconds.`,
      `Post-rock wedding instrumental, no vocals, sweeping guitar layers, gradual epic build from quiet to massive, drums crashing in, deeply emotional cinematic journey, 90 seconds.`,
    ],
    'soul r&b': [
      `Classic soul wedding song, ${voiceLabel} voice, vintage organ, horn section, gospel-inspired backing vocals, rich warm production, James Brown meets Marvin Gaye, emotional, 90 seconds.`,
      `Contemporary R&B wedding song, ${voiceLabel} voice, modern production, lush synths, tight programmed drums, falsetto runs, smooth and sensual, radio-ready, 90 seconds.`,
      `Neo soul wedding song, ${voiceLabel} voice, live instrumentation, warm electric piano, organic grooves, jazzy chords, introspective and deep, sophisticated, 90 seconds.`,
      `Funk soul wedding song, ${voiceLabel} voice, tight funky bass line, wah guitar, horns, groove-heavy production, danceable and joyful, celebratory energy, 90 seconds.`,
      `Quiet storm R&B wedding song, ${voiceLabel} voice, slow smooth production, lush strings, soft synthesizers, intimate and sensual, perfect for slow dancing, 90 seconds.`,
    ],
    'electronic pop': [
      `Synthwave wedding song, ${voiceLabel} voice, 80s retro synthesizers, pulsing arpeggios, gated reverb drums, neon-lit nostalgic atmosphere, romantic and cinematic, 90 seconds.`,
      `Future bass wedding song, ${voiceLabel} voice, lush chord stabs, wobbly synth drops, emotional build-ups, festival-ready production, euphoric and uplifting, 90 seconds.`,
      `Deep house wedding song, ${voiceLabel} voice, hypnotic 4-on-the-floor kick, warm bassline, soulful vocal chops, late night dance floor energy, smooth and groovy, 90 seconds.`,
      `Ambient electronic wedding song, ${voiceLabel} voice, floating ethereal synth pads, gentle beats, dreamy atmosphere, cinematic and expansive, peaceful and emotional, 90 seconds.`,
      `Electropop wedding song, ${voiceLabel} voice, punchy synth bass, catchy electronic hooks, bright crisp production, danceable and fun, modern pop energy, 90 seconds.`,
      `Drum and bass wedding song, ${voiceLabel} voice, fast breakbeat drums, deep rolling bass, liquid smooth melodies, intense and energetic, high-energy celebration, 90 seconds.`,
    ],
    'reggae': [
      `Roots reggae wedding song, ${voiceLabel} voice, classic one-drop rhythm, deep bass, vintage organ, spiritual and conscious lyrics feel, authentic Jamaican sound, 90 seconds.`,
      `Dancehall wedding song, ${voiceLabel} voice, digital riddim, fast-paced energetic flow, Caribbean party atmosphere, punchy bass, high energy celebration, 90 seconds.`,
      `Lover's rock reggae wedding song, ${voiceLabel} voice, romantic smooth reggae, soft guitar, tender melodies, intimate and sweet, perfect for slow dancing, 90 seconds.`,
      `Reggaeton wedding song, ${voiceLabel} voice, dembow rhythm, urban Latin vibes, modern production, punchy 808s, party energy mixed with romance, 90 seconds.`,
      `Ska wedding song, ${voiceLabel} voice, upbeat brass horns, offbeat guitar, walking bass, joyful energetic rhythm, fun and celebratory, vintage Caribbean sound, 90 seconds.`,
    ],
    'pop': [
      `Indie pop wedding song, ${voiceLabel} voice, delicate guitar, warm synths, intimate lo-fi production, heartfelt and genuine, soft emotional melodies, 90 seconds.`,
      `Electropop wedding song, ${voiceLabel} voice, pulsing synth bass, bright hooks, modern crisp production, catchy chorus, danceable celebration energy, 90 seconds.`,
      `Power pop wedding song, ${voiceLabel} voice, big guitars, anthemic chorus, driving drums, uplifting and euphoric, stadium ready emotional peak, 90 seconds.`,
      `Cinematic pop wedding song, ${voiceLabel} voice, orchestral strings meets modern production, epic build-up, soaring chorus, deeply emotional and grand, 90 seconds.`,
      `Dream pop wedding song, ${voiceLabel} voice, reverb-soaked guitars, hazy ethereal synths, hypnotic melodies, romantic and otherworldly, slow and blissful, 90 seconds.`,
    ],
    'romantic pop': [
      `Piano ballad wedding song, ${voiceLabel} voice, solo piano intro, emotional chord progression, strings swell in chorus, intimate and deeply moving, 90 seconds.`,
      `Cinematic romantic pop wedding song, ${voiceLabel} voice, orchestral strings, modern beats, sweeping production, epic emotional journey, movie soundtrack feeling, 90 seconds.`,
      `Acoustic pop wedding song, ${voiceLabel} voice, nylon string guitar, soft percussion, breathy intimate vocals, heartfelt and tender, stripped back, 90 seconds.`,
      `80s power ballad wedding song, ${voiceLabel} voice, dramatic synths, reverb-drenched production, emotional guitar solo, anthemic and romantic, nostalgic feeling, 90 seconds.`,
      `Contemporary pop ballad wedding song, ${voiceLabel} voice, modern production, trap-influenced soft drums, lush synth pads, emotional and fresh, 90 seconds.`,
    ],
    'gospel': [
      `Traditional gospel wedding song, ${voiceLabel} voice, full choir backing, powerful organ, hand claps, joyful and spiritual, call and response, church energy, 90 seconds.`,
      `Contemporary gospel wedding song, ${voiceLabel} voice, modern production, live band, electric guitar, uplifting message, emotional and celebratory, 90 seconds.`,
      `Praise worship gospel wedding song, ${voiceLabel} voice, intimate acoustic piano, soaring melodies, deeply moving and spiritual, tears of joy atmosphere, 90 seconds.`,
      `Gospel soul fusion wedding song, ${voiceLabel} voice, funk-influenced rhythm section, horn section, expressive vocal runs, joyful and danceable, 90 seconds.`,
    ],
    'orchestral classical': [
      `Romantic orchestral wedding song, ${voiceLabel} voice, lush string quartet, oboe solo, sweeping crescendos, classical Romantic era style, deeply moving, 90 seconds.`,
      `Cinematic orchestral wedding instrumental, no vocals, full symphony orchestra, epic brass, dramatic timpani, heroic and emotional, film score quality, 90 seconds.`,
      `Chamber music wedding song, ${voiceLabel} voice, intimate string trio, harpsichord, delicate and refined, Baroque-influenced, elegant and graceful, 90 seconds.`,
      `Neoclassical piano wedding song, ${voiceLabel} voice, modern classical piano, minimal production, haunting melodies, emotional and contemplative, Ludovico Einaudi style, 90 seconds.`,
      `Opera-influenced wedding song, ${voiceLabel} voice, dramatic operatic passages, full orchestra, powerful and grand, deeply emotional European classical tradition, 90 seconds.`,
    ],
    'country': [
      `Classic country wedding song, ${voiceLabel} voice, twangy acoustic guitar, pedal steel, fiddle, classic Nashville sound, heartfelt storytelling, warm and sincere, 90 seconds.`,
      `Country pop wedding song, ${voiceLabel} voice, modern production, catchy hooks, polished sound, uplifting and radio-ready, contemporary Nashville crossover, 90 seconds.`,
      `Bluegrass wedding song, ${voiceLabel} voice, rapid banjo picking, mandolin, upright bass, high lonesome sound, energetic and joyful, Appalachian tradition, 90 seconds.`,
      `Outlaw country wedding song, ${voiceLabel} voice, gritty guitar, raw production, rebellious spirit, raw and authentic, dusty road atmosphere, deep and honest, 90 seconds.`,
      `Country blues wedding song, ${voiceLabel} voice, slide guitar, earthy and raw, delta meets Nashville, soulful and nostalgic, deeply emotional, 90 seconds.`,
    ],
    'bossa nova': [
      `Classic bossa nova wedding song, ${voiceLabel} voice, nylon guitar, delicate syncopated rhythm, intimate breathy vocals, Rio de Janeiro atmosphere, elegant, 90 seconds.`,
      `Jazz bossa nova wedding song, ${voiceLabel} voice, piano trio, walking bass, soft brushed drums, sophisticated harmonies, Joao Gilberto meets Bill Evans, 90 seconds.`,
      `Modern bossa nova wedding song, ${voiceLabel} voice, electronic touches, contemporary production, bossa groove with modern flair, fresh and romantic, 90 seconds.`,
      `Samba wedding song, ${voiceLabel} voice, percussive rhythm section, Brazilian energy, joyful and festive, lively drums, celebratory tropical feeling, 90 seconds.`,
    ],
    'acoustic folk': [
      `American folk wedding song, ${voiceLabel} voice, fingerpicked acoustic guitar, storytelling lyrics, intimate and raw, campfire atmosphere, honest and heartfelt, 90 seconds.`,
      `Celtic folk wedding song, ${voiceLabel} voice, fiddle, tin whistle, bodhran drum, Irish or Scottish atmosphere, spirited and emotional, traditional and timeless, 90 seconds.`,
      `Singer-songwriter wedding song, ${voiceLabel} voice, solo acoustic guitar, confessional intimate style, minimalist production, deeply personal, 90 seconds.`,
      `Americana wedding song, ${voiceLabel} voice, lap steel guitar, gentle banjo, rustic warm production, American heartland atmosphere, nostalgic and sincere, 90 seconds.`,
      `Nordic folk wedding song, ${voiceLabel} voice, nyckelharpa or violin, atmospheric and mystical, Scandinavian folk tradition, haunting melodies, ethereal, 90 seconds.`,
    ],
    'lo-fi': [
      `Rainy day lo-fi wedding song, ${voiceLabel} voice, rain sounds, vinyl crackle, warm cassette tape texture, mellow piano, nostalgic and cozy, slow and intimate, 90 seconds.`,
      `Lo-fi hip-hop wedding song, ${voiceLabel} voice, chopped vocal samples, dusty boom-bap drums, warm bass, jazzy chords, chill study beats energy, relaxed, 90 seconds.`,
      `Bedroom pop wedding song, ${voiceLabel} voice, DIY aesthetic, layered guitars, home recording warmth, tender and genuine, indie lo-fi production, 90 seconds.`,
      `Vaporwave wedding song, ${voiceLabel} voice, slowed down samples, dreamy retro synths, nostalgic 80s aesthetic, hazy and surreal, slowcore melodies, 90 seconds.`,
    ],
    'french chanson': [
      `Classic chanson française wedding song, ${voiceLabel} voice, accordion, acoustic guitar, Edith Piaf inspired, poetic and passionate, cabaret atmosphere, 90 seconds.`,
      `Nouvelle chanson wedding song, ${voiceLabel} voice, modern production mixed with chanson tradition, Stromae inspired, fresh and emotional, contemporary French sound, 90 seconds.`,
      `Chanson variété wedding song, ${voiceLabel} voice, lush orchestral strings, classic French pop production, elegant and romantic, timeless Parisian feeling, 90 seconds.`,
      `Chanson acoustic wedding song, ${voiceLabel} voice, solo guitar, intimate and poetic, stripped back, deeply personal, Brel or Brassens tradition, 90 seconds.`,
    ],
    'afrobeat': [
      `Afrobeats wedding song, ${voiceLabel} voice, modern Nigerian sound, Afropop production, danceable grooves, celebratory, Burna Boy inspired, joyful, 90 seconds.`,
      `Classic Fela Kuti afrobeat wedding song, ${voiceLabel} voice, full horn section, polyrhythmic drums, funk bass, African percussion, powerful and political energy, 90 seconds.`,
      `Afro-fusion wedding song, ${voiceLabel} voice, blend of afrobeat and R&B, smooth production, contemporary African sound, emotional and danceable, 90 seconds.`,
      `Highlife wedding song, ${voiceLabel} voice, joyful Ghanaian highlife, guitar melodies, brass, celebratory West African tradition, warm and festive, 90 seconds.`,
      `Amapiano wedding song, ${voiceLabel} voice, South African log drum bass, piano house groove, gentle and hypnotic, log drum synth, joyful and smooth, 90 seconds.`,
    ],
  };

  // Sélection aléatoire d'une variante du style choisi
  const variants = styleVariants[musicStyle] || [
    `A beautiful ${musicStyle} wedding song, ${voiceLabel} voice, emotional and celebratory, rich instrumentation, heartfelt, 90 seconds.`,
    `An intimate ${musicStyle} wedding song, ${voiceLabel} voice, stripped back and tender, acoustic feel, deeply personal, 90 seconds.`,
    `An upbeat ${musicStyle} wedding song, ${voiceLabel} voice, joyful and danceable, live instruments, celebratory energy, 90 seconds.`,
  ];
  const prompt = variants[Math.floor(Math.random() * variants.length)];

  // music_style est juste un hint pour MusicGPT — le prompt détaillé prime
  const musicStyleHint = musicStyle.replace('orchestral classical','classical').replace('acoustic folk','folk').replace('electronic pop','electronic').replace('french chanson','pop').replace('soul r&b','soul').replace('romantic pop','pop');

  try {
    const r = await fetch(`${BASE}/MusicAI`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        lyrics,
        music_style: musicStyleHint,
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
