// ============================================================================
// Supabase client — uses ONLY the public "anon" key.
// NEVER put the service_role key in this file or anywhere in /js or /assets:
// this whole site is static and public, so any secret placed here is exposed
// to every visitor. All privileged logic lives in Postgres RPC functions
// (see sql/schema.sql) which run behind Supabase's own permission checks.
// ============================================================================

const SUPABASE_URL  = "https://mltfdadqekeuleimreva.supabase.co"; // from your anon JWT "ref"
const SUPABASE_ANON = "sb_publishable_0G-4Pauntplhqs9spQmoPg_TPrx5Kn6";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ---- local session helpers --------------------------------------------------
const SESSION_KEY = "smc_session";

function saveSession(token, member) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, member }));
}
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
function requireRole(role) {
  const s = getSession();
  if (!s || s.member.role !== role) {
    window.location.href = "index.html";
    return null;
  }
  return s;
}
