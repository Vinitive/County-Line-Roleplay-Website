(() => {
  const cfg = window.CLRP_CONFIG || {};
  const api = String(cfg.portalApiUrl || "").replace(/\/$/, "");
  const $ = id => document.getElementById(id);
  const authPanel = $("authPanel"), dashboard = $("dashboard");
  $("year").textContent = new Date().getFullYear();

  const showError = message => { $("authError").textContent = message || ""; };
  const apiRequest = async (path, options = {}) => {
    if (!api) throw new Error("The portal API has not been configured yet. Ask a server administrator to finish the secure backend setup.");
    const response = await fetch(api + path, { ...options, credentials: "include", headers: { "Accept": "application/json", ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Portal request failed (" + response.status + ").");
    return body;
  };
  const renderUser = user => {
    authPanel.hidden = true; dashboard.hidden = false;
    $("discordName").textContent = user.global_name || user.username || "Discord member";
    $("discordTag").textContent = "@" + (user.username || "member");
    $("discordAvatar").src = user.avatar
      ? "https://cdn.discordapp.com/avatars/" + encodeURIComponent(user.id) + "/" + encodeURIComponent(user.avatar) + ".png?size=128"
      : "https://cdn.discordapp.com/embed/avatars/0.png";
  };
  $("discordLogin").addEventListener("click", () => {
    showError("");
    if (!api) { showError("Portal backend not configured. The website interface is ready, but Discord sign-in needs the Worker URL."); return; }
    window.location.href = api + "/auth/discord";
  });
  $("signOut").addEventListener("click", async () => {
    try { await apiRequest("/api/logout", { method: "POST" }); } catch (e) { console.warn(e); }
    dashboard.hidden = true; authPanel.hidden = false;
  });
  $("startLink").addEventListener("click", () => {
    $("linkNote").textContent = "Secure in-game linking is not active yet. The QBCore verification resource must be installed before a code can be issued.";
  });
  if (api) apiRequest("/api/me").then(data => { if (data.authenticated && data.user) renderUser(data.user); }).catch(error => { if (!/401|Unauthorized/i.test(error.message)) showError(error.message); });
})();