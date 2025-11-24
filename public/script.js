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
  appState.selectedDrugs = [];
  appState.drugData = {};
  appState.allInteractions = [];
  renderDrugList();
  document.getElementById("results").innerHTML = "";
  document.getElementById("filtersContainer").classList.add("hidden");
  showLoginPanel();
}

/* ============================
   APP STATE (IN-MEMORY, PER TAB)
   ============================ */

const appState = {
  selectedDrugs: [], // array of keys (lowercased names)
  drugData: {}, // key -> { label, displayName, interactions }
  allInteractions: [] // flattened interaction list with drugName
};

/* ============================
   UI PANEL MANAGEMENT
   ============================ */

function showLoginPanel() {
  document.body.classList.add("auth-screen");
  document.getElementById("loginPanel").classList.remove("hidden");
  document.getElementById("signupPanel").classList.add("hidden");
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("settingsBackdrop").classList.add("hidden");
  document.getElementById("settingsButtonContainer").classList.add("hidden");
  document.getElementById("searchPanel").classList.add("hidden");
  document.getElementById("results").innerHTML = "";
}

function showSignupPanel() {
  document.body.classList.add("auth-screen");
  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("signupPanel").classList.remove("hidden");
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("settingsBackdrop").classList.add("hidden");
}

function showSearchPanel() {
  document.body.classList.remove("auth-screen");
  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("signupPanel").classList.add("hidden");
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("settingsBackdrop").classList.add("hidden");
  document.getElementById("settingsButtonContainer").classList.remove("hidden");
  document.getElementById("searchPanel").classList.remove("hidden");
}

/* ============================
   SIGN UP
   ============================ */

document.getElementById("signupBtn").onclick = () => {
  const username = document.getElementById("signupUsername").value.trim();
  const pw = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirm").value;
  const error = document.getElementById("signupError");

  error.textContent = "";

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
  alert("Account created! Please login.");

  document.getElementById("signupUsername").value = "";
  document.getElementById("signupPassword").value = "";
  document.getElementById("signupConfirm").value = "";
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

  document.getElementById("loginError").textContent = "";
  setLoggedInUser(username);
  showSearchPanel();
};

// panel toggles
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
  document.getElementById("settingsPanel").classList.remove("hidden");
  document.getElementById("settingsBackdrop").classList.remove("hidden");
};

document.getElementById("closeSettingsBtn").onclick = () => {
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("settingsBackdrop").classList.add("hidden");
};

document.getElementById("settingsBackdrop").onclick = () => {
  document.getElementById("settingsPanel").classList.add("hidden");
  document.getElementById("settingsBackdrop").classList.add("hidden");
};

document.getElementById("signoutBtn").onclick = () => {
  logout();
};

document.getElementById("changeUsernameBtn").onclick = () => {
  const newName = document.getElementById("newUsername").value.trim();
  const error = document.getElementById("settingsError");
  const success = document.getElementById("settingsSuccess");

  error.textContent = "";
  success.textContent = "";

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

  const user = users.find(u => u.username === current);
  if (!user) {
    error.textContent = "Current user not found";
    return;
  }

  user.username = newName;
  saveUsers(users);
  setLoggedInUser(newName);

  success.textContent = "Username updated!";
  document.getElementById("newUsername").value = "";
};

/* ============================
   DRUG SEARCH USING openFDA
   ============================ */

