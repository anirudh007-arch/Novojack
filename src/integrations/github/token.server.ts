// Server-only. Classic GitHub OAuth App tokens don't expire, so unlike
// integrations/google/token.server.ts there's no refresh dance here — just a
// lookup. Never import from client-facing code — await import() it inside a
// handler body from *.functions.ts / route files.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getGithubAccessToken(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("github_connections")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new Error("GitHub account not connected. Connect GitHub in Settings.");
  return data.access_token;
}
