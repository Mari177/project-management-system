PMS.protectPage(["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER"]);
PMS.initLayout("timesheets");

const currentUser = PMS.getUser();
const isAdmin = currentUser && currentUser.role === "ADMIN";
const isApprover = currentUser && ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"].includes(currentUser.role);

let resourcesCache = [];
let tasksCache = [];
let timesheetsCache = [];
let selectedTimesheet = null;
let currentTimesheetView = "my";

initializeTimesheetPage();

async function initializeTimesheetPage() {
    configurePageByRole();
    bindForms();

    try {
        await loadReferenceData();
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

function configurePageByRole() {
    if (!isAdmin) {
        document.querySelectorAll(".admin-only-field").forEach(element => {
            element.classList.add("hidden");
        });
    }

    if (!isApprover) {
        document.querySelectorAll(".approver-only").forEach(element => {
            element.classList.add("hidden");
        });
    }
}

function bindForms() {
    const timesheetForm = document.getElementById("timesheetForm");

    if (timesheetForm) {
        timesheetForm.addEventListener("submit", async event => {
            event.preventDefault();
            await createTimesheet();
        });
    }

    const timeLogForm = document.getElementById("timeLogForm");

    if (timeLogForm) {
        timeLogForm.addEventListener("submit", async event => {
            event.preventDefault();
            await saveTimeLog();
        });
    }
}

async function loadReferenceData() {
    const taskPromise = PMS.apiGet(PMS.getTasksApi());
    const resourcePromise = isAdmin ? PMS.apiGet("/api/resources") : Promise.resolve([]);

    const [tasks, resources] = await Promise.all([taskPromise, resourcePromise]);

    tasksCache = tasks || [];
    resourcesCache = resources || [];

    if (isAdmin) {
        populateResourceDropdown();
    }
}

function populateResourceDropdown() {
    const select = document.getElementById("timesheetResourceId");

    if (!select) {
        return;
    }

    select.innerHTML = `<option value="">Select Person</option>`;

    resourcesCache.forEach(resource => {
        const location = resource.location ? ` - ${resource.location}` : "";
        const designation = resource.designation ? ` (${resource.designation})` : "";

        select.innerHTML += `
            <option value="${resource.id}">
                ${escapeHtml(resource.resourceName || "-")}${escapeHtml(designation)}${escapeHtml(location)}
            </option>
        `;
    });
}

async function setTimesheetView(view) {
    currentTimesheetView = view;
    selectedTimesheet = null;
    resetSelectedTimesheetBox();
    resetTimeLogForm();
    await loadTimesheets();
}

async function loadTimesheets() {
    try {
        const endpoint = getTimesheetEndpoint();
        const data = await PMS.apiGet(endpoint);
        timesheetsCache = data || [];
        renderTimesheets(timesheetsCache);
        updateTimesheetListTitle();
        updateViewButtons();
    } catch (error) {
        PMS.showError(error);
    }
}

function getTimesheetEndpoint() {
    if (currentTimesheetView === "pending") {
        return "/api/timesheets/pending-approval";
    }

    if (currentTimesheetView === "all") {
        return "/api/timesheets";
    }

    return "/api/timesheets/my";
}

function updateTimesheetListTitle() {
    const title = document.getElementById("timesheetListTitle");
    const subtitle = document.getElementById("timesheetListSubtitle");

    if (!title) {
        return;
    }

    if (currentTimesheetView === "pending") {
        title.innerText = "Pending My Approval";
        if (subtitle) {
            subtitle.innerText = "Approve or reject submitted timesheets directly from the cards.";
        }
        return;
    }

    if (currentTimesheetView === "all") {
        title.innerText = "All Visible Timesheets";
        if (subtitle) {
            subtitle.innerText = "Review timesheets visible to your role.";
        }
        return;
    }

    title.innerText = "My Timesheets";
    if (subtitle) {
        subtitle.innerText = "Select a timesheet to view summary, actions, or work logs.";
    }
}

function updateViewButtons() {
    const mapping = {
        my: "timesheetViewMyBtn",
        pending: "timesheetViewPendingBtn",
        all: "timesheetViewAllBtn"
    };

    Object.entries(mapping).forEach(([view, elementId]) => {
        const button = document.getElementById(elementId);

        if (!button) {
            return;
        }

        button.classList.toggle("active", currentTimesheetView === view);
    });
}

function renderTimesheets(timesheets) {
    const list = document.getElementById("timesheetsList");

    if (!list) {
        return;
    }

    if (!timesheets || timesheets.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                No timesheets found.
            </div>
        `;
        return;
    }

    list.innerHTML = timesheets.map(timesheet => renderTimesheetCard(timesheet)).join("");
}

function renderTimesheetCard(timesheet) {
    const selectedClass = selectedTimesheet && selectedTimesheet.id === timesheet.id ? "selected" : "";
    const period = `${PMS.formatDate(timesheet.periodStart)} to ${PMS.formatDate(timesheet.periodEnd)}`;
    const logCount = Array.isArray(timesheet.timeLogs) ? timesheet.timeLogs.length : timesheet.timeLogCount;

    return `
        <article class="timesheet-list-item ${selectedClass}">
            <div class="timesheet-list-item-main">
                <div class="timesheet-list-topline">
                    <div>
                        <div class="timesheet-period">${escapeHtml(period)}</div>
                    </div>

                    <div>
                        <div class="timesheet-person">${escapeHtml(timesheet.resourceName || "-")}</div>
                    </div>

                    <div class="timesheet-status-wrap">
                        ${PMS.badge(timesheet.status)}
                    </div>
                </div>

                <div class="timesheet-card-metrics">
                    <div>
                        <span>Total</span>
                        <strong>${formatHours(timesheet.totalHours)}</strong>
                    </div>
                    <div>
                        <span>Billable</span>
                        <strong>${formatHours(timesheet.billableHours)}</strong>
                    </div>
                    <div>
                        <span>Non Billable</span>
                        <strong>${formatHours(timesheet.nonBillableHours)}</strong>
                    </div>
                    <div>
                        <span>Logs</span>
                        <strong>${logCount === undefined || logCount === null ? "-" : logCount}</strong>
                    </div>
                </div>
            </div>

            <div class="timesheet-list-actions">
                <button class="btn btn-primary btn-small" type="button" onclick="selectTimesheet(${timesheet.id})">
                    Open
                </button>
                <button class="btn btn-secondary btn-small" type="button" onclick="openTimesheetWorkLogs(${timesheet.id})">
                    Work Logs
                </button>
                ${renderTimesheetInlineActions(timesheet)}
            </div>
        </article>
    `;
}

function renderTimesheetInlineActions(timesheet) {
    const status = timesheet.status;
    const buttons = [];

    if (["DRAFT", "REJECTED", "RECALLED"].includes(status)) {
        buttons.push(`
            <button class="btn btn-secondary btn-small" type="button" onclick="submitTimesheet(${timesheet.id})">
                Submit
            </button>
        `);
    }

    if (status === "PENDING_APPROVAL" && isApprover && currentTimesheetView === "pending") {
        buttons.push(`
            <button class="btn btn-primary btn-small" type="button" onclick="approveTimesheet(${timesheet.id})">
                Approve
            </button>
            <button class="btn btn-danger btn-small" type="button" onclick="rejectTimesheet(${timesheet.id})">
                Reject
            </button>
        `);
    }

    return buttons.join("");
}

async function createTimesheet() {
    const resourceSelect = document.getElementById("timesheetResourceId");
    const resourceIdValue = resourceSelect ? resourceSelect.value : "";

    const payload = {
        resourceId: isAdmin ? (resourceIdValue ? Number(resourceIdValue) : null) : null,
        periodStart: document.getElementById("periodStart").value,
        periodEnd: document.getElementById("periodEnd").value
    };

    try {
        const timesheet = await PMS.apiPost("/api/timesheets", payload);
        document.getElementById("timesheetForm").reset();
        currentTimesheetView = "my";
        await loadTimesheets();
        await selectTimesheet(timesheet.id);
    } catch (error) {
        PMS.showError(error);
    }
}

async function selectTimesheet(id) {
    try {
        selectedTimesheet = await PMS.apiGet(`/api/timesheets/${id}`);
        renderSelectedTimesheet(selectedTimesheet);
        populateTimeLogTaskDropdown(selectedTimesheet);
        renderTimesheets(timesheetsCache);
    } catch (error) {
        PMS.showError(error);
    }
}

function renderSelectedTimesheet(timesheet) {
    const box = document.getElementById("selectedTimesheetBox");

    if (!box) {
        return;
    }

    const logs = timesheet.timeLogs || [];
    const canEdit = isTimesheetEditable(timesheet);

    box.innerHTML = `
        <div class="timesheet-detail-header">
            <div>
                <h3 class="timesheet-card-title">Selected Timesheet</h3>
                <div class="muted-small">
                    ${escapeHtml(timesheet.resourceName || "-")} | ${PMS.formatDate(timesheet.periodStart)} to ${PMS.formatDate(timesheet.periodEnd)}
                </div>
            </div>
            <div>${PMS.badge(timesheet.status)}</div>
        </div>

        <div class="timesheet-metrics">
            <div class="report-metric">
                <span>Total</span>
                <strong>${formatHours(timesheet.totalHours)}</strong>
            </div>
            <div class="report-metric">
                <span>Billable</span>
                <strong>${formatHours(timesheet.billableHours)}</strong>
            </div>
            <div class="report-metric">
                <span>Non Billable</span>
                <strong>${formatHours(timesheet.nonBillableHours)}</strong>
            </div>
            <div class="report-metric">
                <span>Work Logs</span>
                <strong>${logs.length}</strong>
            </div>
        </div>

        <div class="selected-timesheet-actions">
            <button class="btn btn-primary btn-small" type="button" onclick="openWorkLogDialog()">
                View Work Logs
            </button>
            ${renderTimesheetActionButtons(timesheet)}
        </div>

        ${timesheet.rejectionReason ? `
            <div class="timesheet-warning-box">
                <strong>Rejection Reason:</strong> ${escapeHtml(timesheet.rejectionReason)}
            </div>
        ` : ""}

        <div class="timesheet-help-box">
            Work log details open in a dialog, so you do not need to scroll through a large table inside this page.
        </div>
    `;

    const logFormSection = document.getElementById("timeLogFormSection");

    if (logFormSection) {
        if (canEdit) {
            logFormSection.classList.remove("hidden");
        } else {
            logFormSection.classList.add("hidden");
        }
    }
}

function renderTimesheetActionButtons(timesheet) {
    const status = timesheet.status;
    const buttons = [];

    if (["DRAFT", "REJECTED", "RECALLED"].includes(status)) {
        buttons.push(`
            <button class="btn btn-secondary btn-small" type="button" onclick="submitTimesheet(${timesheet.id})">
                Submit for Approval
            </button>
        `);
    }

    if (status === "PENDING_APPROVAL") {
        buttons.push(`
            <button class="btn btn-secondary btn-small" type="button" onclick="recallTimesheet(${timesheet.id})">
                Recall
            </button>
        `);

        if (isApprover && currentTimesheetView === "pending") {
            buttons.push(`
                <button class="btn btn-primary btn-small" type="button" onclick="approveTimesheet(${timesheet.id})">
                    Approve
                </button>
                <button class="btn btn-danger btn-small" type="button" onclick="rejectTimesheet(${timesheet.id})">
                    Reject
                </button>
            `);
        }
    }

    if (buttons.length === 0) {
        return "";
    }

    return `<div class="timesheet-action-bar compact-action-bar">${buttons.join("")}</div>`;
}

async function openTimesheetWorkLogs(id) {
    await selectTimesheet(id);
    openWorkLogDialog();
}

function openWorkLogDialog() {
    if (!selectedTimesheet) {
        alert("Please select a timesheet first.");
        return;
    }

    const modal = document.getElementById("workLogModal");
    const title = document.getElementById("workLogModalTitle");
    const subtitle = document.getElementById("workLogModalSubtitle");
    const body = document.getElementById("workLogModalBody");

    if (!modal || !title || !subtitle || !body) {
        return;
    }

    const logs = selectedTimesheet.timeLogs || [];

    title.innerText = "Work Log Details";
    subtitle.innerText = `${selectedTimesheet.resourceName || "-"} | ${PMS.formatDate(selectedTimesheet.periodStart)} to ${PMS.formatDate(selectedTimesheet.periodEnd)} | ${logs.length} log(s)`;
    body.innerHTML = renderWorkLogDialogContent(selectedTimesheet);

    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeWorkLogDialog() {
    const modal = document.getElementById("workLogModal");

    if (modal) {
        modal.classList.add("hidden");
    }

    document.body.classList.remove("modal-open");
}

function handleWorkLogModalBackdrop(event) {
    if (event.target && event.target.id === "workLogModal") {
        closeWorkLogDialog();
    }
}

function renderWorkLogDialogContent(timesheet) {
    const logs = timesheet.timeLogs || [];
    const canEdit = isTimesheetEditable(timesheet);

    if (logs.length === 0) {
        return `
            <div class="empty-state">
                No work logs added yet.
            </div>
        `;
    }

    return `
        <div class="worklog-summary-strip">
            <div>
                <span>Total</span>
                <strong>${formatHours(timesheet.totalHours)}</strong>
            </div>
            <div>
                <span>Billable</span>
                <strong>${formatHours(timesheet.billableHours)}</strong>
            </div>
            <div>
                <span>Non Billable</span>
                <strong>${formatHours(timesheet.nonBillableHours)}</strong>
            </div>
            <div>
                <span>Status</span>
                <strong>${escapeHtml(formatStatusText(timesheet.status))}</strong>
            </div>
        </div>

        <div class="worklog-card-list">
            ${logs.map(log => renderWorkLogCard(log, canEdit)).join("")}
        </div>
    `;
}

function renderWorkLogCard(log, canEdit) {
    const projectCode = getTimeLogProjectCode(log);
    const projectName = getTimeLogProjectName(log);
    const milestoneName = getTimeLogMilestoneName(log);
    const taskCode = getTimeLogTaskCode(log);
    const taskName = getTimeLogTaskName(log);

    return `
        <article class="worklog-card">
            <div class="worklog-card-header">
                <div>
                    <div class="worklog-project-line">
                        ${projectCode ? `<span>${escapeHtml(projectCode)}</span>` : ""}
                        <strong>${escapeHtml(projectName)}</strong>
                    </div>
                    <div class="worklog-milestone-line">
                        ${escapeHtml(milestoneName)}
                    </div>
                </div>
                <div class="worklog-status">
                    ${PMS.badge(log.status)}
                </div>
            </div>

            <div class="worklog-task-line">
                ${taskCode ? `<span>${escapeHtml(taskCode)}</span>` : ""}
                <strong>${escapeHtml(taskName)}</strong>
                ${log.overrun ? `<em>Overrun</em>` : ""}
            </div>

            <div class="worklog-meta-grid">
                <div>
                    <span>Date</span>
                    <strong>${PMS.formatDate(log.logDate)}</strong>
                </div>
                <div>
                    <span>Hours</span>
                    <strong>${formatHours(log.hours)}</strong>
                </div>
                <div>
                    <span>Billing</span>
                    <strong>${escapeHtml(formatBillingType(log.billingType))}</strong>
                </div>
            </div>

            <div class="worklog-description">
                <span>Description</span>
                <p>${escapeHtml(log.workDescription || "-")}</p>
            </div>

            <div class="worklog-card-actions">
                ${canEdit ? `
                    <button class="btn btn-secondary btn-small" type="button" onclick="editTimeLog(${log.id})">Edit</button>
                    <button class="btn btn-danger btn-small" type="button" onclick="deleteTimeLog(${log.id})">Delete</button>
                ` : `<span class="muted-small">No actions available</span>`}
            </div>
        </article>
    `;
}

function getTimeLogProjectName(log) {
    if (log.projectName) {
        return log.projectName;
    }

    if (log.project && log.project.projectName) {
        return log.project.projectName;
    }

    if (log.task && log.task.project && log.task.project.projectName) {
        return log.task.project.projectName;
    }

    return "-";
}

function getTimeLogProjectCode(log) {
    if (log.projectCode) {
        return log.projectCode;
    }

    if (log.project && log.project.projectCode) {
        return log.project.projectCode;
    }

    if (log.task && log.task.project && log.task.project.projectCode) {
        return log.task.project.projectCode;
    }

    return "";
}

function getTimeLogMilestoneName(log) {
    if (log.milestoneName) {
        return log.milestoneName;
    }

    if (log.milestone && log.milestone.milestoneName) {
        return log.milestone.milestoneName;
    }

    if (log.task && log.task.milestone && log.task.milestone.milestoneName) {
        return log.task.milestone.milestoneName;
    }

    return "-";
}

function getTimeLogTaskName(log) {
    if (log.taskName) {
        return log.taskName;
    }

    if (log.task && log.task.taskName) {
        return log.task.taskName;
    }

    return "-";
}

function getTimeLogTaskCode(log) {
    if (log.taskCode) {
        return log.taskCode;
    }

    if (log.task && log.task.taskCode) {
        return log.task.taskCode;
    }

    return "";
}

function populateTimeLogTaskDropdown(timesheet) {
    const select = document.getElementById("timeLogTaskId");

    if (!select) {
        return;
    }

    const resourceTasks = tasksCache.filter(task =>
        task.assignedResource && task.assignedResource.id === timesheet.resourceId
    );

    select.innerHTML = `<option value="">Select Task</option>`;

    if (resourceTasks.length === 0) {
        select.innerHTML = `<option value="">No assigned tasks found for this person</option>`;
        return;
    }

    resourceTasks.forEach(task => {
        const projectName = task.project ? task.project.projectName : "Project";
        const projectCode = task.project && task.project.projectCode ? `${task.project.projectCode} - ` : "";
        const milestoneName = task.milestone ? task.milestone.milestoneName : "Milestone";
        const taskCode = task.taskCode ? `${task.taskCode} - ` : "";

        select.innerHTML += `
            <option value="${task.id}">
                ${escapeHtml(projectCode + projectName)} | ${escapeHtml(milestoneName)} | ${escapeHtml(taskCode + (task.taskName || "-"))}
            </option>
        `;
    });
}

async function saveTimeLog() {
    if (!selectedTimesheet) {
        alert("Please select a timesheet first.");
        return;
    }

    const id = document.getElementById("timeLogId").value;

    const payload = {
        timesheetId: selectedTimesheet.id,
        taskId: Number(document.getElementById("timeLogTaskId").value),
        resourceId: selectedTimesheet.resourceId,
        logDate: document.getElementById("logDate").value,
        hours: Number(document.getElementById("logHours").value),
        billingType: document.getElementById("billingType").value,
        workDescription: document.getElementById("workDescription").value.trim()
    };

    try {
        if (id) {
            await PMS.apiPut(`/api/time-logs/${id}`, payload);
        } else {
            await PMS.apiPost("/api/time-logs", payload);
        }

        resetTimeLogForm();
        await refreshSelectedTimesheet();
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

function editTimeLog(id) {
    if (!selectedTimesheet) {
        return;
    }

    const log = (selectedTimesheet.timeLogs || []).find(item => item.id === id);

    if (!log) {
        alert("Time log not found");
        return;
    }

    closeWorkLogDialog();

    document.getElementById("timeLogId").value = log.id;
    document.getElementById("timeLogTaskId").value = log.taskId || "";
    document.getElementById("logDate").value = log.logDate || "";
    document.getElementById("logHours").value = log.hours || "";
    document.getElementById("billingType").value = log.billingType || "BILLABLE";
    document.getElementById("workDescription").value = log.workDescription || "";
    document.getElementById("saveTimeLogBtn").innerText = "Update Time Log";

    const formSection = document.getElementById("timeLogFormSection");
    if (formSection) {
        formSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

async function deleteTimeLog(id) {
    const confirmed = confirm("Delete this time log?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(`/api/time-logs/${id}`);
        await refreshSelectedTimesheet();
        await loadTimesheets();

        const modal = document.getElementById("workLogModal");
        if (modal && !modal.classList.contains("hidden")) {
            openWorkLogDialog();
        }
    } catch (error) {
        PMS.showError(error);
    }
}

async function submitTimesheet(id) {
    const confirmed = confirm("Submit this timesheet for approval?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiPost(`/api/timesheets/${id}/submit`, {});
        await refreshSelectedTimesheetIfSame(id);
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

async function recallTimesheet(id) {
    const confirmed = confirm("Recall this pending timesheet for correction?");

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiPost(`/api/timesheets/${id}/recall`, {});
        await refreshSelectedTimesheetIfSame(id);
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

async function approveTimesheet(id) {
    const comments = prompt("Approval comments optional", "Approved");

    if (comments === null) {
        return;
    }

    try {
        await PMS.apiPost(`/api/timesheets/${id}/approve`, { comments });
        await refreshSelectedTimesheetIfSame(id);
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

async function rejectTimesheet(id) {
    const rejectionReason = prompt("Enter rejection reason");

    if (rejectionReason === null) {
        return;
    }

    if (!rejectionReason.trim()) {
        alert("Rejection reason is required.");
        return;
    }

    try {
        await PMS.apiPost(`/api/timesheets/${id}/reject`, { rejectionReason: rejectionReason.trim() });
        await refreshSelectedTimesheetIfSame(id);
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

async function refreshSelectedTimesheetIfSame(id) {
    if (!selectedTimesheet || selectedTimesheet.id !== id) {
        return;
    }

    await refreshSelectedTimesheet();
}

async function refreshSelectedTimesheet() {
    if (!selectedTimesheet) {
        return;
    }

    selectedTimesheet = await PMS.apiGet(`/api/timesheets/${selectedTimesheet.id}`);
    renderSelectedTimesheet(selectedTimesheet);
    populateTimeLogTaskDropdown(selectedTimesheet);
}

function resetTimeLogForm() {
    const form = document.getElementById("timeLogForm");

    if (form) {
        form.reset();
    }

    document.getElementById("timeLogId").value = "";
    document.getElementById("billingType").value = "BILLABLE";
    document.getElementById("saveTimeLogBtn").innerText = "Save Time Log";
}

function resetSelectedTimesheetBox() {
    const box = document.getElementById("selectedTimesheetBox");

    if (box) {
        box.innerHTML = `
            <div class="empty-state">
                Select a timesheet to view summary and actions.
            </div>
        `;
    }

    const formSection = document.getElementById("timeLogFormSection");

    if (formSection) {
        formSection.classList.add("hidden");
    }
}

function isTimesheetEditable(timesheet) {
    return timesheet && ["DRAFT", "REJECTED", "RECALLED"].includes(timesheet.status);
}

function formatHours(value) {
    const hours = Number(value || 0);
    return `${hours.toFixed(2)} hrs`;
}

function formatBillingType(value) {
    if (!value) {
        return "-";
    }

    return value.replaceAll("_", " ");
}

function formatStatusText(value) {
    if (!value) {
        return "-";
    }

    return value.replaceAll("_", " ");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

window.setTimesheetView = setTimesheetView;
window.loadTimesheets = loadTimesheets;
window.selectTimesheet = selectTimesheet;
window.openTimesheetWorkLogs = openTimesheetWorkLogs;
window.openWorkLogDialog = openWorkLogDialog;
window.closeWorkLogDialog = closeWorkLogDialog;
window.handleWorkLogModalBackdrop = handleWorkLogModalBackdrop;
window.submitTimesheet = submitTimesheet;
window.recallTimesheet = recallTimesheet;
window.approveTimesheet = approveTimesheet;
window.rejectTimesheet = rejectTimesheet;
window.editTimeLog = editTimeLog;
window.deleteTimeLog = deleteTimeLog;
window.resetTimeLogForm = resetTimeLogForm;