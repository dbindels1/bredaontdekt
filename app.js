import { db } from "../firebase-config.js";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// State in geheugen
let state = {
    categorieen: [],
    secties: [],
    oefeningen: [],
    lesplannen: [],
    actieveCategorieId: null,
    actieveView: "bibliotheek" // 'bibliotheek' of 'lesplannen'
};

// DOM-referenties
const loadingEl = document.getElementById("loading-indicator");
const navLijstEl = document.getElementById("categorie-nav-lijst");
const sectiesContainerEl = document.getElementById("secties-container");
const lesplannenContainerEl = document.getElementById("lesplannen-lijst-container");

// =========================================================
// INITIALISATIE & DATA LADEN
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
    koppelEventListeners();
    await laadAlleData();
});

async function laadAlleData() {
    loadingEl.classList.remove("hidden");
    try {
        const [catSnap, secSnap, oefSnap, lpSnap] = await Promise.all([
            getDocs(collection(db, "categorieen")),
            getDocs(collection(db, "secties")),
            getDocs(collection(db, "oefeningen")),
            getDocs(collection(db, "lesplannen"))
        ]);

        state.categorieen = catSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999));

        state.secties = secSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999));

        state.oefeningen = oefSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        state.lesplannen = lpSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (!state.actieveCategorieId && state.categorieen.length > 0) {
            state.actieveCategorieId = state.categorieen[0].id;
        } else if (state.actieveCategorieId && !state.categorieen.some(c => c.id === state.actieveCategorieId)) {
            state.actieveCategorieId = state.categorieen.length > 0 ? state.categorieen[0].id : null;
        }

        renderAlles();
    } catch (error) {
        console.error("Fout bij laden uit Firestore:", error);
        alert("Kon gegevens niet ophalen uit Firebase. Controleer je internetverbinding en Firestore Rules.");
    } finally {
        loadingEl.classList.add("hidden");
    }
}

function renderAlles() {
    document.getElementById("lesplannen-count").textContent = state.lesplannen.length;
    renderNavigatie();
    if (state.actieveView === "bibliotheek") {
        renderBibliotheek();
    } else {
        renderLesplannen();
    }
}

// =========================================================
// NAVIGATIE & VIEWS
// =========================================================
function renderNavigatie() {
    navLijstEl.innerHTML = "";
    state.categorieen.forEach(cat => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.textContent = cat.naam;
        if (state.actieveView === "bibliotheek" && cat.id === state.actieveCategorieId) {
            a.classList.add("active");
        }
        a.addEventListener("click", () => {
            state.actieveCategorieId = cat.id;
            wisselView("bibliotheek");
        });
        li.appendChild(a);
        navLijstEl.appendChild(li);
    });

    const lpHeaderBtn = document.getElementById("btn-open-lesplannen");
    if (state.actieveView === "lesplannen") {
        lpHeaderBtn.classList.add("active-lesplannen");
    } else {
        lpHeaderBtn.classList.remove("active-lesplannen");
    }
}

function wisselView(viewNaam) {
    state.actieveView = viewNaam;
    document.getElementById("view-bibliotheek").classList.toggle("active-view", viewNaam === "bibliotheek");
    document.getElementById("view-lesplannen").classList.toggle("active-view", viewNaam === "lesplannen");
    renderAlles();
}

