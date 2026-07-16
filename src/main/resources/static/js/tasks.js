PMS.protectPage(["ADMIN",  "EXECUTIVE_VIEWER","DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER", "CLIENT_VIEWER"]);
PMS.initLayout("tasks");

 if (PMS.isExecutiveViewer()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "Organization Task Overview";
    }
}

const currentUser = PMS.getUser();

const canModifyTask = currentUser &&
    ["ADMIN", "DELIVERY_MANAGER", "TL"].includes(currentUser.role);

const canUpdateOwnProgress = currentUser &&
    currentUser.role === "TEAM_MEMBER";

const canShowTaskActions = canModifyTask || canUpdateOwnProgress;

const hideDetailedTaskColumnsForEmployee = PMS.isEmployee();

/*
    Current task table columns:

    1  ID
    2  Task Code
    3  Task Name
    4  Type
    5  Project
    6  Assignee
    7  Assignee Location
    8  Start
    9  End
    10 Allocated Hours
    11 Status
    12 Progress
    13 Priority
    14 Milestone
    15 Action

    For TEAM_MEMBER view, we hide:
    4 = Type
    6 = Assignee
    7 = Assignee Location

    We do NOT hide Task Name or Project.
*/
const employeeHiddenTaskColumnIndexes = [4, 6, 7];

applyTaskTableColumnRules();

function applyTaskTableColumnRules() {
    const taskTable = document.getElementById("tasksTable")?.closest("table");

    if (!taskTable) {
        return;
    }

    if (hideDetailedTaskColumnsForEmployee) {
        employeeHiddenTaskColumnIndexes.forEach(columnIndex => {
            const header = taskTable.querySelector(`thead th:nth-child(${columnIndex})`);

            if (header) {
                header.classList.add("hidden");
            }
        });
    }

    if (!canShowTaskActions) {
        const actionHeader = document.getElementById("taskActionHeader");

        if (actionHeader) {
            actionHeader.classList.add("hidden");
        }
    }
}

function getTaskTableColumnCount() {
    let columnCount = 15;

    if (hideDetailedTaskColumnsForEmployee) {
        columnCount -= employeeHiddenTaskColumnIndexes.length;
    }

    if (!canShowTaskActions) {
        columnCount -= 1;
    }

    return columnCount;
}

let tasksCache = [];
let tasksPager = null;
let projectsCache = [];
let milestonesCache = [];
let projectMembersCache = [];

if (!canModifyTask) {
    document.getElementById("taskFormSection").classList.add("hidden");
}

if (!canShowTaskActions) {
    document.getElementById("taskActionHeader").classList.add("hidden");
}

if (PMS.isEmployee()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "My Assigned Tasks";
    }
}

if (PMS.isTL()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "Tasks Under My Projects";
    }
}

if (PMS.isDeliveryManager()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "Tasks Under My Delivery Projects";
    }
}

if (PMS.isDeliveryHead()) {
    const listTitle = document.querySelector(".section:nth-of-type(2) .section-title");
    if (listTitle) {
        listTitle.innerText = "All Tasks Overview";
    }
}

initializeTaskPagination();
loadInitialData();

const projectSelect = document.getElementById("projectId");
if (projectSelect) {
   projectSelect.addEventListener("change", async function () {
    const projectId = Number(this.value);

    await Promise.all([
        loadMilestonesForProject(projectId, null),
        loadProjectMembersForProject(projectId, null)
    ]);
});
}

const taskForm = document.getElementById("taskForm");
if (taskForm) {
    taskForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("taskId").value;
        const isEscalated = document.getElementById("escalated").checked;

        const task = {
            taskName: document.getElementById("taskName").value.trim(),
            taskDescription: document.getElementById("taskDescription").value.trim(),
            taskType: document.getElementById("taskType").value,
            projectId: Number(document.getElementById("projectId").value),
            milestoneId: Number(document.getElementById("milestoneId").value),
            resourceId: Number(document.getElementById("resourceId").value),
            startDate: document.getElementById("startDate").value || null,
            endDate: document.getElementById("endDate").value || null,
            allocatedHours: Number(document.getElementById("allocatedHours").value || 0),
            status: document.getElementById("status").value,
            priority: document.getElementById("priority").value,
            progressPercentage: Number(document.getElementById("progressPercentage").value || 0),
            remarks: "",

            escalated: isEscalated,
            escalationReasonType: isEscalated ? document.getElementById("escalationReasonType").value : null,
            escalationReason: isEscalated ? document.getElementById("escalationReason").value.trim() : null,
            escalationSeverity: isEscalated ? document.getElementById("escalationSeverity").value : null,
            escalationStatus: isEscalated ? document.getElementById("escalationStatus").value : null,
            escalationDate: isEscalated ? document.getElementById("escalationDate").value || null : null
        };

        try {
            if (id) {
                await PMS.apiPut(`/api/tasks/${id}`, task);
            } else {
                await PMS.apiPost("/api/tasks", task);
            }

            resetTaskForm();
            await loadTasks();
            PMS_UI?.toast?.(id ? "Task updated successfully." : "Task created successfully.", "success");
        } catch (error) {
            PMS.showError(error);
        }
    });
}

