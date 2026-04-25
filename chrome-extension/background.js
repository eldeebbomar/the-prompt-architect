/**
 * LovPlan Deployer — Background Service Worker
 *
 * Handles API communication with Supabase edge functions,
 * token storage, and badge state management.
 */

const SUPABASE_URL = "https://gnovkpjawtodjcgizxsh.supabase.co/functions/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const DEPLOY_PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Debounce window for progress relays — avoid hammering the backend during
// fast deploys while still catching crash-recovery cases within ~10s.
const PROGRESS_DEBOUNCE_PROMPTS = 5;
const PROGRESS_DEBOUNCE_MS = 10_000;
// Keepalive alarm name; used to keep the MV3 service worker warm while a
// deploy is in flight (50-prompt deploys can run > MV3's 30s idle timeout).
const KEEPALIVE_ALARM = "lovplan-deploy-keepalive";

// ─── API Helper ───────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseResponseBody(response) {
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 300) };
  }
}

async function apiCall(path, options = {}) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) throw new Error("Not linked");

  const response = await fetchWithTimeout(`${SUPABASE_URL}/extension-api/${path}`, {
    headers: {
      "X-Extension-Token": token,
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (response.status === 401) {
    await chrome.storage.local.remove(["token", "user", "lastError"]);
    updateBadge(false);
    const body = await parseResponseBody(response);
    const code = body?.code;
    const msg =
      code === "session_expired"
        ? "Your session has expired. Please re-link the extension."
        : "Your session is invalid. Please re-link the extension.";
    await chrome.storage.local.set({ lastError: msg });
    const err = new Error(msg);
    err.code = code || "unauthorized";
    throw err;
  }

  if (response.status === 403) {
    const body = await parseResponseBody(response);
    const err = new Error(body.error || "Access denied");
    err.code = body.code || "forbidden";
    err.details = body;
    throw err;
  }

  if (!response.ok) {
    const body = await parseResponseBody(response);
    throw new Error(body.error || `API error ${response.status}`);
  }

  return parseResponseBody(response);
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(linked) {
  if (linked) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#d4a017" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// On startup, set badge based on stored token, then prune stale progress.
chrome.storage.local.get("token", ({ token }) => {
  updateBadge(!!token);
});

async function pruneStaleDeployProgress() {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const toRemove = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith("deploy_progress_")) continue;
    const ts = value && typeof value === "object" ? Number(value.timestamp) : 0;
    if (!ts || now - ts > DEPLOY_PROGRESS_TTL_MS) {
      toRemove.push(key);
    }
  }
  if (toRemove.length) {
    await chrome.storage.local.remove(toRemove);
  }
}

chrome.runtime.onStartup?.addListener(() => {
  pruneStaleDeployProgress().catch((err) =>
    console.warn("[lovplan] prune failed", err),
  );
});
chrome.runtime.onInstalled.addListener(() => {
  pruneStaleDeployProgress().catch((err) =>
    console.warn("[lovplan] prune failed", err),
  );
});

// ─── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.action];
  if (handler) {
    handler(message)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({ error: err.message, code: err.code, details: err.details }),
      );
    return true; // keep channel open for async response
  }
});

