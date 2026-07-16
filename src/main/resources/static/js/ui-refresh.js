(() => {
"use strict";
const state = {
initialized: false,
drawer: null,
drawerOverlay: null,
drawerConfig: null,
activeDialog: null,
nativeAlert: window.alert.bind(window)
};
const pageConfigs = {
clients: {
formId: "clientForm",
formEntity: "Client",
createLabel: "New Client",
listBodyIds: ["clientsTable"],
editFunctions: ["editClient"],
resetFunction: "resetClientForm",
searchPlaceholder: "Search clients by name, contact, email or status"
},
resources: {
formId: "resourceForm",
formEntity: "Resource",
createLabel: "New Resource",
listBodyIds: ["resourcesTable"],
editFunctions: ["editResource"],
resetFunction: "resetResourceForm",
searchPlaceholder: "Search people by name, skill, department or manager"
},
projects: {
formId: "projectForm",
formEntity: "Project",
createLabel: "New Project",
listBodyIds: ["implementationProjectsTable", "supportProjectsTable"],
editFunctions: ["editProject"],
resetFunction: "resetProjectForm",
searchPlaceholder: "Search projects by code, client, owner or status",
wideDrawer: true
},
tasks: {
formId: "taskForm",
formEntity: "Task",
createLabel: "New Task",
listBodyIds: ["tasksTable"],
editFunctions: ["editTask"],
resetFunction: "resetTaskForm",
searchPlaceholder: "Search tasks by code, project, assignee or status",
wideDrawer: true
}
};
const statusGroups = {
success: new Set([
"COMPLETED",
"APPROVED",
"RESOLVED",
"CLOSED",
"ACTIVE"
]),
info: new Set([
"IN_PROGRESS",
"OPEN",
"ACKNOWLEDGED",
"REOPENED",
"GO_LIVE",
"POST_LIVE",
"P2"
]),
warning: new Set([
"PENDING_APPROVAL",
"WAITING_FOR_CLIENT",
"WAITING_FOR_INTERNAL",
"ON_HOLD",
"MEDIUM",
"HIGH",
"P3"
]),
danger: new Set([
"DELAYED",
"BLOCKED",
"ESCALATED",
"CRITICAL",
"REJECTED",
"CANCELLED",
"INACTIVE",
"P1"
]),
neutral: new Set([
"DRAFT",
"NOT_STARTED",
"RECALLED",
"MOVED_TO_SUPPORT",
"LOW",
"P4",
"NEW"
])
};
function normalizePageKey() {
const path = window.location.pathname
.replace(/\/+$/, "")
.replace(/\.html$/i, "");
return path.split("/").filter(Boolean).pop() || "dashboard";
}
function initialize() {
if (state.initialized || !document.querySelector(".app-layout")) {
return;
}
state.initialized = true;
const pageKey = normalizePageKey();
document.body.classList.add("professional-ui", `page-${pageKey}`);
ensureViewportMeta();
ensureUiRoot();
patchSharedHelpers();
installProfessionalAlerts();
enhanceLabels();
enhanceButtons();
enhanceSections();
enhanceTables();
restyleExistingBadges();
simplifyTopbar();
initializeDashboard();
initializeDrawer(pageKey);
initializeListToolbar(pageKey);
initializeDeleteConfirmation();
initializeKeyboardHandling();
initializeSupportHeadingObserver();
initializeProjectMemberVisibility();
initializeMutationObserver();
}
function ensureViewportMeta() {
if (document.querySelector('meta[name="viewport"]')) {
return;
}
const viewport = document.createElement("meta");
viewport.name = "viewport";
viewport.content = "width=device-width, initial-scale=1.0";
document.head.appendChild(viewport);
}
function ensureUiRoot() {
if (!document.getElementById("pmsUiRoot")) {
const root = document.createElement("div");
root.id = "pmsUiRoot";
document.body.appendChild(root);
}
if (!document.getElementById("pmsToastRegion")) {
const region = document.createElement("div");
region.id = "pmsToastRegion";
region.className = "pms-toast-region";
region.setAttribute("aria-live", "polite");
region.setAttribute("aria-atomic", "true");
document.body.appendChild(region);
}
}
function patchSharedHelpers(attempt = 0) {
if (typeof PMS === "undefined") {
if (attempt < 30) {
window.setTimeout(() => patchSharedHelpers(attempt + 1), 100);
}
return;
}
PMS.badge = status => {
const displayValue = status
? String(status).replaceAll("_", " ")
: "N/A";
return `
<span class="badge ${getStatusClass(status)}">
${escapeHtml(displayValue)}
</span>
`;
};
PMS.showError = error => {
console.error(error);
const message = error?.message
|| "Something went wrong. Please try again.";
toast(message, "error", 6500);
};
}
function getStatusClass(status) {
const value = String(status || "").toUpperCase().replaceAll(" ", "_");
if (statusGroups.success.has(value)) {
return "badge-success";
}
if (statusGroups.info.has(value)) {
return "badge-info";
}
if (statusGroups.warning.has(value)) {
return "badge-warning";
}
if (statusGroups.danger.has(value)) {
return "badge-danger";
}
return "badge-neutral";
}
function restyleExistingBadges(root = document) {
if (!(root instanceof Element || root instanceof Document)) {
return;
}
root.querySelectorAll(".badge").forEach(element => {
const value = element.textContent.trim();
element.classList.remove(
"badge-success",
"badge-info",
"badge-warning",
"badge-danger",
"badge-neutral"
);
element.classList.add(getStatusClass(value));
});
}
function enhanceLabels(root = document) {
root.querySelectorAll("label").forEach(label => {
if (label.htmlFor || label.querySelector("input, select, textarea")) {
return;
}
const group = label.closest(".form-group");
const control = group?.querySelector("input[id], select[id], textarea[id]");
if (control) {
label.htmlFor = control.id;
}
});
root.querySelectorAll("input[required], select[required], textarea[required]")
.forEach(control => {
if (!control.id) {
return;
}
const label = document.querySelector(
`label[for="${cssEscape(control.id)}"]`
);
if (!label || label.querySelector(".required-mark")) {
return;
}
const marker = document.createElement("span");
marker.className = "required-mark";
marker.textContent = "*";
marker.setAttribute("aria-hidden", "true");
label.appendChild(marker);
});
}
function enhanceButtons(root = document) {
const iconRules = [
{ pattern: /refresh/i, icon: "bi-arrow-clockwise" },
{ pattern: /save|create|add/i, icon: "bi-check2-circle" },
{ pattern: /update/i, icon: "bi-check2-circle" },
{ pattern: /clear|cancel/i, icon: "bi-x-circle" },
{ pattern: /back/i, icon: "bi-arrow-left" },
{ pattern: /report/i, icon: "bi-file-earmark-bar-graph" }
];
root.querySelectorAll("button.btn").forEach(button => {
if (button.querySelector("i") || button.dataset.uiIconEnhanced === "true") {
return;
}
const label = button.textContent.trim();
const rule = iconRules.find(item => item.pattern.test(label));
if (!rule) {
return;
}
button.dataset.uiIconEnhanced = "true";
button.innerHTML = `
<i class="bi ${rule.icon}" aria-hidden="true"></i>
<span>${escapeHtml(label)}</span>
`;
});
root.querySelectorAll("button.action-link").forEach(button => {
if (button.dataset.uiActionEnhanced === "true") {
return;
}
const label = button.textContent.trim();
let icon = "bi-pencil-square";
if (/delete|remove/i.test(label)) {
icon = "bi-trash3";
} else if (/view|report|summary/i.test(label)) {
icon = "bi-eye";
} else if (/member|allocate/i.test(label)) {
icon = "bi-people";
} else if (/support/i.test(label)) {
icon = "bi-headset";
}
button.dataset.uiActionEnhanced = "true";
button.innerHTML = `
<i class="bi ${icon}" aria-hidden="true"></i>
<span>${escapeHtml(label)}</span>
`;
});
}
function enhanceSections() {
document.querySelectorAll("main.main > .section").forEach((section, index) => {
section.classList.add("ui-section");
section.dataset.sectionIndex = String(index + 1);
const title = section.querySelector(":scope > .section-header .section-title");
if (!title) {
return;
}
let headingWrap = title.parentElement;
if (headingWrap?.classList.contains("section-header")) {
const wrapper = document.createElement("div");
wrapper.className = "ui-section-heading";
headingWrap.insertBefore(wrapper, title);
wrapper.appendChild(title);
headingWrap = wrapper;
}
if (headingWrap && !headingWrap.querySelector(".ui-section-kicker")) {
const kicker = document.createElement("div");
kicker.className = "ui-section-kicker";
kicker.textContent = getSectionKicker(title.textContent);
headingWrap.insertBefore(kicker, title);
}
});
}
function getSectionKicker(title) {
const value = String(title || "").toLowerCase();
if (value.includes("client")) {
return "Customer Operations";
}
if (value.includes("resource") || value.includes("people")) {
return "Workforce";
}
if (value.includes("project")) {
return "Delivery Portfolio";
}
if (value.includes("task")) {
return "Work Execution";
}
if (value.includes("timesheet")) {
return "Effort Management";
}
if (value.includes("support")) {
return "Service Operations";
}
if (value.includes("escalat")) {
return "Risk & Attention";
}
return "Workspace";
}
function simplifyTopbar() {
const apply = () => {
const topbar = document.getElementById("topbar");
if (!topbar) {
return;
}
const managerTitle = topbar.querySelector(".user-manager-title");
if (managerTitle) {
managerTitle.hidden = true;
}
const managerName = topbar.querySelector(".user-manager-name");
const userChip = topbar.querySelector(".user-chip");
if (managerName && userChip) {
userChip.title = `Reports to: ${managerName.textContent.trim() || "Not assigned"}`;
}
};
apply();
const topbar = document.getElementById("topbar");
if (topbar) {
new MutationObserver(apply).observe(topbar, {
childList: true,
subtree: true
});
}
}
function initializeDashboard() {
const sourceGrid = document.querySelector(".content-grid");
if (!sourceGrid || sourceGrid.dataset.uiGrouped === "true") {
return;
}
const cardsById = new Map();
sourceGrid.querySelectorAll(".card, .cost_card").forEach(card => {
const value = card.querySelector(".metric-value");
if (value?.id) {
cardsById.set(value.id, card);
}
});
if (!cardsById.size) {
return;
}
sourceGrid.dataset.uiGrouped = "true";
sourceGrid.classList.add("dashboard-summary-grid");
const groups = [
{
title: "Delivery Portfolio",
subtitle: "Project health and completion",
icon: "bi-kanban",
ids: [
"totalProjects",
"activeProjects",
"completedProjects",
"delayedProjects"
]
},
{
title: "Work Execution",
subtitle: "Task progress and delivery risk",
icon: "bi-list-check",
ids: [
"totalTasks",
"completedTasks",
"delayedTasks",
"escalatedTasks"
]
},
{
title: "Organisation & Risk",
subtitle: "People, clients, cost and escalations",
icon: "bi-building-check",
ids: [
"totalClients",
"totalResources",
"totalAllocations",
"openEscalations",
"criticalEscalations",
"totalCost"
]
}
];
const metricIcons = {
totalClients: "bi-buildings",
totalProjects: "bi-kanban",
activeProjects: "bi-play-circle",
completedProjects: "bi-check-circle",
delayedProjects: "bi-exclamation-triangle",
totalCost: "bi-currency-dollar",
totalResources: "bi-people",
totalAllocations: "bi-person-workspace",
totalTasks: "bi-list-task",
completedTasks: "bi-check2-square",
delayedTasks: "bi-clock-history",
escalatedTasks: "bi-arrow-up-right-circle",
openEscalations: "bi-exclamation-circle",
criticalEscalations: "bi-shield-exclamation"
};
sourceGrid.innerHTML = "";
groups.forEach(group => {
const wrapper = document.createElement("section");
wrapper.className = "metric-group";
wrapper.innerHTML = `
<div class="metric-group-header">
<div class="metric-group-icon">
<i class="bi ${group.icon}" aria-hidden="true"></i>
</div>
<div>
<h2>${escapeHtml(group.title)}</h2>
<p>${escapeHtml(group.subtitle)}</p>
</div>
</div>
<div class="metric-group-grid"></div>
`;
const groupGrid = wrapper.querySelector(".metric-group-grid");
group.ids.forEach(id => {
const card = cardsById.get(id);
if (!card) {
return;
}
card.classList.add("metric-card");
card.dataset.metric = id;
if (!card.querySelector(".metric-card-icon")) {
const icon = document.createElement("div");
icon.className = "metric-card-icon";
icon.innerHTML = `
<i class="bi ${metricIcons[id] || "bi-bar-chart"}" aria-hidden="true"></i>
`;
card.appendChild(icon);
}
groupGrid.appendChild(card);
});
sourceGrid.appendChild(wrapper);
});
}
function initializeDrawer(pageKey) {
const config = pageConfigs[pageKey];
if (!config) {
return;
}
const form = document.getElementById(config.formId);
const formSection = form?.closest(".section");
const listSection = findListSection(config.listBodyIds);
if (!form || !formSection || !listSection || formSection.classList.contains("hidden")) {
return;
}
const overlay = document.createElement("div");
overlay.className = "ui-drawer-overlay";
overlay.setAttribute("aria-hidden", "true");
const drawer = document.createElement("aside");
drawer.className = `ui-drawer${config.wideDrawer ? " ui-drawer-wide" : ""}`;
drawer.setAttribute("role", "dialog");
drawer.setAttribute("aria-modal", "true");
drawer.setAttribute("aria-label", `${config.formEntity} form`);
const closeButton = document.createElement("button");
closeButton.type = "button";
closeButton.className = "ui-drawer-close";
closeButton.setAttribute("aria-label", "Close form");
closeButton.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
closeButton.addEventListener("click", closeDrawer);
const header = formSection.querySelector(":scope > .section-header");
if (header) {
header.appendChild(closeButton);
}
formSection.classList.add("ui-drawer-section");
drawer.appendChild(formSection);
overlay.appendChild(drawer);
document.body.appendChild(overlay);
overlay.addEventListener("mousedown", event => {
if (event.target === overlay) {
closeDrawer();
}
});
state.drawer = drawer;
state.drawerOverlay = overlay;
state.drawerConfig = config;
const sectionHeader = listSection.querySelector(":scope > .section-header");
if (sectionHeader && !sectionHeader.querySelector(".ui-create-button")) {
const actionWrap = ensureHeaderActions(sectionHeader);
const createButton = document.createElement("button");
createButton.type = "button";
createButton.className = "btn btn-primary ui-create-button";
createButton.innerHTML = `
<i class="bi bi-plus-lg" aria-hidden="true"></i>
<span>${escapeHtml(config.createLabel)}</span>
`;
createButton.addEventListener("click", () => {
const reset = window[config.resetFunction];
if (typeof reset === "function") {
reset();
}
setDrawerMode("create");
openDrawer();
});
actionWrap.prepend(createButton);
}
const secondaryButton = form.querySelector(".form-actions .btn-secondary");
if (secondaryButton) {
secondaryButton.innerHTML = `
<i class="bi bi-x-circle" aria-hidden="true"></i>
<span>Cancel</span>
`;
}
wrapEditFunctions(config);
wrapResetFunction(config);
}
function findListSection(bodyIds) {
for (const id of bodyIds) {
const section = document.getElementById(id)?.closest(".section");
if (section) {
return section;
}
}
return null;
}
function ensureHeaderActions(sectionHeader) {
let actions = sectionHeader.querySelector(":scope > .ui-header-actions");
if (actions) {
return actions;
}
actions = document.createElement("div");
actions.className = "ui-header-actions";
Array.from(sectionHeader.children).forEach(child => {
if (child.matches("button, .form-actions, .compact-actions")) {
actions.appendChild(child);
}
});
sectionHeader.appendChild(actions);
return actions;
}
function wrapEditFunctions(config) {
config.editFunctions.forEach(name => {
const original = window[name];
if (typeof original !== "function" || original.__uiWrapped) {
return;
}
const wrapped = function (...args) {
setDrawerMode("edit");
openDrawer();
return original.apply(this, args);
};
wrapped.__uiWrapped = true;
wrapped.__original = original;
window[name] = wrapped;
});
}
function wrapResetFunction(config) {
const original = window[config.resetFunction];
if (typeof original !== "function" || original.__uiWrapped) {
return;
}
const wrapped = function (...args) {
const result = original.apply(this, args);
closeDrawer();
return result;
};
wrapped.__uiWrapped = true;
wrapped.__original = original;
window[config.resetFunction] = wrapped;
}
function setDrawerMode(mode) {
if (!state.drawerConfig || !state.drawer) {
return;
}
const title = state.drawer.querySelector(".section-title");
if (title) {
title.textContent = mode === "edit"
? `Update ${state.drawerConfig.formEntity}`
: `Create ${state.drawerConfig.formEntity}`;
}
state.drawer.dataset.mode = mode;
}
function openDrawer() {
if (!state.drawerOverlay) {
return;
}
state.drawerOverlay.classList.add("open");
state.drawerOverlay.setAttribute("aria-hidden", "false");
document.body.classList.add("ui-drawer-open");
window.setTimeout(() => {
state.drawer
?.querySelector("input:not([type='hidden']), select, textarea")
?.focus();
}, 120);
}
function closeDrawer() {
if (!state.drawerOverlay) {
return;
}
state.drawerOverlay.classList.remove("open");
state.drawerOverlay.setAttribute("aria-hidden", "true");
document.body.classList.remove("ui-drawer-open");
}
function initializeListToolbar(pageKey) {
const config = pageConfigs[pageKey];
if (config) {
const listSection = findListSection(config.listBodyIds);
if (listSection) {
createListToolbar(listSection, config);
}
}
if (pageKey === "projects") {
const membersSection = document.getElementById("projectMembersSection");
if (membersSection) {
createListToolbar(membersSection, {
listBodyIds: ["projectMembersTable"],
searchPlaceholder: "Search allocated people or project roles"
});
}
}
}
function createListToolbar(section, config) {
if (section.querySelector(":scope > .ui-list-toolbar") || section.querySelector(".pms-server-toolbar")) {
return;
}
const toolbar = document.createElement("div");
toolbar.className = "ui-list-toolbar";
toolbar.innerHTML = `
<label class="ui-table-search">
<i class="bi bi-search" aria-hidden="true"></i>
<input
type="search"
placeholder="${escapeHtml(config.searchPlaceholder || "Search records")}"
aria-label="Search records">
<button
type="button"
class="ui-search-clear"
aria-label="Clear search"
hidden>
<i class="bi bi-x-circle-fill" aria-hidden="true"></i>
</button>
</label>
<div class="ui-list-meta">
<span class="ui-result-count">0 records</span>
</div>
`;
const header = section.querySelector(":scope > .section-header");
if (header) {
header.insertAdjacentElement("afterend", toolbar);
} else {
section.prepend(toolbar);
}
const input = toolbar.querySelector("input");
const clearButton = toolbar.querySelector(".ui-search-clear");
const applyFilter = () => {
const query = input.value.trim().toLowerCase();
clearButton.hidden = !query;
config.listBodyIds.forEach(id => {
const tbody = document.getElementById(id);
if (!tbody) {
return;
}
Array.from(tbody.rows).forEach(row => {
if (row.querySelector(".empty-state")) {
return;
}
row.hidden = Boolean(query)
&& !row.textContent.toLowerCase().includes(query);
});
});
scheduleToolbarCount(toolbar);
};
input.addEventListener("input", applyFilter);
clearButton.addEventListener("click", () => {
input.value = "";
input.focus();
applyFilter();
});
registerToolbarCounter(toolbar);
}
function registerToolbarCounter(toolbar) {
if (toolbar.dataset.uiCounterRegistered === "true") {
return;
}
toolbar.dataset.uiCounterRegistered = "true";
const section = toolbar.closest(".section");
if (section) {
new MutationObserver(() => scheduleToolbarCount(toolbar)).observe(section, {
childList: true,
subtree: true,
attributes: true,
attributeFilter: ["hidden", "class", "style"]
});
}
scheduleToolbarCount(toolbar);
window.setTimeout(() => scheduleToolbarCount(toolbar), 150);
window.setTimeout(() => scheduleToolbarCount(toolbar), 600);
}
function scheduleToolbarCount(toolbar) {
window.requestAnimationFrame(() => updateToolbarCount(toolbar));
}
function updateToolbarCount(toolbar) {
const section = toolbar.closest(".section");
const counter = toolbar.querySelector(".ui-result-count");
if (!section || !counter) {
return;
}
const rows = Array.from(section.querySelectorAll("tbody tr"))
.filter(row => !row.querySelector(".empty-state"))
.filter(row => !row.hidden)
.filter(isElementVisible);
const count = rows.length;
const nextText = `${count} ${count === 1 ? "record" : "records"}`;
if (counter.textContent.trim() !== nextText) {
counter.textContent = nextText;
}
}
function isElementVisible(element) {
if (!element || element.hidden || element.closest(".hidden")) {
return false;
}
let current = element;
while (current && current !== document.body) {
const style = window.getComputedStyle(current);
if (style.display === "none" || style.visibility === "hidden") {
return false;
}
current = current.parentElement;
}
return true;
}
function enhanceTables(root = document) {
root.querySelectorAll("table").forEach(table => {
table.classList.add("ui-data-table");
const headers = Array.from(table.querySelectorAll("thead th"));
const idIndexes = [];
headers.forEach((header, index) => {
const label = header.textContent.trim();
if (/^id$/i.test(label)) {
header.classList.add("ui-technical-column");
idIndexes.push(index);
}
if (/action/i.test(label)) {
header.classList.add("ui-action-column");
}
});
Array.from(table.tBodies).forEach(tbody => {
Array.from(tbody.rows).forEach(row => {
Array.from(row.cells).forEach((cell, index) => {
const header = headers[index];
if (header) {
cell.dataset.label = header.textContent.trim();
}
if (idIndexes.includes(index)) {
cell.classList.add("ui-technical-column");
}
if (header?.classList.contains("ui-action-column")) {
cell.classList.add("ui-action-column");
}
});
});
});
});
}
function initializeMutationObserver() {
let scheduled = false;
const observer = new MutationObserver(mutations => {
const relevant = mutations.some(mutation =>
Array.from(mutation.addedNodes).some(node =>
node.nodeType === Node.ELEMENT_NODE
)
);
if (!relevant || scheduled) {
return;
}
scheduled = true;
window.requestAnimationFrame(() => {
scheduled = false;
enhanceLabels();
enhanceButtons();
enhanceTables();
restyleExistingBadges();
document.querySelectorAll(".ui-list-toolbar")
.forEach(registerToolbarCounter);
});
});
observer.observe(document.body, {
childList: true,
subtree: true
});
}
function initializeDeleteConfirmation() {
document.addEventListener("click", async event => {
const button = event.target.closest("button[onclick]");
if (!button || button.dataset.uiDeleteBypass === "true") {
return;
}
const expression = button.getAttribute("onclick")?.trim() || "";
const parsed = parseDeleteExpression(expression);
if (!parsed) {
return;
}
event.preventDefault();
event.stopImmediatePropagation();
const confirmed = await confirmDialog(
getDeleteTitle(parsed.functionName),
getDeleteMessage(parsed.functionName)
);
if (!confirmed) {
return;
}
const callback = window[parsed.functionName];
if (typeof callback !== "function") {
return;
}
const previousConfirm = window.confirm;
window.confirm = () => true;
button.dataset.uiDeleteBypass = "true";
try {
callback(...parsed.arguments);
} finally {
window.confirm = previousConfirm;
delete button.dataset.uiDeleteBypass;
}
}, true);
}
function parseDeleteExpression(expression) {
const match = expression.match(/^(delete[A-Za-z0-9_$]*)\(([^)]*)\);?$/);
if (!match) {
return null;
}
const functionName = match[1];
const argumentText = match[2].trim();
let args = [];
if (argumentText) {
try {
args = JSON.parse(`[${argumentText.replaceAll("'", '"')}]`);
} catch (error) {
return null;
}
}
return {
functionName,
arguments: args
};
}
function getDeleteTitle(functionName) {
if (/Client/.test(functionName)) {
return "Delete client?";
}
if (/Resource/.test(functionName)) {
return "Delete resource?";
}
if (/ProjectMember/.test(functionName)) {
return "Remove project member?";
}
if (/Project/.test(functionName)) {
return "Delete project?";
}
if (/Task/.test(functionName)) {
return "Delete task?";
}
if (/TimeLog/.test(functionName)) {
return "Delete work log?";
}
if (/Ticket/.test(functionName)) {
return "Delete support ticket?";
}
return "Delete record?";
}
function getDeleteMessage(functionName) {
if (/ProjectMember/.test(functionName)) {
return "This person will be removed from the selected project allocation.";
}
return "This action cannot be undone. Please confirm that you want to continue.";
}
function initializeKeyboardHandling() {
document.addEventListener("keydown", event => {
if (event.key !== "Escape") {
return;
}
closeDrawer();
closeActiveDialog(false);
});
}
function installProfessionalAlerts() {
window.alert = message => {
alertDialog("Information", String(message ?? ""));
};
}
function toast(message, type = "info", duration = 4200) {
const region = document.getElementById("pmsToastRegion");
if (!region) {
state.nativeAlert(message);
return;
}
const iconMap = {
success: "bi-check-circle-fill",
error: "bi-exclamation-octagon-fill",
warning: "bi-exclamation-triangle-fill",
info: "bi-info-circle-fill"
};
const titleMap = {
success: "Success",
error: "Action could not be completed",
warning: "Attention",
info: "Information"
};
const item = document.createElement("div");
item.className = `pms-toast pms-toast-${type}`;
item.innerHTML = `
<i class="bi ${iconMap[type] || iconMap.info}" aria-hidden="true"></i>
<div class="pms-toast-copy">
<strong>${escapeHtml(titleMap[type] || titleMap.info)}</strong>
<span>${escapeHtml(message)}</span>
</div>
<button type="button" aria-label="Dismiss notification">
<i class="bi bi-x-lg" aria-hidden="true"></i>
</button>
`;
let dismissed = false;
const dismiss = () => {
if (dismissed) {
return;
}
dismissed = true;
item.classList.add("leaving");
window.setTimeout(() => item.remove(), 180);
};
item.querySelector("button").addEventListener("click", dismiss);
region.appendChild(item);
window.setTimeout(dismiss, duration);
}
function alertDialog(title, message) {
return showDialog({
title,
message,
icon: "bi-info-circle",
confirmText: "OK",
cancelText: null,
tone: "info"
});
}
function confirmDialog(title, message) {
return showDialog({
title,
message,
icon: "bi-exclamation-triangle",
confirmText: "Confirm",
cancelText: "Cancel",
tone: "danger"
});
}
function promptDialog({
title,
message = "",
value = "",
placeholder = "",
required = false,
type = "text",
min = null,
max = null
}) {
closeActiveDialog(null);
return new Promise(resolve => {
const overlay = document.createElement("div");
overlay.className = "ui-confirm-overlay open";
overlay.id = "activeUiDialog";
overlay.innerHTML = `
<form
class="ui-confirm-card"
role="dialog"
aria-modal="true"
aria-labelledby="uiPromptTitle">
<div class="ui-confirm-icon ui-confirm-icon-info">
<i class="bi bi-pencil-square" aria-hidden="true"></i>
</div>
<div class="ui-confirm-content">
<h2 id="uiPromptTitle">${escapeHtml(title)}</h2>
${message ? `<p>${escapeHtml(message)}</p>` : ""}
<div class="ui-prompt-field">
<input
id="uiPromptInput"
type="${escapeHtml(type)}"
value="${escapeHtml(value)}"
placeholder="${escapeHtml(placeholder)}"
${required ? "required" : ""}
${min !== null ? `min="${escapeHtml(min)}"` : ""}
${max !== null ? `max="${escapeHtml(max)}"` : ""}>
<div class="ui-prompt-error" aria-live="polite"></div>
</div>
</div>
<div class="ui-confirm-actions">
<button type="button" class="btn btn-secondary" data-prompt-cancel>
Cancel
</button>
<button type="submit" class="btn btn-primary">
Continue
</button>
</div>
</form>
`;
state.activeDialog = {
overlay,
resolve
};
const form = overlay.querySelector("form");
const input = overlay.querySelector("#uiPromptInput");
const errorElement = overlay.querySelector(".ui-prompt-error");
const finish = result => closeDialogInstance(overlay, resolve, result);
form.addEventListener("submit", event => {
event.preventDefault();
const result = input.value;
if (required && !result.trim()) {
errorElement.textContent = "This value is required.";
input.focus();
return;
}
if (type === "number") {
const number = Number(result);
if (
Number.isNaN(number)
|| (min !== null && number < Number(min))
|| (max !== null && number > Number(max))
) {
errorElement.textContent = `Enter a value between ${min} and ${max}.`;
input.focus();
return;
}
}
finish(result);
});
overlay.querySelector("[data-prompt-cancel]")
.addEventListener("click", () => finish(null));
overlay.addEventListener("mousedown", event => {
if (event.target === overlay) {
finish(null);
}
});
document.body.appendChild(overlay);
input.focus();
input.select();
});
}
function showDialog({
title,
message,
icon,
confirmText,
cancelText,
tone
}) {
closeActiveDialog(false);
return new Promise(resolve => {
const overlay = document.createElement("div");
overlay.className = "ui-confirm-overlay open";
overlay.id = "activeUiDialog";
overlay.innerHTML = `
<div
class="ui-confirm-card"
role="alertdialog"
aria-modal="true"
aria-labelledby="uiDialogTitle">
<div class="ui-confirm-icon ui-confirm-icon-${escapeHtml(tone)}">
<i class="bi ${escapeHtml(icon)}" aria-hidden="true"></i>
</div>
<div class="ui-confirm-content">
<h2 id="uiDialogTitle">${escapeHtml(title)}</h2>
<p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
</div>
<div class="ui-confirm-actions">
${cancelText ? `
<button
type="button"
class="btn btn-secondary"
data-dialog-result="false">
${escapeHtml(cancelText)}
</button>
` : ""}
<button
type="button"
class="btn ${tone === "danger" ? "btn-danger" : "btn-primary"}"
data-dialog-result="true">
${escapeHtml(confirmText)}
</button>
</div>
</div>
`;
state.activeDialog = {
overlay,
resolve
};
const finish = result => closeDialogInstance(overlay, resolve, result);
overlay.querySelectorAll("[data-dialog-result]").forEach(button => {
button.addEventListener("click", () => {
finish(button.dataset.dialogResult === "true");
});
});
overlay.addEventListener("mousedown", event => {
if (event.target === overlay && cancelText) {
finish(false);
}
});
document.body.appendChild(overlay);
overlay.querySelector('[data-dialog-result="true"]')?.focus();
});
}
function closeDialogInstance(overlay, resolve, result) {
if (!overlay?.isConnected) {
return;
}
overlay.classList.remove("open");
if (state.activeDialog?.overlay === overlay) {
state.activeDialog = null;
}
window.setTimeout(() => overlay.remove(), 160);
resolve(result);
}
function closeActiveDialog(result = false) {
if (!state.activeDialog) {
return;
}
const { overlay, resolve } = state.activeDialog;
state.activeDialog = null;
if (overlay?.isConnected) {
overlay.remove();
}
resolve(result);
}
function initializeSupportHeadingObserver() {
if (!window.location.pathname.includes("support-tickets")) {
return;
}
const apply = () => {
const title = document.querySelector(".page-title");
const subtitle = document.querySelector(".page-subtitle");
if (title) {
title.textContent = "Support Tickets";
}
if (subtitle) {
subtitle.textContent =
"Track support requests, ownership, priority and resolution status";
}
};
apply();
const topbar = document.getElementById("topbar");
if (topbar) {
new MutationObserver(apply).observe(topbar, {
childList: true,
subtree: true
});
}
}
function initializeProjectMemberVisibility(attempt = 0) {
if (!window.location.pathname.includes("projects")) {
return;
}
const section = document.getElementById("projectMembersSection");
const original = window.selectProjectMembers;
if (!section || typeof original !== "function") {
if (attempt < 30) {
window.setTimeout(
() => initializeProjectMemberVisibility(attempt + 1),
100
);
}
return;
}
if (original.__uiVisibilityWrapped) {
return;
}
section.classList.add("hidden");
const wrapped = async function (...args) {
section.classList.remove("hidden");
try {
return await original.apply(this, args);
} finally {
window.setTimeout(() => {
section.scrollIntoView({
behavior: "smooth",
block: "start"
});
}, 50);
}
};
wrapped.__uiVisibilityWrapped = true;
wrapped.__original = original;
window.selectProjectMembers = wrapped;
}
function cssEscape(value) {
if (window.CSS?.escape) {
return window.CSS.escape(value);
}
return String(value).replace(
/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g,
"\\$1"
);
}
function escapeHtml(value) {
return String(value ?? "")
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
window.PMS_UI = {
initialize,
toast,
alert: alertDialog,
confirm: confirmDialog,
prompt: promptDialog,
openDrawer,
closeDrawer,
enhanceTables
};
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", () => {
window.setTimeout(initialize, 0);
}, { once: true });
} else {
window.setTimeout(initialize, 0);
}
window.addEventListener("load", () => {
window.setTimeout(initialize, 0);
});
})();