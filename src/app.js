import {
  matchesName,
  answerOperators,
  operatorFamily,
  searchOperators,
  eligibleOperators,
  streakTier,
} from "./core.js";
import {
  classicMode,
  createRound,
  transitionRound,
  roundResult,
} from "./game.js";
import { createStorage, blankStats } from "./storage.js";
import { createAudioPlayer } from "./audio.js";
const $ = (id) => document.getElementById(id),
  audio = new Audio(),
  LIMIT = classicMode.attempts;
const store = createStorage();
const { read, save } = store;
let round;
const savedRarities = read("voiceprint-rarities", [1, 2, 3, 4, 5, 6]);
let rarities = Array.isArray(savedRarities)
  ? [
      ...new Set(
        savedRarities.filter((n) => Number.isInteger(n) && n >= 1 && n <= 6),
      ),
    ]
  : [];
if (!rarities.length) rarities = [1, 2, 3, 4, 5, 6];
const pool = (code = language, stars = rarities) =>
  eligibleOperators(data.operators, code, stars);
let roundLines = [],
  data,
  operator,
  attempt = 0,
  selected = 0,
  hintCount = 0,
  ended = false,
  language = "JP",
  loaded = "",
  results = [],
  matches = [],
  active = -1;
const savedLanguage = read("voiceprint-language", "JP");
if (["JP", "EN", "CN", "KR"].includes(savedLanguage)) language = savedLanguage;
let allStats = store.statistics(),
  stats = allStats[language],
  recent = store.recent(),
  seeking = false;
