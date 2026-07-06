import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Mic, BrainCircuit, BellRing, Notebook, Ear } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nova AI — Your personal voice assistant" },
      { name: "description", content: "Talk naturally to capture notes, set reminders, manage tasks and remember what matters. A voice-first AI companion." },
      { property: "og:title", content: "Nova AI — Your personal voice assistant" },
      { property: "og:description", content: "Talk naturally to capture notes, set reminders, manage tasks and remember what matters." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Nova<span className="nova-gradient-text">AI</span>
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button className="nova-gradient-bg text-primary-foreground">Get started</Button></Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
        <div className="mx-auto mb-10 inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-4 py-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Voice-first · Memory-aware · Always with you
        </div>

        <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Your personal AI,
          <br />
          <span className="nova-gradient-text">just speak.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Nova listens, understands and remembers. Capture notes, set reminders,
          manage tasks — all in natural conversation.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="nova-gradient-bg text-primary-foreground nova-glow">
              <Mic className="size-4" /> Start talking to Nova
            </Button>
          </Link>
        </div>

        {/* Orb */}
        <div className="relative mx-auto mt-20 size-72">
          <div
            className="absolute inset-0 rounded-full nova-gradient-bg blur-2xl opacity-60"
            style={{ animation: "orb-pulse 4s ease-in-out infinite" }}
          />
          <div
            className="absolute inset-4 rounded-full nova-gradient-bg opacity-90"
            style={{ animation: "orb-pulse 3s ease-in-out infinite" }}
          />
          <div className="absolute inset-10 rounded-full bg-background/40 backdrop-blur-xl flex items-center justify-center">
            <Sparkles className="size-12 text-white/80" />
          </div>
        </div>

        <div className="mx-auto mt-24 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<Mic className="size-5" />} title="Real voice chat" desc="Speak naturally. Nova replies in a warm human voice." />
          <Feature icon={<BrainCircuit className="size-5" />} title="Long memory" desc="Remembers your routine, projects and the people you mention." />
          <Feature icon={<BellRing className="size-5" />} title="Reminders" desc="“Remind me to call mom at 7.” Done." />
          <Feature icon={<Notebook className="size-5" />} title="Notes & todos" desc="Capture thoughts and tasks by voice — they land in the right place." />
        </div>

        {/* How it works */}
        <div className="mx-auto mt-24 max-w-4xl">
          <p className="mb-8 text-xs uppercase tracking-widest text-muted-foreground">How it works</p>
          <div className="grid gap-6 text-left sm:grid-cols-3">
            <Step n={1} icon={<Mic className="size-5" />} title="Speak" desc="Tap the orb or say your wake word — talk to Nova like you would a friend." />
            <Step n={2} icon={<Ear className="size-5" />} title="Understand" desc="Nova parses intent, routes it to the right skill, and figures out what you need." />
            <Step n={3} icon={<BrainCircuit className="size-5" />} title="Remember" desc="Facts, tasks and context stick around, so every future conversation gets sharper." />
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span>
              Nova<span className="nova-gradient-text">AI</span> — your voice-first companion
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <span>© {new Date().getFullYear()} Nova AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Step({ n, icon, title, desc }: { n: number; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="relative">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg nova-gradient-bg text-primary-foreground">
          {icon}
        </div>
        <span className="text-xs font-medium text-muted-foreground">Step {n}</span>
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="glass rounded-xl p-5 text-left">
      <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg nova-gradient-bg text-primary-foreground">
        {icon}
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
