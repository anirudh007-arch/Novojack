-- github_connections: stores a GitHub OAuth App access token obtained via a
-- standalone (non-Supabase) OAuth flow, so server functions can call the
-- GitHub API (notifications, etc.) directly. Classic GitHub OAuth App tokens
-- do not expire, so unlike google_connections there is no refresh_token or
-- expires_at column. These are live credentials — only service_role (via
-- supabaseAdmin) may read or write this table; RLS is enabled with no
-- policies at all, so anon/authenticated are fully blocked.
CREATE TABLE public.github_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  scope TEXT,
  github_login TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER github_connections_updated_at BEFORE UPDATE ON public.github_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
