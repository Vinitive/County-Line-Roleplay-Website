(() => {
  const config = window.CLRP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const menu = $("menuToggle");
  const nav = $("mainNav");
  menu?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  });
  nav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
    nav.classList.remove("open");
    menu?.setAttribute("aria-expanded", "false");
  }));
  $("year").textContent = new Date().getFullYear();

  const discord = config.discordInviteUrl;
  if (discord && discord !== "https://discord.gg/REPLACE_ME") $("discordLink").href = discord;
  else $("discordLink").addEventListener("click", e => { e.preventDefault(); alert("The County Line Discord invite has not been configured yet."); });

  if (config.connectUrl) $("connectLink").href = config.connectUrl;
  else $("connectLink").addEventListener("click", e => { e.preventDefault(); alert("The FiveM server connection address has not been configured yet."); });

  const setStatus = (online, players, maxPlayers) => {
    const strip = document.querySelector(".status-strip");
    strip.classList.toggle("is-online", online);
    strip.classList.toggle("is-offline", !online);
    $("serverStatus").textContent = online ? "ONLINE" : "OFFLINE";
    $("playerCount").childNodes[0].textContent = Number.isFinite(players) ? players + " " : "— ";
    $("playerMax").textContent = Number.isFinite(maxPlayers) ? maxPlayers : "—";
    $("capacity").textContent = Number.isFinite(players) && Number.isFinite(maxPlayers) && maxPlayers > 0
      ? Math.round(players / maxPlayers * 100) + "% UTILIZED" : "AWAITING DATA";
  };

  const loadStatus = async () => {
    const endpoint = config.statusApiUrl;
    if (!endpoint) {
      $("serverStatus").textContent = "SETUP REQUIRED";
      $("capacity").textContent = "API NOT CONNECTED";
      return;
    }
    try {
      const response = await fetch(endpoint, { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error("Status endpoint returned " + response.status);
      const data = await response.json();
      setStatus(data.online === true, Number(data.players), Number(data.maxPlayers));
    } catch (error) {
      setStatus(false, NaN, NaN);
      console.warn("CLRP server status unavailable:", error);
    }
  };
  loadStatus();
  if (config.statusApiUrl) window.setInterval(loadStatus, 60000);

  $("portalButton")?.addEventListener("click", () => {
    if (config.portalUrl) window.location.href = config.portalUrl;
    else $("portalMessage").textContent = "Player accounts are not connected yet. The secure QBCore portal will be enabled after the API and authentication service are configured.";
  });
})();