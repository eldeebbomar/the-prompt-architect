import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleWebhookError } from "../webhook-error-handler";

// Sonner's toast is imported statically; stub it so our assertions don't need
// it actually rendered.
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("handleWebhookError", () => {
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn();
    vi.clearAllMocks();
    // Pretend we're at /project/123 so 401 preservation has something to save.
    Object.defineProperty(window, "location", {
      value: { pathname: "/project/123", search: "?tab=prompts" },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false for null", () => {
    expect(handleWebhookError(null, navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returns false for unknown errors", () => {
    expect(handleWebhookError({ message: "network glitch" }, navigate)).toBe(false);
  });

  it("handles 401 via context.status and preserves destination", () => {
    const handled = handleWebhookError(
      { message: "unauthorized", context: { status: 401 } },
      navigate,
    );
    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/login", {
      state: { from: "/project/123?tab=prompts" },
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it("handles 401 inferred from message string", () => {
    const handled = handleWebhookError({ message: "401 Unauthorized" }, navigate);
    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/login", expect.anything());
  });

  it("handles 402 by opening credits modal when provided", () => {
    const setCreditsModalOpen = vi.fn();
    const handled = handleWebhookError(
      { message: "Insufficient credits" },
      navigate,
      { setCreditsModalOpen },
    );
    expect(handled).toBe(true);
    expect(setCreditsModalOpen).toHaveBeenCalledWith(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("handles 429 and invokes the rate-limit callback", () => {
    const onRateLimit = vi.fn();
    const handled = handleWebhookError(
      { message: "429 Too Many Requests" },
      navigate,
      { onRateLimit },
    );
    expect(handled).toBe(true);
    expect(onRateLimit).toHaveBeenCalled();
  });

  it("handles 504 / timeout", () => {
    const handled = handleWebhookError(
      { message: "Request timed out" },
      navigate,
    );
    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/took too long/i));
  });

  it("handles 502 / bad gateway", () => {
    const handled = handleWebhookError(
      { message: "502 Bad Gateway" },
      navigate,
    );
    expect(handled).toBe(true);
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/temporarily unavailable/i));
  });

  it("accepts raw Error instances", () => {
    const err = new Error("401 unauthorized");
    const handled = handleWebhookError(err, navigate);
    expect(handled).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/login", expect.anything());
  });
});
