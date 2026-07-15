import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleConnectionStatus } from "@/integrations/google/connections.functions";
import { signInWithGoogle } from "@/lib/google-oauth";
import { getGithubConnectionStatus, exchangeGithubCode } from "@/integrations/github/connections.functions";
import { connectGithub, consumeGithubOAuthState } from "@/lib/github-oauth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/nova/PageHeader";
import { Settings as SettingsIcon, LogOut, Sparkles, Link2, CheckCircle2, Github } from "lucide-react";
import { toast } from "sonner";

const OAUTH_REDIRECT_URI = typeof window !== "undefined" ? `${window.location.origin}/settings` : "";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Nova AI" }] }),
  component: Page,
});

// Gemini's prebuilt TTS voice names (curated subset — Nova speaks direct
// Gemini TTS, not the old OpenAI-shaped gateway voices).
const VOICES = [
  { id: "Kore", label: "Kore — balanced" },
  { id: "Puck", label: "Puck — upbeat" },
  { id: "Charon", label: "Charon — calm" },
  { id: "Fenrir", label: "Fenrir — confident" },
  { id: "Aoede", label: "Aoede — breezy" },
  { id: "Leda", label: "Leda — youthful" },
  { id: "Orus", label: "Orus — firm" },
];

const LANGS = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "es-ES", label: "Spanish" },
  { id: "fr-FR", label: "French" },
  { id: "de-DE", label: "German" },
  { id: "hi-IN", label: "Hindi" },
  { id: "ta-IN", label: "Tamil" },
  { id: "pa-IN", label: "Punjabi" },
];

const PERSONALITIES = [
  { id: "friendly", label: "Friendly — warm, casual, encouraging" },
  { id: "professional", label: "Professional — precise, formal, efficient" },
  { id: "mentor", label: "Mentor — reflective, asks great questions" },
  { id: "technical", label: "Technical — direct, detail-heavy" },
  { id: "creative", label: "Creative — playful, imaginative" },
];

const LENGTHS = [
  { id: "brief", label: "Brief — one or two sentences" },
  { id: "balanced", label: "Balanced — a short paragraph" },
  { id: "detailed", label: "Detailed — full explanations" },
];

const ACCENTS = [
  { id: "violet", label: "Violet" },
  { id: "cyan", label: "Cyan" },
  { id: "emerald", label: "Emerald" },
  { id: "rose", label: "Rose" },
  { id: "amber", label: "Amber" },
];

