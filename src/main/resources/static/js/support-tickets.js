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
let ticketsPager = null;
let ticketSummary = { totalTickets: 0, openTickets: 0, resolvedTickets: 0, closedTickets: 0 };

initializeSupportTicketsPage();

async function initializeSupportTicketsPage() {
    configureTicketPageByRole();
    bindTicketForm();
    initializeTicketPagination();

    try {
        await loadReferenceData();
        selectProjectFromUrl();
    } catch (error) {
        PMS.showError(error);
    }
}

function initializeTicketPagination() {
    const list = document.getElementById("supportTicketsList");
    const container = list.closest(".support-ticket-right");

    ticketsPager = PMS.createPagination({
        key: "support-tickets",
        container,
        target: list,
        defaultSize: 20,
        sizeOptions: [20, 50],
        searchPlaceholder: "Search ticket code, title, module, reporter or assignee",
        filters: [
            {
                key: "status",
                label: "Ticket status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "NEW", label: "New" },
                    { value: "ACKNOWLEDGED", label: "Acknowledged" },
                    { value: "IN_PROGRESS", label: "In progress" },
                    { value: "WAITING_FOR_CLIENT", label: "Waiting for client" },
                    { value: "WAITING_FOR_INTERNAL", label: "Waiting for internal" },
                    { value: "RESOLVED", label: "Resolved" },
                    { value: "CLOSED", label: "Closed" },
                    { value: "REOPENED", label: "Reopened" }
                ]
            },
            {
                key: "priority",
                label: "Priority",
                options: [
                    { value: "", label: "All priorities" },
                    { value: "P1", label: "P1 - Critical" },
                    { value: "P2", label: "P2 - High" },
                    { value: "P3", label: "P3 - Medium" },
                    { value: "P4", label: "P4 - Low" }
                ]
            },
            {
                key: "ticketType",
                label: "Ticket type",
                options: [
                    { value: "", label: "All types" },
                    { value: "INCIDENT", label: "Incident" },
                    { value: "SERVICE_REQUEST", label: "Service request" },
                    { value: "CHANGE_REQUEST", label: "Change request" },
                    { value: "PROBLEM", label: "Problem" }
                ]
            }
        ],
        onChange: () => {
            if (selectedSupportProject) {
                loadTickets(selectedSupportProject.id);
            }
        }
    });
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
    supportProjectsCache = (projects || []).filter(
        project => getProjectType(project) === "SUPPORT"
    );

    populateSupportProjectDropdown();

    resourcesCache = [];
    populateResourceDropdown();
}

