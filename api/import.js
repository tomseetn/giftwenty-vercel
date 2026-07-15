// Vercel Serverless Function — POST /api/import  批量导入 opening/DO/return → Supabase
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "use POST" });
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      return res.status(500).json({ ok: false, error: "未配置 Supabase 环境变量" });
    const b = req.body || {};
    const type = b.type || "", counter = b.counter;
    if (!["opening", "do", "return"].includes(type) || !counter || !Array.isArray(b.rows) || !b.rows.length)
      return res.status(400).json({ ok: false, error: "type(opening/do/return) + counter + rows 必填" });
    const rows = b.rows.filter((r) => r.barcode).map((r) => ({
      counter_code: counter, barcode: String(r.barcode).trim(),
      sku_name: r.skuName || null, qty: Math.max(0, Math.round(+r.qty) || 0),
    }));
    if (!rows.length) return res.status(400).json({ ok: false, error: "无有效行" });
    let target, urlq = "", pref = "return=minimal";
    if (type === "opening") { target = "poc_system"; urlq = "?on_conflict=counter_code,barcode"; pref = "resolution=merge-duplicates,return=minimal"; }
    else if (type === "do") { target = "poc_do"; }
    else { target = "poc_return"; }
    const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + target + urlq, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
        "content-type": "application/json", prefer: pref,
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "Supabase " + r.status + ": " + (await r.text()).slice(0, 200) });
    return res.status(200).json({ ok: true, imported: rows.length, type });
  } catch (e) { return res.status(500).json({ ok: false, error: (e && e.message) || "import failed" }); }
}
