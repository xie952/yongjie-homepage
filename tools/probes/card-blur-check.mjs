/**
 * card-blur-check.mjs —— 天选卡面入场「不再经过 blur」的 computed 断言
 *
 * 依据：`src/lib/choreo.js` 的 buildTianxuan 改用天选专用常量 `txCardFrom/txCardTo`（不含 filter），
 * 而共享常量 `CARD_FROM/CARD_TO`（`src/lib/choreo.js:46-47`）带 `filter: 'blur(6px)'`（征神/档案仍在用）。
 * 本探针跨过触发点后逐 50ms 采样首卡与末卡的 computed `filter`，断言全程不出现 blur。
 *
 * 用法：node tools/probes/card-blur-check.mjs [端口，默认 5175]
 */
const PORT = Number(process.argv[2] || 5175);
const CDP = 'http://127.0.0.1:9333';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && !t.url.startsWith('edge:'));
if (!page) throw new Error('找不到 page target（是否只开了 edge:// 内部页？）');

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
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
};

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1378, height: 722, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(3500);

/* 停在触发点之前：让它「已经进入视口但还没触发」 */
const geom = await ev(`
  () => { const g = document.querySelector('#tianxuan .stat-grid');
    const r = g.getBoundingClientRect(); const top = window.scrollY + r.top;
    return { top, innerH: window.innerHeight, y: top - window.innerHeight * 0.92 }; }
`);
await ev(`() => { window.scrollTo(0, ${geom.y}); return window.scrollY; }`);
await sleep(1200);

const read = async () => ev(`
  () => { const cards = [...document.querySelectorAll('#tianxuan .stat-grid .magic-bento-card')];
    const f = (el) => getComputedStyle(el).filter;
    const op = (el) => getComputedStyle(el).opacity;
    return { n: cards.length, first: f(cards[0]), firstOp: op(cards[0]), last: f(cards[cards.length - 1]),
             anyBlur: cards.some((c) => f(c).includes('blur')) }; }
`);

console.log('触发前：', JSON.stringify(await read()));

/* 用真实滚轮跨过触发点（程序化 jump 不产生原生 scroll 事件，会让 ScrollTrigger 迟到） */
const seen = [];
const step = 60;
for (let i = 0; i < 26; i++) {
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 500, deltaX: 0, deltaY: step });
  await sleep(50);
  const s = await read();
  seen.push(s);
  if (i % 4 === 0 || s.anyBlur) {
    console.log(`  t=${(i + 1) * 50}ms  首卡 filter=${s.first}  opacity=${s.firstOp}  末卡 filter=${s.last}  任一卡有 blur=${s.anyBlur}`);
  }
}

const settled = await read();
await sleep(1200);
const final = await read();
console.log('稳定态：', JSON.stringify(final));

const anyBlurEver = seen.some((s) => s.anyBlur) || settled.anyBlur || final.anyBlur;
const allNone = final.first === 'none' && final.last === 'none';
console.log('\n===== 断言 =====');
console.log(`① 入场全程没有任何卡片进入 blur 图层: ${anyBlurEver ? '✗ 失败（仍出现 blur）' : '✓ 通过'}`);
console.log(`② 稳定态首/末卡 filter 均为 none    : ${allNone ? '✓ 通过' : '✗ 失败'}  (first=${final.first} / last=${final.last})`);
if (anyBlurEver || !allNone) process.exitCode = 1;
ws.close();
