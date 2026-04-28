/**
 * LovPlan Deployer — Popup Script
 *
 * Manages UI state, communicates with background service worker for API calls,
 * and sends deploy commands to the content script on lovable.dev tabs.
 */

// ─── Screen Management ───────────────────────────────────────────────────────

const screens = {
  loading: document.getElementById("loading-screen"),
  link: document.getElementById("link-screen"),
  projects: document.getElementById("projects-screen"),
  prompts: document.getElementById("prompts-screen"),
  deploy: document.getElementById("deploy-screen"),
  complete: document.getElementById("complete-screen"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el && el.classList.add("hidden"));
  screens[name] && screens[name].classList.remove("hidden");
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentProjects = [];
let currentPrompts = [];
let selectedProjectId = null;
let selectedProjectName = "";
let activeProgressListener = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  showScreen("loading");
  try {
    const state = await sendMessage({ action: "getAuthState" });
    if (state.error) throw new Error(state.error);

    if (state.linked) {
      showUserInfo(state.user);
      const banner = document.getElementById("link-error");
      if (banner && state.lastError) {
        banner.textContent = state.lastError;
        banner.classList.remove("hidden");
        await sendMessage({ action: "clearLastError" });
      }
      await loadProjects();
      showScreen("projects");
    } else {
      showScreen("link");
      setupCodeInputs();
      if (state.lastError) {
        const errEl = document.getElementById("link-error");
        if (errEl) {
          errEl.textContent = state.lastError;
          errEl.classList.remove("hidden");
        }
        await sendMessage({ action: "clearLastError" });
      }
    }
  } catch {
    showScreen("link");
    setupCodeInputs();
  }
}

init();

window.addEventListener("unload", () => {
  if (activeProgressListener) {
    chrome.runtime.onMessage.removeListener(activeProgressListener);
    activeProgressListener = null;
  }
});

// ─── Helper: send message to background ──────────────────────────────────────

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { error: "No response" });
    });
  });
}

// ─── Link Screen ──────────────────────────────────────────────────────────────

function setupCodeInputs() {
  const inputs = document.querySelectorAll("#code-inputs input");
  const linkBtn = document.getElementById("link-btn");
  if (!linkBtn) return;

  inputs.forEach((input, idx) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val;
      if (val && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
      updateLinkButton();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !e.target.value && idx > 0) {
        inputs[idx - 1].focus();
      }
      if (e.key === "Enter") {
        linkBtn.click();
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      for (let i = 0; i < pasted.length && i < inputs.length; i++) {
        inputs[i].value = pasted[i];
      }
      if (pasted.length > 0) {
        const focusIdx = Math.min(pasted.length, inputs.length - 1);
        inputs[focusIdx].focus();
      }
      updateLinkButton();
    });
  });

  inputs[0]?.focus();

  function updateLinkButton() {
    linkBtn.disabled = getCode().length !== 6;
  }
}

function getCode() {
  const inputs = document.querySelectorAll("#code-inputs input");
  return Array.from(inputs).map((i) => i.value).join("");
}

document.getElementById("link-btn")?.addEventListener("click", async () => {
  const code = getCode();
  if (code.length !== 6) return;

  const btn = document.getElementById("link-btn");
  const errEl = document.getElementById("link-error");
  btn.disabled = true;
  btn.textContent = "Linking...";
  errEl && errEl.classList.add("hidden");

  const result = await sendMessage({ action: "verifyCode", code });

  if (result.error) {
    if (errEl) {
      // Differentiate common error shapes for better UX.
      const lower = (result.error || "").toLowerCase();
      if (lower.includes("expired") || lower.includes("invalid")) {
        errEl.textContent = "Code invalid or expired. Generate a new one from your dashboard.";
      } else if (result.code === "subscription_required") {
        errEl.textContent = "The Chrome extension requires a paid plan.";
      } else {
        errEl.textContent = result.error;
      }
      errEl.classList.remove("hidden");
    }
    btn.disabled = false;
    btn.textContent = "Link Account";
    return;
  }

  showUserInfo(result.user);
  await loadProjects();
  showScreen("projects");
});

// ─── Projects Screen ──────────────────────────────────────────────────────────

