import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Nova AI" }] }),
  component: Page,
});

const VOICES = [
  { id: "alloy", label: "Alloy — balanced" },
  { id: "ash", label: "Ash — warm" },
  { id: "coral", label: "Coral — bright" },
  { id: "echo", label: "Echo — calm" },
  { id: "sage", label: "Sage — thoughtful" },
  { id: "shimmer", label: "Shimmer — soft" },
  { id: "verse", label: "Verse — expressive" },
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
  const [voice, setVoice] = useState("alloy");
  const [language, setLanguage] = useState("en-US");
  const [personality, setPersonality] = useState("friendly");
  const [responseLength, setResponseLength] = useState("balanced");
  const [wakeWord, setWakeWord] = useState("Hey Nova");
  const [location, setLocation] = useState("");
  const [accentColor, setAccentColor] = useState("violet");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).single();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setVoice(data.preferred_voice ?? "alloy");
        setLanguage(data.preferred_language ?? "en-US");
        setPersonality((data as any).personality ?? "friendly");
        setResponseLength((data as any).response_length ?? "balanced");
        setWakeWord((data as any).wake_word ?? "Hey Nova");
        setLocation((data as any).location ?? "");
        setAccentColor((data as any).accent_color ?? "violet");
      }
      setLoading(false);
    })();
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

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold"><SettingsIcon className="size-5 text-primary" /> Settings</h1>
      <p className="mb-6 text-sm text-muted-foreground">Personalize Nova — voice, personality, and how it talks with you.</p>

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
        <Button variant="outline" onClick={signOut}><LogOut className="size-4" /> Sign out</Button>
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
