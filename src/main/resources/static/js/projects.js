PMS.protectPage(["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "CLIENT_VIEWER"]);
PMS.initLayout("projects");

const currentUser = PMS.getUser();

const canModifyProject = currentUser && ["ADMIN", "DELIVERY_HEAD"].includes(currentUser.role);
const canMoveProjectToSupport = currentUser && ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER"].includes(currentUser.role);
const canViewProjectMembers = currentUser &&
    ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"].includes(currentUser.role);
const canManageProjectMembers = currentUser &&
    ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER"].includes(currentUser.role);

const canViewProjectFiles = currentUser &&
    ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "CLIENT_VIEWER"].includes(currentUser.role);

const canUploadProjectFiles = currentUser &&
    ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"].includes(currentUser.role);

const canUploadConfidentialProjectFiles = currentUser &&
    ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER"].includes(currentUser.role);

let projectsCache = [];
let projectLookupCache = [];
let projectPages = { IMPLEMENTATION: [], SUPPORT: [] };
let projectPagers = {};
let projectMembersPager = null;
let clientsCache = [];
let deliveryHeadsCache = [];
let deliveryManagersCache = [];
let tlsCache = [];
let resourcesCache = [];
let selectedProjectForMembers = null;
let projectMembersCache = [];
let selectedProjectForFiles = null;
let projectFilesCache = [];
let currentProjectTab = "IMPLEMENTATION";

initializeProjectsPage();

function initializeProjectsPage() {
    configurePageForRole();
    bindProjectForm();
    bindProjectMemberForm();
    bindMoveToSupportForm();
    bindProjectFileUploadForm();
    bindCountryChange();
    bindProjectTypeChange();
    initializeProjectPagination();
    initializeProjectMemberPagination();
    loadInitialData();
}

function configurePageForRole() {
    if (!canModifyProject) {
        hideElement("projectFormSection");
        hideElement("projectActionHeader");
    }

    if (!canViewProjectMembers) {
        hideElement("projectMembersSection");
    }

    if (!canManageProjectMembers) {
        hideElement("projectMemberFormWrapper");
        hideElement("projectMemberActionHeader");
    }

    const listTitle = document.getElementById("projectsListTitle");

    if (!listTitle) {
        return;
    }

    if (PMS.isExecutiveViewer()) {
        listTitle.innerText = "Organization Project Overview";
    } else if (PMS.isDeliveryHead()) {
        listTitle.innerText = "Regional Project Overview";
    } else if (PMS.isDeliveryManager()) {
        listTitle.innerText = "Projects Under My Delivery";
    } else if (PMS.isTL()) {
        listTitle.innerText = "My Projects List";
    } else if (PMS.isClientViewer()) {
        listTitle.innerText = "Client Project Overview";
    }
}

function bindProjectForm() {
    const form = document.getElementById("projectForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("projectId").value;
        const projectType = document.getElementById("projectType").value || "IMPLEMENTATION";

        const project = {
            projectName: document.getElementById("projectName").value.trim(),
            projectType,
            linkedImplementationProjectId: getNullableNumber("linkedImplementationProjectId"),
            clientId: Number(document.getElementById("clientId").value),
            country: document.getElementById("country").value,
            deliveryHeadUserId: Number(document.getElementById("deliveryHeadUserId").value),
            deliveryManagerUserId: Number(document.getElementById("deliveryManagerUserId").value),
            tlUserId: Number(document.getElementById("tlUserId").value),
            startDate: getNullableValue("startDate"),
            endDate: getNullableValue("endDate"),
            status: document.getElementById("status").value,
            supportStartDate: projectType === "SUPPORT" ? getNullableValue("supportStartDate") : null,
            supportEndDate: projectType === "SUPPORT" ? getNullableValue("supportEndDate") : null,
            supportContractType: projectType === "SUPPORT" ? getNullableValue("supportContractType") : null,
            supportCoverage: projectType === "SUPPORT" ? getNullableValue("supportCoverage") : null,
            billingModel: projectType === "SUPPORT" ? getNullableValue("billingModel") : null,
            supportStatus: projectType === "SUPPORT" ? getNullableValue("supportStatus") : null
        };

        try {
            if (id) {
                await PMS.apiPut(`/api/projects/${id}`, project);
            } else {
                await PMS.apiPost("/api/projects", project);
            }

            resetProjectForm();
            await loadProjectLookup();
            await loadProjects(currentProjectTab);
            PMS_UI?.toast?.(id ? "Project updated successfully." : "Project created successfully.", "success");
        } catch (error) {
            PMS.showError(error);
        }
    });
}

