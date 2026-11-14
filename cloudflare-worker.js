const cors = origin => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
  const configured = String(env.FRONTEND_ORIGIN || "").replace(/\/$/, "");
  const trustedOrigins = new Set([
    configured,
    "https://vinitive.github.io"
  ].filter(Boolean));
  return trustedOrigins.has(origin) ? origin : "";
};

const redirect = (url, headers = {}) =>
  new Response(null, { status: 302, headers: { Location: url, ...headers } });


const CLRP_GUILD_ID = "1465045863687786771";

const CLRP_ROLE_ACCESS = {
  "1465045865939865803": { name: "Founder", permissions: ["*"] },
  "1465045865923084561": { name: "Administration", permissions: ["staff.manage", "applications.review", "careers.manage", "website.manage"] },
  "1465045865864368276": { name: "Human Resources", permissions: ["applications.review"] },
  "1465045865663172860": { name: "Law Enforcement", permissions: ["mdt.leo"] },
  "1465045865939865802": { name: "Dispatch", permissions: ["dispatch.access"] },
  "1465045865562640657": { name: "Fire / EMS", permissions: ["mdt.ems"] },
  "1465045865864368280": { name: "Civilian Staff", permissions: ["mdt.civilian"] }
};

const getDiscordAccess = async (env, discordId) => {
  if (!env.DISCORD_BOT_TOKEN) throw new Error("Discord bot token is not configured.");
  const response = await fetch(
    `https://discord.com/api/v10/guilds/${CLRP_GUILD_ID}/members/${encodeURIComponent(discordId)}`,
    { headers: { Authorization: "Bot " + env.DISCORD_BOT_TOKEN } }
  );
  if (response.status === 404) return { roles: [], roleNames: [], permissions: [], isStaff: false };
  if (!response.ok) {
    console.error("Discord member lookup failed:", response.status);
    throw new Error("Unable to verify Discord server roles.");
  }
  const member = await response.json();
  const matched = (member.roles || []).filter(roleId => CLRP_ROLE_ACCESS[roleId]);
  const roleNames = matched.map(roleId => CLRP_ROLE_ACCESS[roleId].name);
  const permissions = [...new Set(matched.flatMap(roleId => CLRP_ROLE_ACCESS[roleId].permissions))];
  return { roles: matched, roleNames, permissions, isStaff: matched.length > 0 };
};

const hasPermission = (access, permission) =>
  access.permissions.includes("*") || access.permissions.includes(permission);


