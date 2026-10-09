/* scroll-jank.mjs —— 「滚动到天选之人卡组一带非常卡」的滚动期逐帧取证 + 因子归因
 *
 * 与 bento-attr.mjs 的区别：那份测「跨过触发点后的入场动画」，这份测「用真实滚轮缓慢滚过该区块」，
 * 并按滚动位置分桶，从而能回答：卡顿是持续整段，还是集中在某一小段（哪个板块）。
 *
 * 为什么要多轮（TRIALS）：单轮 max/长帧数抖动极大（同一 baseline 两次跑出 max 424ms 与 67ms），
 * 单轮结果无法归因。因此每个模式跑 N 轮（默认 3），每轮 = 重新加载 + 一次完整扫描
 * （卡片 ScrollTrigger 是 once:true，每轮加载只会入场一次），再比较：
 *   · stallMs  = 该轮所有帧超出基线节拍(6.1ms)的耗时总和（对「总卡顿量」最稳健的标量）
 *   · over33 / over100 = 掉帧与长停顿帧数
 *   · max / p95 = 最坏与尾部
 *
 * 采样原则（沿用本仓既有教训）：
 *   · 页面内只挂一条 rAF 链；
 *   · 滚动位置由 passive scroll 监听缓存，rAF 里只读缓存值，避免探针自己触发强制布局；
 *   · 用真实 wheel（Input.dispatchMouseEvent）而不是程序化 jump —— 后者不产生原生 scroll 事件，
 *     会让 ScrollTrigger / IntersectionObserver 迟到，测出来的是探针的错。
 *
 * 因子归因：每次只中和一个因子（CSS 覆盖优先，不接管 style.* setter —— 后者会反向制造噪声）。
 * 用法：node tools/probes/scroll-jank.mjs <mode> [trials]
 *   mode ∈ baseline | noBlurCSS | noCount | noEntrance | noTransform | noOpacity
 *        | noSpotlight | noAura | noRing | noImage | noSectionAura
 */
const MODE = process.argv[2] || 'baseline';
const TRIALS = Number(process.argv[3] || 3);
const CDP = 'http://127.0.0.1:9333';
const URL_PAGE = 'http://127.0.0.1:5175/';
const BASE_TICK = 6.1;                    /* 实测 rAF 基线节拍（≈164Hz） */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && !x.url.startsWith('edge:'));
if (!t) throw new Error('找不到 page target（是否只开了 edge:// 内部页？）');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
/* 必须关缓存：同一端口换构建后 Page.navigate 会命中缓存的旧 index.html（旧资源哈希），
   结果一直在量改前的产物（2026-01 实测踩过）。 */
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
const ev = async (fn, args = []) => {
  const r = await send('Runtime.evaluate', {
    expression: `(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')})`,
    returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};
const wheel = (dy) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 690, y: 400, deltaX: 0, deltaY: dy });

