/**
 * LovPlan Deployer — Content Script
 *
 * Runs on lovable.dev pages. Receives deploy commands from the popup
 * and automates prompt delivery using Lovable's chat input and Queue.
 */

const SELECTOR_VERSION = 5;
const MAX_REPEAT_COUNT = 50;
const INSERT_VERIFY_ATTEMPTS = 3;
const INSERT_VERIFY_DELAY_MS = 300;
// Max time to wait for Lovable to clear the input after a send. Lovable
// typically clears within a few seconds, but on long generations or when
// the network is slow it can take 20-30s before the input flips back to
// empty. 30s gives realistic headroom; while Lovable is visibly generating
// we extend further (see GENERATING_EXTENSION_MS).
const POST_SEND_CLEAR_TIMEOUT_MS = 30000;
const POST_SEND_POLL_INTERVAL_MS = 200;
// While Lovable shows a "Stop generating" button or similar busy indicator,
// extend the wait by this much. We treat the generating state as "Lovable
// has the prompt and is working on it" so we should wait, not error.
const GENERATING_EXTENSION_MS = 60000;
// Courtesy gap between sends so we don't hammer Lovable. Tuned small because
// the cleared-input wait already gates on actual submission.
const INTER_SEND_COURTESY_MS = 800;
// Larger gap before the very first send — Lovable's chat sometimes mounts
// asynchronously after the page settles.
const FIRST_SEND_PRELUDE_MS = 1500;
// Cap on prompt size before sending. Both Chrome message-passing and Lovable's
// own input field have practical limits beyond this.
const MAX_PROMPT_CHARS = 16000;

// v1.1.1 DEBUG BUILD: flipped on temporarily so deploy failures surface in
// the lovable.dev page console. Errors are logged unconditionally; dlog/dwarn
// gate the verbose per-step trace.
const DEBUG = true;
function dlog(...args) {
  if (DEBUG) console.log("[lovplan][content]", ...args);
}
function dwarn(...args) {
  if (DEBUG) console.warn("[lovplan][content]", ...args);
}
function derr(...args) {
  console.error("[lovplan][content]", ...args);
}

console.log("[lovplan][content] script loaded on", window.location.href);

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

