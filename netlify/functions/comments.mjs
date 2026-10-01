// Shared community reports for SiteReport.live
// GET  /.netlify/functions/comments?domain=temu.com   -> { comments: [...] }
// POST /.netlify/functions/comments  {domain,name,text,stars}
import { getStore } from "@netlify/blobs";

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const MAX = 200;              // keep newest 200 per site
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, n);

export default async (req) => {
  const store = getStore("comments");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const d = (url.searchParams.get("domain") || "").toLowerCase();
    if (!DOMAIN.test(d)) return Response.json({ comments: [] });
    const list = (await store.get(d, { type: "json" })) || [];
    return Response.json({ comments: list }, { headers: { "cache-control": "public, max-age=15" } });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }

    const d = String(body.domain || "").toLowerCase();
    const text = clean(body.text, 280);
    const name = clean(body.name, 40) || "Anonymous";
    const stars = Math.max(0, Math.min(5, parseInt(body.stars, 10) || 0));

    if (!DOMAIN.test(d)) return Response.json({ error: "bad domain" }, { status: 400 });
    if (text.length < 3) return Response.json({ error: "comment too short" }, { status: 400 });
    if (/https?:\/\/|www\.|\[url/i.test(text)) return Response.json({ error: "links are not allowed" }, { status: 400 });

    const list = (await store.get(d, { type: "json" })) || [];
    const now = Date.now();
    // simple flood guard: same text on the same site within 5 minutes
    if (list.some((c) => c.t === text && now - c.at < 300000)) {
      return Response.json({ error: "duplicate" }, { status: 429 });
    }
    list.push({ n: name, t: text, s: stars, at: now });
    await store.setJSON(d, list.slice(-MAX));
    return Response.json({ ok: true, comment: { n: name, t: text, s: stars, at: now } });
  }

  return Response.json({ error: "method not allowed" }, { status: 405 });
};
