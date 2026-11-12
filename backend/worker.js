const cors = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin"
});

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  }
});

const randomToken = (bytes = 32) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, byte => byte.toString(16).padStart(2, "0")).join("");
};

const sha256 = async value => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

const sessionCookie = (value, maxAge) =>
  `clrp_session=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;

const getCookie = (request, name) =>
  (request.headers.get("Cookie") || "")
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(name + "="))
    ?.slice(name.length + 1);

const allowedOrigin = (request, env) => {
  const origin = request.headers.get("Origin") || "";
  return origin === env.FRONTEND_ORIGIN ? origin : "";
};

const redirect = (url, headers = {}) =>
  new Response(null, { status: 302, headers: { Location: url, ...headers } });

const portalRedirect = (env, authResult) => {
  const destination = new URL(env.FRONTEND_PORTAL_URL);
  if (authResult) destination.searchParams.set("auth", authResult);
  return redirect(destination.toString());
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);

    if (request.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { headers: cors(origin) });
    }

    const corsHeaders = origin ? cors(origin) : {};

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true, service: "County Line Roleplay Portal API" });
      }

      if (url.pathname === "/auth/discord" && request.method === "GET") {
        if (!env.DISCORD_CLIENT_ID || !env.DISCORD_REDIRECT_URI || !env.FRONTEND_PORTAL_URL) {
          return json({ error: "Discord authentication is not configured." }, 503);
        }

        const state = randomToken(24);
        await env.DB.prepare(
          "INSERT INTO oauth_states (state, created_at) VALUES (?, ?)"
        ).bind(state, Date.now()).run();

        const authorize = new URL("https://discord.com/oauth2/authorize");
        authorize.search = new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          response_type: "code",
          redirect_uri: env.DISCORD_REDIRECT_URI,
          scope: "identify",
          state
        }).toString();

        return redirect(authorize.toString());
      }

      if (url.pathname === "/auth/callback" && request.method === "GET") {
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");

        if (!state || !code) return portalRedirect(env, "failed");

        const saved = await env.DB.prepare(
          "SELECT state FROM oauth_states WHERE state = ? AND created_at > ?"
        ).bind(state, Date.now() - 600000).first();

        await env.DB.prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();

        if (!saved) return portalRedirect(env, "invalid_state");

        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.DISCORD_CLIENT_ID,
            client_secret: env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: env.DISCORD_REDIRECT_URI
          })
        });

        if (!tokenResponse.ok) return portalRedirect(env, "discord_error");

        const token = await tokenResponse.json();
        const userResponse = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: "Bearer " + token.access_token }
        });

        if (!userResponse.ok) return portalRedirect(env, "profile_error");

        const user = await userResponse.json();
        const session = randomToken(32);
        const sessionHash = await sha256(session);
        const expires = Date.now() + 604800000;

        await env.DB.prepare(
          "INSERT INTO portal_sessions (token_hash, discord_id, username, global_name, avatar, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
          sessionHash,
          user.id,
          user.username,
          user.global_name || null,
          user.avatar || null,
          expires
        ).run();

        return portalRedirect(env, null).then
          ? redirect(new URL(env.FRONTEND_PORTAL_URL).toString(), {
              "Set-Cookie": sessionCookie(session, 604800)
            })
          : portalRedirect(env, null);
      }

      if (url.pathname.startsWith("/api/")) {
        if (!origin) return json({ error: "Origin not allowed." }, 403);

        const rawSession = getCookie(request, "clrp_session");
        const session = rawSession
          ? await env.DB.prepare(
              "SELECT discord_id, username, global_name, avatar FROM portal_sessions WHERE token_hash = ? AND expires_at > ?"
            ).bind(await sha256(rawSession), Date.now()).first()
          : null;

        if (url.pathname === "/api/me" && request.method === "GET") {
          if (!session) return json({ authenticated: false }, 401, corsHeaders);
          return json({
            authenticated: true,
            user: {
              id: session.discord_id,
              username: session.username,
              global_name: session.global_name,
              avatar: session.avatar
            },
            characterLinked: false
          }, 200, corsHeaders);
        }

        if (url.pathname === "/api/logout" && request.method === "POST") {
          if (rawSession) {
            await env.DB.prepare("DELETE FROM portal_sessions WHERE token_hash = ?")
              .bind(await sha256(rawSession)).run();
          }
          return json({ ok: true }, 200, {
            ...corsHeaders,
            "Set-Cookie": sessionCookie("", 0)
          });
        }
      }

      return json({ error: "Not found." }, 404, corsHeaders);
    } catch (error) {
      console.error("CLRP portal API error:", error);
      return json({ error: "The portal service encountered an error." }, 500, corsHeaders);
    }
  }
};
