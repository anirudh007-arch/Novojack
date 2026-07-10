// Kept in its own file (no imports), mirroring google-scopes.ts, so both the
// client-side auth-URL builder and server-side token exchange can share it
// without a circular import.
export const GITHUB_CONNECTOR_SCOPES = "read:user notifications";
