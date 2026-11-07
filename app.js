const incidents = [
  { id: "INC-2048", title: "Tanker spill · chemical leak", location: "Bandra–Worli Sea Link", level: "P1", kind: "p1", time: "09:42", units: "3 units assigned", description: "Hazmat incident", x: "47%", y: "46%" },
  { id: "INC-2047", title: "Residential structure fire", location: "Lower Parel · Ward 195", level: "P2", kind: "p2", time: "09:31", units: "2 units assigned", description: "Structure fire", x: "65%", y: "69%" },
  { id: "INC-2046", title: "Flash flood warning", location: "Mithi River · Kurla", level: "P3", kind: "p3", time: "09:18", units: "Monitoring", description: "Flood monitoring", x: "78%", y: "30%" },
];
const list = document.querySelector("#incident-list");
const toast = document.querySelector("#toast");
const dialog = document.querySelector("#approval-dialog");
const API_BASE = String(window.AEGIS_CONFIG?.apiBase || "").replace(/\/$/, "");
let toastTimer;

function renderIncidents() {
  list.innerHTML = incidents.map((incident) => `
    <article class="incident-card" data-id="${incident.id}" tabindex="0" role="button" aria-label="Show ${escapeHtml(incident.title)} on map">
      <i class="severity-bar ${incident.kind}"></i><div class="incident-info"><div class="incident-title">${escapeHtml(incident.title)} <span class="priority ${incident.kind}">${incident.level}</span></div>
      <p>${escapeHtml(incident.location)}</p><div class="incident-meta">${incident.id}<span>·</span>${incident.units}</div></div><span class="incident-time">${incident.time}</span>
    </article>`).join("");
  document.querySelector("#incident-count").textContent = String(incidents.length).padStart(2, "0");
  document.querySelector("#metric-incidents").textContent = String(incidents.length).padStart(2, "0");
  list.querySelectorAll(".incident-card").forEach((card) => {
    card.addEventListener("click", () => focusIncident(incidents.find((item) => item.id === card.dataset.id)));
    card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); card.click(); } });
  });
}

function focusIncident(item) {
  if (!item) return;
  const marker = document.querySelector("#map-marker");
  marker.style.left = item.x;
  marker.style.top = item.y;
  document.querySelector("#map-title").textContent = item.description;
  document.querySelector("#map-location").textContent = `${item.location} · ${item.level}`;
  document.querySelector("#map-tooltip").style.left = `calc(${item.x} + 19px)`;
  document.querySelector("#map-tooltip").style.top = `calc(${item.y} - 8px)`;
  showToast(`${item.id} selected on the demo map`);
}

function acceptRealtimeIncident(item) {
  if (!item || !item.id) return;
  const existing = incidents.findIndex((incident) => incident.id === item.id);
  const normalized = {
    id: String(item.id), title: String(item.title || "Incoming incident"),
    location: String(item.location || "Location pending verification"),
    level: String(item.severity || "P3"), kind: ["P1", "P2", "P3"].includes(String(item.severity).toUpperCase()) ? String(item.severity).toLowerCase() : "p3",
    time: item.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
    units: item.units || "Awaiting commander review", description: item.category || "New incident",
    x: item.mapX || `${30 + Math.floor(Math.random() * 40)}%`, y: item.mapY || `${30 + Math.floor(Math.random() * 40)}%`,
  };
  if (existing >= 0) incidents.splice(existing, 1, normalized);
  else incidents.unshift(normalized);
  renderIncidents();
  document.querySelector("#run-time").textContent = "· just now";
  showToast(`New ${normalized.level} incident received: ${normalized.title}`);
}