const player = createAudioPlayer(audio, {
  onReady(duration) {
    $("duration").textContent = timeLabel(duration);
    $("progress").disabled = false;
  },
  onError() {
    $("audioStatus").textContent =
      "Unable to play audio. Please press play to retry.";
  },
});
function stop() {
  player.stop();
  $("play").textContent = "▶";
  $("play").setAttribute("aria-label", "Play voice line");
}
function loadClip() {
  const path = operator?.voices[language]?.[roundLines[selected]];
  if (!path) return false;
  if (loaded !== path) {
    stop();
    loaded = path;
    $("progress").disabled = true;
    $("progress").value = 0;
    $("elapsed").textContent = "0:00";
    $("duration").textContent = "0:00";
  }
  player.load(path);
  return true;
}
async function play() {
  if (!loadClip()) return;
  if (await player.play(operator.voices[language][roundLines[selected]])) {
    $("play").textContent = "Ⅱ";
    $("play").setAttribute("aria-label", "Pause voice line");
    $("audioStatus").textContent = `Playing voice line ${selected + 1}`;
  }
}
function syncRound() {
  ({ operator, attempt, hintCount, ended, results } = round);
  roundLines = round.lines;
}
function render() {
  $("counter").textContent = `ATTEMPT ${attempt + 1} / ${LIMIT}`;
  $("steps").replaceChildren();
  for (let i = 0; i < LIMIT; i++) {
    const b = document.createElement("button"),
      r = results[i];
    const number = document.createElement("strong"),
      label = document.createElement("span");
    number.textContent = i + 1;
    label.textContent =
      operator.clips[language].find((c) => c.id === roundLines[i])?.label ||
      (i === 0 ? "Arknights" : "Voice " + roundLines[i]);
    b.append(number, label);
    if (r) {
      const tag = document.createElement("span");
      tag.className = "result-label";
      tag.textContent = r.label;
      b.append(tag);
    }
    b.disabled = !ended && i > attempt + 1;
    b.className = [
      i === selected ? "selected" : "",
      i === attempt && !r ? "available" : "",
      r?.kind || "",
    ].join(" ");
    b.onclick = () => {
      if (i === attempt + 1 && !ended) {
        advance("Skipped");
        return;
      }
      if (i === selected && !audio.paused) {
        stop();
        return;
      }
      selected = i;
      render();
      play();
    };
    $("steps").append(b);
  }
  $("hintCount").textContent = `${hintCount}/3`;
  $("hint").setAttribute("aria-label", `Reveal hint · ${hintCount}/3`);
  $("hint").disabled = hintCount === 3 || ended;
  for (const id of ["skip", "giveup", "submit", "guess"])
    $(id).disabled = ended;
  $("next").hidden = !ended;
  $("stats").textContent =
    `${language} · ${stats.played} PLAYED · ${stats.won} IDENTIFIED · ${stats.played ? Math.round((stats.won / stats.played) * 100) : 0}% WIN RATE`;
  const tier = streakTier(stats.streak);
  $("streak").hidden = !tier;
  $("streak").className = `streak ${tier}`;
  $("streak").textContent = `🔥 ${stats.streak}`;
  $("streak").title = `${stats.streak} consecutive wins`;
  $("streak").setAttribute(
    "aria-label",
    `${stats.streak} consecutive wins in ${language}`,
  );
  $("filterCount").textContent = `${pool().length} operators available`;
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === language));
    b.disabled = !pool(b.dataset.lang).length;
  });
}
function next(autoplay = false) {
  stop();
  player.clear();
  round = createRound(pool(), language, recent, {
    rarities: [...rarities],
    contentVersion: data.contentVersion,
  });
  syncRound();
  recent.push(operator.id);
  recent = recent.slice(-50);
  save("voiceprint-recent", recent);
  selected = 0;
  loaded = "";
  for (const id of ["message", "history", "hints"]) $(id).replaceChildren();
  $("guess").value = "";
  closeSearch();
  $("audioStatus").textContent = "Attempt 1 always starts with “Arknights”.";
  render();
  loadClip();
  if (autoplay) play();
}
function finish(won) {
  stop();
  const persisted = store.append(roundResult(round));
  allStats = store.statistics();
  stats = allStats[language];
  if (!persisted)
    $("audioStatus").textContent =
      "Result kept for this session; browser storage is unavailable.";
  $("message").className = won ? "success" : "failure";
  $("message").replaceChildren();
  const img = document.createElement("img");
  img.src = operator.avatar;
  img.alt = operator.name;
  const text = document.createElement("div");
  text.textContent = `${won ? "Identified" : "Answer"}: ${operator.name} · ${operator.rarity}★ ${operator.class} · ${operator.race} / ${operator.faction}`;
  const actors = document.createElement("p");
  actors.className = "voice-actors";
  actors.textContent = `VA · ${language}: ${operator.voiceActors?.[language]?.join(" / ") || "Not listed"}`;
  text.append(actors);
  $("message").append(img, text);
  closeSearch();
  render();
}
function act(action) {
  if (!round || ended) return;
  round = transitionRound(round, action);
  syncRound();
  stop();
  if (ended) finish(round.won);
  else {
    selected = attempt;
    render();
    loadClip();
    play();
  }
}
function advance() {
  act({ type: "skip" });
}
function closeSearch() {
  $("suggestions").hidden = true;
  $("guess").setAttribute("aria-expanded", "false");
  $("guess").removeAttribute("aria-activedescendant");
  active = -1;
}
function pick(o) {
  $("guess").value = o.name;
  closeSearch();
  $("guessForm").requestSubmit();
}
function search() {
  if (!data || ended) return;
  if (!$("guess").value.trim()) {
    closeSearch();
    return;
  }
  matches = searchOperators(
    answerOperators(data.operators, language, rarities),
    $("guess").value,
  );
  $("suggestions").replaceChildren();
  active = -1;
  for (const [i, o] of matches.entries()) {
    const b = document.createElement("div");
    b.id = "option-" + i;
    b.role = "option";
    b.className = "suggestion";
    const img = document.createElement("img");
    img.src = o.avatar;
    img.alt = "";
    const name = document.createElement("span");
    name.textContent = o.name;
    const details = document.createElement("span");
    details.className = "suggestion-details";
    details.append(name);
    const metadata = document.createElement("small");
    for (const [src, text] of [
      [o.classIcon, o.class],
      [o.archetypeIcon, o.archetype],
    ]) {
      if (src) {
        const icon = document.createElement("img");
        icon.src = src;
        icon.alt = "";
        icon.className = "role-icon";
        metadata.append(icon);
      }
      if (text) metadata.append(document.createTextNode(text + " "));
    }
    details.append(metadata);
    const alias = o.aliases?.find((name) =>
      matchesName({ name }, $("guess").value),
    );
    if (alias && !matchesName({ name: o.name }, $("guess").value)) {
      const note = document.createElement("small");
      note.textContent = `${alias} · ${o.name}`;
      details.append(note);
    }
    b.append(img, details);
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = () => pick(o);
    $("suggestions").append(b);
  }
  if (!matches.length) {
    const p = document.createElement("p");
    p.textContent = "No operators found";
    $("suggestions").append(p);
  }
  $("suggestions").hidden = false;
  $("guess").setAttribute("aria-expanded", "true");
}
$("guess").oninput = search;
$("guess").onfocus = () => {
  if (data && !ended) search();
};
$("guess").onkeydown = (e) => {
  if (e.key === "Escape") closeSearch();
  if (["ArrowDown", "ArrowUp"].includes(e.key)) {
    e.preventDefault();
    if ($("suggestions").hidden) search();
    if (!matches.length) return;
    active = Math.max(
      0,
      Math.min(matches.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)),
    );
    document.querySelectorAll(".suggestion").forEach((b, i) => {
      b.setAttribute("aria-selected", String(i === active));
      if (i === active) {
        $("guess").setAttribute("aria-activedescendant", b.id);
        b.scrollIntoView({ block: "nearest" });
      }
    });
  }
  if (e.key === "Enter" && !$("suggestions").hidden && active >= 0) {
    e.preventDefault();
    pick(matches[active]);
  }
};
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) closeSearch();
});
$("guessForm").onsubmit = (e) => {
  e.preventDefault();
  if (!data || ended) return;
  const candidates = answerOperators(data.operators, language, rarities).filter(
    (o) => matchesName(o, $("guess").value, true),
  );
  const candidate =
    candidates.length &&
    candidates.every((o) => operatorFamily(o) === operatorFamily(candidates[0]))
      ? candidates[0]
      : null;
  if (!candidate) {
    $("message").textContent = "Select an operator from the list.";
    return;
  }
  closeSearch();
  $("message").textContent = "";
  $("guess").value = "";
  act({ type: "guess", operator: candidate });
};
$("play").onclick = () => (audio.paused ? play() : stop());
audio.onended = stop;
$("skip").onclick = () => advance();
$("giveup").onclick = () => act({ type: "giveup" });
$("next").onclick = () => next(true);
$("hint").onclick = () => {
  if (!round || ended || hintCount >= round.maxHints) return;
  const groups = [
    [["Rarity", `${operator.rarity}★`]],
    [["Class", operator.class]],
    [
      ["Race", operator.race],
      ["Faction", operator.faction],
    ],
  ];
  const p = document.createElement("p");
  for (const [title, value] of groups[hintCount]) {
    const segment = document.createElement("span");
    segment.className = "hint-segment";
    const label = document.createElement("span"),
      strong = document.createElement("strong");
    label.textContent = title;
    strong.textContent = value;
    segment.append(label, strong);
    p.append(segment);
  }
  $("hints").append(p);
  round = transitionRound(round, { type: "hint" });
  syncRound();
  render();
};
for (const [code, name] of Object.entries({
  JP: "Japanese",
  EN: "English",
  CN: "Mandarin",
  KR: "Korean",
})) {
  const b = document.createElement("button");
  b.textContent = code;
  b.title = name;
  b.dataset.lang = code;
  b.onclick = () => requestLanguage(code);
  $("languages").append(b);
}
function changeLanguage(code) {
  stop();
  language = code;
  save("voiceprint-language", code);
  stats = allStats[code] || blankStats();
  next(true);
}
function requestLanguage(code) {
  if (data && code !== language && pool(code).length) changeLanguage(code);
}
$("help").onclick = () => $("instructions").showModal();
function showStatistics(code) {
  allStats = store.statistics();
  const view = allStats[code] || blankStats();
  $("statisticsTitle").textContent = "Stats";
  $("statsLanguages").replaceChildren();
  for (const lang of ["JP", "EN", "CN", "KR"]) {
    const button = document.createElement("button");
    button.textContent = lang;
    button.setAttribute("aria-pressed", String(code === lang));
    button.onclick = () => showStatistics(lang);
    $("statsLanguages").append(button);
  }
  $("statDetails").innerHTML =
    `<div class="stat-grid"><div><b>${view.played}</b>Played</div><div><b>${view.played ? Math.round((view.won / view.played) * 100) : 0}%</b>Win rate</div><div><b>${view.streak}</b>Streak</div><div><b>${view.best}</b>Best streak</div></div><h3>Winning attempt</h3>`;
  view.distribution.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "distribution";
    row.innerHTML = `<span>${i + 1}</span><meter min="0" max="${Math.max(1, ...view.distribution)}" value="${n}"></meter><b>${n}</b>`;
    $("statDetails").append(row);
  });
}
$("showStats").onclick = () => {
  showStatistics(language);
  $("statistics").showModal();
};
document.querySelectorAll("dialog").forEach((d) => {
  d.querySelector(".close").onclick = () => d.close();
  d.onclick = (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }
  };
});
const timeLabel = (t) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
audio.ontimeupdate = () => {
  if (!seeking)
    $("progress").value = audio.duration
      ? (audio.currentTime / audio.duration) * 1000
      : 0;
  $("elapsed").textContent = timeLabel(audio.currentTime);
};
let seekTarget = 0;
function commitSeek() {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = (seekTarget / 1000) * audio.duration;
  play();
}
$("progress").addEventListener("pointerdown", (e) => {
  seeking = true;
  seekTarget = Number($("progress").value);
  stop();
  $("progress").setPointerCapture(e.pointerId);
});
$("progress").oninput = () => {
  seekTarget = Number($("progress").value);
  if (Number.isFinite(audio.duration))
    $("elapsed").textContent = timeLabel((seekTarget / 1000) * audio.duration);
};
$("progress").onchange = () => {
  if (!seeking) commitSeek();
};
$("progress").addEventListener("pointerup", () => {
  if (!seeking) return;
  seekTarget = Number($("progress").value);
  seeking = false;
  commitSeek();
});
$("progress").addEventListener("pointercancel", () => {
  seeking = false;
});
fetch("game-data.json")
  .then((r) => {
    if (!r.ok) throw Error("Game data unavailable");
    return r.json();
  })
  .then((d) => {
    data = d;
    $("rosterInfo").textContent =
      `${data.operators.length} Global operators · Alternate forms included`;
    next();
  })
  .catch(() => {
    $("message").textContent = "Unable to load game data. Please reload.";
  });

