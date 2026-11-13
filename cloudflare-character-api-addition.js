/*
 * COUNTY LINE ROLEPLAY — CHARACTER PORTAL API ADDITION
 *
 * Add these routes to the existing Worker. Do not replace your Discord OAuth
 * code. Full placement instructions are in CHARACTER-PORTAL-SETUP.md.
 *
 * Required Worker secret: CLRP_SERVER_SECRET
 * Required D1 schema: cloudflare-character-schema.sql
 */

// A) Insert this block inside try { ... }, BEFORE the existing
//    if (url.pathname.startsWith("/api/")) { ... } block.
//    It authenticates server-to-server calls without browser CORS.
if (url.pathname.startsWith("/api/server/")) {
  const configuredSecret = env.CLRP_SERVER_SECRET;
  const suppliedSecret = request.headers.get("Authorization") || "";

  if (!configuredSecret || suppliedSecret !== "Bearer " + configuredSecret) {
    return json({ error: "Unauthorized server request." }, 401);
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

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
        "INSERT INTO portal_characters (citizenid, discord_id, character_name, payload, is_online, last_seen, updated_at) VALUES (?, ?, ?, '{}', 1, ?, ?)"
      ).bind(citizenid, link.discord_id, characterName, now, now).run();
    }

    return json({ ok: true, characterName });
  }

  if (url.pathname === "/api/server/sync") {
    const characters = Array.isArray(body.characters) ? body.characters.slice(0, 128) : [];
    const now = Date.now();

    await env.DB.prepare("UPDATE portal_characters SET is_online = 0").run();

    let updated = 0;
    for (const character of characters) {
      const citizenid = String(character.citizenid || "").trim();
      if (!/^[A-Za-z0-9_-]{2,64}$/.test(citizenid)) continue;

      const result = await env.DB.prepare(
        "UPDATE portal_characters SET character_name = ?, payload = ?, is_online = 1, last_seen = ?, updated_at = ? WHERE citizenid = ?"
      ).bind(
        String(character.characterName || "Unknown Character").slice(0, 100),
        JSON.stringify(character),
        now,
        now,
        citizenid
      ).run();

      updated += Number(result.meta && result.meta.changes || 0);
    }

    return json({ ok: true, updated });
  }

  return json({ error: "Not found." }, 404);
}

// B) Inside the existing generic /api/ block, after the portal session lookup
//    and before the existing /api/me route, add these two routes.

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
    "SELECT citizenid, character_name, payload, is_online, last_seen, updated_at FROM portal_characters WHERE discord_id = ? ORDER BY character_name COLLATE NOCASE"
  ).bind(session.discord_id).all();

  const characters = (result.results || []).map(row => {
    let payload = {};
    try { payload = JSON.parse(row.payload || "{}"); } catch (_) {}
    return {
      citizenid: row.citizenid,
      characterName: row.character_name,
      isOnline: Boolean(row.is_online),
      lastSeen: row.last_seen,
      updatedAt: row.updated_at,
      data: payload
    };
  });

  return json({ characters }, 200, corsHeaders);
}
