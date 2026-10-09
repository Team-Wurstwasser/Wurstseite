(() => {
    "use strict";

    const API_BASE = "https://sigastra.com/api/v1";
    const LANGUAGE = "de";

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
    const status = document.querySelector("#horoscope-status");
    const heading = document.querySelector("#result-heading");
    const periodLabel = document.querySelector("#result-period");
    const dateLabel = document.querySelector("#result-date");
    const copy = document.querySelector("#result-copy");
    const sections = document.querySelector("#result-sections");
    const attribution = document.querySelector("#api-attribution");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const sign = form.elements.sign.value;
        const period = form.elements.period.value;
        console.log(period);
        if (!signNames[sign] || !periodNames[period]) {
            showStatus("Bitte wähle ein Sternzeichen und einen Zeitraum aus.", "error");
            return;
        }

        const params = new URLSearchParams({ lang: LANGUAGE, sign, full: "1" });
        const url = `${API_BASE}/${period}?${params.toString()}`;

        setLoading(true);
        showStatus("Dein Horoskop wird aus den Sternen gelesen …", "loading");
        result.hidden = true;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error("Die API wurde gerade zu häufig abgefragt. Bitte warte kurz und versuche es erneut.");
                }
                throw new Error(`Die Horoskop-API antwortet mit Fehler ${response.status}. Bitte versuche es später erneut.`);
            }

            const data = await response.json();
            const item = findHoroscopeItem(data, sign);

            if (!item) {
                throw new Error("Für dieses Sternzeichen wurde kein Horoskop zurückgegeben.");
            }

            renderHoroscope(item, data, sign, period);
            status.hidden = true;
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

    function findHoroscopeItem(data, selectedSign) {
        if (Array.isArray(data?.items)) {
            return data.items.find(item =>
                String(item.sign || item.slug || item.key || "").toLowerCase() === selectedSign
            ) || data.items[0] || null;
        }
        if (data?.item && typeof data.item === "object") return data.item;
        if (data && (data.text || data.teaser || data.title || data.sections)) return data;
        return null;
    }

    function renderHoroscope(item, data, sign, period) {
        heading.textContent = item.title || `Horoskop für ${signNames[sign]}`;
        periodLabel.textContent = periodNames[period];
        dateLabel.textContent = item.rangeLabel || item.range_label || item.dateLabel || item.date || "";
        copy.replaceChildren();


        const body = item.text || item.fullText || item.full_text || item.teaser || item.summary || "";
        if(period == "daily"){
            appendTextAsParagraphs(copy, body || "Für diesen Zeitraum liegt kein Text vor.");
        }

        sections.replaceChildren();
        const sectionData = item.sections;
        if (sectionData && typeof sectionData === "object") {
            Object.entries(sectionData).forEach(([key, value]) => {
                const textValue = extractText(value);
                if (!textValue) return;
                const card = document.createElement("article");
                card.className = "result-section";
                const title = document.createElement("h3");
                title.textContent = humanize(key);
                const paragraph = document.createElement("p");
                paragraph.textContent = textValue;
                card.append(title, paragraph);
                sections.append(card);
            });
        }

        renderAttribution(data?.attribution);
        updateCanonical(data?.attribution);
    }

    function appendTextAsParagraphs(container, value) {
        const text = typeof value === "string" ? value : extractText(value);
        text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean).forEach(part => {
            const p = document.createElement("p");
            p.textContent = part;
            container.append(p);
        });
    }

    function extractText(value) {
        if (typeof value === "string" || typeof value === "number") return String(value);
        if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join(" ");
        if (value && typeof value === "object") {
            return String(value.text || value.body || value.content || value.description || "");
        }
        return "";
    }

    function humanize(value) {
        return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function renderAttribution(info) {
        attribution.replaceChildren();
        const link = document.createElement("a");
        link.href = info?.localizedHref || info?.localized_href || "https://sigastra.com/de/partners/api";
        link.textContent = info?.text || "Powered by Sigastra";
        link.target = "_blank";
        link.rel = "noopener";
        attribution.append(document.createTextNode("Horoskopdaten: "), link);
    }

    function updateCanonical(info) {
        // Sigastra requires its returned canonical tag when publishing full=1 text.
        // Accept either a canonicalTag HTML string or an explicit canonical URL.
        const tag = info?.canonicalTag || info?.canonical_tag;
        const explicitUrl = info?.canonicalUrl || info?.canonical_url;
        let canonicalUrl = explicitUrl || "";

        if (!canonicalUrl && typeof tag === "string") {
            const match = tag.match(/href\s*=\s*["']([^"']+)["']/i);
            if (match) canonicalUrl = match[1];
        }

        if (canonicalUrl) {
            let link = document.querySelector('link[rel="canonical"]');
            if (!link) {
                link = document.createElement("link");
                link.rel = "canonical";
                document.head.append(link);
            }
            link.href = canonicalUrl;
        }
    }

    function showStatus(message, kind) {
        status.textContent = message;
        status.className = `horoscope-status ${kind === "error" ? "is-error" : "is-loading"}`;
        status.hidden = false;
    }

    function setLoading(loading) {
        submitButton.disabled = loading;
        submitButton.innerHTML = loading
            ? '<span aria-hidden="true">✦</span> Horoskop wird geladen …'
            : '<span aria-hidden="true">✦</span> Horoskop anzeigen';
        submitButton.setAttribute("aria-busy", String(loading));
    }
})();
