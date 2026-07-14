import { SPOTIFY_CONNECTOR_SCOPES } from "@/lib/spotify-scopes";

export { SPOTIFY_CONNECTOR_SCOPES };

// Spotify's OAuth App has no server-side session to carry state through
// (same situation as GitHub), so we round-trip a CSRF token through
// sessionStorage across the redirect to accounts.spotify.com and back.
const STATE_KEY = "nova_spotify_oauth_state";

export function connectSpotify(redirectTo: string) {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error("Spotify connection isn't configured (missing VITE_SPOTIFY_CLIENT_ID).");
  }
  // Prefixed so the shared /settings callback can tell Spotify's and
  // GitHub's redirects apart — both land on the same route with the same
  // ?code=&state= shape.
  const state = `spotify:${crypto.randomUUID()}`;
  sessionStorage.setItem(STATE_KEY, state);
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectTo);
  url.searchParams.set("scope", SPOTIFY_CONNECTOR_SCOPES);
  url.searchParams.set("state", state);
  window.location.href = url.toString();
}

// Verifies the `state` query param Spotify echoed back matches what we sent,
// then clears it so it can't be replayed.
export function consumeSpotifyOAuthState(receivedState: string | null): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return !!expected && !!receivedState && expected === receivedState;
}
