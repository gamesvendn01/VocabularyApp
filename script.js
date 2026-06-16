let currentLanguage = "";
let vocabularies = [];
let filteredVocabs = [];
let flashcardIndex = 0;

const langSelect = document.getElementById("language-select");
const searchInput = document.getElementById("search-input");
const filterTopic = document.getElementById("filter-topic");
const filterType = document.getElementById("filter-type");
const filterDate = document.getElementById("filter-date");
const listContainer = document.getElementById("vocab-list");

const btnList = document.getElementById("btn-list");
const btnFlashcard = document.getElementById("btn-flashcard");
const viewList = document.getElementById("list-view");
const viewFlashcard = document.getElementById("flashcard-view");

// Fetch languages list
async function init() {
    try {
        let res = await fetch("data/index.json").catch(() => null);
        if (!res || !res.ok) {
            res = await fetch("../data/index.json").catch(() => null);
        }
        if (!res || !res.ok) throw new Error("Could not load index.json");
        const data = await res.json();
        
        langSelect.innerHTML = "";
        if (data.languages && data.languages.length > 0) {
            data.languages.forEach(lang => {
                const opt = document.createElement("option");
                opt.value = lang;
                opt.textContent = lang;
                langSelect.appendChild(opt);
            });
            loadLanguage(data.languages[0]);
        } else {
            langSelect.innerHTML = "<option>No languages found</option>";
        }
    } catch (e) {
        langSelect.innerHTML = "<option>Failed to load data</option>";
        console.error(e);
    }
}

async function loadLanguage(lang) {
    currentLanguage = lang;
    const filename = lang.toLowerCase().replace(/ /g, "_") + ".json";
    try {
        let res = await fetch(`data/${filename}`).catch(() => null);
        if (!res || !res.ok) {
            res = await fetch(`../data/${filename}`).catch(() => null);
        }
        if (!res || !res.ok) throw new Error("Could not load vocab data");
        const data = await res.json();
        vocabularies = data.vocabularies || [];
        
        populateFilters();
        applyFilters();
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = "<p>Error loading vocabulary data.</p>";
    }
}

function populateFilters() {
    const topics = new Set();
    const types = new Set();
    const dates = new Set();
    
    vocabularies.forEach(v => {
        if(v.topic) topics.add(v.topic);
        if(v.word_type) types.add(v.word_type);
        if(v.date_tag) dates.add(v.date_tag);
    });
    
    filterTopic.innerHTML = '<option value="">All Topics</option>' + Array.from(topics).map(t => `<option value="${t}">${t}</option>`).join("");
    filterType.innerHTML = '<option value="">All Types</option>' + Array.from(types).map(t => `<option value="${t}">${t}</option>`).join("");
    filterDate.innerHTML = '<option value="">All Dates</option>' + Array.from(dates).map(t => `<option value="${t}">${t}</option>`).join("");
}

function applyFilters() {
    const q = searchInput.value.toLowerCase();
    const tTopic = filterTopic.value;
    const tType = filterType.value;
    const tDate = filterDate.value;
    
    filteredVocabs = vocabularies.filter(v => {
        if (tTopic && v.topic !== tTopic) return false;
        if (tType && v.word_type !== tType) return false;
        if (tDate && v.date_tag !== tDate) return false;
        if (q) {
            const haystack = `${v.word} ${v.meaning} ${v.pronunciation}`.toLowerCase();
            if (!haystack.includes(q)) return false;
        }
        return true;
    });
    
    renderList();
    flashcardIndex = 0;
    renderFlashcard();
}