async function loadInitialData() {
    try {
        if (PMS.isEmployee()) {
            await loadTasks();
            return;
        }
const projects = await PMS.apiGet(PMS.getProjectsApi());

projectsCache = projects || [];
milestonesCache = [];
projectMembersCache = [];

        const escalatedCheckbox = document.getElementById("escalated");

        if (escalatedCheckbox) {
            escalatedCheckbox.addEventListener("change", function () {
                toggleEscalationFields();
            });
        }

        populateProjectDropdown();
        populateMilestoneDropdown([], null);
        populateAssigneeDropdown([],null);

        await loadTasks();
    } catch (error) {
        PMS.showError(error);
    }
}

function toggleEscalationFields() {
    const escalated = document.getElementById("escalated").checked;
    const escalationFields = document.getElementById("escalationFields");

    if (escalated) {
        escalationFields.classList.remove("hidden");

        if (!document.getElementById("escalationStatus").value) {
            document.getElementById("escalationStatus").value = "OPEN";
        }

        if (!document.getElementById("escalationDate").value) {
            document.getElementById("escalationDate").value = new Date().toISOString().split("T")[0];
        }
    } else {
        escalationFields.classList.add("hidden");

        document.getElementById("escalationReasonType").value = "";
        document.getElementById("escalationReason").value = "";
        document.getElementById("escalationSeverity").value = "";
        document.getElementById("escalationStatus").value = "";
        document.getElementById("escalationDate").value = "";
    }
}

function filterMilestonesByProjects(milestones, projects) {
    if (PMS.isAdmin()) {
        return milestones;
    }

    const projectIds = projects.map(project => project.id);

    return milestones.filter(milestone =>
        milestone.project && projectIds.includes(milestone.project.id)
    );
}

function populateProjectDropdown() {
    const select = document.getElementById("projectId");
    select.innerHTML = `<option value="">Select Project</option>`;

    projectsCache.forEach(project => {
        select.innerHTML += `
            <option value="${project.id}">
                ${escapeHtml(project.projectName)}
            </option>
        `;
    });
}

async function loadMilestonesForProject(projectId, selectedMilestoneId) {
    if (!projectId) {
        milestonesCache = [];
        populateMilestoneDropdown([], null);
        return;
    }

    try {
        const milestones = await PMS.apiGet(`/api/milestones/project/${projectId}`);
        milestonesCache = milestones || [];
        populateMilestoneDropdown(milestonesCache, selectedMilestoneId);
    } catch (error) {
        PMS.showError(error);
    }
}


function populateMilestoneDropdown(milestones, selectedMilestoneId) {
    const select = document.getElementById("milestoneId");

    if (!select) {
        return;
    }

    select.innerHTML = `<option value="">Select Project First</option>`;

    if (!milestones || milestones.length === 0) {
        return;
    }

    select.innerHTML = `<option value="">Select Milestone</option>`;

    milestones.forEach(milestone => {
        const selected = selectedMilestoneId && milestone.id === selectedMilestoneId ? "selected" : "";

        select.innerHTML += `
            <option value="${milestone.id}" ${selected}>
                ${escapeHtml(milestone.milestoneName)}
            </option>
        `;
    });
}

async function loadProjectMembersForProject(projectId, selectedResourceId) {
    projectMembersCache = [];

    if (!projectId) {
        populateAssigneeDropdown([], null);
        return;
    }

    try {
        const members = await PMS.apiGet(`/api/project-members/project/${projectId}/active`);
        projectMembersCache = members || [];
        populateAssigneeDropdown(projectMembersCache, selectedResourceId);
    } catch (error) {
        PMS.showError(error);
        populateAssigneeDropdown([], null);
    }
}

