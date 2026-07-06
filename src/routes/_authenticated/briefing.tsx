import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { generateBriefing } from "@/lib/briefing.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, Cloud, Newspaper, Mail, CalendarClock, ListChecks, Lightbulb,
  RefreshCw, Loader2, Target, Quote, TrendingUp, Mic, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { signInWithGoogle } from "@/lib/google-oauth";

export const Route = createFileRoute("/_authenticated/briefing")({
  head: () => ({ meta: [{ title: "Dashboard — Nova AI" }] }),
  component: BriefingPage,
});

type Briefing = {
  greeting?: string;
  summary?: string;
  highlights?: string[];
  recommendations?: string[];
  weather_line?: string;
  news_line?: string;
  quote?: string;
  focus?: string;
  productivity_score?: number;
  done_today?: number;
  user_name?: string | null;
  raw?: any;
  connectors?: { gmail: boolean; calendar: boolean };
};

function BriefingPage() {
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("nova:location") || "" : "",
  );
  const gen = useServerFn(generateBriefing);

  const load = async () => {
    setLoading(true);
    try {
      const res = await gen({ data: { location } });
      setData(res as Briefing);
    } catch (e: any) {
      toast.error(e?.message ?? "Briefing failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const saveLocation = (v: string) => {
    setLocation(v);
    try { localStorage.setItem("nova:location", v); } catch {}
  };

  const score = data?.productivity_score ?? 0;
  const scoreColor = score >= 70 ? "text-emerald-400" : score >= 40 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Your dashboard</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">
            {data?.greeting || "Good day"}
          </h1>
          {data?.summary && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{data.summary}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/assistant">
            <Button className="nova-gradient-bg text-primary-foreground">
              <Mic className="size-4" /> Talk to Nova
            </Button>
          </Link>
          <Button onClick={load} disabled={loading} variant="ghost" size="icon" title="Refresh" aria-label="Refresh briefing">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </header>

      {/* Top row: focus + productivity score + quote */}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5 md:col-span-2">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Target className="size-3.5 text-primary" /> Today's focus
          </div>
          <p className="text-lg font-medium leading-snug">
            {data?.focus || (loading ? "…" : "Set a focus by adding tasks or memories Nova can learn from.")}
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="size-3.5 text-primary" /> Productivity
          </div>
          <div className="flex items-baseline gap-2">
            <div className={`text-4xl font-semibold ${scoreColor}`}>{score}</div>
            <div className="text-xs text-muted-foreground">/ 100</div>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full nova-gradient-bg transition-all" style={{ width: `${score}%` }} />
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{data?.done_today ?? 0} completed today</div>
        </div>
      </div>

      {data?.quote && (
        <div className="glass mb-4 flex items-start gap-3 rounded-2xl p-4">
          <Quote className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-sm italic text-muted-foreground">"{data.quote}"</p>
        </div>
      )}

      <div className="glass mb-6 flex items-center gap-2 rounded-xl p-3 text-sm">
        <Cloud className="size-4 text-primary" />
        <input
          value={location}
          onChange={(e) => saveLocation(e.target.value)}
          onBlur={load}
          placeholder="Your city for weather (e.g. Mumbai)"
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28 rounded-2xl md:col-span-2" />
          <Skeleton className="h-28 rounded-2xl md:col-span-2" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data && !data.connectors?.calendar && !data.connectors?.gmail && (
            <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 p-4 md:col-span-2">
              <div className="flex items-center gap-3">
                <Link2 className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Connect Google for a fuller briefing</p>
                  <p className="text-xs text-muted-foreground">See your real calendar events and unread email right here.</p>
                </div>
              </div>
              <Button
                size="sm"
                className="nova-gradient-bg text-primary-foreground"
                onClick={() => signInWithGoogle(window.location.href)}
              >
                Connect Google
              </Button>
            </div>
          )}

          {data?.highlights && data.highlights.length > 0 && (
            <Card icon={<Sparkles className="size-4" />} title="Today's highlights" full>
              <ul className="space-y-1.5 text-sm">
                {data.highlights.map((h, i) => <li key={i}>• {h}</li>)}
              </ul>
            </Card>
          )}

          {data?.recommendations && data.recommendations.length > 0 && (
            <Card icon={<Lightbulb className="size-4" />} title="Nova recommends" full>
              <ul className="space-y-1.5 text-sm">
                {data.recommendations.map((r, i) => <li key={i}>→ {r}</li>)}
              </ul>
            </Card>
          )}

          <Card icon={<CalendarClock className="size-4" />} title="Schedule">
            {!data?.connectors?.calendar ? (
              <Empty>Connect Google Calendar to see today's events.</Empty>
            ) : data?.raw?.events?.length ? (
              <ul className="space-y-1.5 text-sm">
                {data.raw.events.slice(0, 5).map((e: any, i: number) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{fmtTime(e.start)}</span>{" "}
                    <span>{e.summary}</span>
                    {e.location && <span className="text-xs text-muted-foreground"> · {e.location}</span>}
                  </li>
                ))}
              </ul>
            ) : <Empty>Nothing on the calendar today. 🎉</Empty>}
          </Card>

          <Card icon={<Mail className="size-4" />} title="Unread emails">
            {!data?.connectors?.gmail ? (
              <Empty>Connect Gmail to see unread.</Empty>
            ) : data?.raw?.emails?.length ? (
              <ul className="space-y-1.5 text-sm">
                {data.raw.emails.slice(0, 5).map((m: any, i: number) => (
                  <li key={i}>
                    <div className="font-medium truncate">{m.subject || "(no subject)"}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.from}</div>
                  </li>
                ))}
              </ul>
            ) : <Empty>Inbox zero. ✨</Empty>}
          </Card>

          <Card icon={<ListChecks className="size-4" />} title="Top tasks">
            {data?.raw?.todos?.length ? (
              <ul className="space-y-1.5 text-sm">
                {data.raw.todos.slice(0, 6).map((t: any, i: number) => (
                  <li key={i}>
                    <span className="text-xs uppercase text-muted-foreground mr-2">{t.priority}</span>
                    {t.title}
                  </li>
                ))}
              </ul>
            ) : <Empty>No open todos.</Empty>}
          </Card>

          <Card icon={<Cloud className="size-4" />} title="Weather">
            {data?.weather_line || (data?.raw?.weather ? formatWeather(data.raw.weather) : <Empty>Set your city above.</Empty>)}
          </Card>

          <Card icon={<Newspaper className="size-4" />} title="News" full>
            {data?.news_line && <p className="mb-2 text-sm">{data.news_line}</p>}
            {data?.raw?.news?.length ? (
              <ul className="space-y-1 text-sm">
                {data.raw.news.slice(0, 5).map((n: any, i: number) => (
                  <li key={i}>
                    <a href={n.link} target="_blank" rel="noreferrer" className="hover:underline">{n.title}</a>
                    {n.source && <span className="ml-2 text-xs text-muted-foreground">{n.source}</span>}
                  </li>
                ))}
              </ul>
            ) : <Empty>No news fetched.</Empty>}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ icon, title, children, full }: { icon: React.ReactNode; title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-4 transition hover:bg-white/[0.04] ${full ? "md:col-span-2" : ""}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}
function formatWeather(w: any) {
  const c = w?.current;
  if (!c) return "Weather unavailable.";
  return `${w.location}: ${Math.round(c.temperature_2m)}°, feels-like updates throughout the day.`;
}
