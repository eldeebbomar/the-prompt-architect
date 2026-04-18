import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { copyToClipboard } from "../clipboard";

describe("copyToClipboard", () => {
  let originalClipboard: typeof navigator.clipboard;
  let originalExecCommand: typeof document.execCommand;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    originalExecCommand = document.execCommand;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
    vi.restoreAllMocks();
  });

  it("returns false for empty text without touching APIs", async () => {
    const writeSpy = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeSpy },
      configurable: true,
    });
    expect(await copyToClipboard("")).toBe(false);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("uses navigator.clipboard when available", async () => {
    const writeSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeSpy },
      configurable: true,
    });
    expect(await copyToClipboard("hi")).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith("hi");
  });

  it("falls back to execCommand when Clipboard API throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("permission denied")),
      },
      configurable: true,
    });
    const execSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    expect(await copyToClipboard("fallback")).toBe(true);
    expect(execSpy).toHaveBeenCalledWith("copy");
  });

  it("falls back to execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    const execSpy = vi.fn().mockReturnValue(true);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    expect(await copyToClipboard("fallback")).toBe(true);
    expect(execSpy).toHaveBeenCalledWith("copy");
  });

  it("returns false when both methods fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    const execSpy = vi.fn().mockReturnValue(false);
    document.execCommand = execSpy as unknown as typeof document.execCommand;

    expect(await copyToClipboard("nope")).toBe(false);
  });
});
