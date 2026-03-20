import { Link } from "react-router-dom";
import { Plus, FolderOpen, Coins, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="font-heading text-3xl text-foreground">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          Plan your next Lovable build with structured, dependency-ordered prompts.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* New project */}
        <Link
          to="/dashboard/new"
          className="group flex flex-col gap-4 rounded-card border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-button bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg text-foreground">New Project</h3>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              Start an AI discovery conversation for your next app.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 font-body text-sm text-primary">
            Get started <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* My projects */}
        <Link
          to="/dashboard/projects"
          className="group flex flex-col gap-4 rounded-card border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-warm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-button bg-secondary/10">
            <FolderOpen className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <h3 className="font-heading text-lg text-foreground">My Projects</h3>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              View and manage your existing prompt blueprints.
            </p>
          </div>
          <span className="mt-auto flex items-center gap-1.5 font-body text-sm text-muted-foreground group-hover:text-foreground">
            View projects <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        {/* Credits */}
        <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-button bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-lg text-foreground">Credits</h3>
            <p className="mt-2 font-heading text-3xl text-primary tabular-nums">
              {profile?.plan === "unlimited" ? "∞" : profile?.credits ?? 0}
            </p>
            <p className="mt-1 font-body text-xs text-muted-foreground">
              {profile?.plan === "unlimited" ? "Unlimited plan" : "credits remaining"}
            </p>
          </div>
          <Link to="/dashboard/billing" className="mt-auto">
            <Button variant="outline" size="sm" className="w-full border-primary/30 text-primary hover:bg-primary/10">
              Buy More
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