const FACTORS = {
  baseline: () => null,
  noBlurCSS: (css) => css('#tianxuan .magic-bento-card { filter: none !important; }'),
  noEntrance: (css) => css('#tianxuan .magic-bento-card { opacity: 1 !important; transform: none !important; filter: none !important; }'),
  noTransform: (css) => css('#tianxuan .magic-bento-card { transform: none !important; }'),
  noOpacity: (css) => css('#tianxuan .magic-bento-card { opacity: 1 !important; }'),
  noSpotlight: (css) => css('.global-spotlight { display: none !important; }'),
  noAura: (css) => css('#tianxuan .seg-aura { display: none !important; }'),
  noSectionAura: (css) => css('.seg-aura { display: none !important; }'),
  noRing: (css) => css('#tianxuan .magic-bento-card::after { display: none !important; }'),
  noImage: (css) => css('#tianxuan .magic-bento-card img, #tianxuan .stat-card img { visibility: hidden !important; }'),
  /* choreo 编排里天选卡组的三个可去项（见 src/lib/choreo.js buildTianxuan 458-477）：
     ① CARD_FROM/CARD_TO 的 filter: blur(6px)（= noBlurCSS）
     ② MagicBento 的 ::after 遮罩描边（= noRing）
     ③ 金色扫描线 .grid-scan（整幅渐变层 1.05s 横扫） */
  noScan: (css) => css('#tianxuan .grid-scan { display: none !important; }'),
  noBlurScanRing: (css) => css(
    '#tianxuan .magic-bento-card { filter: none !important; }'
    + ' #tianxuan .magic-bento-card::after { display: none !important; }'
    + ' #tianxuan .grid-scan { display: none !important; }'
  ),
  noBlurScan: (css) => css(
    '#tianxuan .magic-bento-card { filter: none !important; }'
    + ' #tianxuan .grid-scan { display: none !important; }'
  ),
  /* 只叠加：描边光晕 + 扫描线（用于判定入场 blur 这一项的独立贡献） */
  noRingScan: (css) => css(
    '#tianxuan .magic-bento-card::after { display: none !important; }'
    + ' #tianxuan .grid-scan { display: none !important; }'
  ),
  /* 只叠加：描边光晕 + 入场 blur（不带扫描线） */
  noBlurRing: (css) => css(
    '#tianxuan .magic-bento-card { filter: none !important; }'
    + ' #tianxuan .magic-bento-card::after { display: none !important; }'
  ),
  /* 候选修复组合（对应 §30.6 的 B1 + B2）：入场 blur 关掉 + 计数写入关掉 */
  b1b2: async (css) => {
    await css('#tianxuan .magic-bento-card { filter: none !important; }');
    return await ev(() => {
      const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(Node.prototype, 'textContent', {
        configurable: true, get: d.get,
        set(v) { const p = this.parentElement; if (p && p.closest('.stat-card')) return; d.set.call(this, v); },
      });
      return 'B1（关入场 blur）+ B2（计数不动画）';
    });
  },
  /* 「去掉某个大图层的绘制成本」——保留 JS 的逐帧写入，只让它不再需要被画/合成 */
  hideAura: (css) => css('.seg-aura { visibility: hidden !important; }'),
  hideChoreo: (css) => css('.choreo-char, .mode-head, .mode-title-en { visibility: hidden !important; }'),
  hideStatInner: (css) => css('#tianxuan .stat-card-label, #tianxuan .stat-card-value { visibility: hidden !important; }'),
  hideCards: (css) => css('#tianxuan .magic-bento-card { visibility: hidden !important; }'),
  containPaint: (css) => css('#tianxuan { contain: paint; } #tianxuan .magic-bento-card { contain: paint; }'),
  noBlendAura: (css) => css('.seg-aura { mix-blend-mode: normal !important; } .global-spotlight { display: none !important; }'),
  /* 针对 MagicBento.css 里三样「贵」的东西逐项关掉（隐藏卡片时热区完全干净，说明成本在卡面的绘制） */
  noRingContent: (css) => css('#tianxuan .magic-bento-card--border-glow::after { content: none !important; }'),
  noOverflowClip: (css) => css('#tianxuan .magic-bento-card { overflow: visible !important; border-radius: 0 !important; }'),
  willChangeComposite: (css) => css('#tianxuan .magic-bento-card { will-change: transform, opacity; backface-visibility: hidden; }'),
  /* 强制合成层 + 卡面绘制缓存：若成本来自「变换中的卡面每帧重光栅化」，这一项应显著降低 */
  composite: (css) => css('#tianxuan .magic-bento-card { will-change: transform, opacity; backface-visibility: hidden; contain: paint; }'),
  /* 叠加项：把描边光晕伪元素整块拿掉 + 卡片强制合成层（分别命中「光晕重光栅化」与「卡面重光栅化」两种机制） */
  noRingComposite: (css) => css('#tianxuan .magic-bento-card::after { display: none !important; } #tianxuan .magic-bento-card { will-change: transform, opacity; backface-visibility: hidden; }'),
  /* 网格整块位移会带着 14 张「带遮罩描边」的卡一起逐帧重光栅化（实测热区 stall 800ms 级）。
     把位移阉掉、只留 GSAP 的 opacity 淡入（inline transform 被 !important 覆盖，opacity 不受影响） */
  fadeOnly: (css) => css('#tianxuan .stat-grid { transform: none !important; }'),
  /* 同上，另外在大图层上声明 will-change: opacity，逼浏览器把它提升为合成层（淡入即可合成、不再重绘） */
  fadeOnlyWC: (css) => css('#tianxuan .stat-grid { transform: none !important; will-change: opacity; }'),
  /* 连淡入也不要（等价「该卡组不做入场动画」），用来量这一处的地板 */
  fadeNone: (css) => css('#tianxuan .stat-grid { transform: none !important; opacity: 1 !important; }'),
  /* 计数写入限频到 ~18Hz（视觉上仍是滚动数字，但每帧改写降到每秒 18 次） */
  countThrottle: async () => await ev(() => {
    const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    let last = 0;
    Object.defineProperty(Node.prototype, 'textContent', {
      configurable: true, get: d.get,
      set(v) {
        const p = this.parentElement;
        if (p && p.closest('.stat-card')) {
          const t = performance.now();
          if (t - last < 55) return;
          last = t;
        }
        d.set.call(this, v);
      },
    });
    return '计数写入限频 ~18Hz';
  }),
  /* 计数不动画 + 去掉遮罩描边（两者都去掉后，量「这一处还能剩多少」的地板） */
  noCountNoRing: async (css) => {
    await css('#tianxuan .magic-bento-card::after { display: none !important; } #tianxuan .stat-grid { transform: none !important; opacity: 1 !important; }');
    return await ev(() => {
      const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(Node.prototype, 'textContent', {
        configurable: true, get: d.get,
        set(v) { const p = this.parentElement; if (p && p.closest('.stat-card')) return; d.set.call(this, v); },
      });
      return '无入场 + 无计数 + 无遮罩描边';
    });
  },
  noCardPaint: (css) => css('#tianxuan .magic-bento-card { contain: layout style; } #tianxuan .magic-bento-card > .stat-card { will-change: auto; }'),  hideStatInner2: (css) => css('#tianxuan .stat-card-label, #tianxuan .stat-card-value { visibility: hidden !important; }'),
  /* 候选修复包：①卡片入场前就提升为合成层 ②去掉入场 blur（§30 的 B1）③入场期间不做计数动画（§30 的 B2） */
  fixAll: async (css) => {
    await css('#tianxuan .magic-bento-card { will-change: transform, opacity; backface-visibility: hidden; filter: none !important; }');
    return await ev(() => {
      const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      Object.defineProperty(Node.prototype, 'textContent', {
        configurable: true, get: d.get,
        set(v) { const p = this.parentElement; if (p && p.closest('.stat-card')) return; d.set.call(this, v); },
      });
      return '合成层 + 关入场 blur + 入场期不计数';
    });
  },
};