const messageHandlers = {
  // Verify a 6-digit pairing code and store the session token
  async verifyCode({ code }) {
    const response = await fetchWithTimeout(`${SUPABASE_URL}/verify-link-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const body = await parseResponseBody(response);
      const err = new Error(body.error || "Verification failed");
      err.code = body.code;
      err.status = response.status;
      throw err;
    }

    const data = await parseResponseBody(response);
    await chrome.storage.local.set({
      token: data.token,
      user: data.user,
      tokenExpiresAt: data.expires_at || null,
      lastError: null,
    });
    updateBadge(true);
    return { success: true, user: data.user, expiresAt: data.expires_at || null };
  },

  async getAuthState() {
    const { token, user, tokenExpiresAt, lastError } = await chrome.storage.local.get([
      "token",
      "user",
      "tokenExpiresAt",
      "lastError",
    ]);
    return {
      linked: !!token,
      user: user || null,
      tokenExpiresAt: tokenExpiresAt || null,
      lastError: lastError || null,
    };
  },

  async getMe() {
    return apiCall("me");
  },

  async getProjects() {
    return apiCall("projects");
  },

  async getPrompts({ projectId }) {
    return apiCall(`projects/${projectId}/prompts`);
  },

  async reportDeployComplete({ projectId, promptCount }) {
    return apiCall(`projects/${projectId}/deploy-complete`, {
      method: "POST",
      body: JSON.stringify({ prompt_count: promptCount }),
    });
  },

  async reportDeployProgress({ projectId, lastIndex, total, paused }) {
    return apiCall(`projects/${projectId}/deploy-progress`, {
      method: "POST",
      body: JSON.stringify({
        last_deployed_index: lastIndex,
        total_prompts: total,
        paused: paused === true,
      }),
    });
  },

  async reportDeployError({ projectId, lastIndex, error, errorCode }) {
    return apiCall(`projects/${projectId}/deploy-error`, {
      method: "POST",
      body: JSON.stringify({
        error_message: error,
        last_deployed_index: lastIndex,
        error_code: errorCode || null,
      }),
    });
  },

  // Popup tells background "I'm starting a deploy on tab X for project Y."
  // Background takes ownership of progress reporting + keepalive so the work
  // survives popup-close and MV3 service-worker idle eviction.
  async startDeployTracking({ projectId, tabId, total }) {
    if (!projectId || typeof tabId !== "number") {
      return { error: "Missing projectId or tabId" };
    }
    activeDeploy = {
      projectId,
      tabId,
      total: typeof total === "number" ? total : null,
      lastReportedIndex: -1,
      lastReportedAt: 0,
      lastSeenIndex: -1,
      paused: false,
    };
    await chrome.storage.session.set({ activeDeploy });
    await ensureKeepalive(true);
    return { success: true };
  },

  // Popup needs the locked tabId for pause/resume/cancel so it doesn't send
  // commands to the wrong Lovable tab if the user has switched windows.
  async getActiveDeploy() {
    const state = await loadActiveDeploy();
    if (!state) return { active: false };
    return {
      active: true,
      projectId: state.projectId,
      tabId: state.tabId,
      total: state.total,
      lastSeenIndex: state.lastSeenIndex,
      paused: state.paused === true,
    };
  },

  async unlink() {
    await chrome.storage.local.remove(["token", "user", "tokenExpiresAt", "lastError"]);
    updateBadge(false);
    return { success: true };
  },

  async clearLastError() {
    await chrome.storage.local.remove(["lastError"]);
    return { success: true };
  },
};

// ─── Active deploy tracking + backend relay ──────────────────────────────────
//
// The Chrome MV3 model means we can't keep a long-lived in-memory counter
// reliably — service workers can restart between events. We mirror to
// `chrome.storage.session` (cleared when browser closes; perfect for a
// transient deploy) and the keepalive alarm wakes the worker every ~30s.

let activeDeploy = null;

async function loadActiveDeploy() {
  if (activeDeploy) return activeDeploy;
  const { activeDeploy: stored } = await chrome.storage.session.get("activeDeploy");
  activeDeploy = stored || null;
  return activeDeploy;
}

async function persistActiveDeploy() {
  if (activeDeploy) {
    await chrome.storage.session.set({ activeDeploy });
  } else {
    await chrome.storage.session.remove("activeDeploy");
  }
}

async function clearActiveDeploy() {
  activeDeploy = null;
  await chrome.storage.session.remove("activeDeploy");
  await ensureKeepalive(false);
}

async function ensureKeepalive(active) {
  if (active) {
    await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  } else {
    await chrome.alarms.clear(KEEPALIVE_ALARM);
  }
}

chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  // No-op handler — the alarm itself is enough to wake the worker so it can
  // hand pending deploy events back to the backend.
});

function shouldRelayProgress(state, completedIndex) {
  if (!state) return false;
  // Always relay the very first and very last completed indexes — these are
  // the cheapest ways to recover state if the user crashes early or stops
  // just before completion.
  if (state.lastReportedIndex < 0) return true;
  const stepsSince = completedIndex - state.lastReportedIndex;
  const msSince = Date.now() - (state.lastReportedAt || 0);
  return stepsSince >= PROGRESS_DEBOUNCE_PROMPTS || msSince >= PROGRESS_DEBOUNCE_MS;
}

async function relayProgress({ completedIndex, total, paused, force }) {
  const state = await loadActiveDeploy();
  if (!state || !state.projectId) return;
  if (typeof completedIndex === "number") {
    state.lastSeenIndex = Math.max(state.lastSeenIndex ?? -1, completedIndex);
  }
  if (typeof paused === "boolean") {
    state.paused = paused;
  }
  if (typeof total === "number" && total > 0) {
    state.total = total;
  }

  const idxToReport = state.lastSeenIndex;
  if (!force && !shouldRelayProgress(state, idxToReport)) {
    await persistActiveDeploy();
    return;
  }

  state.lastReportedIndex = idxToReport;
  state.lastReportedAt = Date.now();
  await persistActiveDeploy();

  try {
    await messageHandlers.reportDeployProgress({
      projectId: state.projectId,
      lastIndex: idxToReport,
      total: state.total,
      paused: state.paused,
    });
  } catch (err) {
    // Best-effort: log and move on. The next progress event or final
    // completion will retry the write.
    console.warn("[lovplan] progress relay failed:", err.message || err);
  }
}

// Listen for deploy lifecycle messages from content.js. The popup also
// listens for UI feedback; both subscriptions are independent so closing the
// popup doesn't drop background's relay.
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object") return;

  switch (message.action) {
    case "deployStepCompleted":
      // Authoritative "this prompt was confirmed sent" event. completedIndex
      // is zero-indexed.
      relayProgress({
        completedIndex: message.completedIndex,
        total: message.total,
        paused: false,
      });
      return;

    case "deployProgress":
      // Pre-send announcement; tracked but not the primary relay trigger.
      // We use it to keep total in sync if the extension overrides it.
      loadActiveDeploy().then((state) => {
        if (!state) return;
        if (typeof message.total === "number" && message.total > 0) {
          state.total = message.total;
          persistActiveDeploy();
        }
      });
      return;

    case "deployError":
      handleDeployError({
        error: message.error,
        lastCompletedIndex: message.lastCompletedIndex,
        errorCode: message.errorCode,
      });
      return;

    case "deployComplete":
      handleDeployComplete({ total: message.total });
      return;

    default:
      return;
  }
});

async function handleDeployError({ error, lastCompletedIndex, errorCode }) {
  const state = await loadActiveDeploy();
  if (!state || !state.projectId) return;

  // Best-effort flush of any pending progress before the error.
  if (typeof lastCompletedIndex === "number" && lastCompletedIndex >= 0) {
    state.lastSeenIndex = Math.max(state.lastSeenIndex ?? -1, lastCompletedIndex);
    await persistActiveDeploy();
  }

  try {
    await messageHandlers.reportDeployError({
      projectId: state.projectId,
      lastIndex: state.lastSeenIndex,
      error: error || "Deploy stopped",
      errorCode,
    });
  } catch (err) {
    console.warn("[lovplan] error relay failed:", err.message || err);
  }
  await clearActiveDeploy();
}

async function handleDeployComplete({ total }) {
  const state = await loadActiveDeploy();
  if (!state || !state.projectId) return;

  try {
    await messageHandlers.reportDeployComplete({
      projectId: state.projectId,
      promptCount: typeof total === "number" ? total : state.total,
    });
  } catch (err) {
    console.warn("[lovplan] complete relay failed:", err.message || err);
  }
  await clearActiveDeploy();
}

// If the Lovable tab is closed mid-deploy, surface a deploy_error so the app
// shows the right state instead of a phantom "in progress."
chrome.tabs?.onRemoved.addListener(async (tabId) => {
  const state = await loadActiveDeploy();
  if (!state || state.tabId !== tabId) return;
  await handleDeployError({
    error: "Lovable tab was closed before the deploy finished.",
    lastCompletedIndex: state.lastSeenIndex,
    errorCode: "tab_closed",
  });
});

// If the deployed-to tab navigates off lovable.dev, that's also fatal.
// Be careful with intermediate states: Chrome reports `about:blank` and the
// final URL during a single navigation, and a refresh of the same lovable.dev
// page can briefly look like a navigation. We only kill the deploy when the
// final hostname is something other than lovable.dev.
chrome.tabs?.onUpdated.addListener(async (tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const state = await loadActiveDeploy();
  if (!state || state.tabId !== tabId) return;

  let host = "";
  try {
    const u = new URL(changeInfo.url);
    // Ignore intermediate browser states — these aren't real navigations.
    if (u.protocol === "about:" || u.protocol === "chrome:" || u.protocol === "chrome-extension:") {
      return;
    }
    host = u.hostname;
  } catch {
    // Unparseable URLs are also intermediate states (extension overlays,
    // file:// drag-and-drop, etc.). Don't kill the deploy on these.
    return;
  }

  if (host === "lovable.dev" || host.endsWith(".lovable.dev")) return;

  await handleDeployError({
    error: "Lovable tab navigated away before the deploy finished.",
    lastCompletedIndex: state.lastSeenIndex,
    errorCode: "tab_navigated",
  });
});

// On worker startup, restore active deploy state from session storage so a
// keepalive-revived worker still knows what's in flight.
loadActiveDeploy().catch(() => { /* fresh install, nothing stored */ });
