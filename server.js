const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// --- User storage setup ---
const USERS_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));

function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Debug logging for all requests
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// --- RxNorm helpers ---
async function fetchRxNormByName(name) {
  const url = `https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RxNorm responded with ${res.status}`);
  return res.json();
}

async function fetchInteractions(rxcui) {
  const url = `https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// --- API routes ---

// Signup
app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const users = getUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username already exists' });

  const hashed = await bcrypt.hash(password, 10);
  users.push({ username, password: hashed });
  saveUsers(users);

  res.json({ success: true, message: 'User created' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  const users = getUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(400).json({ error: 'Invalid username or password' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Invalid username or password' });

  res.json({ success: true, message: 'Logged in' });
});

// Drug search
app.get('/api/drug', async (req, res) => {
  console.log('Hit /api/drug', req.query);
  try {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Missing `name` query parameter' });

    const data = await fetchRxNormByName(name);
    const result = { query: name, matches: [] };

    // Collect matches
    if (data.drugGroup?.conceptGroup) {
      data.drugGroup.conceptGroup.forEach(group => {
        group.conceptProperties?.forEach(cp => {
          result.matches.push({
            name: cp.name,
            rxcui: cp.rxcui,
            tty: cp.tty,
            language: cp.language
          });
        });
      });
    }

    // Fetch interactions for first RXCUI
    if (result.matches.length > 0) {
      const rxcui = result.matches[0].rxcui;
      try {
        const interactions = await fetchInteractions(rxcui);
        result.interactionsRaw = interactions || null;

        if (interactions?.interactionTypeGroup) {
          const parsed = [];
          interactions.interactionTypeGroup.forEach(typeGroup => {
            typeGroup.interactionType?.forEach(it => {
              it.interactionPair?.forEach(pair => {
                parsed.push({
                  description: pair.description || '',
                  severity: pair.severity || 'unknown',
                  interactions: pair.interactionConcept?.map(ic => ({
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start server ---
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
