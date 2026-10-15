(async () => {
    const set = (id, text) => { document.getElementById(id).textContent = text; };
    const token = new URLSearchParams(window.location.search).get("token");

    const show = (mark, eyebrow, title, copy) => {
        set("verify-mark", mark);
        set("verify-eyebrow", eyebrow);
        set("verify-title", title);
        set("verify-copy", copy);
    };

    if (!token) {
        show("♠", "NO INVITATION", "This link is missing something.", "Open the verification link from your email again, or request a new one from your account.");
        return;
    }

    try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Verification failed");
        show("♥", "YOU’RE ON THE LIST", "Email verified successfully!", "You can close this tab and head back to the table.");
    } catch (error) {
        show("♠", "NO LUCK", "We couldn’t verify that link.", `${error.message}. Sign in and request a fresh verification email from your Overview page.`);
    }
})();
