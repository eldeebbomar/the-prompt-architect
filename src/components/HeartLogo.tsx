import { cn } from "@/lib/utils";

interface HeartLogoProps {
  className?: string;
  animated?: boolean;
}

/**
 * Lovplan heart-in-heart mark.
 * When animated, the inner heart performs a subtle heartbeat pulse.
 */
const HeartLogo = ({ className, animated = false }: HeartLogoProps) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={cn("text-primary", className)}
    aria-hidden="true"
  >
    {/* Outer heart outline */}
    <path
      d="M50 86 C 22 66, 8 48, 8 32 C 8 19, 18 10, 30 10 C 39 10, 46 15, 50 22 C 54 15, 61 10, 70 10 C 82 10, 92 19, 92 32 C 92 48, 78 66, 50 86 Z"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinejoin="round"
    />
    {/* Inner solid heart with heartbeat */}
    <path
      d="M50 64 C 36 54, 28 46, 28 38 C 28 32, 33 28, 39 28 C 44 28, 48 31, 50 35 C 52 31, 56 28, 61 28 C 67 28, 72 32, 72 38 C 72 46, 64 54, 50 64 Z"
      fill="currentColor"
      style={{
        transformOrigin: "50px 46px",
        transformBox: "fill-box",
      }}
      className={cn(animated && "origin-center [animation:heartbeat_1.4s_ease-in-out_infinite]")}
    />
  </svg>
);

export default HeartLogo;