/* ── 单轮：重新加载 → 量几何 → 注入因子 → 采样 → 真实滚轮扫描 → 收数据 ── */
async function trial(MODE, URL_PAGE) {
  /* 关键：每次导航都禁用 HTTP 缓存。否则同一端口换构建后浏览器会拿缓存的旧 index.html
     （旧资源哈希），实测就一直在量改前的产物 —— 本 campaign 踩过这个坑。 */
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: URL_PAGE });
  await sleep(2600);
  for (let i = 0; i < 25; i++) { if (await ev(() => !!window.__lenis)) break; await sleep(300); }
  await sleep(1200);

  const plan = await ev(() => {
    const grid = document.querySelector('#tianxuan .stat-grid');
    const sec = document.getElementById('tianxuan');
    const g = grid ? grid.getBoundingClientRect() : { top: 0, bottom: 0 };
    const sections = [...document.querySelectorAll('section[id]')].map((s) => ({
      id: s.id,
      top: Math.round(window.scrollY + s.getBoundingClientRect().top),
      bottom: Math.round(window.scrollY + s.getBoundingClientRect().bottom),
    }));
    return {
      gridTop: Math.round(window.scrollY + g.top), gridBottom: Math.round(window.scrollY + g.bottom),
      secTop: sec ? Math.round(window.scrollY + sec.getBoundingClientRect().top) : null,
      secBottom: sec ? Math.round(window.scrollY + sec.getBoundingClientRect().bottom) : null,
      innerH: window.innerHeight, docH: document.documentElement.scrollHeight, sections,
      cards: document.querySelectorAll('#tianxuan .magic-bento-card').length,
    };
  });
  const startY = Math.max(0, Math.round(plan.gridTop - plan.innerH * 1.15));
  const endY = Math.min(plan.docH - plan.innerH, Math.round(plan.gridBottom + plan.innerH * 0.5));

  const css = (text) => ev((s) => { const e = document.createElement('style'); e.textContent = s; document.head.appendChild(e); return 'CSS 已注入'; }, [text]);
  const factor = FACTORS[MODE] ? await FACTORS[MODE](css) : null;

  await ev(() => {
    const w = window;
    w.__j = { frames: [], long: [], y: window.scrollY, chains: 0 };
    w.addEventListener('scroll', () => { w.__j.y = window.scrollY; }, { passive: true });
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__j.long.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)]); })
        .observe({ type: 'longtask', buffered: true });
    } catch (e) { w.__j.longErr = String(e); }
    let last = 0;
    const tick = (ts) => { const p = w.__j; if (last) p.frames.push([+(ts - last).toFixed(1), Math.round(p.y)]); last = ts; requestAnimationFrame(tick); };
    w.__j.chains++;
    requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(tick); });
  });
  await sleep(700);
  await ev(() => { const p = window.__j; p.frames.length = 0; p.long.length = 0; });

  const STEP = 60, INTERVAL = 140;                 /* 60px / 140ms ≈ 430px/s，接近人手滚轮节奏 */
  const est = Math.ceil((endY - startY) / STEP);
  await ev((y) => { (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)); }, [startY]);
  await sleep(900);
  await ev(() => { const p = window.__j; p.frames.length = 0; p.long.length = 0; });
  for (let i = 0; i < est; i++) { await wheel(STEP); await sleep(INTERVAL); }
  await sleep(900);

  const out = await ev(() => ({ frames: window.__j.frames, long: window.__j.long, chains: window.__j.chains }));
  const durs = out.frames.map((f) => f[0]);
  const BUCKET = 200;
  const buckets = new Map();
  for (const [d, y] of out.frames) { const k = Math.floor(y / BUCKET) * BUCKET; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(d); }
  const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
  const secOf = (y) => { const s = plan.sections.find((s) => y >= s.top && y < s.bottom); return s ? s.id : '—'; };
  const bucketsArr = [...buckets.entries()].map(([k, arr]) => ({
    y: k, sec: secOf(k + BUCKET / 2), n: arr.length, p50: q(arr, 0.5), p95: q(arr, 0.95),
    max: +Math.max(...arr).toFixed(1), over33: arr.filter((x) => x > 33).length, over100: arr.filter((x) => x > 100).length,
    excess: Math.round(arr.reduce((s, x) => s + Math.max(0, x - BASE_TICK), 0)),
  })).sort((a, b) => b.y - a.y);

  /* 热区（= 用户投诉的那一段）：天选区块进场到卡片网格顶部之后 100px */
  const bandLo = (plan.secTop ?? plan.gridTop - 700) + 50;
  const bandHi = plan.gridTop + 100;
  const bandFrames = out.frames.filter((f) => f[1] >= bandLo && f[1] <= bandHi).map((f) => f[0]);
  const band = bandFrames.length ? {
    n: bandFrames.length, p95: q(bandFrames, 0.95), max: +Math.max(...bandFrames).toFixed(1),
    over33: bandFrames.filter((x) => x > 33).length, over100: bandFrames.filter((x) => x > 100).length,
    stallMs: Math.round(bandFrames.reduce((s, x) => s + Math.max(0, x - BASE_TICK), 0)),
  } : null;

  return {
    plan, startY, endY, factor, bandLo, bandHi, band,
    frames: durs.length, chains: out.chains,
    p50: q(durs, 0.5), p95: q(durs, 0.95), max: +Math.max(...durs).toFixed(1),
    over33: durs.filter((x) => x > 33).length, over100: durs.filter((x) => x > 100).length,
    stallMs: Math.round(durs.reduce((s, x) => s + Math.max(0, x - BASE_TICK), 0)),
    long: out.long, buckets: bucketsArr,
  };
}

