-- spotify_connections: stores Spotify OAuth access/refresh tokens obtained via
-- a standalone (non-Supabase) OAuth flow, so server functions can search
-- tracks and control playback directly. Spotify access tokens expire after
-- ~1hr (unlike GitHub's), so this mirrors google_connections' refresh_token +
-- expires_at shape rather than github_connections'. These are live
-- credentials — only service_role (via supabaseAdmin) may read or write this
-- table; RLS is enabled with no policies at all, so anon/authenticated are
-- fully blocked.
CREATE TABLE public.spotify_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  spotify_display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.spotify_connections TO service_role;
ALTER TABLE public.spotify_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER spotify_connections_updated_at BEFORE UPDATE ON public.spotify_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
