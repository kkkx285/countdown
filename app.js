"use strict";

const STORAGE_KEY = "little-countdowns-v1";
const DAY_MS = 86400000;
const form = document.getElementById("countdown-form");
const nameInput = document.getElementById("event-name");
const dateInput = document.getElementById("target-date");
const timeInput = document.getElementById("target-time");
const list = document.getElementById("countdown-list");
const message = document.getElementById("form-message");

// Convert calendar components to an integer day; elapsed hours and DST do not matter.
function calendarDay(year, month, day) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() / DAY_MS;
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const result = calendarDay(year, month, day);
  const check = new Date(result * DAY_MS);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? result : null;
}

function normalizeTime(value) {
  if (value === undefined || value === "") return "00:00:00";
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)) return null;
  return value.length === 5 ? `${value}:00` : value;
}

function targetTimestamp(dateValue, timeValue) {
  const time = normalizeTime(timeValue);
  if (parseDate(dateValue) === null || time === null) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const target = new Date(0);
  target.setFullYear(year, month - 1, day);
  target.setHours(hour, minute, second, 0);
  // Reject local wall-clock times skipped by a daylight-saving transition.
  if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day || target.getHours() !== hour || target.getMinutes() !== minute || target.getSeconds() !== second) return null;
  return target.getTime();
}

function countdownParts(target, now) {
  const difference = target - now;
  const reached = difference <= 0;
  // Round future fractions up so 00:00:00 never appears before the target.
  const total = reached ? Math.floor(-difference / 1000) : Math.ceil(difference / 1000);
  return { reached, days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.classList.toggle("error", error);
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(item => item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 60 && targetTimestamp(item.date, item.time) !== null) || new Set(data.map(item => item.id)).size !== data.length) {
      throw new Error("Invalid saved countdowns");
    }
    return data.map(item => ({ ...item, time: normalizeTime(item.time) }));
  } catch {
    showMessage("无法读取本地记录。你仍可使用；新建并成功保存后将替换原有记录。", true);
    return [];
  }
}

let events = loadEvents();

function saveEvents() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch {
    showMessage("本次更改仅在当前页面生效：浏览器无法保存数据，请检查存储权限或空间。", true);
    return false;
  }
}

function themeFor(name) {
  // First match wins; themes are derived from names, never saved in storage.
  const themes = [
    { pattern: /中秋|月亮|赏月|满月|月圆/, id: "moon", emoji: "🌕" },
    { pattern: /生日/, id: "birthday", emoji: "🎂" },
    { pattern: /旅行|旅游|出游|出发|去玩/, id: "travel", emoji: "✈️" },
    { pattern: /国庆/, id: "national", emoji: "🇨🇳" },
    { pattern: /考试|学习|考研|高考|中考/, id: "study", emoji: "📚" },
    { pattern: /发工资|发薪|工资到账/, id: "payday", emoji: "💰" },
    { pattern: /圣诞|平安夜/, id: "christmas", emoji: "🎄" }
  ];
  return themes.find(theme => theme.pattern.test(name)) || { id: "default", emoji: "✨" };
}

function countdownLabel(remainingMs) {
  if (remainingMs <= 0) return "到啦 🎉";
  if (remainingMs < DAY_MS) return "就在今天";
  if (remainingMs < 2 * DAY_MS) return "就是明天 ✨";
  if (remainingMs < 8 * DAY_MS) return "快要到啦";
  if (remainingMs <= 30 * DAY_MS) return "还有";
  return "慢慢期待";
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

let clockViews = [];

function updateClocks() {
  const now = Date.now();
  for (const view of clockViews) {
    const parts = countdownParts(view.target, now);
    view.card.classList.toggle("past", parts.reached);
    view.arrival.hidden = !parts.reached;
    const label = countdownLabel(view.target - now);
    view.arrival.textContent = parts.reached ? label : "";
    view.label.textContent = parts.reached ? "已过去" : label;
    view.days.textContent = String(parts.days);
    view.days.classList.toggle("long-number", String(parts.days).length > 4);
    [parts.hours, parts.minutes, parts.seconds].forEach((value, index) => {
      view.digits[index].textContent = String(value).padStart(2, "0");
    });
  }
}

function render() {
  list.replaceChildren();
  clockViews = [];
  events.forEach((event, index) => {
    const theme = themeFor(event.name);
    const card = element("article", `countdown-card theme-${theme.id}`);
    const remove = element("button", "delete-button");
    remove.type = "button";
    remove.setAttribute("aria-label", `删除“${event.name}”倒计时`);
    remove.title = "删除倒计时";
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>';
    remove.addEventListener("click", () => {
      events = events.filter(item => item.id !== event.id);
      const saved = saveEvents();
      render();
      if (saved) showMessage(`已删除“${event.name}”。`);
      const buttons = list.querySelectorAll(".delete-button");
      (buttons[Math.min(index, buttons.length - 1)] || nameInput).focus();
    });
    const emoji = element("span", "event-emoji", theme.emoji);
    emoji.setAttribute("aria-hidden", "true");
    const time = normalizeTime(event.time);
    const date = element("time", "event-date", `${event.date.replaceAll("-", ".")} ${time}`);
    date.dateTime = `${event.date}T${time}`;
    const arrival = element("p", "arrival-message");
    const label = element("p", "day-label");
    const days = element("strong", "days");
    const dayRow = element("div", "day-row");
    dayRow.append(days, element("span", "day-unit", "天"));
    const clock = element("div", "clock-row");
    const digits = ["时", "分", "秒"].map((unit, index) => {
      if (index > 0) {
        const colon = element("span", "clock-colon", ":");
        colon.setAttribute("aria-hidden", "true");
        clock.append(colon);
      }
      const part = element("span", "clock-part");
      const digit = element("strong", "clock-digit");
      part.append(digit, element("span", "clock-unit", unit));
      clock.append(part);
      return digit;
    });
    // All user-entered content is inserted as text, never HTML.
    card.append(remove, emoji, element("h3", "event-title", event.name), arrival, label, dayRow, clock, date);
    clockViews.push({ card, arrival, label, days, digits, target: targetTimestamp(event.date, time) });
    list.append(card);
  });
  document.getElementById("count").textContent = String(events.length);
  document.getElementById("empty-state").hidden = events.length > 0;
  updateClocks();
}

nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));
form.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.setCustomValidity("请填写事件名称，不能只有空格。");
    nameInput.reportValidity();
    return;
  }
  if (parseDate(dateInput.value) === null) {
    showMessage("请选择有效的目标日期。", true);
    dateInput.focus();
    return;
  }
  const time = normalizeTime(timeInput.value);
  if (targetTimestamp(dateInput.value, time) === null) {
    showMessage("请选择有效的本地时间（部分夏令时切换时刻不存在）。", true);
    timeInput.focus();
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  events.push({ id, name, date: dateInput.value, time });
  const saved = saveEvents();
  render();
  form.reset();
  if (saved) showMessage(`已收藏“${name}”，并保存在当前浏览器。`);
  nameInput.focus();
});

document.getElementById("start-button").addEventListener("click", () => nameInput.focus());
// Update text only: keep cards, animations and keyboard focus stable.
// Always subtract the real current time, including after background throttling.
setInterval(updateClocks, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) updateClocks(); });
window.addEventListener("focus", updateClocks);
window.addEventListener("pageshow", updateClocks);
window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY || event.key === null) { events = loadEvents(); render(); }
});
render();