let backgroundDB;
function backgroundUnavailable() {
  $("backgroundStatus").textContent =
    "Browser storage is unavailable. Background changes last for this session only.";
}
function displayBackground(blob) {
  if (window.customBackgroundURL)
    URL.revokeObjectURL(window.customBackgroundURL);
  window.customBackgroundURL = blob ? URL.createObjectURL(blob) : null;
  document.body.style.setProperty(
    "--custom-background",
    blob ? `url("${window.customBackgroundURL}")` : "none",
  );
  document.body.classList.toggle("custom-background", !!blob);
}
// Optional image persistence must never interrupt game/UI initialization.
try {
  const backgroundRequest = indexedDB.open("voiceprint-settings", 1);
  backgroundRequest.onupgradeneeded = () =>
    backgroundRequest.result.createObjectStore("settings");
  backgroundRequest.onerror = backgroundRequest.onblocked =
    backgroundUnavailable;
  backgroundRequest.onsuccess = () => {
    try {
      backgroundDB = backgroundRequest.result;
      const request = backgroundDB
        .transaction("settings")
        .objectStore("settings")
        .get("background");
      request.onerror = backgroundUnavailable;
      request.onsuccess = () => {
        if (request.result) displayBackground(request.result);
      };
    } catch {
      backgroundDB = null;
      backgroundUnavailable();
    }
  };
} catch {
  backgroundUnavailable();
}
$("backgroundFile").onchange = async () => {
  const file = $("backgroundFile").files[0];
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    displayBackground(file);
    if (backgroundDB)
      backgroundDB
        .transaction("settings", "readwrite")
        .objectStore("settings")
        .put(file, "background");
    $("backgroundStatus").textContent = backgroundDB
      ? "Background saved in this browser."
      : "Background applied for this session only.";
  } catch {
    $("backgroundStatus").textContent = "Please choose a valid image.";
  }
};
$("resetBackground").onclick = () => {
  displayBackground(null);
  if (backgroundDB)
    backgroundDB
      .transaction("settings", "readwrite")
      .objectStore("settings")
      .delete("background");
  $("backgroundFile").value = "";
  $("backgroundStatus").textContent = "Default background restored.";
};

