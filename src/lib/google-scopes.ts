// Requesting these scopes + offline access at sign-in is what lets server
// functions call Gmail/Calendar directly later (see src/integrations/google).
// Kept in its own file (no imports) so both client.ts and google-oauth.ts can
// use it without a circular import.
export const GOOGLE_CONNECTOR_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar",
].join(" ");
