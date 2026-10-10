// Minewdjhu frontend, shared API client.
// =========================================
// Every page includes config.js then this file. Auth uses a bearer token
// (not a cookie, the site and the API are on different origins), kept in
// localStorage. See docs/ARCHITECTURE.md "Auth model" for why.

// Pages inside /admin/ need "../" in front of links to the main site.
const ROOT = window.location.pathname.includes("/admin/") ? "../" : "";

const Auth = {
  TOKEN_KEY: "mwd_token",
  USERNAME_KEY: "mwd_username",
  IS_ADMIN_KEY: "mwd_is_admin",
  BALANCE_KEY: "mwd_balance",

  getToken() { return localStorage.getItem(this.TOKEN_KEY); },
  getUsername() { return localStorage.getItem(this.USERNAME_KEY); },
  isAdmin() { return localStorage.getItem(this.IS_ADMIN_KEY) === "true"; },
  isLoggedIn() { return !!this.getToken(); },

  setSession(token, username, isAdmin) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USERNAME_KEY, username);
    localStorage.setItem(this.IS_ADMIN_KEY, isAdmin ? "true" : "false");
    localStorage.removeItem(this.BALANCE_KEY); // never show the previous player's balance
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    localStorage.removeItem(this.IS_ADMIN_KEY);
    localStorage.removeItem(this.BALANCE_KEY);
  },

  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = ROOT + "login.html";
    }
  },

  requireAdmin() {
    if (!this.isLoggedIn() || !this.isAdmin()) {
      window.location.href = ROOT + "index.html";
    }
  },
};

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const Api = {
  async _request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = Auth.getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    let resp;
    try {
      resp = await fetch(API_BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError(
        "Couldn't reach the Minewdjhu server. It might be restarting, or the tunnel URL in " +
        "js/config.js might be out of date, ask whoever runs the server.",
        0
      );
    }

    let data = null;
    const text = await resp.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = null; }
    }

    if (resp.status === 401 && path !== "/api/auth/login") {
      Auth.clearSession();
    }

    if (!resp.ok) {
      const message = (data && data.error) || `Request failed (${resp.status})`;
      throw new ApiError(message, resp.status);
    }
    // Anything that can change money (trade, spin, bank...) is a POST, so re-check the balance.
    if (method === "POST" && !path.startsWith("/api/auth/") && Auth.isLoggedIn()) scheduleBalanceRefresh();
    return data;
  },

  get(path) { return this._request("GET", path); },
  post(path, body) { return this._request("POST", path, body === undefined ? {} : body); },
};