function bindProjectMemberForm() {
    const form = document.getElementById("projectMemberForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!selectedProjectForMembers) {
            alert("Please select a project first.");
            return;
        }

        const id = document.getElementById("projectMemberId").value;

        const request = {
            projectId: Number(document.getElementById("memberProjectId").value),
            resourceId: Number(document.getElementById("memberResourceId").value),
            projectRole: document.getElementById("memberProjectRole").value,
            allocationPercentage: Number(document.getElementById("memberAllocationPercentage").value || 100),
            billable: document.getElementById("memberBillable").value === "true",
            startDate: getNullableValue("memberStartDate"),
            endDate: getNullableValue("memberEndDate"),
            active: document.getElementById("memberActive").value === "true"
        };

        try {
            if (id) {
                await PMS.apiPut(`/api/project-members/${id}`, request);
            } else {
                await PMS.apiPost("/api/project-members", request);
            }

            resetProjectMemberForm();
            await loadProjectMembers(selectedProjectForMembers.id);
            PMS_UI?.toast?.(id ? "Project member updated successfully." : "Project member added successfully.", "success");
        } catch (error) {
            PMS.showError(error);
        }
    });
}

function bindMoveToSupportForm() {
    const form = document.getElementById("moveToSupportForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        await submitMoveToSupport();
    });
}

function bindProjectFileUploadForm() {
    const form = document.getElementById("projectFileUploadForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        await uploadProjectFile();
    });
}

function bindCountryChange() {
    const countrySelect = document.getElementById("country");

    if (countrySelect) {
        countrySelect.addEventListener("change", async function () {
            await loadUserDropdowns(this.value);
        });
    }
}

function bindProjectTypeChange() {
    const projectTypeSelect = document.getElementById("projectType");

    if (projectTypeSelect) {
        projectTypeSelect.addEventListener("change", toggleSupportFields);
    }
}

async function loadInitialData() {
    if (canModifyProject) {
        await loadClientsDropdown();

        const defaultCountry = currentUser && currentUser.country
            ? currentUser.country
            : "INDIA";

        document.getElementById("country").value = defaultCountry;
        await loadUserDropdowns(defaultCountry);
    }

    if (canManageProjectMembers) {
        await loadResourcesDropdown();
    }

    await loadProjectLookup();
    await loadProjects(currentProjectTab);
}

async function loadClientsDropdown() {
    try {
        const clients = await PMS.apiGet("/api/clients");
        clientsCache = clients || [];

        const select = document.getElementById("clientId");
        select.innerHTML = `<option value="">Select Client</option>`;

        clientsCache.forEach(client => {
            select.innerHTML += `
                <option value="${client.id}">
                    ${escapeHtml(client.clientName)}
                </option>
            `;
        });
    } catch (error) {
        PMS.showError(error);
    }
}

async function loadUserDropdowns(country) {
    try {
        const countryQuery = country ? `&country=${country}` : "";

        const [deliveryHeads, deliveryManagers, tls] = await Promise.all([
            PMS.apiGet(`/api/users/by-role?role=DELIVERY_HEAD${countryQuery}`),
            PMS.apiGet(`/api/users/by-role?role=DELIVERY_MANAGER${countryQuery}`),
            PMS.apiGet(`/api/users/by-role?role=TL${countryQuery}`)
        ]);

        deliveryHeadsCache = deliveryHeads || [];
        deliveryManagersCache = deliveryManagers || [];
        tlsCache = tls || [];

        populateUserDropdown("deliveryHeadUserId", deliveryHeadsCache, "Select Delivery Head");
        populateUserDropdown("deliveryManagerUserId", deliveryManagersCache, "Select Delivery Manager");
        populateUserDropdown("tlUserId", tlsCache, "Select TL");

        if (PMS.isDeliveryHead()) {
            document.getElementById("deliveryHeadUserId").value = currentUser.id;
        }
    } catch (error) {
        PMS.showError(error);
    }
}

function populateUserDropdown(selectId, users, placeholder) {
    const select = document.getElementById(selectId);

    if (!select) {
        return;
    }

    select.innerHTML = `<option value="">${placeholder}</option>`;

    users.forEach(user => {
        select.innerHTML += `
            <option value="${user.id}">
                ${escapeHtml(user.name)} (${escapeHtml(user.country || "-")})
            </option>
        `;
    });
}