const savedVolume = (() => {
  try {
    const value = localStorage.getItem("voiceprint-volume");
    return value === null ? 75 : JSON.parse(value);
  } catch {
    return 75;
  }
})();
const initialVolume =
  typeof savedVolume === "number"
    ? Math.max(0, Math.min(100, savedVolume))
    : 75;
function setVolume(value) {
  audio.volume = value / 100;
  $("volumeValue").textContent = value + "%";
  $("volume").setAttribute(
    "aria-valuetext",
    value === 0 ? "Muted" : value + " percent",
  );
}
$("volume").value = initialVolume;
setVolume(initialVolume);
$("volume").oninput = () => {
  const value = Number($("volume").value);
  setVolume(value);
  save("voiceprint-volume", value);
};

window.addEventListener("storage", () => {
  allStats = store.statistics();
  stats = allStats[language];
  if (data) render();
});

for (const value of [1, 2, 3, 4, 5, 6]) {
  const label = document.createElement("label"),
    checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = value;
  checkbox.checked = rarities.includes(value);
  checkbox.setAttribute("aria-label", `${value} star operators`);
  label.append(checkbox, document.createTextNode(`${value}★`));
  $("rarities").append(label);
}
$("showFilters").onclick = () => {
  for (const checkbox of $("rarities").querySelectorAll("input"))
    checkbox.checked = rarities.includes(Number(checkbox.value));
  $("filterStatus").textContent =
    "Choose any combination. Applying changes starts a new round.";
  $("filterDialog").showModal();
};
$("applyFilters").onclick = () => {
  if (!data) return;
  const selectedRarities = [
    ...$("rarities").querySelectorAll("input:checked"),
  ].map((c) => Number(c.value));
  if (!selectedRarities.length) {
    $("filterStatus").textContent = "Select at least one rarity.";
    return;
  }
  if (!pool(language, selectedRarities).length) {
    $("filterStatus").textContent =
      "No operators match this language and rarity.";
    return;
  }
  if (selectedRarities.join() === rarities.join()) {
    $("filterDialog").close();
    return;
  }
  rarities = selectedRarities;
  save("voiceprint-rarities", rarities);
  $("filterDialog").close();
  next();
};
