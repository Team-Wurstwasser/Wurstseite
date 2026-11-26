const API_BASE = "https://api.pi.delivery/v1/pi";

const modeButtons = document.querySelectorAll(".pi-mode-btn");
const modePanels = {
    scroll: document.getElementById("mode-scroll"),
    lookup: document.getElementById("mode-lookup"),
    search: document.getElementById("mode-search")
};

let currentMode = "scroll";

function setMode(mode) {
    currentMode = mode;

    modeButtons.forEach((btn) => {
        const isActive = btn.dataset.mode === mode;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", String(isActive));
    });

    Object.entries(modePanels).forEach(([key, panel]) => {
        if (panel) panel.hidden = key !== mode;
    });

    if (currentMode === "scroll") {
        checkAutoFill();
    }
}

modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

const display = document.getElementById("pi-display");
const batchSize = 500;
let currentDigit = 0;
let isLoadingScroll = false;

async function fetchPi() {
    if (isLoadingScroll || !display) return;
    isLoadingScroll = true;

    try {
        const response = await fetch(`${API_BASE}?start=${currentDigit}&numberOfDigits=${batchSize}`);
        if (!response.ok) throw new Error("API-Fehler");

        const data = await response.json();

        if (data.content) {
            let content = data.content;

            if (currentDigit === 0 && content.startsWith("3")) {
                content = "3." + content.substring(1);
            }

            const textNode = document.createTextNode(content);
            display.appendChild(textNode);

            currentDigit += batchSize;
        }
    } catch (error) {
        console.error("Pi-Fehler:", error);
    } finally {
        isLoadingScroll = false;
        if (currentMode === "scroll") {
            checkAutoFill();
        }
    }
}

function checkAutoFill() {
    if (currentMode !== "scroll" || !display) return;
    const rect = display.getBoundingClientRect();

    if (rect.bottom < window.innerHeight + 1000) {
        fetchPi();
    }
}

window.addEventListener("scroll", checkAutoFill);
fetchPi();

const lookupForm = document.getElementById("lookup-form");
const lookupPosInput = document.getElementById("lookup-pos");
const lookupCountSelect = document.getElementById("lookup-count");
const lookupResult = document.getElementById("lookup-result");
const lookupBtn = document.getElementById("lookup-btn");

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

lookupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pos = Math.max(1, Math.floor(Number(lookupPosInput.value)));
    const count = Number(lookupCountSelect.value);
    const start = pos;

    lookupBtn.disabled = true;
    lookupResult.textContent = "Frage API ab…";

    try {
        const res = await fetch(`${API_BASE}?start=${encodeURIComponent(start)}&numberOfDigits=${encodeURIComponent(count)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        lookupResult.innerHTML =
            `<strong>Nachkommastelle ${pos.toLocaleString("de-DE")} bis ${(pos + count - 1).toLocaleString("de-DE")}:</strong><br>` +
            `<span>${escapeHtml(data.content)}</span>`;
    } catch (err) {
        lookupResult.textContent = `Fehler beim Abrufen: ${err.message}`;
    } finally {
        lookupBtn.disabled = false;
    }
});

const STATIC_FILES = {
    1_000_000: "/random-stuff/pi/decimals/pi-1m.txt",
    10_000_000: "/random-stuff/pi/decimals/pi-10m.txt",
    100_000_000: "/random-stuff/pi/decimals/pi-100m.txt"
};

const SCOPE_100M = 100_000_000;
const UNLOCK_CODE = "42";

let ramDigits = "";
let ramLoadedScope = 0;
let is100mUnlocked = false;

const searchForm = document.getElementById("search-form");
const searchScopeSelect = document.getElementById("search-scope");
const searchQueryInput = document.getElementById("search-query");
const searchBtn = document.getElementById("search-btn");
const mobileWarning = document.getElementById("mobile-warning");
const passwordBox = document.getElementById("password-box");
const scopePasswordInput = document.getElementById("scope-password");
const unlockBtn = document.getElementById("unlock-btn");
const passwordFeedback = document.getElementById("password-feedback");
const progressWrap = document.getElementById("progress-wrap");
const loadProgress = document.getElementById("load-progress");
const progressText = document.getElementById("progress-text");
const searchStatus = document.getElementById("search-status");
const searchResultsList = document.getElementById("search-results");

function updateScopeUI() {
    const selectedScope = Number(searchScopeSelect.value);

    if (mobileWarning) {
        mobileWarning.hidden = selectedScope !== 10_000_000;
    }

    if (passwordBox) {
        passwordBox.hidden = !(selectedScope === SCOPE_100M && !is100mUnlocked);
    }

    if (!searchStatus) return;

    if (ramLoadedScope >= selectedScope) {
        searchStatus.textContent =
            `Bereit im RAM: ${(selectedScope / 1_000_000).toFixed(0)}M Stellen geladen.`;
    } else if (selectedScope === SCOPE_100M && !is100mUnlocked) {
        searchStatus.textContent = "100M ist passwortgeschützt.";
    } else {
        searchStatus.textContent =
            `Ausgewählt: ${(selectedScope / 1_000_000).toFixed(0)}M Stellen (wird erst beim Suchen in den RAM geladen).`;
    }
}

function tryUnlock100m() {
    const entered = scopePasswordInput?.value.trim() ?? "";
    if (entered === UNLOCK_CODE) {
        is100mUnlocked = true;
        if (scopePasswordInput) scopePasswordInput.value = "";
        if (passwordFeedback) passwordFeedback.textContent = "";
        if (passwordBox) passwordBox.hidden = true;
        updateScopeUI();
        return true;
    }

    is100mUnlocked = false;
    if (passwordFeedback) passwordFeedback.textContent = "Falsch";
    return false;
}

unlockBtn?.addEventListener("click", tryUnlock100m);

scopePasswordInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        tryUnlock100m();
    }
});

searchScopeSelect?.addEventListener("change", updateScopeUI);
updateScopeUI();

async function downloadStaticDigits(scope) {
    const fileUrl = STATIC_FILES[scope];
    if (!fileUrl) throw new Error("Ungültiger Suchbereich.");

    if (progressWrap) progressWrap.hidden = false;
    if (loadProgress) {
        loadProgress.max = scope;
        loadProgress.value = 0;
    }
    if (progressText) progressText.textContent = `Lade ${(scope / 1_000_000).toFixed(0)}M-Datei…`;

    if (searchBtn) searchBtn.disabled = true;
    if (searchScopeSelect) searchScopeSelect.disabled = true;

    try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} beim Laden von ${fileUrl}`);

        if (!res.body) {
            const fullText = (await res.text()).replace(/\s+/g, "");
            if (loadProgress) loadProgress.value = Math.min(scope, fullText.length);
            if (progressText) progressText.textContent = `${Math.min(scope, fullText.length).toLocaleString("de-DE")} Stellen geladen`;
            return fullText;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        let receivedChars = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const part = decoder.decode(value, { stream: true }).replace(/\s+/g, "");
            if (part) {
                chunks.push(part);
                receivedChars += part.length;
                if (loadProgress) loadProgress.value = Math.min(scope, receivedChars);
                if (progressText) {
                    progressText.textContent = `${Math.min(scope, receivedChars).toLocaleString("de-DE")} Stellen geladen`;
                }
            }
        }

        const tail = decoder.decode().replace(/\s+/g, "");
        if (tail) chunks.push(tail);

        return chunks.join("");
    } finally {
        if (searchBtn) searchBtn.disabled = false;
        if (searchScopeSelect) searchScopeSelect.disabled = false;
    }
}

