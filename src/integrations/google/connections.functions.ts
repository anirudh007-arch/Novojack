import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Persists the Google OAuth tokens captured right after sign-in (Supabase only
// exposes provider_token/provider_refresh_token on the initial SIGNED_IN event —
// it does not store or refresh them for you), so server functions can call
// Gmail/Calendar directly later.
export const saveGoogleConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as {
        accessToken: string;
        refreshToken?: string | null;
        expiresIn?: number;
        scope?: string;
      },
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      user_id: context.userId,
      access_token: data.accessToken,
      expires_at: new Date(Date.now() + (data.expiresIn ?? 3600) * 1000).toISOString(),
      scope: data.scope ?? null,
    };
    if (data.refreshToken) patch.refresh_token = data.refreshToken;
    await supabaseAdmin.from("google_connections").upsert(patch as any, { onConflict: "user_id" });
    return { ok: true };
  });

export const getGoogleConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_connections")
      .select("scope,updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, scope: data?.scope ?? null, updatedAt: data?.updated_at ?? null };
  });
