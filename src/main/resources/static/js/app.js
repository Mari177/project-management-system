(() => {
    if (
        window.location.pathname === "/login"
        || document.body.classList.contains(
            "login-page"
        )
    ) {
        return;
    }

    if (
        !document.querySelector(
            'meta[name="viewport"]'
        )
    ) {
        const viewport =
            document.createElement("meta");

        viewport.name =
            "viewport";

        viewport.content =
            "width=device-width, initial-scale=1.0";

        document.head.appendChild(
            viewport
        );
    }

    if (
        !document.querySelector(
            "link[data-pms-ui-refresh]"
        )
    ) {
        const stylesheet =
            document.createElement("link");

        stylesheet.rel =
            "stylesheet";

        stylesheet.href =
            "/css/ui-refresh.css";

        stylesheet.dataset
            .pmsUiRefresh =
            "true";

        document.head.appendChild(
            stylesheet
        );
    }

    if (
        !document.querySelector(
            "script[data-pms-ui-refresh]"
        )
    ) {
        const script =
            document.createElement("script");

        script.src =
            "/js/ui-refresh.js";

        script.dataset
            .pmsUiRefresh =
            "true";

        document.head.appendChild(
            script
        );
    }
})();


const PMS = (() => {
    const API_BASE = "";

    const menuItems = [
        {
            key: "dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            url: "/dashboard",
            roles: ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER", "CLIENT_VIEWER"]
        },
        {
            key: "clients",
            label: "Clients",
            icon: "bi-building",
            url: "/clients",
            roles: ["ADMIN", "DELIVERY_MANAGER"]
        },
        {
            key: "resources",
            label: "Resources",
            icon: "bi-people",
            url: "/resources",
            roles: ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL"]
        },
        {
            key: "projects",
            label: "Projects",
            icon: "bi-kanban",
            url: "/projects",
            roles: ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "CLIENT_VIEWER"]
        },
        {
            key: "tasks",
            label: "Tasks",
            icon: "bi-list-check",
            url: "/tasks",
            roles: ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER", "CLIENT_VIEWER"]
        },
        {
            key: "timesheets",
            label: "Timesheets",
            icon: "bi-clock-history",
            url: "/timesheets",
            roles: ["ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER"]
        }
    ];
    const INR_PER_USD = 83;
    const WORKING_DAYS_PER_MONTH = 22;
    const HOURS_PER_DAY = 8;

    async function login(username, password) {
        const response = await fetch(API_BASE + "/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({
                username,
                password
            })
        });

        if (!response.ok) {
            return false;
        }

        const user = await response.json();
        localStorage.setItem("pms_user", JSON.stringify(user));

        return true;
    }

    function getUser() {
        const data = localStorage.getItem("pms_user");

        if (!data) {
            return null;
        }

        try {
            return JSON.parse(data);
        } catch (error) {
            localStorage.removeItem("pms_user");
            return null;
        }
    }

    async function logout() {
        try {
            await fetch(API_BASE + "/api/auth/logout", {
                method: "POST",
                credentials: "include"
            });
        } catch (error) {
            console.error(error);
        }

        localStorage.removeItem("pms_user");
        window.location.href = "/login";
    }

    function protectPage(allowedRoles) {
        const user = getUser();

        if (!user) {
            window.location.href = "/login";
            return;
        }

        if (allowedRoles && !allowedRoles.includes(user.role)) {
            alert("You do not have access to this page.");
            window.location.href = "/dashboard";
        }
    }

    function isAdmin() {
        const user = getUser();
        return user && user.role === "ADMIN";
    }

    function isDeliveryHead() {
        const user = getUser();
        return user && user.role === "DELIVERY_HEAD";
    }

    function isDeliveryManager() {
        const user = getUser();
        return user && user.role === "DELIVERY_MANAGER";
    }

    function isTL() {
        const user = getUser();
        return user && user.role === "TL";
    }

    function isEmployee() {
        const user = getUser();
        return user && user.role === "TEAM_MEMBER";
    }

    function isAdminOrDeliveryHead() {
        const user = getUser();
        return user && ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD"].includes(user.role);
    }

    function isMyViewRole() {
        const user = getUser();
        return user && ["DELIVERY_MANAGER", "TL", "TEAM_MEMBER"].includes(user.role);
    }

    function isHead() {
        return isDeliveryHead();
    }

    function isAdminOrHead() {
        return isAdminOrDeliveryHead();
    }

    function getProjectsApi() {
        return isAdmin() || isExecutiveViewer() ? "/api/projects" : "/api/projects/my-projects";
    }

    function getTasksApi() {
        return isAdmin() || isExecutiveViewer() ? "/api/tasks" : "/api/tasks/my-tasks";
    }

    function initLayout(activeMenu) {
        /*
         * Render immediately using the user saved during login.
         */
        renderSidebar(activeMenu);
        renderTopbar(activeMenu);

        /*
         * Fetch the latest logged-in user information from the backend.
         *
         * This is important because the reporting manager may have been
         * changed after the employee logged in.
         */
        refreshCurrentUser(activeMenu);
    }

    async function refreshCurrentUser(activeMenu) {
        try {
            const response = await fetch(
                API_BASE + "/api/auth/me",
                {
                    credentials: "include"
                }
            );

            if (
                response.status === 401
                || response.status === 403
            ) {
                localStorage.removeItem("pms_user");
                window.location.href = "/login";
                return;
            }

            const currentUser =
                await readApiResponse(response);

            localStorage.setItem(
                "pms_user",
                JSON.stringify(currentUser)
            );

            /*
             * Render again with the latest employee and
             * reporting-manager information.
             */
            renderSidebar(activeMenu);
            renderTopbar(activeMenu);
        } catch (error) {
            /*
             * Continue displaying the cached login information
             * when the refresh temporarily fails.
             */
            console.error(
                "Unable to refresh current-user information:",
                error
            );
        }
    }

    function getPageTitle(activeMenu) {
        const user = getUser();

        const adminHeadTitles = {
            dashboard: "Dashboard",
            clients: "Client Management",
            resources: "Resource Management",
            projects: "Project Management",
            tasks: "Task Management",
            timesheets: "My Timesheets"
        };

        const myViewTitles = {
            dashboard: "My Dashboard",
            clients: "Client Management",
            resources: "Resources",
            projects: "My Projects",
            tasks: "My Tasks",
            timesheets: "My Timesheets"

        };

        if (user && ["DELIVERY_MANAGER", "TL", "TEAM_MEMBER"].includes(user.role)) {
            return myViewTitles[activeMenu] || "Project Management System";
        }

        return adminHeadTitles[activeMenu] || "Project Management System";
    }

    function getPageSubtitle(activeMenu) {
        const user = getUser();

        if (user && user.role === "ADMIN") {
            const subtitles = {
                dashboard: "Project milestone, task, resource and cost visibility",
                clients: "Create and manage client details",
                resources: "Create and manage company resources",
                projects: "Create projects and assign Delivery Manager / TL",
                tasks: "Track all functional and technical tasks",
                timesheets: "Review effort logs and approval status",
            };

            return subtitles[activeMenu] || "";
        }

        if (user && user.role === "DELIVERY_HEAD") {
            const subtitles = {
                dashboard: "Company-wide project, milestone, task and cost visibility",
                resources: "View resource information",
                projects: "View all company projects",
                tasks: "View all tasks and progress",
                timesheets: "Monitor approved and pending timesheets",
            };

            return subtitles[activeMenu] || "";
        }

        if (user && user.role === "DELIVERY_MANAGER") {
            const subtitles = {
                dashboard: "Projects, milestones, tasks and cost under your delivery ownership",
                clients: "Create and manage client details",
                resources: "View available resources for task assignment",
                projects: "Projects assigned to you",
                tasks: "Tasks under your projects",
                timesheets: "Review timesheets for your delivery projects",
            };

            return subtitles[activeMenu] || "";
        }

        if (user && user.role === "TL") {
            const subtitles = {
                dashboard: "Projects, milestones and tasks under your execution",
                resources: "View resources available for task assignment",
                projects: "Projects assigned to you as TL",
                tasks: "Tasks under your projects",
                timesheets: "Approve and track team timesheets",
            };

            return subtitles[activeMenu] || "";
        }

        if (user && user.role === "TEAM_MEMBER") {
            const subtitles = {
                dashboard: "Your assigned task summary",
                tasks: "Tasks assigned to you",
                timesheets: "Log and submit your work hours"
            };

            return subtitles[activeMenu] || "";
        }

        return "";
    }

    async function apiGet(url) {
        const response = await fetch(API_BASE + url, {
            credentials: "include"
        });

        return readApiResponse(response);
    }

    async function apiPost(url, data) {
        const response = await fetch(API_BASE + url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(data)
        });

        return readApiResponse(response);
    }

    async function apiPut(url, data) {
        const response = await fetch(API_BASE + url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify(data)
        });

        return readApiResponse(response);
    }

    async function apiDelete(url) {
        const response = await fetch(API_BASE + url, {
            method: "DELETE",
            credentials: "include"
        });

        await readApiResponse(response);
    }

    async function readApiResponse(response) {
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
            let message = `Request failed with status ${response.status}`;

            if (typeof payload === "string" && payload.trim()) {
                message = payload.trim();
            } else if (payload && typeof payload === "object") {
                message = payload.message
                    || payload.detail
                    || payload.error
                    || message;
            }

            const apiError = new Error(message);
            apiError.status = response.status;
            apiError.path = payload && typeof payload === "object" ? payload.path : null;
            throw apiError;
        }

        return payload;
    }

    function formatMoney(value) {
        const amount = Number(value || 0);

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    function formatHourlyUsdFromMonthlyInr(monthlySalaryInr) {
        const monthly = Number(monthlySalaryInr || 0);
        const dailyInr = monthly / WORKING_DAYS_PER_MONTH;
        const hourlyInr = dailyInr / HOURS_PER_DAY;
        const hourlyUsd = hourlyInr / INR_PER_USD;

        return `${formatMoney(hourlyUsd)} / hour`;
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }

        return new Date(value).toLocaleDateString("en-IN");
    }

    function badge(status) {
        if (!status) {
            return `<span class="badge badge-info">N/A</span>`;
        }

        const displayValue = String(status).replaceAll("_", " ");
        const value = String(status).toUpperCase();

        if (value === "COMPLETED") {
            return `<span class="badge badge-success">${displayValue}</span>`;
        }

        if (value === "DELAYED" || value === "BLOCKED" || value === "ESCALATED" || value === "CRITICAL") {
            return `<span class="badge badge-danger">${displayValue}</span>`;
        }

        if (value === "IN_PROGRESS" || value === "ACTIVE" || value === "OPEN") {
            return `<span class="badge badge-info">${displayValue}</span>`;
        }

        return `<span class="badge badge-warning">${displayValue}</span>`;
    }

    function showError(error) {
        console.error(error);
        const message = error && error.message
            ? error.message
            : "Something went wrong. Please try again.";

        alert(message);
    }

    function renderSidebar(activeMenu) {
        const sidebar = document.getElementById("sidebar");

        if (!sidebar) {
            return;
        }

        const user = getUser();

        const visibleMenuItems = menuItems.filter(item =>
            user && item.roles.includes(user.role)
        );

        sidebar.innerHTML = `
            <div class="sidebar-brand">
                <div class="sidebar-logo-box">
                    <img src="/images/nija-logo-01.jpg" alt="NIJA Technologies" class="sidebar-logo">
                </div>

                <div class="sidebar-product">
                    <div class="sidebar-product-title">PMS</div>
                    <div class="sidebar-product-subtitle">Project Management System</div>
                </div>
            </div>

            <nav class="sidebar-menu">
                ${visibleMenuItems.map(item => `
                    <a href="${item.url}" class="sidebar-link ${activeMenu === item.key ? "active" : ""}">
                        <i class="bi ${item.icon} sidebar-icon"></i>
                        <span class="sidebar-label">${item.label}</span>
                    </a>
                `).join("")}
            </nav>
        `;
    }

    function renderTopbar(activeMenu) {
    const topbar =
        document.getElementById("topbar");

    if (!topbar) {
        return;
    }

    const user = getUser();

    const title =
        getPageTitle(activeMenu);

    const subtitle =
        getPageSubtitle(activeMenu);

    const initials =
        getUserInitials(user);

    const userName =
        user && user.name
            ? user.name
            : "User";

    const userDisplayRole =
        user
            ? (
                user.displayRole
                || formatRole(user.role)
            )
            : "";

    const userDesignation =
        user && user.designation
            ? user.designation
            : "";

    const userPosition =
        buildPositionText(
            userDesignation,
            userDisplayRole
        );

    const hasReportingManager = Boolean(
        user
        && user.managerUserId
        && user.managerName
    );

    const managerName =
        hasReportingManager
            ? user.managerName
            : "Not assigned";

    const managerPosition =
        hasReportingManager
            ? buildPositionText(
                user.managerDesignation || "",
                user.managerDisplayRole
                    || formatRole(user.managerRole)
            )
            : "";

    const managerTitle =
        managerPosition
            ? ` · ${managerPosition}`
            : "";

    topbar.innerHTML = `
        <div class="topbar-main">

            <div class="topbar-left">
                <div class="page-title">
                    ${escapeHtml(title)}
                </div>

                <div class="page-subtitle">
                    ${escapeHtml(subtitle)}
                </div>
            </div>

            <div class="topbar-search">
                <i class="bi bi-search search-icon"></i>

                <input
                    type="text"
                    placeholder="Search project, task, client or resource"
                    aria-label="Search project, task, client or resource"
                    oninput="PMS.handleGlobalSearchInput(this.value)"
                >

                <span class="search-shortcut">
                    Alt + K
                </span>
            </div>

            <div class="topbar-right">

                <button
                    class="notification-btn"
                    type="button"
                    title="Notifications"
                    aria-label="Notifications"
                >
                    <i class="bi bi-bell"></i>
                </button>

                <div
                    class="user-chip"
                    title="Logged-in employee and reporting manager"
                >
                    <div class="user-avatar">
                        ${escapeHtml(initials)}
                    </div>

                    <div class="user-meta">

                        <div class="user-name">
                            ${escapeHtml(userName)}
                        </div>

                        <div class="user-role">
                            ${escapeHtml(userPosition)}
                        </div>

                        <div class="user-reporting">
                            <i
                                class="bi bi-diagram-3"
                                aria-hidden="true"
                            ></i>

                            <span class="user-reporting-label">
                                Reports to:
                            </span>

                            <span class="user-manager-name">
                                ${escapeHtml(managerName)}
                            </span>

                            <span class="user-manager-title">
                                ${escapeHtml(managerTitle)}
                            </span>
                        </div>

                    </div>
                </div>

                <button
                    class="logout-link"
                    type="button"
                    onclick="PMS.logout()"
                >
                    <i class="bi bi-box-arrow-right"></i>
                    Logout
                </button>

            </div>
        </div>
    `;
}

