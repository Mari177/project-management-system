PMS.protectPage([
    "ADMIN",
    "DELIVERY_HEAD",
    "DELIVERY_MANAGER",
    "TL",
    "TEAM_MEMBER"
]);

PMS.initLayout("timesheets");

const currentUser = PMS.getUser();

const isAdmin =
    currentUser
    && currentUser.role === "ADMIN";

const isApprover =
    currentUser
    && [
        "ADMIN",
        "DELIVERY_HEAD",
        "DELIVERY_MANAGER",
        "TL"
    ].includes(currentUser.role);

let resourcesCache = [];
let tasksCache = [];
let timesheetsCache = [];
let selectedTimesheet = null;
let currentTimesheetView = "my";
let timesheetsPager = null;

initializeTimesheetPage();

async function initializeTimesheetPage() {
    configurePageByRole();
    bindForms();
    initializeTimesheetPagination();

    try {
        await loadReferenceData();
        await loadTimesheets();
    } catch (error) {
        PMS.showError(error);
    }
}

function initializeTimesheetPagination() {
    const list = document.getElementById("timesheetsList");
    const card = list.closest(".timesheet-list-card");

    timesheetsPager = PMS.createPagination({
        key: "timesheets",
        container: card,
        target: list,
        defaultSize: 12,
        sizeOptions: [12, 20, 48],
        searchPlaceholder: "Search employee or reporting manager",
        filters: [
            {
                key: "status",
                label: "Timesheet status",
                options: [
                    { value: "", label: "All statuses" },
                    { value: "DRAFT", label: "Draft" },
                    { value: "PENDING_APPROVAL", label: "Pending approval" },
                    { value: "APPROVED", label: "Approved" },
                    { value: "REJECTED", label: "Rejected" },
                    { value: "RECALLED", label: "Recalled" }
                ]
            }
        ],
        onChange: loadTimesheets
    });
}

function configurePageByRole() {
    if (!isAdmin) {
        document
            .querySelectorAll(".admin-only-field")
            .forEach(element => {
                element.classList.add("hidden");
            });
    }

    if (!isApprover) {
        document
            .querySelectorAll(".approver-only")
            .forEach(element => {
                element.classList.add("hidden");
            });
    }
}

function bindForms() {
    const timesheetForm =
        document.getElementById("timesheetForm");

    if (timesheetForm) {
        timesheetForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();
                await createTimesheet();
            }
        );
    }

    const timeLogForm =
        document.getElementById("timeLogForm");

    if (timeLogForm) {
        timeLogForm.addEventListener(
            "submit",
            async event => {
                event.preventDefault();
                await saveTimeLog();
            }
        );
    }
}

async function loadReferenceData() {
    const resourcePromise =
        isAdmin
            ? PMS.apiGet("/api/resources")
            : Promise.resolve([]);

    resourcesCache =
        await resourcePromise
        || [];

    tasksCache = [];

    if (isAdmin) {
        populateResourceDropdown();
    }
}

async function loadTasksForResource(resourceId) {
    if (!resourceId) {
        tasksCache = [];
        return;
    }

    tasksCache =
        await PMS.apiGet(
            `/api/tasks/resource/${resourceId}`
        )
        || [];
}

