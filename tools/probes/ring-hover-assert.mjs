/**
 * ring-hover-assert.mjs —— 描边光晕「按需存在」的 hover 断言
 *
 * 背景：`src/index.css` 把 `#tianxuan` 的卡面描边伪元素改成默认 `content: none`（不生成），
 * 只在 `.magic-bento-grid:hover` 时恢复 `content: ''`。本轮修复必须证明两件事：
 *   ① 指针不在卡组上时描边层真的不生成（省掉每帧重光栅化）；
 *   ② 指针进入卡组（悬停某张卡）时描边**照旧可见**，观感不退化。
 *
 * 注意：headless 下 `Input.dispatchMouseEvent` 能触发 JS 的 pointerenter（`--glow-intensity` 会变 1），
 * 但**不会**让 CSS `:hover` 生效，所以这里用 CDP 的 `CSS.forcePseudoState` 强制 `:hover` 再读 computed 值。
 *
 * 用法：node tools/probes/ring-hover-assert.mjs [端口，默认 5175]
 * 前置：serve-main.mjs（5175 伺服 dist/）+ headless Edge --remote-debugging-port=9333
 */
const PORT = Number(process.argv[2] || 5175);
const CDP = 'http://127.0.0.1:9333';

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (fn) => {
  const r = await send('Runtime.evaluate', {
    expression: `(${fn.toString()})()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
};

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.enable');
await send('DOM.enable');
await send('CSS.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1378, height: 722, deviceScaleFactor: 1, mobile: false,
});
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(3500);

/* 把卡组滚到视口中部 */
await ev(`
  () => {
    const g = document.querySelector('#tianxuan .magic-bento-grid');
    const y = window.scrollY + g.getBoundingClientRect().top - 120;
    window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y);
    return y;
  }
`);
await sleep(2600);   /* 等 choreo 的卡面入场跑完（0.8s 起 + 0.95s 落 + 错峰），否则截图抓到的是淡入中间态 */

const cardRect = await ev(`
  () => {
    const c = document.querySelector('#tianxuan .magic-bento-card--border-glow');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width, h: r.height };
  }
`);

const read = async (tag) => {
  const v = await ev(`
    () => {
      const card = document.querySelector('#tianxuan .magic-bento-card--border-glow');
      const a = getComputedStyle(card, '::after');
      return {
        glowIntensity: card.style.getPropertyValue('--glow-intensity'),
        content: a.content, display: a.display,
        bgFirstStop: (a.backgroundImage.match(/rgba?\\([^)]*\\)/) || [''])[0],
        maskComposite: a.maskComposite,
      };
    }
  `);
  console.log(`【${tag}】`, JSON.stringify(v));
  return v;
};

/* ① 指针不在卡组上 */
console.log('① 指针不在卡组上（默认态）');
const idle = await read('默认');

/* ② 真实指针移入卡片（JS 侧：--glow-intensity → 1） */
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cardRect.x, y: cardRect.y, buttons: 0 });
await sleep(400);
console.log(`② 指针移到卡片中心 (${cardRect.x}, ${cardRect.y})`);

/* ③ 用 CDP 强制 grid 的 :hover（headless 下鼠标事件不产生 CSS :hover），读 computed content */
const docRoot = await send('DOM.getDocument', { depth: -1 });
const gridNode = await send('DOM.querySelector', {
  nodeId: docRoot.root.nodeId,
  selector: '#tianxuan .magic-bento-grid',
});
if (!gridNode.nodeId) throw new Error('找不到 #tianxuan .magic-bento-grid');
const nodeId = gridNode.nodeId;
await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
await sleep(300);
const hovered = await read('强制 :hover');

/* ④ 把指针真正移出卡组（headless 下鼠标事件本身也可能让 CSS :hover 生效，所以断言移出必须真的移开指针），
      再释放强制态 */
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 700, buttons: 0 });
await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
await sleep(400);
const released = await read('指针移出 + 释放 :hover');

/* ⑤ 各抓一张卡组截图（默认态 / hover 态），供人工比对描边观感 */
const shot = async (name) => {
  const g = await ev(`
    () => { const r = document.querySelector('#tianxuan .magic-bento-grid').getBoundingClientRect();
      /* Page.captureScreenshot 的 clip 用文档坐标，必须加上 scrollY，否则截到页面顶端 */
      return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }; }
  `);
  const png = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: g.x, y: g.y, width: g.width, height: g.height, scale: 1.25 },
  });
  const file = `C:\\Users\\86137\\AppData\\Local\\Temp\\${name}.png`;
  const { writeFileSync } = await import('node:fs');
  writeFileSync(file, Buffer.from(png.data, 'base64'));
  console.log(`   截图 ${file}  (${g.width}×${g.height} @1.25)`);
};
await shot('ring-idle');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cardRect.x, y: cardRect.y, buttons: 0 });
await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
await sleep(400);
await shot('ring-hover');
await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 700, buttons: 0 });

const okIdle = idle.content === 'none';
const okHover = hovered.content !== 'none' && /rgba\(\s*212\s*,\s*175\s*,\s*88\s*,\s*0\.8/.test(hovered.bgFirstStop);
const okRelease = released.content === 'none';

console.log('\n===== 断言 =====');
console.log(`① 默认态不生成描边层（content: none）           : ${okIdle ? '✓ 通过' : '✗ 失败'}`);
console.log(`② hover 态描边恢复且为可见金色（rgba(212,175,88,.8)）: ${okHover ? '✓ 通过' : '✗ 失败'}  ← content=${hovered.content} / 首色标=${hovered.bgFirstStop}`);
console.log(`③ 移出后回到不生成（content: none）              : ${okRelease ? '✓ 通过' : '✗ 失败'}`);
if (!(okIdle && okHover && okRelease)) process.exitCode = 1;
ws.close();