function showUserInfo(user) {
  if (!user) return;
  const emailEl = document.getElementById("user-email");
  if (emailEl) emailEl.textContent = user.email || "";
  const planEl = document.getElementById("user-plan");
  if (!planEl) return;
  const planLabels = { unlimited: "Unlimited", pack: "5-Pack", "5-pack": "5-Pack", single: "Single" };
  planEl.textContent = planLabels[user.plan] || user.plan || "Paid";
}

async function loadProjects() {
  const listEl = document.getElementById("project-list");
  if (!listEl) return;
  listEl.innerHTML = '<div class="spinner"></div>';

  const result = await sendMessage({ action: "getProjects" });
  if (result.error) {
    // 401 from the background clears the token — re-check auth state and
    // bounce back to the link screen so the user has a way forward.
    const unauthorized =
      result.code === "unauthorized" ||
      result.code === "session_expired" ||
      /unauthor|session.*(expired|invalid)|re-?link/i.test(result.error || "");
    if (unauthorized) {
      const state = await sendMessage({ action: "getAuthState" });
      if (!state.linked) {
        showScreen("link");
        setupCodeInputs();
        const errEl = document.getElementById("link-error");
        if (errEl) {
          errEl.textContent =
            state.lastError || "Session expired. Please re-link.";
          errEl.classList.remove("hidden");
          sendMessage({ action: "clearLastError" });
        }
        return;
      }
    }

    if (result.code === "subscription_required") {
      listEl.innerHTML =
        '<p class="empty-state">Extension access requires an active paid plan. <a href="https://lovplan.com/pricing" target="_blank" rel="noopener">Manage subscription</a>.</p>';
    } else {
      listEl.innerHTML = `<p class="empty-state">${escapeHtml(result.error)}</p>`;
    }
    return;
  }

  currentProjects = Array.isArray(result.projects) ? result.projects : [];
  if (currentProjects.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No projects with generated prompts yet.</p>';
    return;
  }

  listEl.innerHTML = currentProjects
    .map(
      (p) => `
      <div class="project-card" data-id="${escapeHtml(p.id || "")}">
        <div class="project-name">${escapeHtml(p.name || "Untitled")}</div>
        <div class="project-meta">
          <span>${Number(p.prompt_count) || 0} prompts</span>
          <span class="status-pill status-${escapeHtml(p.status || "")}">${escapeHtml(p.status || "")}</span>
        </div>
      </div>
    `,
    )
    .join("");

  listEl.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const project = currentProjects.find((p) => p.id === id);
      if (project) openProject(project);
    });
  });
}

document.getElementById("unlink-btn")?.addEventListener("click", async () => {
  await sendMessage({ action: "unlink" });
  showScreen("link");
  setupCodeInputs();
});

// ─── Prompts Screen ───────────────────────────────────────────────────────────

async function openProject(project) {
  selectedProjectId = project.id;
  selectedProjectName = project.name;
  document.getElementById("project-title").textContent = project.name;

  const listEl = document.getElementById("prompt-list");
  listEl.innerHTML = '<div class="spinner"></div>';
  showScreen("prompts");

  const result = await sendMessage({ action: "getPrompts", projectId: project.id });
  if (result.error) {
    listEl.innerHTML = `<p class="empty-state">${escapeHtml(result.error)}</p>`;
    return;
  }

  currentPrompts = Array.isArray(result.prompts) ? result.prompts : [];
  listEl.innerHTML = currentPrompts
    .map(
      (p) => `
      <div class="prompt-item">
        <span class="prompt-seq">${escapeHtml(String(p.sequence_order ?? ""))}</span>
        <span class="prompt-title">${escapeHtml(p.title || "")}</span>
        ${p.is_loop ? `<span class="loop-badge">Loop x${Number(p.repeat_count) || 2}</span>` : ""}
      </div>
    `,
    )
    .join("");

  await checkResumeState();
  await updateDeployButton();
}