function renderList() {
    listContainer.innerHTML = "";
    if (filteredVocabs.length === 0) {
        listContainer.innerHTML = "<p>No vocabulary found matching filters.</p>";
        return;
    }
    
    filteredVocabs.forEach(v => {
        const item = document.createElement("div");
        item.className = "vocab-item";
        item.innerHTML = `
            <div class="vocab-header">
                <div>
                    <div class="vocab-word">${v.word}</div>
                    <div class="vocab-pronunciation">${v.pronunciation}</div>
                </div>
                ${v.word_type ? `<span class="badge">${v.word_type}</span>` : ""}
            </div>
            <div class="vocab-meaning">${v.meaning}</div>
            ${v.example ? `
            <div class="vocab-example">
                <div>${v.example}</div>
                <div class="vocab-example-meaning">${v.example_meaning}</div>
            </div>` : ""}
        `;
        listContainer.appendChild(item);
    });
}

// Flashcard logic
const fcCard = document.getElementById("flashcard");
const fcWord = document.getElementById("fc-word");
const fcPron = document.getElementById("fc-pronunciation");
const fcType = document.getElementById("fc-type");
const fcMean = document.getElementById("fc-meaning");
const fcEx = document.getElementById("fc-example");
const fcExMean = document.getElementById("fc-example-meaning");
const fcCounter = document.getElementById("fc-counter");
const fcAudioBox = document.getElementById("fc-audio-box");
const fcAudio = document.getElementById("fc-audio");
const btnPlayAudio = document.getElementById("btn-play-audio");

function renderFlashcard() {
    fcCard.classList.remove("is-flipped");
    if (filteredVocabs.length === 0) {
        fcWord.textContent = "No cards";
        fcPron.textContent = "";
        fcType.textContent = "";
        fcMean.textContent = "Try changing filters";
        fcEx.textContent = "";
        fcExMean.textContent = "";
        fcCounter.textContent = "0 / 0";
        fcAudioBox.style.display = "none";
        return;
    }
    
    const v = filteredVocabs[flashcardIndex];
    fcWord.textContent = v.word;
    fcPron.textContent = v.pronunciation;
    fcType.textContent = v.word_type || "No type";
    
    fcMean.textContent = v.meaning;
    fcEx.textContent = v.example || "No example provided.";
    fcExMean.textContent = v.example_meaning || "";
    
    fcCounter.textContent = `${flashcardIndex + 1} / ${filteredVocabs.length}`;

    if (v.mp3_gdrive_id) {
        fcAudioBox.style.display = "block";
        // To play audio from gdrive, we use google apis or just drive link.
        // Google Drive direct link for audio:
        fcAudio.src = `https://docs.google.com/uc?export=download&id=${v.mp3_gdrive_id}`;
    } else {
        fcAudioBox.style.display = "none";
        fcAudio.src = "";
    }
}

document.getElementById("btn-flip").addEventListener("click", () => {
    fcCard.classList.toggle("is-flipped");
});

fcCard.addEventListener("click", () => {
    fcCard.classList.toggle("is-flipped");
});

document.getElementById("btn-prev").addEventListener("click", () => {
    if (flashcardIndex > 0) {
        flashcardIndex--;
        renderFlashcard();
    }
});

document.getElementById("btn-next").addEventListener("click", () => {
    if (flashcardIndex < filteredVocabs.length - 1) {
        flashcardIndex++;
        renderFlashcard();
    }
});

btnPlayAudio.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent card flip
    fcAudio.play();
});

// Event Listeners
langSelect.addEventListener("change", (e) => loadLanguage(e.target.value));
searchInput.addEventListener("input", applyFilters);
filterTopic.addEventListener("change", applyFilters);
filterType.addEventListener("change", applyFilters);
filterDate.addEventListener("change", applyFilters);

btnList.addEventListener("click", () => {
    btnList.classList.add("active");
    btnFlashcard.classList.remove("active");
    viewList.classList.add("active");
    viewFlashcard.classList.remove("active");
});

btnFlashcard.addEventListener("click", () => {
    btnFlashcard.classList.add("active");
    btnList.classList.remove("active");
    viewFlashcard.classList.add("active");
    viewList.classList.remove("active");
    renderFlashcard(); // re-render to ensure it's at correct index
});

// Init
init();
