PMS.protectPage(["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"]);
PMS.initLayout("resources");

const currentUser = PMS.getUser();
const canModifyResource = currentUser && currentUser.role === "ADMIN";

let resourcesCache = [];
let resourcesPager = null;

configureResourcesPage();
initializeResourcesPage();

function configureResourcesPage() {
    if (!canModifyResource) {
        document.getElementById("resourceFormSection")?.classList.add("hidden");
        document.getElementById("actionHeader")?.classList.add("hidden");
    }

    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");

    if (!listTitle) {
        return;
    }

    if (PMS.isExecutiveViewer()) {
        listTitle.innerText = "Organization People Overview";
    } else if (PMS.isDeliveryHead()) {
        listTitle.innerText = "Regional Resources Overview";
    } else if (PMS.isDeliveryManager() || PMS.isTL()) {
        listTitle.innerText = "Available Resources";
    }
}

function initializeResourcesPage() {
    const tableBody = document.getElementById("resourcesTable");
    const section = tableBody.closest(".section");
    const tableWrapper = tableBody.closest(".table-wrapper");

    resourcesPager = PMS.createPagination({
        key: "resources",
        container: section,
        target: tableWrapper,
        defaultSize: 25,
        sizeOptions: [25, 50, 100],
        searchPlaceholder: "Search people, skills, department or reporting manager",
        filters: [
            {
                key: "status",
                label: "Resource status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" }
                ]
            },
            {
                key: "country",
                label: "Country",
                options: [
                    { value: "", label: "All countries" },
                    { value: "INDIA", label: "India" },
                    { value: "UAE", label: "UAE" },
                    { value: "USA", label: "USA" },
                    { value: "UK", label: "UK" }
                ]
            }
        ],
        onChange: loadResources
    });

    if (canModifyResource) {
        const countrySelect = document.getElementById("country");
        countrySelect?.addEventListener("change", async function () {
            await loadAssignableUserDropdown(this.value);
        });

        document.getElementById("resourceForm").addEventListener("submit", saveResource);
    }

    loadInitialData();
}

async function loadInitialData() {
    if (canModifyResource) {
        const defaultCountry = currentUser?.country || "INDIA";
        document.getElementById("country").value = defaultCountry;
        await loadAssignableUserDropdown(defaultCountry);
    }

    await loadResources();
}

async function loadAssignableUserDropdown(country) {
    try {
        const countryQuery = country ? `&country=${encodeURIComponent(country)}` : "";
        const roles = ["DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER"];
        const results = await Promise.all(
            roles.map(role => PMS.apiGet(`/api/users/by-role?role=${role}${countryQuery}`))
        );

        const userMap = new Map();
        results.flat().forEach(user => {
            if (user?.id) {
                userMap.set(user.id, user);
            }
        });

        populateAssignableUserDropdown(Array.from(userMap.values()));
    } catch (error) {
        PMS.showError(error);
    }
}

function populateAssignableUserDropdown(users) {
    const select = document.getElementById("appUserId");

    if (!select) {
        return;
    }

    select.innerHTML = '<option value="">No login account yet</option>';

    users.forEach(user => {
        const manager = user.managerName
            ? ` | Reports to: ${user.managerName}`
            : " | Reports to: Not assigned";

        select.innerHTML += `
            <option value="${user.id}">
                ${escapeHtml(user.name)} / ${escapeHtml(user.username)} -
                ${escapeHtml(user.displayRole || user.role || "-")}
                (${escapeHtml(user.country || "-")})${escapeHtml(manager)}
            </option>
        `;
    });
}

