/**
 * LovPlan Deployer — Content Script
 *
 * Runs on lovable.dev pages. Receives deploy commands from the popup
 * and automates prompt delivery using Lovable's chat input and Queue.
 */

const SELECTOR_VERSION = 2;
const MAX_REPEAT_COUNT = 50;
const INSERT_VERIFY_ATTEMPTS = 3;
const INSERT_VERIFY_DELAY_MS = 300;

// Flip to true in development for verbose step-by-step deploy logs. Kept
// off in releases so the user's DevTools stays clean.
const DEBUG = false;
function dlog(...args) {
  if (DEBUG) console.log("[LovPlan]", ...args);
}
function dwarn(...args) {
  if (DEBUG) console.warn("[LovPlan]", ...args);
}

let cancelRequested = false;
let pauseRequested = false;
// Queue of waiters so multiple pause/resume cycles don't leak.
let pauseWaiters = [];
let activeObservers = new Set();

window.addEventListener("beforeunload", () => {
  cancelRequested = true;
  activeObservers.forEach((o) => {
    try { o.disconnect(); } catch { /* ignore */ }
  });
  activeObservers.clear();
  const waiters = pauseWaiters.splice(0);
  waiters.forEach((resolve) => {
    try { resolve(); } catch { /* ignore */ }
  });
});

// ─── DOM Helpers (versioned selectors) ───────────────────────────────────────
//
// Strategy: stable attributes first, broader fallbacks last. If fallbacks
// trip, we log with SELECTOR_VERSION so we can tell from user reports when
// Lovable has changed their DOM.

function getChatInput() {
  // 1. data-testid (most stable across refactors, Lovable uses these).
  const byTestId =
    document.querySelector('[data-testid="chat-input"]') ||
    document.querySelector('[data-testid="prompt-input"]') ||
    document.querySelector('[data-testid="message-input"]');
  if (byTestId) return byTestId;

  // 2. aria-label with chat/prompt/message semantics.
  const byAria =
    document.querySelector('textarea[aria-label*="chat" i]') ||
    document.querySelector('textarea[aria-label*="prompt" i]') ||
    document.querySelector('textarea[aria-label*="message" i]') ||
    document.querySelector('[role="textbox"][aria-label*="chat" i]');
  if (byAria) return byAria;

  // 3. Generic fallbacks — log when tripped so we notice DOM changes.
  const generic =
    document.querySelector("textarea") ||
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('[role="textbox"]');
  if (generic) {
    console.warn(
      "[LovPlan Deployer] fallback selector used for chat input (v" +
        SELECTOR_VERSION +
        "). Lovable DOM may have changed.",
    );
    return generic;
  }
  return null;
}

function getSendButton() {
  const input = getChatInput();
  if (!input) return null;

  // 1. Explicit test-ids / aria labels.
  const explicit =
    document.querySelector('[data-testid="send-button"]') ||
    document.querySelector('[data-testid="submit-button"]') ||
    document.querySelector('button[aria-label*="send" i]:not([disabled])') ||
    document.querySelector('button[aria-label*="submit" i]:not([disabled])');
  if (explicit && !explicit.disabled) return explicit;

  // 2. Submit button inside the form wrapping the input.
  const form = input.closest("form");
  if (form) {
    const submit = form.querySelector('button[type="submit"]:not([disabled])');
    if (submit) return submit;
  }

  // No further guessing. The old "last enabled button in container" heuristic
  // matched unrelated menu buttons and sent to wrong places — better to fail
  // fast so the user knows to report a DOM change than silently click wrong.
  console.warn(
    "[LovPlan Deployer] send button not found (v" +
      SELECTOR_VERSION +
      "). Will fall back to pressing Enter.",
  );
  return null;
}

// Surface selector health to the popup so it can show "page not recognized"
// rather than proceed to a broken deploy.
function getSelectorHealth() {
  const input = getChatInput();
  const button = input ? getSendButton() : null;
  return {
    version: SELECTOR_VERSION,
    hasInput: !!input,
    hasSendButton: !!button,
    url: window.location.href,
  };
}