// =========================================================
// WEERGAVE: CATEGORIEËN, SECTIES & OEFENINGEN
// =========================================================
function renderBibliotheek() {
    const headerBalk = document.getElementById("categorie-header-balk");
    const leegMelding = document.getElementById("geen-categorieen-melding");
    sectiesContainerEl.innerHTML = "";

    const actieveCat = state.categorieen.find(c => c.id === state.actieveCategorieId);
    if (!actieveCat) {
        headerBalk.classList.add("hidden");
        leegMelding.classList.remove("hidden");
        return;
    }

    headerBalk.classList.remove("hidden");
    leegMelding.classList.add("hidden");

    const kleur = actieveCat.kleur || "paars";
    const badgeEl = document.getElementById("actieve-cat-badge");
    badgeEl.textContent = "Categorie";
    badgeEl.className = `badge theme-${kleur}`;
    document.getElementById("actieve-cat-titel").textContent = actieveCat.naam;

    const catSecties = state.secties.filter(s => s.categorieId === actieveCat.id);

    if (catSecties.length === 0) {
        sectiesContainerEl.innerHTML = `
            <div class="intro-section">
                <p>Er zijn nog geen secties binnen <strong>${escapeHtml(actieveCat.naam)}</strong>. Klik hierboven op <strong>+ Sectie toevoegen</strong>.</p>
            </div>`;
        return;
    }

    catSecties.forEach(sectie => {
        const secEl = document.createElement("section");
        secEl.className = "category-section";

        const secOefeningen = state.oefeningen.filter(o => o.sectieId === sectie.id);

        secEl.innerHTML = `
            <div class="section-header-bar">
                <h3>${escapeHtml(sectie.naam)}</h3>
                <div class="crud-actions">
                    <button class="btn btn-primary btn-xs btn-add-oef" data-sec-id="${sectie.id}">+ Oefening</button>
                    <button class="btn btn-outline btn-xs btn-edit-sec" data-sec-id="${sectie.id}">✏️ Sectie</button>
                    <button class="btn btn-danger btn-xs btn-del-sec" data-sec-id="${sectie.id}">🗑️ Sectie</button>
                </div>
            </div>
            <div class="oefeningen-lijst"></div>
        `;

        const oefLijstEl = secEl.querySelector(".oefeningen-lijst");

        if (secOefeningen.length === 0) {
            oefLijstEl.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 12px;">Nog geen oefeningen in deze sectie.</p>`;
        } else {
            secOefeningen.forEach(oef => {
                const kaart = maakOefeningKaart(oef, kleur);
                oefLijstEl.appendChild(kaart);
            });
        }

        sectiesContainerEl.appendChild(secEl);
    });
}

function maakOefeningKaart(oef, kleur) {
    const card = document.createElement("div");
    card.className = `exercise-card border-${kleur}`;

    const duurHtml = oef.duur ? `<span class="ex-meta">${escapeHtml(oef.duur)}</span>` : "";

    card.innerHTML = `
        <div class="exercise-top-row">
            <div class="exercise-toggle-area">
                <span class="toggle-icon">+</span>
                <span class="ex-title">${escapeHtml(oef.titel)}</span>
                ${duurHtml}
            </div>
            <div class="crud-actions">
                <button class="btn btn-playlist btn-xs btn-to-lesplan" data-oef-id="${oef.id}">➕ Voeg toe aan lesplan</button>
                <button class="btn btn-outline btn-xs btn-edit-oef" data-oef-id="${oef.id}">✏️</button>
                <button class="btn btn-danger btn-xs btn-del-oef" data-oef-id="${oef.id}">🗑️</button>
            </div>
        </div>
        <div class="exercise-content">
            <ul>
                ${oef.doel ? `<li><strong>Doel:</strong> ${escapeHtml(oef.doel)}</li>` : ""}
                ${oef.materiaal ? `<li><strong>Materiaal:</strong> ${escapeHtml(oef.materiaal)}</li>` : ""}
                ${oef.uitleg ? `<li><strong>Uitleg:</strong> ${escapeHtml(oef.uitleg)}</li>` : ""}
                ${oef.reflectievraag ? `<li><strong>Reflectievraag:</strong> <em>${escapeHtml(oef.reflectievraag)}</em></li>` : ""}
                ${oef.bewustzijn ? `<li><strong>Bewustzijn:</strong> ${escapeHtml(oef.bewustzijn)}</li>` : ""}
                ${oef.afsluiting ? `<li><strong>Afsluiting:</strong> ${escapeHtml(oef.afsluiting)}</li>` : ""}
            </ul>
            ${oef.omschrijving ? `<div class="extra-omschrijving"><strong>Omschrijving / Extra info:</strong><br>${escapeHtml(oef.omschrijving)}</div>` : ""}
        </div>
    `;

    // In-/uitklappen
    const toggleArea = card.querySelector(".exercise-toggle-area");
    const icon = card.querySelector(".toggle-icon");
    toggleArea.addEventListener("click", () => {
        const isOpen = card.classList.toggle("is-open");
        icon.textContent = isOpen ? "−" : "+";
    });

    return card;
}

