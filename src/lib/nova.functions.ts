import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chatJSON, synthesizeSpeech, type ChatMessage } from "@/lib/ai/gemini.server";

const GMAIL = "https://gmail.googleapis.com/gmail/v1";
const CALENDAR = "https://www.googleapis.com/calendar/v3";
const TASKS = "https://tasks.googleapis.com/tasks/v1";

const SYSTEM_PROMPT = `You are Nova, a warm, witty, helpful voice-first personal AI operating system.
Be concise (1-3 sentences for voice). Be proactive. Speak naturally like a friend.

You silently route requests to specialized agents and pick the right one yourself:
- research: web search, fact-checking, news, weather, info gathering
- productivity: tasks, reminders, notes, planning, scheduling
- communication: email reading, drafting, summarizing, message generation
- browser: opening websites, navigating, form filling, automation workflows
- file: PDF/document understanding, file operations, report generation
- computer: opening/closing apps, organizing files, OS-level control
- general: anything else / casual chat

ALWAYS respond ONLY with strict JSON (no markdown):
{
  "agent": "<one of: research|productivity|communication|browser|file|computer|general>",
  "reply": "<what you say back to the user>",
  "actions": [ ... optional list of actions ... ]
}

Productivity actions (executed silently):
- {"type":"create_reminder","title":"Call mom","due_at":"2026-06-20T19:00:00Z"}
- {"type":"create_note","title":"Meeting notes","content":"..."}
- {"type":"create_todo","title":"Buy milk","priority":"medium"}
- {"type":"save_memory","fact":"User's dog is named Pixel"}

Information actions — when the user asks for live info, INCLUDE one of these and leave the reply short ("Checking..."); the system will fetch data and you'll get a follow-up turn to deliver the real answer:
- {"type":"fetch_weather","location":"London"}
- {"type":"fetch_news","topic":"AI"}
- {"type":"fetch_unread_emails","max":5}
- {"type":"fetch_upcoming_events","max":5}
- {"type":"fetch_google_tasks","max":10}
- {"type":"fetch_github_notifications","max":10}

Calendar action (executed):
- {"type":"create_calendar_event","summary":"Dentist","start":"2026-06-22T14:00:00Z","end":"2026-06-22T15:00:00Z","location":"...","description":"..."}

Communication action (drafts a Gmail draft for user review — never sends):
- {"type":"draft_email","to":"alice@example.com","subject":"Re: project","body":"..."}

Music action (executed — plays on the user's active Spotify device, e.g. "play Blinding Lights by The Weeknd"):
- {"type":"play_music","song":"Blinding Lights","artist":"The Weeknd"}

Desktop-only actions (these need the Nova desktop companion app, which is coming soon. Still emit them when the user asks — the UI will show a clear "requires desktop app" notice. Always require user approval, never claim they ran):
- {"type":"open_app","name":"Slack"}
- {"type":"close_app","name":"Slack"}
- {"type":"open_website","url":"https://github.com"}
- {"type":"automate_browser","goal":"Log into example.com and download invoice"}
- {"type":"file_op","op":"create_folder|rename|organize|search","path":"~/Documents","details":"..."}

If no action is needed, return "actions": [].`;

