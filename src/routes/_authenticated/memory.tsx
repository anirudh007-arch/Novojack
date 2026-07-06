import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { summarizeMemories } from "@/lib/briefing.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrainCircuit, Plus, Trash2, Search, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/memory")({
  head: () => ({ meta: [{ title: "Memory — Nova AI" }] }),
  component: Page,
});

type Memory = { id: string; fact: string; created_at: string };

function Page() {
  const [items, setItems] = useState<Memory[]>([]);
  const [fact, setFact] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const summarize = useServerFn(summarizeMemories);

  const load = async () => {
    const { data } = await supabase.from("memories").select("*").order("created_at", { ascending: false });
    setItems((data as Memory[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => m.fact.toLowerCase().includes(q));
  }, [items, query]);

  const add = async () => {
    if (!fact.trim()) return;
    const { error } = await supabase.from("memories").insert({
      fact: fact.trim(),
      user_id: (await supabase.auth.getUser()).data.user!.id,
    });
    if (error) return toast.error(error.message);
    setFact(""); load();
  };
  const remove = async (id: string) => { await supabase.from("memories").delete().eq("id", id); load(); };

  const consolidate = async () => {
    setBusy(true);
    try {
      const r = await summarize({});
      toast.success(r.summary);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Summarize failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BrainCircuit className="size-5 text-primary" /> Memory
        </h1>
        <Button onClick={consolidate} disabled={busy || items.length < 4} variant="outline" size="sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Consolidate
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Things Nova remembers about you. These shape every reply.</p>

      <div className="glass mb-4 flex gap-2 rounded-2xl p-4">
        <Input value={fact} onChange={(e) => setFact(e.target.value)} placeholder="e.g. I prefer concise answers" className="flex-1 bg-white/5" />
        <Button onClick={add} className="nova-gradient-bg text-primary-foreground"><Plus className="size-4" /></Button>
      </div>

      <div className="glass mb-4 flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <span className="text-xs text-muted-foreground">{filtered.length}/{items.length}</span>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {items.length === 0 ? 'No memories yet. Try "Remember that..." in the assistant.' : "No matches."}
          </p>
        ) : filtered.map((m) => (
          <div key={m.id} className="glass group flex items-center gap-3 rounded-xl px-4 py-3">
            <span className="flex-1 text-sm">{m.fact}</span>
            <Button variant="ghost" size="icon" onClick={() => remove(m.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
