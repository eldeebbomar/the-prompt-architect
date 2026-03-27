/**
 * LovPlan Deployer — Content Script
 *
 * Runs on lovable.dev pages. Receives deploy commands from the popup
 * and automates prompt delivery using Lovable's chat input and Queue.
 *
 * Strategy:
 * 1. Send the first prompt normally (paste into textarea + click send)
 * 2. For all subsequent prompts: paste + send → they auto-queue because Lovable is busy
 * 3. Loop prompts are pasted repeat_count times (simple & reliable)
 */

console.log("[LovPlan Deployer] Content script loaded on", window.location.href);

let cancelRequested = false;
let pauseRequested = false;
let pauseResolve = null; // resolve function for the pause promise

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function getChatInput() {
  return (
    document.querySelector("textarea") ||
    document.querySelector('[contenteditable="true"]') ||
    document.querySelector('[role="textbox"]') ||
    null
  );
}

function getSendButton() {
  const input = getChatInput();
  if (!input) return null;

  const container =
    input.closest("form") ||
    input.closest('[class*="chat"]') ||
    input.parentElement?.parentElement?.parentElement;

  if (!container) return null;

  // Use Array.from to avoid "Illegal invocation" with NodeList iteration
  const buttons = Array.from(container.querySelectorAll("button"));

  // Strategy 1: button with type="submit"
  for (let i = 0; i < buttons.length; i++) {
    if (buttons[i].type === "submit" && !buttons[i].disabled) return buttons[i];
  }

  // Strategy 2: last non-disabled button with an SVG (send icon)
  let candidate = null;
  for (let i = 0; i < buttons.length; i++) {
    if (!buttons[i].disabled && buttons[i].querySelector("svg")) {
      candidate = buttons[i];
    }
  }
  if (candidate) return candidate;

  // Strategy 3: last enabled button
  for (let i = buttons.length - 1; i >= 0; i--) {
    if (!buttons[i].disabled) return buttons[i];
  }

  return null;
}

