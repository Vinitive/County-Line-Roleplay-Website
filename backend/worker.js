const cors = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin"
});
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
});
const randomToken = (bytes = 32) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
};
const sha256 = async value => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
};
const cookie = (name, value, maxAge) => `${name}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;
const getCookie = (request, name) => (request.headers.get("Cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(name + "="))?.slice(name.length + 1);
const allowed = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  return origin === env.FRONTEND_ORIGIN ? origin : "";
};
const redirect = (url, headers = {}) => new Response(null, { status: 302, headers: { Location: url, ...headers } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowed(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { headers: cors(origin) });
    }
    const headers = origin ? cors(origin) : {};
    try {
      if (url.pathname === "/health") return json({ ok: true, service: "County Line Roleplay Portal API" });
      if (url.pathname === "/auth/discord" && request.method === "GET") {
        const state = randomToken(24);
        await env.DB.prepare("INSERT INTO oauth_states (state, created_at) VALUES (?, ?)").bind(state, Date.now()).run();
        const redirectUri = env.DISCORD_REDIRECT_URI;
        const authorize = new URL("https://discord.com/oauth2/authorize");
        authorize.search = new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID, response_type: "code", redirect_uri: redirectUri,
          scope: "identify", state, prompt: "none"
        }).toString();
        return redirect(authorize.toString());
      }
      if (url.pathname === "/auth/callback" && request.method === "GET") {
        const state = url.searchParams.get("state"), code = url.searchParams.get("code");
        if (!state || !code) return redirect(env.FRONTEND_PORTAL_URL?auth=failed");
        const saved = await env.DB.prepare("SELECT state FROM oauth_states WHERE state = ? AND created_at > ?").bind(state, Date.now() - 600000).first();
        await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
        if (!saved) return redirect(env.FRONTEND_PORTAL_URL?auth=invalid_state");
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code", code, redirect_uri: env.DISCORD_REDIRECT_URI
          })
        });
        if (!tokenResponse.ok) return redirect(env.FRONTEND_PORTAL_URL?auth=discord_error");
        const token = await tokenResponse.json();
        const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + token.access_token } });
        if (!userResponse.ok) return redirect(env.FRONTEND_PORTAL_URL?auth=profile_error");
        const user = await userResponse.json();
        const session = randomToken(32), sessionHash = await sha256(session), expires = Date.now() + 604800000;
        await env.DB.prepare("INSERT INTO portal_sessions (token_hash, discord_id, username, global_name, avatar, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(sessionHash, user.id, user.username, user.global_name || null, user.avatar || null, expires).run();
        return redirect(env.FRONTEND_PORTAL_URL", { "Set-Cookie": cookie("clrp_session", session, 604800) });
      }
      if (url.pathname.startsWith("/api/")) {
        if (!origin) return json({ error: "Origin not allowed." }, 403);
        const raw = getCookie(request, "clrp_session");
        const session = raw ? await env.DB.prepare("SELECT discord_id, username, global_name, avatar, expires_at FROM portal_sessions WHERE token_hash = ? AND expires_at > ?").bind(await sha256(raw), Date.now()).first() : null;
        if (url.pathname === "/api/me" && request.method === "GET") {
          if (!session) return json({ authenticated: false }, 401, headers);
          return json({ authenticated: true, user: { id: session.discord_id, username: session.username, global_name: session.global_name, avatar: session.avatar }, characterLinked: false }, 200, headers);
        }
        if (url.pathname === "/api/logout" && request.method === "POST") {
          if (raw) await env.DB.prepare("DELETE FROM portal_sessions WHERE token_hash = ?").bind(await sha256(raw)).run();
          return json({ ok: true }, 200, { ...headers, "Set-Cookie": cookie("clrp_session", "", 0) });
        }
      }
      return json({ error: "Not found." }, 404, headers);
    } catch (error) {
      console.error("CLRP portal API error:", error);
      return json({ error: "The portal service encountered an error." }, 500, headers);
    }
  }
};