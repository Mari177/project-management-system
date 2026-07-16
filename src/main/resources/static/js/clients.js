PMS.protectPage(["ADMIN", "DELIVERY_MANAGER"]);
PMS.initLayout("clients");

let clientsCache = [];
let clientsPager = null;

initializeClientsPage();

function initializeClientsPage() {
    const tableBody = document.getElementById("clientsTable");
    const section = tableBody.closest(".section");
    const tableWrapper = tableBody.closest(".table-wrapper");

    clientsPager = PMS.createPagination({
        key: "clients",
        container: section,
        target: tableWrapper,
        defaultSize: 20,
        sizeOptions: [20, 50, 100],
        searchPlaceholder: "Search clients by name, contact, email or phone",
        filters: [
            {
                key: "status",
                label: "Client status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" }
                ]
            }
        ],
        onChange: loadClients
    });

    document.getElementById("clientForm").addEventListener("submit", saveClient);
    loadClients();
}

async function saveClient(event) {
    event.preventDefault();

    const id = document.getElementById("clientId").value;
    const client = {
        clientName: document.getElementById("clientName").value.trim(),
        contactPerson: document.getElementById("contactPerson").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        status: document.getElementById("status").value
    };

    try {
        if (id) {
            await PMS.apiPut(`/api/clients/${id}`, client);
        } else {
            await PMS.apiPost("/api/clients", client);
        }

        resetClientForm();
        await loadClients();
        PMS_UI?.toast?.(id ? "Client updated successfully." : "Client created successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

async function loadClients() {
    try {
        const query = clientsPager.buildParams({
            sort: "clientName",
            direction: "asc"
        });

        const response = await PMS.apiGet(`/api/clients/paged?${query}`);
        clientsCache = response.content || [];
        renderClients(clientsCache);
        clientsPager.update(response);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderClients(clients) {
    const table = document.getElementById("clientsTable");

    if (!clients || clients.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    No clients match the selected filters.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = clients.map(client => `
        <tr>
            <td>${client.id}</td>
            <td><strong>${escapeHtml(client.clientName || "-")}</strong></td>
            <td>${escapeHtml(client.contactPerson || "-")}</td>
            <td>${escapeHtml(client.email || "-")}</td>
            <td>${escapeHtml(client.phone || "-")}</td>
            <td>${PMS.badge(client.status)}</td>
            <td>
                <button class="action-link" onclick="editClient(${client.id})">Edit</button>
                <button class="action-link danger" onclick="deleteClient(${client.id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function editClient(id) {
    const client = clientsCache.find(item => item.id === id);

    if (!client) {
        PMS_UI?.toast?.("Client could not be found on the current page.", "error");
        return;
    }

    document.getElementById("clientId").value = client.id;
    document.getElementById("clientName").value = client.clientName || "";
    document.getElementById("contactPerson").value = client.contactPerson || "";
    document.getElementById("email").value = client.email || "";
    document.getElementById("phone").value = client.phone || "";
    document.getElementById("status").value = client.status || "ACTIVE";
    document.getElementById("saveClientBtn").innerText = "Update Client";
}

async function deleteClient(id) {
    const confirmed = window.PMS_UI?.confirm
        ? await PMS_UI.confirm("Delete client?", "This action cannot be undone.")
        : window.confirm("Are you sure you want to delete this client?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/clients/${id}`);

        if (clientsCache.length === 1 && clientsPager.state.page > 0) {
            clientsPager.setPage(clientsPager.state.page - 1);
        }

        await loadClients();
        PMS_UI?.toast?.("Client deleted successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

function resetClientForm() {
    document.getElementById("clientForm").reset();
    document.getElementById("clientId").value = "";
    document.getElementById("saveClientBtn").innerText = "Save Client";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
