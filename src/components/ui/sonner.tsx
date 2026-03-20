import { useIsMobile } from "@/hooks/use-mobile";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position={isMobile ? "bottom-center" : "top-right"}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[hsl(30_12%_9%)] group-[.toaster]:text-[hsl(var(--warm-white))] group-[.toaster]:border-border group-[.toaster]:shadow-warm group-[.toaster]:rounded-card group-[.toaster]:font-body",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:font-body",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--sage))]",
          error:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--terracotta))]",
          info:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--amber))]",
        },
        duration: 4000,
      }}
      icons={{
        success: (
          <svg
            className="h-4 w-4 text-[hsl(var(--sage))]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ),
        error: (
          <svg
            className="h-4 w-4 text-[hsl(var(--terracotta))]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ),
        info: (
          <svg
            className="h-4 w-4 text-[hsl(var(--amber))]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        ),
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
