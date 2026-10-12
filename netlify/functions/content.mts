import type { Config } from "@netlify/functions";
import { getStore, getDeployStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

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
};

function contentStore() {
  if (Netlify.context?.deploy?.context === "production") {
    return getStore({ name: "art-scripters", consistency: "strong" });
  }
  return getDeployStore("art-scripters");
}

function passwordOk(given: string | null): boolean {
  const secret = Netlify.env.get("ADMIN_PASSWORD");
  if (!secret || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function sanitize(input: any) {
  if (!input || !Array.isArray(input.quests)) return null;
  const quests = input.quests.slice(0, 50).map((q: any, n: number) => ({
    id: str(q?.id, 40) || "q" + n,
    title: str(q?.title, 200),
    steps: (Array.isArray(q?.steps) ? q.steps : []).slice(0, 2).map((s: any) => ({
      t: str(s?.t, 300),
      l: str(s?.l, 500),
    })),
    g: str(q?.g, 500),
    short: str(q?.short, 300),
    script: str(q?.script, 20000),
  }));
  return quests.length ? { quests } : null;
}

export default async (req: Request) => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  if (req.method === "GET") {
    const saved = await contentStore().get("content", { type: "json" });
    return json(saved ?? DEFAULT_CONTENT);
  }

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }

    // Public: count a view or an unlock (no password needed)
    if (body?.action === "view" || body?.action === "unlock") {
      const id = str(body.id, 40);
      const store = contentStore();
      const content: any = (await store.get("content", { type: "json" })) ?? DEFAULT_CONTENT;
      if (!id || !content.quests?.some((q: any) => q.id === id)) {
        return json({ error: "unknown_quest" }, 404);
      }
      const stats: any = (await store.get("stats", { type: "json" })) ?? {};
      const s = stats[id] ?? { views: 0, unlocks: 0 };
      if (body.action === "view") s.views = (s.views || 0) + 1;
      else s.unlocks = (s.unlocks || 0) + 1;
      stats[id] = s;
      await store.setJSON("stats", stats);
      return json({ ok: true });
    }

    // Everything below needs the admin password
    if (!passwordOk(req.headers.get("x-admin-password"))) {
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: "unauthorized" }, 401);
    }
    if (body?.action === "check") return json({ ok: true });
    if (body?.action === "stats") {
      const stats = (await contentStore().get("stats", { type: "json" })) ?? {};
      return json({ stats });
    }
    if (body?.action === "save") {
      const clean = sanitize(body.content);
      if (!clean) return json({ error: "invalid_content" }, 400);
      await contentStore().setJSON("content", clean);
      return json({ ok: true });
    }
    return json({ error: "bad_action" }, 400);
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config: Config = {
  path: "/api/content",
};
