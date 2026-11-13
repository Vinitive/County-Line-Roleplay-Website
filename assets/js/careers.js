(() => {
  const params = new URLSearchParams(window.location.search);
  const department = params.get("department");
  if (department && ["leo", "ems", "civilian"].includes(department)) {
    window.addEventListener("load", () => {
      document.getElementById(department)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const cfg = window.CLRP_CONFIG || {};
  const api = String(cfg.portalApiUrl || "").replace(/\/$/, "");
  const departments = {
    leo: { id: "leo", label: "LAW ENFORCEMENT" },
    ems: { id: "ems", label: "FIRE & EMS" },
    civilian: { id: "civilian", label: "CIVILIAN" }
  };

  const loadPositions = async () => {
    if (!api) return;
    try {
      const response = await fetch(api + "/api/careers", { headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load positions.");
      Object.values(departments).forEach(dept => {
        const section = document.getElementById(dept.id);
        const host = section?.querySelector(".career-positions");
        const count = section?.querySelector(".opening-count");
        if (!host) return;
        host.replaceChildren();
        const positions = (result.positions || []).filter(item => item.department === dept.id);
        if (count) count.textContent = positions.length ? positions.length + " OPEN POSITION" + (positions.length === 1 ? "" : "S") : "NO OPEN POSITIONS";
        if (!positions.length) {
          const empty = document.createElement("p");
          empty.className = "career-intro";
          empty.textContent = "There are currently no open positions in this department. Check back soon.";
          host.append(empty);
          return;
        }
        positions.forEach(position => {
          const card = document.createElement("article");
          card.className = "position-card";
          const copy = document.createElement("div");
          const type = document.createElement("span");
          type.className = "position-type";
          type.textContent = position.position_type || "OPEN POSITION";
          const title = document.createElement("h3");
          title.textContent = position.title;
          const description = document.createElement("p");
          description.textContent = position.description;
          copy.append(type, title, description);
          const link = document.createElement("a");
          link.className = "btn btn-outline apply-link";
          link.href = "application.html?department=" + encodeURIComponent(position.department) + "&position=" + encodeURIComponent(position.title);
          link.textContent = "APPLY NOW ↗";
          card.append(copy, link);
          host.append(card);
        });
      });
    } catch (error) {
      console.error("Careers feed:", error);
      document.querySelectorAll(".career-positions").forEach(host => {
        host.replaceChildren();
        const message = document.createElement("p");
        message.className = "career-intro";
        message.textContent = "Open positions are temporarily unavailable. Please refresh the page.";
        host.append(message);
      });
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadPositions);
  else loadPositions();
})();