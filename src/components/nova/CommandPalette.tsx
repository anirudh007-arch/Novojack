import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Mic,
  Notebook,
  BellRing,
  ListChecks,
  BrainCircuit,
  Eye,
  Settings as SettingsIcon,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PAGES = [
  { to: "/briefing", label: "Briefing", icon: LayoutDashboard },
  { to: "/assistant", label: "Assistant", icon: Mic },
  { to: "/vision", label: "Vision", icon: Eye },
  { to: "/notes", label: "Notes", icon: Notebook },
  { to: "/reminders", label: "Reminders", icon: BellRing },
  { to: "/todos", label: "Todos", icon: ListChecks },
  { to: "/memory", label: "Memory", icon: BrainCircuit },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const go = (to: (typeof PAGES)[number]["to"]) => {
    onOpenChange(false);
    navigate({ to });
  };

  const signOut = async () => {
    onOpenChange(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or run a quick action..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Go to">
          {PAGES.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} onSelect={() => go(to)}>
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/notes")}>
            <Notebook /> New note
          </CommandItem>
          <CommandItem onSelect={() => go("/todos")}>
            <ListChecks /> New todo
          </CommandItem>
          <CommandItem onSelect={() => go("/reminders")}>
            <BellRing /> New reminder
          </CommandItem>
          <CommandItem onSelect={signOut}>
            <LogOut /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
