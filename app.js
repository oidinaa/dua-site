const collections = {
  quran: {
    title: "Дуа из Корана",
    path: "dua-koran/kdua.txt",
  },
  prophet: {
    title: "Дуа Пророка ﷺ",
    path: "dua-prorok/dua.txt",
  },
};

const homeView = document.querySelector("#home-view");
const readingView = document.querySelector("#reading-view");
const notesView = document.querySelector("#notes-view");
const entry = document.querySelector("#dua-entry");
const navigation = document.querySelector("#dua-navigation");
const notesButton = document.querySelector("#notes-button");
const notesCount = document.querySelector("#notes-count");
const savedNotesList = document.querySelector("#saved-notes-list");
const notesEmpty = document.querySelector("#notes-empty");
const supplementDialog = document.querySelector("#supplement-dialog");
const supplementDialogContent = document.querySelector("#supplement-dialog-content");
const collectionLabel = document.querySelector("#collection-label");
const currentNumber = document.querySelector("#current-number");
const totalNumber = document.querySelector("#total-number");
const progressFill = document.querySelector("#progress-fill");
const previousButton = document.querySelector("#previous-dua");
const nextButton = document.querySelector("#next-dua");
let activeCollection = null;
let duas = [];
let activeIndex = 0;
let notesReturnView = "home";
let swipeStart = null;
const collectionCache = {};
const savedNotes = new Set();

try {
  const storedNotes = JSON.parse(localStorage.getItem("dua-notes") || "[]");
  if (Array.isArray(storedNotes)) {
    storedNotes.filter((note) => typeof note === "string").forEach((note) => savedNotes.add(note));
  }
} catch {
  localStorage.removeItem("dua-notes");
}

const fieldNames = {
  "Арабский": "arabic",
  "Транскрипция": "transcription",
  "Перевод": "translation",
  "Дополнение": "supplement",
};

function parseDuas(source) {
  const records = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/^[ \t]*(\d+)\.[ \t]*([^\n]*)$/m);
  const parsed = [];

  for (let index = 1; index < records.length; index += 3) {
    const fields = { number: records[index].trim(), title: records[index + 1].trim() };
    let currentField = null;

    for (const line of records[index + 2].split("\n")) {
      const heading = line.trim().match(/^(Арабский|Транскрипция|Перевод|Дополнение):\s*$/);
      if (heading) {
        currentField = fieldNames[heading[1]];
        fields[currentField] = "";
      } else if (currentField) {
        fields[currentField] += `${fields[currentField] ? "\n" : ""}${line.trim()}`;
      }
    }

    if (fields.arabic || fields.translation) parsed.push(fields);
  }

  return parsed;
}

function createTextBlock(className, text) {
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = text;
  return paragraph;
}

function noteKey(collection, index) {
  return `${collection}:${index}`;
}

function persistNotes() {
  localStorage.setItem("dua-notes", JSON.stringify([...savedNotes]));
  notesCount.textContent = String(savedNotes.size);
  notesCount.hidden = savedNotes.size === 0;
}

async function loadCollection(key) {
  if (!collections[key]) throw new Error("Неизвестный сборник.");
  if (!collectionCache[key]) {
    const response = await fetch(collections[key].path);
    if (!response.ok) throw new Error(`Не удалось открыть файл: ${response.status}`);
    const loadedDuas = parseDuas(await response.text());
    if (!loadedDuas.length) throw new Error("В файле не найдено дуа.");
    collectionCache[key] = loadedDuas;
  }
  return collectionCache[key];
}

function updateSaveButton(button) {
  const isSaved = savedNotes.has(noteKey(activeCollection, activeIndex));
  button.classList.toggle("is-saved", isSaved);
  button.setAttribute("aria-pressed", String(isSaved));
  const label = isSaved ? "Убрать из заметок" : "Сохранить в заметки";
  button.setAttribute("aria-label", label);
  button.title = label;
}

