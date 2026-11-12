// COUNTY LINE ROLEPLAY — APPLICATION API ADD-ON
// 1) Run applications-schema.sql against the existing D1 database (binding: DB).
// 2) Add this route inside your existing Worker fetch(request, env) handler,
//    BEFORE its final 404 response. Keep the existing Discord OAuth routes intact.
if (url.pathname === "/api/applications" && request.method === "POST") {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = "https://vinitive.github.io";
  const cors = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  if (origin !== allowedOrigin) {
    return new Response(JSON.stringify({ error: "Origin not allowed." }), {
      status: 403, headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const body = await request.json();
    const allowedDepartments = ["leo", "ems", "civilian"];
    const positions = {
      leo: ["Patrol Deputy", "State Trooper", "Field Training Officer"],
      ems: ["Firefighter / EMT", "Paramedic", "Fire / EMS Supervisor"],
      civilian: ["Business Owner", "Mechanic", "Civilian Roleplayer"]
    };
    const fields = ["applicantName", "email", "discord", "availability", "experience", "motivation"];
    for (const key of fields) {
      if (typeof body[key] !== "string" || !body[key].trim()) {
        return Response.json({ error: "Please complete all required fields." }, { status: 400, headers: cors });
      }
    }
    if (!allowedDepartments.includes(body.department) ||
        !positions[body.department].includes(body.position) ||
        !Number.isInteger(Number(body.age)) || Number(body.age) < 13 || Number(body.age) > 99) {
      return Response.json({ error: "Please check your department, position, and age." }, { status: 400, headers: cors });
    }
    const limits = { applicantName: 100, email: 160, discord: 80, availability: 1500, experience: 2500, motivation: 2500, additional: 2000 };
    for (const [key, max] of Object.entries(limits)) {
      if (typeof body[key] === "string" && body[key].length > max) {
        return Response.json({ error: "One or more answers are too long." }, { status: 400, headers: cors });
      }
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO applications
      (id, department, position, applicant_name, email, discord, age, availability, experience, motivation, additional, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.department, body.position, body.applicantName.trim(), body.email.trim(),
      body.discord.trim(), Number(body.age), body.availability.trim(), body.experience.trim(),
      body.motivation.trim(), (body.additional || "").trim(), Math.floor(Date.now() / 1000)
    ).run();
    return Response.json({ ok: true, id }, { headers: cors });
  } catch (error) {
    return Response.json({ error: "Unable to save application right now." }, { status: 500, headers: cors });
  }
}
if (url.pathname === "/api/applications" && request.method === "OPTIONS") {
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "https://vinitive.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  }});
}