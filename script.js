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

// ─── Helper: escape HTML để an toàn khi dùng innerHTML ───────────────────────
function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── Cấu hình Marked.js để hỗ trợ Markdown Table và Line breaks ──────────────────
marked.setOptions({
    breaks: true,
    gfm: true
});

// ─── Helper: parse Markdown thay vì chỉ replace \n ───────────────────────────
function formatText(str) {
    if (!str) return "";
    return marked.parse(str);
}

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
    
    filterTopic.innerHTML = '<option value="">All Topics</option>' + Array.from(topics).map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    filterType.innerHTML  = '<option value="">All Types</option>'  + Array.from(types).map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    filterDate.innerHTML  = '<option value="">All Dates</option>'  + Array.from(dates).map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
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
        listContainer.innerHTML = "<p style='color:var(--text-muted);padding:20px;text-align:center;'>Không tìm thấy từ vựng nào phù hợp.</p>";
        return;
    }
    
    filteredVocabs.forEach((v, idx) => {
        const item = document.createElement("div");
        item.className = "vocab-item";

        const hasExample = v.example && v.example.trim() !== "";

        item.innerHTML = `
            <div class="vocab-header">
                <div>
                    <div class="vocab-word">${escapeHtml(v.word)}</div>
                    ${v.pronunciation ? `<div class="vocab-pronunciation">/${escapeHtml(v.pronunciation)}/</div>` : ""}
                </div>
                ${v.word_type ? `<span class="badge">${escapeHtml(v.word_type)}</span>` : ""}
            </div>
            <div class="vocab-meaning">${formatText(v.meaning)}</div>
            ${hasExample ? `
            <button class="toggle-example-btn" data-idx="${idx}" data-open="false">📖 Xem ví dụ</button>
            <div class="vocab-example" id="example-block-${idx}" style="display:none; margin-top:8px;">
                ${formatText(v.example)}
                ${v.example_meaning ? `<div class="vocab-example-meaning">${formatText(v.example_meaning)}</div>` : ""}
            </div>` : ""}
        `;
        listContainer.appendChild(item);
    });

    // Gán sự kiện toggle ví dụ
    listContainer.querySelectorAll(".toggle-example-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const idx = this.dataset.idx;
            const block = document.getElementById(`example-block-${idx}`);
            const isOpen = this.dataset.open === "true";
            if (isOpen) {
                block.style.display = "none";
                this.textContent = "📖 Xem ví dụ";
                this.dataset.open = "false";
            } else {
                block.style.display = "block";
                this.textContent = "🔼 Ẩn ví dụ";
                this.dataset.open = "true";
            }
        });
    });
}

// ─── Flashcard logic ──────────────────────────────────────────────────────────
const fcCard    = document.getElementById("flashcard");
const fcWord    = document.getElementById("fc-word");
const fcPron    = document.getElementById("fc-pronunciation");
const fcType    = document.getElementById("fc-type");
const fcMean    = document.getElementById("fc-meaning");
const fcEx      = document.getElementById("fc-example");
const fcExMean  = document.getElementById("fc-example-meaning");
const fcCounter = document.getElementById("fc-counter");
const fcAudioBox = document.getElementById("fc-audio-box");
const fcAudio   = document.getElementById("fc-audio");
const btnPlayAudio = document.getElementById("btn-play-audio");

function renderFlashcard() {
    fcCard.classList.remove("is-flipped");
    if (filteredVocabs.length === 0) {
        fcWord.textContent = "Không có thẻ";
        fcPron.textContent = "";
        fcType.textContent = "";
        fcMean.innerHTML = "Hãy thử thay đổi bộ lọc";
        fcEx.innerHTML   = "";
        fcExMean.innerHTML = "";
        fcCounter.textContent = "0 / 0";
        fcAudioBox.style.display = "none";
        return;
    }
    
    const v = filteredVocabs[flashcardIndex];

    // Mặt trước
    fcWord.textContent = v.word;
    fcPron.textContent = v.pronunciation ? `/${v.pronunciation}/` : "";
    fcType.textContent = v.word_type || "";

    // Mặt sau — dùng innerHTML để hiện \n thành xuống dòng
    fcMean.innerHTML   = formatText(v.meaning) || "<em style='color:var(--text-muted)'>Chưa có nghĩa</em>";
    fcEx.innerHTML     = formatText(v.example) || "<em style='color:var(--text-muted)'>Chưa có ví dụ</em>";
    fcExMean.innerHTML = formatText(v.example_meaning) || "";

    fcCounter.textContent = `${flashcardIndex + 1} / ${filteredVocabs.length}`;

    if (v.mp3_gdrive_id) {
        fcAudioBox.style.display = "block";
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
    e.stopPropagation();
    fcAudio.play();
});

// ─── Event Listeners ──────────────────────────────────────────────────────────
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
    renderFlashcard();
});

// Init
init();
