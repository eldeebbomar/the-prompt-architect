import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Scoped error boundary for lazy-loaded routes. Distinct from the app-shell
 * boundary in App.tsx: this one keeps the navbar/sidebar visible and only
 * replaces the route pane. Typical trigger is a chunk-load failure after
 * a stale cache meets a fresh deploy — one refresh fixes it.
 */
class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[RouteErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message || "";
      const isChunkError =
        /loading chunk|Failed to fetch dynamically imported module|ChunkLoadError/i.test(
          msg,
        );
      return (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-8 text-center">
            <h2 className="font-heading text-xl text-foreground">
              {isChunkError ? "Couldn't load this page" : "Something went wrong"}
            </h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              {isChunkError
                ? "We deployed a new version. A quick refresh should fix it."
                : "Please refresh and try again. If this keeps happening, contact support."}
            </p>
            <Button
              variant="amber"
              size="sm"
              className="mt-6 gap-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default RouteErrorBoundary;