function findMatchesInString(haystack, needle, maxDisplay = 25) {
    const matches = [];
    let totalCount = 0;
    let idx = haystack.indexOf(needle);

    while (idx !== -1) {
        totalCount++;
        if (matches.length < maxDisplay) {
            matches.push(idx);
        }
        idx = haystack.indexOf(needle, idx + 1);
    }

    return { matches, totalCount };
}

function renderSearchResults(digits, query, targetScope, matches, totalCount) {
    if (!searchResultsList || !searchStatus) return;
    searchResultsList.innerHTML = "";

    if (totalCount === 0) {
        searchStatus.textContent =
            `Keine Treffer für „${query}“ in ${(targetScope / 1_000_000).toFixed(0)}M (${digits.length.toLocaleString("de-DE")} Zeichen).`;
        return;
    }

    const note = totalCount > matches.length ? ` (erste ${matches.length} Treffer angezeigt)` : "";
    searchStatus.textContent =
        `${totalCount.toLocaleString("de-DE")} Treffer für „${query}“ in ${(targetScope / 1_000_000).toFixed(0)}M${note}:`;

    const radius = 12;

    for (const zeroIdx of matches) {
        const humanPos = zeroIdx + 1;
        const startCtx = Math.max(0, zeroIdx - radius);
        const endCtx = Math.min(digits.length, zeroIdx + query.length + radius);

        const before = escapeHtml(digits.slice(startCtx, zeroIdx));
        const hit = escapeHtml(digits.slice(zeroIdx, zeroIdx + query.length));
        const after = escapeHtml(digits.slice(zeroIdx + query.length, endCtx));

        const li = document.createElement("li");
        li.className = "pi-match-item";
        li.innerHTML =
            `<strong>Position ${humanPos.toLocaleString("de-DE")}:</strong> ` +
            `${startCtx > 0 ? "…" : ""}${before}` +
            `<span class="pi-highlight">${hit}</span>` +
            `${after}${endCtx < digits.length ? "…" : ""}`;

        searchResultsList.appendChild(li);
    }
}

searchForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const query = searchQueryInput?.value.trim() ?? "";
    const targetScope = Number(searchScopeSelect?.value ?? 1_000_000);

    if (!/^\d+$/.test(query)) {
        if (searchStatus) searchStatus.textContent = "Bitte nur gültige Ziffern (0–9) eingeben.";
        return;
    }

    if (targetScope === SCOPE_100M && !is100mUnlocked) {
        if (!tryUnlock100m()) {
            if (searchStatus) searchStatus.textContent = "Zugriff auf 100M verweigert – bitte Passwort eingeben.";
            return;
        }
    }

    try {
        if (ramLoadedScope !== targetScope) {
            if (searchStatus) {
                searchStatus.textContent = `Lade ${(targetScope / 1_000_000).toFixed(0)}M-Datei in den Arbeitsspeicher…`;
            }
            ramDigits = await downloadStaticDigits(targetScope);
            ramLoadedScope = targetScope;
        }

        const { matches, totalCount } = findMatchesInString(ramDigits, query, 25);
        renderSearchResults(ramDigits, query, targetScope, matches, totalCount);
    } catch (err) {
        if (searchStatus) searchStatus.textContent = `Fehler beim Laden: ${err.message}`;
    }
});