const PMS = (() => {
    const API_BASE = "";

    const menuItems = [
        {
            key: "dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            url: "/dashboard",
            roles: ["ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER","CLIENT_VIEWER"]
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
        renderSidebar(activeMenu);
        renderTopbar(activeMenu);
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

        if (!response.ok) {
            throw new Error("API error: " + response.status);
        }

        return response.json();
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

        if (!response.ok) {
            throw new Error("API error: " + response.status);
        }

        return response.json();
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

        if (!response.ok) {
            throw new Error("API error: " + response.status);
        }

        return response.json();
    }

    async function apiDelete(url) {
        const response = await fetch(API_BASE + url, {
            method: "DELETE",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error("API error: " + response.status);
        }
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
        alert("Something went wrong. Please check backend and console.");
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
        const topbar = document.getElementById("topbar");

        if (!topbar) {
            return;
        }

        const user = getUser();
        const title = getPageTitle(activeMenu);
        const subtitle = getPageSubtitle(activeMenu);
        const initials = getUserInitials(user);

        topbar.innerHTML = `
            <div class="topbar-main">
                <div class="topbar-left">
                    <div class="page-title">${title}</div>
                    <div class="page-subtitle">${subtitle}</div>
                </div>

                <div class="topbar-search">
                    <i class="bi bi-search search-icon"></i>
                    <input type="text"
                           placeholder="Search project, task, client or resource"
                           oninput="PMS.handleGlobalSearchInput(this.value)">
                    <span class="search-shortcut">Alt + K</span>
                </div>

                <div class="topbar-right">
                    <button class="notification-btn" title="Notifications">
                        <i class="bi bi-bell"></i>
                    </button>

                    <div class="user-chip">
                        <div class="user-avatar">${initials}</div>
                        <div class="user-meta">
                            <div class="user-name">${user ? user.name : "User"}</div>
                           <div class="user-role">${user ? (user.designation || user.displayRole || formatRole(user.role)) : ""}</div>  
                        </div>
                    </div>

                    <button class="logout-link" onclick="PMS.logout()">
                        <i class="bi bi-box-arrow-right"></i>
                        Logout
                    </button>
                </div>
            </div>
        `;
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
