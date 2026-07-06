// Server-only. Reads/refreshes the Google OAuth token stored for a user so
// Gmail/Calendar calls can go straight to Google's APIs instead of through a
// third-party connector proxy. Never import this from client-facing code —
// mirrors the client.server.ts convention: safe to import at the top of other
// .server.ts modules, but *.functions.ts / route files must `await import()`
// it inside a handler body.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REFRESH_SKEW_MS = 60_000;

export async function getFreshGoogleAccessToken(userId: string): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from("google_connections")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) throw new Error("Google account not connected. Connect Google in Settings.");

  if (new Date(row.expires_at).getTime() - Date.now() > REFRESH_SKEW_MS) {
    return row.access_token;
  }

  if (!row.refresh_token) {
    throw new Error("Google connection expired. Reconnect Google in Settings.");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  const accessToken: string = json.access_token;
  const expiresIn: number = json.expires_in ?? 3600;

  await supabaseAdmin
    .from("google_connections")
    .update({ access_token: accessToken, expires_at: new Date(Date.now() + expiresIn * 1000).toISOString() })
    .eq("user_id", userId);

  return accessToken;
}
