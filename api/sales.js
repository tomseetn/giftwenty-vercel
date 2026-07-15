// Vercel Serverless Function — POST /api/sales  存日销 → Supabase(poc_sales)
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "use POST" });
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return res.status(500).json({ ok: false, error: "未配置 Supabase 环境变量" });
    const b = req.body || {};
    if (!b.counter || !Array.isArray(b.rows) || !b.rows.length)
      return res.status(400).json({ ok: false, error: "counter + rows 必填" });
    const rows = b.rows.map((r) => ({
      counter_code: b.counter, barcode: r.barcode || null, sku_name: r.skuName || null,
      channel: b.channel || r.channel || "counter",
      qty: Math.max(0, Math.round(+r.qty) || 0),
      per_price_sen: Math.round(+r.perPriceSen) || 0,
      discount_pct: r.discountPct ?? 0,
      promo_disc_sen: Math.round(+r.promoDiscSen) || 0,
      net_price_sen: Math.round(+r.netPriceSen) || 0,
      location: r.location || null, source: b.source || "manual", counted_by: b.countedBy || null,
    }));
    const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/poc_sales", {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json", prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "Supabase " + r.status + ": " + (await r.text()).slice(0, 200) });
    return res.status(200).json({ ok: true, inserted: rows.length });
  } catch (e) { return res.status(500).json({ ok: false, error: (e && e.message) || "sales failed" }); }
}
