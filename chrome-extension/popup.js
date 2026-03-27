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
  Object.values(screens).forEach((el) => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

// ─── State ────────────────────────────────────────────────────────────────────

let currentProjects = [];
let currentPrompts = [];
let selectedProjectId = null;
let selectedProjectName = "";

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  showScreen("loading");
  try {
    const state = await sendMessage({ action: "getAuthState" });
    if (state.error) throw new Error(state.error);

    if (state.linked) {
      showUserInfo(state.user);
      await loadProjects();
      showScreen("projects");
    } else {
      showScreen("link");
      setupCodeInputs();
    }
  } catch {
    showScreen("link");
    setupCodeInputs();
  }
}

init();

// ─── Helper: send message to background ──────────────────────────────────────

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      resolve(response || { error: "No response" });
    });
  });
}

// ─── Link Screen ──────────────────────────────────────────────────────────────

function setupCodeInputs() {
  const inputs = document.querySelectorAll("#code-inputs input");
  const linkBtn = document.getElementById("link-btn");

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

    // Support paste of full 6-digit code
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

  // Focus first input
  inputs[0]?.focus();

  function updateLinkButton() {
    const code = getCode();
    linkBtn.disabled = code.length !== 6;
  }
}

function getCode() {
  const inputs = document.querySelectorAll("#code-inputs input");
  return Array.from(inputs).map((i) => i.value).join("");
}

document.getElementById("link-btn").addEventListener("click", async () => {
  const code = getCode();
  if (code.length !== 6) return;

  const btn = document.getElementById("link-btn");
  const errEl = document.getElementById("link-error");
  btn.disabled = true;
  btn.textContent = "Linking...";
  errEl.classList.add("hidden");

  const result = await sendMessage({ action: "verifyCode", code });

  if (result.error) {
    errEl.textContent = result.error;
    errEl.classList.remove("hidden");
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
  document.getElementById("user-email").textContent = user.email || "";
  const planEl = document.getElementById("user-plan");
  const planLabels = { unlimited: "Unlimited", pack: "5-Pack", "5-pack": "5-Pack", single: "Single" };
  planEl.textContent = planLabels[user.plan] || user.plan || "Paid";
}

async function loadProjects() {
  const listEl = document.getElementById("project-list");
  listEl.innerHTML = '<div class="spinner"></div>';

  const result = await sendMessage({ action: "getProjects" });
  if (result.error) {
    listEl.innerHTML = `<p class="empty-state">${result.error}</p>`;
    return;
  }

  currentProjects = result.projects || [];
  if (currentProjects.length === 0) {
    listEl.innerHTML = '<p class="empty-state">No projects with generated prompts yet.</p>';
    return;
  }

  listEl.innerHTML = currentProjects
    .map(
      (p) => `
      <div class="project-card" data-id="${p.id}">
        <div class="project-name">${escapeHtml(p.name)}</div>
        <div class="project-meta">
          <span>${p.prompt_count} prompts</span>
          <span class="status-pill status-${p.status}">${p.status}</span>
        </div>
      </div>
    `
    )
    .join("");

  // Click handlers
  listEl.querySelectorAll(".project-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.id;
      const project = currentProjects.find((p) => p.id === id);
      if (project) openProject(project);
    });
  });
}

document.getElementById("unlink-btn").addEventListener("click", async () => {
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
    listEl.innerHTML = `<p class="empty-state">${result.error}</p>`;
    return;
  }

  currentPrompts = result.prompts || [];
  listEl.innerHTML = currentPrompts
    .map(
      (p) => `
      <div class="prompt-item">
        <span class="prompt-seq">${p.sequence_order}</span>
        <span class="prompt-title">${escapeHtml(p.title)}</span>
        ${p.is_loop ? `<span class="loop-badge">Loop x${p.repeat_count || 2}</span>` : ""}
      </div>
    `
    )
    .join("");

  // Check for saved deployment progress and show resume option
  await checkResumeState();

  // Check if we're on a lovable.dev tab
  await updateDeployButton();
}

async function checkResumeState() {
  const resumeKey = `deploy_progress_${selectedProjectId}`;
  const stored = await chrome.storage.local.get(resumeKey);
  const saved = stored[resumeKey];

  const resumeEl = document.getElementById("resume-banner");
  if (!resumeEl) return;

  if (saved && saved.lastCompletedIndex < saved.total - 1) {
    resumeEl.innerHTML = `
      <p>Previous deployment stopped at prompt ${saved.lastCompletedIndex + 1}/${saved.total}</p>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button id="resume-deploy-btn" class="btn btn-primary btn-sm">Resume from #${saved.lastCompletedIndex + 2}</button>
        <button id="discard-resume-btn" class="btn btn-ghost btn-sm">Start Over</button>
      </div>
    `;
    resumeEl.classList.remove("hidden");

    document.getElementById("resume-deploy-btn").addEventListener("click", () => {
      resumeEl.classList.add("hidden");
      startDeploy(saved.lastCompletedIndex + 1);
    });
    document.getElementById("discard-resume-btn").addEventListener("click", async () => {
      await chrome.storage.local.remove(resumeKey);
      resumeEl.classList.add("hidden");
    });
  } else {
    resumeEl.classList.add("hidden");
  }
}

