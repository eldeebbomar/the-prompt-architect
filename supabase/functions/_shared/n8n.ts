/**
 * Shared helpers for calling n8n webhooks with timeout, retries, and safe
 * response parsing. The n8n workflows are treated as a black box — anything
 * we can't control on the other side lives here on our side.
 */

export type N8nFetchResult =
  | { ok: true; status: number; body: Record<string, unknown> | unknown[] }
  | { ok: false; status: number; error: "timeout" | "unreachable" | "bad_response" | "upstream_error"; detail?: string };

export interface N8nFetchOptions {
  timeoutMs?: number;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

/**
 * Fetch an n8n webhook with an AbortController timeout and defensive response
 * parsing. Never throws — always returns a shaped result so callers can map
 * to the right HTTP response.
 */
export async function fetchN8n(
  url: string,
  opts: N8nFetchOptions = {},
): Promise<N8nFetchResult> {
  const { timeoutMs = 30_000, method = "POST", headers = {}, body } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const isAbort =
      err instanceof DOMException && err.name === "AbortError" ||
      (err as { name?: string })?.name === "AbortError";
    if (isAbort) {
      return { ok: false, status: 504, error: "timeout" };
    }
    console.error("[n8n] unreachable:", err);
    return { ok: false, status: 502, error: "unreachable", detail: String(err) };
  }
  clearTimeout(timeout);

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    console.error(`[n8n] upstream ${response.status}:`, text.slice(0, 500));
    return {
      ok: false,
      status: response.status,
      error: "upstream_error",
      detail: text.slice(0, 500),
    };
  }

  if (!text) {
    return { ok: true, status: response.status, body: {} };
  }

  try {
    const parsed = JSON.parse(text);
    return { ok: true, status: response.status, body: parsed };
  } catch {
    console.error("[n8n] non-JSON response:", text.slice(0, 500));
    return {
      ok: false,
      status: 502,
      error: "bad_response",
      detail: "Upstream returned non-JSON",
    };
  }
}

export function n8nErrorResponse(
  result: Extract<N8nFetchResult, { ok: false }>,
  corsHeaders: Record<string, string>,
): Response {
  const userMessage =
    result.error === "timeout"
      ? "The AI architect is taking too long. Please try again."
      : result.error === "unreachable"
        ? "AI architect is currently unavailable."
        : result.error === "bad_response"
          ? "AI architect returned an unexpected response."
          : "AI architect error.";

  const status =
    result.error === "timeout" ? 504 :
      result.error === "unreachable" ? 502 :
        result.error === "bad_response" ? 502 :
          result.status >= 400 ? result.status : 502;

  return new Response(
    JSON.stringify({ error: userMessage, code: result.error }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