// One-shot dump of every plausible chat-input candidate on the page, with
// the attributes we'd use to identify it. Triggered from getChatInput's
// fallback path so the lovable.dev page console shows us exactly what
// Lovable's current DOM looks like — paste those into the chat with us
// and we can write a precise selector instead of relying on the generic
// fallback.
let _diagDumped = false;
function dumpInputCandidates() {
  if (_diagDumped) return;
  _diagDumped = true;
  const candidates = Array.from(
    document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"], input[type="text"]'),
  );
  console.group("[lovplan][content] DOM diagnostic — input candidates on " + window.location.href);
  console.log("Total candidates:", candidates.length);
  candidates.forEach((el, i) => {
    if (!(el instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect();
    console.log(`[${i}] <${el.tagName.toLowerCase()}>`, {
      id: el.id || null,
      classList: el.className?.toString?.() || null,
      placeholder: el.getAttribute("placeholder") || (el).placeholder || null,
      ariaLabel: el.getAttribute("aria-label") || null,
      ariaPlaceholder: el.getAttribute("aria-placeholder") || null,
      role: el.getAttribute("role") || null,
      name: el.getAttribute("name") || null,
      testid: el.getAttribute("data-testid") || null,
      dataset: { ...el.dataset },
      contentEditable: el.getAttribute("contenteditable") || null,
      visibleSize: { w: Math.round(r.width), h: Math.round(r.height) },
      visible: r.width > 0 && r.height > 0,
      parentClass: el.parentElement?.className?.toString?.() || null,
      grandparentClass: el.parentElement?.parentElement?.className?.toString?.() || null,
      sample: (el.outerHTML || "").slice(0, 280),
    });
  });
  console.groupEnd();
}

let _sendDiagDumped = false;
function dumpSendButtonCandidates() {
  if (_sendDiagDumped) return;
  _sendDiagDumped = true;
  const candidates = Array.from(document.querySelectorAll("button, [role='button']"));
  const visible = candidates.filter((b) => b instanceof HTMLElement && b.offsetParent && !(b).disabled);
  console.group("[lovplan][content] DOM diagnostic — visible buttons (" + visible.length + ")");
  visible.slice(0, 30).forEach((el, i) => {
    if (!(el instanceof HTMLElement)) return;
    const r = el.getBoundingClientRect();
    console.log(`[${i}]`, {
      text: (el.textContent || "").trim().slice(0, 60),
      ariaLabel: el.getAttribute("aria-label") || null,
      testid: el.getAttribute("data-testid") || null,
      type: el.getAttribute("type") || null,
      id: el.id || null,
      classList: el.className?.toString?.() || null,
      visibleSize: { w: Math.round(r.width), h: Math.round(r.height) },
      sample: (el.outerHTML || "").slice(0, 200),
    });
  });
  console.groupEnd();
}

function getChatInput() {
  // 1. data-testid (most stable across refactors, Lovable uses these).
  const byTestId =
    document.querySelector('[data-testid="chat-input"]') ||
    document.querySelector('[data-testid="prompt-input"]') ||
    document.querySelector('[data-testid="message-input"]') ||
    document.querySelector('[data-testid*="chat" i][data-testid*="input" i]') ||
    document.querySelector('[data-testid*="prompt" i][data-testid*="input" i]');
  if (byTestId) return byTestId;

  // 2. aria-label with chat/prompt/message semantics.
  const byAria =
    document.querySelector('textarea[aria-label*="chat" i]') ||
    document.querySelector('textarea[aria-label*="prompt" i]') ||
    document.querySelector('textarea[aria-label*="message" i]') ||
    document.querySelector('[role="textbox"][aria-label*="chat" i]') ||
    document.querySelector('[contenteditable="true"][aria-label*="chat" i]') ||
    document.querySelector('[contenteditable="true"][aria-label*="prompt" i]');
  if (byAria) return byAria;

  // 3. Placeholder-based — Lovable's chat input typically has a placeholder
  // like "Ask Lovable…" / "Tell Lovable what to do…" / "Message Lovable…".
  // Match across textarea, contenteditable[aria-placeholder], and role=textbox.
  const placeholderSelectors = [
    'textarea[placeholder*="lovable" i]',
    'textarea[placeholder*="ask" i]',
    'textarea[placeholder*="tell" i]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="prompt" i]',
    '[contenteditable="true"][aria-placeholder*="lovable" i]',
    '[contenteditable="true"][aria-placeholder*="ask" i]',
    '[contenteditable="true"][aria-placeholder*="tell" i]',
    '[role="textbox"][aria-placeholder*="lovable" i]',
  ];
  for (const sel of placeholderSelectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // 4. Last-resort fallback. Among visible text-entry elements, pick the
  // one most likely to be the chat input by:
  //   * vertical position (chat inputs sit near the bottom of the viewport)
  //   * size (real chat inputs are wider than small "Other" answer fields)
  //   * NOT being inside a dialog, radiogroup, or panel labeled
  //     "Question(s)" — those are clarifying-Q&A widgets, not chat
  //   * NOT looking like a voice/transcript preview (dotted border, small)
  const viewportHeight = window.innerHeight || 800;
  const generic = Array.from(
    document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'),
  ).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 200 && r.height > 24 && el.offsetParent)) return false;
    // Exclude anything inside a Q&A / dialog / radiogroup container.
    const blockers = el.closest(
      '[role="dialog"], [role="radiogroup"], [aria-label*="question" i], [class*="question" i]',
    );
    if (blockers) return false;
    return true;
  });
  if (generic.length > 0) {
    // Score: prefer larger area + lower position. Bottom of viewport is
    // worth a lot — the chat input is almost always anchored to the bottom.
    generic.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const scoreA = ar.width * ar.height + (ar.top / viewportHeight) * 50000;
      const scoreB = br.width * br.height + (br.top / viewportHeight) * 50000;
      return scoreB - scoreA;
    });
    console.warn(
      "[LovPlan Deployer] fallback selector used for chat input (v" +
        SELECTOR_VERSION +
        "). Picked best-scored visible input outside any Q&A panel.",
    );
    dumpInputCandidates();
    return generic[0];
  }
  console.error("[LovPlan Deployer] no chat input candidates found at all on", window.location.href);
  dumpInputCandidates();
  return null;
}

