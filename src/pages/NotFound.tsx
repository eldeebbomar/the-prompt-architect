import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="blueprint-grid flex min-h-screen flex-col items-center justify-center px-4">
      <SEO title="Page Not Found" description="The page you're looking for doesn't exist." noindex />
      <p
        className="font-heading text-[120px] leading-none text-primary select-none"
        style={{ textShadow: "0 4px 24px hsl(38 76% 56% / 0.25)" }}
      >
        404
      </p>
      <h1 className="mt-4 font-heading text-2xl text-foreground">
        This page doesn't exist
      </h1>
      <p className="mt-2 font-body text-sm text-muted-foreground">
        The page you're looking for may have been moved or deleted.
      </p>
      <div className="mt-8 flex gap-3">
        {user ? (
          <Link to="/dashboard">
            <Button variant="amber" size="lg">Go to Dashboard</Button>
          </Link>
        ) : (
          <Link to="/">
            <Button variant="amber" size="lg">Go Home</Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default NotFound;
