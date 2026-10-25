function renderAdminShell(activePage) {
  const el = document.getElementById("admin-shell");
  if (!el) return;
  const pages = [
    ["dashboard.html", "Dashboard"], ["markets.html", "Markets"], ["events.html", "Events"],
    ["news.html", "News"], ["predictions.html", "Predictions"], ["shop.html", "Shop"], ["casino.html", "Casino"],
    ["players.html", "Players & Bots"], ["wallet.html", "Wallet & loans"], ["creatorcoins.html", "Creator coins"], ["quiz.html", "Quiz questions"], ["economy.html", "Economy"],
    ["creators.html", "Creators & Badges"], ["audit.html", "Audit log"],
  ];
  el.innerHTML = `
    <h1>Creator Control Room</h1>
    <p class="subtitle">The only place Minewdjhu economy actions happen. The Discord bot cannot do any of this.</p>
    <div class="admin-shell">
      <nav class="admin-sidebar">
        ${pages.map(([href, label]) => `<a href="${href}" class="${href === activePage ? 'active' : ''}">${label}</a>`).join("")}
      </nav>
      <div class="admin-content" id="admin-content"></div>
    </div>`;
}
document.addEventListener("DOMContentLoaded", () => { Auth.requireAdmin(); });
