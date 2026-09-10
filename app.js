"use strict";

const STORAGE_KEY = "little-countdowns-v1";
const DAY_MS = 86400000;
const COLORS = ["#eaf0e1", "#f7eadf", "#e7eef4", "#f4e6e9", "#f5efd8", "#ebe8f2"];
const form = document.getElementById("countdown-form");
const nameInput = document.getElementById("event-name");
const dateInput = document.getElementById("target-date");
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

function todayDay() {
  const now = new Date();
  return calendarDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
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
    if (!Array.isArray(data) || !data.every(item => item && typeof item.id === "string" && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 60 && parseDate(item.date) !== null) || new Set(data.map(item => item.id)).size !== data.length) {
      throw new Error("Invalid saved countdowns");
    }
    return data;
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

function emojiFor(name) {
  const choices = [[/中秋|月亮/, "🌕"], [/国庆/, "🇨🇳"], [/生日/, "🎂"], [/旅行|旅游|出游|出发/, "✈️"], [/考试|考研|高考|中考/, "📚"], [/春节|新年|过年/, "🏮"], [/纪念|结婚|恋爱/, "💌"], [/毕业/, "🎓"], [/假期|放假/, "🌴"]];
  return choices.find(([pattern]) => pattern.test(name))?.[1] || "✨";
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  list.replaceChildren();
  const today = todayDay();
  events.forEach((event, index) => {
    const remaining = parseDate(event.date) - today;
    const card = element("article", "countdown-card" + (remaining < 0 ? " past" : remaining === 0 ? " today" : ""));
    card.style.setProperty("--card-bg", COLORS[index % COLORS.length]);
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
    const emoji = element("span", "event-emoji", emojiFor(event.name));
    emoji.setAttribute("aria-hidden", "true");
    const number = remaining === 0 ? "就是今天" : String(Math.abs(remaining));
    const date = element("time", "event-date", event.date.replaceAll("-", "."));
    date.dateTime = event.date;
    // All user-entered content is inserted as text, never HTML.
    card.append(remove, emoji, element("h3", "event-title", event.name), element("p", "day-label", remaining < 0 ? "已过去" : remaining === 0 ? "期待的日子到了" : "还有"), element("strong", "days" + (number.length > 4 && remaining !== 0 ? " long-number" : ""), number), element("span", "day-unit", remaining === 0 ? "愿今天，有美好的事情发生" : "天"), date);
    list.append(card);
  });
  document.getElementById("count").textContent = String(events.length);
  document.getElementById("empty-state").hidden = events.length > 0;
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
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  events.push({ id, name, date: dateInput.value });
  const saved = saveEvents();
  render();
  form.reset();
  if (saved) showMessage(`已收藏“${name}”，并保存在当前浏览器。`);
  nameInput.focus();
});

document.getElementById("start-button").addEventListener("click", () => nameInput.focus());
let lastDay = todayDay();
function refreshDay() {
  const current = todayDay();
  if (current !== lastDay) { lastDay = current; render(); }
}
setInterval(refreshDay, 30000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshDay(); });
window.addEventListener("focus", refreshDay);
window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY || event.key === null) { events = loadEvents(); render(); }
});
render();