async function loadResourcesDropdown() {
    try {
        const resources = await PMS.apiGet("/api/resources");
        resourcesCache = resources || [];

        const select = document.getElementById("memberResourceId");

        if (!select) {
            return;
        }

        select.innerHTML = `<option value="">Select Resource</option>`;

        resourcesCache.forEach(resource => {
            const designation = resource.designation ? ` - ${resource.designation}` : "";
            const location = resource.location ? ` - ${resource.location}` : "";
            const manager = resource.reportingManagerName ? ` - Reports to: ${resource.reportingManagerName}` : " - Reports to: Not assigned";
            select.innerHTML += `
                <option value="${resource.id}">
                    ${escapeHtml(resource.resourceName || "-")}${escapeHtml(designation)}${escapeHtml(location)}${escapeHtml(manager)}
                </option>
            `;
        });
    } catch (error) {
        PMS.showError(error);
    }
}

function initializeProjectPagination() {
    projectPagers.IMPLEMENTATION = PMS.createPagination({
        key: "implementation-projects",
        container: document.getElementById("implementationProjectsPanel"),
        target: document.querySelector("#implementationProjectsPanel .table-wrapper"),
        defaultSize: 20,
        sizeOptions: [20, 50],
        searchPlaceholder: "Search implementation projects, clients or owners",
        filters: [
            {
                key: "status",
                label: "Project status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "NOT_STARTED", label: "Not started" },
                    { value: "IN_PROGRESS", label: "In progress" },
                    { value: "GO_LIVE", label: "Go live" },
                    { value: "POST_LIVE", label: "Post live" },
                    { value: "DELAYED", label: "Delayed" },
                    { value: "ON_HOLD", label: "On hold" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "MOVED_TO_SUPPORT", label: "Moved to support" }
                ]
            }
        ],
        onChange: () => loadProjects("IMPLEMENTATION")
    });

    projectPagers.SUPPORT = PMS.createPagination({
        key: "support-projects",
        container: document.getElementById("supportProjectsPanel"),
        target: document.querySelector("#supportProjectsPanel .table-wrapper"),
        defaultSize: 20,
        sizeOptions: [20, 50],
        searchPlaceholder: "Search support projects, clients or owners",
        filters: [
            {
                key: "status",
                label: "Support status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "ON_HOLD", label: "On hold" },
                    { value: "CLOSED", label: "Closed" }
                ]
            }
        ],
        onChange: () => loadProjects("SUPPORT")
    });
}

function initializeProjectMemberPagination() {
    if (!canViewProjectMembers) {
        return;
    }

    const table = document.getElementById("projectMembersTable");
    projectMembersPager = PMS.createPagination({
        key: "project-members",
        container: document.getElementById("projectMembersSection"),
        target: table.closest(".table-wrapper"),
        defaultSize: 15,
        sizeOptions: [15, 30, 50],
        searchPlaceholder: "Search members, project role or reporting manager",
        filters: [
            {
                key: "active",
                label: "Member status",
                options: [
                    { value: "", label: "All members" },
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" }
                ]
            },
            {
                key: "billable",
                label: "Billing status",
                options: [
                    { value: "", label: "All billing types" },
                    { value: "true", label: "Billable" },
                    { value: "false", label: "Non-billable" }
                ]
            }
        ],
        onChange: () => {
            if (selectedProjectForMembers) {
                loadProjectMembers(selectedProjectForMembers.id);
            }
        }
    });
}

async function loadProjectLookup() {
    try {
        const projects = await PMS.apiGet(PMS.getProjectsApi());
        projectLookupCache = projects || [];
        populateLinkedImplementationDropdown();
    } catch (error) {
        PMS.showError(error);
    }
}

async function loadProjects(projectType = currentProjectTab) {
    const normalizedType = String(projectType || "IMPLEMENTATION").toUpperCase();
    const pager = projectPagers[normalizedType];

    try {
        const query = pager.buildParams({
            projectType: normalizedType,
            sort: "id",
            direction: "desc"
        });

        const response = await PMS.apiGet(`/api/projects/paged?${query}`);
        projectPages[normalizedType] = response.content || [];
        projectsCache = [
            ...projectPages.IMPLEMENTATION,
            ...projectPages.SUPPORT
        ];

        if (normalizedType === "IMPLEMENTATION") {
            renderImplementationProjects(projectPages.IMPLEMENTATION);
        } else {
            renderSupportProjects(projectPages.SUPPORT);
        }

        pager.update(response);
    } catch (error) {
        PMS.showError(error);
    }
}

async function setProjectTab(tab) {
    currentProjectTab = tab;

    toggleElement("implementationProjectsPanel", currentProjectTab === "IMPLEMENTATION");
    toggleElement("supportProjectsPanel", currentProjectTab === "SUPPORT");

    document.getElementById("implementationTabBtn")
        .classList.toggle("active", currentProjectTab === "IMPLEMENTATION");
    document.getElementById("supportTabBtn")
        .classList.toggle("active", currentProjectTab === "SUPPORT");

    await loadProjects(currentProjectTab);
}

