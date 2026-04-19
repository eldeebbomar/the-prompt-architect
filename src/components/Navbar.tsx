import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, Coins, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import lovplanWordmark from "@/assets/lovplan-wordmark.png";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const publicLinks = [
  { label: "How it Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Examples", href: "/examples" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[hsl(var(--nav-border))] bg-[hsl(var(--nav-bg))] backdrop-blur-sm">
      <div className="container flex h-full items-center justify-between">
        <Link to="/" className="flex items-center" aria-label="Lovplan home">
          <img
            src={lovplanWordmark}
            alt="Lovplan"
            width={160}
            height={40}
            className="h-8 w-auto md:h-9"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {!user &&
            publicLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="font-body text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          {user && (
            <>
              <Link
                to="/dashboard"
                className="font-body text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                to="/pricing"
                className="font-body text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Pricing
              </Link>
            </>
          )}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 md:flex">
          {user ? (
            <>
              <div className="flex items-center gap-1.5 font-mono text-sm text-primary">
                <Coins className="h-4 w-4" />
                <span>{profile?.plan === "unlimited" ? "∞" : profile?.credits ?? 0}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5 text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="navLink" size="sm">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button variant="amber" size="default">Start Building</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="h-11 w-11">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="border-l-border bg-card">
            <SheetHeader>
              <SheetTitle asChild>
                <img
                  src={lovplanWordmark}
                  alt="Lovplan"
                  width={160}
                  height={40}
                  className="h-9 w-auto"
                />
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-8 flex flex-col gap-6">
              {user ? (
                <>
                  <div className="flex items-center gap-1.5 font-mono text-sm text-primary">
                    <Coins className="h-4 w-4" />
                    <span>{profile?.plan === "unlimited" ? "∞" : profile?.credits ?? 0} credits</span>
                  </div>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="font-body text-base text-muted-foreground transition-colors hover:text-foreground">Dashboard</Link>
                  <Link to="/pricing" onClick={() => setOpen(false)} className="font-body text-base text-muted-foreground transition-colors hover:text-foreground">Pricing</Link>
                  <div className="amber-rule my-2" />
                  <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={() => { handleSignOut(); setOpen(false); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </Button>
                </>
              ) : (
                <>
                  {publicLinks.map((link) => (
                    <Link key={link.href} to={link.href} onClick={() => setOpen(false)} className="font-body text-base text-muted-foreground transition-colors hover:text-foreground">{link.label}</Link>
                  ))}
                  <div className="amber-rule my-2" />
                  <Link to="/login" onClick={() => setOpen(false)}><Button variant="ghost" className="w-full justify-start">Sign In</Button></Link>
                  <Link to="/signup" onClick={() => setOpen(false)}><Button variant="amber" className="w-full">Start Building</Button></Link>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
};

export default Navbar;
