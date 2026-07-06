import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/nova/PageHeader";
import { EmptyState } from "@/components/nova/EmptyState";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({ meta: [{ title: "Reminders — Nova AI" }] }),
  component: Page,
});

type Reminder = { id: string; title: string; due_at: string | null; completed: boolean };

function Page() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");

  const load = async () => {
    const { data } = await supabase.from("reminders").select("*").order("due_at", { ascending: true, nullsFirst: false });
    setItems((data as Reminder[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("reminders").insert({
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      user_id: (await supabase.auth.getUser()).data.user!.id,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setDue(""); load();
  };

  const toggle = async (r: Reminder) => {
    await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        icon={<BellRing className="size-5 text-primary" />}
        title="Reminders"
        description='Nova will keep these for you. Say "Remind me to..." any time.'
      />

      <div className="glass mb-6 flex flex-col gap-2 rounded-2xl p-4 sm:flex-row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Remind me to..." className="flex-1 bg-white/5" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="bg-white/5 sm:w-56" />
        <Button onClick={add} className="nova-gradient-bg text-primary-foreground" aria-label="Add reminder"><Plus className="size-4" /></Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<BellRing className="size-8" />} title="No reminders yet" description='Add one above, or say "Remind me to..." to Nova.' />
      ) : (
        <div className="space-y-2">
          {items.map((r, i) => (
            <div
              key={r.id}
              className="glass group flex animate-in fade-in slide-in-from-bottom-1 items-center gap-3 rounded-xl px-4 py-3 duration-300"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} />
              <div className="min-w-0 flex-1">
                <p className={r.completed ? "line-through text-muted-foreground" : ""}>{r.title}</p>
                {r.due_at && <p className="text-xs text-muted-foreground">{new Date(r.due_at).toLocaleString()}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100" aria-label="Delete reminder"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
