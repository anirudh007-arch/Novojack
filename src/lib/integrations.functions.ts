import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev";

function gwHeaders(connectorKey: string) {
  const lov = process.env.LOVABLE_API_KEY;
  if (!lov) throw new Error("Missing LOVABLE_API_KEY");
  if (!connectorKey) throw new Error("Connector not configured");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": connectorKey,
    "Content-Type": "application/json",
  };
}

// ---------- Weather (Open-Meteo, no key) ----------
export const getWeather = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { location?: string })
  .handler(async ({ data }) => {
    const loc = (data.location || "").trim();
    let lat: number | null = null;
    let lon: number | null = null;
    let label = loc;
    if (loc) {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`,
      ).then((r) => r.json());
      const hit = geo?.results?.[0];
      if (!hit) throw new Error(`Couldn't find location: ${loc}`);
      lat = hit.latitude; lon = hit.longitude;
      label = `${hit.name}${hit.country ? ", " + hit.country : ""}`;
    } else {
      // default fallback
      lat = 40.7128; lon = -74.0060; label = "New York, US";
    }
    const w = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`,
    ).then((r) => r.json());
    return { location: label, current: w.current, daily: w.daily };
  });

// ---------- News (Google News RSS, no key) ----------
export const getNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { topic?: string })
  .handler(async ({ data }) => {
    const topic = (data.topic || "top stories").trim();
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetch(url).then((r) => r.text());
    const items: { title: string; source: string; link: string; pubDate: string }[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml)) && items.length < 6) {
      const block = m[1];
      const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(block)?.[1] ?? "";
      const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1] ?? "";
      const pub = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] ?? "";
      const source = /<source[^>]*>([\s\S]*?)<\/source>/.exec(block)?.[1] ?? "";
      items.push({ title: title.trim(), link: link.trim(), pubDate: pub.trim(), source: source.trim() });
    }
    return { topic, items };
  });

// ---------- Gmail: list unread ----------
export const listUnreadEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { max?: number })
  .handler(async ({ data }) => {
    const headers = gwHeaders(process.env.GOOGLE_MAIL_API_KEY!);
    const max = Math.min(Math.max(data.max || 5, 1), 15);
    const list = await fetch(
      `${GW}/google_mail/gmail/v1/users/me/messages?q=is:unread&maxResults=${max}`,
      { headers },
    ).then((r) => r.json());
    const ids: string[] = (list?.messages || []).map((m: any) => m.id);
    const items = await Promise.all(
      ids.map(async (id) => {
        const m = await fetch(
          `${GW}/google_mail/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers },
        ).then((r) => r.json());
        const h: any[] = m?.payload?.headers || [];
        const get = (n: string) => h.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value || "";
        return { id, from: get("From"), subject: get("Subject"), date: get("Date"), snippet: m?.snippet || "" };
      }),
    );
    return { emails: items };
  });

// ---------- Calendar: list upcoming + create event ----------
export const listUpcomingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { max?: number })
  .handler(async ({ data }) => {
    const headers = gwHeaders(process.env.GOOGLE_CALENDAR_API_KEY!);
    const max = Math.min(Math.max(data.max || 5, 1), 20);
    const now = new Date().toISOString();
    const url = `${GW}/google_calendar/calendar/v3/calendars/primary/events?maxResults=${max}&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`;
    const r = await fetch(url, { headers }).then((r) => r.json());
    const items = (r?.items || []).map((e: any) => ({
      id: e.id,
      summary: e.summary || "(no title)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || "",
      htmlLink: e.htmlLink,
    }));
    return { events: items };
  });

export const createCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as {
        summary: string;
        start: string; // ISO
        end?: string;
        description?: string;
        location?: string;
      },
  )
  .handler(async ({ data }) => {
    const headers = gwHeaders(process.env.GOOGLE_CALENDAR_API_KEY!);
    const start = new Date(data.start);
    const end = data.end ? new Date(data.end) : new Date(start.getTime() + 60 * 60 * 1000);
    const body = {
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    };
    const r = await fetch(`${GW}/google_calendar/calendar/v3/calendars/primary/events`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Calendar error: ${r.status} ${t}`);
    }
    const e = await r.json();
    return { id: e.id, htmlLink: e.htmlLink, summary: e.summary };
  });
