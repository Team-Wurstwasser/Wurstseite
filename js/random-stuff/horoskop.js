const API_BASE = "https://freehoroscopeapi.com/api/v1/get-horoscope";

const GOOGLE_URL = "https://translate.googleapis.com/translate_a/single";

const signNames = {
    aries: "Widder", taurus: "Stier", gemini: "Zwillinge",
    cancer: "Krebs", leo: "Löwe", virgo: "Jungfrau",
    libra: "Waage", scorpio: "Skorpion", sagittarius: "Schütze",
    capricorn: "Steinbock", aquarius: "Wassermann", pisces: "Fische"
};

const periodNames = {
    daily: "Tageshoroskop",
    weekly: "Wochenhoroskop",
    monthly: "Monatshoroskop"
};

const form = document.querySelector("#horoscope-form");
const submitButton = document.querySelector("#horoscope-submit");
const result = document.querySelector("#horoscope-result");
const statusBox = document.querySelector("#horoscope-status");
const heading = document.querySelector("#result-heading");
const periodLabel = document.querySelector("#result-period");
const dateLabel = document.querySelector("#result-date");
const copy = document.querySelector("#result-copy");
const sections = document.querySelector("#result-sections");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const sign = form.elements.sign.value;
    const period = form.elements.period.value;
    if (!signNames[sign] || !periodNames[period]) {
        showStatus("Bitte wähle ein Sternzeichen und einen Zeitraum aus.", "error");
        return;
    }

    setLoading(true);
    showStatus("Dein Horoskop wird aus den Sternen gelesen …", "loading");
    result.hidden = true;

    try {
        const data = await fetchHoroscope(sign, period);
        const english = extractText(data?.data?.horoscope ?? data?.horoscope);
        if (!english) throw new Error("Für dieses Sternzeichen wurde kein Horoskop zurückgegeben.");

        const german = await translateToGerman(english);
        const entry = {
            text: german || english,
            range: formatRange(data?.data?.date ?? data?.date, period)
        };

        render(entry, sign, period);
        statusBox.hidden = true;
        result.hidden = false;
    } catch (error) {
        console.error("Horoskop konnte nicht geladen werden:", error);
        showStatus(error instanceof TypeError
            ? "Die Verbindung zur Horoskop-API ist fehlgeschlagen. Prüfe deine Internetverbindung und versuche es erneut."
            : (error.message || "Das Horoskop konnte nicht geladen werden."), "error");
    } finally {
        setLoading(false);
    }
});

async function fetchHoroscope(sign, period) {
    const response = await fetch(`${API_BASE}/${period}?${new URLSearchParams({ sign })}`, {
        headers: { "Accept": "application/json" }
    });
    if (!response.ok) {
        if (response.status === 429) {
            throw new Error("Die API wurde gerade zu häufig abgefragt. Bitte warte kurz und versuche es erneut.");
        }
        throw new Error(`Die Horoskop-API antwortet mit Fehler ${response.status}. Bitte versuche es später erneut.`);
    }
    return response.json();
}

function extractText(value) {
    if (typeof value === "string" || typeof value === "number") return String(value).trim();
    if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(" ");
    if (value && typeof value === "object") {
        return String(value.text || value.body || value.content || value.description || "").trim();
    }
    return "";
}

function formatRange(raw, period) {
    const text = typeof raw === "string" ? raw : "";
    const m = text.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
    if (m) {
        const date = new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1), 12));
        if (period === "monthly") {
            return date.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
        }
        const day = date.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
        return period === "weekly" ? `Woche ab ${day}` : day;
    }
    return "";
}

async function translateToGerman(text) {
    try {
        return await translateGoogle(text);
    } catch (error) {
        console.warn("Übersetzung fehlgeschlagen, zeige Originaltext:", error);
        return null;
    }
}

async function translateGoogle(text) {
    const params = new URLSearchParams({ client: "gtx", sl: "en", tl: "de", dt: "t", q: text });
    const response = await fetch(`${GOOGLE_URL}?${params}`);
    if (!response.ok) throw new Error(`Google ${response.status}`);
    const json = await response.json();
    const out = (json?.[0] || []).map(part => part?.[0] || "").join("").trim();
    if (!out) throw new Error("Leere Übersetzung");
    return out;
}

function render(entry, sign, period) {
    heading.textContent = `${signNames[sign]} – ${periodNames[period]}`;
    periodLabel.textContent = periodNames[period];
    dateLabel.textContent = entry.range || "";

    copy.replaceChildren();
    entry.text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).forEach(part => {
        const p = document.createElement("p");
        p.textContent = part;
        copy.append(p);
    });
    sections.replaceChildren();
}

function showStatus(message, kind) {
    statusBox.textContent = message;
    statusBox.className = `horoscope-status ${kind === "error" ? "is-error" : "is-loading"}`;
    statusBox.hidden = false;
}

function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.innerHTML = loading
        ? '<span aria-hidden="true">✦</span> Horoskop wird geladen …'
        : '<span aria-hidden="true">✦</span> Horoskop anzeigen';
    submitButton.setAttribute("aria-busy", String(loading));
}