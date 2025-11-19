const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Step 1: Add debug logging for all incoming requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

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

// API route for drug search
app.get('/api/drug', async (req, res) => {
  console.log('Hit /api/drug', req.query); // debug log
  try {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Missing `name` query parameter' });

    const data = await fetchRxNormByName(name);

    const result = { query: name, matches: [] };

    // Collect matches
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

    // Fetch interactions for first RXCUI if available
    if (result.matches.length > 0) {
      const rxcui = result.matches[0].rxcui;
      try {
        const interactions = await fetchInteractions(rxcui);
        result.interactionsRaw = interactions || null;

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
        result.interactionsError = e.message;
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