function insertText(element, text) {
  element.focus();

  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    element.select();
  } else {
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const ok = document.execCommand("insertText", false, text);

  if (!ok) {
    console.warn("[LovPlan Deployer] execCommand failed, using setter fallback");
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      const proto =
        element.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(element, text);
      else element.value = text;
    } else {
      // contenteditable — avoid nuking siblings by clearing then inserting.
      element.textContent = "";
      element.textContent = text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function readCurrentValue(element) {
  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    return element.value || "";
  }
  return (element.textContent || "").trim();
}

async function insertTextVerified(element, text) {
  for (let attempt = 0; attempt < INSERT_VERIFY_ATTEMPTS; attempt++) {
    insertText(element, text);
    await delay(INSERT_VERIFY_DELAY_MS);
    const current = readCurrentValue(element);
    // Allow partial match (trailing whitespace differences) — we compare on
    // the non-whitespace length being non-zero and similar.
    if (current.length > 0 && current.length >= Math.min(text.length, 1)) {
      return true;
    }
    console.warn(
      "[LovPlan Deployer] insert verification failed (attempt " +
        (attempt + 1) +
        "/" +
        INSERT_VERIFY_ATTEMPTS +
        "), retrying…",
    );
  }
  return false;
}

function waitForInput(timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 15000;
  return new Promise(function (resolve, reject) {
    const el = getChatInput();
    if (el) return resolve(el);

    let settled = false;
    const observer = new MutationObserver(function () {
      const found = getChatInput();
      if (found && !settled) {
        settled = true;
        activeObservers.delete(observer);
        observer.disconnect();
        resolve(found);
      }
    });
    activeObservers.add(observer);
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      if (!settled) {
        settled = true;
        activeObservers.delete(observer);
        observer.disconnect();
        reject(new Error("Chat input not found within " + timeoutMs + "ms"));
      }
    }, timeoutMs);
  });
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function waitWhilePaused() {
  if (!pauseRequested) return Promise.resolve();
  dlog("Paused — waiting for resume…");
  return new Promise(function (resolve) {
    pauseWaiters.push(resolve);
  });
}

function resolveAllPauseWaiters() {
  const waiters = pauseWaiters.splice(0);
  waiters.forEach((resolve) => {
    try { resolve(); } catch { /* ignore */ }
  });
}

// ─── Single-prompt send ───────────────────────────────────────────────────────

async function sendOnePrompt(index, total, promptText) {
  await waitWhilePaused();
  if (cancelRequested) return false;

  let input;
  try {
    input = await waitForInput(15000);
  } catch (e) {
    chrome.runtime.sendMessage({
      action: "deployError",
      error: "Chat input not found. Make sure you have a Lovable project open.",
    });
    return false;
  }

  dlog("[" + index + "/" + total + "] Setting text…");

  const inserted = await insertTextVerified(input, promptText);
  if (!inserted) {
    chrome.runtime.sendMessage({
      action: "deployError",
      error:
        "Could not type prompt " +
        index +
        " into the chat. Lovable's input may have changed — refresh the page and try again.",
    });
    return false;
  }

  const sendBtn = getSendButton();
  if (sendBtn) {
    dlog("[" + index + "/" + total + "] Clicking send…");
    sendBtn.click();
  } else {
    dlog("[" + index + "/" + total + "] No button, pressing Enter…");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  return true;
}

// ─── Deploy orchestration ────────────────────────────────────────────────────

function normalizeRepeatCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > MAX_REPEAT_COUNT) {
    console.warn(
      "[LovPlan Deployer] clamping repeat_count from " +
        n +
        " to " +
        MAX_REPEAT_COUNT,
    );
    return MAX_REPEAT_COUNT;
  }
  return Math.floor(n);
}

function isPromptValid(p) {
  return (
    p &&
    typeof p === "object" &&
    typeof p.prompt_text === "string" &&
    p.prompt_text.trim().length > 0
  );
}