async function loadAssignableResources(projectId) {
    if (!canManageTickets || !projectId) {
        resourcesCache = [];
        populateResourceDropdown();
        return;
    }

    const members = await PMS.apiGet(
        `/api/project-members/project/${projectId}/active`
    );

    const uniqueResources = new Map();

    (members || []).forEach(member => {
        const resource = member.resource;

        if (resource && resource.id) {
            uniqueResources.set(resource.id, resource);
        }
    });

    resourcesCache = Array.from(uniqueResources.values())
        .sort((left, right) => String(left.resourceName || "")
            .localeCompare(String(right.resourceName || "")));

    populateResourceDropdown();
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
    const select = document.getElementById(
        "assignedResourceId"
    );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Unassigned
        </option>
    `;

    resourcesCache.forEach(resource => {
        const designation = resource.designation
            ? ` - ${resource.designation}`
            : "";

        const reportingManager = resource.reportingManagerName
            ? ` | Reports to: ${resource.reportingManagerName}`
            : " | Reports to: Not assigned";

        select.innerHTML += `
            <option value="${resource.id}">
                ${escapeHtml(resource.resourceName || "-")}
                ${escapeHtml(designation)}
                ${escapeHtml(reportingManager)}
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
    ticketsPager.reset();
    resetTicketForm();
    renderSupportProjectSummary();

    await loadAssignableResources(
        selectedSupportProject ? selectedSupportProject.id : null
    );

    if (!selectedSupportProject) {
        ticketsCache = [];
        ticketSummary = { totalTickets: 0, openTickets: 0, resolvedTickets: 0, closedTickets: 0 };
        renderTickets();
        ticketsPager.update({
            page: 0,
            size: ticketsPager.state.size,
            numberOfElements: 0,
            totalElements: 0,
            totalPages: 0,
            first: true,
            last: true
        });
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
        const query = ticketsPager.buildParams({
            sort: "reportedAt",
            direction: "desc"
        });
        const response = await PMS.apiGet(
            `/api/support-tickets/project/${projectId}/paged?${query}`
        );
        ticketsCache = response.content || [];
        ticketSummary = {
            totalTickets: response.totalTickets || 0,
            openTickets: response.openTickets || 0,
            resolvedTickets: response.resolvedTickets || 0,
            closedTickets: response.closedTickets || 0
        };
        renderTickets();
        ticketsPager.update(response);
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
        PMS_UI?.toast?.(id ? "Support ticket updated successfully." : "Support ticket created successfully.", "success");
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
        <article class="
            support-ticket-card
            priority-${escapeHtml(
                String(ticket.priority || "P3").toLowerCase()
            )}
        ">
            <div class="support-ticket-card-header">
                <div>
                    <div class="support-ticket-code">
                        ${escapeHtml(ticket.ticketCode || "-")}
                    </div>

                    <h3 class="support-ticket-title">
                        ${escapeHtml(ticket.title || "-")}
                    </h3>
                </div>

                <div class="support-ticket-badges">
                    ${PMS.badge(ticket.priority || "P3")}
                    ${PMS.badge(ticket.status || "NEW")}
                </div>
            </div>

            <div class="support-ticket-meta-grid">
                <div>
                    <span>Type</span>
                    <strong>
                        ${escapeHtml(
                            formatLabel(ticket.ticketType || "-")
                        )}
                    </strong>
                </div>

                <div>
                    <span>Module</span>
                    <strong>
                        ${escapeHtml(ticket.moduleName || "-")}
                    </strong>
                </div>

                <div>
                    <span>Environment</span>
                    <strong>
                        ${escapeHtml(
                            formatLabel(ticket.environment || "-")
                        )}
                    </strong>
                </div>

                <div>
                    <span>Assigned To</span>

                    <strong>
                        <span class="person-name">
                            ${escapeHtml(
                                assignedResource
                                    ? assignedResource.resourceName
                                    : "Unassigned"
                            )}
                        </span>

                        ${assignedResource
                            ? renderReportingManager(
                                assignedResource.reportingManagerName,
                                assignedResource.reportingManagerDesignation
                            )
                            : ""
                        }
                    </strong>
                </div>

                <div>
                    <span>Reported By</span>
                    <strong>
                        ${escapeHtml(ticket.reportedByName || "-")}
                    </strong>
                </div>

                <div>
                    <span>Reported At</span>
                    <strong>
                        ${formatDateTime(ticket.reportedAt)}
                    </strong>
                </div>
            </div>

            <div class="support-ticket-description">
                ${escapeHtml(ticket.description || "-")}
            </div>

            ${ticket.rootCause
                ? `
                    <div class="support-ticket-note">
                        <strong>Root Cause:</strong>
                        ${escapeHtml(ticket.rootCause)}
                    </div>
                `
                : ""
            }

            ${ticket.resolutionNotes
                ? `
                    <div class="support-ticket-note">
                        <strong>Resolution:</strong>
                        ${escapeHtml(ticket.resolutionNotes)}
                    </div>
                `
                : ""
            }

            <div class="support-ticket-actions">
                ${canManageTickets
                    ? `
                        <button
                            class="action-link"
                            onclick="editTicket(${ticket.id})">
                            Edit
                        </button>

                        <button
                            class="action-link danger"
                            onclick="deleteTicket(${ticket.id})">
                            Delete
                        </button>
                    `
                    : `
                        <span class="muted-small">
                            Read only
                        </span>
                    `
                }
            </div>
        </article>
    `;
}

function renderTicketSummary() {
    document.getElementById("totalTicketsCount").innerText = ticketSummary.totalTickets || 0;
    document.getElementById("openTicketsCount").innerText = ticketSummary.openTickets || 0;
    document.getElementById("resolvedTicketsCount").innerText = ticketSummary.resolvedTickets || 0;
    document.getElementById("closedTicketsCount").innerText = ticketSummary.closedTickets || 0;
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
        if (ticketsCache.length === 1 && ticketsPager.state.page > 0) {
            ticketsPager.setPage(ticketsPager.state.page - 1);
        }
        await loadTickets(selectedSupportProject.id);
        PMS_UI?.toast?.("Support ticket deleted successfully.", "success");
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

function renderReportingManager(
    managerName,
    managerDesignation
) {
    const safeName = managerName || "Not assigned";

    const designation = managerDesignation
        ? `
            <span class="reporting-designation">
                (${escapeHtml(managerDesignation)})
            </span>
        `
        : "";

    return `
        <span class="reporting-line reporting-line-compact">
            <span class="reporting-label">
                Reports to:
            </span>

            <span>
                ${escapeHtml(safeName)}
                ${designation}
            </span>
        </span>
    `;
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
