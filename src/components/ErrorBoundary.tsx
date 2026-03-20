import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="w-full max-w-[400px] rounded-card border border-border bg-card p-10 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-[hsl(var(--terracotta))]" />
            <h1 className="font-heading text-2xl text-foreground">
              Something went wrong
            </h1>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Please refresh the page. If this persists, contact support.
            </p>
            <Button
              variant="amber"
              className="mt-6 w-full"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
            <a
              href="/dashboard"
              className="mt-3 inline-block font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
