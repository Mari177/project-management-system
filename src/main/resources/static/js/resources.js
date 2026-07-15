PMS.protectPage(["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"]);
PMS.initLayout("resources");

if (PMS.isExecutiveViewer()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "Organization People Overview";
    }
}

const currentUser = PMS.getUser();
const canModifyResource = currentUser && currentUser.role === "ADMIN";

let resourcesCache = [];
let employeeUsersCache = [];

if (!canModifyResource) {
    document.getElementById("resourceFormSection").classList.add("hidden");
    document.getElementById("actionHeader").classList.add("hidden");
}

if (PMS.isDeliveryHead()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "Regional Resources Overview";
    }
}

if (PMS.isDeliveryManager() || PMS.isTL()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "Available Resources";
    }
}

loadInitialData();

const countrySelect = document.getElementById("country");

if (countrySelect) {
    countrySelect.addEventListener("change", async function () {
        await loadAssignableUserDropdown(this.value);
    });
}

document.getElementById("resourceForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("resourceId").value;

    const selectedAppUserId = document.getElementById("appUserId").value;

    const resource = {
        resourceName: document.getElementById("resourceName").value.trim(),
        role: document.getElementById("designation").value.trim(),
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
    } catch (error) {
        PMS.showError(error);
    }
});

async function loadInitialData() {
    if (canModifyResource) {
        const defaultCountry = currentUser && currentUser.country
            ? currentUser.country
            : "INDIA";

        document.getElementById("country").value = defaultCountry;
        await loadAssignableUserDropdown(defaultCountry);
    }

    await loadResources();
}

async function loadAssignableUserDropdown(country) {
    try {
        const countryQuery = country ? `&country=${country}` : "";
        const roles = ["DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER"];

        const results = await Promise.all(
            roles.map(role => PMS.apiGet(`/api/users/by-role?role=${role}${countryQuery}`))
        );

        const userMap = new Map();

        results.flat().forEach(user => {
            if (user && user.id) {
                userMap.set(user.id, user);
            }
        });

        const assignableUsers = Array.from(userMap.values());
        populateAssignableUserDropdown(assignableUsers);
    } catch (error) {
        PMS.showError(error);
    }
}

function populateAssignableUserDropdown(users) {
    const select = document.getElementById("appUserId");

    if (!select) {
        return;
    }

    select.innerHTML = `<option value="">No login account yet</option>`;

    users.forEach(user => {
        select.innerHTML += `
            <option value="${user.id}">
                ${user.name} / ${user.username} - ${user.displayRole || user.role || "-"} (${user.country || "-"})
            </option>
        `;
    });
}
async function loadResources() {
    try {
        const resources = await PMS.apiGet("/api/resources");
        resourcesCache = resources || [];
        renderResources(resourcesCache);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderResources(resources) {
    const table = document.getElementById("resourcesTable");

    if (!resources || resources.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="11" class="empty-state">No resources found</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = resources.map(resource => `
        <tr>
            <td>${resource.id}</td>
            <td>${resource.resourceName || "-"}</td>
            <td>${resource.designation || "-"}</td>
            <td>${resource.department || "-"}</td>
            <td>${resource.country || "-"}</td>
            <td>${resource.location || "-"}</td>
            <td>${resource.skill || "-"}</td>
           <td>
    ${resource.appUser
            ? `${resource.appUser.name} / ${resource.appUser.username}`
            : `<span class="muted-small">No login linked</span>`
        }
</td>
            <td>${PMS.isAdminOrDeliveryHead() ? PMS.formatHourlyUsdFromMonthlyInr(resource.monthlySalary) : "Restricted"}</td>
            <td>${PMS.badge(resource.status)}</td>
            ${canModifyResource
            ? `<td>
                        <button class="action-link" onclick="editResource(${resource.id})">Edit</button>
                        <button class="action-link danger" onclick="deleteResource(${resource.id})">Delete</button>
                       </td>`
            : `<td class="hidden"></td>`
        }
        </tr>
    `).join("");
}

async function editResource(id) {
    const resource = resourcesCache.find(item => item.id === id);

    if (!resource) {
        alert("Resource not found");
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

    document.getElementById("appUserId").value =
        resource.appUser ? resource.appUser.id : "";

    document.getElementById("saveResourceBtn").innerText = "Update Resource";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteResource(id) {
    const confirmed = confirm("Are you sure you want to delete this resource?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/resources/${id}`);
        await loadResources();
    } catch (error) {
        PMS.showError(error);
    }
}

function resetResourceForm() {
    document.getElementById("resourceForm").reset();
    document.getElementById("resourceId").value = "";
    document.getElementById("saveResourceBtn").innerText = "Save Resource";

    if (canModifyResource) {
        const defaultCountry = currentUser && currentUser.country
            ? currentUser.country
            : "INDIA";

        document.getElementById("country").value = defaultCountry;
        loadAssignableUserDropdown(defaultCountry);
    }
}