function populateAssigneeDropdown(members, selectedResourceId) {
    const select = document.getElementById("resourceId");

    if (!select) {
        return;
    }

    select.innerHTML = `<option value="">Select Assignee</option>`;

    if (!members || members.length === 0) {
        select.innerHTML = `<option value="">No active project members found</option>`;
        return;
    }

    members.forEach(member => {
        const resource = member.resource;

        if (!resource) {
            return;
        }

        const selected = selectedResourceId && resource.id === selectedResourceId ? "selected" : "";
        const designation = resource.designation ? ` - ${resource.designation}` : "";
        const projectRole = member.projectRole ? ` / ${member.projectRole}` : "";
        const allocation = member.allocationPercentage ? ` / ${member.allocationPercentage}%` : "";
        const location = resource.location ? ` / ${resource.location}` : "";
        const manager = resource.reportingManagerName ? ` / Reports to: ${resource.reportingManagerName}` : " / Reports to: Not assigned";

        select.innerHTML += `
            <option value="${resource.id}" ${selected}>
                ${escapeHtml(resource.resourceName)}${escapeHtml(designation)}${escapeHtml(projectRole)}${escapeHtml(allocation)}${escapeHtml(location)}${escapeHtml(manager)}
            </option>
        `;
    });
}

function initializeTaskPagination() {
    const table = document.getElementById("tasksTable");
    tasksPager = PMS.createPagination({
        key: "tasks",
        container: table.closest(".section"),
        target: table.closest(".table-wrapper"),
        defaultSize: 25,
        sizeOptions: [25, 50, 100],
        searchPlaceholder: "Search task code, name, project, milestone or assignee",
        filters: [
            {
                key: "status",
                label: "Task status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "NOT_STARTED", label: "Not started" },
                    { value: "IN_PROGRESS", label: "In progress" },
                    { value: "BLOCKED", label: "Blocked" },
                    { value: "DELAYED", label: "Delayed" },
                    { value: "COMPLETED", label: "Completed" }
                ]
            },
            {
                key: "priority",
                label: "Priority",
                options: [
                    { value: "", label: "All priorities" },
                    { value: "CRITICAL", label: "Critical" },
                    { value: "HIGH", label: "High" },
                    { value: "MEDIUM", label: "Medium" },
                    { value: "LOW", label: "Low" }
                ]
            },
            {
                key: "escalated",
                label: "Escalation",
                options: [
                    { value: "", label: "All tasks" },
                    { value: "true", label: "Escalated only" },
                    { value: "false", label: "Not escalated" }
                ]
            }
        ],
        onChange: loadTasks
    });
}

