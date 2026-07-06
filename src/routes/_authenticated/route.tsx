import { createFileRoute, Link, Outlet, redirect, useLocation, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Sparkles, Mic, Notebook, BellRing, ListChecks, BrainCircuit, Eye, Settings as SettingsIcon, LogOut, LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

function AuthedLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-xl p-4 md:flex">
        <Link to="/assistant" className="mb-8 flex items-center gap-2 px-2">
          <Sparkles className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Nova<span className="nova-gradient-text">AI</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "nova-gradient-bg text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <div className="mb-2 px-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-sidebar/80 backdrop-blur-xl py-2 md:hidden">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link key={to} to={to} className={cn("flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]", active ? "text-primary" : "text-muted-foreground")}>
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
