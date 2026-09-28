// youtube-oauth: connect-once Google OAuth for YouTube Analytics.
//
//   POST (admin page, with the admin's Supabase JWT)  -> { ok, url } authorize URL, or { ok:false, reason }
//   GET  ?code&state (Google redirect)               -> exchanges code, stores refresh token, runs the
//                                                       first pull, redirects back to /admin/integrations/
//
// Tokens never reach the browser. Google client id + secret live in automation_secrets
// (service role only), set once from the Integrations page. verify_jwt is off because Google
// redirects the browser here; the POST path checks the caller is a full admin itself.
import { createClient } from "npm:@supabase/supabase-js@2";

const PROJECT_URL = "https://eibtnkaoqsgwiqttiwjo.supabase.co";
const CALLBACK = `${PROJECT_URL}/functions/v1/youtube-oauth`;
const ADMIN_PAGE = "https://www.cooperdelo.com/admin/integrations/";
const SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL") ?? PROJECT_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const back = (params: Record<string, string>) =>
  new Response(null, { status: 302, headers: { Location: `${ADMIN_PAGE}?${new URLSearchParams(params)}` } });

async function secret(db: ReturnType<typeof admin>, key: string): Promise<string | null> {
  const { data } = await db.from("automation_secrets").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function log(db: ReturnType<typeof admin>, status: string, note: string) {
  await db.from("task_run_log").insert({ task: "youtube-oauth", ran_at: new Date().toISOString(), status, note });
}

async function start(req: Request) {
  const authz = req.headers.get("Authorization") ?? "";
  if (!authz.startsWith("Bearer ")) return json({ ok: false, reason: "not_signed_in" }, 401);
  const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? PROJECT_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authz } },
    auth: { persistSession: false },
  });
  const { data: isAdmin } = await asUser.rpc("is_full_admin");
  if (isAdmin !== true) return json({ ok: false, reason: "not_allowed" }, 403);

  const db = admin();
  const clientId = await secret(db, "google_oauth_client_id");
  if (!clientId) return json({ ok: false, reason: "no_google_client" });

  const state = crypto.randomUUID();
  const { data: u } = await asUser.auth.getUser();
  const { error } = await db.from("oauth_states").insert({ state, provider: "youtube", created_by: u?.user?.email ?? null });
  if (error) return json({ ok: false, reason: "state_store_failed", detail: error.message }, 500);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", CALLBACK);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return json({ ok: true, url: url.toString() });
}

async function callback(u: URL) {
  const db = admin();
  const err = u.searchParams.get("error");
  if (err) {
    await log(db, "failed", `Google returned ${err}`);
    return back({ oauth_error: `youtube: ${err}` });
  }
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (!code || !state) return back({ oauth_error: "youtube: missing code" });

  const { data: st } = await db.from("oauth_states").delete().eq("state", state).eq("provider", "youtube")
    .gt("created_at", new Date(Date.now() - 15 * 60e3).toISOString()).select("state");
  if (!st?.length) return back({ oauth_error: "youtube: link expired, press Connect again" });

  const clientId = await secret(db, "google_oauth_client_id");
  const clientSecret = await secret(db, "google_oauth_client_secret");
  if (!clientId || !clientSecret) return back({ oauth_error: "youtube: Google client not set" });

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: CALLBACK, grant_type: "authorization_code" }),
  }).then((r) => r.json()).catch(() => ({}));
  if (!tok.refresh_token) {
    await log(db, "failed", `token exchange: ${tok.error ?? "no refresh_token"} ${tok.error_description ?? ""}`.slice(0, 300));
    return back({ oauth_error: `youtube: ${tok.error ?? "no refresh token returned"}` });
  }

  const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  }).then((r) => r.json()).catch(() => ({}));
  const item = ch.items?.[0];
  if (!item?.id) {
    await log(db, "failed", "connected Google account has no YouTube channel");
    return back({ oauth_error: "youtube: that Google account has no YouTube channel" });
  }

  const { error } = await db.from("youtube_credentials").upsert({
    channel_id: item.id,
    channel_title: item.snippet?.title ?? null,
    channel_handle: (item.snippet?.customUrl ?? "").replace(/^@/, "") || null,
    refresh_token: tok.refresh_token,
    scope: tok.scope ?? SCOPES,
    connected_at: new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) {
    await log(db, "failed", `store: ${error.message}`);
    return back({ oauth_error: "youtube: could not store the connection" });
  }
  await log(db, "ok", `Connected ${item.snippet?.title ?? item.id}. Refresh token stored server-side.`);

  // First pull right now so the page shows real numbers on return.
  const { data: pulled } = await db.rpc("youtube_analytics_pull");
  return back({ connected: "youtube", pull: String(pulled ?? "queued") });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    if (req.method === "POST") return await start(req);
    const u = new URL(req.url);
    if (u.searchParams.has("code") || u.searchParams.has("error") || u.searchParams.has("state")) return await callback(u);
    return json({ ok: true, service: "youtube-oauth" });
  } catch (e) {
    return json({ ok: false, reason: "server_error", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