function renderImplementationProjects(projects) {
    const table = document.getElementById("implementationProjectsTable");

    if (!table) {
        return;
    }

    if (!projects || projects.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="14" class="empty-state">
                    No implementation projects found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = projects.map(project => `
        <tr>
            <td>${project.id}</td>
            <td>${escapeHtml(project.projectCode || "-")}</td>
            <td>${escapeHtml(project.projectName || "-")}</td>
            <td>${escapeHtml(project.client ? project.client.clientName : "-")}</td>
            <td>${escapeHtml(project.country || "-")}</td>
            <td>${escapeHtml(project.deliveryHeadUser ? project.deliveryHeadUser.name : "-")}</td>
            <td>${escapeHtml(project.deliveryManagerName || (project.deliveryManagerUser ? project.deliveryManagerUser.name : "-"))}</td>
            <td>${escapeHtml(project.tlName || (project.tlUser ? project.tlUser.name : "-"))}</td>
            <td>${PMS.formatDate(project.startDate)}</td>
            <td>${PMS.formatDate(project.endDate)}</td>
<td>${PMS.badge(project.status)}</td>
<td>${renderFilesButton(project)}</td>
<td>${renderMembersButton(project)}</td>
<td>${renderImplementationActions(project)}</td>
        </tr>
    `).join("");
}

function renderSupportProjects(projects) {
    const table = document.getElementById("supportProjectsTable");

    if (!table) {
        return;
    }

    if (!projects || projects.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="15" class="empty-state">
                    No support projects found. Move a Go-Live/Post-Live implementation project to support.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = projects.map(project => {
        const linked = project.linkedImplementationProject;
        return `
            <tr>
                <td>${project.id}</td>
                <td>${escapeHtml(project.projectCode || "-")}</td>
                <td>${escapeHtml(project.projectName || "-")}</td>
                <td>${escapeHtml(project.client ? project.client.clientName : "-")}</td>
                <td>${linked ? `${escapeHtml(linked.projectCode || "")} ${escapeHtml(linked.projectName || "")}`.trim() : "-"}</td>
                <td>${escapeHtml(project.deliveryManagerName || (project.deliveryManagerUser ? project.deliveryManagerUser.name : "-"))}</td>
                <td>${escapeHtml(project.tlName || (project.tlUser ? project.tlUser.name : "-"))}</td>
                <td>${escapeHtml(formatLabel(project.supportContractType || "-"))}</td>
                <td>${escapeHtml(formatLabel(project.supportCoverage || "-"))}</td>
                <td>${escapeHtml(formatLabel(project.billingModel || "-"))}</td>
                <td>${PMS.formatDate(project.supportEndDate || project.endDate)}</td>
<td>${PMS.badge(project.supportStatus || project.status || "ACTIVE")}</td>
<td>${renderFilesButton(project)}</td>
<td>${renderMembersButton(project)}</td>
<td>${renderSupportActions(project)}</td>
            </tr>
        `;
    }).join("");
}

function renderFilesButton(project) {
    if (!canViewProjectFiles) {
        return "-";
    }

    return `
        <button class="action-link" onclick="openProjectFiles(${project.id})">
            Files
        </button>
    `;
}

function renderMembersButton(project) {
    if (!canViewProjectMembers) {
        return "-";
    }

    return `
        <button class="action-link" onclick="selectProjectMembers(${project.id})">
            Members
        </button>
    `;
}

function renderImplementationActions(project) {
    const actions = [];

    if (canMoveProjectToSupport && isReadyToMoveToSupport(project)) {
        actions.push(`
            <button class="action-link" onclick="openMoveToSupportModal(${project.id})">
                Move to Support
            </button>
        `);
    }

    if (canModifyProject) {
        actions.push(`
            <button class="action-link" onclick="editProject(${project.id})">Edit</button>
            <button class="action-link danger" onclick="deleteProject(${project.id})">Delete</button>
        `);
    }

    return actions.length ? actions.join("") : "-";
}

function renderSupportActions(project) {
    const actions = [
        `<button class="action-link" onclick="openSupportTickets(${project.id})">View Tickets</button>`
    ];

    if (canModifyProject) {
        actions.push(`<button class="action-link" onclick="editProject(${project.id})">Edit</button>`);
    }

    return actions.join("");
}

async function editProject(id) {
    const project = projectsCache.find(item => item.id === id);

    if (!project) {
        alert("Project not found");
        return;
    }

    document.getElementById("projectId").value = project.id;
    document.getElementById("projectType").value = getProjectType(project);
    document.getElementById("linkedImplementationProjectId").value = project.linkedImplementationProject ? project.linkedImplementationProject.id : "";
    document.getElementById("projectName").value = project.projectName || "";
    document.getElementById("clientId").value = project.client ? project.client.id : "";
    document.getElementById("country").value = project.country || "";

    await loadUserDropdowns(project.country || "");

    document.getElementById("deliveryHeadUserId").value = project.deliveryHeadUser ? project.deliveryHeadUser.id : "";
    document.getElementById("deliveryManagerUserId").value = project.deliveryManagerUser ? project.deliveryManagerUser.id : "";
    document.getElementById("tlUserId").value = project.tlUser ? project.tlUser.id : "";

    document.getElementById("startDate").value = project.startDate || "";
    document.getElementById("endDate").value = project.endDate || "";
    document.getElementById("status").value = project.status || (getProjectType(project) === "SUPPORT" ? "ACTIVE" : "NOT_STARTED");

    document.getElementById("supportStartDate").value = project.supportStartDate || "";
    document.getElementById("supportEndDate").value = project.supportEndDate || "";
    document.getElementById("supportContractType").value = project.supportContractType || "WARRANTY";
    document.getElementById("supportCoverage").value = project.supportCoverage || "8X5";
    document.getElementById("billingModel").value = project.billingModel || "INCLUDED_WARRANTY";
    document.getElementById("supportStatus").value = project.supportStatus || "ACTIVE";

    toggleSupportFields();
    document.getElementById("saveProjectBtn").innerText = "Update Project";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteProject(id) {
    const confirmed = confirm("Are you sure you want to delete this project?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/projects/${id}`);
        await loadProjectLookup();
        await loadProjects(currentProjectTab);
    } catch (error) {
        PMS.showError(error);
    }
}

function openMoveToSupportModal(projectId) {
    const project = projectsCache.find(item => item.id === projectId);

    if (!project) {
        alert("Project not found");
        return;
    }

    document.getElementById("moveImplementationProjectId").value = project.id;
    document.getElementById("moveToSupportSubtitle").innerText =
        `${project.projectCode || ""} ${project.projectName || "Project"}`.trim();
    document.getElementById("moveSupportStartDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("moveSupportEndDate").value = "";
    document.getElementById("moveSupportContractType").value = "WARRANTY";
    document.getElementById("moveSupportCoverage").value = "8X5";
    document.getElementById("moveBillingModel").value = "INCLUDED_WARRANTY";

    document.getElementById("moveToSupportModal").classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeMoveToSupportModal() {
    document.getElementById("moveToSupportModal").classList.add("hidden");
    document.body.classList.remove("modal-open");
}

function handleMoveToSupportBackdrop(event) {
    if (event.target && event.target.id === "moveToSupportModal") {
        closeMoveToSupportModal();
    }
}

async function submitMoveToSupport() {
    const projectId = document.getElementById("moveImplementationProjectId").value;

    const payload = {
        supportStartDate: document.getElementById("moveSupportStartDate").value || null,
        supportEndDate: document.getElementById("moveSupportEndDate").value || null,
        supportContractType: document.getElementById("moveSupportContractType").value,
        supportCoverage: document.getElementById("moveSupportCoverage").value,
        billingModel: document.getElementById("moveBillingModel").value
    };

    try {
        await PMS.apiPost(`/api/projects/${projectId}/move-to-support`, payload);
        closeMoveToSupportModal();
        currentProjectTab = "SUPPORT";
        await loadProjectLookup();
        await loadProjects(currentProjectTab);
    } catch (error) {
        PMS.showError(error);
    }
}

async function openProjectFiles(projectId) {
    const project = projectsCache.find(item => item.id === projectId)
        || projectLookupCache.find(item => item.id === projectId);

    if (!project) {
        alert("Project not found");
        return;
    }

    selectedProjectForFiles = project;
    document.getElementById("fileProjectId").value = project.id;
    document.getElementById("projectFilesSubtitle").innerText =
        `${project.projectCode || ""} ${project.projectName || "Project"}`.trim();

    configureProjectFileUploadArea();
    document.getElementById("projectFilesModal").classList.remove("hidden");
    document.body.classList.add("modal-open");

    await loadProjectFiles(project.id);
}

function closeProjectFilesModal() {
    document.getElementById("projectFilesModal").classList.add("hidden");
    document.body.classList.remove("modal-open");
    selectedProjectForFiles = null;
    projectFilesCache = [];
    renderProjectFiles([]);
}

function handleProjectFilesBackdrop(event) {
    if (event.target && event.target.id === "projectFilesModal") {
        closeProjectFilesModal();
    }
}

function configureProjectFileUploadArea() {
    toggleElement("projectFileUploadWrapper", Boolean(canUploadProjectFiles));

    const confidentialOption = document.getElementById("confidentialVisibilityOption");
    const visibilitySelect = document.getElementById("projectFileVisibility");

    if (confidentialOption) {
        confidentialOption.hidden = !canUploadConfidentialProjectFiles;
    }

    if (visibilitySelect && !canUploadConfidentialProjectFiles) {
        visibilitySelect.value = "NORMAL";
    }

    const form = document.getElementById("projectFileUploadForm");
    if (form) {
        form.reset();
    }
}

async function loadProjectFiles(projectId) {
    const table = document.getElementById("projectFilesTable");

    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">Loading files...</td>
            </tr>
        `;
    }

    try {
        projectFilesCache = await PMS.apiGet(`/api/projects/${projectId}/files`) || [];
        renderProjectFiles(projectFilesCache);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderProjectFiles(files) {
    const table = document.getElementById("projectFilesTable");

    if (!table) {
        return;
    }

    if (!selectedProjectForFiles) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">Select a project to view files.</td>
            </tr>
        `;
        return;
    }

    if (!files || files.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">No files uploaded for this project yet.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = files.map(file => `
        <tr>
            <td>
                <strong>${escapeHtml(file.originalFileName || "-")}</strong>
                <div class="muted-small">${escapeHtml(file.contentType || "file")}</div>
            </td>
            <td>${renderFileVisibility(file.visibility)}</td>
            <td>${escapeHtml(file.description || "-")}</td>
            <td>
                ${escapeHtml(file.uploadedByName || "-")}
                <div class="muted-small">${escapeHtml(formatLabel(file.uploadedByRole || ""))}</div>
            </td>
            <td>${formatDateTime(file.uploadedAt)}</td>
            <td>${formatFileSize(file.fileSizeBytes)}</td>
            <td>
                <button class="action-link" onclick="downloadProjectFile(${file.id})">Download</button>
                ${file.canDelete ? `<button class="action-link danger" onclick="deleteProjectFile(${file.id})">Delete</button>` : ""}
            </td>
        </tr>
    `).join("");
}

async function uploadProjectFile() {
    if (!selectedProjectForFiles) {
        alert("Please select a project first.");
        return;
    }

    const fileInput = document.getElementById("projectFileInput");

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        alert("Please choose a file.");
        return;
    }

    const visibility = document.getElementById("projectFileVisibility").value || "NORMAL";

    if (visibility === "CONFIDENTIAL" && !canUploadConfidentialProjectFiles) {
        alert("Only Admin, Delivery Head and Delivery Manager can upload confidential files.");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("visibility", visibility);
    formData.append("description", document.getElementById("projectFileDescription").value || "");

    try {
        await apiPostMultipart(`/api/projects/${selectedProjectForFiles.id}/files`, formData);
        document.getElementById("projectFileUploadForm").reset();

        if (!canUploadConfidentialProjectFiles) {
            document.getElementById("projectFileVisibility").value = "NORMAL";
        }

        await loadProjectFiles(selectedProjectForFiles.id);
        PMS_UI?.toast?.("File uploaded successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

function downloadProjectFile(fileId) {
    window.open(`/api/projects/files/${fileId}/download`, "_blank");
}

async function deleteProjectFile(fileId) {
    const confirmed = confirm("Delete this project file?");

    if (!confirmed || !selectedProjectForFiles) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/projects/files/${fileId}`);
        await loadProjectFiles(selectedProjectForFiles.id);
        PMS_UI?.toast?.("File deleted successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

async function apiPostMultipart(url, formData) {
    const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData
    });

    return readRawApiResponse(response);
}

async function readRawApiResponse(response) {
    const responseText = await response.text();
    let payload = null;

    if (responseText) {
        try {
            payload = JSON.parse(responseText);
        } catch (error) {
            payload = responseText;
        }
    }

    if (!response.ok) {
        const message = payload && typeof payload === "object"
            ? payload.message || payload.detail || payload.error || `Request failed with status ${response.status}`
            : payload || `Request failed with status ${response.status}`;

        throw new Error(message);
    }

    return payload;
}

function renderFileVisibility(visibility) {
    const normalized = String(visibility || "NORMAL").toUpperCase();

    if (normalized === "CONFIDENTIAL") {
        return `<span class="badge badge-danger">Confidential</span>`;
    }

    return `<span class="badge badge-info">Normal</span>`;
}

function formatFileSize(sizeBytes) {
    const size = Number(sizeBytes || 0);

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value) {
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleString("en-IN");
}

function openSupportTickets(projectId) {
    window.location.href = `/support-tickets?projectId=${projectId}`;
}

async function selectProjectMembers(projectId) {
    const project = projectsCache.find(item => item.id === projectId);

    if (!project) {
        alert("Project not found");
        return;
    }

    selectedProjectForMembers = project;
    document.getElementById("memberProjectId").value = project.id;

    const title = document.getElementById("projectMembersTitle");
    const subtitle = document.getElementById("projectMembersSubtitle");

    title.innerText = `Project Members - ${project.projectCode || ""} ${project.projectName || "Project"}`.trim();

    subtitle.innerText = [
        formatLabel(project.projectType || "IMPLEMENTATION"),
        project.client ? project.client.clientName : null,
        project.country || null,
        project.deliveryManagerName || (project.deliveryManagerUser ? project.deliveryManagerUser.name : null),
        project.tlName || (project.tlUser ? project.tlUser.name : null)
    ].filter(Boolean).join(" | ");

    resetProjectMemberForm(false);
    projectMembersPager?.reset();
    await loadProjectMembers(project.id);

    document.getElementById("projectMembersSection")
        .scrollIntoView({ behavior: "smooth", block: "start" });
}

async function reloadSelectedProjectMembers() {
    if (!selectedProjectForMembers) {
        alert("Please select a project first.");
        return;
    }

    await loadProjectMembers(selectedProjectForMembers.id);
}

async function loadProjectMembers(projectId) {
    try {
        const query = projectMembersPager.buildParams({
            sort: "id",
            direction: "asc"
        });
        const response = await PMS.apiGet(`/api/project-members/project/${projectId}/paged?${query}`);
        projectMembersCache = response.content || [];
        renderProjectMembers(projectMembersCache);
        projectMembersPager.update(response);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderProjectMembers(members) {
    const table = document.getElementById("projectMembersTable");

    if (!selectedProjectForMembers) {
        table.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    Select a project to view members.
                </td>
            </tr>
        `;
        return;
    }

    if (!members || members.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    No members allocated to this project yet.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = members.map(member => {
        const resource = member.resource || {};

        return `
            <tr>
                <td>${member.id}</td>
                <td>
                    ${escapeHtml(resource.resourceName || "-")}
                    <div class="muted-small">Reports to: ${escapeHtml(resource.reportingManagerName || "Not assigned")}</div>
                </td>
                <td>${escapeHtml(resource.designation || "-")}</td>
                <td>${escapeHtml(formatProjectRole(member.projectRole))}</td>
                <td>${member.allocationPercentage || 0}%</td>
                <td>${member.billable ? "Billable" : "Non-Billable"}</td>
                <td>${PMS.formatDate(member.startDate)}</td>
                <td>${PMS.formatDate(member.endDate)}</td>
                <td>${member.active ? PMS.badge("ACTIVE") : PMS.badge("INACTIVE")}</td>
                ${canManageProjectMembers
                ? `<td>
                            <button class="action-link" onclick="editProjectMember(${member.id})">Edit</button>
                            <button class="action-link danger" onclick="deleteProjectMember(${member.id})">Delete</button>
                           </td>`
                : `<td class="hidden"></td>`
            }
            </tr>
        `;
    }).join("");
}

function editProjectMember(id) {
    const member = projectMembersCache.find(item => item.id === id);

    if (!member) {
        alert("Project member not found");
        return;
    }

    document.getElementById("projectMemberId").value = member.id;
    document.getElementById("memberProjectId").value = selectedProjectForMembers ? selectedProjectForMembers.id : "";
    document.getElementById("memberResourceId").value = member.resource ? member.resource.id : "";
    document.getElementById("memberProjectRole").value = member.projectRole || "";
    document.getElementById("memberAllocationPercentage").value = member.allocationPercentage || 100;
    document.getElementById("memberBillable").value = String(member.billable !== false);
    document.getElementById("memberStartDate").value = member.startDate || "";
    document.getElementById("memberEndDate").value = member.endDate || "";
    document.getElementById("memberActive").value = String(member.active !== false);
    document.getElementById("saveProjectMemberBtn").innerText = "Update Member";
}

async function deleteProjectMember(id) {
    const confirmed = confirm("Are you sure you want to remove this member from the project?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/project-members/${id}`);
        if (projectMembersCache.length === 1 && projectMembersPager.state.page > 0) {
            projectMembersPager.setPage(projectMembersPager.state.page - 1);
        }
        await loadProjectMembers(selectedProjectForMembers.id);
        PMS_UI?.toast?.("Project member removed successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

function resetProjectMemberForm(keepProject = true) {
    document.getElementById("projectMemberForm").reset();
    document.getElementById("projectMemberId").value = "";

    if (keepProject && selectedProjectForMembers) {
        document.getElementById("memberProjectId").value = selectedProjectForMembers.id;
    }

    document.getElementById("memberAllocationPercentage").value = 100;
    document.getElementById("memberBillable").value = "true";
    document.getElementById("memberActive").value = "true";
    document.getElementById("saveProjectMemberBtn").innerText = "Add Member";
}

function resetProjectForm() {
    document.getElementById("projectForm").reset();
    document.getElementById("projectId").value = "";
    document.getElementById("projectType").value = "IMPLEMENTATION";
    document.getElementById("status").value = "NOT_STARTED";
    document.getElementById("saveProjectBtn").innerText = "Save Project";
    toggleSupportFields();

    if (canModifyProject) {
        const defaultCountry = currentUser && currentUser.country
            ? currentUser.country
            : "INDIA";

        document.getElementById("country").value = defaultCountry;
        loadUserDropdowns(defaultCountry);
    }
}

function toggleSupportFields() {
    const projectType = document.getElementById("projectType")
        ? document.getElementById("projectType").value
        : "IMPLEMENTATION";

    const isSupport = projectType === "SUPPORT";

    document.querySelectorAll(".support-field").forEach(element => {
        element.classList.toggle("hidden", !isSupport);
    });

    if (isSupport && document.getElementById("status").value === "NOT_STARTED") {
        document.getElementById("status").value = "ACTIVE";
    }

    if (!isSupport && document.getElementById("status").value === "ACTIVE") {
        document.getElementById("status").value = "NOT_STARTED";
    }
}

function populateLinkedImplementationDropdown() {
    const select = document.getElementById("linkedImplementationProjectId");

    if (!select) {
        return;
    }

    const currentValue = select.value;
    const implementationProjects = projectLookupCache.filter(project => getProjectType(project) === "IMPLEMENTATION");

    select.innerHTML = `<option value="">Select Implementation Project</option>`;

    implementationProjects.forEach(project => {
        select.innerHTML += `
            <option value="${project.id}">
                ${escapeHtml(project.projectCode || "")} - ${escapeHtml(project.projectName || "-")}
            </option>
        `;
    });

    select.value = currentValue;
}

function isReadyToMoveToSupport(project) {
    if (getProjectType(project) !== "IMPLEMENTATION") {
        return false;
    }

    const allowedStatuses = ["GO_LIVE", "POST_LIVE", "COMPLETED", "CLOSED"];
    return allowedStatuses.includes(String(project.status || "").toUpperCase());
}

function getProjectType(project) {
    return String(project.projectType || "IMPLEMENTATION").toUpperCase();
}

function formatProjectRole(role) {
    if (!role) {
        return "-";
    }

    return formatLabel(role);
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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getNullableValue(id) {
    const element = document.getElementById(id);
    return element && element.value ? element.value : null;
}

function getNullableNumber(id) {
    const value = getNullableValue(id);
    return value ? Number(value) : null;
}

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.add("hidden");
    }
}

function toggleElement(id, show) {
    const element = document.getElementById(id);
    if (element) {
        element.classList.toggle("hidden", !show);
    }
}

window.setProjectTab = setProjectTab;
window.loadProjects = loadProjects;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.resetProjectForm = resetProjectForm;
window.toggleSupportFields = toggleSupportFields;
window.openMoveToSupportModal = openMoveToSupportModal;
window.closeMoveToSupportModal = closeMoveToSupportModal;
window.handleMoveToSupportBackdrop = handleMoveToSupportBackdrop;
window.selectProjectMembers = selectProjectMembers;
window.reloadSelectedProjectMembers = reloadSelectedProjectMembers;
window.editProjectMember = editProjectMember;
window.deleteProjectMember = deleteProjectMember;
window.resetProjectMemberForm = resetProjectMemberForm;
window.openSupportTickets = openSupportTickets;
window.openProjectFiles = openProjectFiles;
window.closeProjectFilesModal = closeProjectFilesModal;
window.handleProjectFilesBackdrop = handleProjectFilesBackdrop;
window.downloadProjectFile = downloadProjectFile;
window.deleteProjectFile = deleteProjectFile;
