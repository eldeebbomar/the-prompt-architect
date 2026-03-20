import { useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Rocket,
  FolderOpen,
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
  { label: "Credits & Billing", href: "/dashboard/billing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
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

  // Breadcrumb from path
  const breadcrumb = location.pathname
    .replace("/dashboard", "")
    .split("/")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Logo + collapse */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link to="/dashboard" className="flex items-center gap-2" onClick={() => isMobile && setMobileOpen(false)}>
          {collapsed && !isMobile ? (
            <span className="font-heading text-lg tracking-[0.05em] text-primary">LP</span>
          ) : (
            <span className="font-heading text-xl tracking-[0.05em] text-primary">LovPlan</span>
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
        <div className={`flex items-center gap-2 rounded-button px-3 py-2 ${collapsed && !isMobile ? "justify-center" : ""}`}>
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
                <Button variant="ghost" size="icon" className="shrink-0">
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

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
