PMS.protectPage(["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER", "CLIENT_VIEWER"]);
PMS.initLayout("projects");

const currentUser = PMS.getUser();
const isClientViewer = currentUser && currentUser.role === "CLIENT_VIEWER";
const isReadOnlyViewer = currentUser && currentUser.role === "EXECUTIVE_VIEWER";
const canManageTickets = currentUser && ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"].includes(currentUser.role);
const canCreateTickets = currentUser && ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "CLIENT_VIEWER"].includes(currentUser.role);

let supportProjectsCache = [];
let resourcesCache = [];
let ticketsCache = [];
let selectedSupportProject = null;

initializeSupportTicketsPage();

async function initializeSupportTicketsPage() {
    configureTicketPageByRole();
    bindTicketForm();

    try {
        await loadReferenceData();
        selectProjectFromUrl();
    } catch (error) {
        PMS.showError(error);
    }
}

function configureTicketPageByRole() {
    if (isClientViewer) {
        document.querySelectorAll(".internal-ticket-field").forEach(element => {
            element.classList.add("hidden");
        });
    }

    if (isReadOnlyViewer || !canCreateTickets) {
        const form = document.getElementById("supportTicketForm");
        if (form) {
            form.classList.add("hidden");
        }
    }
}

function bindTicketForm() {
    const form = document.getElementById("supportTicketForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        await saveTicket();
    });
}

async function loadReferenceData() {
    const projects = await PMS.apiGet(PMS.getProjectsApi());
    supportProjectsCache = (projects || []).filter(project => getProjectType(project) === "SUPPORT");
    populateSupportProjectDropdown();

    if (canManageTickets) {
        const resources = await PMS.apiGet("/api/resources");
        resourcesCache = resources || [];
        populateResourceDropdown();
    }
}

function populateSupportProjectDropdown() {
    const select = document.getElementById("supportProjectId");

    select.innerHTML = `<option value="">Select Support Project</option>`;

    supportProjectsCache.forEach(project => {
        select.innerHTML += `
            <option value="${project.id}">
                ${escapeHtml(project.projectCode || "")} - ${escapeHtml(project.projectName || "-")}
            </option>
        `;
    });
}

function populateResourceDropdown() {
    const select = document.getElementById("assignedResourceId");

    if (!select) {
        return;
    }

    select.innerHTML = `<option value="">Unassigned</option>`;

    resourcesCache.forEach(resource => {
        const designation = resource.designation ? ` - ${resource.designation}` : "";
        select.innerHTML += `
            <option value="${resource.id}">
                ${escapeHtml(resource.resourceName || "-")}${escapeHtml(designation)}
            </option>
        `;
    });
}

function selectProjectFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("projectId");

    if (projectId) {
        document.getElementById("supportProjectId").value = projectId;
        handleSupportProjectChange();
    }
}

async function handleSupportProjectChange() {
    const projectId = Number(document.getElementById("supportProjectId").value || 0);

    selectedSupportProject = supportProjectsCache.find(project => project.id === projectId) || null;
    resetTicketForm();
    renderSupportProjectSummary();

    if (!selectedSupportProject) {
        ticketsCache = [];
        renderTickets();
        return;
    }

    await loadTickets(selectedSupportProject.id);
}

async function reloadTickets() {
    if (!selectedSupportProject) {
        await loadReferenceData();
        return;
    }

    await loadTickets(selectedSupportProject.id);
}

async function loadTickets(projectId) {
    try {
        const tickets = await PMS.apiGet(`/api/support-tickets/project/${projectId}`);
        ticketsCache = tickets || [];
        renderTickets();
    } catch (error) {
        PMS.showError(error);
    }
}