async function updateDeployButton() {
  const btn = document.getElementById("deploy-btn");
  const note = document.getElementById("deploy-note");

  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: ["https://lovable.dev/*", "https://*.lovable.dev/*"],
  });

  if (tabs.length > 0) {
    btn.disabled = false;
    note.classList.add("hidden");
  } else {
    btn.disabled = true;
    note.textContent = "Open a Lovable project first";
    note.classList.remove("hidden");
  }
}

document.getElementById("back-btn").addEventListener("click", () => {
  showScreen("projects");
});

document.getElementById("deploy-btn").addEventListener("click", () => startDeploy(0));

// ─── Deploy ───────────────────────────────────────────────────────────────────

let isPaused = false;

async function getLovableTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: ["https://lovable.dev/*", "https://*.lovable.dev/*"],
  });
  return tabs.length > 0 ? tabs[0] : null;
}

async function startDeploy(startFromIndex) {
  if (currentPrompts.length === 0) return;

  isPaused = false;
  const pauseBtn = document.getElementById("pause-deploy-btn");
  pauseBtn.textContent = "Pause";

  showScreen("deploy");
  const headingEl = document.getElementById("deploy-heading");
  const statusEl = document.getElementById("deploy-status");
  const fillEl = document.getElementById("progress-fill");
  headingEl.textContent = "Deploying...";
  statusEl.textContent = startFromIndex > 0 ? `Resuming from prompt #${startFromIndex + 1}...` : "Connecting to Lovable...";
  fillEl.style.width = "0%";

  const tab = await getLovableTab();
  if (!tab) {
    statusEl.textContent = "Error: No Lovable tab found.";
    return;
  }

  const resumeKey = `deploy_progress_${selectedProjectId}`;

  // Listen for progress updates from content script
  const progressListener = (message) => {
    if (message.action === "deployProgress") {
      const pct = Math.round((message.current / message.total) * 100);
      fillEl.style.width = `${pct}%`;
      statusEl.textContent = `Queuing prompt ${message.current}/${message.total}: ${message.title}`;
      if (!isPaused) headingEl.textContent = "Deploying...";

      // Persist progress for resume
      chrome.storage.local.set({
        [resumeKey]: {
          projectId: selectedProjectId,
          lastCompletedIndex: message.current - 1,
          total: message.total,
          timestamp: Date.now(),
        },
      });
    }
    if (message.action === "deployComplete") {
      chrome.runtime.onMessage.removeListener(progressListener);
      // Clear saved progress on completion
      chrome.storage.local.remove(resumeKey);
      showScreen("complete");
      document.getElementById("complete-summary").textContent =
        `${currentPrompts.length} prompts deployed to ${selectedProjectName}`;

      // Report completion to main app backend
      sendMessage({
        action: "reportDeployComplete",
        projectId: selectedProjectId,
        promptCount: currentPrompts.length,
      }).catch(() => {
        // Non-critical — don't block the complete screen
        console.warn("Failed to report deploy completion to backend");
      });
    }
    if (message.action === "deployError") {
      chrome.runtime.onMessage.removeListener(progressListener);
      statusEl.textContent = `Error: ${message.error}`;
      // Progress is persisted — user can resume later
    }
  };

  chrome.runtime.onMessage.addListener(progressListener);

  // Send deploy command to content script
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "deploy",
      prompts: currentPrompts,
      projectName: selectedProjectName,
      startFromIndex: startFromIndex || 0,
    });
  } catch (err) {
    statusEl.textContent = "Error: Could not connect to Lovable page. Refresh and try again.";
  }
}

// Pause / Resume
document.getElementById("pause-deploy-btn").addEventListener("click", async () => {
  const tab = await getLovableTab();
  if (!tab) return;

  const pauseBtn = document.getElementById("pause-deploy-btn");
  const headingEl = document.getElementById("deploy-heading");

  if (!isPaused) {
    isPaused = true;
    pauseBtn.textContent = "Resume";
    headingEl.textContent = "Paused";
    chrome.tabs.sendMessage(tab.id, { action: "pauseDeploy" });
  } else {
    isPaused = false;
    pauseBtn.textContent = "Pause";
    headingEl.textContent = "Deploying...";
    chrome.tabs.sendMessage(tab.id, { action: "resumeDeploy" });
  }
});

// Cancel
document.getElementById("cancel-deploy-btn").addEventListener("click", async () => {
  const tab = await getLovableTab();
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "cancelDeploy" });
  }
  showScreen("prompts");
});

document.getElementById("done-btn").addEventListener("click", () => {
  showScreen("projects");
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
