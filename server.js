// server.js
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: fetch from RxNorm name search
async function fetchRxNormByName(name) {
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RxNorm responded with ${res.status}`);
  return res.json();
}

// Helper: get interactions by rxcui (if available)
async function fetchInteractions(rxcui) {
  const url = `https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

app.get('/api/drug', async (req, res) => {
  try {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Missing `name` query parameter' });

    const data = await fetchRxNormByName(name);

    // Basic parsing: return top matched drug(s) and, if possible, rxcui interactions
    const candidate = (data.drugGroup && data.drugGroup.conceptGroup && data.drugGroup.conceptGroup[0]) || null;

    const result = {
      query: name,
      matches: [],
    };

    // collect matches
    if (data.drugGroup && data.drugGroup.conceptGroup) {
      data.drugGroup.conceptGroup.forEach(group => {
        if (!group.conceptProperties) return;
        group.conceptProperties.forEach(cp => {
          result.matches.push({
            name: cp.name,
            rxcui: cp.rxcui,
            tty: cp.tty,
            language: cp.language
          });
        });
      });
    }

    // If we have at least one RXCUI, fetch interactions for the first
    if (result.matches.length > 0) {
      const rxcui = result.matches[0].rxcui;
      try {
        const interactions = await fetchInteractions(rxcui);
        result.interactionsRaw = interactions || null;

        // Parse interactions to a simpler structure if present
        if (interactions && interactions.interactionTypeGroup) {
          const parsed = [];
          interactions.interactionTypeGroup.forEach(typeGroup => {
            if (!typeGroup.interactionType) return;
            typeGroup.interactionType.forEach(it => {
              if (!it.interactionPair) return;
              it.interactionPair.forEach(pair => {
                parsed.push({
                  description: pair.description || '',
                  severity: pair.severity || 'unknown',
                  interactions: (pair.interactionConcept || []).map(ic => ({
                    name: ic.minConceptItem.name,
                    rxcui: ic.minConceptItem.rxcui
                  }))
                });
              });
            });
          });
          result.interactions = parsed;
        }
      } catch (e) {
        // don't fail entire request if interactions fail
        result.interactionsError = e.message;
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Fallback: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));