function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById("pageTitle").textContent = id==="radars" ? "Radar Charts" : "Priorities Tool";
}

// bootstrap
document.addEventListener("DOMContentLoaded", () => {
  renderRadars();
  loadDefaults();
});