/**
 * Insert text into the chat input.
 * Uses execCommand('insertText') which triggers real browser InputEvents
 * that React picks up natively.
 */
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
      element.textContent = text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function waitForInput(timeoutMs) {
  if (timeoutMs === undefined) timeoutMs = 15000;
  return new Promise(function (resolve, reject) {
    var el = getChatInput();
    if (el) return resolve(el);

    var observer = new MutationObserver(function () {
      var found = getChatInput();
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(function () {
      observer.disconnect();
      reject(new Error("Chat input not found within " + timeoutMs + "ms"));
    }, timeoutMs);
  });
}

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Wait while paused. Returns immediately if not paused.
 */
function waitWhilePaused() {
  if (!pauseRequested) return Promise.resolve();
  console.log("[LovPlan Deployer] Paused — waiting for resume...");
  return new Promise(function (resolve) {
    pauseResolve = resolve;
  });
}

// ─── Send a single prompt ────────────────────────────────────────────────────

async function sendOnePrompt(index, total, promptText) {
  // Wait if paused
  await waitWhilePaused();
  if (cancelRequested) return false;

  var input;
  try {
    input = await waitForInput(15000);
  } catch (e) {
    chrome.runtime.sendMessage({
      action: "deployError",
      error: "Chat input not found. Make sure you have a Lovable project open.",
    });
    return false;
  }

  console.log("[LovPlan Deployer] [" + index + "/" + total + "] Setting text...");

  insertText(input, promptText);
  await delay(500);

  // Verify text was set (textarea/input only)
  if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
    if (!input.value) {
      console.warn("[LovPlan Deployer] [" + index + "/" + total + "] Value not set, retrying...");
      var proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, "value");
      if (setter && setter.set) setter.set.call(input, promptText);
      else input.value = promptText;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await delay(300);
    }
  }

  var sendBtn = getSendButton();
  if (sendBtn) {
    console.log("[LovPlan Deployer] [" + index + "/" + total + "] Clicking send...");
    sendBtn.click();
  } else {
    console.log("[LovPlan Deployer] [" + index + "/" + total + "] No button, pressing Enter...");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  return true; // success
}

// ─── Deploy Logic ─────────────────────────────────────────────────────────────

async function deployPrompts(prompts, projectName, startFromIndex) {
  cancelRequested = false;
  pauseRequested = false;

  var sorted = prompts.slice().sort(function (a, b) { return a.sequence_order - b.sequence_order; });

  // Expand loop prompts: paste them repeat_count times instead of using repeat menu
  var expanded = [];
  for (var s = 0; s < sorted.length; s++) {
    var p = sorted[s];
    if (p.is_loop && p.repeat_count && p.repeat_count > 1) {
      for (var r = 0; r < p.repeat_count; r++) {
        expanded.push({
          title: p.title + (p.repeat_count > 1 ? " (repeat " + (r + 1) + "/" + p.repeat_count + ")" : ""),
          prompt_text: p.prompt_text,
          sequence_order: p.sequence_order,
        });
      }
    } else {
      expanded.push(p);
    }
  }

  var total = expanded.length;
  var resumeIdx = startFromIndex || 0;
  console.log("[LovPlan Deployer] Starting deployment: " + total + " prompts (expanded) for \"" + projectName + "\"" + (resumeIdx > 0 ? " — resuming from index " + resumeIdx : ""));

  for (var i = resumeIdx; i < total; i++) {
    // Check cancel/pause before each prompt
    await waitWhilePaused();
    if (cancelRequested) {
      chrome.runtime.sendMessage({ action: "deployError", error: "Deployment cancelled" });
      return;
    }

    var prompt = expanded[i];

    // Report progress
    chrome.runtime.sendMessage({
      action: "deployProgress",
      current: i + 1,
      total: total,
      title: prompt.title,
    });

    try {
      var ok = await sendOnePrompt(i + 1, total, prompt.prompt_text);
      if (!ok) return; // error already reported

      // Wait between prompts
      var waitTime = i === 0 ? 3000 : 1500;
      console.log("[LovPlan Deployer] [" + (i + 1) + "/" + total + "] Waiting " + waitTime + "ms...");
      await delay(waitTime);
    } catch (err) {
      console.error("[LovPlan Deployer] [" + (i + 1) + "/" + total + "] Error:", err);
      chrome.runtime.sendMessage({
        action: "deployError",
        error: "Failed on prompt " + (i + 1) + ": " + err.message,
      });
      return;
    }
  }

  console.log("[LovPlan Deployer] Deployment complete!");
  chrome.runtime.sendMessage({ action: "deployComplete" });
}

// ─── Message Listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action === "deploy") {
    deployPrompts(message.prompts, message.projectName, message.startFromIndex).catch(function (err) {
      console.error("[LovPlan Deployer] Unhandled deploy error:", err);
      chrome.runtime.sendMessage({
        action: "deployError",
        error: "Unexpected error: " + err.message,
      });
    });
    sendResponse({ started: true });
  }

  if (message.action === "cancelDeploy") {
    cancelRequested = true;
    // Also unblock if paused
    if (pauseResolve) {
      pauseResolve();
      pauseResolve = null;
    }
    sendResponse({ cancelled: true });
  }

  if (message.action === "pauseDeploy") {
    pauseRequested = true;
    console.log("[LovPlan Deployer] Pause requested");
    sendResponse({ paused: true });
  }

  if (message.action === "resumeDeploy") {
    pauseRequested = false;
    console.log("[LovPlan Deployer] Resume requested");
    if (pauseResolve) {
      pauseResolve();
      pauseResolve = null;
    }
    sendResponse({ resumed: true });
  }

  if (message.action === "checkReady") {
    sendResponse({ ready: !!getChatInput() });
  }

  return true;
});