// =========================================================
// WEERGAVE: LESPLANNEN (VLC-AFSPEELLIJST STIJL)
// =========================================================
function renderLesplannen() {
    lesplannenContainerEl.innerHTML = "";

    if (state.lesplannen.length === 0) {
        lesplannenContainerEl.innerHTML = `
            <div class="intro-section">
                <p>Je hebt nog geen lesplannen aangemaakt. Klik op <strong>+ Nieuw Lesplan</strong> of voeg een oefening toe vanuit een categorie.</p>
            </div>`;
        return;
    }

    state.lesplannen.forEach(lp => {
        const card = document.createElement("article");
        card.className = "lesson-plan-card";

        const items = Array.isArray(lp.items) ? lp.items : [];

        let tabelHtml = "";
        if (items.length === 0) {
            tabelHtml = `<p style="color: var(--text-muted);">Dit lesplan is nog leeg. Ga naar een categorie en klik bij een oefening op <strong>➕ Voeg toe aan lesplan</strong>.</p>`;
        } else {
            const rijenHtml = items.map((item, index) => {
                // Haal actuele gegevens op uit state (zodat bewerkingen aan oefening direct doorwerken)
                const oef = state.oefeningen.find(o => o.id === item.oefeningId);
                const sec = oef ? state.secties.find(s => s.id === oef.sectieId) : null;
                const cat = oef ? state.categorieen.find(c => c.id === oef.categorieId) : null;

                const titel = oef ? oef.titel : (item.titel || "Verwijderde oefening");
                const sectieNaam = sec ? sec.naam : (item.sectieNaam || "-");
                const doelTekst = oef ? (oef.doel || "-") : (item.doel || "-");
                const kleur = cat ? (cat.kleur || "paars") : "paars";
                const catBadge = cat ? `<span class="badge theme-${kleur}">${escapeHtml(cat.naam)}</span> ` : "";

                return `
                    <tr>
                        <td><strong>${escapeHtml(item.lesfase || `${index + 1}.`)}</strong></td>
                        <td><strong>${escapeHtml(titel)}</strong></td>
                        <td>${catBadge}${escapeHtml(sectieNaam)}</td>
                        <td>${escapeHtml(doelTekst)}</td>
                        <td style="white-space: nowrap;">
                            <div class="order-controls">
                                <button class="btn btn-outline btn-xs btn-move-up" data-lp-id="${lp.id}" data-index="${index}" ${index === 0 ? "disabled" : ""} title="Omhoog">▲</button>
                                <button class="btn btn-outline btn-xs btn-move-down" data-lp-id="${lp.id}" data-index="${index}" ${index === items.length - 1 ? "disabled" : ""} title="Omlaag">▼</button>
                                <button class="btn btn-danger btn-xs btn-remove-lp-item" data-lp-id="${lp.id}" data-index="${index}" title="Verwijder uit lesplan">✖</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");

            tabelHtml = `
                <div class="table-responsive">
                    <table class="lesson-table">
                        <thead>
                            <tr>
                                <th>Lesfase</th>
                                <th>Onderdeel</th>
                                <th>Sectie</th>
                                <th>Doel</th>
                                <th>Volgorde / Actie</th>
                            </tr>
                        </thead>
                        <tbody>${rijenHtml}</tbody>
                    </table>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="lesson-header">
                <div>
                    <h3>${escapeHtml(lp.titel)}</h3>
                    ${lp.doel ? `<p><strong>Doel:</strong> ${escapeHtml(lp.doel)}</p>` : ""}
                </div>
                <div class="crud-actions">
                    <button class="btn btn-pdf btn-xs btn-export-pdf" data-lp-id="${lp.id}">📄 Opslaan als PDF</button>
                    <button class="btn btn-outline btn-xs btn-edit-lp" data-lp-id="${lp.id}">✏️ Bewerken</button>
                    <button class="btn btn-danger btn-xs btn-del-lp" data-lp-id="${lp.id}">🗑️ Verwijderen</button>
                </div>
            </div>
            ${tabelHtml}
        `;

        lesplannenContainerEl.appendChild(card);
    });
}

// =========================================================
// EVENT LISTENERS & CRUD HANDLERS
// =========================================================
function koppelEventListeners() {
    // Hoofdnavigatie wisselen tussen Bibliotheek en Lesplannen
    document.getElementById("btn-open-lesplannen").addEventListener("click", () => wisselView("lesplannen"));
    document.getElementById("btn-terug-bibliotheek").addEventListener("click", () => wisselView("bibliotheek"));

    // Modals sluiten
    document.querySelectorAll("[data-close]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById(btn.getAttribute("data-close")).classList.add("hidden");
        });
    });

    // --- CATEGORIE CRUD ---
    document.getElementById("btn-nieuwe-categorie").addEventListener("click", () => {
        document.getElementById("modal-categorie-titel").textContent = "Nieuwe Categorie";
        document.getElementById("cat-id").value = "";
        document.getElementById("cat-naam").value = "";
        document.querySelector('input[name="cat-kleur"][value="paars"]').checked = true;
        openModal("modal-categorie");
    });

    document.getElementById("btn-bewerk-categorie").addEventListener("click", () => {
        const cat = state.categorieen.find(c => c.id === state.actieveCategorieId);
        if (!cat) return;
        document.getElementById("modal-categorie-titel").textContent = "Categorie Bewerken";
        document.getElementById("cat-id").value = cat.id;
        document.getElementById("cat-naam").value = cat.naam;
        const radio = document.querySelector(`input[name="cat-kleur"][value="${cat.kleur || 'paars'}"]`);
        if (radio) radio.checked = true;
        openModal("modal-categorie");
    });

    document.getElementById("form-categorie").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("cat-id").value;
        const naam = document.getElementById("cat-naam").value.trim();
        const kleur = document.querySelector('input[name="cat-kleur"]:checked').value;

        if (id) {
            await updateDoc(doc(db, "categorieen", id), { naam, kleur });
        } else {
            const docRef = await addDoc(collection(db, "categorieen"), {
                naam,
                kleur,
                volgorde: state.categorieen.length + 1
            });
            state.actieveCategorieId = docRef.id;
        }
        sluitModal("modal-categorie");
        await laadAlleData();
    });

    document.getElementById("btn-verwijder-categorie").addEventListener("click", async () => {
        const cat = state.categorieen.find(c => c.id === state.actieveCategorieId);
        if (!cat) return;

        const bevestig = confirm(
            `WAARSCHUWING: Weet je zeker dat je de categorie "${cat.naam}" wilt verwijderen?\n\n` +
            `Alles wat hieronder staat (alle bijbehorende secties én alle oefeningen in deze categorie) wordt ook definitief verwijderd!`
        );
        if (!bevestig) return;

        // Verwijder onderliggende oefeningen en secties
        const teVerwijderenOef = state.oefeningen.filter(o => o.categorieId === cat.id);
        const teVerwijderenSec = state.secties.filter(s => s.categorieId === cat.id);

        await Promise.all([
            ...teVerwijderenOef.map(o => deleteDoc(doc(db, "oefeningen", o.id))),
            ...teVerwijderenSec.map(s => deleteDoc(doc(db, "secties", s.id))),
            deleteDoc(doc(db, "categorieen", cat.id))
        ]);

        state.actieveCategorieId = null;
        await laadAlleData();
    });

    // --- SECTIE & OEFENING DELEGATION ---
    document.getElementById("btn-nieuwe-sectie").addEventListener("click", () => {
        document.getElementById("modal-sectie-titel").textContent = "Nieuwe Sectie";
        document.getElementById("sec-id").value = "";
        document.getElementById("sec-cat-id").value = state.actieveCategorieId;
        document.getElementById("sec-naam").value = "";
        openModal("modal-sectie");
    });

    document.getElementById("form-sectie").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("sec-id").value;
        const categorieId = document.getElementById("sec-cat-id").value;
        const naam = document.getElementById("sec-naam").value.trim();

        if (id) {
            await updateDoc(doc(db, "secties", id), { naam });
        } else {
            await addDoc(collection(db, "secties"), {
                categorieId,
                naam,
                volgorde: state.secties.filter(s => s.categorieId === categorieId).length + 1
            });
        }
        sluitModal("modal-sectie");
        await laadAlleData();
    });

    sectiesContainerEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        // Sectie bewerken
        if (btn.classList.contains("btn-edit-sec")) {
            const sec = state.secties.find(s => s.id === btn.dataset.secId);
            if (!sec) return;
            document.getElementById("modal-sectie-titel").textContent = "Sectie Bewerken";
            document.getElementById("sec-id").value = sec.id;
            document.getElementById("sec-cat-id").value = sec.categorieId;
            document.getElementById("sec-naam").value = sec.naam;
            openModal("modal-sectie");
        }

        // Sectie verwijderen (met cascade waarschuwing)
        if (btn.classList.contains("btn-del-sec")) {
            const sec = state.secties.find(s => s.id === btn.dataset.secId);
            if (!sec) return;

            const bevestig = confirm(
                `WAARSCHUWING: Weet je zeker dat je de sectie "${sec.naam}" wilt verwijderen?\n\n` +
                `Alle oefeningen die onder deze sectie vallen, worden ook definitief verwijderd!`
            );
            if (!bevestig) return;

            const teVerwijderenOef = state.oefeningen.filter(o => o.sectieId === sec.id);
            await Promise.all([
                ...teVerwijderenOef.map(o => deleteDoc(doc(db, "oefeningen", o.id))),
                deleteDoc(doc(db, "secties", sec.id))
            ]);
            await laadAlleData();
        }

        // Nieuwe oefening in sectie
        if (btn.classList.contains("btn-add-oef")) {
            const sec = state.secties.find(s => s.id === btn.dataset.secId);
            if (!sec) return;
            document.getElementById("modal-oefening-titel").textContent = `Nieuwe oefening in "${sec.naam}"`;
            document.getElementById("form-oefening").reset();
            document.getElementById("oef-id").value = "";
            document.getElementById("oef-cat-id").value = sec.categorieId;
            document.getElementById("oef-sec-id").value = sec.id;
            openModal("modal-oefening");
        }

        // Oefening bewerken
        if (btn.classList.contains("btn-edit-oef")) {
            const oef = state.oefeningen.find(o => o.id === btn.dataset.oefId);
            if (!oef) return;
            document.getElementById("modal-oefening-titel").textContent = "Oefening Bewerken";
            document.getElementById("oef-id").value = oef.id;
            document.getElementById("oef-cat-id").value = oef.categorieId;
            document.getElementById("oef-sec-id").value = oef.sectieId;
            document.getElementById("oef-titel").value = oef.titel || "";
            document.getElementById("oef-duur").value = oef.duur || "";
            document.getElementById("oef-doel").value = oef.doel || "";
            document.getElementById("oef-materiaal").value = oef.materiaal || "";
            document.getElementById("oef-uitleg").value = oef.uitleg || "";
            document.getElementById("oef-reflectievraag").value = oef.reflectievraag || "";
            document.getElementById("oef-bewustzijn").value = oef.bewustzijn || "";
            document.getElementById("oef-afsluiting").value = oef.afsluiting || "";
            document.getElementById("oef-omschrijving").value = oef.omschrijving || "";
            openModal("modal-oefening");
        }

        // Oefening verwijderen
        if (btn.classList.contains("btn-del-oef")) {
            const oef = state.oefeningen.find(o => o.id === btn.dataset.oefId);
            if (!oef) return;
            if (!confirm(`Weet je zeker dat je de oefening "${oef.titel}" wilt verwijderen?`)) return;
            await deleteDoc(doc(db, "oefeningen", oef.id));
            await laadAlleData();
        }

        // Oefening toevoegen aan lesplan (VLC-stijl)
        if (btn.classList.contains("btn-to-lesplan")) {
            const oef = state.oefeningen.find(o => o.id === btn.dataset.oefId);
            if (!oef) return;
            openKoppelAanLesplanModal(oef);
        }
    });

    // Oefening opslaan
    document.getElementById("form-oefening").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("oef-id").value;
        const data = {
            categorieId: document.getElementById("oef-cat-id").value,
            sectieId: document.getElementById("oef-sec-id").value,
            titel: document.getElementById("oef-titel").value.trim(),
            duur: document.getElementById("oef-duur").value.trim(),
            doel: document.getElementById("oef-doel").value.trim(),
            materiaal: document.getElementById("oef-materiaal").value.trim(),
            uitleg: document.getElementById("oef-uitleg").value.trim(),
            reflectievraag: document.getElementById("oef-reflectievraag").value.trim(),
            bewustzijn: document.getElementById("oef-bewustzijn").value.trim(),
            afsluiting: document.getElementById("oef-afsluiting").value.trim(),
            omschrijving: document.getElementById("oef-omschrijving").value.trim()
        };

        if (id) {
            await updateDoc(doc(db, "oefeningen", id), data);
        } else {
            await addDoc(collection(db, "oefeningen"), data);
        }
        sluitModal("modal-oefening");
        await laadAlleData();
    });

    // --- KOPPELEN AAN LESPLAN (VLC MODAL) ---
    const selectLesplanEl = document.getElementById("kies-lesplan-select");
    const subformEl = document.getElementById("nieuw-lesplan-subform");
    const snelTitelEl = document.getElementById("snel-lesplan-titel");

    selectLesplanEl.addEventListener("change", () => {
        const isNieuw = selectLesplanEl.value === "__NIEUW__";
        subformEl.classList.toggle("hidden", !isNieuw);
        snelTitelEl.required = isNieuw;
    });

    document.getElementById("form-toevoegen-aan-lesplan").addEventListener("submit", async (e) => {
        e.preventDefault();
        const oefeningId = document.getElementById("koppel-oefening-id").value;
        const lesfase = document.getElementById("koppel-lesfase").value.trim();
        const oef = state.oefeningen.find(o => o.id === oefeningId);
        const sec = oef ? state.secties.find(s => s.id === oef.sectieId) : null;

        const nieuwItem = {
            oefeningId: oef.id,
            lesfase: lesfase,
            titel: oef.titel,
            sectieNaam: sec ? sec.naam : "",
            doel: oef.doel || ""
        };

        if (selectLesplanEl.value === "__NIEUW__") {
            const titel = snelTitelEl.value.trim();
            const doel = document.getElementById("snel-lesplan-doel").value.trim();
            await addDoc(collection(db, "lesplannen"), {
                titel,
                doel,
                items: [nieuwItem]
            });
        } else {
            const lpId = selectLesplanEl.value;
            const lp = state.lesplannen.find(l => l.id === lpId);
            if (!lp) return;
            const bijgewerkteItems = [...(lp.items || []), nieuwItem]; // Standaard onderaan
            await updateDoc(doc(db, "lesplannen", lpId), { items: bijgewerkteItems });
        }

        sluitModal("modal-toevoegen-aan-lesplan");
        await laadAlleData();
        alert(`"${oef.titel}" is onderaan het lesplan toegevoegd!`);
    });

    // --- LESPLANNEN BEHEER (VOLGORDE, BEWERKEN, VERWIJDEREN, PDF KNOP) ---
    document.getElementById("btn-nieuw-lesplan-hoofd").addEventListener("click", () => {
        document.getElementById("modal-lesplan-titel").textContent = "Nieuw Lesplan";
        document.getElementById("lp-id").value = "";
        document.getElementById("lp-titel").value = "";
        document.getElementById("lp-doel").value = "";
        openModal("modal-lesplan");
    });

    document.getElementById("form-lesplan").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("lp-id").value;
        const titel = document.getElementById("lp-titel").value.trim();
        const doel = document.getElementById("lp-doel").value.trim();

        if (id) {
            await updateDoc(doc(db, "lesplannen", id), { titel, doel });
        } else {
            await addDoc(collection(db, "lesplannen"), { titel, doel, items: [] });
        }
        sluitModal("modal-lesplan");
        await laadAlleData();
    });

    lesplannenContainerEl.addEventListener("click", async (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const lpId = btn.dataset.lpId;
        const lp = state.lesplannen.find(l => l.id === lpId);
        if (!lp) return;

        // Omhoog verplaatsen
        if (btn.classList.contains("btn-move-up")) {
            const idx = parseInt(btn.dataset.index, 10);
            if (idx <= 0) return;
            const items = [...lp.items];
            [items[idx - 1], items[idx]] = [items[idx], items[idx - 1]];
            await updateDoc(doc(db, "lesplannen", lpId), { items });
            await laadAlleData();
        }

        // Omlaag verplaatsen
        if (btn.classList.contains("btn-move-down")) {
            const idx = parseInt(btn.dataset.index, 10);
            if (idx >= lp.items.length - 1) return;
            const items = [...lp.items];
            [items[idx], items[idx + 1]] = [items[idx + 1], items[idx]];
            await updateDoc(doc(db, "lesplannen", lpId), { items });
            await laadAlleData();
        }

        // Oefening verwijderen uit lesplan
        if (btn.classList.contains("btn-remove-lp-item")) {
            const idx = parseInt(btn.dataset.index, 10);
            const items = lp.items.filter((_, i) => i !== idx);
            await updateDoc(doc(db, "lesplannen", lpId), { items });
            await laadAlleData();
        }

        // Lesplan bewerken
        if (btn.classList.contains("btn-edit-lp")) {
            document.getElementById("modal-lesplan-titel").textContent = "Lesplan Bewerken";
            document.getElementById("lp-id").value = lp.id;
            document.getElementById("lp-titel").value = lp.titel;
            document.getElementById("lp-doel").value = lp.doel || "";
            openModal("modal-lesplan");
        }

        // Lesplan verwijderen
        if (btn.classList.contains("btn-del-lp")) {
            if (!confirm(`Weet je zeker dat je het lesplan "${lp.titel}" wilt verwijderen?`)) return;
            await deleteDoc(doc(db, "lesplannen", lp.id));
            await laadAlleData();
        }

        // Placeholder voor toekomstige PDF-export
        if (btn.classList.contains("btn-export-pdf")) {
            alert(`PDF-export voor "${lp.titel}" staat klaar om in een volgende stap te worden gekoppeld.`);
        }
    });
}

function openKoppelAanLesplanModal(oef) {
    document.getElementById("koppel-oefening-id").value = oef.id;
    document.getElementById("koppel-oefening-naam").textContent = oef.titel;
    document.getElementById("koppel-lesfase").value = "";
    document.getElementById("snel-lesplan-titel").value = "";
    document.getElementById("snel-lesplan-doel").value = "";

    const selectEl = document.getElementById("kies-lesplan-select");
    selectEl.innerHTML = "";

    state.lesplannen.forEach(lp => {
        const opt = document.createElement("option");
        opt.value = lp.id;
        opt.textContent = lp.titel;
        selectEl.appendChild(opt);
    });

    const nieuwOpt = document.createElement("option");
    nieuwOpt.value = "__NIEUW__";
    nieuwOpt.textContent = "+ Nieuw lesplan aanmaken...";
    selectEl.appendChild(nieuwOpt);

    // Als er nog geen lesplannen zijn, selecteer direct "+ Nieuw lesplan"
    const subformEl = document.getElementById("nieuw-lesplan-subform");
    const snelTitelEl = document.getElementById("snel-lesplan-titel");
    if (state.lesplannen.length === 0) {
        selectEl.value = "__NIEUW__";
        subformEl.classList.remove("hidden");
        snelTitelEl.required = true;
    } else {
        selectEl.value = state.lesplannen[0].id;
        subformEl.classList.add("hidden");
        snelTitelEl.required = false;
    }

    openModal("modal-toevoegen-aan-lesplan");
}

function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
}

function sluitModal(id) {
    document.getElementById(id).classList.add("hidden");
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
