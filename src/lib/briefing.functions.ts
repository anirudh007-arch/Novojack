import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatJSON } from "@/lib/ai/gemini.server";

const GMAIL = "https://gmail.googleapis.com/gmail/v1";
const CALENDAR = "https://www.googleapis.com/calendar/v3";

async function getWeather(loc: string) {
  try {
    let lat = 40.7128, lon = -74.006, label = loc || "New York, US";
    if (loc) {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1`).then(r => r.json()).catch(() => null);
      const hit = geo?.results?.[0];
      if (hit) { lat = hit.latitude; lon = hit.longitude; label = `${hit.name}${hit.country ? ", " + hit.country : ""}`; }
    }
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`).then(r => r.json());
    return { location: label, current: w.current, daily: w.daily };
  } catch { return null; }
}

async function getNews(topic: string) {
  try {
    const xml = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`).then(r => r.text());
    const items: { title: string; source: string; link: string }[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g; let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) && items.length < 5) {
      const b = m[1];
      const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(b)?.[1] || "";
      const link = /<link>([\s\S]*?)<\/link>/.exec(b)?.[1] || "";
      const source = /<source[^>]*>([\s\S]*?)<\/source>/.exec(b)?.[1] || "";
      items.push({ title: title.trim(), source: source.trim(), link: link.trim() });
    }
    return items;
  } catch { return []; }
}

async function getGoogleHeaders(userId: string): Promise<{ Authorization: string } | null> {
  try {
    const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
    const token = await getFreshGoogleAccessToken(userId);
    return { Authorization: `Bearer ${token}` };
  } catch {
    return null;
  }
}

async function getEmails(headers: { Authorization: string } | null) {
  if (!headers) return null;
  try {
    const list = await fetch(`${GMAIL}/users/me/messages?q=is:unread&maxResults=5`, { headers }).then(r => r.json());
    const ids: string[] = (list?.messages || []).map((x: any) => x.id);
    return await Promise.all(ids.map(async (id) => {
      const m = await fetch(`${GMAIL}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, { headers }).then(r => r.json());
      const h: any[] = m?.payload?.headers || [];
      const get = (n: string) => h.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value || "";
      return { from: get("From"), subject: get("Subject"), snippet: m?.snippet || "" };
    }));
  } catch { return null; }
}

async function getEvents(headers: { Authorization: string } | null) {
  if (!headers) return null;
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const r = await fetch(`${CALENDAR}/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`, { headers }).then(r => r.json());
    return (r?.items || []).map((e: any) => ({
      summary: e.summary || "(no title)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || "",
    }));
  } catch { return null; }
}

export const generateBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { location?: string; newsTopic?: string })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name,personality,response_length,location")
      .eq("id", userId)
      .single();

    const loc = data.location || profile?.location || "";
    const googleHeaders = await getGoogleHeaders(userId);

    const [todosRes, remindersRes, memRes, weather, news, emails, events, doneTodayRes] = await Promise.all([
      supabase.from("todos").select("title,priority,completed").eq("user_id", userId).eq("completed", false).limit(10),
      supabase.from("reminders").select("title,due_at,completed").eq("user_id", userId).eq("completed", false).limit(10),
      supabase.from("memories").select("fact").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      getWeather(loc),
      getNews(data.newsTopic || "today's top stories"),
      getEmails(googleHeaders),
      getEvents(googleHeaders),
      supabase.from("todos").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("completed", true)
        .gte("updated_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    ]);

    // Productivity score: 0-100 mix of completed-today, open-load penalty, calendar density, unread email penalty.
    const doneToday = (doneTodayRes as any)?.count ?? 0;
    const openTodos = (todosRes.data || []).length;
    const eventsCount = (events || []).length;
    const emailsCount = (emails || []).length;
    let score = 50 + doneToday * 8 - Math.max(0, openTodos - 3) * 3 - Math.max(0, emailsCount - 3) * 2 + Math.min(eventsCount, 4) * 2;
    score = Math.max(5, Math.min(100, Math.round(score)));

    const context_block = {
      user: { name: profile?.display_name || null, personality: profile?.personality || "friendly", response_length: profile?.response_length || "balanced" },
      todos: todosRes.data || [],
      reminders: remindersRes.data || [],
      memories: (memRes.data || []).map((m: any) => m.fact),
      weather,
      news,
      emails,
      events,
      done_today: doneToday,
      productivity_score: score,
      now: new Date().toISOString(),
    };

    const sys = `You are Nova generating a personalized daily briefing. Adopt the user's chosen personality tone: ${context_block.user.personality}. Keep language ${context_block.user.response_length}. Output strict JSON ONLY:
{
  "greeting": "<time-of-day greeting; use the user's name if provided>",
  "summary": "<2-3 sentence overview of the day tailored to their memories/tasks>",
  "highlights": ["<3-5 short bullets: schedule, urgent emails, top tasks>"],
  "recommendations": ["<2-3 actionable, specific suggestions>"],
  "weather_line": "<one-sentence weather summary or empty string>",
  "news_line": "<one-sentence top headline summary or empty string>",
  "quote": "<a short original motivational quote (max 18 words) matching their personality>",
  "focus": "<one sentence naming the single most important thing to focus on today>"
}`;

    const parsed = await chatJSON(sys, [
      { role: "user", content: "Generate today's briefing from this data:\n" + JSON.stringify(context_block, null, 2) },
    ]);

    return {
      ...parsed,
      productivity_score: score,
      done_today: doneToday,
      user_name: profile?.display_name || null,
      raw: {
        events: events ?? [],
        emails: emails ?? [],
        todos: todosRes.data || [],
        reminders: remindersRes.data || [],
        weather,
        news,
      },
      connectors: {
        gmail: !!googleHeaders,
        calendar: !!googleHeaders,
      },
    };
  });


export const summarizeMemories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("memories").select("id,fact").eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (!rows || rows.length < 4) return { summary: "Not enough memories to summarize yet.", merged: 0 };

    const sys = `Consolidate these user memories into a smaller set of clearer, deduplicated facts. Drop near-duplicates and contradictions; keep the most recent when conflicting. Return strict JSON: {"facts":["fact1","fact2",...]}`;
    const parsed = await chatJSON(sys, [{ role: "user", content: rows.map((r: any) => "- " + r.fact).join("\n") }]);
    const newFacts: string[] = Array.isArray(parsed.facts) ? parsed.facts.filter((f: any) => typeof f === "string" && f.trim()) : [];
    if (!newFacts.length) return { summary: "Could not summarize.", merged: 0 };

    const ids = rows.map((r: any) => r.id);
    await supabase.from("memories").delete().in("id", ids);
    await supabase.from("memories").insert(newFacts.map((fact) => ({ user_id: userId, fact })));
    return { summary: `Consolidated ${rows.length} → ${newFacts.length} memories.`, merged: rows.length, kept: newFacts.length };
  });
