/**
 * mobile-audit.mjs —— 移动端适配体检（当前活跃任务：手机端「比例不适配」）
 *
 * 目的：在手机视口下量出「到底哪里不适配」，而不是凭感觉改 CSS。逐项输出：
 *   ① 横向溢出：documentElement.scrollWidth vs innerWidth，以及溢出元素清单
 *   ② 溢出元素：rect.right / rect.width 超过视口的元素（父级裁切前）
 *   ③ 关键排版：容器宽 / 内边距、各标题与数据卡的字号、栅格列定义
 *   ④ 区块几何：每个 section 的高度、是否内容被压扁
 *   ⑤ 截图：整页 + 逐区块
 *
 * 用法：node tools/probes/mobile-audit.mjs [端口|URL] [宽度] [高度] [dpr]
 *   例：node tools/probes/mobile-audit.mjs 5175 390 844 3
 *       node tools/probes/mobile-audit.mjs https://xiean-yongjiewujian.netlify.app/ 390 844 3
 * 前置：headless Edge --remote-debugging-port=9333；本地端口需 serve-main.mjs 在跑
 */
import { writeFileSync } from 'node:fs';

const TARGET = process.argv[2] || '5175';
const W = Number(process.argv[3] || 390);
const H = Number(process.argv[4] || 844);
const DPR = Number(process.argv[5] || 3);
const URL_PAGE = TARGET.startsWith('http') ? TARGET : `http://127.0.0.1:${TARGET}/`;
const TAG = TARGET.startsWith('http') ? 'live' : `p${TARGET}`;
const OUT = 'C:/Users/86137/AppData/Local/Temp';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page' && !t.url.startsWith('edge:'));
if (!page) throw new Error('找不到 page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pend.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (fn) => {
  const r = await send('Runtime.evaluate', { expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};
const shot = async (name, clip) => {
  const params = { format: 'png' };
  if (clip) params.clip = { ...clip, scale: 1 };
  else { params.captureBeyondViewport = true; }
  const r = await send('Page.captureScreenshot', params);
  const p = `${OUT}/${name}.png`;
  writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
};

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: URL_PAGE });
await sleep(4200);

/* 先把整页滚一遍，让所有 ScrollTrigger / 入场动画跑完，再看真实布局 */
for (let i = 0; i < 26; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(W / 2), y: Math.round(H / 2), deltaX: 0, deltaY: 420 });
  await sleep(90);
}
await sleep(1500);
await ev(() => { window.scrollTo(0, 0); return 0; });
await sleep(900);

const report = await ev(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    if (cls) s += '.' + cls;
    return s;
  };
  const all = [...document.querySelectorAll('body *')];
  const overflowers = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') continue;
    if (r.right > vw + 1 || r.width > vw + 1) {
      overflowers.push({
        el: desc(el),
        w: Math.round(r.width), right: Math.round(r.right), left: Math.round(r.left),
        overflowX: cs.overflowX,
        parent: el.parentElement ? desc(el.parentElement) : null,
      });
    }
  }
  const probe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { fs: cs.fontSize, lh: cs.lineHeight, w: Math.round(r.width), h: Math.round(r.height),
             pad: cs.paddingLeft + '/' + cs.paddingRight, cols: cs.gridTemplateColumns.split(' ').length + '×' + cs.gridTemplateColumns };
  };
  const sections = [...document.querySelectorAll('section[id]')].map((s) => {
    const r = s.getBoundingClientRect();
    return { id: s.id, top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
  });
  return {
    viewport: { vw, vh, dpr: window.devicePixelRatio },
    docScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth - vw,
    overflowCount: overflowers.length,
    overflowers: overflowers.slice(0, 24),
    keyType: {
      heroTitle: probe('.hero-title'),
      modeTitleCn: probe('.mode-title-cn'),
      modeTitleEn: probe('.mode-title-en'),
      modeDesc: probe('.mode-desc'),
      statValue: probe('.stat-card-value'),
      statLabel: probe('.stat-card-label'),
      statGrid: probe('.stat-grid'),
      dock: probe('.dock'),
      dockLink: probe('.dock a, .dock button'),
      loadoutTitle: probe('.loadout-title'),
      treasureGrid: probe('.treasure-grid'),
      closingTitle: probe('.closing-title'),
      closingLinkValue: probe('.closing-link-value'),
      container: probe('.container'),
    },
    sections,
    totalHeight: document.documentElement.scrollHeight,
  };
});

console.log(`\n===== 移动端体检 ${URL_PAGE} @ ${W}×${H} dpr${DPR} =====`);
console.log(`视口 ${report.viewport.vw}×${report.viewport.vh} dpr${report.viewport.dpr} ｜ 文档宽 ${report.docScrollWidth}（横向溢出 ${report.horizontalOverflow}px）｜ 整页高 ${report.totalHeight}`);
console.log(`溢出视口的元素：${report.overflowCount} 个`);
report.overflowers.forEach((o) => console.log(`  · ${o.el}  w=${o.w} left=${o.left} right=${o.right} overflowX=${o.overflowX} ← 父 ${o.parent}`));

console.log('\n关键排版：');
for (const [k, v] of Object.entries(report.keyType)) {
  if (!v) { console.log(`  ${k.padEnd(16)} —（不存在）`); continue; }
  console.log(`  ${k.padEnd(16)} 字号 ${String(v.fs).padEnd(10)} 行高 ${String(v.lh).padEnd(10)} 宽×高 ${v.w}×${v.h}  内边距 ${v.pad}  列 ${v.cols}`);
}

console.log('\n区块几何：');
report.sections.forEach((s) => console.log(`  ${s.id.padEnd(11)} top=${String(s.top).padStart(6)}  高 ${s.h}`));

const full = await shot(`mobile-${TAG}-full`);
console.log(`\n整页截图: ${full}`);
for (const s of report.sections) {
  const p = await shot(`mobile-${TAG}-${s.id}`, { x: 0, y: s.top, width: W, height: Math.min(s.h, 2400) });
  console.log(`  ${s.id.padEnd(11)} → ${p}（高 ${Math.min(s.h, 2400)}）`);
}
ws.close();