// --- Small shared UI helpers, used across every page ------------------------
// Anything a player can type (market names, chat, titles...) goes through esc() before it is
// put on a page, so nobody can inject HTML or script into other people's browsers.
function esc(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function money(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value) {
  const n = Number(value) || 0;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function showError(el, err) {
  if (!el) return;
  el.textContent = err instanceof Error ? err.message : String(err);
  el.classList.remove("hidden");
}

function clearError(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// --- Shared nav bar, injected into every page's <div id="nav"></div> --------
function renderNav() {
  const el = document.getElementById("nav");
  if (!el) return;
  const loggedIn = Auth.isLoggedIn();
  const here = window.location.pathname.split("/").pop() || "index.html";
  const link = (href, label) =>
    `<a href="${ROOT}${href}" class="${here === href ? "current" : ""}">${label}</a>`;
  el.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="${ROOT}index.html"><span class="brand-mark">M</span><span>Minewdjhu</span></a>
      ${loggedIn ? `<a class="nav-balance" id="nav-balance" href="${ROOT}profile.html" title="Your wallet balance">
        <span class="nav-balance-coin" aria-hidden="true"></span>
        <span class="nav-balance-label">Wallet</span>
        <span class="nav-balance-value" id="nav-balance-value">${cachedBalanceText()}</span>
      </a>` : ""}
      <button class="nav-toggle" aria-label="Menu" onclick="document.getElementById('nav').classList.toggle('open')">Menu</button>
      <nav class="mainnav">
        ${link("markets.html", "Markets")}
        ${link("arcade.html", "Arcade")}
        ${link("bank.html", "Bank")}
        ${link("events.html", "Events")}
        ${link("news.html", "News")}
        ${link("leaderboard.html", "Leaderboard")}
        ${link("records.html", "Records")}
        ${link("badges.html", "Badges")}
      </nav>
      <div class="nav-user">
        ${loggedIn ? `
          <a class="bell" href="${ROOT}notifications.html" title="Notifications">&#128276;<span id="bell-count" class="bell-count hidden"></span></a>
          <a class="nav-link" href="${ROOT}profile.html">${Auth.getUsername()}</a>
          ${Auth.isAdmin() ? `<a class="nav-link admin-link" href="${ROOT}admin/dashboard.html">Control Room</a>` : ""}
          <button class="link-btn" onclick="Auth.clearSession(); window.location.href='${ROOT}index.html';">Log out</button>
        ` : `
          <a class="nav-link" href="${ROOT}login.html">Log in</a>
          <a class="nav-btn" href="${ROOT}register.html">Sign up</a>
        `}
      </div>
    </div>`;
  if (loggedIn) { refreshBell(); refreshBalance(); startBalancePolling(); }
}

// --- Always-visible wallet balance ------------------------------------------
function cachedBalanceText() {
  const raw = localStorage.getItem(Auth.BALANCE_KEY);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? money(n) : "...";
}

let balanceInFlight = false;
async function refreshBalance() {
  const valueEl = document.getElementById("nav-balance-value");
  if (!valueEl || !Auth.isLoggedIn() || balanceInFlight) return;
  balanceInFlight = true;
  try {
    const me = await Api.get("/api/profile/me");
    const now = Number(me.balance);
    if (!Number.isFinite(now)) return;
    const rawPrev = localStorage.getItem(Auth.BALANCE_KEY);
    const prev = rawPrev === null ? NaN : Number(rawPrev);
    valueEl.textContent = money(now);
    localStorage.setItem(Auth.BALANCE_KEY, String(now));
    if (Number.isFinite(prev) && Math.abs(now - prev) > 0.004) {
      const chip = document.getElementById("nav-balance");
      if (chip) {
        chip.classList.remove("bal-up", "bal-down");
        void chip.offsetWidth; // restart the flash
        chip.classList.add(now > prev ? "bal-up" : "bal-down");
      }
    }
  } catch (e) { /* the balance chip is a nicety, never block a page on it */ }
  finally { balanceInFlight = false; }
}

let balanceTimer = null;
function scheduleBalanceRefresh() {
  clearTimeout(balanceTimer);
  balanceTimer = setTimeout(refreshBalance, 400);
}

let balancePollingOn = false;
function startBalancePolling() {
  if (balancePollingOn) return;
  balancePollingOn = true;
  // Light touch: once a minute, and only while this tab is actually on screen.
  setInterval(() => { if (document.visibilityState === "visible") refreshBalance(); }, 60000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshBalance(); });
}

async function refreshBell() {
  try {
    const list = await Api.get("/api/notifications?limit=50");
    const unread = list.filter((n) => !n.is_read).length;
    const badge = document.getElementById("bell-count");
    if (badge && unread > 0) { badge.textContent = unread > 9 ? "9+" : unread; badge.classList.remove("hidden"); }
  } catch (e) { /* the bell is a nicety, never block a page on it */ }
}

// Explorer badge: remember which pages this browser has opened, report once when it has seen them all.
const EXPLORE_PAGES = ["index.html", "markets.html", "market.html", "arcade.html", "bank.html", "events.html",
                       "news.html", "leaderboard.html", "records.html", "profile.html", "badges.html", "about.html"];
function trackExplorer() {
  if (!Auth.isLoggedIn() || window.location.pathname.includes("/admin/")) return;
  const page = window.location.pathname.split("/").pop() || "index.html";
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem("mwd_seen_pages") || "[]"); } catch (e) { seen = []; }
  if (!seen.includes(page)) { seen.push(page); localStorage.setItem("mwd_seen_pages", JSON.stringify(seen)); }
  if (EXPLORE_PAGES.every((p) => seen.includes(p)) && !localStorage.getItem("mwd_explorer_sent")) {
    Api.post("/api/badges/milestone/visited_everything").then(() => localStorage.setItem("mwd_explorer_sent", "1")).catch(() => {});
  }
}

function reportMilestone(kind) {
  if (Auth.isLoggedIn()) Api.post("/api/badges/milestone/" + kind).catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => { renderNav(); trackExplorer(); });
