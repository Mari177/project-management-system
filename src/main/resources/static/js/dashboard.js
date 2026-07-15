PMS.protectPage(["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER", "CLIENT_VIEWER"]);
PMS.initLayout("dashboard");

let selectedProjectId = null;
let reportDialogInitialized = false;

loadDashboard();

async function loadDashboard() {
    try {
        const data = await PMS.apiGet("/api/dashboard");

        setText("totalClients", data.totalClients || 0);
        setText("totalProjects", data.totalProjects || 0);
        setText("activeProjects", data.activeProjects || 0);
        setText("completedProjects", data.completedProjects || 0);
        setText("delayedProjects", data.delayedProjects || 0);
        setText("totalResources", data.totalResources || 0);
        setText("totalTasks", data.totalTasks || 0);
        setText("completedTasks", data.completedTasks || 0);
        setText("delayedTasks", data.delayedTasks || 0);
        setText("escalatedTasks", data.escalatedTasks || 0);
        setText("openEscalations", data.openEscalations || 0);
        setText("criticalEscalations", data.criticalEscalations || 0);

        const canViewCost = canCurrentUserViewCost();
        setHtml("totalCost", renderMoneyOrRestricted(data.totalCost, canViewCost));

        renderEscalatedTasks(data.escalatedTaskDetails || []);
        renderProjectSummary(data.projectSummaries || []);
        initializeProjectReportDialog();
    } catch (error) {
        PMS.showError(error);
    }
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.innerText = value;
    }
}

function setHtml(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.innerHTML = value;
    }
}

function renderProjectSummary(projects) {
    const table = document.getElementById("projectSummaryTable");
    const user = PMS.getUser();

    const canViewReport =
        user &&
        ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER"].includes(user.role);

    if (!table) {
        return;
    }

    if (!projects || projects.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    No project data available. Create client, project and task first.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = projects.map(project => {
        const projectId = project.projectId;
        const milestoneProgress =
            project.milestoneProgressPercentage ??
            project.overallMilestoneProgress ??
            null;

        return `
            <tr id="project-row-${projectId}" class="project-report-row">
                <td>
                    ${project.projectCode ? `<div class="muted-small strong-code">${escapeHtml(project.projectCode)}</div>` : ""}
                    <strong>${escapeHtml(project.projectName || "-")}</strong>
                </td>

                <td>${escapeHtml(project.clientName || "-")}</td>

                <td>${escapeHtml(project.clientContactPerson || "-")}</td>

                <td>${escapeHtml(project.deliveryManagerName || "-")}</td>

                <td>${PMS.badge(project.status)}</td>

                <td>${renderMoneyOrRestricted(project.projectCost, project.canViewCost)}</td>

                <td>${PMS.badge(project.milestoneStatus)}</td>

                <td>
                    ${milestoneProgress === null ? "-" : renderMiniProgress(milestoneProgress)}
                </td>

                <td>
                    ${canViewReport
                ? `
                                <button class="action-link report-toggle-btn"
                                        id="report-btn-${projectId}"
                                        onclick="openProjectReportDialog(${projectId})">
                                    <i class="bi bi-file-earmark-text"></i>
                                    View Report
                                </button>
                            `
                : "-"
            }
                </td>
            </tr>
        `;
    }).join("");
}

function initializeProjectReportDialog() {
    if (reportDialogInitialized) {
        return;
    }

    const modal = document.getElementById("projectReportModal");

    if (!modal) {
        return;
    }

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeProjectReportDialog();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeProjectReportDialog();
        }
    });

    reportDialogInitialized = true;
}

