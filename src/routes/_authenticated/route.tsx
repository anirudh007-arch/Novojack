import { createFileRoute, Link, Outlet, redirect, useLocation, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Sparkles, Mic, Notebook, BellRing, ListChecks, BrainCircuit, Eye, Settings as SettingsIcon, LogOut, LayoutDashboard, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/nova/CommandPalette";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const navItems = [
  { to: "/briefing", label: "Briefing", icon: LayoutDashboard },
  { to: "/assistant", label: "Assistant", icon: Mic },
  { to: "/vision", label: "Vision", icon: Eye },
  { to: "/notes", label: "Notes", icon: Notebook },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/todos", label: "Todos", icon: ListChecks },
  { to: "/memory", label: "Memory", icon: BrainCircuit },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function initialsFor(email?: string | null) {
  if (!email) return "?";
  const local = email.split("@")[0];
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function AuthedLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-xl p-4 md:flex">
        <Link to="/assistant" className="mb-6 flex items-center gap-2 px-2">
          <Sparkles className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Nova<span className="nova-gradient-text">AI</span>
          </span>
        </Link>

        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-6 flex items-center gap-2 rounded-lg border border-border bg-white/5 px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-white/10"
        >
          <Search className="size-3.5" />
          <span className="flex-1">Search...</span>
          <kbd className="rounded border border-border bg-white/5 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                  active
                    ? "nova-gradient-bg text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent",
                )}
              >
                <Icon className={cn("size-4 transition-transform", !active && "group-hover:scale-110")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-2 px-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full nova-gradient-bg text-[11px] font-semibold text-primary-foreground">
              {initialsFor(user?.email)}
            </div>
            <div className="min-w-0 truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={signOut} aria-label="Sign out">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-sidebar/80 backdrop-blur-xl py-2 md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {active && <span className="absolute -top-2 h-0.5 w-5 rounded-full nova-gradient-bg" />}
              <Icon className={cn("size-5 transition-transform", active && "scale-110")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