async function fetchTool(action: any, userId: string): Promise<{ label: string; data: any } | null> {
  if (action.type === "fetch_weather") {
    const loc = action.location || "";
    const lat0 = 40.7128, lon0 = -74.006;
    let lat = lat0, lon = lon0, label = "New York, US";
    if (loc) {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(loc)}&count=1&language=en&format=json`).then((r) => r.json()).catch(() => null);
      const hit = geo?.results?.[0];
      if (hit) { lat = hit.latitude; lon = hit.longitude; label = `${hit.name}${hit.country ? ", " + hit.country : ""}`; }
      else label = loc;
    }
    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`).then((r) => r.json());
    return { label: `Weather: ${label}`, data: { location: label, current: w.current, daily: w.daily } };
  }
  if (action.type === "fetch_news") {
    const topic = action.topic || "top stories";
    const xml = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`).then((r) => r.text());
    const items: any[] = [];
    const re = /<item>([\s\S]*?)<\/item>/g; let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) && items.length < 6) {
      const b = m[1];
      const title = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(b)?.[1] || "";
      const link = /<link>([\s\S]*?)<\/link>/.exec(b)?.[1] || "";
      const source = /<source[^>]*>([\s\S]*?)<\/source>/.exec(b)?.[1] || "";
      items.push({ title: title.trim(), source: source.trim(), link: link.trim() });
    }
    return { label: `News: ${topic}`, data: { topic, items } };
  }
  if (action.type === "fetch_unread_emails") {
    const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
    let token: string;
    try { token = await getFreshGoogleAccessToken(userId); }
    catch { return { label: "Gmail not connected", data: { error: "Connect Google in Settings" } }; }
    const headers = { Authorization: `Bearer ${token}` };
    const max = Math.min(action.max || 5, 10);
    const list = await fetch(`${GMAIL}/users/me/messages?q=is:unread&maxResults=${max}`, { headers }).then((r) => r.json());
    const ids: string[] = (list?.messages || []).map((x: any) => x.id);
    const emails = await Promise.all(ids.map(async (id) => {
      const m = await fetch(`${GMAIL}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, { headers }).then((r) => r.json());
      const h: any[] = m?.payload?.headers || [];
      const get = (n: string) => h.find((x) => x.name?.toLowerCase() === n.toLowerCase())?.value || "";
      return { from: get("From"), subject: get("Subject"), date: get("Date"), snippet: m?.snippet || "" };
    }));
    return { label: `Unread emails (${emails.length})`, data: { emails } };
  }
  if (action.type === "fetch_upcoming_events") {
    const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
    let token: string;
    try { token = await getFreshGoogleAccessToken(userId); }
    catch { return { label: "Calendar not connected", data: { error: "Connect Google in Settings" } }; }
    const headers = { Authorization: `Bearer ${token}` };
    const max = Math.min(action.max || 5, 15);
    const now = new Date().toISOString();
    const r = await fetch(`${CALENDAR}/calendars/primary/events?maxResults=${max}&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`, { headers }).then((r) => r.json());
    const events = (r?.items || []).map((e: any) => ({
      summary: e.summary || "(no title)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || "",
    }));
    return { label: `Upcoming events (${events.length})`, data: { events } };
  }
  if (action.type === "fetch_google_tasks") {
    const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
    let token: string;
    try { token = await getFreshGoogleAccessToken(userId); }
    catch { return { label: "Google Tasks not connected", data: { error: "Connect Google in Settings" } }; }
    const headers = { Authorization: `Bearer ${token}` };
    const max = Math.min(action.max || 10, 20);
    const r = await fetch(`${TASKS}/lists/@default/tasks?showCompleted=false&maxResults=${max}`, { headers }).then((r) => r.json());
    const tasks = (r?.items || []).map((t: any) => ({ title: t.title || "(untitled)", notes: t.notes || "", due: t.due || null }));
    return { label: `Google Tasks (${tasks.length})`, data: { tasks } };
  }
  if (action.type === "fetch_github_notifications") {
    const { getGithubAccessToken } = await import("@/integrations/github/token.server");
    let token: string;
    try { token = await getGithubAccessToken(userId); }
    catch { return { label: "GitHub not connected", data: { error: "Connect GitHub in Settings" } }; }
    const max = Math.min(action.max || 10, 20);
    const list = await fetch(`https://api.github.com/notifications?per_page=${max}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    }).then((r) => r.json());
    const notifications = (Array.isArray(list) ? list : []).map((n: any) => ({
      title: n.subject?.title || "(untitled)",
      type: n.subject?.type || "",
      reason: n.reason,
      repo: n.repository?.full_name || "",
    }));
    return { label: `GitHub notifications (${notifications.length})`, data: { notifications } };
  }
  return null;
}

export const chatWithNova = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) => input as { conversationId?: string | null; messages: ChatMessage[] },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles").select("display_name,personality,response_length")
      .eq("id", userId).maybeSingle();

    const { data: memRows } = await supabase
      .from("memories").select("fact").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(40);
    const memoryBlock = memRows?.length
      ? `\n\nKnown facts about the user:\n- ${memRows.map((m: any) => m.fact).join("\n- ")}` : "";
    const p: any = profile || {};
    const persona = `\n\nUser preferences — adopt these:\n- Name: ${p.display_name || "unknown"}\n- Personality tone: ${p.personality || "friendly"}\n- Response length: ${p.response_length || "balanced"} (brief=1-2 sentences, balanced=short paragraph, detailed=full explanation)`;
    const systemFull = `${SYSTEM_PROMPT}\n\nCurrent time: ${new Date().toISOString()}.${persona}${memoryBlock}`;

    let parsed = await chatJSON(systemFull, data.messages);
    let actions = Array.isArray(parsed.actions) ? parsed.actions : [];

    // Run fetch tools and do a second AI pass to compose the real reply
    const fetchResults: { label: string; data: any }[] = [];
    const fetchTypes = new Set([
      "fetch_weather", "fetch_news", "fetch_unread_emails", "fetch_upcoming_events",
      "fetch_google_tasks", "fetch_github_notifications",
    ]);
    const fetches = actions.filter((a: any) => fetchTypes.has(a?.type));
    if (fetches.length) {
      for (const a of fetches) {
        try {
          const r = await fetchTool(a, userId);
          if (r) fetchResults.push(r);
        } catch (e) {
          fetchResults.push({ label: `Tool error (${a.type})`, data: { error: (e as Error).message } });
        }
      }
      const followup: ChatMessage[] = [
        ...data.messages,
        { role: "assistant", content: JSON.stringify({ reply: parsed.reply, actions: fetches }) },
        {
          role: "user",
          content:
            "TOOL RESULTS (use these to give the final natural-language answer; do NOT include fetch_* actions again):\n\n" +
            JSON.stringify(fetchResults, null, 2),
        },
      ];
      parsed = await chatJSON(systemFull, followup);
      actions = Array.isArray(parsed.actions) ? parsed.actions.filter((a: any) => !fetchTypes.has(a?.type)) : [];
    }

    const reply = (parsed.reply ?? "").trim() || "Okay.";

    // Execute non-fetch actions
    const executed: { type: string; ok: boolean; label: string }[] = [];
    for (const a of actions) {
      try {
        if (a.type === "create_reminder") {
          await supabase.from("reminders").insert({ user_id: userId, title: a.title, due_at: a.due_at ?? null });
          executed.push({ type: a.type, ok: true, label: `Reminder: ${a.title}` });
        } else if (a.type === "create_note") {
          await supabase.from("notes").insert({ user_id: userId, title: a.title || "Untitled", content: a.content || "" });
          executed.push({ type: a.type, ok: true, label: `Note: ${a.title}` });
        } else if (a.type === "create_todo") {
          await supabase.from("todos").insert({ user_id: userId, title: a.title, priority: a.priority ?? "medium" });
          executed.push({ type: a.type, ok: true, label: `Todo: ${a.title}` });
        } else if (a.type === "save_memory") {
          await supabase.from("memories").insert({ user_id: userId, fact: a.fact });
          executed.push({ type: a.type, ok: true, label: `Remembered: ${a.fact}` });
        } else if (a.type === "create_calendar_event") {
          const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
          try {
            const token = await getFreshGoogleAccessToken(userId);
            const start = new Date(a.start);
            const end = a.end ? new Date(a.end) : new Date(start.getTime() + 60 * 60 * 1000);
            const r = await fetch(`${CALENDAR}/calendars/primary/events`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                summary: a.summary,
                description: a.description,
                location: a.location,
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
              }),
            });
            if (r.ok) executed.push({ type: a.type, ok: true, label: `📅 ${a.summary}` });
            else executed.push({ type: a.type, ok: false, label: `Calendar error: ${r.status}` });
          } catch {
            executed.push({ type: a.type, ok: false, label: "Calendar not connected" });
          }
        } else if (a.type === "play_music") {
          const { getFreshSpotifyAccessToken } = await import("@/integrations/spotify/token.server");
          try {
            const token = await getFreshSpotifyAccessToken(userId);
            const headers = { Authorization: `Bearer ${token}` };
            // Read the body as text first so a non-JSON error page (e.g. a 401
            // "Check settings" from an expired/invalid token) surfaces cleanly
            // instead of blowing up JSON.parse.
            const spotifyGet = async (url: string) => {
              const res = await fetch(url, { headers });
              const body = await res.text();
              if (!res.ok) throw new Error(`Spotify ${res.status}: ${body.slice(0, 200)}`);
              return body ? JSON.parse(body) : {};
            };

            const q = `track:${a.song} artist:${a.artist}`;
            const search = await spotifyGet(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`);
            const track = search?.tracks?.items?.[0];
            if (!track) {
              executed.push({ type: a.type, ok: false, label: `Couldn't find "${a.song}" by ${a.artist} on Spotify` });
            } else {
              const devicesJson = await spotifyGet("https://api.spotify.com/v1/me/player/devices");
              const devices: any[] = devicesJson?.devices || [];
              const device = devices.find((d) => d.is_active) || devices[0];
              if (!device) {
                executed.push({ type: a.type, ok: false, label: "No active Spotify device — open Spotify on your phone or computer first" });
              } else {
                const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device.id}`, {
                  method: "PUT",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({ uris: [track.uri] }),
                });
                if (playRes.ok) executed.push({ type: a.type, ok: true, label: `🎵 Playing "${track.name}" by ${track.artists?.[0]?.name} on ${device.name}` });
                else executed.push({ type: a.type, ok: false, label: `Spotify playback error: ${playRes.status}${playRes.status === 403 ? " (Premium required)" : ""}` });
              }
            }
          } catch (e) {
            executed.push({ type: a.type, ok: false, label: `Spotify error: ${(e as Error).message}` });
          }
        } else if (a.type === "draft_email") {
          const { getFreshGoogleAccessToken } = await import("@/integrations/google/token.server");
          try {
            const token = await getFreshGoogleAccessToken(userId);
            const raw = btoa(
              [`To: ${a.to || ""}`, `Subject: ${a.subject || ""}`, 'Content-Type: text/plain; charset="UTF-8"', "", a.body || ""].join("\r\n"),
            ).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
            const r = await fetch(`${GMAIL}/users/me/drafts`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ message: { raw } }),
            });
            if (r.ok) executed.push({ type: a.type, ok: true, label: `✉️ Draft saved: ${a.subject || "(no subject)"}` });
            else executed.push({ type: a.type, ok: false, label: `Draft error: ${r.status}` });
          } catch {
            executed.push({ type: a.type, ok: false, label: "Gmail not connected" });
          }
        } else if (
          a.type === "open_app" || a.type === "close_app" || a.type === "open_website" ||
          a.type === "automate_browser" || a.type === "file_op"
        ) {
          // Desktop-only: stubbed. Surface as a pending action requiring the desktop companion.
          const human =
            a.type === "open_app" ? `Open app: ${a.name}` :
            a.type === "close_app" ? `Close app: ${a.name}` :
            a.type === "open_website" ? `Open website: ${a.url}` :
            a.type === "automate_browser" ? `Browser automation: ${a.goal}` :
            `File: ${a.op} — ${a.path || ""} ${a.details || ""}`;
          executed.push({ type: a.type, ok: false, label: `🖥️ ${human} (requires Nova desktop app)` });
        }
      } catch (e) {
        executed.push({ type: (a as any).type, ok: false, label: (e as Error).message });
      }
    }

    // Persist conversation
    let convId = data.conversationId ?? null;
    if (!convId) {
      const firstUser = data.messages.find((m) => m.role === "user")?.content ?? "New conversation";
      const { data: conv } = await supabase
        .from("conversations").insert({ user_id: userId, title: firstUser.slice(0, 60) })
        .select("id").single();
      convId = conv?.id ?? null;
    }
    if (convId) {
      const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
      if (lastUser) {
        await supabase.from("messages").insert({ conversation_id: convId, user_id: userId, role: "user", content: lastUser.content });
      }
      await supabase.from("messages").insert({ conversation_id: convId, user_id: userId, role: "assistant", content: reply });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    }

    return { reply, agent: parsed.agent || "general", actions: executed, conversationId: convId, info: fetchResults.map((r) => r.label) };
  });

export const speakText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { text: string; voice?: string })
  .handler(async ({ data }) => {
    const audio = await synthesizeSpeech(data.text, data.voice || "Kore");
    return { audio };
  });
