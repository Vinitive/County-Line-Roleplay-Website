(() => {
  const form = document.getElementById("applicationForm");
  if (!form) return;
  const department = document.getElementById("department");
  const position = document.getElementById("position");
  const message = document.getElementById("applicationMessage");
  const submit = document.getElementById("submitApplication");
  const choices = {
    leo: ["Patrol Deputy", "State Trooper", "Field Training Officer"],
    ems: ["Firefighter / EMT", "Paramedic", "Fire / EMS Supervisor"],
    civilian: ["Business Owner", "Mechanic", "Civilian Roleplayer"]
  };
  function updatePositions(selected = "") {
    position.innerHTML = '<option value="">Select a position</option>';
    (choices[department.value] || []).forEach(name => {
      const option = document.createElement("option");
      option.value = name; option.textContent = name; position.appendChild(option);
    });
    if (selected && (choices[department.value] || []).includes(selected)) position.value = selected;
  }
  const params = new URLSearchParams(location.search);
  if (["leo", "ems", "civilian"].includes(params.get("department"))) {
    department.value = params.get("department");
    updatePositions(params.get("position") || "");
  }
  department.addEventListener("change", () => updatePositions());
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