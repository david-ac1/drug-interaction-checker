let currentData = null; 
let currentPage = 1;
const matchesPerPage = 10;
let loggedIn = false;
let currentUser = null; // NEW

// ===========================
// SIGNUP
// ===========================
document.getElementById('signupBtn').addEventListener('click', () => {
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value.trim();
  const confirm = document.getElementById('signupConfirm').value.trim();
  const errorEl = document.getElementById('signupError');

  if (!username || !password || !confirm) {
    errorEl.textContent = 'Please fill all fields.';
    return;
  }

  if (password !== confirm) {
    errorEl.textContent = 'Passwords do not match.';
    return;
  }

  const users = JSON.parse(localStorage.getItem('users') || '{}');

  if (users[username]) {
    errorEl.textContent = 'Username already exists.';
    return;
  }

  users[username] = { password };
  localStorage.setItem('users', JSON.stringify(users));

  loggedIn = true;
  currentUser = username;

  document.getElementById('signupPanel').style.display = 'none';
  document.querySelector('.search-panel').style.display = 'block';
  document.getElementById('settingsButtonContainer').style.display = 'block';

  errorEl.textContent = '';
});

// ===========================
// LOGIN
// ===========================
document.getElementById('loginBtn').addEventListener('click', () => {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorEl = document.getElementById('loginError');

  if (!username || !password) {
    errorEl.textContent = 'Please enter both username and password.';
    return;
  }

  const users = JSON.parse(localStorage.getItem('users') || '{}');

  if (users[username] && users[username].password === password) {
    loggedIn = true;
    currentUser = username;

    document.getElementById('loginPanel').style.display = 'none';
    document.querySelector('.search-panel').style.display = 'block';
    document.getElementById('settingsButtonContainer').style.display = 'block';

    errorEl.textContent = '';
  } else {
    errorEl.textContent = 'Invalid credentials.';
  }
});

// ===========================
// SETTINGS SYSTEM
// ===========================

// Open/close settings panel
document.getElementById('settingsBtn').addEventListener('click', () => {
  const panel = document.getElementById('settingsPanel');
  panel.style.display = (panel.style.display === 'block' ? 'none' : 'block');
});

// Change username
document.getElementById('changeUsernameBtn').addEventListener('click', () => {
  const newUsername = document.getElementById('newUsername').value.trim();
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  const errorEl = document.getElementById('settingsError');
  const successEl = document.getElementById('settingsSuccess');

  errorEl.textContent = '';
  successEl.textContent = '';

  if (!newUsername) {
    errorEl.textContent = 'New username cannot be empty.';
    return;
  }

  if (users[newUsername]) {
    errorEl.textContent = 'A user with this username already exists.';
    return;
  }

  // Move account to new username
  users[newUsername] = users[currentUser];
  delete users[currentUser];

  localStorage.setItem('users', JSON.stringify(users));
  currentUser = newUsername;

  successEl.textContent = 'Username updated successfully!';
});

// Sign out
document.getElementById('signoutBtn').addEventListener('click', () => {
  loggedIn = false;
  currentUser = null;

  document.querySelector('.search-panel').style.display = 'none';
  document.getElementById('settingsPanel').style.display = 'none';
  document.getElementById('settingsButtonContainer').style.display = 'none';

  document.getElementById('loginPanel').style.display = 'block';
  document.getElementById('results').innerHTML = '';
});


// ===========================
// DRUG SEARCH API
// ===========================
async function searchDrug(name) {
  const res = await fetch(`/api/drug?name=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

// ===========================
// RENDER RESULTS
// ===========================
function renderResults(data) {
  const out = document.getElementById('results');
  out.innerHTML = '';

  if (!data.matches || data.matches.length === 0) {
    out.innerHTML = `<div class="card">No matches found for <strong>${data.query}</strong></div>`;
    return;
  }

  const severityFilter = document.getElementById('filterSeverity').value;
  const sortBy = document.getElementById('sortBy').value;

  let matches = [...data.matches];
  if (sortBy === 'alpha') matches.sort((a,b)=>a.name.localeCompare(b.name));

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

  // Pagination
  if (totalPages > 1) {
    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    if (currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = 'Previous';
      prevBtn.addEventListener('click', () => { currentPage--; renderResults(currentData); });
      pagination.appendChild(prevBtn);
    }

    if (currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next';
      nextBtn.addEventListener('click', () => { currentPage++; renderResults(currentData); });
      pagination.appendChild(nextBtn);
    }

    matchesEl.appendChild(pagination);
  }

  out.appendChild(matchesEl);

  // Interactions
  let interactions = [...(data.interactions || [])];
  if (severityFilter !== 'all') {
    interactions = interactions.filter(it => it.severity.toLowerCase() === severityFilter.toLowerCase());
  }

  if (sortBy === 'severity') {
    const severityOrder = { High:1, Moderate:2, Low:3, unknown:4 };
    interactions.sort((a,b)=>(severityOrder[a.severity]||4)-(severityOrder[b.severity]||4));
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

function updateResultsView() {
  currentPage = 1;
  if (currentData) renderResults(currentData);
}

function showError(msg) {
  const out = document.getElementById('results');
  out.innerHTML = `<div class="card">Error: ${msg}</div>`;
}

// ===========================
// SEARCH HANDLER
// ===========================
document.getElementById('searchBtn').addEventListener('click', async () => {
  if (!loggedIn) return showError('Please login first.');
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

// Enter key
document.getElementById('searchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// Filters
document.getElementById('filterSeverity').addEventListener('change', updateResultsView);
document.getElementById('sortBy').addEventListener('change', updateResultsView);
