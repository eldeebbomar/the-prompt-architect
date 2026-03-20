import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Settings, CreditCard, FolderOpen } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useProjects } from "@/hooks/use-projects";
import { useAuth } from "@/contexts/AuthContext";

const statusBadge: Record<string, { label: string; cls: string }> = {
  discovery: { label: "Discovery", cls: "border-primary/50 text-primary" },
  generating: { label: "Generating", cls: "border-primary/50 text-primary" },
  ready: { label: "Ready", cls: "border-secondary/50 text-secondary" },
  revising: { label: "Revising", cls: "border-primary/50 text-primary" },
  completed: { label: "Completed", cls: "border-muted-foreground/30 text-muted-foreground" },
};

const QuickSearch = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: projects } = useProjects();

  // Global Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (user) setOpen((o) => !o);
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (user) navigate("/dashboard/new");
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [user, navigate]);

  const go = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  if (!user) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search projects, actions..." className="font-body" />
      <CommandList>
        <CommandEmpty className="py-6 text-center font-body text-sm text-muted-foreground">
          No results found.
        </CommandEmpty>

        {/* Quick actions */}
        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => go("/dashboard/new")} className="gap-2">
            <Plus className="h-4 w-4 text-primary" /> New Project
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/settings")} className="gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" /> Settings
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard/billing")} className="gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" /> Credits & Billing
          </CommandItem>
        </CommandGroup>

        {projects && projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((p) => {
                const status = statusBadge[p.status] ?? statusBadge.discovery;
                return (
                  <CommandItem key={p.id} onSelect={() => go(`/project/${p.id}`)} className="gap-3">
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-body text-sm">{p.name}</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 font-body text-[10px] ${status.cls}`}>
                      {status.label}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default QuickSearch;