function startRealtime() {
  const status = document.querySelector("#connection-status");
  document.querySelector("#wall-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  setInterval(() => { document.querySelector("#wall-clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }, 15000);
  if (API_BASE) {
    const stream = new EventSource(`${API_BASE}/api/events`);
    stream.onopen = () => { status.innerHTML = "<i></i> LIVE FEED CONNECTED"; };
    stream.onerror = () => { status.innerHTML = "<i></i> RECONNECTING"; };
    stream.addEventListener("incident", (event) => {
      try { acceptRealtimeIncident(JSON.parse(event.data)); } catch { showToast("Received an unreadable incident event."); }
    });
    return;
  }
  status.title = "Browser-only generated sample incidents; connect a backend for external feeds.";
  const simulationCases = [
    { title: "Road obstruction reported", location: "Eastern Express Highway", category: "Traffic obstruction", severity: "P3" },
    { title: "Localized waterlogging", location: "Kurla West · Ward 169", category: "Flood monitoring", severity: "P3" },
    { title: "Power line hazard reported", location: "Matunga East · Ward 186", category: "Electrical hazard", severity: "P2" },
  ];
  let sequence = 2050;
  setInterval(() => {
    const sample = simulationCases[(sequence - 2050) % simulationCases.length];
    acceptRealtimeIncident({ ...sample, id: `SIM-${sequence++}` });
  }, 45000);
}

document.querySelector("#new-incident").addEventListener("click", runDemo);
function runDemo() {
  const button = document.querySelector("#new-incident");
  if (button.disabled) return;
  button.disabled = true;
  button.innerHTML = '<span>◌</span> Running agents…';
  if (API_BASE) fetch(`${API_BASE}/api/demo/run`, { method: "POST" }).catch(() => showToast("Demo backend is not reachable; showing the local simulation."));
  const flow = document.querySelector("#agent-flow");
  const status = document.querySelector("#flow-status");
  const steps = [...flow.querySelectorAll(".agent-step")];
  steps.forEach((step) => step.classList.remove("done", "review", "working"));
  status.innerHTML = "<i></i> RUNNING";
  let index = 0;
  steps[index].classList.add("working");
  const interval = setInterval(() => {
    steps[index].classList.remove("working");
    steps[index].classList.add("done");
    index++;
    if (index < steps.length - 1) {
      steps[index].classList.add("working");
      return;
    }
    clearInterval(interval);
    finishDemo(button, steps, status);
  }, 550);
}

function finishDemo(button, steps, status) {
  if (!API_BASE) {
    const alreadyAdded = incidents.some((item) => item.id === "INC-2049");
    if (!alreadyAdded) incidents.unshift({ id: "INC-2049", title: "Multi-vehicle collision", location: "Western Express Highway · Andheri", level: "P1", kind: "p1", time: "09:48", units: "2 units recommended", description: "Traffic collision", x: "33%", y: "56%" });
    renderIncidents();
    focusIncident(incidents[0]);
  }
  document.querySelector("#metric-checks").textContent = "25";
  document.querySelector("#run-time").textContent = "· just now";
  steps[3].classList.add("review");
  steps[3].querySelector("small").textContent = "P1 alert drafted · approval required";
  status.innerHTML = "<i></i> COMPLETED";
  button.disabled = false;
  button.innerHTML = '<span>＋</span> Run demo incident';
  showToast("Demo incident processed. Commander review is required.");
}

document.querySelector("#approve-button").addEventListener("click", () => dialog.showModal());
document.querySelector("#confirm-approval").addEventListener("click", () => {
  const approval = document.querySelector("#approval-box");
  approval.style.borderColor = "#2d6653";
  approval.style.background = "#142820";
  approval.querySelector(".approval-symbol").textContent = "✓";
  approval.querySelector(".approval-symbol").style.color = "#6de0b1";
  approval.querySelector(".approval-symbol").style.background = "#1c4537";
  approval.querySelector("b").textContent = "Alert approved in demo";
  approval.querySelector("p").textContent = "No public alert was sent.";
  document.querySelector(".review-tag").textContent = "APPROVED";
  document.querySelector(".review-tag").style.color = "var(--green)";
  document.querySelector("#approve-button").remove();
  showToast("Approval recorded in the demo interface only.");
});
document.querySelector("#view-all").addEventListener("click", () => showToast(`${incidents.length} simulated incidents are listed.`));
document.querySelector("#fleet-toggle").addEventListener("click", () => showToast("Fleet inventory is simulated for this demo."));
document.querySelector(".map-expand").addEventListener("click", () => showToast("Map view is a schematic, not live GIS data."));
document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach((link) => link.classList.remove("active"));
  item.classList.add("active");
}));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}
renderIncidents();
startRealtime();
