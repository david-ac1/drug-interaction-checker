let currentData = null; // store last fetched results

async function searchDrug(name) {
  const res = await fetch(`/api/drug?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

function renderResults(data) {
  const out = document.getElementById('results');
  out.innerHTML = '';

  if (!data.matches || data.matches.length === 0) {
    out.innerHTML = `<div class="card">No matches found for <strong>${data.query}</strong></div>`;
    return;
  }

  const severityFilter = document.getElementById('filterSeverity').value;
  const sortBy = document.getElementById('sortBy').value;

  // --- Matches ---
  let matches = [...data.matches];
  if (sortBy === 'alpha') {
    matches.sort((a, b) => a.name.localeCompare(b.name));
  }

  const matchesEl = document.createElement('div');
  matchesEl.className = 'card';
  matchesEl.innerHTML = `<strong>Matches for "${data.query}"</strong><div class="small">Showing ${Math.min(10, matches.length)} of ${matches.length} match(es)</div>`;

  const list = document.createElement('ul');
  matches.slice(0, 10).forEach(m => {
    const li = document.createElement('li');
    li.textContent = `${m.name} (rxcui: ${m.rxcui || '—'})`;
    list.appendChild(li);
  });
  matchesEl.appendChild(list);
  out.appendChild(matchesEl);

  // --- Interactions ---
  let interactions = [...(data.interactions || [])];

  if (severityFilter !== 'all') {
    interactions = interactions.filter(it => it.severity.toLowerCase() === severityFilter.toLowerCase());
  }

  if (sortBy === 'severity') {
    const severityOrder = { High: 1, Moderate: 2, Low: 3, unknown: 4 };
    interactions.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));
  }

  const interEl = document.createElement('div');
  interEl.className = 'card';
  interEl.innerHTML = `<strong>Interactions</strong>`;

  if (data.interactionsError) {
    interEl.innerHTML += `<div class="small">Could not fetch interactions: ${data.interactionsError}</div>`;
    out.appendChild(interEl);
    return;
  }

  if (!interactions || interactions.length === 0) {
    interEl.innerHTML += `<div class="small">No interaction data available for the main match.</div>`;
    out.appendChild(interEl);
    return;
  }

  const ul = document.createElement('ul');
  interactions.forEach(it => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="badge">${it.severity}</span> ${it.description || 'No description'} <div class="small">Related: ${it.interactions.map(i=>i.name).join(', ')}</div>`;
    ul.appendChild(li);
  });
  interEl.appendChild(ul);
  out.appendChild(interEl);
}

// --- Update results view when filter or sort changes ---
function updateResultsView() {
  if (currentData) renderResults(currentData);
}

function showError(msg) {
  const out = document.getElementById('results');
  out.innerHTML = `<div class="card">Error: ${msg}</div>`;
}

// --- Search Button ---
document.getElementById('searchBtn').addEventListener('click', async () => {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return showError('Please enter a drug name.');
  try {
    document.getElementById('results').innerHTML = '<div class="card">Loading…</div>';
    currentData = await searchDrug(q);
    renderResults(currentData);
  } catch (e) {
    console.error(e);
    showError(e.message);
  }
});

// --- Enter Key ---
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// --- Filter & Sort Changes ---
document.getElementById('filterSeverity').addEventListener('change', updateResultsView);
document.getElementById('sortBy').addEventListener('change', updateResultsView);