async function checkResumeState() {
  const resumeKey = `deploy_progress_${selectedProjectId}`;
  const stored = await chrome.storage.local.get(resumeKey);
  const saved = stored[resumeKey];

  const resumeEl = document.getElementById("resume-banner");
  if (!resumeEl) return;

  // Validate saved state: must be a real object with an index in range.
  const promptTotal = currentPrompts.length;
  const isValidResume =
    saved &&
    typeof saved === "object" &&
    Number.isFinite(saved.lastCompletedIndex) &&
    saved.lastCompletedIndex >= 0 &&
    saved.lastCompletedIndex < promptTotal - 1 &&
    Number.isFinite(saved.total) &&
    saved.total === promptTotal;

  if (isValidResume) {
    // Build via DOM API, not innerHTML, so there is zero way for stored
    // values to ever be interpreted as markup even if the validator upstream
    // drifts.
    resumeEl.textContent = "";

    const p = document.createElement("p");
    p.textContent = `Previous deployment stopped at prompt ${saved.lastCompletedIndex + 1}/${saved.total}`;

    const actions = document.createElement("div");
    actions.className = "resume-actions";

    const resumeBtn = document.createElement("button");
    resumeBtn.id = "resume-deploy-btn";
    resumeBtn.className = "btn btn-primary btn-sm";
    resumeBtn.textContent = `Resume from #${saved.lastCompletedIndex + 2}`;
    resumeBtn.addEventListener("click", async () => {
      // Pre-flight: if the session token expired while paused, route to the
      // link screen with a clear message and preserve the resume index so
      // it auto-resumes after re-link.
      const me = await sendMessage({ action: "getMe" });
      if (me.error) {
        const unauthorized =
          me.code === "unauthorized" ||
          me.code === "session_expired" ||
          /unauthor|session.*(expired|invalid)|re-?link/i.test(me.error || "");
        if (unauthorized) {
          showScreen("link");
          setupCodeInputs();
          const errEl = document.getElementById("link-error");
          if (errEl) {
            errEl.textContent = "Your link expired — re-link to resume your deploy.";
            errEl.classList.remove("hidden");
          }
          return;
        }
      }
      resumeEl.classList.add("hidden");
      startDeploy(saved.lastCompletedIndex + 1);
    });

    const discardBtn = document.createElement("button");
    discardBtn.id = "discard-resume-btn";
    discardBtn.className = "btn btn-ghost btn-sm";
    discardBtn.textContent = "Start Over";
    discardBtn.addEventListener("click", async () => {
      await chrome.storage.local.remove(resumeKey);
      resumeEl.classList.add("hidden");
    });

    actions.appendChild(resumeBtn);
    actions.appendChild(discardBtn);
    resumeEl.appendChild(p);
    resumeEl.appendChild(actions);
    resumeEl.classList.remove("hidden");
  } else {
    if (saved) {
      // Drop any stale/mismatched state so it doesn't accumulate.
      await chrome.storage.local.remove(resumeKey);
    }
    resumeEl.classList.add("hidden");
  }
}

async function getLovableTab() {
  // Two passes: (1) preferred — active tab in the current window that
  // matches lovable.dev (apex or any subdomain); (2) fallback — any
  // lovable.dev tab anywhere. Returned Tab objects don't carry a
  // `currentWindow` field, so we query with that filter instead of
  // post-filtering. Subdomain match covers cases where Lovable serves
  // the editor on www.lovable.dev or similar.
  const matchUrls = ["https://lovable.dev/*", "https://*.lovable.dev/*"];

  const active = await chrome.tabs.query({
    url: matchUrls,
    active: true,
    currentWindow: true,
  });
  console.log("[lovplan][popup] getLovableTab active query:", active.length, active.map((t) => t.url));
  if (active.length) return active[0];

  const anyLovable = await chrome.tabs.query({ url: matchUrls });
  console.log("[lovplan][popup] getLovableTab fallback query:", anyLovable.length, anyLovable.map((t) => t.url));
  if (!anyLovable.length) return null;

  const anyActive = anyLovable.find((t) => t.active);
  return anyActive || anyLovable[0];
}

async function updateDeployButton() {
  const btn = document.getElementById("deploy-btn");
  const note = document.getElementById("deploy-note");
  if (!btn || !note) return;

  const tab = await getLovableTab();
  if (tab) {
    btn.disabled = false;
    note.classList.add("hidden");
  } else {
    btn.disabled = true;
    note.textContent = "Open a Lovable project first";
    note.classList.remove("hidden");
  }
}

document.getElementById("back-btn")?.addEventListener("click", () => {
  showScreen("projects");
});

document.getElementById("deploy-btn")?.addEventListener("click", () => startDeploy(0));

// ─── Deploy ───────────────────────────────────────────────────────────────────

let isPaused = false;

