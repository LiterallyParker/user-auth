(() => {
    "use strict";

    const API = "/api";
    const state = {
        accessToken: null,
        account: null,
        returnTo: null,
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

    function showHome() {
        showView("home");
        const signedIn = Boolean(state.accessToken && state.account);
        const name = signedIn ? fullName(state.account).split(" ")[0] : "";
        byId("home-lead").textContent = signedIn
            ? `Good to see you, ${name}. Your seat is right where you left it.`
            : "Parker's Poker is a cozy little corner of the internet with the lights low, the felt green-ish, and a seat saved just for you.";
        byId("home-primary").firstChild.textContent = signedIn ? "My account " : "Take a seat ";
        byId("home-secondary").hidden = signedIn;
        byId("home-cta-button").firstChild.textContent = signedIn ? "Back to my account " : "Join the table ";
    }

    function showAuth(mode = "login") {
        if (state.accessToken && state.account) {
            void go("/my_account", { replace: true });
            return;
        }
        showView("auth");
        setAuthMode(mode);
    }

    function showDashboard(section = "overview") {
        if (!requireSignIn()) return;
        if (!DASHBOARD_SECTIONS.includes(section)) {
            void go("/my_account", { replace: true });
            return;
        }
        showView("dashboard");
        switchSection(section);
    }

    // Sends signed-out visitors to the sign-in page and remembers where they were headed
    function requireSignIn(message) {
        if (state.accessToken && state.account) return true;
        state.returnTo = window.location.pathname;
        void go("/sign_in", { replace: true });
        if (message) showNotice(byId("auth-notice"), message);
        return false;
    }

    const DASHBOARD_SECTIONS = ["overview", "profile", "preferences", "security", "sessions"];
    const sectionPath = section => (section === "overview" ? "/my_account" : `/my_account/${section}`);
    const userPath = (base, username) => `${base}/${encodeURIComponent(username)}`;

    const ROUTES = [
        [/^\/$/, showHome],
        [/^\/sign_in$/, () => showAuth("login")],
        [/^\/register$/, () => showAuth("register")],
        [/^\/my_account(?:\/([a-z]+))?$/, showDashboard],
        [/^\/players(?:\/([^/]+))?$/, showPlayers],
        [/^\/messages(?:\/([^/]+))?$/, showMessages]
    ];

    async function renderRoute() {
        const path = window.location.pathname.replace(/\/+$/, "") || "/";
        for (const [pattern, handler] of ROUTES) {
            const match = path.match(pattern);
            if (match) {
                window.scrollTo({ top: 0 });
                return handler(...match.slice(1).map(part => part && decodeURIComponent(part)));
            }
        }
        return go("/", { replace: true });
    }

    function go(path, { replace = false } = {}) {
        if (path !== window.location.pathname) {
            window.history[replace ? "replaceState" : "pushState"]({}, "", path);
        }
        return renderRoute();
    }

    function showView(view) {
        byId("home-view").hidden = view !== "home";
        byId("players-view").hidden = view !== "players";
        byId("messages-view").hidden = view !== "messages";
        byId("nav-messages").classList.toggle("is-active", view === "messages");
        if (view !== "messages") stopThreadPolling();
        byId("nav-home").classList.toggle("is-active", view === "home");
        byId("nav-players").classList.toggle("is-active", view === "players");
        byId("nav-account").classList.toggle("is-active", view === "auth" || view === "dashboard");
        byId("nav-account").textContent = state.accessToken ? "My account" : "Sign in";
        byId("auth-view").hidden = view !== "auth";
        byId("dashboard-view").hidden = view !== "dashboard";
        byId("reset-view").hidden = view !== "reset";
        byId("logout-button").hidden = view !== "dashboard";
    }

    function switchSection(section) {
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

    const DEFAULT_SUITS = ["♥", "♦", "♣", "♠"];

    // Stable "random" pick per account so the avatar doesn't change on reload
    function applyDefaultAvatar(element, account) {
        const seed = String(account.id || account.username || account.email || "player");
        let hash = 0;
        for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
        element.textContent = DEFAULT_SUITS[hash % 4];
        element.dataset.bg = (hash >> 3) % 2 ? "red" : "black";
        element.dataset.ink = (hash >> 5) % 2 ? "red" : "black";
    }

    function renderAccount(account) {
        state.account = account;
        const name = fullName(account);
        byId("sidebar-name").textContent = name;
        byId("sidebar-email").textContent = account.email || "";
        applyDefaultAvatar(byId("sidebar-avatar"), account);
        if (account.avatarUrl) {
            byId("sidebar-avatar").style.backgroundImage = `url("${account.avatarUrl.replace(/["\\]/g, "")}")`;
            byId("sidebar-avatar").classList.add("has-image");
            byId("sidebar-avatar").textContent = "";
        } else {
            byId("sidebar-avatar").style.backgroundImage = "";
            byId("sidebar-avatar").classList.remove("has-image");
            applyDefaultAvatar(byId("sidebar-avatar"), account);
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
        applyDefaultAvatar(fallback, state.account || {});
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
            byId("session-count-label").textContent = result.sessions.length === 1 ? "device" : "devices";
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

    async function startSession() {
        try {
            await loadAccount();
            await loadSessions();
            void loadConversations();
            startBadgePolling();
            connectLive();
        } catch (error) {
            state.accessToken = null;
            throw error;
        }
    }

    // After signing in, return to the page that asked for it
    async function finishSignIn() {
        const destination = state.returnTo || "/my_account";
        state.returnTo = null;
        await go(destination, { replace: true });
    }

    function signOutLocally(message) {
        state.accessToken = null;
        state.account = null;
        stopBadgePolling();
        disconnectLive();
        byId("nav-badge").hidden = true;
        void go("/sign_in", { replace: true });
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
        byId("login-tab").addEventListener("click", () => go("/sign_in"));
        byId("register-tab").addEventListener("click", () => go("/register"));
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
                await startSession();
                await finishSignIn();
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
                await startSession();
                await go("/my_account", { replace: true });
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
            button.addEventListener("click", () => go(sectionPath(button.dataset.section)));
        });
        document.querySelectorAll("[data-go]").forEach(button => {
            button.addEventListener("click", () => go(sectionPath(button.dataset.go)));
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
            byId("delete-confirm-username").placeholder = state.account?.username || "";
            byId("delete-dialog").showModal();
            byId("delete-confirm-username").focus();
        });
        byId("cancel-delete").addEventListener("click", () => byId("delete-dialog").close());
        const syncDeleteButton = () => {
            const normalize = value => value.trim().replace(/^@/, "").toLowerCase();
            const typed = byId("delete-confirm-username").value;
            byId("confirm-delete").disabled = !state.account?.username || normalize(typed) !== normalize(state.account.username);
        };
        byId("delete-confirm-username").addEventListener("input", syncDeleteButton);
        byId("delete-confirm-username").addEventListener("change", syncDeleteButton);
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
                window.history.replaceState({}, "", "/sign_in");
            } catch (error) {
                handleError(byId("reset-notice"), error, form);
            }
        });
    }

    function emptyState(text) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = text;
        return empty;
    }

    const badgeText = count => (count > 9 ? "9+" : String(count));

    async function showPlayers(username = null) {
        const wasHidden = byId("players-view").hidden;
        showView("players");
        hideNotice(byId("players-notice"));
        if (wasHidden) void loadFriends();
        if (username) {
            await openPlayer(username);
            return;
        }
        byId("player-card").hidden = true;
        if (wasHidden) byId("players-query").focus();
    }

    function paintAvatar(element, user) {
        element.className = element.className.replace(/\bhas-image\b/, "").trim();
        element.style.backgroundImage = "";
        delete element.dataset.bg;
        delete element.dataset.ink;
        if (user.avatarUrl) {
            element.textContent = "";
            element.style.backgroundImage = `url("${user.avatarUrl.replace(/["\\]/g, "")}")`;
            element.classList.add("has-image");
        } else {
            applyDefaultAvatar(element, { username: user.username });
        }
    }

    async function openPlayer(username) {
        const card = byId("player-card");
        try {
            const { user } = await request(`/users/${encodeURIComponent(username)}`, {}, { authenticated: true });
            hideNotice(byId("players-notice"));
            paintAvatar(byId("player-avatar"), user);
            byId("player-username").textContent = `@${user.username}`;
            const fields = {
                "player-name": user.name,
                "player-bio": user.bio,
                "player-since": user.memberSince
                    ? `Seated at the table since ${new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(user.memberSince))}`
                    : ""
            };
            for (const [id, text] of Object.entries(fields)) {
                byId(id).textContent = text || "";
                byId(id).hidden = !text;
            }
            byId("player-private").hidden = !(user.private && !("name" in user));
            renderPlayerActions(user);
            card.hidden = false;
            document.querySelectorAll(".player-result").forEach(item => {
                item.classList.toggle("is-active", item.dataset.username === user.username);
            });
        } catch (error) {
            card.hidden = true;
            showNotice(byId("players-notice"), error.message, "error");
        }
    }

    // One row for a person in any list: avatar, @name, and an optional second line
    function personRow(user, { detail = "", className = "", detailClass = "" } = {}) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = `player-result ${className}`.trim();
        row.dataset.username = user.username;
        const avatar = document.createElement("span");
        avatar.className = "avatar";
        paintAvatar(avatar, user);
        const label = document.createElement("span");
        label.className = "player-result-name";
        label.textContent = `@${user.username}`;
        if (detail) {
            const small = document.createElement("small");
            small.className = detailClass;
            small.textContent = detail;
            label.append(small);
        }
        row.append(avatar, label);
        return row;
    }

    function playerButton(user) {
        const row = personRow(user, { detail: user.name });
        row.addEventListener("click", () => go(userPath("/players", user.username)));
        return row;
    }

    async function loadFriends() {
        const panel = byId("friends-panel");
        if (!state.accessToken) {
            panel.hidden = true;
            return;
        }
        try {
            const data = await request("/friends", {}, { authenticated: true });
            const fill = (id, users, emptyText) => {
                const box = byId(id);
                box.replaceChildren();
                if (!users.length && emptyText) box.append(emptyState(emptyText));
                for (const user of users) box.append(playerButton(user));
            };
            fill("friends-list", data.friends, "No friends yet. Search for a player and send an invite!");
            fill("friends-incoming", data.incoming);
            fill("friends-outgoing", data.outgoing);
            byId("friends-incoming-group").hidden = !data.incoming.length;
            byId("friends-outgoing-group").hidden = !data.outgoing.length;
            panel.hidden = false;
        } catch {
            panel.hidden = true;
        }
    }

    function renderPlayerActions(user) {
        const box = byId("player-actions");
        box.replaceChildren();
        const add = (label, method, kind = "secondary") => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `button button-${kind}`;
            button.textContent = label;
            button.addEventListener("click", async () => {
                button.disabled = true;
                try {
                    const path = `/friends/${encodeURIComponent(user.username)}`;
                    await request(path, { method }, { authenticated: true });
                    await Promise.all([openPlayer(user.username), loadFriends()]);
                } catch (error) {
                    button.disabled = false;
                    showNotice(byId("players-notice"), error.message, "error");
                }
            });
            box.append(button);
        };
        if (user.relationship === "self") return;
        if (!state.accessToken) {
            const hint = document.createElement("p");
            hint.className = "player-since";
            hint.textContent = "Sign in to send a friend request.";
            box.append(hint);
        } else if (state.account && !state.account.emailVerified && ["none", "incoming"].includes(user.relationship)) {
            const hint = document.createElement("p");
            hint.className = "player-since";
            hint.textContent = "Verify your email to send or accept friend requests.";
            box.append(hint);
            if (user.relationship === "incoming") add("Decline", "DELETE");
        } else if (user.relationship === "none") {
            add("Send friend request", "POST", "primary");
        } else if (user.relationship === "outgoing") {
            add("Cancel request", "DELETE");
        } else if (user.relationship === "incoming") {
            add("Accept request", "PUT", "primary");
            add("Decline", "DELETE");
        } else if (user.relationship === "friends") {
            const message = document.createElement("button");
            message.type = "button";
            message.className = "button button-primary";
            message.textContent = "Send a message";
            message.addEventListener("click", () => go(userPath("/messages", user.username)));
            box.append(message);
            add("Unfriend", "DELETE");
        }
    }

    async function searchPlayers(query) {
        const results = byId("players-results");
        byId("player-card").hidden = true;
        hideNotice(byId("players-notice"));
        try {
            const { users } = await request(`/users?q=${encodeURIComponent(query)}`, {}, { authenticated: true });
            results.replaceChildren();
            if (!users.length) {
                results.append(emptyState(`No one at the tables goes by “${query}”. Try another spelling?`));
                return;
            }
            for (const user of users) results.append(playerButton(user));
            if (users.length === 1) void go(userPath("/players", users[0].username));
        } catch (error) {
            results.replaceChildren();
            showNotice(byId("players-notice"), error.message, "error");
        }
    }

    function bindPlayers() {
        byId("nav-players").addEventListener("click", () => go("/players"));
        bindSubmit(byId("players-form"), "Searching…", async (event, form) => {
            await searchPlayers(form.elements.q.value.trim());
        });
    }

    const chat = { friend: null, timer: null, badgeTimer: null, lastId: null };
    const live = { socket: null, failures: 0 };
    const liveConnected = () => Boolean(live.socket?.connected);

    // Push events only say "something changed"; the data is re-fetched through the authorized REST routes
    function connectLive() {
        if (typeof window.io !== "function" || !state.accessToken) return;
        if (live.socket) {
            if (!live.socket.connected) live.socket.connect();
            return;
        }
        const socket = window.io({ auth: done => done({ token: state.accessToken }) });
        live.socket = socket;

        const reauthorize = async () => {
            if (++live.failures > 3) return;
            if (await refreshAccessToken()) socket.connect();
        };
        socket.on("connect", () => {
            live.failures = 0;
            void loadConversations();
            if (chat.friend && !byId("messages-view").hidden) void refreshThread();
        });
        socket.on("connect_error", error => {
            if (error.message === "unauthorized") void reauthorize();
        });
        socket.on("disconnect", reason => {
            if (reason === "io server disconnect") void reauthorize();
        });
        socket.on("message", async payload => {
            // Reading the open thread marks it read, so refresh it before the unread counts
            if (chat.friend?.username === payload?.username && !byId("messages-view").hidden) await refreshThread();
            void loadConversations();
        });
        socket.on("friends", () => {
            void loadConversations();
            if (!byId("players-view").hidden) void loadFriends();
            if (!byId("players-view").hidden && !byId("player-card").hidden) {
                void openPlayer(byId("player-username").textContent.replace(/^@/, ""));
            }
        });
    }

    // Messages that arrived while the tab was hidden count as read once it's seen
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && chat.friend && !byId("messages-view").hidden) {
            void refreshThread().then(loadConversations);
        }
    });

    function disconnectLive() {
        live.socket?.disconnect();
        live.socket = null;
        live.failures = 0;
    }

    function stopThreadPolling() {
        clearInterval(chat.timer);
        chat.timer = null;
    }

    function stopBadgePolling() {
        clearInterval(chat.badgeTimer);
        chat.badgeTimer = null;
    }

    function startBadgePolling() {
        if (chat.badgeTimer) return;
        chat.badgeTimer = setInterval(() => {
            if (state.accessToken && !document.hidden && !liveConnected()) void loadConversations();
        }, 20000);
    }

    function updateBadge(conversations) {
        const total = conversations.reduce((sum, item) => sum + item.unread, 0);
        const badge = byId("nav-badge");
        badge.textContent = badgeText(total);
        badge.hidden = total === 0;
    }

    function formatTime(value) {
        const date = new Date(value);
        const sameDay = date.toDateString() === new Date().toDateString();
        return new Intl.DateTimeFormat(undefined, sameDay ? { timeStyle: "short" } : { dateStyle: "medium", timeStyle: "short" }).format(date);
    }

    function closeThread() {
        stopThreadPolling();
        chat.friend = null;
        byId("thread").hidden = true;
        byId("thread-empty").hidden = false;
    }

    function conversationRow(item) {
        const row = personRow(item, {
            detail: item.lastMessage ? `${item.lastMessage.mine ? "You: " : ""}${item.lastMessage.body}` : "Say hello!",
            className: "conversation",
            detailClass: "conversation-preview"
        });
        row.classList.toggle("is-active", chat.friend?.username === item.username);
        if (item.unread) {
            const dot = document.createElement("span");
            dot.className = "nav-badge";
            dot.textContent = badgeText(item.unread);
            row.append(dot);
        }
        row.addEventListener("click", () => go(userPath("/messages", item.username)));
        return row;
    }

    // Returns the conversation list, or null if it couldn't be loaded
    async function loadConversations() {
        if (!state.accessToken) return null;
        try {
            const { conversations } = await request("/messages", {}, { authenticated: true });
            updateBadge(conversations);
            if (byId("messages-view").hidden) return conversations;
            if (chat.friend && !conversations.some(item => item.username === chat.friend.username)) {
                closeThread();
                window.history.replaceState({}, "", "/messages");
                showNotice(byId("messages-notice"), "That chat has closed because you’re no longer friends.", "error");
            }
            const list = byId("conversation-list");
            list.replaceChildren();
            if (conversations.length) {
                list.append(...conversations.map(conversationRow));
            } else {
                list.append(emptyState("No friends at the table yet. Add a few from the Players page!"));
            }
            return conversations;
        } catch {
            // Background refreshes fail quietly
            return null;
        }
    }

    function renderMessages(messages) {
        const body = byId("thread-body");
        const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
        body.replaceChildren();
        if (!messages.length) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = "Nothing here yet. Break the ice!";
            body.append(empty);
        }
        for (const message of messages) {
            const bubble = document.createElement("div");
            bubble.className = `bubble ${message.mine ? "bubble-mine" : "bubble-theirs"}`;
            const text = document.createElement("p");
            text.textContent = message.body;
            const time = document.createElement("time");
            time.dateTime = message.createdAt;
            time.textContent = formatTime(message.createdAt);
            bubble.append(text, time);
            body.append(bubble);
        }
        const latestMine = messages.findLast(message => message.mine);
        if (latestMine) {
            const status = document.createElement("span");
            status.className = `delivery ${latestMine.read ? "delivery-read" : "delivery-sent"}`;
            status.textContent = "♥";
            status.title = latestMine.read ? "Read" : "Sent";
            status.setAttribute("role", "img");
            status.setAttribute("aria-label", status.title);
            const lastBubble = body.querySelectorAll(".bubble-mine");
            // Sits under the newest sent message, even if they've replied since
            lastBubble[lastBubble.length - 1].after(status);
        }
        const newest = messages.at(-1)?.id || null;
        if (nearBottom || newest !== chat.lastId) body.scrollTop = body.scrollHeight;
        chat.lastId = newest;
    }

    async function refreshThread({ background = false } = {}) {
        if (!chat.friend || (background && document.hidden)) return;
        const username = chat.friend.username;
        try {
            const peek = document.hidden ? "?peek=1" : "";
            const { messages } = await request(`/messages/${encodeURIComponent(username)}${peek}`, {}, { authenticated: true });
            if (chat.friend?.username === username) renderMessages(messages);
        } catch (error) {
            showNotice(byId("messages-notice"), error.message, "error");
            stopThreadPolling();
        }
    }

    async function openThread(friend) {
        chat.friend = friend;
        chat.lastId = null;
        hideNotice(byId("messages-notice"));
        byId("thread").hidden = false;
        byId("thread-empty").hidden = true;
        byId("thread-name").textContent = `@${friend.username}`;
        paintAvatar(byId("thread-avatar"), friend);
        document.querySelectorAll(".conversation").forEach(row => {
            row.classList.toggle("is-active", row.dataset.username === friend.username);
        });
        stopThreadPolling();
        await refreshThread();
        void loadConversations();
        chat.timer = setInterval(() => {
            if (!liveConnected()) void refreshThread({ background: true });
        }, 5000);
        const canSend = Boolean(state.account?.emailVerified);
        byId("thread-input").disabled = !canSend;
        byId("thread-form").querySelector("button").disabled = !canSend;
        byId("thread-input").placeholder = canSend ? "Deal a message…" : "Verify your email to send messages";
        if (canSend) byId("thread-input").focus();
    }

    async function showMessages(username = null) {
        if (!requireSignIn("Sign in to chat with your friends.")) return;
        showView("messages");
        hideNotice(byId("messages-notice"));
        const conversations = await loadConversations();
        const friend = username && conversations?.find(item => item.username === username);
        if (friend) {
            await openThread(friend);
            return;
        }
        closeThread();
        if (username && conversations) {
            window.history.replaceState({}, "", "/messages");
            showNotice(byId("messages-notice"), "You can only chat with your friends.", "error");
        }
    }

    function bindMessages() {
        byId("nav-messages").addEventListener("click", () => go("/messages"));
        const input = byId("thread-input");
        const form = byId("thread-form");
        input.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                form.requestSubmit();
            }
        });
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const body = input.value.trim();
            if (!body || !chat.friend) return;
            const button = form.querySelector("button");
            button.disabled = true;
            try {
                await request(`/messages/${encodeURIComponent(chat.friend.username)}`, {
                    method: "POST",
                    body: JSON.stringify({ body })
                }, { authenticated: true });
                input.value = "";
                hideNotice(byId("messages-notice"));
                await refreshThread();
                void loadConversations();
            } catch (error) {
                showNotice(byId("messages-notice"), error.message, "error");
            } finally {
                button.disabled = false;
                input.focus();
            }
        });
    }

    function bindHome() {
        const link = event => {
            event.preventDefault();
            void go("/");
        };
        document.querySelector(".brand").addEventListener("click", link);
        byId("nav-home").addEventListener("click", link);
        byId("nav-account").addEventListener("click", () => go("/sign_in"));
        byId("home-primary").addEventListener("click", () => go("/register"));
        byId("home-secondary").addEventListener("click", () => go("/sign_in"));
        byId("home-cta-button").addEventListener("click", () => go("/register"));
    }

    async function initialize() {
        bindAuthForms();
        bindDashboardForms();
        bindPasswordUX();
        bindAvatarPreview();
        bindHome();
        bindPlayers();
        bindMessages();

        const resetToken = new URLSearchParams(window.location.search).get("resetPassword");
        if (resetToken) {
            showView("reset");
            bindResetForm(resetToken);
            return;
        }

        if (await refreshAccessToken()) {
            try {
                await startSession();
            } catch {
                state.account = null;
            }
        }
        window.addEventListener("popstate", renderRoute);
        await renderRoute();
    }

    window.addEventListener("DOMContentLoaded", initialize);
})();
