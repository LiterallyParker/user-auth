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
        [/^\/players$/, showPlayers],
        [/^\/players\/([^/]+)$/, name => go(userPath("/profile", name), { replace: true })],
        [/^\/profile(?:\/([^/]+))?$/, showProfile],
        [/^\/messages(?:\/([^/]+))?$/, showMessages],
        [/^\/clubs(?:\/([^/]+)(?:\/members\/([^/]+))?)?$/, showClubs]
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
        byId("profile-view").hidden = view !== "profile";
        byId("messages-view").hidden = view !== "messages";
        byId("clubs-view").hidden = view !== "clubs";
        byId("nav-clubs").classList.toggle("is-active", view === "clubs");
        byId("nav-messages").classList.toggle("is-active", view === "messages");
        if (view !== "messages") stopThreadPolling();
        byId("nav-home").classList.toggle("is-active", view === "home");
        byId("nav-players").classList.toggle("is-active", view === "players" || view === "profile");
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
            void loadClubs();
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
        byId("clubs-badge").hidden = true;
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

    function showPlayers() {
        const wasHidden = byId("players-view").hidden;
        showView("players");
        hideNotice(byId("players-notice"));
        if (wasHidden) {
            void loadFriends();
            byId("players-query").focus();
        }
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

    // Fills the avatar, @name, real name, bio and join date of a profile card; ids share a prefix
    function paintProfile(prefix, user) {
        paintAvatar(byId(`${prefix}-avatar`), user);
        byId(`${prefix}-username`).textContent = `@${user.username}`;
        const fields = {
            name: user.name,
            bio: user.bio,
            since: user.memberSince
                ? `Seated at the table since ${new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(user.memberSince))}`
                : ""
        };
        for (const [key, text] of Object.entries(fields)) {
            const element = byId(`${prefix}-${key}`);
            element.textContent = text || "";
            element.hidden = !text;
        }
    }

    let profileName = null;

    async function loadProfile(username) {
        const card = byId("profile-card");
        try {
            const { user } = await request(`/users/${encodeURIComponent(username)}`, {}, { authenticated: true });
            hideNotice(byId("profile-notice"));
            profileName = user.username;
            paintProfile("profile", user);
            byId("profile-private").hidden = !(user.private && !("name" in user));
            renderProfileActions(user);
            card.hidden = false;
        } catch (error) {
            card.hidden = true;
            showNotice(byId("profile-notice"), error.message, "error");
        }
    }

    async function showProfile(username = null) {
        if (!username) {
            if (state.account) await go(userPath("/profile", state.account.username), { replace: true });
            else await go("/players", { replace: true });
            return;
        }
        showView("profile");
        byId("profile-card").hidden = true;
        hideNotice(byId("profile-notice"));
        profileName = null;
        byId("profile-back").onclick = event => {
            event.preventDefault();
            if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) window.history.back();
            else void go("/players");
        };
        await loadProfile(username);
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
        row.addEventListener("click", () => go(userPath("/profile", user.username)));
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

    function renderProfileActions(user) {
        const box = byId("profile-actions");
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
                    await Promise.all([loadProfile(user.username), loadFriends()]);
                } catch (error) {
                    button.disabled = false;
                    showNotice(byId("profile-notice"), error.message, "error");
                }
            });
            box.append(button);
        };
        if (user.relationship === "self") {
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "button button-primary";
            edit.textContent = "Edit my profile";
            edit.addEventListener("click", () => go("/my_account/profile"));
            box.append(edit);
            return;
        }
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
        hideNotice(byId("players-notice"));
        try {
            const { users } = await request(`/users?q=${encodeURIComponent(query)}`, {}, { authenticated: true });
            results.replaceChildren();
            if (!users.length) {
                results.append(emptyState(`No one at the tables goes by “${query}”. Try another spelling?`));
                return;
            }
            for (const user of users) results.append(playerButton(user));
            if (users.length === 1) void go(userPath("/profile", users[0].username));
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

    // Clubs
    let openClubId = null;
    let openClubMember = null;

    function clubRow(club) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "player-result club-row";
        const label = document.createElement("span");
        label.className = "player-result-name";
        label.textContent = club.name;
        const detail = document.createElement("small");
        detail.textContent = `${club.memberCount} member${club.memberCount === 1 ? "" : "s"}`;
        row.dataset.clubId = club.id;
        label.append(detail);
        row.append(label);
        if (club.isOwner) {
            const role = document.createElement("span");
            role.className = "club-role";
            role.textContent = "Owner";
            row.append(role);
        }
        row.addEventListener("click", () => go(`/clubs/${club.id}`));
        return row;
    }

    async function loadClubs() {
        if (!state.accessToken) return null;
        try {
            const data = await request("/clubs", {}, { authenticated: true });
            const badge = byId("clubs-badge");
            const waiting = data.invites.length + data.requestsToReview;
            badge.textContent = badgeText(waiting);
            badge.hidden = waiting === 0;
            return data;
        } catch {
            return null;
        }
    }

    function renderClubList(data) {
        if (!data) return;
        byId("club-invites-panel").hidden = data.invites.length === 0;
        byId("club-invites").replaceChildren(...data.invites.map(clubRow));
        byId("club-requested-panel").hidden = data.requested.length === 0;
        byId("club-requested").replaceChildren(...data.requested.map(clubRow));
        const list = byId("club-list");
        list.replaceChildren(...data.clubs.map(clubRow));
        if (!data.clubs.length) list.append(emptyState("No clubs yet. Start one above!"));
    }

    function clubAction(label, kind, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `button button-${kind}`;
        button.textContent = label;
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                await handler();
            } catch (error) {
                showNotice(byId("clubs-notice"), error.message, "error");
            } finally {
                button.disabled = false;
            }
        });
        return button;
    }

    // Rows only link to the member page; actions live there
    function fillUsers(id, users, base, ownerName = undefined) {
        byId(id).replaceChildren(...users.map(user => {
            const detail = ownerName === undefined ? "" : user.username === ownerName ? "Owner" : "Member";
            const row = personRow(user, { detail });
            row.addEventListener("click", () => go(`${base}/members/${encodeURIComponent(user.username)}`));
            return row;
        }));
    }

    const clubApi = (path, method, body) => request(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {})
    }, { authenticated: true });

    async function renderClubDetail(id, memberName = null) {
        let club;
        try {
            ({ club } = await request(`/clubs/${encodeURIComponent(id)}`, {}, { authenticated: true }));
        } catch (error) {
            openClubId = null;
            window.history.replaceState({}, "", "/clubs");
            byId("club-detail").hidden = true;
            byId("club-member").hidden = true;
            byId("clubs-list-view").hidden = false;
            showNotice(byId("clubs-notice"), error.message, "error");
            renderClubList(await loadClubs());
            return;
        }
        const base = `/clubs/${club.id}`;
        const mine = encodeURIComponent(state.account.username);
        const isOwner = club.role === "owner";
        const roster = club.members !== undefined;
        const inList = (list, name) => list?.some(user => user.username === name);
        if (memberName && !roster) {
            await go(base, { replace: true });
            return;
        }
        byId("club-member").hidden = !memberName;
        byId("club-detail").hidden = Boolean(memberName);
        if (memberName) {
            await renderClubMember(club, memberName, inList);
            return;
        }
        byId("club-detail-name").textContent = club.name;
        byId("club-detail-owner").textContent = `Run by @${club.owner.username} · ${club.isPublic ? "Public" : "Private"} club`;
        byId("club-invite-form").hidden = !isOwner;
        byId("club-members").parentElement.hidden = !roster;
        fillUsers("club-members", roster ? [club.owner, ...club.members] : [], base, club.owner.username);
        byId("club-requests-group").hidden = !club.requests?.length;
        fillUsers("club-requests", club.requests || [], base);
        byId("club-invited-group").hidden = !club.invited?.length;
        fillUsers("club-invited", club.invited || [], base);

        const leave = (label, notice) => clubAction(label, "secondary", async () => {
            await clubApi(`${base}/members/${mine}`, "DELETE");
            await go("/clubs");
            showNotice(byId("clubs-notice"), notice);
        });
        const actions = byId("club-actions");
        actions.replaceChildren();
        if (isOwner) {
            actions.append(
                clubAction(club.isPublic ? "Make private" : "Make public", "secondary", async () => {
                    await clubApi(base, "PATCH", { isPublic: !club.isPublic });
                    await renderClubDetail(club.id);
                    showNotice(byId("clubs-notice"), club.isPublic
                        ? "The club is now private: it can’t be found or asked to join."
                        : "The club is now public: anyone can find it and ask to join.");
                }),
                clubAction("Delete club", "secondary", async () => {
                    if (!window.confirm(`Delete “${club.name}” for everyone?`)) return;
                    await clubApi(base, "DELETE");
                    await go("/clubs");
                    showNotice(byId("clubs-notice"), "Club deleted.");
                })
            );
        } else if (club.role === "member") {
            actions.append(leave("Leave club", "You left the club."));
        } else if (club.role === "invited") {
            actions.append(
                clubAction("Accept invitation", "primary", async () => {
                    await clubApi(`${base}/membership`, "PUT");
                    await renderClubDetail(club.id);
                    void loadClubs();
                }),
                leave("Decline", "Invitation declined.")
            );
        } else if (club.role === "requested") {
            actions.append(leave("Withdraw request", "Request withdrawn."));
        } else {
            actions.append(clubAction("Ask to join", "primary", async () => {
                await clubApi(`${base}/requests`, "POST");
                await renderClubDetail(club.id);
                showNotice(byId("clubs-notice"), "Request sent. The owner will take a look.");
            }));
        }
    }

    async function renderClubMember(club, username, inList) {
        const base = `/clubs/${club.id}`;
        const name = encodeURIComponent(username);
        let status;
        if (username === club.owner.username) status = "owner";
        else if (inList(club.members, username)) status = "member";
        else if (inList(club.requests, username)) status = "requested";
        else if (inList(club.invited, username)) status = "invited";
        if (!status) {
            await go(base, { replace: true });
            return;
        }
        const back = byId("club-member-back");
        back.href = base;
        back.onclick = event => {
            event.preventDefault();
            void go(base);
        };
        try {
            const { user } = await request(`/users/${name}`, {}, { authenticated: true });
            paintProfile("club-member", user);
        } catch (error) {
            showNotice(byId("clubs-notice"), error.message, "error");
        }
        byId("club-member-status").textContent = {
            owner: `Owner of ${club.name}`,
            member: `Member of ${club.name}`,
            requested: `Asking to join ${club.name}`,
            invited: `Invited to ${club.name}`
        }[status];

        const actions = byId("club-member-actions");
        actions.replaceChildren(clubAction("View profile", "secondary", () => go(userPath("/profile", username))));
        if (club.role !== "owner" || status === "owner") return;
        const backToClub = async notice => {
            await go(base);
            showNotice(byId("clubs-notice"), notice);
            void loadClubs();
        };
        if (status === "member") {
            actions.append(
                clubAction("Make owner", "primary", async () => {
                    if (!window.confirm(`Hand “${club.name}” over to @${username}? You’ll become a regular member.`)) return;
                    await clubApi(`${base}/owner`, "POST", { username });
                    await backToClub(`@${username} now owns the club.`);
                }),
                clubAction("Remove from club", "secondary", async () => {
                    if (!window.confirm(`Remove @${username} from “${club.name}”?`)) return;
                    await clubApi(`${base}/members/${name}`, "DELETE");
                    await backToClub(`@${username} was removed from the club.`);
                })
            );
        } else if (status === "requested") {
            actions.append(
                clubAction("Let in", "primary", async () => {
                    await clubApi(`${base}/requests/${name}`, "PUT");
                    await renderClubDetail(club.id, username);
                    void loadClubs();
                }),
                clubAction("Decline request", "secondary", async () => {
                    await clubApi(`${base}/members/${name}`, "DELETE");
                    await backToClub(`Declined @${username}’s request.`);
                })
            );
        } else {
            actions.append(clubAction("Cancel invitation", "secondary", async () => {
                await clubApi(`${base}/members/${name}`, "DELETE");
                await backToClub(`Invitation to @${username} cancelled.`);
            }));
        }
    }

    async function showClubs(id = null, memberName = null) {
        if (!requireSignIn("Sign in to visit your clubs.")) return;
        showView("clubs");
        hideNotice(byId("clubs-notice"));
        openClubId = id;
        openClubMember = memberName;
        byId("club-detail").hidden = !id || Boolean(memberName);
        byId("club-member").hidden = !memberName;
        byId("clubs-list-view").hidden = Boolean(id);
        if (id) {
            await renderClubDetail(id, memberName);
        } else {
            byId("club-search-panel").hidden = true;
            renderClubList(await loadClubs());
        }
    }

    async function refreshClubs() {
        const data = await loadClubs();
        if (byId("clubs-view").hidden) return;
        if (openClubId) await renderClubDetail(openClubId, openClubMember);
        else renderClubList(data);
    }

    function bindClubs() {
        byId("nav-clubs").addEventListener("click", () => go("/clubs"));
        bindSubmit(byId("club-form"), "Starting…", async (event, form) => {
            try {
                const { club } = await request("/clubs", {
                    method: "POST",
                    body: JSON.stringify({ name: form.elements.name.value })
                }, { authenticated: true });
                form.reset();
                await go(`/clubs/${club.id}`);
            } catch (error) {
                showNotice(byId("clubs-notice"), error.message, "error");
            }
        });
        bindSubmit(byId("club-search-form"), "Searching…", async (event, form) => {
            hideNotice(byId("clubs-notice"));
            try {
                const { clubs } = await request(`/clubs/search?q=${encodeURIComponent(form.elements.q.value.trim())}`, {}, { authenticated: true });
                byId("club-search-panel").hidden = false;
                const results = byId("club-search-results");
                results.replaceChildren(...clubs.map(clubRow));
                if (!clubs.length) results.append(emptyState("No public clubs by that name."));
            } catch (error) {
                showNotice(byId("clubs-notice"), error.message, "error");
            }
        });
        bindSubmit(byId("club-invite-form"), "Inviting…", async (event, form) => {
            hideNotice(byId("clubs-notice"));
            try {
                const { invited } = await request(`/clubs/${openClubId}/members`, {
                    method: "POST",
                    body: JSON.stringify({ username: form.elements.username.value })
                }, { authenticated: true });
                form.reset();
                await renderClubDetail(openClubId);
                showNotice(byId("clubs-notice"), `Invitation sent to @${invited}.`);
            } catch (error) {
                showNotice(byId("clubs-notice"), error.message, "error");
            }
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
        socket.on("clubs", () => void refreshClubs());
        socket.on("friends", () => {
            void loadConversations();
            if (!byId("players-view").hidden) void loadFriends();
            if (!byId("profile-view").hidden && profileName) void loadProfile(profileName);
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
        bindClubs();

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
