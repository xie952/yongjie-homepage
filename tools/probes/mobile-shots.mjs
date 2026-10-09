/**
 * mobile-shots.mjs —— 手机视口下逐区块截图（滚动方式改成 scrollTo，避免触屏模拟下 wheel 不生效）
 *
 * 背景教训：`Emulation.setTouchEmulationEnabled` 打开后，`Input.dispatchMouseEvent` 的
 * mouseWheel **不生效**，页面根本没滚动 → ScrollTrigger 不触发 → 入场动画停在 opacity:0，
 * 截出来的区块是空的（mobile-audit.mjs 第一次跑就踩了这个坑）。
 * 这里改用 `window.scrollTo` 逐步下滚（会产生原生 scroll 事件，ScrollTrigger 正常触发），
 * 再回到每个区块顶部用视口截图。
 *
 * 用法：node tools/probes/mobile-shots.mjs [端口|URL] [宽] [高] [dpr]
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
const ev = async (fn, args = []) => {
  const r = await send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`,
    returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};
const shotViewport = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = `${OUT}/${name}.png`;
  writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
};

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
await send('Page.navigate', { url: URL_PAGE });
await sleep(4000);

const geo = await ev(() => ({
  vw: window.innerWidth, vh: window.innerHeight,
  docH: document.documentElement.scrollHeight,
  sections: [...document.querySelectorAll('section[id]')].map((s) => {
    const r = s.getBoundingClientRect();
    return { id: s.id, top: Math.round(r.top + window.scrollY), h: Math.round(r.height) };
  }),
}));
console.log(`视口 ${geo.vw}×${geo.vh} ｜ 文档高 ${geo.docH} ｜ 区块 ${geo.sections.map((s) => s.id + '(' + s.h + ')').join(' ')}`);

/* 逐步下滚到底：每步 200px，等 90ms，共覆盖整页 → 让所有 ScrollTrigger 跑完 */
const yMax = geo.docH - geo.vh;
for (let y = 0; y <= yMax; y += 200) {
  await ev((yy) => { window.scrollTo(0, yy); return window.scrollY; }, [y]);
  await sleep(90);
}
await sleep(1200);

/* 回报各区块内容是否真的显形（opacity 应≈1） */
const revealState = await ev(() => {
  const pick = ['.hero-title', '#profile .profile-info', '#tianxuan .stat-grid .magic-bento-card',
    '#zhengshen .card-grid--3 > *', '#wujian .treasure-grid > *', '#contact .closing-title'];
  const out = {};
  for (const sel of pick) {
    const els = [...document.querySelectorAll(sel)].slice(0, 3);
    out[sel] = els.length ? els.map((e) => +getComputedStyle(e).opacity) : 'none';
  }
  return out;
});
console.log('显形状态(各选择器前 3 个元素的 opacity):', JSON.stringify(revealState));

/* 逐区块：滚到顶部 → 视口截图 */
const files = [];
for (const s of geo.sections) {
  await ev((yy) => { window.scrollTo(0, yy); return window.scrollY; }, [Math.max(0, s.top - 8)]);
  await sleep(800);
  const p = await shotViewport(`mobile-${TAG}-${s.id}`);
  files.push(`${s.id} → ${p}`);
}
console.log('\n逐区块视口截图：');
files.forEach((f) => console.log('  ' + f));

/* 另抓两张：首屏滚下一屏、天选卡组中段（最可能「比例不适配」的两处） */
await ev(() => { window.scrollTo(0, window.innerHeight * 0.9); return 0; });
await sleep(700);
console.log('  hero2 → ' + await shotViewport(`mobile-${TAG}-hero2`));
const tx = geo.sections.find((s) => s.id === 'tianxuan');
await ev((yy) => { window.scrollTo(0, yy); return 0; }, [tx.top + tx.h * 0.45]);
await sleep(800);
console.log('  tianxuan-mid → ' + await shotViewport(`mobile-${TAG}-tianxuan-mid`));
