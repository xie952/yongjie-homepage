/* cdp-eval.mjs —— 在 CDP 页面里跑一段表达式并打印结果（复用的小工具）
 * 用法：node cdp-eval.mjs "expression"
 */
const CDP = 'http://127.0.0.1:9333';
const expr = process.argv[2];
const list = await (await fetch(`${CDP}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && !x.url.startsWith('edge:'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const pend = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
if (r.exceptionDetails) console.log('页面异常:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
else console.log(typeof r.result.value === 'string' ? r.result.value : JSON.stringify(r.result.value, null, 1));
ws.close();
