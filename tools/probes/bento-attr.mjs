/* bento-attr.mjs —— 天选之人数据卡组「入场卡顿」的因子归因
 *   思路：不猜哪个因子贵，而是在页面里就地「中和」其中一个因子，再跑同一套逐帧采样。
 *     baseline  原样
 *     noBlur    吞掉 GSAP 写进 style.filter 的 blur（只影响本页实验，不改源码）
 *     noCount   吞掉计数卡内部每帧重写 textContent
 *   触发方式用真实 wheel（lenis smoothWheel 接手 → 原生 scroll → ScrollTrigger 与 IntersectionObserver 同时感知），
 *   避免上一版「程序化 jump 不产生 scroll 事件、ScrollTrigger 迟到 800ms」的测量假象。
 * 用法：node bento-attr.mjs [baseline|noBlur|noCount]
 */
const MODE = process.argv[2] || 'baseline';
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
const wheel = (dy) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 690, y: 400, deltaX: 0, deltaY: dy });
const KEY = '#tianxuan .magic-bento-card';

await send('Page.navigate', { url: URL_PAGE });
await sleep(2600);
for (let i = 0; i < 25; i++) { if (await ev(() => !!window.__lenis)) break; await sleep(300); }
await sleep(900);

/* 触发点：网格顶部 top 80% 视口 —— 与 revealCardGroup 的 ScrollTrigger 一致 */
const trig = await ev((sel) => {
  const el = document.querySelector(sel);
  const cards = [...document.querySelectorAll(sel)];
  const r = cards[0].getBoundingClientRect();
  return Math.round(window.scrollY + r.top - window.innerHeight * 0.8);
}, [KEY]);
await jump(trig - 60);
await sleep(1500);

/* 中和因子（纯页面内实验，不改源码） */
if (MODE === 'noBlur') {
  /* CSSStyleDeclaration 的 CSS 属性在本机 Chromium 里是「实例上的具名属性」，不是原型访问器
   * （CSSStyleDeclaration.prototype 上取不到 filter），所以按实例逐个 defineProperty 拦截。 */
  const r = await ev((sel) => {
    let n = 0;
    [...document.querySelectorAll(sel)].forEach((el) => {
      Object.defineProperty(el.style, 'filter', {
        configurable: true,
        get() { return this.getPropertyValue('filter'); },
        set(v) { const s = String(v); if (s.includes('blur')) { this.removeProperty('filter'); return; } this.setProperty('filter', s); },
      });
      n++;
    });
    return `${n} 张卡的 style.filter 写入已接管：blur 一律吞掉`;
  }, [KEY]);
  console.log('# 中和因子:', r);
} else if (MODE === 'willChange') {
  const r = await ev((sel) => {
    [...document.querySelectorAll(sel)].forEach((el) => { el.style.willChange = 'transform, opacity, filter'; });
    return '14 张卡已提前设 will-change: transform, opacity, filter';
  }, [KEY]);
  console.log('# 中和因子:', r);
} else if (MODE === 'noCardAnim') {
  /* 吞掉卡片自身的 transform / opacity 写入：卡片不再逐帧重绘，但 blur 与计数照旧 */
  const r = await ev((sel) => {
    const swallow = (el, prop) => {
      Object.defineProperty(el.style, prop, {
        configurable: true,
        get() { return this.getPropertyValue(prop); },
        set(v) { if (prop === 'transform') { this.setProperty('transform', 'translate(0px, 0px)'); return; } this.setProperty(prop, '1'); },
      });
    };
    let n = 0;
    [...document.querySelectorAll(sel)].forEach((el) => { swallow(el, 'transform'); swallow(el, 'opacity'); n++; });
    return `${n} 张卡的 transform/opacity 写入已接管（卡片不再位移/淡入）`;
  }, [KEY]);
  console.log('# 中和因子:', r);
} else if (MODE === 'noBlurCSS') {
  /* 用 CSS !important 覆盖 GSAP 的行内 blur（比接管 style.filter 更干净：不产生任何额外样式写入） */
  const r = await ev((sel) => {
    const s = document.createElement('style');
    s.textContent = `${sel} { filter: none !important; }`;
    document.head.appendChild(s);
    return '已注入 filter:none !important（行内 blur 被覆盖，卡片不再走 filter 图层）';
  }, [KEY]);
  console.log('# 中和因子:', r);
} else if (MODE === 'throttleCount') {
  /* 模拟「降频写入」修复：每张计数卡内部 textContent 重写限流到 ≤1 次 / 40ms */
  const r = await ev(() => {
    const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    const last = new Map();
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true,
      get: d.get,
      set(v) {
        const p = this.parentElement;
        if (p && p.closest('.stat-card')) {
          const k = this;
          const now = performance.now();
          if (now - (last.get(k) || 0) < 40) return;
          last.set(k, now);
        }
        d.set.call(this, v);
      },
    });
    return '计数卡内部 textContent 重写已限流到 ≤1 次/40ms/卡';
  });
  console.log('# 中和因子:', r);
} else if (MODE === 'noCount') {
  const r = await ev(() => {
    const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true, get: d.get,
      set(v) { const p = this.parentElement; if (p && p.closest('.stat-card')) return; d.set.call(this, v); },
    });
    return '计数卡内部的 textContent 每帧重写已被吞掉';
  });
  console.log('# 中和因子:', r);
} else {
  console.log('# 中和因子: 无（baseline）');
}

