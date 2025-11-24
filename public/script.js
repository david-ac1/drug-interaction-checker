/* ============================
   AUTH SYSTEM (LOCAL STORAGE)
   ============================ */

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getUsers() {
  return JSON.parse(localStorage.getItem("users")) || [];
}

function setLoggedInUser(username) {
  localStorage.setItem("loggedInUser", username);
}

function getLoggedInUser() {
  return localStorage.getItem("loggedInUser");
}

function logout() {
  localStorage.removeItem("loggedInUser");
  showLoginPanel();
}

/* ============================
   UI PANEL MANAGEMENT
   ============================ */

function showLoginPanel() {
  document.getElementById("loginPanel").style.display = "block";
  document.getElementById("signupPanel").style.display = "none";
  document.getElementById("settingsPanel").style.display = "none";
  document.getElementById("settingsButtonContainer").style.display = "none";
  document.getElementById("searchPanel").style.display = "none";
  document.getElementById("results").innerHTML = "";
}

function showSignupPanel() {
  document.getElementById("loginPanel").style.display = "none";
  document.getElementById("signupPanel").style.display = "block";
}

function showSearchPanel() {
  document.getElementById("loginPanel").style.display = "none";
  document.getElementById("signupPanel").style.display = "none";
  document.getElementById("settingsPanel").style.display = "none";
  document.getElementById("settingsButtonContainer").style.display = "block";
  document.getElementById("searchPanel").style.display = "block";
}

/* ============================
   SIGN UP
   ============================ */

document.getElementById("signupBtn").onclick = () => {
  const username = document.getElementById("signupUsername").value.trim();
  const pw = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirm").value;

  const error = document.getElementById("signupError");

  if (!username || !pw || !confirm) {
    error.textContent = "All fields required";
    return;
  }

  if (pw !== confirm) {
    error.textContent = "Passwords do not match";
    return;
  }

  const users = getUsers();
  if (users.find(u => u.username === username)) {
    error.textContent = "Username already exists";
    return;
  }

  users.push({ username, password: pw });
  saveUsers(users);
  error.textContent = "";
  alert("Account created! Please login.");
  showLoginPanel();
};

/* ============================
   LOGIN
   ============================ */

document.getElementById("loginBtn").onclick = () => {
  const username = document.getElementById("username").value.trim();
  const pw = document.getElementById("password").value;

  const users = getUsers();
  const found = users.find(u => u.username === username && u.password === pw);

  if (!found) {
    document.getElementById("loginError").textContent = "Invalid username or password";
    return;
  }

  setLoggedInUser(username);
  showSearchPanel();
};

/* Switch between panels */
document.getElementById("showSignup").onclick = (e) => {
  e.preventDefault();
  showSignupPanel();
};

document.getElementById("showLogin").onclick = (e) => {
  e.preventDefault();
  showLoginPanel();
};

/* ============================
   SETTINGS
   ============================ */

document.getElementById("settingsBtn").onclick = () => {
  document.getElementById("settingsPanel").style.display = "block";
};

document.getElementById("signoutBtn").onclick = () => {
  logout();
};

document.getElementById("changeUsernameBtn").onclick = () => {
  const newName = document.getElementById("newUsername").value.trim();
  const error = document.getElementById("settingsError");
  const success = document.getElementById("settingsSuccess");

  if (!newName) {
    error.textContent = "Username cannot be empty";
    return;
  }

  const users = getUsers();
  const current = getLoggedInUser();

  if (users.find(u => u.username === newName)) {
    error.textContent = "Username already taken";
    return;
  }

  // Update username
  const user = users.find(u => u.username === current);
  user.username = newName;
  saveUsers(users);

  setLoggedInUser(newName);

  error.textContent = "";
  success.textContent = "Username updated!";
};

/* ============================
   DRUG SEARCH (RXNAV API)
   ============================ */

async function searchDrug(name) {
  const formatted = name.toLowerCase();

  // STEP 1 — Search for drug and get RXCUI
  const rxcuiRes = await fetch(
    `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(formatted)}`
  );

  if (!rxcuiRes.ok) throw new Error("Drug not found (404)");

  const rxcuiData = await rxcuiRes.json();
  if (!rxcuiData.idGroup.rxnormId) throw new Error("No matching drug");

  const rxcui = rxcuiData.idGroup.rxnormId[0];

  // STEP 2 — Get interactions
  const interactRes = await fetch(
    `https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${rxcui}`
  );

  const interactData = await interactRes.json();
  return interactData;
}

function renderResults(data) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (!data || !data.interactionTypeGroup) {
    container.innerHTML = "<p>No interactions found.</p>";
    return;
  }

  const list = [];

  data.interactionTypeGroup.forEach(group => {
    group.interactionType.forEach(type => {
      type.interactionPair.forEach(pair => {
        list.push({
          desc: pair.description,
          severity: pair.severity || "Moderate"
        });
      });
    });
  });

  if (list.length === 0) {
    container.innerHTML = "<p>No interaction data available.</p>";
    return;
  }

  let html = "";
  list.forEach(item => {
    html += `
      <div class="card result-card">
         <h3>${item.severity}</h3>
         <p>${item.desc}</p>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ============================
   SEARCH BUTTON
   ============================ */

document.getElementById("searchBtn").onclick = async () => {
  const searchInput = document.getElementById("searchInput").value.trim();
  const resultsBox = document.getElementById("results");

  if (!searchInput) {
    resultsBox.innerHTML = "<p>Please enter a drug name.</p>";
    return;
  }

  resultsBox.innerHTML = "<p>Searching…</p>";

  try {
    const data = await searchDrug(searchInput);
    renderResults(data);
  } catch (e) {
    resultsBox.innerHTML = `<p class="error">${e.message}</p>`;
  }
};

/* ============================
   AUTO LOGIN ON REFRESH
   ============================ */

window.onload = () => {
  if (getLoggedInUser()) {
    showSearchPanel();
  }
};
