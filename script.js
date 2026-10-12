/* =====================================================================
   CAMS - script.js (homepage)
   Works with or without database.js: if DB is missing the page keeps its
   built-in text/images and login falls back to the default accounts
   (session cannot persist in that case, so we just go to the page).
   ===================================================================== */

/* ---------- safe DB access ---------- */
const HAS_DB = typeof window.DB !== "undefined";

const FALLBACK_ACCOUNTS = [
    { id: 1, email: "admin@cams.local", username: "ADMIN", password: "admin", status: "active", role: "admin" },
    { id: 2, email: "nurse@cams.local", username: "NURSE", password: "nurse", status: "active", role: "nurse" }
];

function findAccount(id, pw) {
    if (HAS_DB) return DB.login(id, pw);
    id = String(id || "").trim().toLowerCase();
    return FALLBACK_ACCOUNTS.find(function (a) {
        return (a.email.toLowerCase() === id || a.username.toLowerCase() === id) && a.password === pw;
    }) || null;
}

function accountByEmail(email) {
    email = String(email || "").trim().toLowerCase();
    if (!email || !HAS_DB) return null;
    return DB.getAccounts().find(function (a) { return String(a.email).toLowerCase() === email; }) || null;
}

function setMsg(id, text, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("ok", !!ok);
}

/* ---------- modal helpers ---------- */
function showModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add("show");
    m.setAttribute("aria-hidden", "false");
}

function hideModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove("show");
    m.setAttribute("aria-hidden", "true");
}

function login() {
    setMsg("loginError", "");
    showModal("loginModal");
    const first = document.getElementById("email");
    if (first) first.focus();
}

function closeLogin() {
    hideModal("loginModal");
    hideModal("forgotModal");
    hideModal("renewModal");
}

function showForgotPassword() {
    hideModal("loginModal");
    hideModal("renewModal");
    setMsg("forgotError", "");
    showModal("forgotModal");
}

function showLoginAgain() {
    hideModal("forgotModal");
    hideModal("renewModal");
    showModal("loginModal");
}

let resetAccountId = null;

function showRenewPassword() {
    const emailInput = document.getElementById("forgotEmail");
    const email = emailInput ? emailInput.value.trim() : "";

    if (!email) {
        setMsg("forgotError", "Please enter your email address.");
        return;
    }

    const acct = accountByEmail(email);
    if (HAS_DB && !acct) {
        setMsg("forgotError", "No account found with that email.");
        return;
    }
    if (acct && acct.status !== "active") {
        setMsg("forgotError", "This account is inactive. Contact the site administrator.");
        return;
    }

    resetAccountId = acct ? acct.id : null;
    setMsg("forgotError", "");
    setMsg("renewError", "");
    hideModal("forgotModal");
    showModal("renewModal");
}

function finishRenewPassword() {
    const p1 = document.getElementById("newPassword").value;
    const p2 = document.getElementById("confirmPassword").value;

    if (!p1 || !p2) { setMsg("renewError", "Please fill out both fields."); return; }
    if (p1 !== p2) { setMsg("renewError", "Passwords do not match."); return; }

    if (HAS_DB && resetAccountId !== null) {
        const list = DB.getAccounts();
        const a = list.find(function (x) { return x.id === resetAccountId; });
        if (a) { a.password = p1; DB.saveAccounts(list); }
    }

    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
    resetAccountId = null;
    setMsg("renewError", "");
    closeLogin();
    alert("Password updated. You can now log in.");
    login();
}

/* ---------- overlay click closes ---------- */
["loginModal", "forgotModal", "renewModal"].forEach(function (id) {
    const m = document.getElementById(id);
    if (m) {
        m.addEventListener("click", function (event) {
            if (event.target === m) closeLogin();
        });
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeLogin();
});

/* ---------- login submit ---------- */
const loginForm = document.querySelector(".login-form");
if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const id = document.getElementById("email").value.trim();
        const pw = document.getElementById("password").value;

        if (!id || !pw) {
            setMsg("loginError", "Enter your email/username and password.");
            return;
        }

        const acct = findAccount(id, pw);

        if (!acct) {
            setMsg("loginError", "Incorrect email/username or password.");
            return;
        }

        if (acct.status !== "active") {
            setMsg("loginError", "This account is inactive. Contact the site administrator.");
            return;
        }

        if (HAS_DB) {
            DB.setSession({ id: acct.id, username: acct.username, email: acct.email, role: acct.role });
        }

        window.location.href = acct.role === "admin" ? "admin.html" : "records.html";
    });
}

/* ---------- show/hide password buttons ---------- */
function wireEye(buttonSelector, inputId) {
    const btn = document.querySelector(buttonSelector);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener("click", function () {
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        btn.textContent = visible ? "◉" : "◌";
        btn.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    });
}
wireEye(".eye-btn:not(.renew-eye):not(.renew-eye-confirm)", "password");
wireEye(".renew-eye", "newPassword");
wireEye(".renew-eye-confirm", "confirmPassword");

const forgotNext = document.getElementById("forgotNextBtn");
if (forgotNext) forgotNext.addEventListener("click", showRenewPassword);

/* ---------- service buttons ---------- */
document.querySelectorAll(".service-card").forEach(function (card) {
    card.addEventListener("click", function () {
        alert("You selected:\n\n" + card.innerText.trim() + "\n\nPlease log in to use this feature.");
    });
});

/* ---------- smooth-scroll navigation ---------- */
document.querySelectorAll(".nav a").forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        const section = document.querySelector(link.getAttribute("href"));
        if (section) section.scrollIntoView({ behavior: "smooth" });
    });
});

/* ---------- load site text + images from the database ---------- */
function loadSiteContent() {
    if (!HAS_DB) return; // keep the built-in defaults

    try {
        const site = DB.getSite();
        const map = { aboutText: "ABOUT", missionText: "MISSION", visionText: "VISION", commitmentText: "COMMITMENT" };
        Object.keys(map).forEach(function (elId) {
            const el = document.getElementById(elId);
            if (el && site[map[elId]]) el.textContent = site[map[elId]];
        });

        const imgs = DB.getImages();
        const imgMap = {
            orgChartImg: "ORGANIZATIONAL CHART",
            protocolImg1: "PHYSICAL HEALTH",
            protocolImg2: "PSYCHOLOGICAL REFERRAL PROTOCOL"
        };
        Object.keys(imgMap).forEach(function (elId) {
            const el = document.getElementById(elId);
            if (el && imgs[imgMap[elId]]) {
                el.src = imgs[imgMap[elId]];
                el.style.display = "";
            }
        });
    } catch (e) {
        console.warn("CAMS: could not load site content", e);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    loadSiteContent();
});
