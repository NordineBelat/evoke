export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { siret } = req.query;
  if (!siret || !/^\d{14}$/.test(siret)) {
    return res.status(400).json({ error: 'SIRET invalide (14 chiffres requis)' });
  }

  // Essayer plusieurs APIs dans l'ordre
  const apis = [
    // API Recherche Entreprises (la plus fiable, pas de clé requise)
    async () => {
      const r = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!r.ok) throw new Error('API 1 failed');
      const d = await r.json();
      const result = d.results?.[0];
      if (!result) throw new Error('Not found');

      // Trouver l'établissement avec ce SIRET
      const etab = result.matching_etablissements?.[0] || result.siege;
      return {
        nom: result.nom_complet || result.nom_raison_sociale || '',
        adresse: etab?.adresse || etab?.geo_adresse || '',
        cp: etab?.code_postal || '',
        ville: etab?.libelle_commune || etab?.commune || '',
        actif: result.etat_administratif === 'A' || etab?.etat_administratif === 'A',
        siren: result.siren || ''
      };
    },
    // Fallback: annuaire-entreprises
    async () => {
      const r = await fetch(
        `https://annuaire-entreprises.data.gouv.fr/api/v3/etablissement/${siret}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!r.ok) throw new Error('API 2 failed');
      const d = await r.json();
      return {
        nom: d.unite_legale?.nom_complet || d.unite_legale?.nom_raison_sociale || '',
        adresse: d.adresse?.label || '',
        cp: d.adresse?.code_postal || '',
        ville: d.adresse?.commune || '',
        actif: d.etat_administratif === 'A',
        siren: d.siren || ''
      };
    }
  ];

  for (const tryApi of apis) {
    try {
      const result = await tryApi();
      // Vérifier qu'on a au minimum un nom
      if (!result.nom) continue;
      return res.status(200).json(result);
    } catch (e) {
      console.warn('[SIRET] API attempt failed:', e.message);
      continue;
    }
  }

  return res.status(404).json({ error: 'SIRET non trouvé dans les registres officiels' });
}
