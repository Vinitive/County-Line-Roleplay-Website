(() => {
  const form = document.getElementById("applicationForm");
  if (!form) return;
  const department = document.getElementById("department");
  const position = document.getElementById("position");
  const message = document.getElementById("applicationMessage");
  const submit = document.getElementById("submitApplication");
  const positionsByDepartment = { leo: [], ems: [], civilian: [] };

  function updatePositions(selected = "") {
    position.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a position";
    position.append(placeholder);
    (positionsByDepartment[department.value] || []).forEach(item => {
      const option = document.createElement("option");
      option.value = item.title;
      option.textContent = item.title;
      position.append(option);
    });
    if (selected && (positionsByDepartment[department.value] || []).some(item => item.title === selected)) {
      position.value = selected;
    }
  }

  async function loadPositions() {
    const base = window.CLRP_CONFIG?.portalApiUrl;
    if (!base) throw new Error("Careers service is not configured.");
    const response = await fetch(base.replace(/\/$/, "") + "/api/careers", { headers: { Accept: "application/json" } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load open positions.");
    Object.keys(positionsByDepartment).forEach(key => { positionsByDepartment[key] = []; });
    (result.positions || []).forEach(item => {
      if (positionsByDepartment[item.department]) positionsByDepartment[item.department].push(item);
    });
  }

  const params = new URLSearchParams(location.search);
  department.addEventListener("change", () => updatePositions());
  loadPositions().then(() => {
    if (["leo", "ems", "civilian"].includes(params.get("department"))) department.value = params.get("department");
    updatePositions(params.get("position") || "");
    if (!position.options.length || position.options.length === 1) {
      message.textContent = "There are currently no open positions in this department.";
    }
  }).catch(error => {
    department.disabled = true;
    position.disabled = true;
    submit.disabled = true;
    message.className = "application-message error";
    message.textContent = error.message;
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    message.textContent = "";
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    delete data.truthful;
    data.source = "website";
    submit.disabled = true; submit.textContent = "SUBMITTING...";
    try {
      const base = window.CLRP_CONFIG?.portalApiUrl;
      if (!base) throw new Error("Application service is not configured. Please try again later.");
      const response = await fetch(base.replace(/\/$/, "") + "/api/applications", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "We couldn't submit your application. Please try again.");
      form.reset(); updatePositions();
      message.className = "application-message success";
      message.textContent = "Application received! Your submission has been saved. Thank you for applying.";
    } catch (error) {
      message.className = "application-message error";
      message.textContent = error.message || "Something went wrong. Please try again.";
    } finally {
      submit.disabled = false; submit.textContent = "SUBMIT APPLICATION ↗";
    }
  });
})();