import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const FullPageLoader = () => (
  <div
    className="flex min-h-screen flex-col items-center justify-center bg-background"
    role="status"
    aria-live="polite"
    aria-label="Loading LovPlan"
  >
    <p className="font-heading text-3xl tracking-[0.05em] text-primary mb-8">
      LovPlan
    </p>
    <div className="relative h-0.5 w-48 overflow-hidden rounded-full bg-border">
      <div
        className="absolute top-0 h-full w-2 rounded-full bg-primary"
        style={{ animation: "loading-dot 1.2s ease-in-out infinite alternate" }}
      />
    </div>
    <span className="sr-only">Loading…</span>
  </div>
);

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  // Profile loads asynchronously after auth — wait for it
  if (!profile) return <FullPageLoader />;
  if (!profile.is_admin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};
