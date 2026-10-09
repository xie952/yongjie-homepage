/* 描边光晕（.magic-bento-card--border-glow::after）在「鼠标不在卡组上」时的真实状态。
   用途：判定 noRing（::after{display:none}）拿到的收益是不是「去掉一层看不见却仍要光栅化的遮罩层」。
   用法：node tools/probes/ring-check.mjs [port] */
const PORT = process.argv[2] || '5175';
const CDP = 'http://127.0.0.1:9333';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = await (await fetch(`${CDP}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && !x.url.startsWith('edge:'));
if (!t) throw new Error('找不到 page target');
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
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
const ev = async (fn) => {
  const r = await send('Runtime.evaluate', {
    expression: `(${fn.toString()})()`, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error('页面异常: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
};

const READ = () => {
  const c = document.querySelector('#tianxuan .magic-bento-card');
  if (!c) return { err: 'no card' };
  const cs = getComputedStyle(c);
  const a = getComputedStyle(c, '::after');
  return {
    自定义属性: {
      glowIntensity: JSON.stringify(cs.getPropertyValue('--glow-intensity')),
      glowX: JSON.stringify(cs.getPropertyValue('--glow-x')),
      glowY: JSON.stringify(cs.getPropertyValue('--glow-y')),
    },
    after: {
      display: a.display, content: a.content, opacity: a.opacity,
      maskComposite: a.maskComposite || a.webkitMaskComposite,
      bg: (a.backgroundImage || '').slice(0, 90),
      inset: `${a.top} ${a.right} ${a.bottom} ${a.left}`, padding: a.padding,
    },
    rect: (() => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
  };
};

await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(3000);
const before = await ev(READ);
console.log('① 干净加载、鼠标从未进入卡组：');
console.log(JSON.stringify(before, null, 2));

/* 把卡组滚到视口中部，再把鼠标移到第一张卡中心（真实 mousemove），看 hover 态差异 */
const r = await ev(() => {
  const c = document.querySelector('#tianxuan .magic-bento-card');
  c.scrollIntoView({ block: 'center' });
  const b = c.getBoundingClientRect();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
});
await sleep(900);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y, buttons: 0 });
await sleep(700);
const hovered = await ev(READ);
console.log('\n② 鼠标停在第一张卡上（hover 态）：');
console.log(JSON.stringify(hovered, null, 2));
