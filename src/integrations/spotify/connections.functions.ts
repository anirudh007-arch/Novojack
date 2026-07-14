import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Completes the Spotify OAuth code exchange started by connectSpotify() in
// src/lib/spotify-oauth.ts. redirectUri must exactly match the one used to
// build the authorize URL (Spotify requires this).
export const exchangeSpotifyCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { code: string; redirectUri: string })
  .handler(async ({ data, context }) => {
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
        grant_type: "authorization_code",
        code: data.code,
        redirect_uri: data.redirectUri,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error || !json.access_token || !json.refresh_token) {
      throw new Error(`Spotify token exchange failed: ${json.error_description || json.error || res.status}`);
    }
    const accessToken: string = json.access_token;
    const refreshToken: string = json.refresh_token;
    const expiresIn: number = json.expires_in ?? 3600;
    const scope: string = json.scope || "";

    const meJson = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json()).catch(() => ({}));
    const displayName: string | null = meJson?.display_name ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: dbError } = await supabaseAdmin.from("spotify_connections").upsert(
      {
        user_id: context.userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        scope,
        spotify_display_name: displayName,
      } as any,
      { onConflict: "user_id" },
    );
    if (dbError) throw new Error(`Failed to save Spotify connection: ${dbError.message}`);
    return { ok: true, displayName };
  });

export const getSpotifyConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("spotify_connections")
      .select("spotify_display_name,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, displayName: data?.spotify_display_name ?? null, updatedAt: data?.updated_at ?? null };
  });
