import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GMAIL = "https://gmail.googleapis.com/gmail/v1";
const CALENDAR = "https://www.googleapis.com/calendar/v3";
const TASKS = "https://tasks.googleapis.com/tasks/v1";

async function googleHeaders(userId: string) {
  const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
  const token = await getFreshGoogleAccessToken(userId);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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
  .handler(async ({ data, context }) => {
    const headers = await googleHeaders(context.userId);
    const max = Math.min(Math.max(data.max || 5, 1), 15);
    const list = await fetch(
      `${GMAIL}/users/me/messages?q=is:unread&maxResults=${max}`,
      { headers },
    ).then((r) => r.json());
    const ids: string[] = (list?.messages || []).map((m: any) => m.id);
    const items = await Promise.all(
      ids.map(async (id) => {
        const m = await fetch(
          `${GMAIL}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
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
  .handler(async ({ data, context }) => {
    const headers = await googleHeaders(context.userId);
    const max = Math.min(Math.max(data.max || 5, 1), 20);
    const now = new Date().toISOString();
    const url = `${CALENDAR}/calendars/primary/events?maxResults=${max}&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`;
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

// ---------- Google Tasks: list + create ----------
export const listGoogleTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { max?: number })
  .handler(async ({ data, context }) => {
    const headers = await googleHeaders(context.userId);
    const max = Math.min(Math.max(data.max || 10, 1), 30);
    const r = await fetch(
      `${TASKS}/lists/@default/tasks?showCompleted=false&maxResults=${max}`,
      { headers },
    ).then((r) => r.json());
    const items = (r?.items || []).map((t: any) => ({
      id: t.id,
      title: t.title || "(untitled)",
      notes: t.notes || "",
      due: t.due || null,
      status: t.status,
    }));
    return { tasks: items };
  });

export const createGoogleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { title: string; notes?: string; due?: string })
  .handler(async ({ data, context }) => {
    const headers = await googleHeaders(context.userId);
    const body = { title: data.title, notes: data.notes, due: data.due };
    const r = await fetch(`${TASKS}/lists/@default/tasks`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Google Tasks error: ${r.status} ${t}`);
    }
    const t = await r.json();
    return { id: t.id, title: t.title };
  });

// ---------- Spotify: search + playback control ----------
export const playSpotifyTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { song: string; artist: string })
  .handler(async ({ data, context }) => {
    const { getFreshSpotifyAccessToken } = await import("@/integrations/spotify/token.server");
    const token = await getFreshSpotifyAccessToken(context.userId);
    const headers = { Authorization: `Bearer ${token}` };

    const q = `track:${data.song} artist:${data.artist}`;
    const search = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`,
      { headers },
    ).then((r) => r.json());
    const track = search?.tracks?.items?.[0];
    if (!track) throw new Error(`Couldn't find "${data.song}" by ${data.artist} on Spotify`);

    const devicesJson = await fetch("https://api.spotify.com/v1/me/player/devices", { headers }).then((r) => r.json());
    const devices: any[] = devicesJson?.devices || [];
    const device = devices.find((d) => d.is_active) || devices[0];
    if (!device) throw new Error("No active Spotify device — open Spotify on your phone or computer first");

    const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device.id}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [track.uri] }),
    });
    if (!playRes.ok) {
      const t = await playRes.text().catch(() => "");
      const hint = playRes.status === 403 ? " (Spotify Premium is required for playback control)" : "";
      throw new Error(`Spotify playback error: ${playRes.status}${hint} ${t}`);
    }
    return { track: track.name, artist: track.artists?.[0]?.name, device: device.name };
  });

// ---------- GitHub: list notifications ----------
export const listGithubNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { max?: number })
  .handler(async ({ data, context }) => {
    const { getGithubAccessToken } = await import("@/integrations/github/token.server");
    const token = await getGithubAccessToken(context.userId);
    const max = Math.min(Math.max(data.max || 10, 1), 30);
    const list = await fetch(`https://api.github.com/notifications?per_page=${max}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    }).then((r) => r.json());
    const items = (Array.isArray(list) ? list : []).map((n: any) => ({
      id: n.id,
      title: n.subject?.title || "(untitled)",
      type: n.subject?.type || "",
      reason: n.reason,
      repo: n.repository?.full_name || "",
      updatedAt: n.updated_at,
    }));
    return { notifications: items };
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
  .handler(async ({ data, context }) => {
    const headers = await googleHeaders(context.userId);
    const start = new Date(data.start);
    const end = data.end ? new Date(data.end) : new Date(start.getTime() + 60 * 60 * 1000);
    const body = {
      summary: data.summary,
      description: data.description,
      location: data.location,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    };
    const r = await fetch(`${CALENDAR}/calendars/primary/events`, {
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