async function loadTasks() {
    try {
        const query = tasksPager.buildParams({
            sort: "endDate",
            direction: "asc"
        });
        const response = await PMS.apiGet(`/api/tasks/paged?${query}`);
        tasksCache = response.content || [];
        renderTasks(tasksCache);
        tasksPager.update(response);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderTasks(tasks) {
    const table = document.getElementById("tasksTable");
    const columnCount = getTaskTableColumnCount();

    if (!tasks || tasks.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="${columnCount}" class="empty-state">
                    No tasks found. Create a project, allocate project members, create milestones, then create a task.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = tasks.map(task => {
        const description = task.taskDescription || task.remarks || "";

        const resourceLocation = task.assignedResource && task.assignedResource.location
            ? task.assignedResource.location
            : "-";

        const typeColumn = hideDetailedTaskColumnsForEmployee
            ? ""
            : `<td>${escapeHtml(task.taskType || "-")}</td>`;

        const resourceColumn = hideDetailedTaskColumnsForEmployee
            ? ""
            : `<td>${task.assignedResource
                ? `${escapeHtml(task.assignedResource.resourceName)}<div class="muted-small">Reports to: ${escapeHtml(task.assignedResource.reportingManagerName || "Not assigned")}</div>`
                : "-"}</td>`;

        const resourceLocationColumn = hideDetailedTaskColumnsForEmployee
            ? ""
            : `<td>${escapeHtml(resourceLocation)}</td>`;

        return `
            <tr>
                <td>${task.id}</td>

                <td>${escapeHtml(task.taskCode || "-")}</td>

                <td>

                    <div>${escapeHtml(task.taskName || "-")}</div>

                    ${description
                        ? `<div class="task-description">${escapeHtml(description)}</div>`
                        : ""
                    }

                    ${task.escalated
                        ? `<div class="escalation-line">
                                Escalated: ${PMS.badge(task.escalationSeverity || "OPEN")}
                           </div>`
                        : ""
                    }
                </td>

                ${typeColumn}

                <td>${task.project ? escapeHtml(task.project.projectName) : "-"}</td>

                ${resourceColumn}

                ${resourceLocationColumn}

                <td>${PMS.formatDate(task.startDate)}</td>

                <td>${PMS.formatDate(task.endDate)}</td>

                <td>${formatHours(task.allocatedHours)}</td>

                <td>${PMS.badge(task.status)}</td>

                <td>${formatProgress(task.progressPercentage)}</td>

                <td>${escapeHtml(task.priority || "-")}</td>

                <td>${task.milestone ? escapeHtml(task.milestone.milestoneName) : "-"}</td>

                ${renderActionColumn(task)}
            </tr>

            ${task.escalated
                ? `<tr>
                        <td colspan="${columnCount}" class="muted-text">
                            <strong>Escalation Reason:</strong>
                            ${formatReasonType(task.escalationReasonType)}
                            ${task.escalationReason ? " - " + escapeHtml(task.escalationReason) : ""}
                            ${task.escalationStatus ? " | Status: " + escapeHtml(task.escalationStatus) : ""}
                            ${task.escalationDate ? " | Date: " + PMS.formatDate(task.escalationDate) : ""}
                        </td>
                   </tr>`
                : ""
            }
        `;
    }).join("");
}

function renderActionColumn(task) {
    if (canModifyTask) {
        return `<td>
    <button class="action-link" onclick="editTask(${task.id})">Edit</button>
    <button class="action-link" onclick="viewTaskTimeSummary(${task.id})">Time Summary</button>
    <button class="action-link danger" onclick="deleteTask(${task.id})">Delete</button>
</td>`;
    }

    if (canUpdateOwnProgress) {
        return `<td>
    <button class="action-link" onclick="updateTaskProgress(${task.id})">Update Progress</button>
    <button class="action-link" onclick="viewTaskTimeSummary(${task.id})">Time Summary</button>
</td>`;
    }

    return `<td class="hidden"></td>`;
}

async function editTask(id) {
    const task = tasksCache.find(item => item.id === id);

    if (!task) {
        alert("Task not found");
        return;
    }

    const projectId = task.project ? task.project.id : null;
    const milestoneId = task.milestone ? task.milestone.id : null;

    document.getElementById("taskId").value = task.id;
    document.getElementById("taskName").value = task.taskName || "";
    document.getElementById("taskDescription").value = task.taskDescription || task.remarks || "";
    document.getElementById("taskType").value = task.taskType || "Technical";
    document.getElementById("projectId").value = projectId || "";

    await Promise.all([
    loadMilestonesForProject(projectId, milestoneId),
    loadProjectMembersForProject(
        projectId,
        task.assignedResource ? task.assignedResource.id : null
    )
]);
    document.getElementById("startDate").value = task.startDate || "";
    document.getElementById("endDate").value = task.endDate || "";
    document.getElementById("allocatedHours").value = task.allocatedHours || 0;
    document.getElementById("status").value = task.status || "NOT_STARTED";
    document.getElementById("priority").value = task.priority || "MEDIUM";
    document.getElementById("progressPercentage").value = task.progressPercentage || 0;
    document.getElementById("escalated").checked = Boolean(task.escalated);
    document.getElementById("escalationReasonType").value = task.escalationReasonType || "";
    document.getElementById("escalationReason").value = task.escalationReason || "";
    document.getElementById("escalationSeverity").value = task.escalationSeverity || "";
    document.getElementById("escalationStatus").value = task.escalationStatus || "";
    document.getElementById("escalationDate").value = task.escalationDate || "";

    toggleEscalationFields();

    document.getElementById("saveTaskBtn").innerText = "Update Task";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function updateTaskProgress(id) {
    const task = tasksCache.find(item => item.id === id);

    if (!task) {
        if (window.PMS_UI?.toast) {
            window.PMS_UI.toast("Task could not be found.", "error");
        } else {
            window.alert("Task could not be found.");
        }
        return;
    }

    const currentProgress = task.progressPercentage || 0;
    let value;

    if (window.PMS_UI?.prompt) {
        value = await window.PMS_UI.prompt({
            title: "Update task progress",
            message: `${task.taskName || "Task"} — enter completion percentage.`,
            value: String(currentProgress),
            type: "number",
            min: 0,
            max: 100,
            required: true
        });
    } else {
        value = window.prompt(
            "Enter completion percentage between 0 and 100:",
            String(currentProgress)
        );
    }

    if (value === null) {
        return;
    }

    const progressPercentage = Number(value);

    if (!Number.isFinite(progressPercentage)
            || progressPercentage < 0
            || progressPercentage > 100) {
        PMS.showError(new Error("Progress percentage must be between 0 and 100."));
        return;
    }

    try {
        await PMS.apiPut(
            `/api/tasks/${id}/progress`,
            { progressPercentage }
        );

        await loadTasks();

        if (window.PMS_UI?.toast) {
            window.PMS_UI.toast(
                "Task progress updated successfully.",
                "success"
            );
        }
    } catch (error) {
        PMS.showError(error);
    }
}

async function viewTaskTimeSummary(id) {
    try {
        const summary = await PMS.apiGet(
            `/api/tasks/${id}/time-summary`
        );

        const reportingManagerDesignation =
            summary.reportingManagerDesignation
                ? ` (${summary.reportingManagerDesignation})`
                : "";

        alert(
            `Task: ${summary.taskName || "-"}\n` +
            `Resource: ${summary.resourceName || "-"}\n` +
            `Reports to: ${summary.reportingManagerName || "Not assigned"}` +
            `${reportingManagerDesignation}\n\n` +

            `Allocated Hours: ${formatPlainHours(summary.allocatedHours)}\n` +
            `Draft Hours: ${formatPlainHours(summary.draftHours)}\n` +
            `Pending Approval Hours: ${formatPlainHours(summary.pendingApprovalHours)}\n` +
            `Approved Hours: ${formatPlainHours(summary.approvedHours)}\n` +
            `Rejected Hours: ${formatPlainHours(summary.rejectedHours)}\n` +
            `Remaining Hours: ${formatPlainHours(summary.remainingHours)}\n` +
            `Overrun Hours: ${formatPlainHours(summary.overrunHours)}\n\n` +

            `Planned Cost: ${PMS.formatMoney(summary.plannedCost)}\n` +
            `Actual Cost: ${PMS.formatMoney(summary.actualCost)}\n` +
            `Cost Variance: ${PMS.formatMoney(summary.costVariance)}`
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function deleteTask(id) {
    const confirmed = confirm("Are you sure you want to delete this task?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/tasks/${id}`);
        if (tasksCache.length === 1 && tasksPager.state.page > 0) {
            tasksPager.setPage(tasksPager.state.page - 1);
        }
        await loadTasks();
        PMS_UI?.toast?.("Task deleted successfully.", "success");
    } catch (error) {
        PMS.showError(error);
    }
}

function resetTaskForm() {
    document.getElementById("taskForm").reset();
    document.getElementById("taskId").value = "";
    document.getElementById("progressPercentage").value = 0;
    document.getElementById("allocatedHours").value = 0;
    document.getElementById("saveTaskBtn").innerText = "Save Task";
   milestonesCache = [];
projectMembersCache = [];

populateMilestoneDropdown([], null);
populateAssigneeDropdown([], null);
    document.getElementById("escalated").checked = false;
    document.getElementById("escalationReasonType").value = "";
    document.getElementById("escalationReason").value = "";
    document.getElementById("escalationSeverity").value = "";
    document.getElementById("escalationStatus").value = "";
    document.getElementById("escalationDate").value = "";

    toggleEscalationFields();
}

function formatProgress(value) {
    const progress = Number(value || 0);
    return `<span class="badge badge-info">${progress}%</span>`;
}

function formatHours(value) {
    return `<span class="badge badge-info">${formatPlainHours(value)}</span>`;
}

function formatPlainHours(value) {
    const hours = Number(value || 0);
    return `${hours.toFixed(2)} hrs`;
}

function formatReasonType(reasonType) {
    if (!reasonType) {
        return "-";
    }

    return reasonType
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
