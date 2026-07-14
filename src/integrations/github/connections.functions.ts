import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Completes the GitHub OAuth code exchange started by connectGithub() in
// src/lib/github-oauth.ts. redirectUri must exactly match the one used to
// build the authorize URL (GitHub requires this).
export const exchangeGithubCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { code: string; redirectUri: string })
  .handler(async ({ data, context }) => {
    const clientId = process.env.VITE_GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing VITE_GITHUB_OAUTH_CLIENT_ID/GITHUB_OAUTH_CLIENT_SECRET");
    }

    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
        redirect_uri: data.redirectUri,
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error || !json.access_token) {
      throw new Error(`GitHub token exchange failed: ${json.error_description || json.error || res.status}`);
    }
    const accessToken: string = json.access_token;
    const scope: string = json.scope || "";

    const userJson = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    }).then((r) => r.json()).catch(() => ({}));
    const login: string | null = userJson?.login ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: dbError } = await supabaseAdmin.from("github_connections").upsert(
      { user_id: context.userId, access_token: accessToken, scope, github_login: login } as any,
      { onConflict: "user_id" },
    );
    if (dbError) throw new Error(`Failed to save GitHub connection: ${dbError.message}`);
    return { ok: true, login };
  });

export const getGithubConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("github_connections")
      .select("github_login,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, login: data?.github_login ?? null, updatedAt: data?.updated_at ?? null };
  });
