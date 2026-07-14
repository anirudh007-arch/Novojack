import { GITHUB_CONNECTOR_SCOPES } from "@/lib/github-scopes";

export { GITHUB_CONNECTOR_SCOPES };

// GitHub OAuth Apps have no server-side session to carry state through (unlike
// Supabase's Google flow), so we round-trip a CSRF token through
// sessionStorage across the redirect to github.com and back.
const STATE_KEY = "nova_github_oauth_state";

export function connectGithub(redirectTo: string) {
  const clientId = import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error("GitHub connection isn't configured (missing VITE_GITHUB_OAUTH_CLIENT_ID).");
  }
  // Prefixed so the shared /settings callback can tell GitHub's and
  // Spotify's redirects apart — both land on the same route with the same
  // ?code=&state= shape.
  const state = `github:${crypto.randomUUID()}`;
  sessionStorage.setItem(STATE_KEY, state);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectTo);
  url.searchParams.set("scope", GITHUB_CONNECTOR_SCOPES);
  url.searchParams.set("state", state);
  window.location.href = url.toString();
}

// Verifies the `state` query param GitHub echoed back matches what we sent,
// then clears it so it can't be replayed.
export function consumeGithubOAuthState(receivedState: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!expected && !!receivedState && expected === receivedState;
}