// EXPLICIT-ONLY send-button finder.
//
// Earlier versions tried to be clever — "the only enabled icon-only button
// near the input is probably Send." That heuristic backfired badly: while
// Lovable is streaming a response the Send button morphs into a Stop
// button (same shape, same position, same icon-only signature). The
// retry-send path picked Stop, cancelled the generation, and then the
// next icon-only candidate happened to be the mic button which put the
// chat in voice mode.
//
// Lesson: never click an icon-only button just because it's there. Only
// click buttons we can identify by name/testid. If we can't, press Enter
// and let the chat handle it.
function getSendButton() {
  // Only explicit, named selectors. No ancestor-walk, no icon heuristic.
  const candidates = [
    '[data-testid="send-button"]',
    '[data-testid="submit-button"]',
    '[data-testid*="send" i][data-testid*="button" i]',
    'button[aria-label="Send"]',
    'button[aria-label="Send message"]',
    'button[aria-label*="send" i]:not([aria-label*="microphone" i]):not([aria-label*="voice" i]):not([aria-label*="attach" i]):not([aria-label*="file" i]):not([aria-label*="stop" i])',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && !(el).disabled && el.offsetParent) {
      return el;
    }
  }

  // Form-submit fallback — only if the form looks like a chat form (single
  // text input + a single submit button), not a search/login/random form.
  const input = getChatInput();
  if (input) {
    const form = input.closest("form");
    if (form) {
      const submit = form.querySelector('button[type="submit"]:not([disabled])');
      const inputCount = form.querySelectorAll("textarea, input[type=text], [contenteditable=true]").length;
      if (submit instanceof HTMLElement && submit.offsetParent && inputCount === 1) {
        return submit;
      }
    }
  }

  // Nothing safely identifiable. The caller falls back to pressing Enter,
  // which is how a human would normally submit anyway.
  dwarn("send button not found (v" + SELECTOR_VERSION + ") — will press Enter on the chat input instead");
  dumpSendButtonCandidates();
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
  // Check first 32 chars (substring match) so emojis / multi-byte chars that
  // render with different code-unit lengths still verify correctly.
  const probe = text.slice(0, Math.min(32, text.length));
  for (let attempt = 0; attempt < INSERT_VERIFY_ATTEMPTS; attempt++) {
    insertText(element, text);
    await delay(INSERT_VERIFY_DELAY_MS);
    const current = readCurrentValue(element);
    if (current.length > 0 && (current.includes(probe) || current.length >= Math.min(text.length, 8))) {
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

// Wait for confirmation that Lovable accepted the submission. Three success
// signals, in priority order:
//   1. Input field cleared (the cleanest signal).
//   2. New chat message appeared since send (works even when input is
//      stuck disabled-with-text after Lovable starts streaming).
//   3. Lovable enters a "generating" state (Stop button visible) — wait
//      that out, then re-check 1 and 2.
//
// Also auto-skips Lovable's clarifying-questions panel if it appears.
async function waitForInputCleared(element, timeoutMs, baselineMessageCount) {
  const deadline = Date.now() + (timeoutMs || POST_SEND_CLEAR_TIMEOUT_MS);
  let extendedDeadline = deadline;
  let skippedQuestions = false;
  let pollCount = 0;
  while (Date.now() < extendedDeadline) {
    if (cancelRequested) return false;

    const current = readCurrentValue(element).trim();
    if (current.length === 0) return true;

    // Alt success signal: a new chat message appeared since send. This
    // catches the case where Lovable kept our text in a disabled input
    // but actually accepted the prompt and is now responding.
    if (typeof baselineMessageCount === "number" && baselineMessageCount >= 0) {
      const now = getChatMessageCount();
      if (now > baselineMessageCount) {
        dlog("Detected new chat message — submission confirmed via chat history");
        return true;
      }
    }

    // While Lovable is visibly generating, push the deadline out. We don't
    // want to fail just because the model is taking a while to stream a
    // long answer.
    if (isLovableGenerating() && extendedDeadline < Date.now() + GENERATING_EXTENSION_MS) {
      extendedDeadline = Date.now() + GENERATING_EXTENSION_MS;
      dlog("Lovable is generating — extending wait deadline");
    }

    // Every ~1s, check whether Lovable has shown a questions panel and
    // skip it. Single-shot so we don't hammer the button.
    if (!skippedQuestions && pollCount % 5 === 4) {
      if (detectAndSkipLovableQuestions()) {
        skippedQuestions = true;
        await delay(400);
      }
    }

    pollCount++;
    await delay(POST_SEND_POLL_INTERVAL_MS);
  }
  return false;
}

// Heuristic Lovable inline-error detection. If Lovable shows a banner like
// "rate limited", "credit exhausted", "error", we surface that instead of
// silently advancing through the queue and burning more sends.
function detectLovableError() {
  const candidates = [
    ...document.querySelectorAll('[role="alert"]:not([hidden])'),
    ...document.querySelectorAll('[data-testid*="error" i]'),
    ...document.querySelectorAll('[class*="error-banner" i]'),
    ...document.querySelectorAll('[class*="toast" i][class*="error" i]'),
  ];
  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (!el.offsetParent && el.style.display !== "block") continue; // not visible
    const text = (el.textContent || "").trim();
    if (!text) continue;
    // Keep messages reasonable to surface; avoid scraping huge stack traces.
    return text.length > 240 ? text.slice(0, 240) + "…" : text;
  }
  return null;
}

// Count chat messages in the page. Used as an alternate success signal:
// if the input never cleared but a new user-message bubble appeared after
// our send, the prompt clearly went through. Selectors are intentionally
// broad — Lovable's exact markup varies — and we use the max of any
// matching strategy. Returns -1 if we can't reliably count anything.
function getChatMessageCount() {
  const strategies = [
    () => document.querySelectorAll('[role="article"]').length,
    () => document.querySelectorAll('[data-message-role], [data-role="user"], [data-role="assistant"]').length,
    () => document.querySelectorAll('[class*="message"][class*="user" i], [class*="message"][class*="assistant" i]').length,
    () => document.querySelectorAll('[class*="chat-message"], [class*="ChatMessage"]').length,
  ];
  let best = -1;
  for (const fn of strategies) {
    try {
      const n = fn();
      if (n > best) best = n;
    } catch { /* ignore broken selectors */ }
  }
  return best;
}

// Detect whether Lovable is visibly generating. Looks for a Stop / Cancel
// button, or a streaming/loading indicator. While true, we extend the
// input-clear wait — Lovable has the prompt and is working on it.
function isLovableGenerating() {
  const buttons = Array.from(document.querySelectorAll("button"));
  const hasStop = buttons.some((b) => {
    if (!(b instanceof HTMLElement) || !b.offsetParent) return false;
    const txt = (b.textContent || "").trim().toLowerCase();
    return txt === "stop" || txt === "stop generating" || txt.includes("stop generating");
  });
  if (hasStop) return true;
  // Loading/streaming class hints — Lovable's spinners often live on
  // elements with these class fragments. Be conservative: require a
  // visible element so a hidden CSS class doesn't false-positive.
  const loaders = document.querySelectorAll(
    '[class*="streaming" i], [class*="generating" i], [class*="loading-message" i], [aria-busy="true"]',
  );
  for (const el of loaders) {
    if (el instanceof HTMLElement && el.offsetParent) return true;
  }
  return false;
}

// Detect Lovable's clarifying-questions panel and click Skip.
// Pattern observed: a panel containing the word "Questions" + one or more
// radio choices + a "Skip" button + a "Submit" button. When auto-deploying
// LovPlan prompts (which are designed to be self-contained), skipping is
// the right call — otherwise Lovable blocks on user input forever and the
// "input never cleared" timeout fires.
function detectAndSkipLovableQuestions() {
  const buttons = Array.from(document.querySelectorAll("button"));
  // Find a visible "Skip" button next to a "Submit" button — that's the
  // signature of Lovable's questions panel. Plain "Skip" buttons elsewhere
  // (e.g., onboarding tooltips) are unlikely to also have a Submit sibling.
  const skipBtn = buttons.find((b) => {
    if (!(b instanceof HTMLElement) || !b.offsetParent) return false;
    const txt = (b.textContent || "").trim().toLowerCase();
    if (txt !== "skip") return false;
    // Look for a Submit button within the same nearest panel/section.
    const panel = b.closest('[role="dialog"], [role="region"], section, form, div');
    if (!panel) return false;
    const hasSubmit = Array.from(panel.querySelectorAll("button")).some((sib) => {
      const sibTxt = (sib.textContent || "").trim().toLowerCase();
      return sibTxt === "submit" && sib instanceof HTMLElement && sib.offsetParent;
    });
    return hasSubmit;
  });

  if (skipBtn) {
    dlog("Detected Lovable questions panel — clicking Skip to continue auto-deploy");
    try {
      skipBtn.click();
      return true;
    } catch (err) {
      derr("Failed to click Skip:", err);
      return false;
    }
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
    derr("waitForInput failed — chat input not present in DOM. URL:", window.location.href, "error:", e);
    chrome.runtime.sendMessage({
      action: "deployError",
      error: "Chat input not found. Make sure you have a Lovable project open with the chat input visible.",
    });
    return false;
  }

  // Log which element we picked so users can verify it's the actual chat
  // input — if it's the wrong one (e.g., a search box, a "Other" answer
  // field, or a voice transcript), we'll see that here before any damage.
  if (input instanceof HTMLElement) {
    const r = input.getBoundingClientRect();
    dlog("[" + index + "/" + total + "] Setting text on input:", {
      tag: input.tagName.toLowerCase(),
      placeholder: input.getAttribute("placeholder") || input.getAttribute("aria-placeholder") || null,
      ariaLabel: input.getAttribute("aria-label") || null,
      testid: input.getAttribute("data-testid") || null,
      size: `${Math.round(r.width)}x${Math.round(r.height)}`,
      bottomRel: `${Math.round((r.top / (window.innerHeight || 1)) * 100)}% from top`,
    });
  }

  const inserted = await insertTextVerified(input, promptText);
  if (!inserted) {
    derr("insertTextVerified failed for prompt", index, "input element:", input);
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

// Returns { value, clamped } so the caller can collect a warning to surface.
function normalizeRepeatCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return { value: 1, clamped: false };
  if (n > MAX_REPEAT_COUNT) {
    return { value: MAX_REPEAT_COUNT, clamped: true, original: n };
  }
  return { value: Math.floor(n), clamped: false };
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

  console.log("[lovplan][content] deployPrompts received", {
    promptCount: Array.isArray(prompts) ? prompts.length : "not-array",
    projectName,
    startFromIndex,
    url: window.location.href,
  });

  if (!Array.isArray(prompts) || prompts.length === 0) {
    derr("deployPrompts: empty prompt list");
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

  const warnings = [];
  const expanded = [];
  for (let s = 0; s < sorted.length; s++) {
    const p = sorted[s];
    let promptText = p.prompt_text;
    if (typeof promptText === "string" && promptText.length > MAX_PROMPT_CHARS) {
      warnings.push(
        `Prompt #${p.sequence_order ?? s + 1} truncated from ${promptText.length} to ${MAX_PROMPT_CHARS} chars.`,
      );
      promptText = promptText.slice(0, MAX_PROMPT_CHARS);
    }
    if (p.is_loop) {
      const norm = normalizeRepeatCount(p.repeat_count);
      if (norm.clamped) {
        warnings.push(
          `Prompt #${p.sequence_order ?? s + 1} repeat capped at ${MAX_REPEAT_COUNT} (was ${norm.original}).`,
        );
      }
      const count = norm.value;
      for (let r = 0; r < count; r++) {
        expanded.push({
          title:
            p.title +
            (count > 1 ? " (repeat " + (r + 1) + "/" + count + ")" : ""),
          prompt_text: promptText,
          sequence_order: p.sequence_order,
        });
      }
    } else {
      expanded.push({ ...p, prompt_text: promptText });
    }
  }

  if (warnings.length) {
    chrome.runtime.sendMessage({ action: "deployWarning", warnings });
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

  // Brief settle before the very first send — Lovable's chat sometimes mounts
  // asynchronously after the page reports ready.
  if (resumeIdx === 0) await delay(FIRST_SEND_PRELUDE_MS);

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
      // Snapshot the chat-message count BEFORE sending so waitForInputCleared
      // can use "new message appeared" as a fallback success signal.
      const baselineMessageCount = getChatMessageCount();
      const ok = await sendOnePrompt(i + 1, total, prompt.prompt_text);
      if (!ok) return;

      // Event-driven wait: Lovable clears the input when it accepts a
      // submission. Polling for that is the most reliable cross-version
      // signal that one repeat actually went through before firing the next.
      // This is the fix for the "repeating not working" bug — the prior
      // fixed delay caused text concatenation on fast Lovable responses.
      const inputAfter = getChatInput();
      if (inputAfter) {
        let cleared = await waitForInputCleared(inputAfter, undefined, baselineMessageCount);
        if (cancelRequested) return;

        // One-shot retry: if the input still has our text after the full
        // wait AND Lovable is NOT currently generating (clicking a Stop
        // button looks identical to clicking Send to a heuristic, and we
        // already know the icon-only-button heuristic is unsafe), re-press
        // Enter. Never click a button on retry — Enter is the only safe
        // action because it can't accidentally Stop or open Voice mode.
        if (!cleared && readCurrentValue(inputAfter).trim().length > 0) {
          if (isLovableGenerating()) {
            dwarn(`prompt ${i + 1}: input still has text but Lovable is generating — waiting it out, no retry`);
            cleared = await waitForInputCleared(inputAfter, 60000, baselineMessageCount);
          } else {
            dwarn(`prompt ${i + 1} did not clear — pressing Enter once as retry (no button click)`);
            inputAfter.focus();
            inputAfter.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true,
              }),
            );
            cleared = await waitForInputCleared(inputAfter, 15000, baselineMessageCount);
          }
          if (cancelRequested) return;
        }

        if (!cleared) {
          const lovableError = detectLovableError();
          const questionsStillUp = !!Array.from(document.querySelectorAll("button"))
            .find((b) => {
              if (!(b instanceof HTMLElement) || !b.offsetParent) return false;
              const txt = (b.textContent || "").trim().toLowerCase();
              return txt === "skip" || txt === "submit";
            });
          const errorMsg = lovableError
            ? `Lovable error after prompt ${i + 1}: ${lovableError}`
            : questionsStillUp
              ? `Prompt ${i + 1}: Lovable is asking clarifying questions and the auto-skip didn't dismiss them. Click Skip on the Questions panel manually, then resume the deploy.`
              : `Prompt ${i + 1} did not submit after retry. Lovable seems unresponsive — try refreshing the Lovable tab and resuming the deploy from the project page.`;
          derr("input did not clear after send + retry", { promptIndex: i + 1, lovableError, questionsStillUp });
          chrome.runtime.sendMessage({
            action: "deployError",
            error: errorMsg,
            lastCompletedIndex: Math.max(0, i - 1),
          });
          return;
        }
      } else {
        derr("getChatInput returned null after send for prompt", i + 1);
      }

      // Even on a clean clear, check for a freshly-mounted error banner —
      // Lovable can accept submission then surface "rate limit" inline.
      const lovableError = detectLovableError();
      if (lovableError) {
        chrome.runtime.sendMessage({
          action: "deployError",
          error: `Lovable error after prompt ${i + 1}: ${lovableError}`,
          lastCompletedIndex: i,
        });
        return;
      }

      // Confirmed-completed event — popup persists this as resume truth.
      // (deployProgress fires *before* send for UI feedback; this is the
      // authoritative "this prompt is done" signal.)
      chrome.runtime.sendMessage({
        action: "deployStepCompleted",
        completedIndex: i,
        total,
      });

      // Small courtesy gap so we don't pummel Lovable.
      await delay(INTER_SEND_COURTESY_MS);
    } catch (err) {
      console.error(
        "[LovPlan Deployer] [" + (i + 1) + "/" + total + "] Error:",
        err,
      );
      chrome.runtime.sendMessage({
        action: "deployError",
        error: "Failed on prompt " + (i + 1) + ": " + err.message,
        lastCompletedIndex: Math.max(0, i - 1),
      });
      return;
    }
  }

  dlog("Deployment complete!");
  chrome.runtime.sendMessage({ action: "deployComplete", total });
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
