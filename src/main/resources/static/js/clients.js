PMS.protectPage(["ADMIN", "DELIVERY_MANAGER"]);
PMS.initLayout("clients");

loadClients();

document.getElementById("clientForm").addEventListener("submit", async function (event) {
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
        loadClients();
    } catch (error) {
        PMS.showError(error);
    }
});

async function loadClients() {
    try {
        const clients = await PMS.apiGet("/api/clients");
        renderClients(clients);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderClients(clients) {
    const table = document.getElementById("clientsTable");

    if (!clients || clients.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">No clients found</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = clients.map(client => `
        <tr>
            <td>${client.id}</td>
            <td>${client.clientName || "-"}</td>
            <td>${client.contactPerson || "-"}</td>
            <td>${client.email || "-"}</td>
            <td>${client.phone || "-"}</td>
            <td>${PMS.badge(client.status)}</td>
            <td>
                <button class="action-link" onclick='editClient(${JSON.stringify(client)})'>Edit</button>
                <button class="action-link danger" onclick="deleteClient(${client.id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function editClient(client) {
    document.getElementById("clientId").value = client.id;
    document.getElementById("clientName").value = client.clientName || "";
    document.getElementById("contactPerson").value = client.contactPerson || "";
    document.getElementById("email").value = client.email || "";
    document.getElementById("phone").value = client.phone || "";
    document.getElementById("status").value = client.status || "ACTIVE";

    document.getElementById("saveClientBtn").innerText = "Update Client";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteClient(id) {
    const confirmed = confirm("Are you sure you want to delete this client?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/clients/${id}`);
        loadClients();
    } catch (error) {
        PMS.showError(error);
    }
}

function resetClientForm() {
    document.getElementById("clientForm").reset();
    document.getElementById("clientId").value = "";
    document.getElementById("saveClientBtn").innerText = "Save Client";
}