const handleCadAction = async (env, action, body, officer, access) => {
  const now=Date.now(), leo=access==="leo", allowed=leo||access==="dispatch";
  if(!allowed)return {error:"CAD access denied."};
  const audit=async(a,id=null,d="")=>env.DB.prepare("INSERT INTO cad_audit (id,actor_id,actor_name,action,target_id,details,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(),officer.citizenid,officer.name,a,id,String(d).slice(0,1000),now).run();
  if(action==="bootstrap"){
    await env.DB.prepare("INSERT INTO cad_units (citizenid,callsign,officer_name,job,access,status,last_seen) VALUES (?,?,?,?,?,'Available',?) ON CONFLICT(citizenid) DO UPDATE SET callsign=CASE WHEN excluded.callsign='' THEN cad_units.callsign ELSE excluded.callsign END,officer_name=excluded.officer_name,job=CASE WHEN excluded.job IN ('Law Enforcement','Dispatch') THEN cad_units.job ELSE excluded.job END,access=excluded.access,last_seen=excluded.last_seen").bind(officer.citizenid,officer.callsign||"",officer.name,officer.job||"Unit",access,now).run();
    const [c,u,b,a]=await Promise.all([
      env.DB.prepare("SELECT c.*,l.map_x AS mapX,l.map_y AS mapY FROM cad_calls c LEFT JOIN cad_call_locations l ON l.call_id=c.id WHERE c.status!='Closed' ORDER BY c.created_at DESC LIMIT 100").all(),
      env.DB.prepare("SELECT citizenid,callsign,officer_name AS name,job,status,current_call_id FROM cad_units WHERE last_seen>? ORDER BY callsign").bind(now-120000).all(),
      env.DB.prepare("SELECT * FROM cad_bolos WHERE active=1 ORDER BY created_at DESC LIMIT 100").all(),
      env.DB.prepare("SELECT call_id,citizenid,callsign,officer_name AS name FROM cad_call_units").all()
    ]);
    const map={};for(const x of a.results||[])(map[x.call_id]??=[]).push({callsign:x.callsign,name:x.name,citizenid:x.citizenid});
    return {access,officer,calls:(c.results||[]).map(x=>({...x,units:map[x.id]||[]})),units:u.results||[],bolos:b.results||[]};
  }
  if(action==="setStatus"){
    const status=String(body.status||"");
    if(!["Available","En Route","On Scene","Busy","Out of Service"].includes(status))return {error:"Invalid unit status."};
    await env.DB.prepare("UPDATE cad_units SET status=?,last_seen=? WHERE citizenid=?").bind(status,now,officer.citizenid).run();await audit("unit.status",officer.citizenid,status);return {message:"Unit status updated.",status};
  }
  if(action==="createCall"){
    const type=String(body.call_type||"").trim().slice(0,100),loc=String(body.location||"").trim().slice(0,180),desc=String(body.description||"").trim().slice(0,2000),priority=String(body.priority||"3 - Routine");
    if(!type||!loc||!["1 - Emergency","2 - Urgent","3 - Routine","4 - Information"].includes(priority))return {error:"Call type, location, and valid priority are required."};
    const id=crypto.randomUUID(),n=await env.DB.prepare("SELECT COUNT(*) AS total FROM cad_calls WHERE created_at>=?").bind(new Date().setHours(0,0,0,0)).first(),num="CL-"+new Date().toISOString().slice(2,10).replace(/-/g,"")+"-"+String((Number(n?.total)||0)+1).padStart(3,"0");
    await env.DB.prepare("INSERT INTO cad_calls (id,call_number,call_type,location,priority,description,status,created_by,created_by_name,created_at,updated_at) VALUES (?,?,?,?,?,?,'Pending',?,?,?,?)").bind(id,num,type,loc,priority,desc,officer.citizenid,officer.name,now,now).run();const mapX=Number(body.mapX),mapY=Number(body.mapY);if(Number.isFinite(mapX)&&Number.isFinite(mapY)&&mapX>=0&&mapX<=8192&&mapY>=0&&mapY<=8192){await env.DB.prepare("INSERT INTO cad_call_locations (call_id,map_x,map_y,updated_at,updated_by) VALUES (?,?,?,?,?)").bind(id,mapX,mapY,now,officer.citizenid).run();}await audit("call.created",id,num+" "+type);return {message:"Call created: "+num,refresh:true};
  }
  if(action==="assignCall"){
    const id=String(body.callId||""),exists=await env.DB.prepare("SELECT id FROM cad_calls WHERE id=? AND status!='Closed'").bind(id).first();if(!exists)return {error:"Active call not found."};
    await env.DB.prepare("INSERT INTO cad_call_units (call_id,citizenid,callsign,officer_name,assigned_at) VALUES (?,?,?,?,?) ON CONFLICT(call_id,citizenid) DO UPDATE SET assigned_at=excluded.assigned_at").bind(id,officer.citizenid,officer.callsign||"",officer.name,now).run();
    await env.DB.prepare("UPDATE cad_units SET current_call_id=?,status='En Route',last_seen=? WHERE citizenid=?").bind(id,now,officer.citizenid).run();await env.DB.prepare("UPDATE cad_calls SET status='Dispatched',updated_at=? WHERE id=? AND status='Pending'").bind(now,id).run();await audit("call.assigned",id,officer.callsign||officer.name);return {message:"Unit assigned.",refresh:true};
  }
  if(action==="moveCallBlip"){
    if(access!=="dispatch")return {error:"Only Dispatch can move call blips."};const id=String(body.callId||""),x=Number(body.mapX),y=Number(body.mapY);if(!id||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>8192||y<0||y>8192)return {error:"A valid call and map position are required."};const exists=await env.DB.prepare("SELECT id FROM cad_calls WHERE id=? AND status!='Closed'").bind(id).first();if(!exists)return {error:"Active call not found."};await env.DB.prepare("INSERT INTO cad_call_locations (call_id,map_x,map_y,updated_at,updated_by) VALUES (?,?,?,?,?) ON CONFLICT(call_id) DO UPDATE SET map_x=excluded.map_x,map_y=excluded.map_y,updated_at=excluded.updated_at,updated_by=excluded.updated_by").bind(id,x,y,now,officer.citizenid).run();await audit("call.location.updated",id,x+","+y);return {message:"Call blip moved.",refresh:true};
  }
  if(action==="updateCall"){
    const id=String(body.callId||""),status=String(body.status||"");if(!["Pending","Dispatched","On Scene","Closed"].includes(status))return {error:"Invalid call status."};
    const q=await env.DB.prepare("UPDATE cad_calls SET status=?,updated_at=?,closed_at=? WHERE id=?").bind(status,now,status==="Closed"?now:null,id).run();if(!Number(q.meta?.changes||0))return {error:"Call not found."};
    if(status==="Closed"){await env.DB.prepare("DELETE FROM cad_call_units WHERE call_id=?").bind(id).run();await env.DB.prepare("UPDATE cad_units SET current_call_id=NULL,status='Available',last_seen=? WHERE current_call_id=?").bind(now,id).run();}
    await audit("call.status",id,status);return {message:"Call status updated.",refresh:true};
  }
  if(action==="search"){
    if(!leo)return {error:"Records search is restricted to Law Enforcement."};const q=String(body.query||"").trim().slice(0,100);if(q.length<2)return {error:"Enter at least two characters."};let rows=[];
    if(body.searchType==="vehicle"){const x=await env.DB.prepare("SELECT citizenid,character_name FROM portal_characters WHERE payload LIKE ? LIMIT 30").bind("%"+q+"%").all();rows=(x.results||[]).map(v=>({name:v.character_name,citizenid:v.citizenid,details:"Vehicle data match in linked character record."}));}
    else{const x=await env.DB.prepare("SELECT citizenid,character_name FROM portal_characters WHERE citizenid LIKE ? OR character_name LIKE ? LIMIT 30").bind("%"+q+"%","%"+q+"%").all();rows=(x.results||[]).map(v=>({name:v.character_name,citizenid:v.citizenid,details:"Citizen ID: "+v.citizenid}));}
    const x=await env.DB.prepare("SELECT record_type,subject,title,details,created_at FROM cad_records WHERE subject LIKE ? OR title LIKE ? ORDER BY created_at DESC LIMIT 30").bind("%"+q+"%","%"+q+"%").all();rows.push(...(x.results||[]).map(v=>({name:v.title,details:v.record_type+" · "+v.subject+" · "+v.details,created_at:v.created_at})));await audit("records.search",null,q);return {records:rows};
  }
  if(action==="createRecord"){
    if(!leo)return {error:"Only Law Enforcement can create reports."};const type=String(body.record_type||"Incident Report").slice(0,50),subject=String(body.subject||"").trim().slice(0,120),title=String(body.title||"").trim().slice(0,150),details=String(body.details||"").trim().slice(0,5000);if(!subject||!title||!details)return {error:"Subject, title, and narrative are required."};
    const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO cad_records (id,record_type,subject,title,details,officer_citizenid,officer_name,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,type,subject,title,details,officer.citizenid,officer.name,now).run();await audit("record.created",id,type+":"+subject);return {message:type+" saved.",refresh:true};
  }
  if(action==="createBolo"){
    if(!leo)return {error:"Only Law Enforcement can create BOLOs."};const type=String(body.bolo_type||"Other").slice(0,30),title=String(body.title||"").trim().slice(0,150),description=String(body.description||"").trim().slice(0,2000);if(!title||!description)return {error:"BOLO subject and description are required."};
    const id=crypto.randomUUID();await env.DB.prepare("INSERT INTO cad_bolos (id,bolo_type,title,description,created_by,created_by_name,created_at,active) VALUES (?,?,?,?,?,?,?,1)").bind(id,type,title,description,officer.citizenid,officer.name,now).run();await audit("bolo.created",id,title);return {message:"BOLO published.",refresh:true};
  }
  return {error:"Unknown CAD action."};
};

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

        if (url.pathname === "/api/server/cad") {
          const officer=body.officer||{}, access=body.access==="leo"||body.access==="dispatch"?body.access:"";
          if(!officer.citizenid||!officer.name||!access)return json({error:"Invalid trusted unit identity."},400);
          const result=await handleCadAction(env,String(body.action||"bootstrap"),body,officer,access);
          return json(result,result.error?400:200);
        }

        return json({ error: "Not found." }, 404);
      }

      if (url.pathname === "/api/server-status" && request.method === "GET") {
        const status = await env.DB.prepare(
          "SELECT server_name, player_count, max_players, last_heartbeat FROM portal_server_status WHERE id = 1"
        ).first();
        const now = Date.now();
        const online = Boolean(status && status.last_heartbeat && now - status.last_heartbeat < 90000);
        return new Response(JSON.stringify({
          online,
          name: status?.server_name || "County Line Roleplay",
          players: online ? Number(status.player_count) || 0 : 0,
          maxPlayers: Number(status?.max_players) || 32,
          lastHeartbeat: status?.last_heartbeat || null
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "https://vinitive.github.io",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Expose-Headers": "X-CLRP-Worker-Version",
            "X-CLRP-Worker-Version": "cors-direct-2026-11-12",
            "Vary": "Origin"
          }
        });
      }

      if (url.pathname.startsWith("/api/")) {
        if (!origin) return json({ error: "Origin not allowed." }, 403);

        // Public careers feed: only positions marked open are visible to applicants.
        if (url.pathname === "/api/careers" && request.method === "GET") {
          const result = await env.DB.prepare(
            "SELECT id, department, title, description, position_type FROM career_positions WHERE is_open = 1 ORDER BY department, created_at"
          ).all();
          return json({ positions: result.results || [] }, 200, corsHeaders);
        }

        // Public application submissions. Staff review endpoints are not enabled.
        if (url.pathname === "/api/applications" && request.method === "POST") {
          try {
            const body = await request.json();
            const required = ["applicantName", "email", "discord", "availability", "experience", "motivation"];

            for (const key of required) {
              if (typeof body[key] !== "string" || !body[key].trim()) {
                return json({ error: "Please complete all required fields." }, 400, corsHeaders);
              }
            }

            const openPosition = await env.DB.prepare(
              "SELECT id FROM career_positions WHERE department = ? AND title = ? AND is_open = 1 LIMIT 1"
            ).bind(String(body.department || ""), String(body.position || "")).first();

            if (
              !openPosition ||
              !Number.isInteger(Number(body.age)) ||
              Number(body.age) < 13 ||
              Number(body.age) > 99
            ) {
              return json({ error: "Please select a currently open position and check your age." }, 400, corsHeaders);
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

        if (url.pathname === "/api/cad" && ["GET","POST"].includes(request.method)) {
          if(!session)return json({error:"Please sign in again."},401,corsHeaders);
          let access;try{access=await getDiscordAccess(env,session.discord_id);}catch(error){return json({error:"Unable to verify your Discord roles."},503,corsHeaders);}
          const leo=hasPermission(access,"mdt.leo"),dispatch=hasPermission(access,"dispatch.access");
          if(!leo&&!dispatch)return json({error:"CAD access is restricted to Law Enforcement and Dispatch."},403,corsHeaders);
          const linkedCharacter=await env.DB.prepare("SELECT citizenid,character_name FROM portal_characters WHERE discord_id=? ORDER BY is_online DESC,last_seen DESC,updated_at DESC LIMIT 1").bind(session.discord_id).first();
          const officer=linkedCharacter
            ? {citizenid:linkedCharacter.citizenid,name:linkedCharacter.character_name,callsign:"",job:leo?"Law Enforcement":"Dispatch"}
            : {citizenid:"discord:"+session.discord_id,name:session.global_name||session.username,callsign:"",job:leo?"Law Enforcement":"Dispatch"};
          const body=request.method==="POST"?await request.json():{};
          const result=await handleCadAction(env,request.method==="GET"?"bootstrap":String(body.action||"bootstrap"),body,officer,leo?"leo":"dispatch");
          return json(result,result.error?400:200,corsHeaders);
        }

        if (url.pathname === "/api/staff/careers" && ["GET", "POST", "DELETE"].includes(request.method)) {
          if (!session) return json({ error: "Please sign in again." }, 401, corsHeaders);
          let access;
          try {
            access = await getDiscordAccess(env, session.discord_id);
          } catch (error) {
            console.error("Careers permission verification error:", error);
            return json({ error: "Unable to verify your Discord roles right now." }, 503, corsHeaders);
          }
          if (!hasPermission(access, "careers.manage")) {
            return json({ error: "You do not have permission to manage careers." }, 403, corsHeaders);
          }

          if (request.method === "GET") {
            const result = await env.DB.prepare(
              "SELECT id, department, title, description, position_type, is_open, created_at, updated_at FROM career_positions ORDER BY department, created_at DESC"
            ).all();
            return json({ positions: result.results || [] }, 200, corsHeaders);
          }

          const body = await request.json();
          if (request.method === "DELETE") {
            const id = String(body.id || "").trim();
            if (!id) return json({ error: "A position ID is required." }, 400, corsHeaders);
            const result = await env.DB.prepare("DELETE FROM career_positions WHERE id = ?").bind(id).run();
            if (!Number(result.meta && result.meta.changes || 0)) return json({ error: "Position not found." }, 404, corsHeaders);
            return json({ ok: true, id }, 200, corsHeaders);
          }

          const department = String(body.department || "").trim().toLowerCase();
          const title = String(body.title || "").trim();
          const description = String(body.description || "").trim();
          const positionType = String(body.positionType || "OPEN POSITION").trim().slice(0, 40);
          const isOpen = body.isOpen === false || body.isOpen === 0 ? 0 : 1;
          if (!["leo", "ems", "civilian"].includes(department) || !title || !description) {
            return json({ error: "Department, position title, and description are required." }, 400, corsHeaders);
          }
          if (title.length > 100 || description.length > 1200) {
            return json({ error: "Position title or description is too long." }, 400, corsHeaders);
          }

          const now = Date.now();
          const id = String(body.id || "").trim() || crypto.randomUUID();
          if (body.id) {
            const result = await env.DB.prepare(
              "UPDATE career_positions SET department = ?, title = ?, description = ?, position_type = ?, is_open = ?, updated_at = ? WHERE id = ?"
            ).bind(department, title, description, positionType, isOpen, now, id).run();
            if (!Number(result.meta && result.meta.changes || 0)) return json({ error: "Position not found." }, 404, corsHeaders);
          } else {
            await env.DB.prepare(
              "INSERT INTO career_positions (id, department, title, description, position_type, is_open, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(id, department, title, description, positionType, isOpen, now, now).run();
          }
          return json({ ok: true, id }, 200, corsHeaders);
        }

        if (url.pathname === "/api/staff/applications" && (request.method === "GET" || request.method === "POST")) {
          if (!session) return json({ error: "Please sign in again." }, 401, corsHeaders);

          let access;
          try {
            access = await getDiscordAccess(env, session.discord_id);
          } catch (error) {
            console.error("Staff role verification error:", error);
            return json({ error: "Unable to verify your Discord roles right now." }, 503, corsHeaders);
          }

          if (!hasPermission(access, "applications.review")) {
            return json({ error: "You do not have permission to review applications." }, 403, corsHeaders);
          }

          if (request.method === "GET") {
            const result = await env.DB.prepare(
              "SELECT id, department, position, applicant_name, email, discord, age, availability, experience, motivation, additional, status, submitted_at FROM applications ORDER BY submitted_at DESC LIMIT 200"
            ).all();
            return json({ applications: result.results || [] }, 200, corsHeaders);
          }

          const body = await request.json();
          const id = String(body.id || "").trim();
          const status = String(body.status || "").trim().toLowerCase();
          if (!id || !["pending", "reviewing", "accepted", "rejected"].includes(status)) {
            return json({ error: "A valid application ID and status are required." }, 400, corsHeaders);
          }

          const result = await env.DB.prepare(
            "UPDATE applications SET status = ? WHERE id = ?"
          ).bind(status, id).run();
          if (!Number(result.meta && result.meta.changes || 0)) {
            return json({ error: "Application not found." }, 404, corsHeaders);
          }
          return json({ ok: true, id, status }, 200, corsHeaders);
        }

        if (url.pathname === "/api/staff/roles" && request.method === "GET") {
          if (!session) return json({ error: "Please sign in again." }, 401, corsHeaders);
          let access;
          try {
            access = await getDiscordAccess(env, session.discord_id);
          } catch (error) {
            console.error("Staff role verification error:", error);
            return json({ error: "Unable to verify your Discord roles right now." }, 503, corsHeaders);
          }
          if (!hasPermission(access, "staff.manage")) {
            return json({ error: "You do not have permission to view staff role mappings." }, 403, corsHeaders);
          }
          return json({
            roles: Object.entries(CLRP_ROLE_ACCESS).map(([discordRoleId, role]) => ({
              discordRoleId,
              name: role.name,
              permissions: role.permissions
            }))
          }, 200, corsHeaders);
        }

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

        if (url.pathname === "/api/permissions" && request.method === "GET") {
          if (!session) return json({ error: "Please sign in again." }, 401, corsHeaders);
          try {
            const access = await getDiscordAccess(env, session.discord_id);
            return json(access, 200, corsHeaders);
          } catch (error) {
            console.error("Discord role verification error:", error);
            return json({ error: "Unable to verify your Discord roles right now." }, 503, corsHeaders);
          }
        }

        if (url.pathname === "/api/me" && request.method === "GET") {
          if (!session) return json({ authenticated: false }, 401, corsHeaders);
          let access = { roles: [], roleNames: [], permissions: [], isStaff: false };
          try {
            access = await getDiscordAccess(env, session.discord_id);
          } catch (error) {
            console.error("Discord role verification error:", error);
            return json({ error: "Unable to verify your Discord roles right now." }, 503, corsHeaders);
          }
          return json({
            authenticated: true,
            access,
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