async function saveTicket() {
    if (!selectedSupportProject) {
        alert("Please select a support project first.");
        return;
    }

    const id = document.getElementById("supportTicketId").value;

    const payload = {
        supportProjectId: selectedSupportProject.id,
        title: document.getElementById("ticketTitle").value.trim(),
        description: document.getElementById("ticketDescription").value.trim(),
        ticketType: document.getElementById("ticketType").value,
        priority: document.getElementById("priority").value,
        status: canManageTickets ? document.getElementById("ticketStatus").value : "NEW",
        assignedResourceId: canManageTickets ? getNullableNumber("assignedResourceId") : null,
        moduleName: getNullableValue("moduleName"),
        environment: document.getElementById("environment").value,
        billable: document.getElementById("ticketBillable").value === "true",
        rootCause: canManageTickets ? getNullableValue("rootCause") : null,
        resolutionNotes: canManageTickets ? getNullableValue("resolutionNotes") : null
    };

    try {
        if (id) {
            await PMS.apiPut(`/api/support-tickets/${id}`, payload);
        } else {
            await PMS.apiPost("/api/support-tickets", payload);
        }

        resetTicketForm();
        await loadTickets(selectedSupportProject.id);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderSupportProjectSummary() {
    const box = document.getElementById("supportProjectSummary");

    if (!selectedSupportProject) {
        box.className = "support-project-summary empty-state";
        box.innerHTML = "Select a support project to view tickets.";
        return;
    }

    const linked = selectedSupportProject.linkedImplementationProject;

    box.className = "support-project-summary";
    box.innerHTML = `
        <div class="support-project-title">
            ${escapeHtml(selectedSupportProject.projectCode || "-")} - ${escapeHtml(selectedSupportProject.projectName || "-")}
        </div>
        <div class="support-project-meta">
            Client: ${escapeHtml(selectedSupportProject.client ? selectedSupportProject.client.clientName : "-")}
        </div>
        <div class="support-project-meta">
            Linked Implementation: ${linked ? `${escapeHtml(linked.projectCode || "")} ${escapeHtml(linked.projectName || "")}`.trim() : "-"}
        </div>
        <div class="support-project-meta">
            ${formatLabel(selectedSupportProject.supportContractType || "-")} | ${formatLabel(selectedSupportProject.supportCoverage || "-")} | ${formatLabel(selectedSupportProject.billingModel || "-")}
        </div>
    `;
}

function renderTickets() {
    const list = document.getElementById("supportTicketsList");

    renderTicketSummary();

    if (!selectedSupportProject) {
        list.innerHTML = `<div class="empty-state">Select a support project to view tickets.</div>`;
        return;
    }

    if (!ticketsCache || ticketsCache.length === 0) {
        list.innerHTML = `<div class="empty-state">No tickets found for this support project.</div>`;
        return;
    }

    list.innerHTML = ticketsCache.map(ticket => renderTicketCard(ticket)).join("");
}

function renderTicketCard(ticket) {
    const assignedResource = ticket.assignedResource;

    return `
        <article class="support-ticket-card priority-${escapeHtml(String(ticket.priority || "P3").toLowerCase())}">
            <div class="support-ticket-card-header">
                <div>
                    <div class="support-ticket-code">${escapeHtml(ticket.ticketCode || "-")}</div>
                    <h3 class="support-ticket-title">${escapeHtml(ticket.title || "-")}</h3>
                </div>
                <div class="support-ticket-badges">
                    ${PMS.badge(ticket.priority || "P3")}
                    ${PMS.badge(ticket.status || "NEW")}
                </div>
            </div>

            <div class="support-ticket-meta-grid">
                <div><span>Type</span><strong>${escapeHtml(formatLabel(ticket.ticketType || "-"))}</strong></div>
                <div><span>Module</span><strong>${escapeHtml(ticket.moduleName || "-")}</strong></div>
                <div><span>Environment</span><strong>${escapeHtml(formatLabel(ticket.environment || "-"))}</strong></div>
                <div><span>Assigned To</span><strong>${escapeHtml(assignedResource ? assignedResource.resourceName : "Unassigned")}</strong></div>
                <div><span>Reported By</span><strong>${escapeHtml(ticket.reportedByName || "-")}</strong></div>
                <div><span>Reported At</span><strong>${formatDateTime(ticket.reportedAt)}</strong></div>
            </div>

            <div class="support-ticket-description">
                ${escapeHtml(ticket.description || "-")}
            </div>

            ${ticket.rootCause ? `<div class="support-ticket-note"><strong>Root Cause:</strong> ${escapeHtml(ticket.rootCause)}</div>` : ""}
            ${ticket.resolutionNotes ? `<div class="support-ticket-note"><strong>Resolution:</strong> ${escapeHtml(ticket.resolutionNotes)}</div>` : ""}

            <div class="support-ticket-actions">
                ${canManageTickets ? `
                    <button class="action-link" onclick="editTicket(${ticket.id})">Edit</button>
                    <button class="action-link danger" onclick="deleteTicket(${ticket.id})">Delete</button>
                ` : `<span class="muted-small">Read only</span>`}
            </div>
        </article>
    `;
}

function renderTicketSummary() {
    const total = ticketsCache.length;
    const open = ticketsCache.filter(ticket => !["RESOLVED", "CLOSED", "CANCELLED"].includes(String(ticket.status || "NEW"))).length;
    const resolved = ticketsCache.filter(ticket => String(ticket.status) === "RESOLVED").length;
    const closed = ticketsCache.filter(ticket => String(ticket.status) === "CLOSED").length;

    document.getElementById("totalTicketsCount").innerText = total;
    document.getElementById("openTicketsCount").innerText = open;
    document.getElementById("resolvedTicketsCount").innerText = resolved;
    document.getElementById("closedTicketsCount").innerText = closed;
}

function editTicket(id) {
    if (!canManageTickets) {
        return;
    }

    const ticket = ticketsCache.find(item => item.id === id);

    if (!ticket) {
        alert("Ticket not found");
        return;
    }

    document.getElementById("supportTicketId").value = ticket.id;
    document.getElementById("ticketType").value = ticket.ticketType || "INCIDENT";
    document.getElementById("priority").value = ticket.priority || "P3";
    document.getElementById("ticketStatus").value = ticket.status || "NEW";
    document.getElementById("assignedResourceId").value = ticket.assignedResource ? ticket.assignedResource.id : "";
    document.getElementById("moduleName").value = ticket.moduleName || "";
    document.getElementById("environment").value = ticket.environment || "PRODUCTION";
    document.getElementById("ticketBillable").value = String(ticket.billable !== false);
    document.getElementById("ticketTitle").value = ticket.title || "";
    document.getElementById("ticketDescription").value = ticket.description || "";
    document.getElementById("rootCause").value = ticket.rootCause || "";
    document.getElementById("resolutionNotes").value = ticket.resolutionNotes || "";

    document.getElementById("ticketFormTitle").innerText = "Update Support Ticket";
    document.getElementById("saveTicketBtn").innerText = "Update Ticket";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteTicket(id) {
    const confirmed = confirm("Delete this support ticket?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/support-tickets/${id}`);
        await loadTickets(selectedSupportProject.id);
    } catch (error) {
        PMS.showError(error);
    }
}

function resetTicketForm() {
    const form = document.getElementById("supportTicketForm");

    if (form) {
        form.reset();
    }

    document.getElementById("supportTicketId").value = "";
    document.getElementById("ticketType").value = "INCIDENT";
    document.getElementById("priority").value = "P3";
    document.getElementById("environment").value = "PRODUCTION";
    document.getElementById("ticketBillable").value = "true";

    if (canManageTickets) {
        document.getElementById("ticketStatus").value = "NEW";
        document.getElementById("assignedResourceId").value = "";
        document.getElementById("rootCause").value = "";
        document.getElementById("resolutionNotes").value = "";
    }

    document.getElementById("ticketFormTitle").innerText = "Create Support Ticket";
    document.getElementById("saveTicketBtn").innerText = "Save Ticket";
}

function getProjectType(project) {
    return String(project.projectType || "IMPLEMENTATION").toUpperCase();
}

function formatLabel(value) {
    if (!value) {
        return "-";
    }

    return String(value)
        .replaceAll("_", " ")
        .toLowerCase()
        .split(" ")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleString("en-IN");
}

function getNullableValue(id) {
    const element = document.getElementById(id);
    return element && element.value ? element.value : null;
}

function getNullableNumber(id) {
    const value = getNullableValue(id);
    return value ? Number(value) : null;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

window.handleSupportProjectChange = handleSupportProjectChange;
window.reloadTickets = reloadTickets;
window.resetTicketForm = resetTicketForm;
window.editTicket = editTicket;
window.deleteTicket = deleteTicket;
