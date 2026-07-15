// Vercel Serverless Function — POST /api/counts  存盘点到 Supabase(poc_counts)
// env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "use POST" });
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return res.status(500).json({ ok: false, error: "未配置 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" });
    const b = req.body || {};
    if (!b.counter || !Array.isArray(b.rows) || !b.rows.length)
      return res.status(400).json({ ok: false, error: "counter + rows 必填" });
    const rows = b.rows.filter((r) => (+r.qty || 0) >= 0).map((r) => ({
      counter_code: b.counter,
      barcode: r.barcode || null,
      sku_name: r.skuName || null,
      location: r.location || "mixed",
      qty: Math.max(0, Math.round(+r.qty) || 0),
      source: b.source || "manual",
      confidence: r.confidence ?? null,
      counted_by: b.countedBy || null,
    }));
    const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/poc_counts", {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "Supabase " + r.status + ": " + (await r.text()).slice(0, 200) });
    return res.status(200).json({ ok: true, inserted: rows.length });
  } catch (e) { return res.status(500).json({ ok: false, error: (e && e.message) || "save failed" }); }
}
