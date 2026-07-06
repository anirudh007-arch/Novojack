-- google_connections: stores Google OAuth access/refresh tokens obtained via
-- Supabase's Google sign-in (with extra Gmail/Calendar scopes + offline access)
-- so server functions can call Gmail/Calendar APIs directly, without a
-- third-party connector proxy. These are live credentials — only service_role
-- (via supabaseAdmin) may read or write this table; RLS is enabled with no
-- policies at all, so anon/authenticated are fully blocked.
CREATE TABLE public.google_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_connections TO service_role;
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER google_connections_updated_at BEFORE UPDATE ON public.google_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
