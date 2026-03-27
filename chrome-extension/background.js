/**
 * LovPlan Deployer — Background Service Worker
 *
 * Handles API communication with Supabase edge functions,
 * token storage, and badge state management.
 */

const SUPABASE_URL = "https://gnovkpjawtodjcgizxsh.supabase.co/functions/v1";

// ─── API Helper ───────────────────────────────────────────────────────────────

async function apiCall(path, options = {}) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) throw new Error("Not linked");

  const response = await fetch(`${SUPABASE_URL}/extension-api/${path}`, {
    headers: {
      "X-Extension-Token": token,
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (response.status === 401) {
    // Token revoked or expired — clear state
    await chrome.storage.local.remove(["token", "user"]);
    updateBadge(false);
    throw new Error("Session expired. Please re-link your account.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error ${response.status}`);
  }

  return response.json();
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

// On startup, set badge based on stored token
chrome.storage.local.get("token", ({ token }) => {
  updateBadge(!!token);
});

// ─── Message Handlers ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.action];
  if (handler) {
    handler(message)
      .then(sendResponse)
      .catch((err) => sendResponse({ error: err.message }));
    return true; // keep channel open for async response
  }
});

const messageHandlers = {
  // Verify a 6-digit pairing code and store the session token
  async verifyCode({ code }) {
    const response = await fetch(`${SUPABASE_URL}/verify-link-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Verification failed");
    }

    const data = await response.json();
    await chrome.storage.local.set({
      token: data.token,
      user: data.user,
    });
    updateBadge(true);
    return { success: true, user: data.user };
  },

  // Get current auth state
  async getAuthState() {
    const { token, user } = await chrome.storage.local.get(["token", "user"]);
    return { linked: !!token, user: user || null };
  },

  // Get user profile
  async getMe() {
    return apiCall("me");
  },

  // List projects with prompt counts
  async getProjects() {
    return apiCall("projects");
  },

  // Get prompts for a specific project
  async getPrompts({ projectId }) {
    return apiCall(`projects/${projectId}/prompts`);
  },

  // Report deploy completion to main app
  async reportDeployComplete({ projectId, promptCount }) {
    return apiCall(`projects/${projectId}/deploy-complete`, {
      method: "POST",
      body: JSON.stringify({ prompt_count: promptCount }),
    });
  },

  // Unlink the extension
  async unlink() {
    await chrome.storage.local.remove(["token", "user"]);
    updateBadge(false);
    return { success: true };
  },
};
