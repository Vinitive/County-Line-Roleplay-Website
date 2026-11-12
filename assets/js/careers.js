(() => {
  const params = new URLSearchParams(window.location.search);
  const department = params.get("department");
  if (department && ["leo", "ems", "civilian"].includes(department)) {
    window.addEventListener("load", () => {
      document.getElementById(department)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  const invite = window.CLRP_CONFIG?.discordInviteUrl;
  if (invite && invite !== "https://discord.gg/REPLACE_ME") {
    document.querySelectorAll(".apply-link").forEach(link => link.href = invite);
  } else {
    document.querySelectorAll(".apply-link").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      alert("The County Line Discord invite has not been configured yet.");
    }));
  }
})();