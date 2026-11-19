const DEFAULT_CONTENT = {
  quests: [
    {
      id: "q-spinner",
      title: "Spinning Part",
      steps: [
        { t: "Open the first link and stay on it", l: "https://example.com" },
        { t: "Open the second link and stay on it", l: "https://example.org" },
      ],
      g: "",
      script:
        'local part = script.Parent\nlocal speed = 90 -- degrees per second\n\ngame:GetService("RunService").Heartbeat:Connect(function(dt)\n\tpart.CFrame = part.CFrame * CFrame.Angles(0, math.rad(speed * dt), 0)\nend)',
    },
    {
      id: "q-lava",
      title: "Lava Brick",
      steps: [
        { t: "Open the first link and stay on it", l: "https://example.com" },
        { t: "Open the second link and stay on it", l: "https://example.org" },
      ],
      g: "",
      script:
        'local brick = script.Parent\n\nbrick.Touched:Connect(function(hit)\n\tlocal humanoid = hit.Parent:FindFirstChildOfClass("Humanoid")\n\tif humanoid then\n\t\thumanoid.Health = 0\n\tend\nend)',
    },
  ],
};async function passwordOk(given, secret) {
  if (!secret || !given) return false;
  const enc = new TextEncoder();
  const a = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(given)));
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(secret)));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function sanitize(input) {
  if (!input || !Array.isArray(input.quests)) return null;
  const quests = input.quests.slice(0, 50).map((q, n) => ({
    id: str(q?.id, 40) || "q" + n,
    title: str(q?.title, 200),
    steps: (Array.isArray(q?.steps) ? q.steps : []).slice(0, 2).map((s) => ({
      t: str(s?.t, 300),
      l: str(s?.l, 500),
    })),
    g: str(q?.g, 500),
    short: str(q?.short, 300),
    script: str(q?.script, 20000),
  }));
  return quests.length ? { quests } : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
    }export async function onRequest({ request: req, env }) {
  const kv = env.ART_KV;

  if (req.method === "GET") {
    const saved = await kv.get("content", "json");
    return json(saved ?? DEFAULT_CONTENT);
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (body?.action === "view" || body?.action === "unlock") {
    const id = str(body.id, 40);
    const content = (await kv.get("content", "json")) ?? DEFAULT_CONTENT;
    if (!id || !content.quests?.some((q) => q.id === id)) {
      return json({ error: "unknown_quest" }, 404);
    }
    try {
      const stats = (await kv.get("stats", "json")) ?? {};
      const s = stats[id] ?? { views: 0, unlocks: 0 };
      if (body.action === "view") s.views = (s.views || 0) + 1;
      else s.unlocks = (s.unlocks || 0) + 1;
      stats[id] = s;
      await kv.put("stats", JSON.stringify(stats));
    } catch {}
    return json({ ok: true });
  }

  if (!(await passwordOk(req.headers.get("x-admin-password"), env.ADMIN_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "unauthorized" }, 401);
  }
  if (body?.action === "check") return json({ ok: true });
  if (body?.action === "stats") {
    const stats = (await kv.get("stats", "json")) ?? {};
    return json({ stats });
  }
  if (body?.action === "save") {
    const clean = sanitize(body.content);
    if (!clean) return json({ error: "invalid_content" }, 400);
    await kv.put("content", JSON.stringify(clean));
    return json({ ok: true });
  }
  return json({ error: "bad_action" }, 400);
    }