async function saveResource(event) {
    event.preventDefault();

    const id = document.getElementById("resourceId").value;
    const selectedAppUserId = document.getElementById("appUserId").value;

    const resource = {
        resourceName: document.getElementById("resourceName").value.trim(),
        designation: document.getElementById("designation").value.trim(),
        department: document.getElementById("department").value.trim(),
        country: document.getElementById("country").value,
        location: document.getElementById("location").value.trim(),
        skill: document.getElementById("skill").value.trim(),
        monthlySalary: Number(document.getElementById("monthlySalary").value || 0),
        status: document.getElementById("status").value,
        appUserId: selectedAppUserId ? Number(selectedAppUserId) : null
    };

    try {
        if (id) {
            await PMS.apiPut(`/api/resources/${id}`, resource);
        } else {
            await PMS.apiPost("/api/resources", resource);
        }

        resetResourceForm();
        await loadResources();
        PMS_UI?.toast?.(id ? "Resource updated successfully." : "Resource created successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

async function loadResources() {
    try {
        const query = resourcesPager.buildParams({
            sort: "resourceName",
            direction: "asc"
        });

        const response = await PMS.apiGet(`/api/resources/paged?${query}`);
        resourcesCache = response.content || [];
        renderResources(resourcesCache);
        resourcesPager.update(response);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderResources(resources) {
    const table = document.getElementById("resourcesTable");

    if (!resources || resources.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="12" class="empty-state">
                    No resources match the selected filters.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = resources.map(resource => `
        <tr>
            <td>${resource.id}</td>
            <td><strong>${escapeHtml(resource.resourceName || "-")}</strong></td>
            <td>${escapeHtml(resource.designation || "-")}</td>
            <td>${escapeHtml(resource.department || "-")}</td>
            <td>${escapeHtml(resource.country || "-")}</td>
            <td>${escapeHtml(resource.location || "-")}</td>
            <td>${escapeHtml(resource.skill || "-")}</td>
            <td>
                ${resource.appUser
                    ? `${escapeHtml(resource.appUser.name || "-")} / ${escapeHtml(resource.appUser.username || "-")}`
                    : '<span class="muted-small">No login linked</span>'}
            </td>
            <td>${formatReportingManager(resource)}</td>
            <td>${PMS.isAdminOrDeliveryHead()
                ? PMS.formatHourlyUsdFromMonthlyInr(resource.monthlySalary)
                : "Restricted"}</td>
            <td>${PMS.badge(resource.status)}</td>
            ${canModifyResource
                ? `<td>
                    <button class="action-link" onclick="editResource(${resource.id})">Edit</button>
                    <button class="action-link danger" onclick="deleteResource(${resource.id})">Delete</button>
                   </td>`
                : '<td class="hidden"></td>'}
        </tr>
    `).join("");
}

function formatReportingManager(resource) {
    if (!resource?.reportingManagerName) {
        return '<span class="muted-small">Not assigned</span>';
    }

    const designation = resource.reportingManagerDesignation
        ? `<div class="muted-small">${escapeHtml(resource.reportingManagerDesignation)}</div>`
        : "";

    return `${escapeHtml(resource.reportingManagerName)}${designation}`;
}

async function editResource(id) {
    const resource = resourcesCache.find(item => item.id === id);

    if (!resource) {
        PMS_UI?.toast?.("Resource could not be found on the current page.", "error");
        return;
    }

    document.getElementById("resourceId").value = resource.id;
    document.getElementById("resourceName").value = resource.resourceName || "";
    document.getElementById("designation").value = resource.designation || "";
    document.getElementById("department").value = resource.department || "Technical";
    document.getElementById("country").value = resource.country || "";
    document.getElementById("location").value = resource.location || "";
    document.getElementById("skill").value = resource.skill || "";
    document.getElementById("monthlySalary").value = resource.monthlySalary || "";
    document.getElementById("status").value = resource.status || "ACTIVE";

    await loadAssignableUserDropdown(resource.country || "");
    document.getElementById("appUserId").value = resource.appUser?.id || "";
    document.getElementById("saveResourceBtn").innerText = "Update Resource";
}

async function deleteResource(id) {
    const confirmed = window.PMS_UI?.confirm
        ? await PMS_UI.confirm("Delete resource?", "This action cannot be undone.")
        : window.confirm("Are you sure you want to delete this resource?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/resources/${id}`);

        if (resourcesCache.length === 1 && resourcesPager.state.page > 0) {
            resourcesPager.setPage(resourcesPager.state.page - 1);
        }

        await loadResources();
        PMS_UI?.toast?.("Resource deleted successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

function resetResourceForm() {
    document.getElementById("resourceForm").reset();
    document.getElementById("resourceId").value = "";
    document.getElementById("saveResourceBtn").innerText = "Save Resource";

    if (canModifyResource) {
        const defaultCountry = currentUser?.country || "INDIA";
        document.getElementById("country").value = defaultCountry;
        loadAssignableUserDropdown(defaultCountry);
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
