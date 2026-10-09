/* jank-what.mjs —— 「停顿发生时，页面上到底在写什么」：把长帧与同时发生的事件对齐
 *
 * 背景：scroll-jank.mjs 的交错采样已排除「卡片入场动画」这个嫌疑
 * （baseline 801ms / 关掉入场 575ms / 关 blur+计数 622ms 的中位 stallMs 同量级，且都仍有 >100ms 帧），
 * 且 PerformanceObserver('longtask') 全程 0 条 —— 主线程没有被 JS 长时间占用，
 * 说明停顿出在合成/光栅（GPU）侧。因此这一份探针记录的是「停顿那一刻页面在改什么」：
 *   · 每帧的 frame 时长 + 滚动位置（→ 定位长帧）
 *   · 长帧 ±80ms 窗口内的 inline style 写入 / class 变化（按元素描述聚合）
 *   · hero 的 WebGL 循环是否仍在渲染（__fluidDebug.draws 增量）—— 视口外的全屏 canvas 若仍在逐帧合成，是典型 GPU 争用源
 * 用法：node tools/probes/jank-what.mjs
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
const wheel = (dy) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 690, y: 400, deltaX: 0, deltaY: dy });

await send('Page.navigate', { url: URL_PAGE });
await sleep(2600);
for (let i = 0; i < 25; i++) { if (await ev(() => !!window.__lenis)) break; await sleep(300); }
await sleep(1200);

const plan = await ev(() => {
  const grid = document.querySelector('#tianxuan .stat-grid');
  const g = grid.getBoundingClientRect();
  return {
    gridTop: Math.round(scrollY + g.top), gridBottom: Math.round(scrollY + g.bottom),
    innerH: innerHeight, docH: document.documentElement.scrollHeight,
    sections: [...document.querySelectorAll('section[id]')].map((s) => ({ id: s.id, top: Math.round(scrollY + s.getBoundingClientRect().top), bottom: Math.round(scrollY + s.getBoundingClientRect().bottom) })),
    canvases: [...document.querySelectorAll('canvas')].map((c) => { const r = c.getBoundingClientRect(); return { cls: c.className || '(无)', w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height), pos: getComputedStyle(c).position, fixed: Math.round(r.top) }; }),
    fluid: !!window.__fluidDebug,
  };
});
const startY = Math.max(0, Math.round(plan.gridTop - plan.innerH * 1.15));
const endY = Math.min(plan.docH - plan.innerH, Math.round(plan.gridBottom + plan.innerH * 0.5));

await ev(() => {
  const w = window;
  const desc = (el) => {
    if (!el || !el.tagName) return '(文本)';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
    return s.slice(0, 56);
  };
  w.__w = { frames: [], styles: [], classes: [], draws: [], y: scrollY, cap: 40000 };
  w.addEventListener('scroll', () => { w.__w.y = scrollY; }, { passive: true });
  const mo = new MutationObserver((recs) => {
    const now = performance.now();
    for (const r of recs) {
      if (w.__w.styles.length + w.__w.classes.length > w.__w.cap) continue;
      if (r.attributeName === 'class') { if (w.__w.classes.length < 4000) w.__w.classes.push([+now.toFixed(1), desc(r.target), r.target.className.toString().slice(0, 90)]); }
      else { if (w.__w.styles.length < 30000) w.__w.styles.push([+now.toFixed(1), desc(r.target), String(r.target.getAttribute('style')).slice(0, 90)]); }
    }
  });
  mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  let last = 0;
  const tick = (ts) => {
    const p = w.__w;
    if (last) p.frames.push([+ts.toFixed(1), +(ts - last).toFixed(1), Math.round(p.y)]);
    if (w.__fluidDebug) p.draws.push([+ts.toFixed(1), w.__fluidDebug.draws, w.__fluidDebug.paused ? 1 : 0]);
    last = ts;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(tick); });
});
await sleep(700);
await ev((y) => { (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y)); }, [startY]);
await sleep(900);
await ev(() => { const w = window.__w; w.frames.length = 0; w.styles.length = 0; w.classes.length = 0; w.draws.length = 0; });

const STEP = 60, INTERVAL = 140;
const est = Math.ceil((endY - startY) / STEP);
for (let i = 0; i < est; i++) { await wheel(STEP); await sleep(INTERVAL); }
await sleep(900);

const out = await ev(() => ({
  frames: window.__w.frames, styles: window.__w.styles, classes: window.__w.classes,
  draws: window.__w.draws, fluid: window.__fluidDebug ? { draws: window.__fluidDebug.draws, paused: window.__fluidDebug.paused, canvasW: window.__fluidDebug.canvasW, canvasH: window.__fluidDebug.canvasH } : null,
}));
ws.close();

const secOf = (y) => { const s = plan.sections.find((s) => y >= s.top && y < s.bottom); return s ? s.id : '—'; };
const stalls = out.frames.filter((f) => f[1] > 33).sort((a, b) => b[1] - a[1]);
console.log(`\n===== 停顿发生时页面在写什么 =====`);
console.log(`扫描区间 y=${startY} → ${endY}｜帧 ${out.frames.length}｜>33ms 帧 ${stalls.length}｜>100ms 帧 ${stalls.filter((f) => f[1] > 100).length}`);
console.log(`总 inline style 写入 ${out.styles.length} 次，class 变化 ${out.classes.length} 次`);
console.log(`canvas：${JSON.stringify(plan.canvases)}`);
console.log(`fluid：${JSON.stringify(out.fluid)}`);
if (out.draws.length > 1) {
  const d0 = out.draws[0], d1 = out.draws[out.draws.length - 1];
  console.log(`WebGL 循环：扫描期 draws ${d0[1]} → ${d1[1]}（Δ${d1[1] - d0[1]}，跨 ${((d1[0] - d0[0]) / 1000).toFixed(1)}s）；paused 采样值集合 {${[...new Set(out.draws.map((d) => d[2]))].join(',')}}`);
}
const near = (arr, t0) => arr.filter((e) => e[0] > t0 - 80 && e[0] < t0 + 80);
console.log('\n最长的 8 个帧停顿，及其 ±80ms 窗口内的事件：');
for (const [ts, dur, y] of stalls.slice(0, 8)) {
  const nearStyles = near(out.styles, ts), nearClasses = near(out.classes, ts);
  const cnt = new Map();
  nearStyles.forEach((s) => cnt.set(s[1], (cnt.get(s[1]) || 0) + 1));
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}×${v}`).join('  ');
  console.log(`\n  ${String(dur).padStart(7)}ms  @y=${y}（${secOf(y)}）  t=${ts}ms`);
  console.log(`    style 写入 ${nearStyles.length} 次${top ? '：' + top : ''}`);
  if (nearClasses.length) console.log(`    class 变化：${nearClasses.map((c) => `${c[1]} → "${c[2]}"`).join(' | ').slice(0, 300)}`);
}
/* 整段扫描里 style 写入最密集的元素（谁在持续动画） */
const total = new Map();
out.styles.forEach((s) => total.set(s[1], (total.get(s[1]) || 0) + 1));
console.log('\n扫描期 style 写入次数最多的元素：');
[...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${String(v).padStart(6)} 次  ${k}`));
const cls = new Map();
out.classes.forEach((c) => cls.set(c[1] + ' → ' + c[2].slice(0, 40), (cls.get(c[1] + ' → ' + c[2].slice(0, 40)) || 0) + 1));
console.log('\n扫描期发生过的 class 变化：');
[...cls.entries()].slice(0, 12).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} 次  ${k}`));