async function pingTab(tabId, timeoutMs = 500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn("[lovplan][popup] pingTab timeout", { tabId, timeoutMs });
      resolve(false);
    }, timeoutMs);
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        console.warn("[lovplan][popup] pingTab runtime.lastError:", chrome.runtime.lastError.message);
        resolve(false);
      } else if (!response) {
        console.warn("[lovplan][popup] pingTab no response");
        resolve(false);
      } else {
        console.log("[lovplan][popup] pingTab pong:", response);
        resolve(true);
      }
    });
  });
}

async function ensureContentScript(tabId) {
  console.log("[lovplan][popup] ensureContentScript start, tabId=", tabId);
  if (await pingTab(tabId)) {
    console.log("[lovplan][popup] content script already present");
    return true;
  }
  console.log("[lovplan][popup] injecting content.js");
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (err) {
    console.error("[lovplan][popup] injectScript failed:", err);
    return false;
  }
  // Give the freshly-injected script a beat to register its listener.
  await new Promise((r) => setTimeout(r, 150));
  const ok = await pingTab(tabId);
  console.log("[lovplan][popup] post-injection ping:", ok);
  return ok;
}

async function startDeploy(startFromIndex) {
  console.log("[lovplan][popup] startDeploy called", {
    startFromIndex,
    promptCount: currentPrompts.length,
    selectedProjectId,
    selectedProjectName,
  });
  if (currentPrompts.length === 0) {
    console.warn("[lovplan][popup] startDeploy: no prompts loaded, aborting");
    return;
  }

  isPaused = false;
  const pauseBtn = document.getElementById("pause-deploy-btn");
  if (pauseBtn) pauseBtn.textContent = "Pause";

  showScreen("deploy");
  const headingEl = document.getElementById("deploy-heading");
  const statusEl = document.getElementById("deploy-status");
  const fillEl = document.getElementById("progress-fill");
  if (headingEl) headingEl.textContent = "Deploying...";
  if (statusEl) {
    statusEl.textContent =
      startFromIndex > 0 ? `Resuming from prompt #${startFromIndex + 1}...` : "Connecting to Lovable...";
  }
  if (fillEl) fillEl.style.width = "0%";

  const tab = await getLovableTab();
  if (!tab) {
    console.error("[lovplan][popup] startDeploy FAIL: no Lovable tab found. Open https://lovable.dev/projects/<id> in a tab first.");
    if (statusEl) statusEl.textContent = "Error: No Lovable tab found. Open a Lovable project tab first.";
    return;
  }
  console.log("[lovplan][popup] using tab:", { id: tab.id, url: tab.url, active: tab.active });

  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    console.error("[lovplan][popup] startDeploy FAIL: content script not responding on tab", tab.id, tab.url);
    if (statusEl) {
      statusEl.textContent =
        "Error: Could not connect to Lovable page. Refresh the Lovable tab and try again.";
    }
    return;
  }
  console.log("[lovplan][popup] content script ready");

  const resumeKey = `deploy_progress_${selectedProjectId}`;

  if (activeProgressListener) {
    chrome.runtime.onMessage.removeListener(activeProgressListener);
    activeProgressListener = null;
  }

  const warningEl = document.getElementById("deploy-warnings");

  const progressListener = (message) => {
    // UI-only update — pre-send announcement. Resume state comes from the
    // authoritative deployStepCompleted event below.
    if (message.action === "deployProgress") {
      const pct = Math.round((message.current / message.total) * 100);
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (statusEl) {
        statusEl.textContent = `Queuing prompt ${message.current}/${message.total}: ${message.title}`;
      }
      if (!isPaused && headingEl) headingEl.textContent = "Deploying...";
    }

    // Authoritative confirmation that one prompt was accepted by Lovable.
    // Only this event drives resume-state localStorage writes.
    if (message.action === "deployStepCompleted") {
      chrome.storage.local.set({
        [resumeKey]: {
          projectId: selectedProjectId,
          lastCompletedIndex: message.completedIndex,
          total: message.total,
          timestamp: Date.now(),
        },
      });
    }

    // Surface clamping / truncation warnings collected during deploy setup.
    if (message.action === "deployWarning" && Array.isArray(message.warnings)) {
      if (warningEl) {
        warningEl.textContent = "";
        message.warnings.forEach((w) => {
          const li = document.createElement("li");
          li.textContent = w;
          warningEl.appendChild(li);
        });
        warningEl.classList.remove("hidden");
      }
    }

    if (message.action === "deployComplete") {
      chrome.runtime.onMessage.removeListener(progressListener);
      activeProgressListener = null;
      chrome.storage.local.remove(resumeKey);
      showScreen("complete");
      const summary = document.getElementById("complete-summary");
      if (summary) {
        summary.textContent = `${currentPrompts.length} prompts deployed to ${selectedProjectName}`;
      }
      // Backend reporting is now owned by background.js (it stays alive when
      // the popup closes). Popup no longer calls reportDeployComplete here.
    }

    if (message.action === "deployError") {
      console.error("[lovplan][popup] deployError received:", message);
      chrome.runtime.onMessage.removeListener(progressListener);
      activeProgressListener = null;
      if (statusEl) statusEl.textContent = `Error: ${message.error}`;
      // Persist whatever index content reported so resume offers the right
      // restart point even though deployStepCompleted may not have fired
      // for the failing iteration.
      if (typeof message.lastCompletedIndex === "number" && message.lastCompletedIndex >= 0) {
        chrome.storage.local.set({
          [resumeKey]: {
            projectId: selectedProjectId,
            lastCompletedIndex: message.lastCompletedIndex,
            total: currentPrompts.length,
            timestamp: Date.now(),
          },
        });
      }
    }
  };

  activeProgressListener = progressListener;
  chrome.runtime.onMessage.addListener(progressListener);

  // Tell background to take ownership of progress reporting + keepalive +
  // tab-close monitoring. This survives the popup closing mid-deploy.
  await sendMessage({
    action: "startDeployTracking",
    projectId: selectedProjectId,
    tabId: tab.id,
    total: currentPrompts.length,
  });

  try {
    console.log("[lovplan][popup] sending deploy command to tab", tab.id, "with", currentPrompts.length, "prompts");
    await chrome.tabs.sendMessage(tab.id, {
      action: "deploy",
      prompts: currentPrompts,
      projectName: selectedProjectName,
      startFromIndex: startFromIndex || 0,
    });
    console.log("[lovplan][popup] deploy command accepted by content script");
  } catch (err) {
    console.error("[lovplan][popup] sendMessage(deploy) failed:", err);
    if (statusEl) {
      statusEl.textContent =
        "Error: Could not connect to Lovable page. Refresh and try again.";
    }
    chrome.runtime.onMessage.removeListener(progressListener);
    activeProgressListener = null;
  }
}