function renderDua() {
  const dua = duas[activeIndex];
  entry.replaceChildren();

  const number = document.createElement("p");
  number.className = "entry-number";
  if (activeCollection === "prophet") {
    number.classList.add("prophet-entry-number");
    const introduction = document.createElement("span");
    introduction.textContent = "Среди многочисленных дуа Пророка ﷺ";
    const badge = document.createElement("span");
    badge.className = "prophet-number-badge";
    badge.textContent = dua.number;
    number.append(introduction, badge);
  } else {
    number.textContent = `ДУА ${dua.number}`;
  }
  entry.append(number);

  const saveButton = document.createElement("button");
  saveButton.className = "save-note-button";
  saveButton.type = "button";
  saveButton.setAttribute("aria-pressed", "false");
  saveButton.innerHTML = '<svg class="bookmark-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"></path></svg>';
  updateSaveButton(saveButton);
  saveButton.addEventListener("click", () => {
    const key = noteKey(activeCollection, activeIndex);
    if (savedNotes.has(key)) savedNotes.delete(key);
    else savedNotes.add(key);
    persistNotes();
    updateSaveButton(saveButton);
  });
  entry.append(saveButton);

  if (dua.title) {
    const title = document.createElement("p");
    title.className = "entry-title";
    title.textContent = dua.title;
    entry.append(title);
  }

  if (dua.supplement) {
    const trigger = document.createElement("button");
    trigger.className = "supplement-trigger";
    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5m0-8h.01"></path></svg><span>Дополнение</span>';
    trigger.addEventListener("click", () => {
      supplementDialogContent.textContent = dua.supplement;
      supplementDialog.showModal();
    });
    entry.append(trigger);
  }

  const arabic = createTextBlock("arabic-text", dua.arabic || "");
  arabic.lang = "ar";
  arabic.dir = "rtl";
  entry.append(arabic);

  if (dua.transcription) {
    const transcriptionBlock = document.createElement("div");
    transcriptionBlock.className = "transcription-block";
    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = "Транскрипция";
    transcriptionBlock.append(label, createTextBlock("transcription-text", dua.transcription));
    entry.append(transcriptionBlock);
  }

  if (dua.translation) {
    const translationBlock = document.createElement("div");
    translationBlock.className = "translation-block";
    const label = document.createElement("span");
    label.className = "field-label";
    label.textContent = "Перевод";
    translationBlock.append(label, createTextBlock("translation-text", dua.translation));
    entry.append(translationBlock);
  }

  currentNumber.textContent = String(activeIndex + 1);
  totalNumber.textContent = String(duas.length);
  progressFill.style.transform = `scaleX(${(activeIndex + 1) / duas.length})`;
  previousButton.disabled = activeIndex === 0;
  nextButton.disabled = activeIndex === duas.length - 1;
}

async function openCollection(key, index = 0) {
  const collection = collections[key];
  if (!collection) return;

  try {
    duas = await loadCollection(key);

    activeCollection = key;
    activeIndex = Math.min(Math.max(index, 0), duas.length - 1);
    collectionLabel.textContent = collection.title;
    homeView.hidden = true;
    readingView.hidden = false;
    notesView.hidden = true;
    navigation.hidden = false;
    renderDua();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    window.alert(`${error.message}\n\nОткройте сайт через локальный веб-сервер, а не напрямую как файл.`);
  }
}