/* ── 多模式轮转（交错采样）：把待比较的模式按轮次交替跑，让机器漂移/外部干扰平均落到每个模式上。
 *    单模式一次性跑完会与「漂移」混淆 —— baseline 两次跑出 2129ms 与 900ms 就是这种假象。
 *    条目可写成 `模式@端口`（如 `before@5176`）来比较「两个构建」：同会话交错，环境完全一致。 ── */
const ENTRIES = (MODE.includes(';') || MODE.includes(',') ? MODE.split(/[;,]/) : [MODE])
  .map((s) => s.trim()).filter(Boolean)
  .map((s) => {
    const [mode, u] = s.split('@');
    return { mode: mode.trim(), url: u ? (u.startsWith('http') ? u : `http://127.0.0.1:${u.trim()}/`) : URL_PAGE };
  });

const seq = [];
/* 每轮把条目顺序轮换一格（rotation）：否则「某个固定的时间相位变差」会永远打在同一条目上，
   3 轮中位就会被这一相位污染（本 campaign 实测第 2 轮整体变差即为这种情况）。 */
for (let r = 0; r < TRIALS; r++) {
  const rot = r % ENTRIES.length;
  seq.push(...ENTRIES.slice(rot), ...ENTRIES.slice(0, rot));
}
const label = (e) => `${e.mode}@${(e.url.match(/:(\d+)/) || [, '5175'])[1]}`;

