// 常驻的无头浏览器，供一步一步地测网页用。浏览器和页面状态在多次调用之间保留。
//
// 启动（在装了 playwright 的目录里跑，后台运行）：
//   node ~/.claude/skills/product-test/scripts/pw-driver.js <run 目录>
//   输出 "ready <端口> <token>" 后就可以用了
//
// 每一步：把一段 async 代码发过去，可选顺手截图
//   curl -s "127.0.0.1:<端口>/run?t=<token>&ctx=phone&shot=03-结算页" --data-binary @- <<'EOF'
//   await page.goto('https://example.com'); await page.getByText('Sign up').click();
//   EOF
//   代码里能用 page、ctx；return 的值会打印出来。返回里还附带这一步的 console 报错、
//   4xx/5xx 请求、失败请求、弹窗和下载。
//
// 结束：curl -s "127.0.0.1:<端口>/close?t=<token>"（会把录屏写完）
//
// 环境变量：
//   PW_PORT=9355           端口
//   PW_EXE=<chrome 路径>    浏览器版本对不上时手动指定
//   PW_NO_FS_PICKER=1      删掉 showSaveFilePicker 等，让"另存为"退回普通下载（无头浏览器里原生保存框会被取消）
//   PW_VIDEO=0             不录屏
//   PW_LOCALE=zh-CN        页面语言，默认 zh-CN
//
// 两个上下文：desktop（1440×900）和 phone（iPhone SE，375×667，触屏）。
// phone 上点按用 page.touchscreen.tap(x, y)；page.mouse 发的是鼠标事件，不是触摸。
const path = require('path');
const http = require('http');
const crypto = require('crypto');

let pw;
try { pw = require(require.resolve('playwright', { paths: [process.cwd()] })); }
catch { console.error('当前目录找不到 playwright。先在临时目录里：npm i playwright && npx playwright install chromium'); process.exit(1); }
const { chromium, devices } = pw;

const RUN = path.resolve(process.argv[2] || '.');
const PORT = Number(process.env.PW_PORT || 9355);
const TOKEN = crypto.randomBytes(8).toString('hex');
const VIDEO = process.env.PW_VIDEO !== '0';

(async () => {
  let browser;
  try { browser = await chromium.launch({ headless: true, executablePath: process.env.PW_EXE || undefined }); }
  catch (e) { console.error('浏览器启动失败：' + e.message.split('\n')[0] + '\n试试 npx playwright install chromium，或用 PW_EXE 指定已有的 Chrome。'); process.exit(1); }

  const make = async (name, opts) => {
    const ctx = await browser.newContext({
      ...opts, acceptDownloads: true, locale: process.env.PW_LOCALE || 'zh-CN',
      ...(VIDEO ? { recordVideo: { dir: path.join(RUN, 'video-' + name), size: opts.viewport } } : {}),
    });
    if (process.env.PW_NO_FS_PICKER === '1') {
      await ctx.addInitScript(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; delete window.showDirectoryPicker; });
    }
    const page = await ctx.newPage();
    const log = [];
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) log.push(`console.${m.type()}: ${m.text().slice(0, 300)}`); });
    page.on('pageerror', e => log.push('pageerror: ' + e.message.slice(0, 300)));
    page.on('response', r => { if (r.status() >= 400) log.push(`http ${r.status()} ${r.request().method()} ${r.url().slice(0, 160)}`); });
    page.on('requestfailed', r => log.push(`failed ${r.url().slice(0, 160)} ${r.failure()?.errorText}`));
    page.on('dialog', d => { log.push(`dialog ${d.type()}: ${d.message()}`); d.dismiss(); });
    page.on('download', async d => {
      const p = path.join(RUN, `download-${name}-${d.suggestedFilename()}`);
      await d.saveAs(p); log.push('download saved: ' + p);
    });
    return { ctx, page, log };
  };

  const C = {
    desktop: await make('desktop', { viewport: { width: 1440, height: 900 } }),
    phone: await make('phone', { ...devices['iPhone SE'], viewport: { width: 375, height: 667 } }),
  };

  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.searchParams.get('t') !== TOKEN) { res.statusCode = 403; return res.end('bad token\n'); }
    let body = ''; for await (const ch of req) body += ch;
    if (u.pathname === '/close') {
      for (const c of Object.values(C)) await c.ctx.close();
      await browser.close(); res.end('closed\n'); process.exit(0);
    }
    const c = C[u.searchParams.get('ctx') || 'desktop'];
    if (!c) { res.statusCode = 400; return res.end('ctx 只能是 desktop 或 phone\n'); }
    const { page, ctx } = c; const out = []; const t0 = Date.now();
    try {
      const fn = new Function('page', 'ctx', `return (async () => { ${body} })()`);
      const r = await fn(page, ctx);
      if (r !== undefined) out.push('OUT: ' + (typeof r === 'string' ? r : JSON.stringify(r, null, 1)).slice(0, 5000));
    } catch (e) { out.push('ACTION ERROR: ' + e.message.split('\n')[0]); }
    out.push(`ms=${Date.now() - t0} url=${page.url()}`);
    const shot = u.searchParams.get('shot');
    if (shot) { const p = path.join(RUN, shot + '.png'); await page.screenshot({ path: p }); out.push('SHOT: ' + p); }
    out.push(c.log.length ? 'LOG:\n' + [...new Set(c.log.splice(0))].join('\n') : 'LOG: none');
    res.end(out.join('\n') + '\n');
  }).listen(PORT, '127.0.0.1', () => console.log(`ready ${PORT} ${TOKEN}`));
})();
