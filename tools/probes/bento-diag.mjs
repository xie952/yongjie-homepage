/* bento-diag.mjs —— 诊断：① 聚光元素为何不动（鼠标事件是否到达）② position:fixed 的包含块是否被祖先 transform 破坏
 * 用法：node bento-diag.mjs
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

await send('Page.navigate', { url: URL_PAGE });
await sleep(2600);
for (let i = 0; i < 25; i++) { if (await ev(() => !!window.__lenis)) break; await sleep(300); }
await sleep(800);
const grid = await ev(() => {
  const g = document.querySelector('#tianxuan .magic-bento-grid');
  return { top: Math.round(window.scrollY + g.getBoundingClientRect().top), h: Math.round(g.getBoundingClientRect().height) };
});
await ev((y) => { (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)) }, [grid.top - 300]);
await sleep(1500);

console.log('── 祖先 transform / 包含块 ──');
console.log(JSON.stringify(await ev(() => {
  const sp = document.querySelector('.global-spotlight');
  const out = { scrollY: window.scrollY, innerW: window.innerWidth, innerH: window.innerHeight, sp: null, chain: [] };
  if (sp) {
    const cs = getComputedStyle(sp);
    const r = sp.getBoundingClientRect();
    out.sp = { position: cs.position, transform: cs.transform, left: cs.left, top: cs.top, rectTop: +r.top.toFixed(1), rectLeft: +r.left.toFixed(1), parent: sp.parentElement?.tagName };
  }
  let el = document.body;
  while (el && el !== document.documentElement.parentElement) {
    const cs = getComputedStyle(el);
    const bad = [];
    if (cs.transform !== 'none') bad.push('transform=' + cs.transform.slice(0, 40));
    if (cs.filter !== 'none') bad.push('filter=' + cs.filter.slice(0, 30));
    if (cs.willChange !== 'auto') bad.push('willChange=' + cs.willChange);
    if (cs.contain !== 'none') bad.push('contain=' + cs.contain);
    if (cs.perspective !== 'none') bad.push('perspective=' + cs.perspective);
    if (bad.length) out.chain.push({ tag: el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''), bad });
    el = el.parentElement;
  }
  return out;
}, []), null, 1));

console.log('── 鼠标事件是否到达 document ──');
await ev(() => { window.__mv = 0; window.__mvd = []; document.addEventListener('mousemove', (e) => { window.__mv++; if (window.__mvd.length < 5) window.__mvd.push([e.clientX, e.clientY, e.target.className && String(e.target.className).slice(0, 40)]); }, true); });
const mrect = await ev(() => { const g = document.querySelector('#tianxuan .magic-bento-grid').getBoundingClientRect(); return { x: Math.round(g.left + g.width / 2), y: Math.round(g.top + g.height / 2), top: Math.round(g.top), bottom: Math.round(g.bottom), left: Math.round(g.left), right: Math.round(g.right) }; });
console.log('网格视口矩形:', JSON.stringify(mrect));
for (const dx of [0, 40, 80]) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mrect.x + dx, y: mrect.y, buttons: 0, pointerType: 'mouse' });
await sleep(400);
console.log(JSON.stringify(await ev(() => ({
  moves: window.__mv, sample: window.__mvd,
  spotlight: (() => { const sp = document.querySelector('.global-spotlight'); const cs = sp && getComputedStyle(sp); return sp ? { opacity: cs.opacity, left: cs.left, top: cs.top, rect: { l: +sp.getBoundingClientRect().left.toFixed(1), t: +sp.getBoundingClientRect().top.toFixed(1) } } : null })(),
  glow: (() => { const c = document.querySelector('#tianxuan .magic-bento-card'); const cs = c && getComputedStyle(c); return cs ? { x: cs.getPropertyValue('--glow-x').trim(), y: cs.getPropertyValue('--glow-y').trim(), i: cs.getPropertyValue('--glow-intensity').trim() } : null })(),
  lenis: { wrapper: window.__lenis?.options?.wrapper ? 'has-wrapper' : 'no-wrapper', props: window.__lenis ? Object.keys(window.__lenis.options || {}).slice(0, 12) : null },
})), null, 1));

console.log('── scrollY 与 fixed 元素的关系 ──');
console.log(JSON.stringify(await ev(() => {
  const sp = document.querySelector('.global-spotlight');
  const before = { scrollY: window.scrollY, spTop: +sp.getBoundingClientRect().top.toFixed(1) };
  window.scrollTo(0, window.scrollY + 400);
  const after = { scrollY: window.scrollY, spTop: +sp.getBoundingClientRect().top.toFixed(1) };
  return { before, after, delta: +(after.spTop - before.spTop).toFixed(1), docDelta: after.scrollY - before.scrollY };
}), null, 1));
ws.close();
