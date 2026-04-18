import { toast } from "sonner";

type ErrorLike = {
  message?: string;
  context?: { status?: number; from?: string };
  status?: number;
  name?: string;
} | Error | null | undefined;

interface HandleWebhookErrorOptions {
  onRateLimit?: () => void;
  setCreditsModalOpen?: (open: boolean) => void;
  // Destination to send the user to after re-auth, preserved via
  // history state so the post-login flow can return them.
  preserveDestination?: boolean;
}

function extractStatus(error: Exclude<ErrorLike, null | undefined>): number | undefined {
  const anyErr = error as { context?: { status?: unknown }; status?: unknown };
  const fromContext = Number(anyErr.context?.status);
  if (Number.isFinite(fromContext) && fromContext > 0) return fromContext;
  const direct = Number(anyErr.status);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const msg = typeof (error as { message?: unknown }).message === "string"
    ? (error as { message?: string }).message!
    : "";

  if (/\b401\b|unauthorized/i.test(msg)) return 401;
  if (/\b402\b|no credits|insufficient credits/i.test(msg)) return 402;
  if (/\b403\b|forbidden/i.test(msg)) return 403;
  if (/\b429\b|too many requests|rate.?limit/i.test(msg)) return 429;
  if (/\b504\b|timed out|timeout/i.test(msg)) return 504;
  if (/\b502\b|\b503\b|unavailable|bad gateway/i.test(msg)) return 502;
  if (/\b500\b/i.test(msg)) return 500;
  if (/\b400\b/i.test(msg)) return 400;
  return undefined;
}

/**
 * Handles HTTP error codes from edge function invoke errors.
 * Returns true if the error was handled (caller should stop processing).
 * Returns false if the error was not a known HTTP error (caller should handle generically).
 */
export function handleWebhookError(
  error: ErrorLike,
  navigate: (path: string, options?: { state?: unknown }) => void,
  options?: HandleWebhookErrorOptions,
): boolean {
  if (!error) return false;

  const status = extractStatus(error);

  switch (status) {
    case 400:
      toast.error("Missing or invalid information. Please try again.");
      return true;
    case 401: {
      toast.error("Session expired. Please sign in again.");
      const from = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : undefined;
      navigate("/login", options?.preserveDestination !== false && from ? { state: { from } } : undefined);
      return true;
    }
    case 402:
      if (options?.setCreditsModalOpen) {
        options.setCreditsModalOpen(true);
      } else {
        toast.error("You need credits to continue.");
        navigate("/pricing");
      }
      return true;
    case 403:
      toast.error("You don't have access to that resource.");
      return true;
    case 429:
      toast.info("You're sending requests too fast. Please wait a moment.");
      options?.onRateLimit?.();
      return true;
    case 502:
      toast.error("The AI service is temporarily unavailable. Please try again.");
      return true;
    case 504:
      toast.error("The AI service took too long to respond. Please try again.");
      return true;
    case 500:
      toast.error("Something went wrong on our end. Please try again.", {
        action: { label: "Retry", onClick: () => window.location.reload() },
      });
      return true;
    default:
      return false;
  }
}
