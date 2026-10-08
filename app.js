import { calculate, formatNumber } from "./calculator.js";

const screen = document.querySelector("#screen");
const history = document.querySelector("#history");
const overview = document.querySelector("#overview-content");
const overviewStatus = document.querySelector("#overview-status");
const soundToggle = document.querySelector("#sound-toggle");
const soundIcon = document.querySelector("#sound-icon");
const soundLabel = document.querySelector("#sound-label");

let expression = "0";
let lastExpression = "";
let justEvaluated = false;
let soundEnabled = true;
let audioContext;
let overviewRequest = 0;

document.querySelectorAll("[data-key]").forEach((button) => {
  button.addEventListener("click", () => handleKey(button.dataset.key));
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
  soundToggle.setAttribute("aria-label", soundEnabled ? "Mute sound effects" : "Turn on sound effects");
  soundIcon.textContent = soundEnabled ? "🔊" : "🔇";
  soundLabel.textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
  if (soundEnabled) playSound("toggle");
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (/^\d$/.test(event.key) || [".", "+", "-", "*", "/", "%", "(", ")"].includes(event.key)) {
    event.preventDefault();
    handleKey(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    handleKey("=");
  } else if (event.key === "Backspace") {
    event.preventDefault();
    handleKey("DEL");
  } else if (event.key === "Escape") {
    handleKey("AC");
  }
});

function handleKey(key) {
  playSound(key);

  if (key === "=") {
    solve();
    return;
  }
  if (key === "AC") {
    overviewRequest += 1;
    expression = "0";
    lastExpression = "";
    justEvaluated = false;
    history.textContent = "READY FOR QUESTIONABLE MATH";
    setOverview("Hit the giant equals button. Get a tiny explanation. Try not to let it go to its head.", "Math is calculated right here. The AI just adds commentary.");
    render();
    return;
  }
  if (key === "DEL") {
    if (justEvaluated) {
      expression = "0";
      justEvaluated = false;
    } else {
      expression = expression.slice(0, -1) || "0";
    }
    render();
    return;
  }
  if (key === "±") {
    toggleSign();
    render();
    return;
  }
  if (/^\d$/.test(key)) {
    if (justEvaluated) {
      expression = key;
      justEvaluated = false;
    } else if (expression === "0") {
      expression = key;
    } else if (expression.endsWith(")") || expression.endsWith("%")) {
      expression += `*${key}`;
    } else {
      expression += key;
    }
    render();
    return;
  }
  if (key === ".") {
    if (justEvaluated) {
      expression = "0.";
      justEvaluated = false;
    } else if (expression.endsWith(")") || expression.endsWith("%")) {
      expression += "*0.";
    } else if (!currentNumberHasDecimal(expression)) {
      expression += /[+\-*/(]$/.test(expression) ? "0." : ".";
    }
    render();
    return;
  }
  if (key === "(") {
    if (justEvaluated) expression = "";
    if (expression === "0") expression = "";
    expression = /(?:\d|\))$/.test(expression) ? `${expression}*(` : `${expression}(`;
    justEvaluated = false;
    render();
    return;
  }
  if (key === ")") {
    if (openParenCount(expression) > closeParenCount(expression) && /(?:\d|\))$/.test(expression)) expression += ")";
    render();
    return;
  }
  if (key === "%") {
    if (/(?:\d|\))$/.test(expression)) {
      expression += "%";
      justEvaluated = false;
    }
    render();
    return;
  }
  if (["+", "-", "*", "/"].includes(key)) {
    if (justEvaluated) justEvaluated = false;
    if (expression === "0" && key === "-") expression = "-";
    else if (/[+\-*/]$/.test(expression)) expression = expression.slice(0, -1) + key;
    else if (/(?:\d|\))$/.test(expression)) expression += key;
    render();
  }
}

function toggleSign() {
  if (justEvaluated) {
    expression = expression.startsWith("-") ? expression.slice(1) : `-${expression}`;
    justEvaluated = false;
    return;
  }
  const match = expression.match(/(-?\d*\.?\d+)%?$/);
  if (match) {
    const start = match.index;
    const token = match[0];
    expression = expression.slice(0, start) + (token.startsWith("-") ? token.slice(1) : `-${token}`);
  } else if (expression.endsWith(")")) {
    expression = `-(${expression})`;
  } else if (expression === "0") {
    expression = "-";
  }
}

async function solve() {
  try {
    const original = expression;
    const result = calculate(original);
    const formatted = formatNumber(result);
    lastExpression = original;
    history.textContent = `${displayExpression(original)}  =`;
    expression = formatted;
    justEvaluated = true;
    screen.classList.remove("screen-error");
    render();
    await requestOverview(original, formatted);
  } catch (error) {
    screen.textContent = "NOPE.";
    screen.classList.add("screen-error");
    overviewRequest += 1;
    setOverview("The calculator rejected that one. Even chaos needs a valid expression.", "Fix the expression and give the big button another go.");
  }
}

async function requestOverview(original, result) {
  const requestId = ++overviewRequest;
  setOverview("The robot is thinking very hard about very little…", "Tiny AI. Tiny thoughts. One moment.");
  try {
    const response = await fetch("/api/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression: original, result }),
    });
    const payload = await response.json();
    if (!response.ok || typeof payload.overview !== "string") throw new Error("Overview unavailable.");
    if (requestId !== overviewRequest) return;
    setOverview(payload.overview, "The math was checked locally. The robot supplied the commentary.");
  } catch {
    if (requestId !== overviewRequest) return;
    setOverview("The answer is solid. The robot is currently staring at a wall.", "AI overview unavailable right now. The calculator still did the math.");
  }
}

function setOverview(text, status) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 5);
  overview.replaceChildren(...(lines.length ? lines : ["No commentary today. Math remains undefeated."]).map((line) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = line;
    return paragraph;
  }));
  overviewStatus.textContent = status;
}

function render() {
  screen.classList.remove("screen-error");
  screen.textContent = displayExpression(expression);
}

function displayExpression(value) {
  return value.replace(/(?<![eE])\*/g, " × ").replace(/(?<![eE])\//g, " ÷ ").replace(/(?<![eE])-/g, " − ").replace(/(?<![eE])\+/g, " + ");
}

function currentNumberHasDecimal(value) {
  const current = value.split(/[+\-*/()%]/).at(-1);
  return current.includes(".");
}

function openParenCount(value) { return (value.match(/\(/g) || []).length; }
function closeParenCount(value) { return (value.match(/\)/g) || []).length; }

function playSound(key) {
  if (!soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();

    const now = audioContext.currentTime;
    if (key === "=") {
      // The equals button gets a loud, goofy triple-toot with a quick pitch slide.
      const master = audioContext.createGain();
      master.gain.setValueAtTime(0.72, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      master.connect(audioContext.destination);
      [118, 176, 263].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = index === 1 ? "sawtooth" : "triangle";
        oscillator.frequency.setValueAtTime(frequency * 1.35, now + index * 0.035);
        oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.46);
        gain.gain.setValueAtTime(0.38, now + index * 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(now + index * 0.035);
        oscillator.stop(now + 0.58);
      });
      return;
    }

    const isOperator = ["+", "-", "*", "/", "%", "(", ")", "±"].includes(key);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = isOperator ? "triangle" : "sine";
    const seed = String(key).charCodeAt(0) || 65;
    const frequency = 300 + (seed % 12) * 24;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * (isOperator ? 1.65 : 0.83), now + 0.105);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  } catch {
    // Sound is decorative; audio restrictions must never block the calculator.
  }
}
