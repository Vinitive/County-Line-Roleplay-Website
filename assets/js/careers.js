(() => {
  const params = new URLSearchParams(window.location.search);
  const department = params.get("department");
  if (department && ["leo", "ems", "civilian"].includes(department)) {
    window.addEventListener("load", () => {
      document.getElementById(department)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
})();