function populateResourceDropdown() {
    const select =
        document.getElementById(
            "timesheetResourceId"
        );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Select Person
        </option>
    `;

    resourcesCache.forEach(resource => {
        const location =
            resource.location
                ? ` - ${resource.location}`
                : "";

        const designation =
            resource.designation
                ? ` (${resource.designation})`
                : "";

        const manager =
            resource.reportingManagerName
                ? ` | Reports to: ${resource.reportingManagerName}`
                : " | Reports to: Not assigned";

        select.innerHTML += `
            <option value="${resource.id}">
                ${escapeHtml(
                    resource.resourceName || "-"
                )}${escapeHtml(
                    designation
                )}${escapeHtml(
                    location
                )}${escapeHtml(
                    manager
                )}
            </option>
        `;
    });
}

async function setTimesheetView(view) {
    currentTimesheetView = view;
    selectedTimesheet = null;

    resetSelectedTimesheetBox();
    resetTimeLogForm();
    timesheetsPager.reset();
    timesheetsPager.setSize(view === "my" ? 12 : 20);

    await loadTimesheets();
}

async function loadTimesheets() {
    try {
        const query = timesheetsPager.buildParams({
            view: currentTimesheetView,
            sort: "periodStart",
            direction: "desc"
        });

        const response = await PMS.apiGet(`/api/timesheets/paged?${query}`);
        timesheetsCache = response.content || [];

        renderTimesheets(timesheetsCache);
        timesheetsPager.update(response);
        updateTimesheetListTitle();
        updateViewButtons();
    } catch (error) {
        PMS.showError(error);
    }
}

function updateTimesheetListTitle() {
    const title =
        document.getElementById(
            "timesheetListTitle"
        );

    const subtitle =
        document.getElementById(
            "timesheetListSubtitle"
        );

    if (!title) {
        return;
    }

    if (
        currentTimesheetView
        === "pending"
    ) {
        title.innerText =
            "Pending My Approval";

        if (subtitle) {
            subtitle.innerText =
                "Approve or reject submitted timesheets directly from the cards.";
        }

        return;
    }

    if (
        currentTimesheetView
        === "all"
    ) {
        title.innerText =
            "All Visible Timesheets";

        if (subtitle) {
            subtitle.innerText =
                "Review timesheets visible to your role.";
        }

        return;
    }

    title.innerText =
        "My Timesheets";

    if (subtitle) {
        subtitle.innerText =
            "Select a timesheet to view summary, actions, or work logs.";
    }
}

function updateViewButtons() {
    const mapping = {
        my:
            "timesheetViewMyBtn",

        pending:
            "timesheetViewPendingBtn",

        all:
            "timesheetViewAllBtn"
    };

    Object.entries(mapping)
        .forEach(
            ([view, elementId]) => {
                const button =
                    document.getElementById(
                        elementId
                    );

                if (!button) {
                    return;
                }

                button.classList.toggle(
                    "active",
                    currentTimesheetView
                        === view
                );
            }
        );
}

function renderTimesheets(timesheets) {
    const list =
        document.getElementById(
            "timesheetsList"
        );

    if (!list) {
        return;
    }

    if (
        !timesheets
        || timesheets.length === 0
    ) {
        list.innerHTML = `
            <div class="empty-state">
                No timesheets found.
            </div>
        `;

        return;
    }

    list.innerHTML =
        timesheets
            .map(
                timesheet =>
                    renderTimesheetCard(
                        timesheet
                    )
            )
            .join("");
}

function renderTimesheetCard(timesheet) {
    const selectedClass =
        selectedTimesheet
        && selectedTimesheet.id
            === timesheet.id
            ? "selected"
            : "";

    const period =
        `${PMS.formatDate(
            timesheet.periodStart
        )} to ${PMS.formatDate(
            timesheet.periodEnd
        )}`;

    const logCount =
        Array.isArray(
            timesheet.timeLogs
        )
            ? timesheet.timeLogs.length
            : timesheet.timeLogCount;

    return `
        <article
            class="
                timesheet-list-item
                ${selectedClass}
            "
        >
            <div class="timesheet-list-item-main">

                <div class="timesheet-list-topline">

                    <div>
                        <div class="timesheet-period">
                            ${escapeHtml(period)}
                        </div>
                    </div>

                    <div>
                        <div class="timesheet-person">
                            ${escapeHtml(
                                timesheet.resourceName
                                || "-"
                            )}
                        </div>

                        <div class="muted-small">
                            Reports to:
                            ${escapeHtml(
                                timesheet
                                    .reportingManagerName
                                || "Not assigned"
                            )}
                        </div>
                    </div>

                    <div class="timesheet-status-wrap">
                        ${PMS.badge(
                            timesheet.status
                        )}
                    </div>

                </div>

                <div class="timesheet-card-metrics">

                    <div>
                        <span>Total</span>

                        <strong>
                            ${formatHours(
                                timesheet.totalHours
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Billable</span>

                        <strong>
                            ${formatHours(
                                timesheet.billableHours
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Non Billable</span>

                        <strong>
                            ${formatHours(
                                timesheet
                                    .nonBillableHours
                            )}
                        </strong>
                    </div>

                    <div>
                        <span>Logs</span>

                        <strong>
                            ${
                                logCount === undefined
                                || logCount === null
                                    ? "-"
                                    : logCount
                            }
                        </strong>
                    </div>

                </div>
            </div>

            <div class="timesheet-list-actions">

                <button
                    class="
                        btn
                        btn-primary
                        btn-small
                    "
                    type="button"
                    onclick="
                        selectTimesheet(
                            ${timesheet.id}
                        )
                    "
                >
                    Open
                </button>

                <button
                    class="
                        btn
                        btn-secondary
                        btn-small
                    "
                    type="button"
                    onclick="
                        openTimesheetWorkLogs(
                            ${timesheet.id}
                        )
                    "
                >
                    Work Logs
                </button>

                ${renderTimesheetInlineActions(
                    timesheet
                )}

            </div>
        </article>
    `;
}

function renderTimesheetInlineActions(
    timesheet
) {
    const status =
        timesheet.status;

    const buttons = [];

    if (
        [
            "DRAFT",
            "REJECTED",
            "RECALLED"
        ].includes(status)
    ) {
        buttons.push(`
            <button
                class="
                    btn
                    btn-secondary
                    btn-small
                "
                type="button"
                onclick="
                    submitTimesheet(
                        ${timesheet.id}
                    )
                "
            >
                Submit
            </button>
        `);
    }

    if (
        status === "PENDING_APPROVAL"
        && isApprover
        && currentTimesheetView
            === "pending"
    ) {
        buttons.push(`
            <button
                class="
                    btn
                    btn-primary
                    btn-small
                "
                type="button"
                onclick="
                    approveTimesheet(
                        ${timesheet.id}
                    )
                "
            >
                Approve
            </button>

            <button
                class="
                    btn
                    btn-danger
                    btn-small
                "
                type="button"
                onclick="
                    rejectTimesheet(
                        ${timesheet.id}
                    )
                "
            >
                Reject
            </button>
        `);
    }

    return buttons.join("");
}

async function createTimesheet() {
    const resourceSelect =
        document.getElementById(
            "timesheetResourceId"
        );

    const resourceIdValue =
        resourceSelect
            ? resourceSelect.value
            : "";

    const payload = {
        resourceId:
            isAdmin
                ? (
                    resourceIdValue
                        ? Number(
                            resourceIdValue
                        )
                        : null
                )
                : null,

        periodStart:
            document.getElementById(
                "periodStart"
            ).value,

        periodEnd:
            document.getElementById(
                "periodEnd"
            ).value
    };

    try {
        const timesheet =
            await PMS.apiPost(
                "/api/timesheets",
                payload
            );

        document
            .getElementById(
                "timesheetForm"
            )
            .reset();

        currentTimesheetView = "my";
        timesheetsPager.reset();
        timesheetsPager.setSize(12);

        await loadTimesheets();

        await selectTimesheet(
            timesheet.id
        );

        PMS_UI?.toast?.(
            "Timesheet created successfully.",
            "success"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function selectTimesheet(id) {
    try {
        selectedTimesheet =
            await PMS.apiGet(
                `/api/timesheets/${id}`
            );

        await loadTasksForResource(
            selectedTimesheet.resourceId
        );


        renderSelectedTimesheet(
            selectedTimesheet
        );

        populateTimeLogTaskDropdown(
            selectedTimesheet
        );

        renderTimesheets(
            timesheetsCache
        );
    } catch (error) {
        PMS.showError(error);
    }
}

function renderSelectedTimesheet(
    timesheet
) {
    const box =
        document.getElementById(
            "selectedTimesheetBox"
        );

    if (!box) {
        return;
    }

    const logs =
        timesheet.timeLogs
        || [];

    const canEdit =
        isTimesheetEditable(
            timesheet
        );

    box.innerHTML = `
        <div class="timesheet-detail-header">

            <div>
                <h3 class="timesheet-card-title">
                    Selected Timesheet
                </h3>

                <div class="muted-small">
                    ${escapeHtml(
                        timesheet.resourceName
                        || "-"
                    )}

                    |

                    Reports to:
                    ${escapeHtml(
                        timesheet
                            .reportingManagerName
                        || "Not assigned"
                    )}

                    |

                    ${PMS.formatDate(
                        timesheet.periodStart
                    )}

                    to

                    ${PMS.formatDate(
                        timesheet.periodEnd
                    )}
                </div>
            </div>

            <div>
                ${PMS.badge(
                    timesheet.status
                )}
            </div>

        </div>

        <div class="timesheet-metrics">

            <div class="report-metric">
                <span>Total</span>

                <strong>
                    ${formatHours(
                        timesheet.totalHours
                    )}
                </strong>
            </div>

            <div class="report-metric">
                <span>Billable</span>

                <strong>
                    ${formatHours(
                        timesheet.billableHours
                    )}
                </strong>
            </div>

            <div class="report-metric">
                <span>Non Billable</span>

                <strong>
                    ${formatHours(
                        timesheet
                            .nonBillableHours
                    )}
                </strong>
            </div>

            <div class="report-metric">
                <span>Work Logs</span>

                <strong>
                    ${logs.length}
                </strong>
            </div>

        </div>

        <div class="selected-timesheet-actions">

            <button
                class="
                    btn
                    btn-primary
                    btn-small
                "
                type="button"
                onclick="openWorkLogDialog()"
            >
                View Work Logs
            </button>

            ${renderTimesheetActionButtons(
                timesheet
            )}

        </div>

        ${
            timesheet.rejectionReason
                ? `
                    <div class="timesheet-warning-box">
                        <strong>
                            Rejection Reason:
                        </strong>

                        ${escapeHtml(
                            timesheet
                                .rejectionReason
                        )}
                    </div>
                `
                : ""
        }

        <div class="timesheet-help-box">
            Work log details open in a dialog,
            so you do not need to scroll through
            a large table inside this page.
        </div>
    `;

    const logFormSection =
        document.getElementById(
            "timeLogFormSection"
        );

    if (logFormSection) {
        if (canEdit) {
            logFormSection.classList
                .remove("hidden");
        } else {
            logFormSection.classList
                .add("hidden");
        }
    }
}

function renderTimesheetActionButtons(
    timesheet
) {
    const status =
        timesheet.status;

    const buttons = [];

    if (
        [
            "DRAFT",
            "REJECTED",
            "RECALLED"
        ].includes(status)
    ) {
        buttons.push(`
            <button
                class="
                    btn
                    btn-secondary
                    btn-small
                "
                type="button"
                onclick="
                    submitTimesheet(
                        ${timesheet.id}
                    )
                "
            >
                Submit for Approval
            </button>
        `);
    }

    if (
        status
        === "PENDING_APPROVAL"
    ) {
        buttons.push(`
            <button
                class="
                    btn
                    btn-secondary
                    btn-small
                "
                type="button"
                onclick="
                    recallTimesheet(
                        ${timesheet.id}
                    )
                "
            >
                Recall
            </button>
        `);

        if (
            isApprover
            && currentTimesheetView
                === "pending"
        ) {
            buttons.push(`
                <button
                    class="
                        btn
                        btn-primary
                        btn-small
                    "
                    type="button"
                    onclick="
                        approveTimesheet(
                            ${timesheet.id}
                        )
                    "
                >
                    Approve
                </button>

                <button
                    class="
                        btn
                        btn-danger
                        btn-small
                    "
                    type="button"
                    onclick="
                        rejectTimesheet(
                            ${timesheet.id}
                        )
                    "
                >
                    Reject
                </button>
            `);
        }
    }

    if (
        buttons.length === 0
    ) {
        return "";
    }

    return `
        <div
            class="
                timesheet-action-bar
                compact-action-bar
            "
        >
            ${buttons.join("")}
        </div>
    `;
}

async function openTimesheetWorkLogs(id) {
    await selectTimesheet(id);
    openWorkLogDialog();
}

function openWorkLogDialog() {
    if (!selectedTimesheet) {
        showNotification(
            "Please select a timesheet first.",
            "warning"
        );

        return;
    }

    const modal =
        document.getElementById(
            "workLogModal"
        );

    const title =
        document.getElementById(
            "workLogModalTitle"
        );

    const subtitle =
        document.getElementById(
            "workLogModalSubtitle"
        );

    const body =
        document.getElementById(
            "workLogModalBody"
        );

    if (
        !modal
        || !title
        || !subtitle
        || !body
    ) {
        return;
    }

    const logs =
        selectedTimesheet.timeLogs
        || [];

    title.innerText =
        "Work Log Details";

    subtitle.innerText =
        `${
            selectedTimesheet
                .resourceName
            || "-"
        } | Reports to: ${
            selectedTimesheet
                .reportingManagerName
            || "Not assigned"
        } | ${PMS.formatDate(
            selectedTimesheet.periodStart
        )} to ${PMS.formatDate(
            selectedTimesheet.periodEnd
        )} | ${logs.length} log(s)`;

    body.innerHTML =
        renderWorkLogDialogContent(
            selectedTimesheet
        );

    modal.classList.remove(
        "hidden"
    );

    document.body.classList.add(
        "modal-open"
    );
}

function closeWorkLogDialog() {
    const modal =
        document.getElementById(
            "workLogModal"
        );

    if (modal) {
        modal.classList.add(
            "hidden"
        );
    }

    document.body.classList.remove(
        "modal-open"
    );
}

function handleWorkLogModalBackdrop(
    event
) {
    if (
        event.target
        && event.target.id
            === "workLogModal"
    ) {
        closeWorkLogDialog();
    }
}

function renderWorkLogDialogContent(
    timesheet
) {
    const logs =
        timesheet.timeLogs
        || [];

    const canEdit =
        isTimesheetEditable(
            timesheet
        );

    if (
        logs.length === 0
    ) {
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

                <strong>
                    ${formatHours(
                        timesheet.totalHours
                    )}
                </strong>
            </div>

            <div>
                <span>Billable</span>

                <strong>
                    ${formatHours(
                        timesheet.billableHours
                    )}
                </strong>
            </div>

            <div>
                <span>Non Billable</span>

                <strong>
                    ${formatHours(
                        timesheet
                            .nonBillableHours
                    )}
                </strong>
            </div>

            <div>
                <span>Status</span>

                <strong>
                    ${escapeHtml(
                        formatStatusText(
                            timesheet.status
                        )
                    )}
                </strong>
            </div>

        </div>

        <div class="worklog-card-list">
            ${
                logs
                    .map(
                        log =>
                            renderWorkLogCard(
                                log,
                                canEdit
                            )
                    )
                    .join("")
            }
        </div>
    `;
}

function renderWorkLogCard(
    log,
    canEdit
) {
    const projectCode =
        getTimeLogProjectCode(log);

    const projectName =
        getTimeLogProjectName(log);

    const milestoneName =
        getTimeLogMilestoneName(log);

    const taskCode =
        getTimeLogTaskCode(log);

    const taskName =
        getTimeLogTaskName(log);

    return `
        <article class="worklog-card">

            <div class="worklog-card-header">

                <div>
                    <div class="worklog-project-line">

                        ${
                            projectCode
                                ? `
                                    <span>
                                        ${escapeHtml(
                                            projectCode
                                        )}
                                    </span>
                                `
                                : ""
                        }

                        <strong>
                            ${escapeHtml(
                                projectName
                            )}
                        </strong>

                    </div>

                    <div class="worklog-milestone-line">
                        ${escapeHtml(
                            milestoneName
                        )}
                    </div>
                </div>

                <div class="worklog-status">
                    ${PMS.badge(log.status)}
                </div>

            </div>

            <div class="worklog-task-line">

                ${
                    taskCode
                        ? `
                            <span>
                                ${escapeHtml(
                                    taskCode
                                )}
                            </span>
                        `
                        : ""
                }

                <strong>
                    ${escapeHtml(
                        taskName
                    )}
                </strong>

                ${
                    log.overrun
                        ? `
                            <em>
                                Overrun
                            </em>
                        `
                        : ""
                }

            </div>

            <div class="worklog-meta-grid">

                <div>
                    <span>Date</span>

                    <strong>
                        ${PMS.formatDate(
                            log.logDate
                        )}
                    </strong>
                </div>

                <div>
                    <span>Hours</span>

                    <strong>
                        ${formatHours(
                            log.hours
                        )}
                    </strong>
                </div>

                <div>
                    <span>Billing</span>

                    <strong>
                        ${escapeHtml(
                            formatBillingType(
                                log.billingType
                            )
                        )}
                    </strong>
                </div>

            </div>

            <div class="worklog-description">

                <span>Description</span>

                <p>
                    ${escapeHtml(
                        log.workDescription
                        || "-"
                    )}
                </p>

            </div>

            <div class="worklog-card-actions">

                ${
                    canEdit
                        ? `
                            <button
                                class="
                                    btn
                                    btn-secondary
                                    btn-small
                                "
                                type="button"
                                onclick="
                                    editTimeLog(
                                        ${log.id}
                                    )
                                "
                            >
                                Edit
                            </button>

                            <button
                                class="
                                    btn
                                    btn-danger
                                    btn-small
                                "
                                type="button"
                                onclick="
                                    deleteTimeLog(
                                        ${log.id}
                                    )
                                "
                            >
                                Delete
                            </button>
                        `
                        : `
                            <span class="muted-small">
                                No actions available
                            </span>
                        `
                }

            </div>
        </article>
    `;
}

function getTimeLogProjectName(log) {
    if (log.projectName) {
        return log.projectName;
    }

    if (
        log.project
        && log.project.projectName
    ) {
        return log.project.projectName;
    }

    if (
        log.task
        && log.task.project
        && log.task.project.projectName
    ) {
        return log.task
            .project
            .projectName;
    }

    return "-";
}

function getTimeLogProjectCode(log) {
    if (log.projectCode) {
        return log.projectCode;
    }

    if (
        log.project
        && log.project.projectCode
    ) {
        return log.project.projectCode;
    }

    if (
        log.task
        && log.task.project
        && log.task.project.projectCode
    ) {
        return log.task
            .project
            .projectCode;
    }

    return "";
}

function getTimeLogMilestoneName(log) {
    if (log.milestoneName) {
        return log.milestoneName;
    }

    if (
        log.milestone
        && log.milestone
            .milestoneName
    ) {
        return log.milestone
            .milestoneName;
    }

    if (
        log.task
        && log.task.milestone
        && log.task
            .milestone
            .milestoneName
    ) {
        return log.task
            .milestone
            .milestoneName;
    }

    return "-";
}

function getTimeLogTaskName(log) {
    if (log.taskName) {
        return log.taskName;
    }

    if (
        log.task
        && log.task.taskName
    ) {
        return log.task.taskName;
    }

    return "-";
}

function getTimeLogTaskCode(log) {
    if (log.taskCode) {
        return log.taskCode;
    }

    if (
        log.task
        && log.task.taskCode
    ) {
        return log.task.taskCode;
    }

    return "";
}

function populateTimeLogTaskDropdown(
    timesheet
) {
    const select =
        document.getElementById(
            "timeLogTaskId"
        );

    if (!select) {
        return;
    }

    const resourceTasks =
        tasksCache.filter(
            task =>
                task.assignedResource
                && task.assignedResource.id
                    === timesheet.resourceId
        );

    select.innerHTML = `
        <option value="">
            Select Task
        </option>
    `;

    if (
        resourceTasks.length === 0
    ) {
        select.innerHTML = `
            <option value="">
                No assigned tasks found for this person
            </option>
        `;

        return;
    }

    resourceTasks.forEach(task => {
        const projectName =
            task.project
                ? task.project.projectName
                : "Project";

        const projectCode =
            task.project
            && task.project.projectCode
                ? `${task.project.projectCode} - `
                : "";

        const milestoneName =
            task.milestone
                ? task.milestone
                    .milestoneName
                : "Milestone";

        const taskCode =
            task.taskCode
                ? `${task.taskCode} - `
                : "";

        select.innerHTML += `
            <option value="${task.id}">
                ${escapeHtml(
                    projectCode
                    + projectName
                )}
                |
                ${escapeHtml(
                    milestoneName
                )}
                |
                ${escapeHtml(
                    taskCode
                    + (
                        task.taskName
                        || "-"
                    )
                )}
            </option>
        `;
    });
}

async function saveTimeLog() {
    if (!selectedTimesheet) {
        showNotification(
            "Please select a timesheet first.",
            "warning"
        );

        return;
    }

    const id =
        document.getElementById(
            "timeLogId"
        ).value;

    const payload = {
        timesheetId:
            selectedTimesheet.id,

        taskId:
            Number(
                document.getElementById(
                    "timeLogTaskId"
                ).value
            ),

        resourceId:
            selectedTimesheet.resourceId,

        logDate:
            document.getElementById(
                "logDate"
            ).value,

        hours:
            Number(
                document.getElementById(
                    "logHours"
                ).value
            ),

        billingType:
            document.getElementById(
                "billingType"
            ).value,

        workDescription:
            document.getElementById(
                "workDescription"
            ).value.trim()
    };

    try {
        if (id) {
            await PMS.apiPut(
                `/api/time-logs/${id}`,
                payload
            );
        } else {
            await PMS.apiPost(
                "/api/time-logs",
                payload
            );
        }

        resetTimeLogForm();

        await refreshSelectedTimesheet();
        await loadTimesheets();

        showNotification(
            id
                ? "Work log updated successfully."
                : "Work log added successfully.",
            "success"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

function editTimeLog(id) {
    if (!selectedTimesheet) {
        return;
    }

    const log =
        (
            selectedTimesheet.timeLogs
            || []
        ).find(
            item =>
                item.id === id
        );

    if (!log) {
        showNotification(
            "Time log could not be found.",
            "error"
        );

        return;
    }

    closeWorkLogDialog();

    document.getElementById(
        "timeLogId"
    ).value = log.id;

    document.getElementById(
        "timeLogTaskId"
    ).value =
        log.taskId
        || "";

    document.getElementById(
        "logDate"
    ).value =
        log.logDate
        || "";

    document.getElementById(
        "logHours"
    ).value =
        log.hours
        || "";

    document.getElementById(
        "billingType"
    ).value =
        log.billingType
        || "BILLABLE";

    document.getElementById(
        "workDescription"
    ).value =
        log.workDescription
        || "";

    document.getElementById(
        "saveTimeLogBtn"
    ).innerText =
        "Update Time Log";

    const formSection =
        document.getElementById(
            "timeLogFormSection"
        );

    if (formSection) {
        formSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}

async function deleteTimeLog(id) {
    const confirmed =
        window.PMS_UI?.confirm
            ? await PMS_UI.confirm(
                "Delete work log?",
                "This work log will be permanently removed from the timesheet."
            )
            : window.confirm(
                "Delete this time log?"
            );

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiDelete(
            `/api/time-logs/${id}`
        );

        await refreshSelectedTimesheet();
        await loadTimesheets();

        const modal =
            document.getElementById(
                "workLogModal"
            );

        if (
            modal
            && !modal.classList
                .contains("hidden")
        ) {
            openWorkLogDialog();
        }

        showNotification(
            "Work log deleted successfully.",
            "success"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function submitTimesheet(id) {
    const confirmed =
        window.PMS_UI?.confirm
            ? await PMS_UI.confirm(
                "Submit timesheet?",
                "After submission, the timesheet will be sent to the reporting manager for approval."
            )
            : window.confirm(
                "Submit this timesheet for approval?"
            );

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiPost(
            `/api/timesheets/${id}/submit`,
            {}
        );

        await refreshSelectedTimesheetIfSame(
            id
        );

        await loadTimesheets();

        showNotification(
            "Timesheet submitted for approval.",
            "success"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function recallTimesheet(id) {
    const confirmed =
        window.PMS_UI?.confirm
            ? await PMS_UI.confirm(
                "Recall timesheet?",
                "The pending timesheet will return to an editable state."
            )
            : window.confirm(
                "Recall this timesheet?"
            );

    if (!confirmed) {
        return;
    }

    try {
        await PMS.apiPost(
            `/api/timesheets/${id}/recall`,
            {}
        );

        await refreshSelectedTimesheetIfSame(
            id
        );

        await loadTimesheets();

        showNotification(
            "Timesheet recalled successfully.",
            "success"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function approveTimesheet(id) {
    const comments =
        window.PMS_UI?.prompt
            ? await PMS_UI.prompt({
                title:
                    "Approve timesheet",

                message:
                    "Add an optional approval comment.",

                value:
                    "Approved",

                placeholder:
                    "Approval comment",

                required:
                    false
            })
            : window.prompt(
                "Approval comments:",
                "Approved"
            );

    if (comments === null) {
        return;
    }

    try {
        await PMS.apiPost(
            `/api/timesheets/${id}/approve`,
            {
                comments:
                    comments.trim()
            }
        );

        await refreshSelectedTimesheetIfSame(
            id
        );

        await loadTimesheets();

        showNotification(
            "Timesheet approved successfully.",
            "success"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function rejectTimesheet(id) {
    const rejectionReason =
        window.PMS_UI?.prompt
            ? await PMS_UI.prompt({
                title:
                    "Reject timesheet",

                message:
                    "Provide a clear reason so the employee can correct the timesheet.",

                placeholder:
                    "Enter rejection reason",

                required:
                    true
            })
            : window.prompt(
                "Enter rejection reason:"
            );

    if (
        rejectionReason === null
    ) {
        return;
    }

    const trimmedReason =
        rejectionReason.trim();

    if (!trimmedReason) {
        showNotification(
            "A rejection reason is required.",
            "warning"
        );

        return;
    }

    try {
        await PMS.apiPost(
            `/api/timesheets/${id}/reject`,
            {
                rejectionReason:
                    trimmedReason
            }
        );

        await refreshSelectedTimesheetIfSame(
            id
        );

        await loadTimesheets();

        showNotification(
            "Timesheet rejected and returned for correction.",
            "warning"
        );
    } catch (error) {
        PMS.showError(error);
    }
}

async function refreshSelectedTimesheetIfSame(
    id
) {
    if (
        !selectedTimesheet
        || selectedTimesheet.id
            !== id
    ) {
        return;
    }

    await refreshSelectedTimesheet();
}

async function refreshSelectedTimesheet() {
    if (!selectedTimesheet) {
        return;
    }

    selectedTimesheet =
        await PMS.apiGet(
            `/api/timesheets/${selectedTimesheet.id}`
        );

    await loadTasksForResource(
        selectedTimesheet.resourceId
    );


    renderSelectedTimesheet(
        selectedTimesheet
    );

    populateTimeLogTaskDropdown(
        selectedTimesheet
    );
}

function resetTimeLogForm() {
    const form =
        document.getElementById(
            "timeLogForm"
        );

    if (form) {
        form.reset();
    }

    const idElement =
        document.getElementById(
            "timeLogId"
        );

    if (idElement) {
        idElement.value = "";
    }

    const billingType =
        document.getElementById(
            "billingType"
        );

    if (billingType) {
        billingType.value =
            "BILLABLE";
    }

    const saveButton =
        document.getElementById(
            "saveTimeLogBtn"
        );

    if (saveButton) {
        saveButton.innerText =
            "Save Time Log";
    }
}

function resetSelectedTimesheetBox() {
    const box =
        document.getElementById(
            "selectedTimesheetBox"
        );

    if (box) {
        box.innerHTML = `
            <div class="empty-state">
                Select a timesheet to view
                summary and actions.
            </div>
        `;
    }

    const formSection =
        document.getElementById(
            "timeLogFormSection"
        );

    if (formSection) {
        formSection.classList.add(
            "hidden"
        );
    }
}

function isTimesheetEditable(timesheet) {
    return (
        timesheet
        && [
            "DRAFT",
            "REJECTED",
            "RECALLED"
        ].includes(
            timesheet.status
        )
    );
}

function formatHours(value) {
    const hours =
        Number(value || 0);

    return `${hours.toFixed(2)} hrs`;
}

function formatBillingType(value) {
    if (!value) {
        return "-";
    }

    return value.replaceAll(
        "_",
        " "
    );
}

function formatStatusText(value) {
    if (!value) {
        return "-";
    }

    return value.replaceAll(
        "_",
        " "
    );
}

function showNotification(
    message,
    type = "info"
) {
    if (
        window.PMS_UI
        && typeof PMS_UI.toast
            === "function"
    ) {
        PMS_UI.toast(
            message,
            type
        );

        return;
    }

    if (
        type === "error"
    ) {
        console.error(message);
    }

    window.alert(message);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

window.setTimesheetView =
    setTimesheetView;

window.loadTimesheets =
    loadTimesheets;

window.selectTimesheet =
    selectTimesheet;

window.openTimesheetWorkLogs =
    openTimesheetWorkLogs;

window.openWorkLogDialog =
    openWorkLogDialog;

window.closeWorkLogDialog =
    closeWorkLogDialog;

window.handleWorkLogModalBackdrop =
    handleWorkLogModalBackdrop;

window.submitTimesheet =
    submitTimesheet;

window.recallTimesheet =
    recallTimesheet;

window.approveTimesheet =
    approveTimesheet;

window.rejectTimesheet =
    rejectTimesheet;

window.editTimeLog =
    editTimeLog;

window.deleteTimeLog =
    deleteTimeLog;

window.resetTimeLogForm =
    resetTimeLogForm;