async function searchDrugInFDA(drugName) {
  const formatted = encodeURIComponent(drugName.trim());

  // More forgiving query: look in brand OR generic name and allow partial match
  const url = `https://api.fda.gov/drug/label.json?search=(openfda.generic_name:%22${formatted}%22+OR+openfda.brand_name:%22${formatted}%22+OR+openfda.substance_name:%22${formatted}%22)&limit=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Drug not found");
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No drug information found");
  }

  return data.results[0];
}

function getDrugDisplayName(drugLabel, fallbackName) {
  if (drugLabel.openfda) {
    if (drugLabel.openfda.brand_name && drugLabel.openfda.brand_name.length) {
      return drugLabel.openfda.brand_name[0];
    }
    if (drugLabel.openfda.generic_name && drugLabel.openfda.generic_name.length) {
      return drugLabel.openfda.generic_name[0];
    }
  }
  return fallbackName || "Unknown drug";
}

function determineSeverity(text) {
  const lower = text.toLowerCase();
  if (
    lower.includes("contraindicated") ||
    lower.includes("severe") ||
    lower.includes("serious") ||
    lower.includes("fatal") ||
    lower.includes("death") ||
    lower.includes("life-threatening")
  ) {
    return "high";
  }
  if (
    lower.includes("caution") ||
    lower.includes("monitor") ||
    lower.includes("moderate") ||
    lower.includes("risk")
  ) {
    return "moderate";
  }
  return "low";
}

function extractInteractions(drugLabel) {
  const interactions = [];

  if (Array.isArray(drugLabel.drug_interactions)) {
    drugLabel.drug_interactions.forEach(text => {
      interactions.push({
        type: "drug-drug",
        description: text,
        severity: determineSeverity(text)
      });
    });
  }

  if (Array.isArray(drugLabel.warnings)) {
    drugLabel.warnings.forEach(text => {
      if (text.toLowerCase().includes("interaction")) {
        interactions.push({
          type: "warning",
          description: text,
          severity: "high"
        });
      }
    });
  }

  if (Array.isArray(drugLabel.contraindications)) {
    drugLabel.contraindications.forEach(text => {
      interactions.push({
        type: "contraindication",
        description: text,
        severity: "high"
      });
    });
  }

  return interactions;
}

/* ============================
   DRUG LIST MANAGEMENT
   ============================ */

function renderDrugList() {
  const container = document.getElementById("drugList");
  const wrapper = document.getElementById("drugListContainer");

  if (!container || !wrapper) return;

  container.innerHTML = "";

  appState.selectedDrugs.forEach((key, index) => {
    const info = appState.drugData[key];
    const name = info ? info.displayName : key;

    const div = document.createElement("div");
    div.className = "drug-item";
    div.innerHTML = `
      <span><strong>${name}</strong></span>
      <button type="button" data-index="${index}">Remove</button>
    `;
    container.appendChild(div);
  });

  if (appState.selectedDrugs.length > 0) {
    wrapper.classList.remove("hidden");
  } else {
    wrapper.classList.add("hidden");
  }

  // wire remove buttons
  container.querySelectorAll("button[data-index]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      if (!Number.isNaN(idx)) {
        const key = appState.selectedDrugs[idx];
        appState.selectedDrugs.splice(idx, 1);
        if (key && appState.drugData[key]) {
          delete appState.drugData[key];
        }
        renderDrugList();
      }
    });
  });
}

/* ============================
   INTERACTION RENDERING
   ============================ */

function renderResults() {
  const container = document.getElementById("results");
  const severityFilter = document.getElementById("filterSeverity").value;
  const sortBy = document.getElementById("sortBy").value;

  let items = [...appState.allInteractions];

  if (severityFilter !== "all") {
    items = items.filter(i => i.severity === severityFilter);
  }

  if (sortBy === "severity") {
    const order = { high: 0, moderate: 1, low: 2 };
    items.sort((a, b) => order[a.severity] - order[b.severity]);
  } else if (sortBy === "name") {
    items.sort((a, b) => a.drugName.localeCompare(b.drugName));
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="panel-card empty-state">
        <div class="empty-icon">💊</div>
        <div class="empty-text">No interactions found${
          severityFilter !== "all" ? " for the selected severity level" : ""
        }.</div>
      </div>
    `;
    return;
  }

  let html = "";
  items.forEach(interaction => {
    const truncated =
      interaction.description && interaction.description.length > 350
        ? interaction.description.slice(0, 350) + "..."
        : interaction.description;

    html += `
      <div class="result-card severity-${interaction.severity}">
        <div>
          <span class="badge severity-${interaction.severity}">${
            interaction.severity.toUpperCase()
          }</span>
          <strong>${interaction.drugName}</strong> - ${interaction.type}
        </div>
        <p style="margin-top: 12px; color: #495057;">${truncated}</p>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ============================
   EVENT HANDLERS FOR DRUG WORKFLOW
   ============================ */

document.getElementById("addDrugBtn").onclick = async () => {
  const input = document.getElementById("searchInput");
  const msgEl = document.getElementById("searchMessage");
  const rawName = input.value.trim();

  msgEl.textContent = "";
  msgEl.className = "info";

  if (!rawName) {
    msgEl.textContent = "Please enter a drug name";
    msgEl.className = "error";
    return;
  }

  const key = rawName.toLowerCase();

  if (appState.selectedDrugs.includes(key)) {
    msgEl.textContent = "Drug already added";
    msgEl.className = "error";
    return;
  }

  msgEl.textContent = "Searching FDA database...";

  try {
    const label = await searchDrugInFDA(rawName);
    const displayName = getDrugDisplayName(label, rawName);
    const interactions = extractInteractions(label);

    appState.selectedDrugs.push(key);
    appState.drugData[key] = {
      label,
      displayName,
      interactions
    };

    input.value = "";
    msgEl.textContent = `Added ${displayName} successfully!`;
    msgEl.className = "success";

    renderDrugList();

    setTimeout(() => {
      msgEl.textContent = "";
    }, 3000);
  } catch (err) {
    msgEl.textContent = `Error: ${err.message}. Try another drug name.`;
    msgEl.className = "error";
  }
};

document.getElementById("clearAllBtn").onclick = () => {
  appState.selectedDrugs = [];
  appState.drugData = {};
  appState.allInteractions = [];
  renderDrugList();
  document.getElementById("results").innerHTML = "";
  document.getElementById("filtersContainer").classList.add("hidden");
};

document.getElementById("checkInteractionsBtn").onclick = () => {
  if (appState.selectedDrugs.length < 2) {
    alert("Please add at least 2 drugs to check interactions");
    return;
  }

  appState.allInteractions = [];

  appState.selectedDrugs.forEach(key => {
    const info = appState.drugData[key];
    if (!info || !Array.isArray(info.interactions)) return;

    info.interactions.forEach(interaction => {
      appState.allInteractions.push({
        ...interaction,
        drugName: info.displayName
      });
    });
  });

  document.getElementById("filtersContainer").classList.remove("hidden");
  renderResults();
};

// filters
document.getElementById("filterSeverity").onchange = renderResults;
document.getElementById("sortBy").onchange = renderResults;

/* ============================
   ENTER KEY SHORTCUTS
   ============================ */

const searchInputEl = document.getElementById("searchInput");
if (searchInputEl) {
  searchInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("addDrugBtn").click();
    }
  });
}

const usernameEl = document.getElementById("username");
if (usernameEl) {
  usernameEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("loginBtn").click();
    }
  });
}

const passwordEl = document.getElementById("password");
if (passwordEl) {
  passwordEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      document.getElementById("loginBtn").click();
    }
  });
}

/* ============================
   AUTO LOGIN ON REFRESH
   ============================ */

window.addEventListener("load", () => {
  if (getLoggedInUser()) {
    showSearchPanel();
  } else {
    showLoginPanel();
  }
});