function showHome() {
  homeView.hidden = false;
  readingView.hidden = true;
  notesView.hidden = true;
  navigation.hidden = true;
  activeCollection = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function openNotes() {
  if (!notesView.hidden) return;
  notesReturnView = readingView.hidden ? "home" : "reading";
  homeView.hidden = true;
  readingView.hidden = true;
  notesView.hidden = false;
  navigation.hidden = true;
  savedNotesList.replaceChildren();
  notesEmpty.hidden = savedNotes.size > 0;
  notesEmpty.textContent = savedNotes.size ? "Загрузка заметок…" : "Пока нет сохранённых дуа.";
  notesEmpty.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });

  try {
    const items = await Promise.all([...savedNotes].map(async (key) => {
      const [collection, indexText] = key.split(":");
      const index = Number(indexText);
      const records = await loadCollection(collection);
      const dua = records[index];
      return dua ? { collection, index, dua } : null;
    }));
    const validItems = items.filter(Boolean);
    savedNotesList.replaceChildren();
    notesEmpty.hidden = validItems.length > 0;
    notesEmpty.textContent = "Пока нет сохранённых дуа.";

    validItems.forEach(({ collection, index, dua }, order) => {
      const button = document.createElement("button");
      button.className = "saved-note";
      button.type = "button";
      const orderNumber = document.createElement("span");
      orderNumber.className = "saved-note-index";
      orderNumber.textContent = String(order + 1).padStart(2, "0");
      const content = document.createElement("span");
      content.className = "saved-note-content";
      const source = document.createElement("span");
      source.className = "saved-note-source";
      source.textContent = `${collections[collection].title} · ${dua.number}`;
      const arabic = document.createElement("span");
      arabic.className = "saved-note-arabic";
      arabic.lang = "ar";
      arabic.dir = "rtl";
      arabic.textContent = dua.arabic || "";
      content.append(source, arabic);
      button.append(orderNumber, content);
      button.addEventListener("click", () => openCollection(collection, index));
      savedNotesList.append(button);
    });
  } catch {
    notesEmpty.hidden = false;
    notesEmpty.textContent = "Не удалось загрузить сохранённые дуа.";
  }
}

function closeNotes() {
  if (notesReturnView === "reading" && activeCollection) {
    notesView.hidden = true;
    readingView.hidden = false;
    navigation.hidden = false;
  } else {
    showHome();
  }
}

document.querySelectorAll("[data-collection]").forEach((button) => {
  button.addEventListener("click", () => openCollection(button.dataset.collection));
});

document.querySelector("#back-button").addEventListener("click", showHome);
document.querySelector("#notes-back-button").addEventListener("click", closeNotes);
notesButton.addEventListener("click", openNotes);
document.querySelector("#supplement-dialog-close").addEventListener("click", () => supplementDialog.close());
supplementDialog.addEventListener("click", (event) => {
  if (event.target === supplementDialog) supplementDialog.close();
});
document.querySelector("#home-link").addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});
previousButton.addEventListener("click", () => {
  if (activeIndex > 0) {
    activeIndex -= 1;
    renderDua();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});
nextButton.addEventListener("click", () => {
  if (activeIndex < duas.length - 1) {
    activeIndex += 1;
    renderDua();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

readingView.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || event.target.closest("button, a, input, textarea, select")) {
    swipeStart = null;
    return;
  }
  swipeStart = { x: event.clientX, y: event.clientY };
});
readingView.addEventListener("pointerup", (event) => {
  if (!swipeStart || event.pointerType !== "touch") return;
  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  swipeStart = null;

  if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
  if (deltaX < 0 && !nextButton.disabled) nextButton.click();
  if (deltaX > 0 && !previousButton.disabled) previousButton.click();
});
readingView.addEventListener("pointercancel", () => {
  swipeStart = null;
});

document.querySelectorAll("[data-theme-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeChoice;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dua-theme", theme);
    document.querySelectorAll("[data-theme-choice]").forEach((option) => {
      option.classList.toggle("is-active", option === button);
      option.setAttribute("aria-pressed", String(option === button));
    });
  });
});

persistNotes();

const savedTheme = localStorage.getItem("dua-theme");
if (savedTheme === "dark") document.querySelector('[data-theme-choice="dark"]').click();

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && supplementDialog.open) {
    supplementDialog.close();
    return;
  }
  if (readingView.hidden || supplementDialog.open) return;
  if (event.key === "ArrowLeft" && activeCollection && activeIndex > 0) previousButton.click();
  if (event.key === "ArrowRight" && activeCollection && activeIndex < duas.length - 1) nextButton.click();
});