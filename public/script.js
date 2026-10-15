(() => {
    "use strict";

    const API = "/api";
    const state = {
        accessToken: null,
        account: null,
        activeSection: "overview",
        settings: null,
        toastTimer: null
    };

    const byId = id => document.getElementById(id);

    function formData(form) {
        return Object.fromEntries(new FormData(form).entries());
    }

    function showNotice(element, message, kind = "success") {
        element.textContent = message;
        element.className = `notice notice-${kind}`;
        element.hidden = false;
        element.setAttribute("role", kind === "error" ? "alert" : "status");
        if (!element.hasAttribute("tabindex")) element.tabIndex = -1;
        element.focus();
    }

    function hideNotice(element) {
        element.hidden = true;
        element.textContent = "";
    }

    function toast(message, kind = "success") {
        const element = byId("toast");
        element.textContent = message;
        element.className = `toast toast-${kind} is-visible`;
        clearTimeout(state.toastTimer);
        state.toastTimer = setTimeout(() => element.classList.remove("is-visible"), 3600);
    }

    async function request(path, options = {}, { authenticated = false, retry = true } = {}) {
        const headers = new Headers(options.headers || {});
        if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        if (authenticated && state.accessToken) {
            headers.set("Authorization", `Bearer ${state.accessToken}`);
        }

        let response = await fetch(`${API}${path}`, {
            ...options,
            headers,
            credentials: "same-origin"
        });

        if (authenticated && response.status === 401 && retry) {
            const refreshed = await refreshAccessToken();
            if (refreshed) return request(path, options, { authenticated: true, retry: false });
        }

        const contentType = response.headers.get("content-type") || "";
        const payload = contentType.includes("application/json")
            ? await response.json()
            : { message: await response.text() };
        if (!response.ok) {
            const error = new Error(payload.message || payload.error || `Request failed (${response.status})`);
            error.status = response.status;
            error.payload = payload;
            throw error;
        }
        return payload;
    }

    async function refreshAccessToken() {
        try {
            const result = await request("/auth/refresh", { method: "POST" }, { retry: false });
            state.accessToken = result.accessToken;
            return true;
        } catch {
            state.accessToken = null;
            return false;
        }
    }

    function setAuthMode(mode) {
        const loginActive = mode === "login";
        byId("login-panel").hidden = !loginActive;
        byId("register-panel").hidden = loginActive;
        byId("login-tab").classList.toggle("is-active", loginActive);
        byId("register-tab").classList.toggle("is-active", !loginActive);
        byId("login-tab").setAttribute("aria-selected", String(loginActive));
        byId("register-tab").setAttribute("aria-selected", String(!loginActive));
        byId("auth-title").innerHTML = loginActive
            ? "Welcome to<br><span>Parker's Poker.</span>"
            : "Pull up a<br><span>chair, friend.</span>";
        hideNotice(byId("auth-notice"));
        byId("forgot-form").hidden = true;
    }

    function showView(view) {
        byId("auth-view").hidden = view !== "auth";
        byId("dashboard-view").hidden = view !== "dashboard";
        byId("reset-view").hidden = view !== "reset";
        byId("logout-button").hidden = view !== "dashboard";
    }

    function switchSection(section) {
        state.activeSection = section;
        document.querySelectorAll(".nav-item").forEach(button => {
            button.classList.toggle("is-active", button.dataset.section === section);
        });
        document.querySelectorAll(".content-section").forEach(panel => {
            const active = panel.id === `section-${section}`;
            panel.hidden = !active;
            panel.classList.toggle("is-visible", active);
        });
        const titles = {
            overview: ["THE HIGH-ROLLER LOUNGE", "Overview"],
            profile: ["YOUR PLAYER CARD", "Profile"],
            preferences: ["HOUSE RULES", "Preferences"],
            security: ["THE VAULT", "Security"],
            sessions: ["WHO’S AT THE TABLE", "Sessions"]
        };
        const [eyebrow, title] = titles[section] || titles.overview;
        byId("section-eyebrow").textContent = eyebrow;
        byId("section-title").textContent = title;
        byId("section-title").focus({ preventScroll: true });
        hideNotice(byId("dashboard-notice"));
        if (section === "sessions") loadSessions();
        if (section === "preferences") loadSettings();
    }

    function fullName(account) {
        return [account.firstName, account.lastName].filter(Boolean).join(" ") || account.username || "Your account";
    }

    function renderAccount(account) {
        state.account = account;
        const name = fullName(account);
        byId("sidebar-name").textContent = name;
        byId("sidebar-email").textContent = account.email || "";
        byId("sidebar-avatar").textContent = name.trim().charAt(0).toUpperCase() || "A";
        if (account.avatarUrl) {
            byId("sidebar-avatar").style.backgroundImage = `url("${account.avatarUrl.replace(/["\\]/g, "")}")`;
            byId("sidebar-avatar").classList.add("has-image");
            byId("sidebar-avatar").textContent = "";
        } else {
            byId("sidebar-avatar").style.backgroundImage = "";
            byId("sidebar-avatar").classList.remove("has-image");
        }
        byId("welcome-name").textContent = name.split(" ")[0];
        byId("overview-username").textContent = `@${account.username}`;
        byId("overview-email").textContent = account.email;
        byId("detail-username").textContent = account.username;
        byId("detail-email").textContent = account.email;
        byId("detail-created").textContent = account.createdAt
            ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(account.createdAt))
            : "—";
        byId("email-status").textContent = account.emailVerified ? "Verified" : "Not verified";
        byId("email-status-copy").textContent = account.emailVerified
            ? "Your email is verified. You’re officially on the guest list."
            : "Verify your email so we can keep you in the loop (and out of the spam pile).";
        byId("overview-resend").hidden = Boolean(account.emailVerified);

        const profile = byId("profile-form");
        profile.elements.firstName.value = account.firstName || "";
        profile.elements.lastName.value = account.lastName || "";
        profile.elements.bio.value = account.bio || "";
        profile.elements.avatarUrl.value = account.avatarUrl || "";
        byId("delete-account-name").textContent = account.username ? `@${account.username}` : "your account";
        updateAvatarPreview();
    }

    function updateAvatarPreview() {
        const value = byId("profile-form").elements.avatarUrl.value.trim();
        const preview = byId("avatar-preview");
        const fallback = byId("avatar-fallback");
        fallback.textContent = fullName(state.account || {}).trim().charAt(0).toUpperCase() || "A";
        if (!value) {
            preview.hidden = true;
            preview.removeAttribute("src");
            fallback.hidden = false;
            return;
        }
        preview.onload = () => {
            preview.hidden = false;
            fallback.hidden = true;
        };
        preview.onerror = () => {
            preview.hidden = true;
            fallback.hidden = false;
        };
        preview.src = value;
    }

    async function loadAccount() {
        const result = await request("/account", {}, { authenticated: true });
        renderAccount(result.account);
    }

    async function loadSettings() {
        const result = await request("/account/settings", {}, { authenticated: true });
        state.settings = result.settings;
        for (const [key, value] of Object.entries(result.settings)) {
            const input = byId("settings-form").elements.namedItem(key);
            if (input) input.checked = Boolean(value);
        }
    }

    function formatDate(value) {
        return value
            ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
            : "Unknown";
    }

    function friendlyUserAgent(userAgent) {
        if (!userAgent) return "Unknown guest";
        const browser = /Edg\//.test(userAgent) ? "Edge"
            : /Firefox\//.test(userAgent) ? "Firefox"
                : /Chrome\//.test(userAgent) && !/Edg\//.test(userAgent) ? "Chrome"
                    : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent) ? "Safari"
                        : /curl\//i.test(userAgent) ? "API client"
                            : "Browser";
        const platform = /Android/i.test(userAgent) ? "Android"
            : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS"
                : /Windows/i.test(userAgent) ? "Windows"
                    : /Mac OS X|Macintosh/i.test(userAgent) ? "macOS"
                        : /Linux/i.test(userAgent) ? "Linux"
                            : "";
        return [browser, platform].filter(Boolean).join(" on ");
    }

    async function loadSessions() {
        const list = byId("session-list");
        list.innerHTML = '<p class="empty-state">Checking the room…</p>';
        try {
            const result = await request("/account/sessions", {}, { authenticated: true });
            byId("session-count").textContent = result.sessions.length;
            if (!result.sessions.length) {
                list.innerHTML = '<p class="empty-state">It’s just you at the table right now.</p>';
                return;
            }
            list.replaceChildren(...result.sessions.map(session => {
                const row = document.createElement("article");
                row.className = "session-row";
                const info = document.createElement("div");
                info.className = "session-info";
                const title = document.createElement("strong");
                title.textContent = session.current ? "You, right here" : "Another guest";
                const details = document.createElement("span");
                details.textContent = `${friendlyUserAgent(session.userAgent)} · Last active ${formatDate(session.lastUsedAt)}`;
                const expiry = document.createElement("small");
                expiry.textContent = `Expires ${formatDate(session.expiresAt)}`;
                info.append(title, details, expiry);
                row.append(info);
                const revoke = document.createElement("button");
                revoke.className = "button button-quiet button-small";
                revoke.type = "button";
                revoke.textContent = session.current ? "Sign out" : "Show the door";
                revoke.addEventListener("click", () => revokeSession(session.id, session.current, revoke));
                row.append(revoke);
                return row;
            }));
        } catch (error) {
            list.innerHTML = "";
            showNotice(byId("dashboard-notice"), error.message, "error");
        }
    }

    async function revokeSession(id, current = false, button) {
        await withBusy(button, current ? "Signing out…" : "Escorting out…", async () => {
            try {
                const result = await request(`/account/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }, { authenticated: true });
                if (current) {
                    state.accessToken = null;
                    signOutLocally(result.message);
                    return;
                }
                toast(result.message);
                await loadSessions();
            } catch (error) {
                showNotice(byId("dashboard-notice"), error.message, "error");
            }
        });
    }

    async function enterDashboard() {
        showView("dashboard");
        switchSection("overview");
        try {
            await loadAccount();
            await loadSessions();
        } catch (error) {
            state.accessToken = null;
            showView("auth");
            throw error;
        }
    }

    function signOutLocally(message) {
        state.accessToken = null;
        state.account = null;
        showView("auth");
        setAuthMode("login");
        if (message) showNotice(byId("auth-notice"), message, "success");
    }

    function handleError(element, error, form) {
        const details = error.payload?.failed || error.payload?.missing;
        const message = details?.length
            ? `${error.message}: ${details.join(", ")}`
            : error.message;
        const invalidField = markFieldError(form, error, message);
        showNotice(element, message, "error");
        invalidField?.focus();
    }

    function markFieldError(form, error, message) {
        if (!form) return;
        let name = error.payload?.missing?.[0];
        if (!name && error.payload?.failed?.length) name = "reqPass";
        if (!name && /email/i.test(error.message)) name = "email";
        if (!name && /username/i.test(error.message)) name = "username";
        if (!name && /password/i.test(error.message)) {
            name = /match/i.test(error.message)
                ? "conPass"
                : (form.elements.namedItem("reqPass") ? "reqPass" : "password");
        }
        const input = name && form.elements.namedItem(name);
        if (!input || !("setAttribute" in input)) return null;
        input.setAttribute("aria-invalid", "true");
        const field = input.closest(".field");
        if (!field) return;
        let hint = field.querySelector(".field-error");
        if (!hint) {
            hint = document.createElement("small");
            hint.className = "field-error";
            hint.id = `error-${name}`;
            field.append(hint);
        }
        hint.textContent = message;
        input.setAttribute("aria-describedby", hint.id);
        return input;
    }

    function bindSubmit(form, busyLabel, handler) {
        form.addEventListener("input", event => {
            if (!(event.target instanceof HTMLElement)) return;
            event.target.removeAttribute("aria-invalid");
            const hint = event.target.closest(".field")?.querySelector(".field-error");
            if (hint) hint.remove();
            event.target.removeAttribute("aria-describedby");
        });
        form.addEventListener("submit", event => {
            event.preventDefault();
            const button = event.submitter || form.querySelector('[type="submit"]');
            if (button?.disabled) return;
            const originalLabel = button?.innerHTML;
            if (button) {
                button.disabled = true;
                button.setAttribute("aria-busy", "true");
                button.textContent = busyLabel;
            }
            void (async () => {
                try {
                    await handler(event, form);
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.removeAttribute("aria-busy");
                        button.innerHTML = originalLabel;
                    }
                }
            })();
        });
    }

    function bindPasswordUX() {
        document.querySelectorAll("[data-password-input]").forEach(input => {
            const control = document.createElement("div");
            control.className = "password-control";
            input.parentNode.insertBefore(control, input);
            control.append(input);
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "password-toggle";
            toggle.textContent = "Show";
            toggle.setAttribute("aria-label", "Show password");
            toggle.addEventListener("click", () => {
                const reveal = input.type === "password";
                input.type = reveal ? "text" : "password";
                toggle.textContent = reveal ? "Hide" : "Show";
                toggle.setAttribute("aria-label", `${reveal ? "Hide" : "Show"} password`);
                input.focus();
            });
            control.append(toggle);
        });

        const updatePasswords = () => {
            document.querySelectorAll("form").forEach(form => {
                const password = form.querySelector("[data-password-input]");
                const confirmation = form.querySelector("[data-password-confirm]");
                if (!password) return;
                const value = password.value.trim();
                const checklist = form.querySelector("[data-password-checklist]");
                if (checklist) {
                    checklist.hidden = password.value.length === 0;
                    const rules = {
                        length: value.length >= 12,
                        lower: /[a-z]/.test(value),
                        upper: /[A-Z]/.test(value),
                        number: /[0-9]/.test(value),
                        special: /[!@#$%^&*]/.test(value)
                    };
                    Object.entries(rules).forEach(([name, valid]) => {
                        checklist.querySelector(`[data-rule="${name}"]`).classList.toggle("is-valid", valid);
                    });
                    const valid = Object.values(rules).every(Boolean);
                    password.setCustomValidity(password.value && !valid ? "Meet all listed password requirements." : "");
                    password.toggleAttribute("aria-invalid", Boolean(password.value) && !valid);
                }
                if (!confirmation) return;
                const hint = form.querySelector("[data-match-hint]");
                const matches = confirmation.value.trim() === password.value.trim();
                const hasConfirmation = confirmation.value.length > 0;
                confirmation.setCustomValidity(hasConfirmation && !matches ? "Passwords do not match." : "");
                confirmation.toggleAttribute("aria-invalid", hasConfirmation && !matches);
                hint.textContent = hasConfirmation ? (matches ? "Passwords match." : "Passwords do not match.") : "";
                hint.classList.toggle("is-valid", hasConfirmation && matches);
                hint.classList.toggle("is-invalid", hasConfirmation && !matches);
            });
        };
        document.querySelectorAll("[data-password-input], [data-password-confirm]").forEach(input => {
            input.addEventListener("input", updatePasswords);
        });
        document.querySelectorAll("form").forEach(form => {
            form.addEventListener("reset", () => setTimeout(updatePasswords));
        });
        updatePasswords();
    }

    function bindAvatarPreview() {
        const input = byId("profile-form").elements.avatarUrl;
        input.addEventListener("input", updateAvatarPreview);
        input.addEventListener("change", updateAvatarPreview);
        byId("remove-avatar").addEventListener("click", () => {
            input.value = "";
            updateAvatarPreview();
            input.focus();
        });
    }

    function bindAuthForms() {
        byId("login-tab").addEventListener("click", () => setAuthMode("login"));
        byId("register-tab").addEventListener("click", () => setAuthMode("register"));
        byId("show-forgot").addEventListener("click", () => {
            byId("forgot-form").hidden = false;
            hideNotice(byId("auth-notice"));
        });
        byId("hide-forgot").addEventListener("click", () => { byId("forgot-form").hidden = true; });

        bindSubmit(byId("login-form"), "Dealing…", async (event, form) => {
            hideNotice(byId("auth-notice"));
            try {
                const result = await request("/auth/login", {
                    method: "POST",
                    body: JSON.stringify(formData(event.currentTarget))
                });
                state.accessToken = result.accessToken;
                await enterDashboard();
            } catch (error) {
                handleError(byId("auth-notice"), error, form);
            }
        });

        bindSubmit(byId("register-form"), "Pulling up a chair…", async (event, form) => {
            hideNotice(byId("auth-notice"));
            try {
                const result = await request("/auth/register", {
                    method: "POST",
                    body: JSON.stringify(formData(event.currentTarget))
                });
                state.accessToken = result.accessToken;
                await enterDashboard();
                showNotice(byId("dashboard-notice"), "You’re in! Check your inbox (and spam folder) for a verification link. You can resend it from Overview.", "success");
            } catch (error) {
                handleError(byId("auth-notice"), error, form);
            }
        });

        bindSubmit(byId("forgot-form"), "Sending…", async (event, form) => {
            try {
                const result = await request("/auth/forgot-password", {
                    method: "POST",
                    body: JSON.stringify(formData(event.currentTarget))
                });
                showNotice(byId("auth-notice"), result.message, "success");
                event.currentTarget.reset();
                event.currentTarget.hidden = true;
            } catch (error) {
                handleError(byId("auth-notice"), error, form);
            }
        });
    }

    function bindDashboardForms() {
        document.querySelectorAll(".nav-item").forEach(button => {
            button.addEventListener("click", () => switchSection(button.dataset.section));
        });
        document.querySelectorAll("[data-go]").forEach(button => {
            button.addEventListener("click", () => switchSection(button.dataset.go));
        });

        bindSubmit(byId("profile-form"), "Saving…", async (event, form) => {
            const values = formData(event.currentTarget);
            for (const key of ["firstName", "lastName", "bio", "avatarUrl"]) {
                if (values[key] === "") values[key] = null;
            }
            try {
                const result = await request("/account", { method: "PATCH", body: JSON.stringify(values) }, { authenticated: true });
                renderAccount(result.account);
                toast("Player card saved");
            } catch (error) {
                handleError(byId("dashboard-notice"), error, form);
            }
        });

        byId("settings-form").addEventListener("submit", event => event.preventDefault());
        byId("save-settings").addEventListener("click", async event => {
            if (event.currentTarget.disabled) return;
            await withBusy(event.currentTarget, "Saving…", async () => {
            const values = Object.fromEntries(settingKeys().map(key => [
                key,
                byId("settings-form").elements.namedItem(key).checked
            ]));
            try {
                const result = await request("/account/settings", { method: "PATCH", body: JSON.stringify(values) }, { authenticated: true });
                state.settings = result.settings;
                toast("House rules saved");
            } catch (error) {
                handleError(byId("dashboard-notice"), error);
            }
            });
        });

        bindSubmit(byId("email-form"), "Updating email…", async (event, form) => {
            try {
                const result = await request("/account/email", { method: "PATCH", body: JSON.stringify(formData(event.currentTarget)) }, { authenticated: true });
                byId("email-form").reset();
                signOutLocally(`${result.message} Check your inbox (and spam folder) for the verification link. Sign in again with your new email address.`);
            } catch (error) {
                handleError(byId("dashboard-notice"), error, form);
            }
        });

        bindSubmit(byId("verify-password-form"), "Checking…", async (event, form) => {
            try {
                await request("/account/verify-password", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) }, { authenticated: true });
                event.currentTarget.reset();
                toast("Password verified. Nice poker face");
            } catch (error) {
                handleError(byId("dashboard-notice"), error, form);
            }
        });

        bindSubmit(byId("change-password-form"), "Changing password…", async (event, form) => {
            try {
                const result = await request("/account/change-password", { method: "POST", body: JSON.stringify(formData(event.currentTarget)) }, { authenticated: true });
                event.currentTarget.reset();
                signOutLocally(result.message);
            } catch (error) {
                handleError(byId("dashboard-notice"), error, form);
            }
        });

        bindSubmit(byId("delete-account-form"), "Deleting…", async (event, form) => {
            try {
                const values = formData(event.currentTarget);
                delete values.confirmUsername;
                const result = await request("/account", { method: "DELETE", body: JSON.stringify(values) }, { authenticated: true });
                byId("delete-dialog").close();
                signOutLocally(result.message);
            } catch (error) {
                handleError(byId("delete-notice"), error, form);
            }
        });

        byId("open-delete-dialog").addEventListener("click", () => {
            byId("delete-dialog").showModal();
            byId("delete-confirm-username").focus();
        });
        byId("cancel-delete").addEventListener("click", () => byId("delete-dialog").close());
        byId("delete-confirm-username").addEventListener("input", event => {
            byId("confirm-delete").disabled = event.currentTarget.value.trim() !== state.account?.username;
        });
        byId("delete-dialog").addEventListener("close", () => {
            byId("delete-account-form").reset();
            byId("confirm-delete").disabled = true;
            hideNotice(byId("delete-notice"));
            byId("open-delete-dialog").focus();
        });
        byId("overview-resend").addEventListener("click", event => withBusy(event.currentTarget, "Sending…", resendVerification));
        byId("refresh-sessions").addEventListener("click", event => withBusy(event.currentTarget, "Refreshing…", loadSessions));
        byId("export-account").addEventListener("click", event => withBusy(event.currentTarget, "Preparing…", exportAccount));
        byId("logout-button").addEventListener("click", event => withBusy(event.currentTarget, "Signing out…", logout));
        byId("mobile-logout-button").addEventListener("click", event => withBusy(event.currentTarget, "Signing out…", logout));
    }

    async function withBusy(button, busyLabel, callback) {
        const originalLabel = button.innerHTML;
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
        button.textContent = busyLabel;
        try {
            await callback();
        } finally {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = originalLabel;
        }
    }

    function settingKeys() {
        return ["privacy", "dataSharing", "cookies", "emailRegistries"];
    }

    async function resendVerification() {
        try {
            const result = await request("/account/resend-verify-email", { method: "POST" }, { authenticated: true });
            showNotice(byId("dashboard-notice"), result.message, "success");
        } catch (error) {
            handleError(byId("dashboard-notice"), error);
        }
    }

    async function exportAccount() {
        try {
            const result = await request("/account/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}"
            }, { authenticated: true });
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "account-data.json";
            document.body.append(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast("Your data is packed up and downloaded");
        } catch (error) {
            handleError(byId("dashboard-notice"), error);
        }
    }

    async function logout() {
        try {
            await request("/auth/logout", { method: "POST" });
            signOutLocally("You’ve left the table. Come back soon!");
        } catch (error) {
            showNotice(byId("dashboard-notice"), error.message, "error");
        }
    }

    function bindResetForm(token) {
        byId("reset-form").elements.token.value = token;
        bindSubmit(byId("reset-form"), "Shuffling…", async (event, form) => {
            hideNotice(byId("reset-notice"));
            try {
                const result = await request("/auth/reset-password", {
                    method: "POST",
                    body: JSON.stringify(formData(event.currentTarget))
                });
                event.currentTarget.reset();
                showNotice(byId("reset-notice"), `${result.message}. You can now sign in.`, "success");
                window.history.replaceState({}, "", "/");
            } catch (error) {
                handleError(byId("reset-notice"), error, form);
            }
        });
    }

    async function verifyEmail(token) {
        showView("auth");
        setAuthMode("login");
        try {
            const result = await request(`/auth/verify-email?token=${encodeURIComponent(token)}`);
            showNotice(byId("auth-notice"), result.message, "success");
        } catch (error) {
            handleError(byId("auth-notice"), error);
        } finally {
            window.history.replaceState({}, "", "/");
        }
    }

    async function initialize() {
        bindAuthForms();
        bindDashboardForms();
        bindPasswordUX();
        bindAvatarPreview();

        const query = new URLSearchParams(window.location.search);
        const resetToken = query.get("resetPassword");
        const verifyToken = query.get("verifyEmail");
        if (resetToken) {
            showView("reset");
            bindResetForm(resetToken);
            return;
        }
        if (verifyToken) {
            await verifyEmail(verifyToken);
            return;
        }

        if (await refreshAccessToken()) {
            try {
                await enterDashboard();
            } catch {
                signOutLocally();
            }
        } else {
            showView("auth");
            setAuthMode("login");
        }
    }

    window.addEventListener("DOMContentLoaded", initialize);
})();