function Page() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [voice, setVoice] = useState("Kore");
  const [language, setLanguage] = useState("en-US");
  const [personality, setPersonality] = useState("friendly");
  const [responseLength, setResponseLength] = useState("balanced");
  const [wakeWord, setWakeWord] = useState("Hey Nova");
  const [location, setLocation] = useState("");
  const [accentColor, setAccentColor] = useState("violet");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleScope, setGoogleScope] = useState<string | null>(null);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [githubBusy, setGithubBusy] = useState(false);
  const getGoogleStatus = useServerFn(getGoogleConnectionStatus);
  const getGithubStatus = useServerFn(getGithubConnectionStatus);
  const runExchangeGithubCode = useServerFn(exchangeGithubCode);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setVoice(data.preferred_voice ?? "Kore");
        setLanguage(data.preferred_language ?? "en-US");
        setPersonality((data as any).personality ?? "friendly");
        setResponseLength((data as any).response_length ?? "balanced");
        setWakeWord((data as any).wake_word ?? "Hey Nova");
        setLocation((data as any).location ?? "");
        setAccentColor((data as any).accent_color ?? "violet");
      }
      setLoading(false);
      getGoogleStatus({}).then((r) => { setGoogleConnected(r.connected); setGoogleScope(r.scope); }).catch(() => setGoogleConnected(false));

      // Finish a GitHub OAuth redirect if we just came back from github.com
      // with ?code=&state= — otherwise just refresh the connection status.
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error");
      if (code || oauthError) window.history.replaceState(null, "", window.location.pathname);

      if (oauthError) {
        toast.error("Connection was cancelled.");
      } else if (code) {
        if (!consumeGithubOAuthState(state)) {
          toast.error("GitHub connection failed (state mismatch). Please try again.");
          setGithubConnected(false);
        } else {
          setGithubBusy(true);
          try {
            const r = await runExchangeGithubCode({ data: { code, redirectUri: OAUTH_REDIRECT_URI } });
            setGithubConnected(true);
            setGithubLogin(r.login);
            toast.success(r.login ? `Connected GitHub as @${r.login}` : "GitHub connected");
          } catch (e) {
            toast.error((e as Error).message || "GitHub connection failed.");
            setGithubConnected(false);
          } finally {
            setGithubBusy(false);
          }
        }
      } else {
        getGithubStatus({}).then((r) => { setGithubConnected(r.connected); setGithubLogin(r.login); }).catch(() => setGithubConnected(false));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({
      display_name: displayName,
      preferred_voice: voice,
      preferred_language: language,
      personality,
      response_length: responseLength,
      wake_word: wakeWord,
      location,
      accent_color: accentColor,
    } as any).eq("id", u.user!.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  const connectGoogle = () => signInWithGoogle(window.location.href);

  const connectGitHub = () => {
    try {
      connectGithub(OAUTH_REDIRECT_URI);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const googleNeedsTasksReconnect = googleConnected === true && !!googleScope && !googleScope.includes("tasks");

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader
        icon={<SettingsIcon className="size-5 text-primary" />}
        title="Settings"
        description="Personalize Nova — voice, personality, connections, and how it talks with you."
      />

      <Section title="Profile">
        <div>
          <Label className="text-xs text-muted-foreground">Email</Label>
          <p className="mt-1 text-sm">{email}</p>
        </div>
        <Field label="Display name">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-white/5" />
        </Field>
        <Field label="City for weather & briefing">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mumbai" className="bg-white/5" />
        </Field>
      </Section>

      <Section title="Connections" icon={<Link2 className="size-4 text-primary" />}>
        <div className="nova-lift flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`flex size-9 items-center justify-center rounded-lg ${googleConnected ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-muted-foreground"}`}>
              {googleConnected ? <CheckCircle2 className="size-5" /> : <Link2 className="size-5" />}
            </div>
            <div>
              <p className="text-sm font-medium">Google (Gmail + Calendar + Tasks)</p>
              <p className="text-xs text-muted-foreground">
                {googleConnected === null
                  ? "Checking..."
                  : googleConnected
                    ? googleNeedsTasksReconnect
                      ? "Connected — reconnect to grant access to Google Tasks."
                      : "Connected — Nova can read unread mail, events, and tasks."
                    : "Not connected"}
              </p>
            </div>
          </div>
          <Button size="sm" variant={googleConnected && !googleNeedsTasksReconnect ? "outline" : "default"} className={googleConnected && !googleNeedsTasksReconnect ? "" : "nova-gradient-bg text-primary-foreground"} onClick={connectGoogle}>
            {googleConnected ? "Reconnect" : "Connect"}
          </Button>
        </div>

        <div className="nova-lift flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`flex size-9 items-center justify-center rounded-lg ${githubConnected ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-muted-foreground"}`}>
              {githubConnected ? <CheckCircle2 className="size-5" /> : <Github className="size-5" />}
            </div>
            <div>
              <p className="text-sm font-medium">GitHub</p>
              <p className="text-xs text-muted-foreground">
                {githubBusy
                  ? "Connecting..."
                  : githubConnected === null
                    ? "Checking..."
                    : githubConnected
                      ? `Connected${githubLogin ? ` as @${githubLogin}` : ""} — Nova can read your notifications.`
                      : "Not connected"}
              </p>
            </div>
          </div>
          <Button size="sm" variant={githubConnected ? "outline" : "default"} className={githubConnected ? "" : "nova-gradient-bg text-primary-foreground"} onClick={connectGitHub} disabled={githubBusy}>
            {githubConnected ? "Reconnect" : "Connect"}
          </Button>
        </div>
      </Section>

      <Section title="Personality" icon={<Sparkles className="size-4 text-primary" />}>
        <Field label="How Nova should behave">
          <Select value={personality} onValueChange={setPersonality}>
            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERSONALITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Preferred response length">
          <Select value={responseLength} onValueChange={setResponseLength}>
            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LENGTHS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Accent color">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccentColor(a.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${accentColor === a.id ? "border-primary bg-primary/20" : "border-border bg-white/5"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Voice">
        <Field label="Assistant voice">
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Language (speech input)">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Wake word">
          <Input value={wakeWord} onChange={(e) => setWakeWord(e.target.value)} placeholder="Hey Nova" className="bg-white/5" />
          <p className="mt-1 text-xs text-muted-foreground">Nova wakes when it hears this phrase. Keep it short and distinctive.</p>
        </Field>
      </Section>

      <Button onClick={save} disabled={saving} className="w-full nova-gradient-bg text-primary-foreground">
        {saving ? "Saving..." : "Save preferences"}
      </Button>

      <div className="glass mt-6 flex items-center justify-between rounded-2xl p-4">
        <div>
          <p className="font-medium">Sign out</p>
          <p className="text-xs text-muted-foreground">End your current session.</p>
        </div>
        <Button variant="outline" onClick={signOut} aria-label="Sign out"><LogOut className="size-4" /> Sign out</Button>
      </div>

      <div className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
        <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass mb-4 space-y-4 rounded-2xl p-6">
      <h2 className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
