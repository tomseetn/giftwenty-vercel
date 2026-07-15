// Vercel Serverless Function — POST /api/ocr
// 拍照/货架图 → Claude vision → 结构化 {商品,数量,置信度}。密钥读 process.env.ANTHROPIC_API_KEY。
const SYSTEM = `你是零售库存盘点识别助手。用户给你一张【货架照片】或【手写盘点单】。
读出每个商品的「名称/货号」与「数量」。规则：
- 中文计数换算成阿拉伯数字：正=5, 正正=10, 廿=20, 卅=30。
- 涂改/模糊/看不清 → 仍给最可能值，但 confidence<0.6，并在 note 写「请核对」。
- 只输出 JSON：{"items":[{"barcode":string|null,"name":string,"qty":number,"confidence":number,"note":string|null}]}
- 读不到商品 → {"items":[]}。`;

// 非标条码兜底：扫码扫不出（条码印刷缺陷 / 自定义非标条码，如 Kickers KK02-KICW78665）时，改拍标签读 item code。
const LABEL_SYSTEM = `你是零售商品标签识别助手。用户给你一张【单个商品的价格标签 / 吊牌】照片。
这个商品的条码可能印刷模糊或是非标准条码扫不出，你要读出它的「货号 / item code」与「零售价」。规则：
- item code 通常是字母+数字组合（如 STM-931-188Z-01、KK02-KICW78665、CH-2205-BRN），标签上可能标注为 Art. No. / Style / 货号 / 型号 / Code。优先取这个。
- price 读零售价数字（马币 RM，只要数字）。若同时印了平日/周末或原价/特价，取主零售价，其余写进 note。
- barcode：条码下方那串纯数字若清晰也读出，否则 null。
- 模糊/看不清 → 仍给最可能值，但 confidence<0.6，note 写「请核对」。
- 只输出 JSON：{"itemCode":string|null,"barcode":string|null,"price":number|null,"confidence":number,"note":string|null}
- 完全读不到 → {"itemCode":null,"barcode":null,"price":null,"confidence":0,"note":"读不到，请重拍"}。`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "use POST" });
  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ ok: false, error: "未配置 ANTHROPIC_API_KEY" });
    const image = req.body && req.body.image;
    if (!image || typeof image !== "string") return res.status(400).json({ ok: false, error: "missing image" });
    const m = image.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return res.status(400).json({ ok: false, error: "image must be a base64 data URL" });
    const mediaType = m[1], b64 = m[2];
    const mode = (req.body && req.body.mode) === "label" ? "label" : "shelf";

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.OCR_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: mode === "label" ? LABEL_SYSTEM : SYSTEM,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: b64 } },
          { type: "text", text: mode === "label" ? "读出这个商品标签的 item code 和零售价，只回 JSON。" : "识别这张图里的商品与数量，只回 JSON。" },
        ] }],
      }),
    });
    if (!resp.ok) return res.status(502).json({ ok: false, error: "Claude API " + resp.status + ": " + (await resp.text()).slice(0, 300) });
    const data = await resp.json();
    const text = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = extractJson(text);
    if (mode === "label") {
      const p = parsed || {};
      const label = {
        itemCode: p.itemCode ? String(p.itemCode).trim() : null,
        barcode: p.barcode ? String(p.barcode).trim() : null,
        price: Number.isFinite(+p.price) ? +p.price : null,
        confidence: clamp01(+p.confidence),
        note: p.note ?? null,
      };
      return res.status(200).json({ ok: true, label, needsReview: label.confidence < 0.6 });
    }
    const items = (parsed && Array.isArray(parsed.items) ? parsed.items : []).map((it) => ({
      barcode: it.barcode ?? null,
      name: String(it.name ?? "").trim(),
      qty: Number.isFinite(+it.qty) ? Math.max(0, Math.round(+it.qty)) : 0,
      confidence: clamp01(+it.confidence),
      note: it.note ?? null,
    })).filter((it) => it.name);
    const lowConf = items.filter((i) => i.confidence < 0.6).length;
    return res.status(200).json({ ok: true, items, lowConf, needsReview: lowConf > 0 });
  } catch (e) { return res.status(500).json({ ok: false, error: (e && e.message) || "ocr failed" }); }
}

function extractJson(s) {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : s;
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b < 0) return null;
  try { return JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
}
function clamp01(n) { return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5; }
