import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { analyzeMedia, understandScreen, type ScreenUnderstanding } from "@/lib/vision.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Eye, FileText, Upload, Loader2, X, ScanSearch, Monitor } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/nova/PageHeader";

export const Route = createFileRoute("/_authenticated/vision")({
  head: () => ({ meta: [{ title: "Vision & Screen Understanding — Nova AI" }] }),
  component: VisionPage,
});

type Mode = "screen" | "doc";

function VisionPage() {
  const [mode, setMode] = useState<Mode>("screen");
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [question, setQuestion] = useState("");
  const [languageHint, setLanguageHint] = useState("");

  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [screen, setScreen] = useState<ScreenUnderstanding | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const analyze = useServerFn(analyzeMedia);
  const understand = useServerFn(understandScreen);

  const isPdf = file?.type === "application/pdf";
  const isImage = file?.type?.startsWith("image/");

  const onPick = (f: File | null) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) return toast.error("File too large (max 10MB)");
    if (mode === "screen" && !f.type.startsWith("image/")) return toast.error("Screen mode needs a screenshot image");
    if (mode === "doc" && !f.type.startsWith("image/") && f.type !== "application/pdf")
      return toast.error("Upload an image or PDF");
    const reader = new FileReader();
    reader.onload = () => {
      setFile(f);
      setDataUrl(String(reader.result));
      setReply("");
      setScreen(null);
    };
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!dataUrl) return toast.error("Pick a file first");
    setBusy(true); setReply(""); setScreen(null);
    try {
      if (mode === "screen") {
        const res = await understand({ data: { dataUrl, question, languageHint: languageHint.trim() || undefined } });
        setScreen(res);
      } else {
        const res = await analyze({ data: { dataUrl, filename: file?.name, question } });
        setReply(res.reply);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => { setFile(null); setDataUrl(""); setReply(""); setQuestion(""); setScreen(null); };

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6">
      <PageHeader
        icon={<Eye className="size-5 text-primary" />}
        title="Vision & Screen Understanding"
        description="Drop in a screenshot and Nova reads the text, explains UI elements, and suggests next steps."
      />

      <div className="mb-4 inline-flex w-fit rounded-xl bg-white/5 p-1 text-sm">
        <button
          onClick={() => { setMode("screen"); clear(); }}
          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5", mode === "screen" && "bg-primary text-primary-foreground")}
        >
          <Monitor className="size-4" /> Screen
        </button>
        <button
          onClick={() => { setMode("doc"); clear(); }}
          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5", mode === "doc" && "bg-primary text-primary-foreground")}
        >
          <FileText className="size-4" /> Document
        </button>
      </div>

      {!file ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-12 transition hover:border-primary/60"
        >
          <Upload className="size-10 text-primary" />
          <div className="text-base font-medium">
            {mode === "screen" ? "Upload a screenshot" : "Upload an image or PDF"}
          </div>
          <div className="text-xs text-muted-foreground">
            {mode === "screen" ? "PNG, JPG, WEBP · up to 10MB" : "PNG, JPG, WEBP, or PDF · up to 10MB"}
          </div>
        </button>
      ) : (
        <div className="glass relative rounded-2xl p-4">
          <button onClick={clear} aria-label="Remove file" className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5 hover:bg-white/20"><X className="size-4" /></button>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            {isPdf ? <FileText className="size-4" /> : <Eye className="size-4" />}
            <span className="truncate">{file.name}</span>
          </div>
          {isImage && <img src={dataUrl} alt="preview" className="mx-auto mb-3 max-h-72 rounded-xl object-contain" />}
          {isPdf && (
            <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
              <FileText className="size-8 text-primary" />
              <div className="text-sm">
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</div>
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={mode === "screen" ? "image/*" : "image/*,application/pdf"}
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={
          mode === "screen"
            ? "Optional: ask about the screen ('What does this error mean?' / 'How do I send this?')"
            : isPdf ? "Summarize this PDF / Ask anything about it..." : "Describe / Ask about this image..."
        }
        className="mt-4 min-h-20 bg-white/5"
        disabled={busy}
      />

      {mode === "screen" && (
        <input
          value={languageHint}
          onChange={(e) => setLanguageHint(e.target.value)}
          placeholder="OCR language hint (optional, auto-detected) — e.g. en, ja, ar, zh"
          className="mt-2 w-full rounded-lg border border-border bg-white/5 px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
          disabled={busy}
        />
      )}

      <Button onClick={submit} disabled={busy || !file} className="nova-gradient-bg mt-3 text-primary-foreground">
        {busy ? <><Loader2 className="size-4 animate-spin" /> Analyzing...</> : (mode === "screen" ? <><ScanSearch className="size-4" /> Read my screen</> : "Ask Nova")}
      </Button>


      {reply && (
        <div className="glass mt-6 whitespace-pre-wrap rounded-2xl border border-border p-4 text-sm leading-relaxed">{reply}</div>
      )}

      {screen && (
        <div className="mt-6 space-y-4">
          {(screen.detected_languages?.length || screen.orientation_degrees || screen.image_quality || screen.notes) && (
            <section className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3 text-xs">
              {screen.detected_languages?.map((l) => (
                <span key={l} className="rounded bg-primary/20 px-2 py-0.5 uppercase text-primary">{l}</span>
              ))}
              {!!screen.orientation_degrees && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">rotated {screen.orientation_degrees}°</span>
              )}
              {screen.image_quality && (
                <span className={cn(
                  "rounded px-2 py-0.5",
                  screen.image_quality === "low" ? "bg-rose-500/20 text-rose-300"
                  : screen.image_quality === "medium" ? "bg-amber-500/20 text-amber-300"
                  : "bg-emerald-500/20 text-emerald-300"
                )}>{screen.image_quality}-res</span>
              )}
              {screen.notes && <span className="text-muted-foreground">· {screen.notes}</span>}
            </section>
          )}

          {screen.summary && (
            <section className="glass rounded-2xl p-4">
              <h2 className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">What Nova sees</h2>
              <p className="text-sm leading-relaxed">{screen.summary}</p>
            </section>
          )}


          {screen.answer && (
            <section className="glass rounded-2xl border border-primary/40 p-4">
              <h2 className="mb-1 text-xs uppercase tracking-wide text-primary">Answer</h2>
              <p className="text-sm leading-relaxed">{screen.answer}</p>
            </section>
          )}

          {screen.visible_text.length > 0 && (
            <section className="glass rounded-2xl p-4">
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Visible text</h2>
              <ul className="space-y-1 text-sm">
                {screen.visible_text.map((t, i) => (
                  <li key={i} className="rounded bg-white/5 px-2 py-1 font-mono text-xs">{t}</li>
                ))}
              </ul>
            </section>
          )}

          {screen.ui_elements.length > 0 && (
            <section className="glass rounded-2xl p-4">
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">UI elements</h2>
              <ul className="space-y-2 text-sm">
                {screen.ui_elements.map((el, i) => (
                  <li key={i} className="rounded-lg bg-white/5 p-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] uppercase text-primary">{el.kind}</span>
                      <span className="font-medium">{el.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{el.purpose}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {screen.suggested_actions.length > 0 && (
            <section className="glass rounded-2xl p-4">
              <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Suggested next steps</h2>
              <ul className="space-y-2 text-sm">
                {screen.suggested_actions.map((a, i) => (
                  <li key={i} className="rounded-lg bg-white/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{a.title}</span>
                      {a.requires_desktop && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">desktop</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.rationale}</p>
                  </li>
                ))}
              </ul>
              {screen.suggested_actions.some(a => a.requires_desktop) && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Actions tagged <span className="text-amber-300">desktop</span> need the Nova desktop companion (see <code>desktop/</code> in the project).
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
