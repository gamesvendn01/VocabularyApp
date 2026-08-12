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

// ─── Writing Practice — Pixel Similarity Scoring ─────────────────────────────
const btnPracticeWrite = document.getElementById("btn-practice-write");
const writingModal    = document.getElementById("writing-modal");
const closeWritingBtn = document.getElementById("close-writing-modal");
const modeSelection   = document.getElementById("writing-mode-selection");
const practiceCont    = document.getElementById("canvas-practice-container");

const btnModeHanzi  = document.getElementById("btn-mode-hanzi");   // Có chấm điểm
const btnModeCanvas = document.getElementById("btn-mode-canvas");   // Bảng nháp

const refCanvas  = document.getElementById("ref-canvas");
const bgCanvas   = document.getElementById("bg-canvas");
const drawCanvas = document.getElementById("draw-canvas");

const refCtx  = refCanvas.getContext("2d", { willReadFrequently: true });
const bgCtx   = bgCanvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d", { willReadFrequently: true });

const PW = 280, PH = 280;  // practice canvas size

let practiceChars  = [];
let practiceIndex  = 0;
let practiceMode   = "scored";   // "scored" | "free"
let isPracticing   = false;
let pLastX = 0, pLastY = 0;

// ── Open modal ──────────────────────────────────────────────────────────────
if (btnPracticeWrite) {
    btnPracticeWrite.addEventListener("click", (e) => {
        e.stopPropagation();
        if (filteredVocabs.length === 0) return;
        writingModal.style.display = "flex";
        modeSelection.style.display = "flex";
        practiceCont.style.display  = "none";
    });
}

closeWritingBtn.addEventListener("click", () => {
    writingModal.style.display = "none";
});

// ── Start practice ──────────────────────────────────────────────────────────
btnModeHanzi.addEventListener("click",  () => startPractice("scored"));
btnModeCanvas.addEventListener("click", () => startPractice("free"));

function startPractice(mode) {
    practiceMode  = mode;
    const word    = fcWord.textContent;
    practiceChars = word.replace(/\s+/g, "").split("").filter(c => c.trim() !== "");
    practiceIndex = 0;
    if (practiceChars.length === 0) return;

    modeSelection.style.display  = "none";
    practiceCont.style.display   = "block";

    document.getElementById("btn-score-check").style.display =
        mode === "scored" ? "inline-block" : "none";

    document.getElementById("practice-hint").textContent =
        mode === "scored"
            ? "Vẽ đè lên chữ mờ → nhấn ⭐ Chấm điểm khi xong."
            : "Bảng nháp tự do — vẽ theo chữ mờ phía dưới.";

    document.getElementById("score-display").style.display = "none";
    renderPracticeChar();
}

// ── Render a character ──────────────────────────────────────────────────────
function renderPracticeChar() {
    const char = practiceChars[practiceIndex];
    document.getElementById("char-indicator").textContent =
        `${practiceIndex + 1} / ${practiceChars.length}`;
    document.getElementById("score-display").style.display = "none";

    // 1. Draw crisp black char on offscreen ref-canvas (with shadow for tolerance)
    refCtx.clearRect(0, 0, PW, PH);
    refCtx.fillStyle = "white";
    refCtx.fillRect(0, 0, PW, PH);
    refCtx.save();
    refCtx.fillStyle   = "black";
    refCtx.shadowColor = "black";
    refCtx.shadowBlur  = 8;          // Creates wider "hit zone" for scoring
    const fontSize = Math.floor(PW * 0.72);
    refCtx.font          = `bold ${fontSize}px "Noto Sans", "MS Gothic", "Meiryo", "Arial Unicode MS", sans-serif`;
    refCtx.textAlign     = "center";
    refCtx.textBaseline  = "middle";
    refCtx.fillText(char, PW / 2, PH / 2);
    refCtx.restore();

    // 2. Draw faint char on bg-canvas (user sees this as a guide)
    bgCtx.clearRect(0, 0, PW, PH);
    bgCtx.fillStyle = "white";
    bgCtx.fillRect(0, 0, PW, PH);
    bgCtx.globalAlpha = 0.10;
    bgCtx.drawImage(refCanvas, 0, 0);
    bgCtx.globalAlpha = 1.0;

    // 3. Clear draw-canvas
    drawCtx.clearRect(0, 0, PW, PH);
}

