
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");

    const usernameInput =
        document.getElementById("username");

    const passwordInput =
        document.getElementById("password");

    const usernameError =
        document.getElementById("usernameError");

    const passwordError =
        document.getElementById("passwordError");

    const loginError =
        document.getElementById("loginError");

    const loginButton =
        document.getElementById("loginButton");

    const buttonText =
        loginButton.querySelector(".button-text");

    const togglePassword =
        document.getElementById("togglePassword");

    const currentYear =
        document.getElementById("currentYear");

    currentYear.textContent =
        new Date().getFullYear();

    togglePassword.addEventListener(
        "click",
        function () {
            const shouldShow =
                passwordInput.type === "password";

            passwordInput.type =
                shouldShow
                    ? "text"
                    : "password";

            togglePassword.textContent =
                shouldShow
                    ? "Hide"
                    : "Show";

            togglePassword.setAttribute(
                "aria-label",
                shouldShow
                    ? "Hide password"
                    : "Show password"
            );

            togglePassword.setAttribute(
                "aria-pressed",
                String(shouldShow)
            );

            passwordInput.focus();
        }
    );

    usernameInput.addEventListener(
        "input",
        function () {
            clearFieldError(
                usernameInput,
                usernameError
            );

            clearLoginError();
        }
    );

    passwordInput.addEventListener(
        "input",
        function () {
            clearFieldError(
                passwordInput,
                passwordError
            );

            clearLoginError();
        }
    );

    form.addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            clearAllErrors();

            const username =
                usernameInput.value.trim();

            const password =
                passwordInput.value;

            let isValid = true;

            if (!username) {
                setFieldError(
                    usernameInput,
                    usernameError,
                    "Username is required."
                );

                isValid = false;
            }

            if (!password) {
                setFieldError(
                    passwordInput,
                    passwordError,
                    "Password is required."
                );

                isValid = false;
            }

            if (!isValid) {
                const firstInvalidInput =
                    form.querySelector(
                        ".input-wrap.invalid input"
                    );

                firstInvalidInput?.focus();
                return;
            }

            setLoading(true);

            try {
                const success = await PMS.login(
                    username,
                    password
                );

                if (!success) {
                    showLoginError(
                        "The username or password is incorrect. " +
                        "Please verify your credentials and try again."
                    );

                    passwordInput.select();
                    return;
                }

                window.location.replace(
                    "/dashboard"
                );
            } catch (error) {
                console.error(error);

                showLoginError(
                    "Unable to connect to the server. " +
                    "Please confirm that the application is running " +
                    "and try again."
                );
            } finally {
                setLoading(false);
            }
        }
    );

    function setFieldError(
        input,
        errorElement,
        message
    ) {
        input
            .closest(".input-wrap")
            .classList
            .add("invalid");

        input.setAttribute(
            "aria-invalid",
            "true"
        );

        errorElement.textContent = message;
    }

    function clearFieldError(
        input,
        errorElement
    ) {
        input
            .closest(".input-wrap")
            .classList
            .remove("invalid");

        input.removeAttribute(
            "aria-invalid"
        );

        errorElement.textContent = "";
    }

    function showLoginError(message) {
        loginError.textContent = message;

        loginError.classList.add(
            "visible"
        );
    }

    function clearLoginError() {
        loginError.textContent = "";

        loginError.classList.remove(
            "visible"
        );
    }

    function clearAllErrors() {
        clearFieldError(
            usernameInput,
            usernameError
        );

        clearFieldError(
            passwordInput,
            passwordError
        );

        clearLoginError();
    }

    function setLoading(loading) {
        loginButton.disabled = loading;

        loginButton.classList.toggle(
            "loading",
            loading
        );

        buttonText.textContent =
            loading
                ? "Signing in..."
                : "Sign in";
    }
});