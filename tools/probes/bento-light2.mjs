/* bento-light2.mjs —— 聚光「剑光」偏移：修正版探针
 *   上一版把采样点放在视口外（y=848 > innerH=722），鼠标事件根本没送达 —— 那是测量方法的错。
 *   本版：先把数据卡网格滚到视口正中，再横扫，并区分「动图中的滞后」与「静止后的静态误差」。
 * 用法：node bento-light2.mjs
 */
const CDP = 'http://127.0.0.1:9333';
const URL_PAGE = 'http://127.0.0.1:5175/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch(`${CDP}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && !x.url.startsWith('edge:'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (fn, args = []) => {
  const r = await send('Runtime.evaluate', { expression: `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};
const mouse = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0, pointerType: 'mouse' });
const jump = (y) => ev((yy) => { (window.__lenis ? window.__lenis.scrollTo(yy, { immediate: true }) : window.scrollTo(0, yy)) }, [y]);
const read = (cx, cy) => ev((x, yy) => {
  const sp = document.querySelector('.global-spotlight');
  const r = sp.getBoundingClientRect();
  const cards = [...document.querySelectorAll('#tianxuan .magic-bento-card')];
  let hit = null;
  cards.forEach((c, i) => { const b = c.getBoundingClientRect(); if (x >= b.left && x <= b.right && yy >= b.top && yy <= b.bottom) hit = { i, b }; });
  const out = { cx: +(r.left + r.width / 2).toFixed(1), cy: +(r.top + r.height / 2).toFixed(1), op: +getComputedStyle(sp).opacity.slice(0, 5) };
  if (hit) {
    const cs = getComputedStyle(cards[hit.i]);
    out.card = hit.i;
    out.gx = cs.getPropertyValue('--glow-x').trim().slice(0, 6);
    out.gi = cs.getPropertyValue('--glow-intensity').trim().slice(0, 5);
    out.expX = (((x - hit.b.left) / hit.b.width) * 100).toFixed(1);
  }
  return out;
}, [cx, cy]);

await send('Page.navigate', { url: URL_PAGE });
await sleep(2600);
for (let i = 0; i < 25; i++) { if (await ev(() => !!window.__lenis)) break; await sleep(300); }
await sleep(800);

/* 1) 把网格滚到视口正中 */
const g = await ev(() => { const el = document.querySelector('#tianxuan .magic-bento-grid'); const r = el.getBoundingClientRect(); return { docTop: Math.round(window.scrollY + r.top), h: Math.round(r.height) }; });
await jump(g.docTop + Math.round(g.h / 2) - Math.round(722 / 2));
await sleep(1600);
const rect = await ev(() => { const r = document.querySelector('#tianxuan .magic-bento-grid').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
const y = Math.round((rect.top + rect.bottom) / 2);
console.log('网格视口矩形:', JSON.stringify(rect), ' innerH =', await ev(() => window.innerHeight), ' 采样 y =', y);

/* 2) 初始态：聚光元素在被第一次 mousemove 之前停在哪里？ */
console.log('── 首次 mousemove 之前的聚光位置（GSAP 从「静态位置」起算的证据） ──');
console.log(JSON.stringify(await ev(() => {
  const sp = document.querySelector('.global-spotlight');
  const cs = getComputedStyle(sp); const r = sp.getBoundingClientRect();
  return { cssLeft: cs.left, cssTop: cs.top, rectCenter: [+(r.left + r.width / 2).toFixed(1), +(r.top + r.height / 2).toFixed(1)], opacity: cs.opacity, scrollY: Math.round(window.scrollY), docH: Math.round(document.documentElement.scrollHeight) };
})));

/* 3) 静止对标：移动到某点后停 800ms —— 静态误差应为 0 */
const xA = Math.round(rect.left + 120);
await mouse(xA, y); await sleep(800);
const rest = await read(xA, y);
console.log('── 静止 800ms（静态误差） ── 光标 x =', xA, ' 光斑中心 =', rest.cx, ' 静态误差 =', (rest.cx - xA).toFixed(1), 'px  op =', rest.op, ' 悬停卡 =', rest.card, ' 卡内 --glow-x =', rest.gx, '% (期望', rest.expX + '%)', ' intensity =', rest.gi);

/* 4) 快速横扫：边走边采样（每步读一次 → 测「动图中的滞后」） */
console.log('── 横扫中的滞后（光标 x | 光斑中心 x | 滞后 = 光斑 − 光标） ──');
const xs = [];
for (let i = 0; i <= 20; i++) xs.push(Math.round(rect.left + 120 + ((rect.right - rect.left - 240) * i) / 20));
const during = [];
for (const x of xs) {
  await mouse(x, y);
  const r = await read(x, y);
  during.push({ x, cx: r.cx, d: +(r.cx - x).toFixed(1), op: r.op, gi: r.gi });
}
during.forEach((s) => console.log(`  cursor=${String(s.x).padStart(4)}  光斑x=${String(s.cx).padStart(7)}  滞后=${String(s.d).padStart(7)}px  op=${s.op}  --glow-intensity=${s.gi}`));
const maxD = during.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
console.log('  最大滞后:', maxD.d, 'px（光标 x =', maxD.x, '）');

/* 5) 急停追赶：把光标一步甩到最右，然后每 ~12ms 采样光斑位置，看收敛时间 */
const xEnd = Math.round(rect.right - 120);
await mouse(xEnd, y);
const curve = [];
for (let i = 0; i < 24; i++) { const r = await read(xEnd, y); curve.push({ t: i, cx: r.cx, d: +(r.cx - xEnd).toFixed(1) }); await sleep(12); }
console.log('── 急停追赶曲线（光标固定在 x =', xEnd, '） ──');
console.log('  ' + curve.map((c) => c.d).join(', '));
const settled = curve.findIndex((c) => Math.abs(c.d) < 1.5);
console.log('  采样序号(≈12ms/步) 归零于:', settled, ' ≈', settled * 12, 'ms；期间最大滞后', curve.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a)).d, 'px');

/* 6) 快速甩动：步间不读（贴近真实鼠标的快速划入），看光斑被甩开多远 */
const xB0 = Math.round(rect.left + 120), xB1 = Math.round(rect.right - 120);
const STEPS = 20;
const tb = Date.now();
for (let i = 0; i <= STEPS; i++) await mouse(Math.round(xB0 + ((xB1 - xB0) * i) / STEPS), y);
const burstMs = Date.now() - tb;
const justAfter = await read(xB1, y);
console.log(`── 快速甩动（${STEPS + 1} 步 / ${burstMs}ms ≈ ${Math.round((xB1 - xB0) / (burstMs / 1000))} px/s） ──`);
console.log('  甩动结束瞬间: 光标 x =', xB1, ' 光斑中心 x =', justAfter.cx.toFixed(1), ' 滞后 =', (justAfter.cx - xB1).toFixed(1), 'px');
const catchUp = [];
for (let i = 0; i < 14; i++) { const r = await read(xB1, y); catchUp.push(+(r.cx - xB1).toFixed(1)); await sleep(12); }
console.log('  追平曲线:', catchUp.join(', '));
ws.close();
