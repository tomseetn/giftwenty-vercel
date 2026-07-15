# giftwenty-vercel

Giftwenty 库存盘点 — Vercel 零配置部署（Phase 1）。承接：Mimo Solutions。

复用已在 Cloudflare 跑通的 POC：静态 `index.html`（扫码/拍照/手写/云端）+ `api/` serverless 函数（Claude vision OCR + Supabase 存/读）。

## 结构
```
index.html        ← POC 前端（扫码 ZXing、拍照 OCR、手写、☁️ 云端）
api/ocr.js        ← POST /api/ocr    拍照 → Claude vision
api/counts.js     ← POST /api/counts 存盘点 → Supabase poc_counts
api/diff.js       ← GET  /api/diff   读差异 ← Supabase poc_diff
package.json      ← type:module（Vercel 零配置识别 api/ 函数）
```

## 部署到 Vercel（首次）
1. 推到 GitHub（见下）。
2. Vercel → Add New → Project → Import 这个 repo。Framework Preset 选 **Other**（零配置，无需 build）。
3. Settings → Environment Variables 加三条（Production）：
   - `ANTHROPIC_API_KEY`（Claude）
   - `SUPABASE_URL` = https://ccrlzhugvrinynrefyqf.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY`（Supabase service_role · 加密）
4. Deploy。完成后 `https://<项目>.vercel.app` 即真机。

## 推到 GitHub（在 Mac 终端，本文件夹内）
```bash
cd "Giftwenty Sdn Bhd/code/giftwenty-vercel"
git init && git add -A && git commit -m "giftwenty stocktake POC on vercel"
# 在 github.com 新建空 repo giftwenty-vercel，然后：
git branch -M main
git remote add origin https://github.com/<你的用户名>/giftwenty-vercel.git
git push -u origin main
```

## 之后（Phase 2/3）
登录（Supabase Auth）、多专柜管理、促销员账号、CSV 导入现有 SQL、差异 PDF、排班（复用 MJC）。届时迁移到正式 Next.js（`giftwenty-admin`）。
