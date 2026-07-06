import { supabase } from "@/integrations/supabase/client";
import { GOOGLE_CONNECTOR_SCOPES } from "@/lib/google-scopes";

export { GOOGLE_CONNECTOR_SCOPES };

export async function signInWithGoogle(redirectTo: string) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: GOOGLE_CONNECTOR_SCOPES,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
}
