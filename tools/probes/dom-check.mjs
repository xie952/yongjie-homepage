/* 一次性 DOM 核对：天选区块里到底有哪些 .stat-grid、入场标记挂在谁身上。用法 node tools/probes/dom-check.mjs [port] */
const PORT = process.argv[2] || '5175';
const CDP = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const page = list.find((t) => t.type === 'page' && !t.url.startsWith('edge:'));
let id = 0; const pend = new Map();
const ws = new WebSocket(page.webSocketDebuggerUrl);
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise((res) => ws.addEventListener('open', res));
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, (m) => res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(3500);
const r = await send('Runtime.evaluate', {
  expression: `(() => {
    const flat = (n) => n.tagName.toLowerCase() + '|' + String(n.className).split(' ').join(',') + '|' + [...n.attributes].map(a => a.name + '=' + a.value).join(' ');
    const sec = document.getElementById('tianxuan');
    return [
      'script=' + ([...document.scripts].map(s => s.src).filter(Boolean).pop()),
      'sections=' + document.querySelectorAll('section[id]').length + ' tianxuan=' + !!sec,
      'gridCount=' + document.querySelectorAll('#tianxuan .stat-grid').length,
      'grid=' + (document.querySelector('#tianxuan .stat-grid') ? flat(document.querySelector('#tianxuan .stat-grid')) : 'none'),
      'docReveals=' + document.querySelectorAll('[data-reveal]').length,
      'docGroups=' + document.querySelectorAll('[data-reveal-group]').length,
      'docBound=' + document.querySelectorAll('[data-bound]').length,
      'heroReveal=' + (document.querySelector('[data-reveal="card"]') ? flat(document.querySelector('[data-reveal="card"]')) : 'none'),
      'revealsDump=' + [...document.querySelectorAll('[data-reveal]')].map(flat).join(' ;; '),
      'groupsDump=' + [...document.querySelectorAll('[data-reveal-group]')].map(flat).join(' ;; '),
      'gridOuterHead=' + document.querySelector('#tianxuan .stat-grid').outerHTML.slice(0, 260),
      'bentoGrids=' + [...document.querySelectorAll('.magic-bento-grid')].map(g => {
        const sec = g.closest('section[id]');
        return (sec ? sec.id : '?') + ' :: ' + String(g.className).split(' ').join(',') + ' :: '
          + [...g.attributes].map(a => a.name + '=' + a.value).filter(s => s.indexOf('style') !== 0).join(' ')
          + ' :: kids=' + g.children.length;
      }).join('\\n           '),
      'lenis=' + !!window.__lenis + ' gsap=' + !!window.gsap,
    ].join('\\n');
  })()`,
  returnByValue: true,
});
console.log(r.result.value);
ws.close();