async function openProjectReportDialog(projectId) {
    selectedProjectId = projectId;

    const modal = document.getElementById("projectReportModal");
    const body = document.getElementById("projectReportDialogBody");
    const title = document.getElementById("projectReportModalTitle");

    if (!modal || !body) {
        return;
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (title) {
        title.innerText = "Milestone-wise Report";
    }

    body.innerHTML = `
        <div class="project-report-container report-dialog-container">
            <div class="project-report-loading">
                <i class="bi bi-arrow-repeat"></i>
                Loading milestone-wise project report...
            </div>
        </div>
    `;

    try {
        const report = await PMS.apiGet(`/api/dashboard/project-report/${projectId}`);

        if (title) {
            title.innerText = report?.projectName || "Milestone-wise Report";
        }

        renderProjectReport(report);
    } catch (error) {
        body.innerHTML = `
            <div class="project-report-container report-dialog-container">
                <div class="project-report-empty">
                    <i class="bi bi-exclamation-triangle"></i>
                    <div>
                        <strong>Unable to load report</strong>
                        <p>Please check permissions and backend logs.</p>
                    </div>
                </div>
            </div>
        `;

        PMS.showError(error);
    }
}

function closeProjectReportDialog() {
    const modal = document.getElementById("projectReportModal");
    const body = document.getElementById("projectReportDialogBody");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");

    if (body) {
        body.innerHTML = "";
    }

    selectedProjectId = null;
}

function renderProjectReport(report) {
    const container = document.getElementById("projectReportDialogBody");

    if (!container) {
        return;
    }

    if (!report) {
        container.innerHTML = `
            <div class="project-report-container report-dialog-container">
                <div class="project-report-empty">
                    <i class="bi bi-folder-x"></i>
                    <div>
                        <strong>No report available</strong>
                        <p>Project report data is not available for this project.</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const milestones = report.milestones || [];

    const milestonesWithTasks = milestones.filter(milestone => {
        const tasks = milestone.tasks || [];
        return tasks.length > 0;
    });

    const hiddenMilestoneCount = milestones.length - milestonesWithTasks.length;

    container.innerHTML = `
        <div class="project-report-container report-dialog-container">
            <div class="project-report-header">
                <div>
                    <div class="project-report-title">
                        ${escapeHtml(`${report.projectCode ? report.projectCode + " - " : ""}${report.projectName || "Project Report"}`)}
                    </div>

                    <div class="project-report-subtitle">
                        Client: ${escapeHtml(report.clientName || "-")}
                        &nbsp;|&nbsp;
                        Contact: ${escapeHtml(report.clientContactPerson || "-")}
                        &nbsp;|&nbsp;
                        Delivery Manager: ${escapeHtml(report.deliveryManagerName || "-")}
                    </div>
                </div>
            </div>

            <div class="project-report-metrics">
                <div class="report-metric">
                    <span>Project Status</span>
                    <strong>${PMS.badge(report.projectStatus)}</strong>
                </div>

                <div class="report-metric">
                    <span>Overall Progress</span>
                    <strong>${formatPercentage(report.overallMilestoneProgress)}</strong>
                </div>

                <div class="report-metric">
                    <span>Total Tasks</span>
                    <strong>${report.totalTasks || 0}</strong>
                </div>

                <div class="report-metric">
                    <span>Completed</span>
                    <strong>${report.completedTasks || 0}</strong>
                </div>

                <div class="report-metric">
                    <span>Delayed</span>
                    <strong>${report.delayedTasks || 0}</strong>
                </div>

                <div class="report-metric">
                    <span>Escalated</span>
                    <strong>${report.escalatedTasks || 0}</strong>
                </div>

                <div class="report-metric">
                    <span>Project Cost</span>
                    <strong>${renderMoneyOrRestricted(report.projectCost, report.canViewCost)}</strong>
                </div>
            </div>

            <div class="project-overall-progress">
                ${renderProgressBar(report.overallMilestoneProgress)}
            </div>

            ${renderHiddenMilestoneNote(hiddenMilestoneCount)}

            ${milestonesWithTasks.length > 0
            ? `
                        <div class="milestone-report-list">
                            ${milestonesWithTasks.map((milestone, index) =>
                renderMilestoneAccordion(milestone, index === 0)
            ).join("")}
                        </div>
                    `
            : `
                        <div class="project-report-empty">
                            <i class="bi bi-list-check"></i>
                            <div>
                                <strong>No milestone tasks available</strong>
                                <p>No tasks have been added to the project milestones yet. Once tasks are created under milestones, the report will show milestone-wise task details here.</p>
                            </div>
                        </div>
                    `
        }
        </div>
    `;
}

function renderHiddenMilestoneNote(hiddenMilestoneCount) {
    if (!hiddenMilestoneCount || hiddenMilestoneCount <= 0) {
        return "";
    }

    return `
        <div class="milestone-report-note">
            <i class="bi bi-info-circle"></i>
            <span>
                ${hiddenMilestoneCount} milestone${hiddenMilestoneCount > 1 ? "s" : ""} without tasks
                ${hiddenMilestoneCount > 1 ? "are" : "is"} hidden from this report.
                Add tasks under those milestones to include them in the detailed view.
            </span>
        </div>
    `;
}

function renderMilestoneAccordion(milestone, isOpen) {
    const tasks = milestone.tasks || [];
    const milestoneId = milestone.milestoneId;
    const milestoneNumber = milestone.milestoneOrder ? `M${milestone.milestoneOrder}` : "M";
    const completedText = `${milestone.completedTasks || 0}/${milestone.totalTasks || 0} tasks completed`;

    return `
        <div class="milestone-accordion-item">
            <button type="button"
                    class="milestone-accordion-header ${isOpen ? "active" : ""}"
                    onclick="toggleMilestoneAccordion(${milestoneId})">
                <div class="milestone-left">
                    <div class="milestone-code">${milestoneNumber}</div>

                    <div class="milestone-title-wrap">
                        <div class="milestone-name">
                            ${escapeHtml(milestone.milestoneName || "-")}
                        </div>

                        <div class="milestone-meta">
                            ${completedText}
                            &nbsp;|&nbsp;
                            ${PMS.formatDate(milestone.startDate)} to ${PMS.formatDate(milestone.endDate)}
                        </div>
                    </div>
                </div>

                <div class="milestone-right">
                    ${PMS.badge(milestone.milestoneStatus)}

                    <div class="milestone-progress-value">
                        ${formatPercentage(milestone.milestoneProgressPercentage)}
                    </div>

                    <i class="bi bi-chevron-down milestone-chevron"></i>
                </div>
            </button>

            <div class="milestone-progress-line">
                ${renderProgressBar(milestone.milestoneProgressPercentage)}
            </div>

            <div id="milestone-body-${milestoneId}"
                 class="milestone-accordion-body ${isOpen ? "open" : ""}">
                ${renderMilestoneTaskTable(tasks)}
            </div>
        </div>
    `;
}

function toggleMilestoneAccordion(milestoneId) {
    const body = document.getElementById(`milestone-body-${milestoneId}`);

    if (!body) {
        return;
    }

    const card = body.closest(".milestone-accordion-item");
    const header = card ? card.querySelector(".milestone-accordion-header") : null;

    body.classList.toggle("open");

    if (header) {
        header.classList.toggle("active");
    }
}

function renderMilestoneTaskTable(tasks) {
    if (!tasks || tasks.length === 0) {
        return `
            <div class="project-report-empty">
                <i class="bi bi-list-check"></i>
                <div>
                    <strong>No tasks available</strong>
                    <p>No tasks have been added for this milestone yet.</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="table-wrapper inner-report-table project-task-report-table">
            <table>
                <thead>
                    <tr>
                        <th>Task Code</th>
                        <th>Task Name</th>
                        <th>Description</th>
                        <th>Resource</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Completion</th>
                        <th>Priority</th>
                        <th>Escalation</th>
                        <th>Timeline</th>
                        <th>Allocated Hrs</th>
                        <th>Approved Hrs</th>
                        <th>Planned Cost</th>
                        <th>Actual Cost</th>
                        <th>Variance</th>
                    </tr>
                </thead>

                <tbody>
                    ${tasks.map(task => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(task.taskCode || "-")}</strong>
                                <div class="muted-small">${escapeHtml(task.taskType || "")}</div>
                            </td>

                            <td>
                                <strong>${escapeHtml(task.taskName || "-")}</strong>
                            </td>

                            <td class="report-description">
                                ${escapeHtml(task.taskDescription || "-")}
                            </td>

                            <td>${escapeHtml(task.resourceName || "-")}</td>

                            <td>${escapeHtml(task.resourceLocation || "-")}</td>

                            <td>${PMS.badge(task.taskStatus)}</td>

                            <td>${renderMiniProgress(task.taskProgressPercentage)}</td>

                            <td>${escapeHtml(task.priority || "-")}</td>

                            <td>${task.escalated ? PMS.badge("ESCALATED") : "-"}</td>

                            <td>
                                ${PMS.formatDate(task.startDate)}
                                <div class="muted-small">to ${PMS.formatDate(task.endDate)}</div>
                            </td>

                            <td>${formatNumber(task.allocatedHours)}</td>
                            <td>${formatNumber(task.approvedHours)}</td>
                            <td>${renderMoneyOrRestricted(task.plannedCost, task.plannedCost !== null && task.plannedCost !== undefined)}</td>
                            <td>${renderMoneyOrRestricted(task.actualCost, task.actualCost !== null && task.actualCost !== undefined)}</td>
                            <td>${renderMoneyOrRestricted(task.costVariance, task.costVariance !== null && task.costVariance !== undefined)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

function renderEscalatedTasks(tasks) {
    const table = document.getElementById("escalatedTasksTable");

    if (!table) {
        return;
    }

    if (!tasks || tasks.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    No escalated tasks found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = tasks.map(task => `
        <tr>
            <td>${escapeHtml(task.taskCode || "-")}</td>
            <td>${escapeHtml(task.taskName || "-")}</td>
            <td>${escapeHtml(task.projectName || "-")}</td>
            <td>${escapeHtml(task.resourceName || "-")}</td>
            <td>${PMS.badge(task.escalationSeverity)}</td>
            <td>${formatReasonType(task.escalationReasonType)}</td>
            <td>${PMS.badge(task.escalationStatus)}</td>
            <td>${PMS.formatDate(task.escalationDate)}</td>
        </tr>

        <tr>
            <td colspan="8" class="muted-text">
                <strong>Reason:</strong> ${escapeHtml(task.escalationReason || "-")}
            </td>
        </tr>
    `).join("");
}

function formatNumber(value) {
    const number = Number(value || 0);
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function renderMiniProgress(value) {
    const progress = normalizeProgress(value);

    return `
        <div class="mini-progress-wrap">
            <div class="mini-progress-text">${progress}%</div>

            <div class="mini-progress-track">
                <div class="mini-progress-fill" style="width: ${progress}%"></div>
            </div>
        </div>
    `;
}

function renderProgressBar(value) {
    const progress = normalizeProgress(value);

    return `
        <div class="report-progress-track">
            <div class="report-progress-fill" style="width: ${progress}%"></div>
        </div>
    `;
}

function renderMoneyOrRestricted(value, canViewCost) {
    if (canViewCost === false || value === null || value === undefined) {
        return `<span class="restricted-text">Restricted</span>`;
    }

    return PMS.formatMoney(value);
}

function canCurrentUserViewCost() {
    const user = PMS.getUser();

    return user && ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER"].includes(user.role);
}

function normalizeProgress(value) {
    const number = Number(value || 0);

    if (number < 0) {
        return 0;
    }

    if (number > 100) {
        return 100;
    }

    return Math.round(number);
}

function formatPercentage(value) {
    return `${normalizeProgress(value)}%`;
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
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}