// Send a control message to the tab the deploy was actually started on
// (locked in background.activeDeploy.tabId). Falling back to getLovableTab
// would route to the *currently active* Lovable tab, which can differ if the
// user switched windows during the deploy — that would silently pause the
// wrong project.
async function getDeployTabId() {
  const state = await sendMessage({ action: "getActiveDeploy" });
  if (state && state.active && typeof state.tabId === "number") {
    return state.tabId;
  }
  // No active deploy tracked — fall back to the heuristic so the buttons
  // still do something sensible (e.g., user clicked pause after a hot reload).
  const tab = await getLovableTab();
  return tab?.id ?? null;
}

document.getElementById("pause-deploy-btn")?.addEventListener("click", async () => {
  const tabId = await getDeployTabId();
  if (typeof tabId !== "number") return;

  const pauseBtn = document.getElementById("pause-deploy-btn");
  const headingEl = document.getElementById("deploy-heading");

  if (!isPaused) {
    isPaused = true;
    if (pauseBtn) pauseBtn.textContent = "Resume";
    if (headingEl) headingEl.textContent = "Paused";
    chrome.tabs.sendMessage(tabId, { action: "pauseDeploy" });
  } else {
    isPaused = false;
    if (pauseBtn) pauseBtn.textContent = "Pause";
    if (headingEl) headingEl.textContent = "Deploying...";
    chrome.tabs.sendMessage(tabId, { action: "resumeDeploy" });
  }
});

document.getElementById("cancel-deploy-btn")?.addEventListener("click", async () => {
  const tabId = await getDeployTabId();
  if (typeof tabId === "number") {
    chrome.tabs.sendMessage(tabId, { action: "cancelDeploy" });
  }
  if (activeProgressListener) {
    chrome.runtime.onMessage.removeListener(activeProgressListener);
    activeProgressListener = null;
  }
  showScreen("prompts");
});

document.getElementById("done-btn")?.addEventListener("click", () => {
  showScreen("projects");
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}
