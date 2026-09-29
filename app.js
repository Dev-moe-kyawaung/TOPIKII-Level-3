"use strict";

const $ = selector => document.querySelector(selector);

function element(tag, text = "", className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function readSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

const starred = readSet("topik3-starred");
const learned = readSet("topik3-learned");

function saveProgress() {
  try {
    localStorage.setItem("topik3-starred", JSON.stringify([...starred]));
    localStorage.setItem("topik3-learned", JSON.stringify([...learned]));
  } catch {
    // Storage ပိတ်ထားသော်လည်း app ကို ဆက်လက်သုံးနိုင်ရန်။
  }
}

function updateStats() {
  $("#grammar-count").textContent = `သဒ္ဒါ ${GRAMMAR.length}`;
  $("#vocab-count").textContent = `ဝေါဟာရ ${VOCAB.length}`;
  $("#learned-count").textContent = `မှတ်မိပြီး ${learned.size}`;
}

function fillCategories(selector, data) {
  const select = $(selector);
  for (const category of new Set(data.map(item => item.category))) {
    const option = element("option", category);
    option.value = category;
    select.append(option);
  }
}

function matching(item, query) {
  return Object.values(item)
    .join(" ")
    .toLocaleLowerCase()
    .includes(query.trim().toLocaleLowerCase());
}

function renderGrammar() {
  const list = $("#grammar-list");
  list.replaceChildren();

  const category = $("#grammar-category").value;
  const query = $("#grammar-search").value;
  let count = 0;

  for (const item of GRAMMAR) {
    if (category && item.category !== category) continue;
    if (query && !matching(item, query)) continue;
    count++;

    const card = element("article", "", "grammar-card");
    card.append(
      element("h3", item.form, "ko"),
      element("p", item.meaning),
      element("p", `ပုံစံ: ${item.pattern}`),
      element("p", `အသုံးပြုပုံ: ${item.usage}`),
      element("p", item.example, "ko"),
      element("p", item.translation)
    );
    list.append(card);
  }

  $("#grammar-status").textContent = `${count} / ${GRAMMAR.length} ချက်`;
}

function addCell(row, text, className = "") {
  const cell = row.insertCell();
  cell.textContent = text;
  cell.className = className;
  return cell;
}

function renderVocab() {
  const tbody = $("#vocab-body");
  tbody.replaceChildren();

  const category = $("#vocab-category").value;
  const query = $("#vocab-search").value;
  const filter = $("#vocab-filter").value;
  let count = 0;

  VOCAB.forEach((item, index) => {
    if (category && item.category !== category) return;
    if (query && !matching(item, query)) return;
    if (filter === "starred" && !starred.has(index)) return;
    if (filter === "unlearned" && learned.has(index)) return;

    count++;
    const row = tbody.insertRow();

    addCell(row, String(index + 1));
    addCell(row, item.category);
    addCell(row, item.word, "ko");
    addCell(row, `${item.meaning} — ${item.definition}`);

    const example = row.insertCell();
    example.append(
      element("span", item.example, "ko"),
      element("br"),
      element("small", item.translation)
    );

    const controls = row.insertCell();
    controls.className = "screen-only";

    for (const [symbol, set, description] of [
      ["★", starred, "bookmark"],
      ["✓", learned, "မှတ်မိပြီး"]
    ]) {
      const button = element("button", symbol, "mark");
      button.type = "button";
      button.setAttribute("aria-label", `${item.word}: ${description}`);
      button.setAttribute("aria-pressed", String(set.has(index)));

      button.addEventListener("click", () => {
        if (set.has(index)) set.delete(index);
        else set.add(index);
        saveProgress();
        updateStats();
        renderVocab();
        renderCard();
      });

      controls.append(button);
    }
  });

  $("#vocab-status").textContent = `${count} / ${VOCAB.length} လုံး`;
}

let cardIndex = 0;
let cardIsRevealed = false;

function cardPool() {
  return VOCAB.map((_, index) => index).filter(index => {
    const item = VOCAB[index];
    const category = $("#card-category").value;
    const filter = $("#card-filter").value;

    if (category && item.category !== category) return false;
    if (filter === "starred" && !starred.has(index)) return false;
    if (filter === "unlearned" && learned.has(index)) return false;
    return true;
  });
}

function renderCard() {
  const pool = cardPool();
  const answer = $("#card-answer");

  if (!pool.length) {
    $("#card-position").textContent = "ကတ်မရှိပါ";
    $("#card-word").textContent = "အခြားကဏ္ဍ ရွေးပါ";
    answer.replaceChildren();
    answer.hidden = true;
    return;
  }

  cardIndex = ((cardIndex % pool.length) + pool.length) % pool.length;
  const item = VOCAB[pool[cardIndex]];

  $("#card-position").textContent = `${cardIndex + 1} / ${pool.length}`;
  $("#card-word").textContent = item.word;
  answer.replaceChildren(
    element("strong", item.meaning),
    element("p", item.definition),
    element("p", item.example, "ko"),
    element("p", item.translation)
  );
  answer.hidden = !cardIsRevealed;
  $("#card-reveal").textContent =
    cardIsRevealed ? "အဖြေဖုံးရန်" : "အဖြေပြရန်";
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

let quizQuestions = [];
let quizAt = 0;
let quizScore = 0;
let quizAnswered = false;

function renderQuiz() {
  const box = $("#quiz-box");
  box.replaceChildren();

  if (quizAt >= quizQuestions.length) {
    box.append(
      element("h3", `ရလဒ်: ${quizScore} / ${quizQuestions.length}`),
      element("p", "မှားခဲ့သည့်စကားလုံးများကို ဝေါဟာရဇယားတွင် ★ ပေးပြီး ပြန်လေ့လာပါ။")
    );
    return;
  }

  quizAnswered = false;
  const current = quizQuestions[quizAt];
  const item = VOCAB[current];
  const alternatives = shuffle(
    VOCAB.map((_, i) => i).filter(i =>
      i !== current && VOCAB[i].meaning !== item.meaning
    )
  ).slice(0, 3);
  const choices = shuffle([current, ...alternatives]);

  box.append(
    element("p", `မေးခွန်း ${quizAt + 1} / ${quizQuestions.length}`),
    element("h3", item.word, "ko")
  );

  const options = element("div", "", "quiz-options");
  const feedback = element("p", "");
  feedback.setAttribute("role", "status");

  for (const choice of choices) {
    const button = element("button", VOCAB[choice].meaning, "secondary");

    button.addEventListener("click", () => {
      if (quizAnswered) return;
      quizAnswered = true;

      if (choice === current) {
        quizScore++;
        feedback.textContent = `မှန်သည်။ ${item.example} — ${item.translation}`;
      } else {
        feedback.textContent =
          `မမှန်ပါ။ အဖြေ: ${item.meaning}။ ` +
          `${item.example} — ${item.translation}`;
      }

      for (const child of options.children) child.disabled = true;

      const next = element(
        "button",
        quizAt === quizQuestions.length - 1
          ? "ရလဒ်ကြည့်ရန်"
          : "နောက်မေးခွန်း"
      );
      next.addEventListener("click", () => {
        quizAt++;
        renderQuiz();
      });
      box.append(next);
    });

    options.append(button);
  }

  box.append(options, feedback);
}

function csvValue(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadCsv() {
  const headers = [
    "category", "word", "meaning", "definition",
    "example", "translation"
  ];

  const lines = [
    headers.map(csvValue).join(","),
    ...VOCAB.map(item => headers.map(key => csvValue(item[key])).join(","))
  ];

  const blob = new Blob(
    ["﻿" + lines.join("
")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "topik-ii-level3-vocabulary.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.tab;

    document.querySelectorAll(".tab").forEach(tab => {
      const active = tab === button;
      tab.classList.toggle("active", active);
      if (active) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });

    document.querySelectorAll(".panel").forEach(panel => {
      panel.hidden = panel.id !== target;
    });
  });
});

fillCategories("#grammar-category", GRAMMAR);
fillCategories("#vocab-category", VOCAB);
fillCategories("#card-category", VOCAB);

$("#grammar-search").addEventListener("input", renderGrammar);
$("#grammar-category").addEventListener("change", renderGrammar);
$("#vocab-search").addEventListener("input", renderVocab);
$("#vocab-category").addEventListener("change", renderVocab);
$("#vocab-filter").addEventListener("change", renderVocab);

$("#card-category").addEventListener("change", () => {
  cardIndex = 0;
  cardIsRevealed = false;
  renderCard();
});

$("#card-filter").addEventListener("change", () => {
  cardIndex = 0;
  cardIsRevealed = false;
  render
