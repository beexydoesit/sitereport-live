// SiteReport.live live probe: GET /.netlify/functions/check?domain=example.com
const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const UA = "SiteReportBot/1.0 (+uptime check)";

async function probe(url) {
  const t0 = Date.now();
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(7000) });
  r.body?.cancel?.();
  return { ms: Date.now() - t0, code: r.status };
}

export default async (req) => {
  const d = (new URL(req.url).searchParams.get("domain") || "").trim().toLowerCase();
  if (!DOMAIN.test(d)) return Response.json({ error: "invalid domain" }, { status: 400 });

  let out = { domain: d, status: "offline", ms: null, ssl: false, code: null };
  try {
    const r = await probe(`https://${d}`);            // succeeds only with a valid cert
    out = { domain: d, status: r.code < 500 ? "online" : "offline", ms: r.ms, ssl: true, code: r.code };
  } catch {
    try {
      const r = await probe(`http://${d}`);
      out = { domain: d, status: r.code < 500 ? "online" : "offline", ms: r.ms, ssl: false, code: r.code };
    } catch { /* unreachable */ }
  }
  return Response.json(out, { headers: { "cache-control": "public, max-age=120" } });
};
