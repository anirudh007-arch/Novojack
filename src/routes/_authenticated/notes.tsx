import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/nova/PageHeader";
import { EmptyState } from "@/components/nova/EmptyState";
import { Trash2, Plus, Notebook } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — Nova AI" }] }),
  component: NotesPage,
});

type Note = { id: string; title: string; content: string; updated_at: string };

function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = async () => {
    const { data } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim() && !content.trim()) return;
    const { error } = await supabase.from("notes").insert({
      title: title.trim() || "Untitled",
      content,
      user_id: (await supabase.auth.getUser()).data.user!.id,
    });
    if (error) return toast.error(error.message);
    setTitle(""); setContent(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("notes").delete().eq("id", id);
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        icon={<Notebook className="size-5 text-primary" />}
        title="Notes"
        description='Captured thoughts — by voice or by hand. Try saying "Take a note..." to Nova.'
      />

      <div className="glass mb-6 rounded-2xl p-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mb-2 bg-white/5" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a note..." className="mb-3 bg-white/5" rows={3} />
        <Button onClick={add} className="nova-gradient-bg text-primary-foreground"><Plus className="size-4" /> Add note</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<Notebook className="size-8" />}
          title="No notes yet"
          description='Try saying "Take a note..." in the assistant, or add one above.'
        />
      ) : (
        <div className="space-y-3">
          {notes.map((n, i) => (
            <div
              key={n.id}
              className="glass nova-lift group flex animate-in fade-in slide-in-from-bottom-1 items-start justify-between gap-3 rounded-xl p-4 duration-300"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <div className="min-w-0">
                <h3 className="font-medium">{n.title}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(n.updated_at).toLocaleString()}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(n.id)} className="opacity-0 group-hover:opacity-100" aria-label="Delete note">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
