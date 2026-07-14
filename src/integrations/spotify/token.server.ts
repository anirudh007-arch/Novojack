// Server-only. Reads/refreshes the Spotify OAuth token stored for a user, so
// playback calls can go straight to Spotify's Web API. Mirrors
// integrations/google/token.server.ts — never import from client-facing
// code, await import() it inside a handler body instead.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REFRESH_SKEW_MS = 60_000;

export async function getFreshSpotifyAccessToken(userId: string): Promise<string> {
  const { data: row } = await supabaseAdmin
    .from("spotify_connections")
    .select("access_token,refresh_token,expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) throw new Error("Spotify account not connected. Connect Spotify in Settings.");

  if (new Date(row.expires_at).getTime() - Date.now() > REFRESH_SKEW_MS) {
    return row.access_token;
  }

  const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing VITE_SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET");
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Spotify token refresh failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  const accessToken: string = json.access_token;
  const expiresIn: number = json.expires_in ?? 3600;
  // Spotify only returns a new refresh_token occasionally — keep the old one otherwise.
  const refreshToken: string = json.refresh_token ?? row.refresh_token;

  await supabaseAdmin
    .from("spotify_connections")
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return accessToken;
}
