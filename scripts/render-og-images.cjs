// Dev-time helper: renders PNG versions of the project covers (link-preview crawlers and WeChat
// ignore SVG) plus the generic og-default.png. Output is committed under public/.
// Usage: PLAYWRIGHT=/path/to/playwright node scripts/render-og-images.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 675 } });
  for (const f of readdirSync('public/materials').filter(f => /^cover-.*\.svg$/.test(f))) {
    const svg = readFileSync(path.join('public/materials', f), 'utf8');
    await page.setContent(`<html><body style="margin:0"><img style="display:block;width:1200px;height:675px;object-fit:cover" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join('public/materials', f.replace(/\.svg$/, '.png')) });
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  const bunny = readFileSync('public/brand/bunny.png').toString('base64');
  await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 90px;box-sizing:border-box;font-family:-apple-system,'PingFang SC',sans-serif;background:radial-gradient(ellipse at 85% 10%,#e3d4fb,transparent 55%),radial-gradient(ellipse at 5% 95%,#dcefF6,transparent 50%),#f8f7fc">
    <img src="data:image/png;base64,${bunny}" style="width:260px;height:260px;object-fit:contain">
    <div><div style="font-size:30px;letter-spacing:6px;color:#9b8bae;font-weight:600">B.E.S.T</div><div style="font-size:64px;font-weight:700;color:#3b2c55;margin:18px 0 20px">项目推文</div><div style="font-size:30px;color:#7d6c93;line-height:1.5">教育创新项目 · 竞赛 · 科研 · 营地</div></div></body></html>`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'public/og-default.png' });
  await browser.close();
  console.log('OG images rendered');
})();
