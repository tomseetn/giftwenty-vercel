// Vercel Serverless Function — GET /api/diff?counter=PS.1U  从 Supabase(poc_diff) 读差异
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "use GET" });
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return res.status(500).json({ ok: false, error: "未配置 Supabase 环境变量" });
    const counter = (req.query && req.query.counter) || "PS.1U";
    const url = process.env.SUPABASE_URL + "/rest/v1/poc_diff?counter_code=eq." + encodeURIComponent(counter) + "&select=*&order=barcode";
    const r = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "Supabase " + r.status + ": " + (await r.text()).slice(0, 200) });
    return res.status(200).json({ ok: true, rows: await r.json() });
  } catch (e) { return res.status(500).json({ ok: false, error: (e && e.message) || "diff failed" }); }
}
