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

  // Matches list (limit to top 10)
  const matchesEl = document.createElement('div');
  matchesEl.className = 'card';
  matchesEl.innerHTML = `<strong>Matches for "${data.query}"</strong><div class="small">Showing ${Math.min(10, data.matches.length)} of ${data.matches.length} match(es)</div>`;

  const list = document.createElement('ul');
  (data.matches || []).slice(0, 10).forEach(m => { // defensive + top 10
    const li = document.createElement('li');
    li.textContent = `${m.name} (rxcui: ${m.rxcui || '—'})`;
    list.appendChild(li);
  });
  matchesEl.appendChild(list);
  out.appendChild(matchesEl);

  // Interactions
  const interEl = document.createElement('div');
  interEl.className = 'card';
  interEl.innerHTML = `<strong>Interactions</strong>`;

  if (data.interactionsError) {
    interEl.innerHTML += `<div class="small">Could not fetch interactions: ${data.interactionsError}</div>`;
    out.appendChild(interEl);
    return;
  }

  if (!data.interactions || data.interactions.length === 0) {
    interEl.innerHTML += `<div class="small">No interaction data available for the main match.</div>`;
    out.appendChild(interEl);
    return;
  }

  const ul = document.createElement('ul');
  (data.interactions || []).forEach(it => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="badge">${it.severity}</span> ${it.description || 'No description'} <div class="small">Related: ${it.interactions.map(i=>i.name).join(', ')}</div>`;
    ul.appendChild(li);
  });
  interEl.appendChild(ul);
  out.appendChild(interEl);
}

function showError(msg) {
  const out = document.getElementById('results');
  out.innerHTML = `<div class="card">Error: ${msg}</div>`;
}

document.getElementById('searchBtn').addEventListener('click', async () => {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return showError('Please enter a drug name.');
  try {
    document.getElementById('results').innerHTML = '<div class="card">Loading…</div>';
    const data = await searchDrug(q);
    renderResults(data);
  } catch (e) {
    console.error(e);
    showError(e.message);
  }
});

// Enter key support
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});
