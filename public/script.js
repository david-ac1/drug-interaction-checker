let currentData = null; 
let currentPage = 1;
const matchesPerPage = 10; // display 10 matches per page

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

  const totalPages = Math.ceil(matches.length / matchesPerPage);
  const startIndex = (currentPage - 1) * matchesPerPage;
  const endIndex = startIndex + matchesPerPage;
  const pagedMatches = matches.slice(startIndex, endIndex);

  const matchesEl = document.createElement('div');
  matchesEl.className = 'card';
  matchesEl.innerHTML = `<strong>Matches for "${data.query}"</strong>
    <div class="small">Showing ${startIndex + 1}–${Math.min(endIndex, matches.length)} of ${matches.length} match(es)</div>`;

  const list = document.createElement('ul');
  pagedMatches.forEach(m => {
    const li = document.createElement('li');
    li.textContent = `${m.name} (rxcui: ${m.rxcui || '—'})`;
    list.appendChild(li);
  });
  matchesEl.appendChild(list);

  // --- Pagination Controls ---
  if (totalPages > 1) {
    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    if (currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = 'Previous';
      prevBtn.addEventListener('click', () => {
        currentPage--;
        renderResults(currentData);
      });
      pagination.appendChild(prevBtn);
    }

    if (currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next';
      nextBtn.addEventListener('click', () => {
        currentPage++;
        renderResults(currentData);
      });
      pagination.appendChild(nextBtn);
    }

    matchesEl.appendChild(pagination);
  }

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
    li.innerHTML = `<span class="badge">${it.severity}</span> ${it.description || 'No description'} 
      <div class="small">Related: ${it.interactions.map(i=>i.name).join(', ')}</div>`;
    ul.appendChild(li);
  });
  interEl.appendChild(ul);
  out.appendChild(interEl);
}

// --- Update results view ---
function updateResultsView() {
  currentPage = 1; // reset page when filter/sort changes
  if (currentData) renderResults(currentData);
}

function showError(msg) {
  const out = document.getElementById('results');
  out.innerHTML = `<div class="card">Error: ${msg}</div>`;
}

// --- Search ---
document.getElementById('searchBtn').addEventListener('click', async () => {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return showError('Please enter a drug name.');
  try {
    document.getElementById('results').innerHTML = '<div class="card">Loading…</div>';
    currentData = await searchDrug(q);
    currentPage = 1;
    renderResults(currentData);
  } catch (e) {
    console.error(e);
    showError(e.message);
  }
});

// --- Enter key ---
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// --- Filter & Sort ---
document.getElementById('filterSeverity').addEventListener('change', updateResultsView);
document.getElementById('sortBy').addEventListener('change', updateResultsView);