// ── Score calculation (F1 = 2·precision·recall / (precision+recall)) ────────
function calcScore() {
    const refData  = refCtx.getImageData(0, 0, PW, PH).data;
    const drawData = drawCtx.getImageData(0, 0, PW, PH).data;

    let refPx = 0, userPx = 0, overlap = 0;

    for (let i = 0; i < PW * PH; i++) {
        const idx = i * 4;
        // Reference: pixel is "dark" (char stroke)
        const isRef  = (refData[idx] + refData[idx+1] + refData[idx+2]) < 450;
        // User: any drawn pixel (non-transparent)
        const isUser = drawData[idx + 3] > 30;

        if (isRef)           refPx++;
        if (isUser)          userPx++;
        if (isRef && isUser) overlap++;
    }

    if (refPx === 0 || userPx === 0) return 0;

    const recall    = overlap / refPx;
    const precision = overlap / userPx;
    if (recall + precision === 0) return 0;

    return Math.round((2 * recall * precision) / (recall + precision) * 100);
}

document.getElementById("btn-score-check").addEventListener("click", () => {
    const score = calcScore();
    const scoreDisplay = document.getElementById("score-display");
    document.getElementById("score-value").textContent = score + "%";

    let msg   = "", color = "";
    if      (score >= 85) { msg = "🌟 Xuất sắc! Chữ rất chuẩn!";          color = "#03dac6"; }
    else if (score >= 70) { msg = "✅ Tốt! Cần luyện thêm một chút.";       color = "#bb86fc"; }
    else if (score >= 50) { msg = "👍 Khá ổn! Hãy thử lại lần nữa.";       color = "#ffb300"; }
    else                  { msg = "💪 Cần luyện tập thêm! Thử lại nhé.";    color = "#cf6679"; }

    document.getElementById("score-msg").textContent = msg;
    document.querySelector(".score-ring").style.borderColor = color;
    document.getElementById("score-value").style.color      = color;
    scoreDisplay.style.display = "block";
});

// ── Navigation ───────────────────────────────────────────────────────────────
document.getElementById("btn-char-prev").addEventListener("click", () => {
    if (practiceIndex > 0) { practiceIndex--; renderPracticeChar(); }
});
document.getElementById("btn-char-next").addEventListener("click", () => {
    if (practiceIndex < practiceChars.length - 1) { practiceIndex++; renderPracticeChar(); }
});
document.getElementById("btn-clear-draw").addEventListener("click", () => {
    drawCtx.clearRect(0, 0, PW, PH);
    document.getElementById("score-display").style.display = "none";
});

// ── Drawing input ────────────────────────────────────────────────────────────
function getPracticePos(e) {
    const rect   = drawCanvas.getBoundingClientRect();
    const scaleX = PW / rect.width;
    const scaleY = PH / rect.height;
    const src    = e.touches ? e.touches[0] : e;
    return {
        x: (src.clientX - rect.left) * scaleX,
        y: (src.clientY - rect.top)  * scaleY
    };
}

function practiceStroke(x, y) {
    drawCtx.beginPath();
    drawCtx.moveTo(pLastX, pLastY);
    drawCtx.lineTo(x, y);
    drawCtx.strokeStyle = "#1a1a2e";
    drawCtx.lineWidth   = 14;
    drawCtx.lineCap     = "round";
    drawCtx.lineJoin    = "round";
    drawCtx.stroke();
    pLastX = x; pLastY = y;
}

drawCanvas.addEventListener("mousedown", (e) => {
    isPracticing = true;
    const p = getPracticePos(e); pLastX = p.x; pLastY = p.y;
});
drawCanvas.addEventListener("mousemove", (e) => {
    if (!isPracticing) return;
    const p = getPracticePos(e); practiceStroke(p.x, p.y);
});
drawCanvas.addEventListener("mouseup",  () => { isPracticing = false; });
drawCanvas.addEventListener("mouseout", () => { isPracticing = false; });

drawCanvas.addEventListener("touchstart", (e) => {
    e.preventDefault(); isPracticing = true;
    const p = getPracticePos(e); pLastX = p.x; pLastY = p.y;
}, { passive: false });
drawCanvas.addEventListener("touchmove", (e) => {
    e.preventDefault(); if (!isPracticing) return;
    const p = getPracticePos(e); practiceStroke(p.x, p.y);
}, { passive: false });
drawCanvas.addEventListener("touchend", () => { isPracticing = false; });
