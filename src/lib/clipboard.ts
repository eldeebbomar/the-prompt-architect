/**
 * Copy text to the clipboard with a fallback for browsers/contexts where
 * the async Clipboard API is unavailable or blocked (non-HTTPS, permissions
 * denied, older iOS, etc).
 *
 * Returns true on success, false otherwise. Callers should not show a
 * success toast without checking the return value.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("[clipboard] Clipboard API failed, falling back:", err);
    }
  }

  // execCommand fallback. Requires a user gesture (which is always the case
  // when invoked from a click handler).
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  // Remember who had focus so we can restore it after the copy. Selection
  // inside that element is preserved by the browser since we're using a
  // throw-away textarea — focus restoration is the only thing we need.
  const activeEl = document.activeElement as HTMLElement | null;

  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch (err) {
    console.warn("[clipboard] execCommand fallback failed:", err);
    return false;
  } finally {
    document.body.removeChild(textarea);
    try { activeEl?.focus?.(); } catch { /* ignore */ }
  }
}
