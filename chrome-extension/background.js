/**
 * LovPlan Deployer — Background Service Worker
 *
 * Handles API communication with Supabase edge functions,
 * token storage, and badge state management.
 */

const SUPABASE_URL = "https://gnovkpjawtodjcgizxsh.supabase.co/functions/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const DEPLOY_PROGRESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
