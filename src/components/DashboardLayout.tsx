import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useGenerationNotifier } from "@/hooks/use-generation-notifier";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";
import {
  LayoutDashboard,
  Rocket,
  FolderOpen,
  Chrome,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Coins,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "New Project", href: "/dashboard/new", icon: Rocket },
  { label: "My Projects", href: "/dashboard/projects", icon: FolderOpen },
  { label: "Chrome Extension", href: "/dashboard/extension", icon: Chrome },
  { label: "Credits & Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  useGenerationNotifier(user?.id);
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  const projectIdMatch = location.pathname.match(/\/project\/([0-9a-fA-F-]{36})/);
  const projectId = projectIdMatch ? projectIdMatch[1] : null;

  const { data: project } = useQuery({
    queryKey: ["project-breadcrumb", projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const { data } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .single();
      return data;
    },
    enabled: !!projectId,
    staleTime: 60000,
  });

  // Breadcrumb from path (replace UUIDs with project name)
  const isUUID = (str: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(str);
  const breadcrumb = location.pathname
    .replace("/dashboard", "")
    .split("/")
    .filter(Boolean)
    .map((s) => {
      if (isUUID(s)) return project?.name || "Project";
      return s.charAt(0).toUpperCase() + s.slice(1);
    });

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Logo + collapse */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link to="/dashboard" className="flex items-center gap-2" onClick={() => isMobile && setMobileOpen(false)}>
          {collapsed && !isMobile ? (
            <img src="/favicon-512.png" alt="Lovplan" width={28} height={28} className="h-7 w-7" />
          ) : (
            <img src="/logo-options/wordmark-1-serif-v2.png" alt="Lovplan" width={140} height={36} className="h-8 w-auto" />
          )}
        </Link>
        {!isMobile && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-7 w-7 items-center justify-center rounded-button text-muted-foreground transition-colors hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              {...(item.href === "/dashboard/new" ? { "data-tutorial": "new-project-nav" } : {})}
              className={`group flex items-center gap-3 rounded-button px-3 py-2.5 font-body text-sm transition-all duration-200 ${
                active
                  ? "border-l-[3px] border-l-primary bg-[hsl(40_8%_10%)] text-primary"
                  : "border-l-[3px] border-l-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border p-3 space-y-3">
        {/* Credits */}
        <div data-tutorial="credit-balance" className={`flex items-center gap-2 rounded-button px-3 py-2 ${collapsed && !isMobile ? "justify-center" : ""}`}>
          <Coins className="h-4 w-4 shrink-0 text-primary" />
          {(!collapsed || isMobile) && (
            <span className="font-mono text-sm text-primary">
              {profile?.plan === "unlimited" ? "∞" : profile?.credits ?? 0} credits
            </span>
          )}
        </div>

        {/* User */}
        <div className={`flex items-center gap-3 rounded-button px-3 py-2 ${collapsed && !isMobile ? "justify-center" : ""}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-body text-sm font-medium text-primary">
            {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || "U"}
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm text-foreground">
                {profile?.full_name || "User"}
              </p>
              <p className="truncate font-body text-[11px] text-muted-foreground">
                {profile?.email}
              </p>
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={() => { handleSignOut(); isMobile && setMobileOpen(false); }}
          className={`flex w-full items-center gap-2 rounded-button px-3 py-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground ${collapsed && !isMobile ? "justify-center" : ""}`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar — visible at lg (1024px+) */}
      <aside
        className={`hidden flex-col border-r border-border bg-card lg:flex transition-[width] duration-300 ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 lg:px-8">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] border-r-border bg-card p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <SidebarContent isMobile />
              </SheetContent>
            </Sheet>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 font-body text-sm">
              <span className="text-foreground">Dashboard</span>
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/40">/</span>
                  <span className="text-muted-foreground">{crumb}</span>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/dashboard/billing">
              <Button variant="amber" size="sm" className="gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                Buy Credits
              </Button>
            </Link>
            <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-body text-sm font-medium text-primary lg:flex">
              {profile?.full_name?.charAt(0)?.toUpperCase() || profile?.email?.charAt(0)?.toUpperCase() || "U"}
            </div>
          </div>
        </header>

        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-4 py-2">
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
            <span className="font-body text-xs text-destructive">
              You appear to be offline. Reconnect to continue.
            </span>
          </div>
        )}

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
