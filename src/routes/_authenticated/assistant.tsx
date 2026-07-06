import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithNova, speakText } from "@/lib/nova.functions";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useWakeWord } from "@/hooks/use-wake-word";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles, Ear, EarOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "Assistant — Nova AI" }] }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string; agent?: string; actions?: { label: string; ok?: boolean }[]; at: number };

const SUGGESTIONS = [
  "What's the weather in Tokyo today?",
  "Give me today's AI news",
  "Read my unread emails",
  "What's on my calendar today?",
  "Draft an email to alex@example.com about the launch",
  "Open Slack",
  "Automate booking a flight on kayak.com",
  "Remember my partner's birthday is in October",
];

const AGENT_COLORS: Record<string, string> = {
  research: "bg-blue-500/20 text-blue-300",
  productivity: "bg-emerald-500/20 text-emerald-300",
  communication: "bg-amber-500/20 text-amber-300",
  browser: "bg-purple-500/20 text-purple-300",
  file: "bg-rose-500/20 text-rose-300",
  computer: "bg-slate-500/20 text-slate-300",
  general: "bg-white/10 text-muted-foreground",
};

function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speakOn, setSpeakOn] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [voice, setVoice] = useState("Kore");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const chat = useServerFn(chatWithNova);
  const tts = useServerFn(speakText);
  const { supported, listening, interim, start, stop } = useSpeechRecognition(language);

  // Load profile prefs
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("preferred_language,preferred_voice").eq("id", u.user.id).maybeSingle();
      if (data?.preferred_language) setLanguage(data.preferred_language);
      if (data?.preferred_voice) setVoice(data.preferred_voice);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, interim]);

  const interrupt = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setSpeaking(false);
  };

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    interrupt();
    setInput("");
    const next = [...messages, { role: "user" as const, content: clean, at: Date.now() }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await chat({
        data: {
          conversationId: convId,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setConvId(res.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.reply,
          agent: (res as any).agent,
          actions: res.actions?.map((a) => ({ label: a.label, ok: a.ok })),
          at: Date.now(),
        },
      ]);
      if (speakOn) await playReply(res.reply);
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const playReply = async (text: string) => {
    try {
      setSpeaking(true);
      const { audio } = await tts({ data: { text, voice } });
      if (audioRef.current) {
        audioRef.current.src = audio;
        await audioRef.current.play().catch(() => {});
      }
    } catch {
      // ignore TTS failure
    }
  };

  // Wake-word hook (continuous listening). Disabled when push-to-talk is active.
  useWakeWord({
    language,
    enabled: wakeOn && !listening,
    onCommand: (cmd) => send(cmd),
    onInterrupt: () => interrupt(),
  });

  const handleMic = () => {
    if (!supported) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) stop();
    else start((finalText) => send(finalText));
  };

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hey, I'm <span className="nova-gradient-text">Nova</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {wakeOn ? "Listening for \"Hey Nova\"…" : "Tap the orb and speak — or type below."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWakeOn((v) => !v)}
            title={wakeOn ? "Disable wake word" : 'Enable "Hey Nova" wake word'}
            aria-label={wakeOn ? "Disable wake word" : "Enable wake word"}
          >
            {wakeOn ? <Ear className="size-5 text-primary" /> : <EarOff className="size-5 text-muted-foreground" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { interrupt(); setSpeakOn((v) => !v); }} title="Toggle voice replies" aria-label={speakOn ? "Mute voice replies" : "Unmute voice replies"}>
            {speakOn ? <Volume2 className="size-5 text-primary" /> : <VolumeX className="size-5 text-muted-foreground" />}
          </Button>
        </div>
      </header>

      {/* Orb */}
      <div className="relative mx-auto mb-4 flex size-44 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full nova-gradient-bg blur-2xl opacity-50"
          style={{ animation: `${listening || wakeOn ? "orb-listen 1s ease-in-out infinite" : speaking ? "orb-pulse 1.2s ease-in-out infinite" : "orb-pulse 4s ease-in-out infinite"}` }}
        />
        <button
          onClick={handleMic}
          className={cn(
            "relative size-32 rounded-full nova-gradient-bg shadow-2xl transition-transform",
            "flex items-center justify-center",
            listening && "scale-110",
          )}
          style={{ animation: listening ? "orb-listen 1s ease-in-out infinite" : undefined }}
          aria-label={listening ? "Stop listening" : "Start listening"}
        >
          {listening ? <MicOff className="size-10 text-white" /> : <Mic className="size-10 text-white" />}
        </button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="glass mb-4 flex-1 overflow-y-auto rounded-2xl p-4">
        {messages.length === 0 && !busy && !interim ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="mb-3 size-8 text-primary" />
            <p className="mb-4 text-sm text-muted-foreground">Try saying...</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "group max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/5 border border-border"
                  )}
                >
                  {m.role === "assistant" && m.agent && (
                    <span className={cn("mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide", AGENT_COLORS[m.agent] || AGENT_COLORS.general)}>
                      {m.agent} agent
                    </span>
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  <div className={cn("mt-1 text-[10px] opacity-0 transition-opacity group-hover:opacity-60", m.role === "user" ? "text-primary-foreground" : "text-muted-foreground")}>
                    {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.actions.map((a, j) => (
                        <span
                          key={j}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px]",
                            a.ok
                              ? "nova-gradient-bg text-primary-foreground"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30",
                          )}
                        >
                          {a.ok ? "✓" : "⏳"} {a.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {interim && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-primary/30 px-4 py-2.5 text-sm italic">{interim}</div>
              </div>
            )}
            {busy && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-white/5 px-4 py-3">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="bg-white/5"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()} className="nova-gradient-bg text-primary-foreground">
          <Send className="size-4" />
        </Button>
      </form>

      <audio ref={audioRef} onEnded={() => setSpeaking(false)} onPause={() => setSpeaking(false)} hidden />
    </div>
  );
}
