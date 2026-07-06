import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Notebook } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — Nova AI" }] }),
  component: NotesPage,
});

type Note = { id: string; title: string; content: string; updated_at: string };

function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = async () => {
    const { data } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
    setNotes((data as Note[]) ?? []);
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
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold"><Notebook className="size-5 text-primary" /> Notes</h1>
      <p className="mb-6 text-sm text-muted-foreground">Captured thoughts — by voice or by hand.</p>

      <div className="glass mb-6 rounded-2xl p-4">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="mb-2 bg-white/5" />
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write a note..." className="mb-3 bg-white/5" rows={3} />
        <Button onClick={add} className="nova-gradient-bg text-primary-foreground"><Plus className="size-4" /> Add note</Button>
      </div>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No notes yet. Try saying "Take a note..."</p>
        ) : notes.map((n) => (
          <div key={n.id} className="glass group flex items-start justify-between gap-3 rounded-xl p-4">
            <div className="min-w-0">
              <h3 className="font-medium">{n.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{n.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">{new Date(n.updated_at).toLocaleString()}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(n.id)} className="opacity-0 group-hover:opacity-100"><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
