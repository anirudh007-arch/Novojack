import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/nova/PageHeader";
import { EmptyState } from "@/components/nova/EmptyState";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/todos")({
  head: () => ({ meta: [{ title: "Todos — Nova AI" }] }),
  component: Page,
});

type Todo = { id: string; title: string; priority: "low" | "medium" | "high"; completed: boolean };

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-emerald-400",
  medium: "text-amber-400",
  high: "text-rose-400",
};

function Page() {
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const load = async () => {
    const { data } = await supabase.from("todos").select("*").order("created_at", { ascending: false });
    setItems((data as Todo[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("todos").insert({
      title: title.trim(),
      priority,
      user_id: (await supabase.auth.getUser()).data.user!.id,
    });
    if (error) return toast.error(error.message);
    setTitle(""); load();
  };
  const toggle = async (t: Todo) => { await supabase.from("todos").update({ completed: !t.completed }).eq("id", t.id); load(); };
  const remove = async (id: string) => { await supabase.from("todos").delete().eq("id", id); load(); };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        icon={<ListChecks className="size-5 text-primary" />}
        title="Todos"
        description='Your task list. Say "Add X to my todos" to Nova.'
      />

      <div className="glass mb-6 flex flex-col gap-2 rounded-2xl p-4 sm:flex-row">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task..." className="flex-1 bg-white/5" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
          <SelectTrigger className="bg-white/5 sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={add} className="nova-gradient-bg text-primary-foreground" aria-label="Add todo"><Plus className="size-4" /></Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-8" />} title="No tasks yet" description="Add one above, or ask Nova to add it for you." />
      ) : (
        <div className="space-y-2">
          {items.map((t, i) => (
            <div
              key={t.id}
              className="glass group flex animate-in fade-in slide-in-from-bottom-1 items-center gap-3 rounded-xl px-4 py-3 duration-300"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Checkbox checked={t.completed} onCheckedChange={() => toggle(t)} />
              <span className={cn("flex-1", t.completed && "line-through text-muted-foreground")}>{t.title}</span>
              <span className={cn("text-xs font-medium uppercase", PRIORITY_COLOR[t.priority])}>{t.priority}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100" aria-label="Delete todo"><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
