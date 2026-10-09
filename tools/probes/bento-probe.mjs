/* bento-probe.mjs —— 天选之人数据卡组：① 入场卡顿逐帧取证 ② 聚光「剑光」偏移量化
 * 用法：node bento-probe.mjs [frames|traj|light|all]
 */
const MODE = process.argv[2] || 'all';
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
const jump = (y) => ev((yy) => { (window.__lenis ? window.__lenis.scrollTo(yy, { immediate: true }) : window.scrollTo(0, yy)) }, [y]);
const mouse = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0, pointerType: 'mouse' });

async function cleanLoad() {
  await send('Page.navigate', { url: URL_PAGE });
  await sleep(2600);
  for (let i = 0; i < 25; i++) { if (await ev(() => !!window.__lenis)) break; await sleep(300); }
  await sleep(800);
}
const GRID = '#tianxuan .magic-bento-grid';
const trigOf = (sel) => ev((s) => {
  const el = document.querySelector(s);
  return Math.round(window.scrollY + el.getBoundingClientRect().top - window.innerHeight * 0.8 + 2);
}, [sel]);

/* ── ① 入场卡顿：纯 rAF 帧间隔（页面内不读取任何几何，避免探针自身触发强制布局） ── */
async function phaseFrames() {
  await cleanLoad();
  const trig = await trigOf(GRID);
  await jump(trig - 120);
  await sleep(1200);
  await ev(() => {
    window.__rec = { on: true, t: [], mark: 0 };
    const tick = (now) => { window.__rec.t.push(now); if (window.__rec.on) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await sleep(300);                       // 基线窗口
  const jumpedAt = Date.now();
  await jump(trig + 4);
  await ev(() => { window.__rec.mark = performance.now() });
  await sleep(2600);
  const rec = await ev(() => { window.__rec.on = false; return window.__rec });
  const base = rec.t.filter((x) => x < rec.mark);
  const after = rec.t.filter((x) => x >= rec.mark);
  const d = (a) => a.slice(1).map((v, i) => +(v - a[i]).toFixed(1));
  const stat = (a) => {
    const s = [...a].sort((x, y) => x - y);
    if (!s.length) return null;
    return { n: s.length, p50: s[Math.floor(s.length * 0.5)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1], over20: s.filter((v) => v > 20).length, over33: s.filter((v) => v > 33).length };
  };
  const db = d(base), da = d(after);
  console.log('── ① 入场帧间隔（rAF delta, ms） ──');
  console.log('基线（触发前）:', JSON.stringify(stat(db)));
  console.log('触发后整体  :', JSON.stringify(stat(da)));
  const win = (t0, t1, label) => {
    const seg = [];
    for (let i = 1; i < after.length; i++) {
      if (after[i] >= rec.mark + t0 && after[i] < rec.mark + t1) seg.push(+(after[i] - after[i - 1]).toFixed(1));
    }
    console.log(`  ${label.padEnd(16)}`, JSON.stringify(stat(seg)));
  };
  win(0, 300, '0–300ms');
  win(300, 600, '300–600ms');
  win(600, 1000, '600–1000ms');
  win(1000, 1600, '1000–1600ms');
  win(1600, 2500, '1600–2500ms');
  console.log('触发后逐帧(前 120 帧):', da.slice(0, 120).join(','));
  return `jumpedAt=${jumpedAt}`;
}

/* ── ② 入场轨迹：卡片/网格的 filter·opacity·transform 逐帧 ── */
async function phaseTraj() {
  await cleanLoad();
  const trig = await trigOf(GRID);
  await jump(trig - 120);
  await sleep(1200);
  const t0 = await ev(() => performance.now());
  await jump(trig + 4);
  const rows = [];
  for (let i = 0; i < 90; i++) {
    const r = await ev((g) => {
      const grid = document.querySelector(g);
      const cards = [...grid.children];
      const c0 = cards[0], c13 = cards[cards.length - 1];
      const cs0 = getComputedStyle(c0);
      const num = document.querySelector('.stat-grid .count-up, .stat-grid span');
      return {
        t: +(performance.now()).toFixed(0),
        n: cards.length,
        f0: cs0.filter, o0: +(cs0.opacity), tr0: cs0.transform,
        o13: +getComputedStyle(c13).opacity,
        fx0: cs0.boxShadow.slice(0, 24),
        gridT: getComputedStyle(grid).transform,
        txt: (c0.textContent || '').replace(/\s+/g, ' ').slice(0, 26),
      };
    }, [GRID]);
    rows.push(r);
    await sleep(20);
  }
  console.log('── ② 入场轨迹（每 ~20ms 一行） ──');
  const start = rows[0].t;
  rows.forEach((r, i) => {
    if (i % 3 === 0 || i > rows.length - 4) console.log(`t+${String(r.t - start).padStart(4)}ms  filter=${r.f0.padEnd(12)} op0=${String(r.o0).padEnd(5)} op13=${String(r.o13).padEnd(5)}  tr=${r.tr0.slice(0, 42)}  | ${r.txt}`);
  });
  console.log('卡片数 =', rows[0].n);
}

/* ── ③ 剑光（全局聚光）偏移：真实鼠标移动事件 + 光标/光斑几何对比 ── */
async function phaseLight() {
  await cleanLoad();
  const trig = await trigOf(GRID);
  await jump(trig - 60);
  await sleep(1500);
  const geo = await ev((g) => {
    const grid = document.querySelector(g);
    const r = grid.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  }, [GRID]);
  const y = Math.round((geo.top + geo.bottom) / 2);
  console.log('── ③ 聚光偏移 ── 网格视口矩形:', JSON.stringify(geo), ' 采样高度 y =', y);

  const read = (cx, cy) => ev((x, yy) => {
    const sp = document.querySelector('.global-spotlight');
    const r = sp ? sp.getBoundingClientRect() : null;
    const cards = [...document.querySelectorAll('#tianxuan .magic-bento-card')];
    // 光标所在卡片
    let hit = null;
    cards.forEach((c, i) => { const b = c.getBoundingClientRect(); if (x >= b.left && x <= b.right && yy >= b.top && yy <= b.bottom) hit = { i, b }; });
    const out = { sp: r ? { cx: +(r.left + r.width / 2).toFixed(1), cy: +(r.top + r.height / 2).toFixed(1), w: r.width, op: +getComputedStyle(sp).opacity.slice(0, 5) } : null };
    if (hit) {
      const cs = getComputedStyle(cards[hit.i]);
      out.card = hit.i;
      out.gx = cs.getPropertyValue('--glow-x').trim();
      out.gy = cs.getPropertyValue('--glow-y').trim();
      out.gi = cs.getPropertyValue('--glow-intensity').trim();
      out.cardRect = { l: +hit.b.left.toFixed(1), t: +hit.b.top.toFixed(1), w: +hit.b.width.toFixed(1), h: +hit.b.height.toFixed(1) };
      // 期望的相对位置
      out.expX = (((x - hit.b.left) / hit.b.width) * 100).toFixed(1) + '%';
      out.expY = (((yy - hit.b.top) / hit.b.height) * 100).toFixed(1) + '%';
    }
    return out;
  }, [cx, cy]);

  // 先移动到第一张卡上，等它稳定
  const xs = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) xs.push(Math.round(geo.left + ((geo.right - geo.left) * i) / steps));
  await mouse(xs[0], y); await sleep(700);
  const hold = await read(xs[0], y);
  console.log('静止 700ms 后:', JSON.stringify(hold));

  // 匀速横扫（每步 ~16ms 的实时节奏由 CDP 往返近似），记录「扫描中」的光斑位置
  console.log('── 横扫中的偏移（光标 x → 光斑中心 x，偏移 = 光斑 − 光标） ──');
  const sweep = [];
  for (const x of xs) {
    await mouse(x, y);
    const r = await read(x, y);
    sweep.push({ x, spx: r.sp ? r.sp.cx : null, op: r.sp ? r.sp.op : null, card: r.card ?? null, gx: r.gx ?? null, expX: r.expX ?? null });
  }
  sweep.forEach((s) => console.log(`  cursor=${String(s.x).padStart(4)}  光斑中心x=${String(s.spx).padStart(7)}  偏移=${s.spx == null ? '—' : (s.spx - s.x).toFixed(1).padStart(7)}px  op=${s.op}  卡=${s.card}  --glow-x=${s.gx} (期望 ${s.expX})`));
  // 停在最右侧，观察归位时间
  await sleep(600);
  const done = await read(xs[xs.length - 1], y);
  console.log('停住 600ms 后:', JSON.stringify(done));
}

if (MODE === 'frames' || MODE === 'all') await phaseFrames();
if (MODE === 'traj' || MODE === 'all') await phaseTraj();
if (MODE === 'light' || MODE === 'all') await phaseLight();
ws.close();
