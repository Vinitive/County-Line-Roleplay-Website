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

        return redirect(new URL(env.FRONTEND_PORTAL_URL).toString(), {
          "Set-Cookie": sessionCookie(session, 604800)
        });
      }

      // Server-to-server FiveM routes. These use a secret and do not require browser CORS.
      if (url.pathname.startsWith("/api/server/")) {
        const configuredSecret = env.CLRP_SERVER_SECRET;
        const suppliedSecret = request.headers.get("Authorization") || "";

        if (!configuredSecret || suppliedSecret !== "Bearer " + configuredSecret) {
          return json({ error: "Unauthorized server request." }, 401);
        }
        if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

        const body = await request.json();

        if (url.pathname === "/api/server/link") {
          const code = String(body.code || "");
          const citizenid = String(body.citizenid || "").trim();
          const characterName = String(body.characterName || "Unknown Character").trim().slice(0, 100);

          if (!/^\d{8}$/.test(code) || !/^[A-Za-z0-9_-]{2,64}$/.test(citizenid)) {
            return json({ error: "Invalid linking code or character ID." }, 400);
          }

          const codeHash = await sha256(code);
          const now = Date.now();
          const link = await env.DB.prepare(
            "SELECT discord_id FROM portal_link_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?"
          ).bind(codeHash, now).first();

          if (!link) return json({ error: "That code is invalid, expired, or already used." }, 400);

          const existing = await env.DB.prepare(
            "SELECT discord_id FROM portal_characters WHERE citizenid = ?"
          ).bind(citizenid).first();

          if (existing && existing.discord_id !== link.discord_id) {
            return json({ error: "This character is already linked to a different website account." }, 409);
          }

          const claimed = await env.DB.prepare(
            "UPDATE portal_link_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ? RETURNING discord_id"
          ).bind(now, codeHash, now).first();

          if (!claimed) return json({ error: "That code has already been used. Generate another code." }, 409);

          if (existing) {
            await env.DB.prepare(
              "UPDATE portal_characters SET character_name = ?, updated_at = ? WHERE citizenid = ? AND discord_id = ?"
            ).bind(characterName, now, citizenid, link.discord_id).run();
          } else {
            await env.DB.prepare(
              "INSERT INTO portal_characters (citizenid, discord_id, character_name, payload, is_online, last_seen, updated_at, sessions_count, first_joined) VALUES (?, ?, ?, '{}', 1, ?, ?, 1, ?)"
            ).bind(citizenid, link.discord_id, characterName, now, now, now).run();
          }

          return json({ ok: true, characterName });
        }

        if (url.pathname === "/api/server/sync") {
          const characters = Array.isArray(body.characters) ? body.characters.slice(0, 128) : [];
          const now = Date.now();

          // Expire characters that have not appeared in a recent server heartbeat.
          await env.DB.prepare(
            "UPDATE portal_characters SET is_online = 0 WHERE last_seen IS NULL OR last_seen < ?"
          ).bind(now - 90000).run();

          let updated = 0;
          for (const character of characters) {
            const citizenid = String(character.citizenid || "").trim();
            if (!/^[A-Za-z0-9_-]{2,64}$/.test(citizenid)) continue;

            const previous = await env.DB.prepare(
              "SELECT is_online, last_seen FROM portal_characters WHERE citizenid = ?"
            ).bind(citizenid).first();
            if (!previous) continue;

            const elapsed = previous.is_online && previous.last_seen
              ? Math.min(90, Math.max(0, (now - Number(previous.last_seen)) / 1000))
              : 0;
            const newSession = previous.is_online ? 0 : 1;

            const result = await env.DB.prepare(
              "UPDATE portal_characters SET character_name = ?, payload = ?, is_online = 1, last_seen = ?, updated_at = ?, playtime_seconds = playtime_seconds + ?, sessions_count = sessions_count + ?, first_joined = COALESCE(first_joined, ?) WHERE citizenid = ?"
            ).bind(
              String(character.characterName || "Unknown Character").slice(0, 100),
              JSON.stringify(character),
              now,
              now,
              Math.floor(elapsed),
              newSession,
              now,
              citizenid
            ).run();
            updated += Number(result.meta && result.meta.changes || 0);
          }

          const server = body.server || {};
          await env.DB.prepare(
            "INSERT INTO portal_server_status (id, server_name, player_count, max_players, last_heartbeat) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET server_name = excluded.server_name, player_count = excluded.player_count, max_players = excluded.max_players, last_heartbeat = excluded.last_heartbeat"
          ).bind(
            String(server.name || "County Line Roleplay").slice(0, 100),
            Math.max(0, Number(server.players) || 0),
            Math.max(1, Number(server.maxPlayers) || 32),
            now
          ).run();

          return json({ ok: true, updated });
        }

        return json({ error: "Not found." }, 404);
      }

      if (url.pathname === "/api/server-status" && request.method === "GET") {
        const status = await env.DB.prepare(
          "SELECT server_name, player_count, max_players, last_heartbeat FROM portal_server_status WHERE id = 1"
        ).first();
        const now = Date.now();
        const online = Boolean(status && status.last_heartbeat && now - status.last_heartbeat < 90000);
        return json({
          online,
          name: status?.server_name || "County Line Roleplay",
          players: online ? Number(status.player_count) || 0 : 0,
          maxPlayers: Number(status?.max_players) || 32,
          lastHeartbeat: status?.last_heartbeat || null
        });
      }

      if (url.pathname.startsWith("/api/")) {
        if (!origin) return json({ error: "Origin not allowed." }, 403);

        // Public application submissions. Staff review endpoints are not enabled.
        if (url.pathname === "/api/applications" && request.method === "POST") {
          try {
            const body = await request.json();
            const positions = {
              leo: ["Patrol Deputy", "State Trooper", "Field Training Officer"],
              ems: ["Firefighter / EMT", "Paramedic", "Fire / EMS Supervisor"],
              civilian: ["Business Owner", "Mechanic", "Civilian Roleplayer"]
            };
            const required = ["applicantName", "email", "discord", "availability", "experience", "motivation"];

            for (const key of required) {
              if (typeof body[key] !== "string" || !body[key].trim()) {
                return json({ error: "Please complete all required fields." }, 400, corsHeaders);
              }
            }

            if (
              !positions[body.department] ||
              !positions[body.department].includes(body.position) ||
              !Number.isInteger(Number(body.age)) ||
              Number(body.age) < 13 ||
              Number(body.age) > 99
            ) {
              return json({ error: "Please check your department, position, and age." }, 400, corsHeaders);
            }

            const limits = {
              applicantName: 100, email: 160, discord: 80,
              availability: 1500, experience: 2500, motivation: 2500, additional: 2000
            };
            for (const [key, max] of Object.entries(limits)) {
              if (typeof body[key] === "string" && body[key].length > max) {
                return json({ error: "One or more answers are too long." }, 400, corsHeaders);
              }
            }

            const id = crypto.randomUUID();
            await env.DB.prepare(`
              INSERT INTO applications
              (id, department, position, applicant_name, email, discord, age,
               availability, experience, motivation, additional, status, submitted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            `).bind(
              id, body.department, body.position, body.applicantName.trim(),
              body.email.trim(), body.discord.trim(), Number(body.age),
              body.availability.trim(), body.experience.trim(), body.motivation.trim(),
              (body.additional || "").trim(), Date.now()
            ).run();

            return json({ ok: true, id }, 200, corsHeaders);
          } catch (error) {
            console.error("Application submission error:", error);
            return json({ error: "Unable to save application right now." }, 500, corsHeaders);
          }
        }

        const rawSession = getCookie(request, "clrp_session");
        const session = rawSession
          ? await env.DB.prepare(
              "SELECT discord_id, username, global_name, avatar FROM portal_sessions WHERE token_hash = ? AND expires_at > ?"
            ).bind(await sha256(rawSession), Date.now()).first()
          : null;

        if (url.pathname === "/api/link-code" && request.method === "POST") {
          if (!session) return json({ error: "Please sign in again." }, 401, corsHeaders);

          const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, "0");
          const codeHash = await sha256(code);
          const now = Date.now();

          await env.DB.prepare("DELETE FROM portal_link_codes WHERE expires_at < ? OR used_at IS NOT NULL")
            .bind(now).run();

          await env.DB.prepare(
            "INSERT INTO portal_link_codes (code_hash, discord_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
          ).bind(codeHash, session.discord_id, now, now + 600000).run();

          return json({ ok: true, code, expiresAt: now + 600000 }, 200, corsHeaders);
        }

        if (url.pathname === "/api/characters" && request.method === "GET") {
          if (!session) return json({ error: "Please sign in again." }, 401, corsHeaders);

          const result = await env.DB.prepare(
            "SELECT citizenid, character_name, payload, is_online, last_seen, updated_at, playtime_seconds, sessions_count, first_joined FROM portal_characters WHERE discord_id = ? ORDER BY character_name COLLATE NOCASE"
          ).bind(session.discord_id).all();

          const characters = (result.results || []).map(row => {
            let payload = {};
            try { payload = JSON.parse(row.payload || "{}"); } catch (_) {}
            return {
              citizenid: row.citizenid,
              characterName: row.character_name,
              isOnline: Boolean(row.is_online) && Boolean(row.last_seen) && Date.now() - Number(row.last_seen) < 90000,
              lastSeen: row.last_seen,
              updatedAt: row.updated_at,
              playtimeSeconds: Number(row.playtime_seconds) || 0,
              sessionsCount: Number(row.sessions_count) || 0,
              firstJoined: row.first_joined || null,
              data: payload
            };
          });

          return json({ characters }, 200, corsHeaders);
        }

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