async function deployPrompts(prompts, projectName, startFromIndex) {
  cancelRequested = false;
  pauseRequested = false;

  if (!Array.isArray(prompts) || prompts.length === 0) {
    chrome.runtime.sendMessage({
      action: "deployError",
      error: "No prompts to deploy.",
    });
    return;
  }

  const sorted = prompts
    .filter((p) => {
      if (!isPromptValid(p)) {
        // Log only an index — never dump the full prompt object, which
        // may contain sensitive spec data the user hasn't shared publicly.
        dwarn("skipping invalid prompt (index missing or blank text)");
        return false;
      }
      return true;
    })
    .slice()
    .sort(function (a, b) {
      return (a.sequence_order || 0) - (b.sequence_order || 0);
    });

  const expanded = [];
  for (let s = 0; s < sorted.length; s++) {
    const p = sorted[s];
    if (p.is_loop) {
      const count = normalizeRepeatCount(p.repeat_count);
      for (let r = 0; r < count; r++) {
        expanded.push({
          title:
            p.title +
            (count > 1 ? " (repeat " + (r + 1) + "/" + count + ")" : ""),
          prompt_text: p.prompt_text,
          sequence_order: p.sequence_order,
        });
      }
    } else {
      expanded.push(p);
    }
  }

  const total = expanded.length;
  const resumeIdx = Math.max(
    0,
    Math.min(
      Number.isFinite(startFromIndex) ? Number(startFromIndex) : 0,
      total, // clamp to total so an out-of-date resume index doesn't skip everything
    ),
  );

  if (resumeIdx >= total) {
    chrome.runtime.sendMessage({
      action: "deployError",
      error: "Resume index is past the end of the prompt list. Starting over.",
    });
    return;
  }

  // Never log projectName — it may identify the user's idea. Log the count.
  dlog(
    "Starting deployment: " +
      total +
      " prompts" +
      (resumeIdx > 0 ? " (resuming from index " + resumeIdx + ")" : ""),
  );

  for (let i = resumeIdx; i < total; i++) {
    await waitWhilePaused();
    if (cancelRequested) {
      chrome.runtime.sendMessage({ action: "deployError", error: "Deployment cancelled" });
      return;
    }

    const prompt = expanded[i];
    chrome.runtime.sendMessage({
      action: "deployProgress",
      current: i + 1,
      total: total,
      title: prompt.title,
    });

    try {
      const ok = await sendOnePrompt(i + 1, total, prompt.prompt_text);
      if (!ok) return;

      const waitTime = i === 0 ? 3000 : 1500;
      await delay(waitTime);
    } catch (err) {
      console.error(
        "[LovPlan Deployer] [" + (i + 1) + "/" + total + "] Error:",
        err,
      );
      chrome.runtime.sendMessage({
        action: "deployError",
        error: "Failed on prompt " + (i + 1) + ": " + err.message,
      });
      return;
    }
  }

  dlog("Deployment complete!");
  chrome.runtime.sendMessage({ action: "deployComplete" });
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "deploy") {
    deployPrompts(
      message.prompts,
      message.projectName,
      message.startFromIndex,
    ).catch(function (err) {
      console.error("[LovPlan Deployer] Unhandled deploy error:", err);
      chrome.runtime.sendMessage({
        action: "deployError",
        error: "Unexpected error: " + err.message,
      });
    });
    sendResponse({ started: true });
    return true;
  }

  if (message.action === "cancelDeploy") {
    cancelRequested = true;
    resolveAllPauseWaiters();
    sendResponse({ cancelled: true });
    return true;
  }

  if (message.action === "pauseDeploy") {
    pauseRequested = true;
    sendResponse({ paused: true });
    return true;
  }

  if (message.action === "resumeDeploy") {
    pauseRequested = false;
    resolveAllPauseWaiters();
    sendResponse({ resumed: true });
    return true;
  }

  if (message.action === "checkReady") {
    sendResponse({ ready: !!getChatInput(), health: getSelectorHealth() });
    return true;
  }

  if (message.action === "ping") {
    sendResponse({ pong: true, version: SELECTOR_VERSION });
    return true;
  }

  return false;
});
