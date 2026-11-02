import { chooseOperator, chooseLines, recordResult } from "./core.js";
const $ = (id) => document.getElementById(id),
  audio = new Audio(),
  LIMIT = 5;
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
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
const savedLanguage = read("voiceprint-language", "JP");
if (["JP", "EN", "CN", "KR"].includes(savedLanguage)) language = savedLanguage;
const blankStats = () => ({
  played: 0,
  won: 0,
  streak: 0,
  best: 0,
  distribution: [0, 0, 0, 0, 0],
});
let allStats = read("voiceprint-language-stats", {}),
  stats = allStats[language] || blankStats(),
  recent = read("voiceprint-recent", []),
  clipReady = Promise.resolve(),
  clipVersion = 0,
  seeking = false;
const clips = new Map();
function stop() {
  audio.pause();
  $("play").textContent = "▶";
  $("play").setAttribute("aria-label", "Play voice line");
}
function loadClip() {
  const path = operator.voices[language]?.[roundLines[selected]];
  if (!path) return false;
  if (loaded !== path) {
    stop();
    loaded = path;
    const version = ++clipVersion;
    $("progress").disabled = true;
    $("progress").value = 0;
    $("elapsed").textContent = "0:00";
    $("duration").textContent = "0:00";
    if (!clips.has(path))
      clips.set(
        path,
        fetch(path)
          .then((r) => {
            if (!r.ok) throw Error("Audio unavailable");
            return r.blob();
          })
          .then((blob) => URL.createObjectURL(blob)),
      );
    clipReady = clips.get(path).then(
      (url) =>
        new Promise((resolve) => {
          if (version !== clipVersion) return resolve(false);
          audio.src = url;
          audio.onloadedmetadata = () => {
            if (version === clipVersion) {
              $("duration").textContent = timeLabel(audio.duration);
              $("progress").disabled = false;
            }
            resolve(version === clipVersion);
          };
          audio.load();
        }),
    );
    clipReady.catch(() => {
      $("audioStatus").textContent = "Audio unavailable. Please reload.";
    });
  }
  return true;
}
async function play() {
  if (!loadClip()) return;
  try {
    const version = clipVersion;
    if (!(await clipReady) || version !== clipVersion) return;
    await audio.play();
    $("play").textContent = "Ⅱ";
    $("play").setAttribute("aria-label", "Pause voice line");
    $("audioStatus").textContent = `Playing voice line ${selected + 1}`;
  } catch {
    $("audioStatus").textContent =
      "Unable to play audio. Please press play to retry.";
  }
}
function render() {
  $("counter").textContent = `ATTEMPT ${attempt + 1} / ${LIMIT}`;
  $("steps").replaceChildren();
  for (let i = 0; i < LIMIT; i++) {
    const b = document.createElement("button"),
      r = results[i];
    b.innerHTML = `<strong>${i + 1}</strong><span>${i === 0 ? "Arknights" : "Voice line " + (i + 1)}</span>`;
    if (r) {
      const tag = document.createElement("span");
      tag.className = "result-label";
      tag.textContent = r.label;
      b.append(tag);
    }
    const won = ended && results.some((result) => result?.kind === "success");
    b.disabled = won ? false : i > attempt + 1 || (ended && i > attempt);
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
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === language));
    b.disabled = !data.operators.some((o) => o.voices[b.dataset.lang]);
  });
}
function choose() {
  return chooseOperator(data.operators, language, recent);
}
function next(autoplay = false) {
  stop();
  for (const promise of clips.values())
    promise.then((url) => URL.revokeObjectURL(url)).catch(() => {});
  clips.clear();
  operator = choose();
  roundLines = chooseLines(operator, language);
  recent.push(operator.id);
  recent = recent.slice(-20);
  save("voiceprint-recent", recent);
  attempt = selected = hintCount = 0;
  ended = false;
  results = [];
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
  if (ended) return;
  ended = true;
  stop();
  stats = recordResult(stats, won, attempt);
  allStats[language] = stats;
  save("voiceprint-language-stats", allStats);
  $("message").className = won ? "success" : "failure";
  $("message").replaceChildren();
  const img = document.createElement("img");
  img.src = operator.avatar;
  img.alt = operator.name;
  const text = document.createElement("div");
  text.textContent = `${won ? "Identified" : "Answer"}: ${operator.name} · ${operator.rarity}★ ${operator.class} · ${operator.race} / ${operator.faction}`;
  $("message").append(img, text);
  closeSearch();
  render();
}
function advance(label, kind = "failure") {
  results[attempt] = { label, kind };
  stop();
  if (attempt === LIMIT - 1) finish(false);
  else {
    attempt++;
    selected = attempt;
    render();
    loadClip();
    play();
  }
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
  if (!$("guess").value.trim()) {
    closeSearch();
    return;
  }
  matches = data.operators.filter(
    (o) =>
      o.voices[language] &&
      o.name.toLowerCase().includes($("guess").value.trim().toLowerCase()),
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
    b.append(img, name);
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
  if (ended) return;
  const candidate = data.operators.find(
    (o) => o.name.toLowerCase() === $("guess").value.trim().toLowerCase(),
  );
  if (!candidate) {
    $("message").textContent = "Select an operator from the list.";
    return;
  }
  closeSearch();
  $("message").textContent = "";
  $("guess").value = "";
  if (candidate.id === operator.id) {
    results[attempt] = {
      label: candidate.name + " · Correct",
      kind: "success",
    };
    finish(true);
  } else advance(candidate.name + " · Incorrect");
};
$("play").onclick = () => (audio.paused ? play() : stop());
audio.onended = stop;
$("skip").onclick = () => advance("Skipped");
$("giveup").onclick = () => {
  results[attempt] = { label: "Gave up", kind: "failure" };
  finish(false);
};
$("next").onclick = () => next(true);
$("hint").onclick = () => {
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
  hintCount++;
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
  if (code !== language) changeLanguage(code);
}
$("help").onclick = () => $("instructions").showModal();
function showStatistics(code) {
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
  .then((r) => r.json())
  .then((d) => {
    data = d;
    $("rosterInfo").textContent =
      `${data.operators.length} Global operators · Alternate forms grouped`;
    next();
  })
  .catch(() => {
    $("message").textContent = "Unable to load game data. Please reload.";
  });

const backgroundRequest = indexedDB.open("voiceprint-settings", 1);
let backgroundDB;
backgroundRequest.onupgradeneeded = () =>
  backgroundRequest.result.createObjectStore("settings");
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
backgroundRequest.onsuccess = () => {
  backgroundDB = backgroundRequest.result;
  const request = backgroundDB
    .transaction("settings")
    .objectStore("settings")
    .get("background");
  request.onsuccess = () => {
    if (request.result) displayBackground(request.result);
  };
};
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
    $("backgroundStatus").textContent = "Background saved in this browser.";
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
