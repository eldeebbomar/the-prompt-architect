import { toast } from "sonner";

/**
 * Handles HTTP error codes from edge function invoke errors.
 * Returns true if the error was handled (caller should stop processing).
 * Returns false if the error was not a known HTTP error (caller should handle generically).
 */
export function handleWebhookError(
  error: { message?: string; context?: { status?: number } } | null,
  navigate: (path: string) => void,
  options?: {
    onRateLimit?: () => void;
    setCreditsModalOpen?: (open: boolean) => void;
  }
): boolean {
  if (!error) return false;

  const msg = error.message || "";
  const status = error.context?.status;

  // Try to extract status from message if context not available
  const effectiveStatus =
    status ||
    (msg.includes("400") ? 400 : undefined) ||
    (msg.includes("401") || msg.includes("Unauthorized") ? 401 : undefined) ||
    (msg.includes("402") || msg.includes("No credits") ? 402 : undefined) ||
    (msg.includes("429") ? 429 : undefined) ||
    (msg.includes("500") ? 500 : undefined);

  switch (effectiveStatus) {
    case 400:
      toast.error("Missing required information. Please try again.");
      return true;
    case 401:
      toast.error("Session expired. Please sign in again.");
      navigate("/login");
      return true;
    case 402:
      if (options?.setCreditsModalOpen) {
        options.setCreditsModalOpen(true);
      } else {
        toast.error("You need credits to continue.");
        navigate("/pricing");
      }
      return true;
    case 429:
      toast.info("You're sending messages too fast. Please wait a moment.");
      options?.onRateLimit?.();
      return true;
    case 500:
      toast.error("Something went wrong on our end. Please try again.");
      return true;
    default:
      return false;
  }
}