function buildPositionText(
    designation,
    displayRole
) {
    const safeDesignation = String(
        designation || ""
    ).trim();

    const safeDisplayRole = String(
        displayRole || ""
    ).trim();

    if (
        safeDesignation
        && safeDisplayRole
        && safeDesignation.toLowerCase()
            !== safeDisplayRole.toLowerCase()
    ) {
        return `${safeDesignation} · ${safeDisplayRole}`;
    }

    return safeDesignation
        || safeDisplayRole
        || "Designation not assigned";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

    function getUserInitials(user) {
        if (!user || !user.name) {
            return "U";
        }

        return user.name
            .split(" ")
            .map(part => part.charAt(0))
            .join("")
            .substring(0, 2)
            .toUpperCase();
    }

    function formatRole(role) {
        switch (role) {
            case "ADMIN":
                return "Admin";
            case "EXECUTIVE_VIEWER":
                return "Executive Viewer";
            case "DELIVERY_HEAD":
                return "Delivery Head";
            case "DELIVERY_MANAGER":
                return "Delivery Manager";
            case "TL":
                return "Team Lead";
            case "CLIENT_VIEWER":
                return "Client Viewer"
            case "TEAM_MEMBER":
                return "Team Member";
            default:
                return role || "";
        }
    }

    function handleGlobalSearchInput(value) {
        // Demo UI only for now.
        console.log("Search:", value);
    }

    function isExecutiveViewer() {
        const user = getUser();
        return user && user.role === "EXECUTIVE_VIEWER";
    }

    function isClientViewer() {
        const user = getUser();
        return user && user.role === "CLIENT_VIEWER";
    }


    return {
        login,
        getUser,
        logout,
        protectPage,
        initLayout,
        apiGet,
        apiPost,
        apiPut,
        apiDelete,
        formatMoney,
        formatHourlyUsdFromMonthlyInr,
        formatDate,
        badge,
        showError,
        isAdmin,
        isHead,
        isDeliveryHead,
        isDeliveryManager,
        isTL,
        isEmployee,
        isAdminOrHead,
        isAdminOrDeliveryHead,
        isMyViewRole,
        getProjectsApi,
        getTasksApi,
        handleGlobalSearchInput,
        isExecutiveViewer,
        isClientViewer
    };
})();