const runs = [];
console.log(`轮转顺序：${seq.map(label).join(' → ')}`);
for (let i = 0; i < seq.length; i++) {
  const e = seq[i];
  process.stdout.write(`[${i + 1}/${seq.length}] ${label(e)} … `);
  const r = await trial(e.mode, e.url);
  r.mode = e.mode; r.modeLabel = label(e); r.url = e.url;
  runs.push(r);
  console.log(`帧 ${r.frames}  p95 ${r.p95}  max ${r.max}  >33ms ${r.over33}  >100ms ${r.over100}  stall ${r.stallMs}ms`
    + (r.band ? `  ｜ 热区 y${r.bandLo}-${r.bandHi}: 帧${r.band.n} p95 ${r.band.p95} max ${r.band.max} >33ms ${r.band.over33} >100ms ${r.band.over100} stall ${r.band.stallMs}ms` : ''));
}
ws.close();

const P = runs[0].plan;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return +s[Math.floor(s.length / 2)].toFixed(1); };
console.log(`\n===== 交错采样（${ENTRIES.length} 条目 × ${TRIALS} 轮）=====`);
console.log(`扫描区间 y=${runs[0].startY} → ${runs[0].endY}｜热区 y=${runs[0].bandLo} → ${runs[0].bandHi}（天选区块 ${P.secTop}–${P.secBottom}，网格 ${P.gridTop}–${P.gridBottom}，${P.cards} 张卡，视口 ${P.innerH}，文档 ${P.docH}）`);
console.log(`  条目                  轮数  热区中位p95  热区中位max  热区中位stallMs  热区>100ms轮次  热区>33ms合计`);
for (const e of ENTRIES) {
  const rs = runs.filter((r) => r.modeLabel === label(e) && r.band);
  if (!rs.length) continue;
  console.log(`  ${label(e).padEnd(20)} ${String(rs.length).padStart(4)}  ${String(med(rs.map((r) => r.band.p95))).padStart(11)}  ${String(med(rs.map((r) => r.band.max))).padStart(11)}  ${String(med(rs.map((r) => r.band.stallMs))).padStart(15)}  ${String(rs.filter((r) => r.band.over100 > 0).length).padStart(13)}/${rs.length}  ${String(rs.reduce((s, r) => s + r.band.over33, 0)).padStart(12)}`);
}
console.log(`\n  （全程口径，供对照）`);
console.log(`  条目                  轮数  中位p95  中位max  中位stallMs  >100ms轮次  >33ms合计`);
for (const e of ENTRIES) {
  const rs = runs.filter((r) => r.modeLabel === label(e));
  if (!rs.length) continue;
  console.log(`  ${label(e).padEnd(20)} ${String(rs.length).padStart(4)}  ${String(med(rs.map((r) => r.p95))).padStart(6)}  ${String(med(rs.map((r) => r.max))).padStart(7)}  ${String(med(rs.map((r) => r.stallMs))).padStart(10)}  ${String(rs.filter((r) => r.over100 > 0).length).padStart(9)}/${rs.length}  ${String(rs.reduce((s, r) => s + r.over33, 0)).padStart(8)}`);
}

/* 最热桶（按各轮 excess 之和排序） */
const agg = new Map();
runs.forEach((r) => r.buckets.forEach((b) => {
  const k = b.y;
  if (!agg.has(k)) agg.set(k, { y: k, sec: b.sec, excess: 0, over33: 0, over100: 0, max: 0 });
  const a = agg.get(k); a.excess += b.excess; a.over33 += b.over33; a.over100 += b.over100; a.max = Math.max(a.max, b.max);
}));
const hot = [...agg.values()].sort((a, b) => b.excess - a.excess).slice(0, 6);
console.log('\n最热桶（全部轮次合计，按总超出耗时排序）：');
console.log('   桶 y    板块         合计超出ms  >33ms  >100ms   最大帧');
hot.forEach((h) => console.log(`  ${String(h.y).padStart(6)}  ${h.sec.padEnd(12)} ${String(h.excess).padStart(9)}  ${String(h.over33).padStart(5)} ${String(h.over100).padStart(6)}  ${String(h.max).padStart(7)}`));
