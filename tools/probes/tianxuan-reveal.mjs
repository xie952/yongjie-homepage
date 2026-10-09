/* 天选卡组入场形态验证：确认 ①入场由「整个网格一次上浮淡入」承担 ②14 张卡自身不再被逐帧 transform
 * ③稳定态几何与改前一致、无裁切。用法：node tools/probes/tianxuan-reveal.mjs [port]
 * 依赖：已用 --remote-debugging-port 启动的 Edge（默认 9333）。 */
const PORT = process.argv[2] || '5175';
const CDP = process.env.CDP_PORT || 9333;
const URL_PAGE = `http://127.0.0.1:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = await import('node:fs');

const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && !t.url.startsWith('edge:'));
let id = 0; const pend = new Map();
const ws = new WebSocket(page.webSocketDebuggerUrl);
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
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const p = `C:/Users/86137/AppData/Local/Temp/${name}.png`;
  fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
  return p;
};
const jump = (y) => ev((v) => {
  const L = window.__lenis;
  if (L) { L.scrollTo(v, { immediate: true }); L.emit && L.emit(); }
  window.scrollTo(0, v);
  return Math.round(window.scrollY);
}, [y]);

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
/* 禁用 HTTP 缓存：否则同一端口换构建后会一直加载缓存的旧 index.html（旧资源哈希） */
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: URL_PAGE });
await sleep(3200);

const plan = await ev(() => {
  const grid = document.querySelector('#tianxuan .stat-grid');
  const sec = document.querySelector('#tianxuan');
  const gb = grid.getBoundingClientRect();
  return {
    gridTop: Math.round(gb.top + window.scrollY), gridBottom: Math.round(gb.bottom + window.scrollY),
    secTop: Math.round(sec.getBoundingClientRect().top + window.scrollY),
    cards: grid.children.length, innerH: window.innerHeight,
    gridAttrs: { rev: grid.getAttribute('data-reveal'), grp: grid.getAttribute('data-reveal-group') },
  };
});
console.log('几何：', JSON.stringify(plan));

const trig = plan.gridTop - Math.round(plan.innerH * 0.85);
await jump(trig - 120);
await sleep(900);
/* 采样：跨过触发点后每 60ms 读一次网格与 14 张卡的实际 transform/opacity */
const samples = [];
await jump(trig + 6);
for (let i = 0; i < 22; i++) {
  samples.push(await ev(() => {
    const g = document.querySelector('#tianxuan .stat-grid');
    const cards = [...g.children];
    const cs = getComputedStyle(g);
    const cardT = cards.map((c) => getComputedStyle(c).transform);
    return {
      op: +(+cs.opacity).toFixed(3), tf: cs.transform.replace(/matrix\(|\)/g, '').split(', ').slice(4).join(','),
      cardAnimated: cardT.filter((t) => t !== 'none').length,
      countText: cards[0].querySelector('.stat-card-value')?.textContent,
    };
  }));
  await sleep(60);
}
console.log('入场采样（每 60ms）：');
for (const [i, s] of samples.entries()) {
  console.log(`  t=${(i * 60).toString().padStart(3)}ms  网格 opacity=${String(s.op).padEnd(5)} 网格 translate=${s.tf.padEnd(10)} 被动画的卡片数=${s.cardAnimated}  首卡数字=${s.countText}`);
}
const mid = await shot('tianxuan-reveal-mid');
await sleep(2600);
const settled = await ev(() => {
  const g = document.querySelector('#tianxuan .stat-grid');
  const gb = g.getBoundingClientRect();
  const cs = getComputedStyle(g);
  const cards = [...g.children].map((c) => {
    const r = c.getBoundingClientRect(); const s = getComputedStyle(c);
    return { w: Math.round(r.width), h: Math.round(r.height), tf: s.transform, op: +(+s.opacity).toFixed(2) };
  });
  const texts = [...g.querySelectorAll('.stat-card-value')].map((e) => e.textContent.trim());
  return {
    grid: { top: Math.round(gb.top), bottom: Math.round(gb.bottom), w: Math.round(gb.width), transform: cs.transform, opacity: cs.opacity },
    cardCount: cards.length,
    cardTransformsAllNone: cards.every((c) => c.tf === 'none'),
    cardOpacityAllOne: cards.every((c) => c.op === 1),
    cardSizes: [...new Set(cards.map((c) => `${c.w}x${c.h}`))],
    values: texts.join(' '),
    rowTops: [...new Set(cards.map((c) => Math.round(c.y ?? 0)))].length,
  };
});
console.log('稳定态：', JSON.stringify(settled));
const after = await shot('tianxuan-reveal-settled');
console.log('截图：', mid, '|', after);
ws.close();