/* 逐帧采样（页面内纯 rAF；只读 inline style / textContent，不读几何，避免探针自身触发强制布局）
 * 注意：只注册「一条」rAF 链——上一版同时注册了两条，帧数被记成两倍，会污染计数类统计。 */
await ev((sel) => {
  const w = window;
  w.__probe = { n: 0, frames: [], marks: [], chains: 0 };
  const card = document.querySelector(sel);
  const numEl = card ? card.querySelector('.stat-card-value') : null;
  let last = 0;
  const tick = (ts) => {
    const p = w.__probe;
    if (last) {
      p.n++;
      p.frames.push([+(ts - p.t0).toFixed(1), +(ts - last).toFixed(1)]);
      p.marks.push([
        (card && card.style.filter) || '-',
        card ? (+getComputedStyle(card).opacity).toFixed(2) : '-',
        (numEl && numEl.textContent) || '-',
      ]);
    }
    last = ts;
    requestAnimationFrame(tick);
  };
  w.__probe.chains++;
  requestAnimationFrame((ts) => { w.__probe.t0 = ts; last = ts; requestAnimationFrame(tick); });
}, [KEY]);

await sleep(500);            /* 采一段基线（触发前） */
const pre = await ev(() => ({ n: window.__probe.n, chains: window.__probe.chains }));
await ev(() => { window.__probe.n = 0; window.__probe.frames.length = 0; window.__probe.marks.length = 0; window.__probe.t0 = performance.now(); });
await wheel(700);            /* 真实滚轮，跨过触发点 */
await sleep(3400);
const out = await ev(() => ({ frames: window.__probe.frames, marks: window.__probe.marks }));

const d = out.frames.map((f) => f[1]);
const sorted = [...d].sort((a, b) => a - b);
const q = (p) => +sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))].toFixed(1);
const over = (ms) => d.filter((x) => x > ms).length;
console.log(`\n── 逐帧（模式 ${MODE}）：触发前基线 n=${pre.n} 帧 ──`);
console.log(`  触发后 n=${d.length} 帧  p50=${q(0.5)}  p95=${q(0.95)}  max=${Math.max(...d).toFixed(1)}  >20ms=${over(20)}  >33ms=${over(33)}  >100ms=${over(100)}  >200ms=${over(200)}`);
console.log('  卡顿点时间线（相对触发，ms | 帧时长 | 卡0 filter | 卡0 opacity | 卡0 数字）:');
out.frames.forEach((f, i) => {
  if (f[1] > 33) { const m = out.marks[i] || []; console.log(`    t=${String(f[0]).padStart(6)}  Δ=${String(f[1]).padStart(6)}ms  ${m[0]}  op=${m[1]}  「${String(m[2]).slice(0, 12)}」`); }
});
/* 关键相位的边界（用 filter / 数字变化推断） */
const firstFilter = out.marks.findIndex((m) => m[0] && m[0] !== '-');
const lastFilter = out.marks.map((m) => m[0]).reduce((acc, v, i) => (v && v !== '-' ? i : acc), -1);
const firstNum = out.marks.findIndex((m, i) => m[2] !== '-' && i > 0 && m[2] !== out.marks[i - 1][2]);
const lastNumChange = out.marks.reduce((acc, m, i) => (i > 0 && m[2] !== out.marks[i - 1][2] ? i : acc), -1);
const tt = (i) => (i >= 0 ? out.frames[i][0] : '-');
console.log(`  相位：卡入场（filter 写入）t=${tt(firstFilter)} → t=${tt(lastFilter)}ms；数字滚动 t=${tt(firstNum)} → t=${tt(lastNumChange)}ms`);
ws.close();
