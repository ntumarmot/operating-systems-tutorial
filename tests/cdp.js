// 極簡 CDP 客戶端：node cdp.js <port> 之後由 test 腳本 require
const http = require('http');
async function connect(port) {
  const list = await new Promise((res, rej) => http.get(`http://127.0.0.1:${port}/json`, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = {}; const events = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } else if (m.method) events.push(m); };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending[i] = res; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return { error: r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : JSON.stringify(r.result.exceptionDetails) }; return r.result.result.value; };
  const navigate = async (url, ms = 900) => { await send('Page.navigate', { url }); await new Promise(r => setTimeout(r, ms)); };
  const errors = () => { const out = events.filter(e => (e.method === 'Runtime.exceptionThrown') || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')).map(e => e.method === 'Runtime.exceptionThrown' ? (e.params.exceptionDetails.exception ? e.params.exceptionDetails.exception.description : e.params.exceptionDetails.text) : e.method === 'Log.entryAdded' ? e.params.entry.text : e.params.args.map(a => a.value || a.description).join(' ')); events.length = 0; return out; };
  const screenshot = async (file, w, h) => { if (w) await send('Emulation.setDeviceMetricsOverride', { width: w, height: h || 900, deviceScaleFactor: 1, mobile: w < 700 }); const r = await send('Page.captureScreenshot', { format: 'png' }); require('fs').writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
  return { send, evaluate, navigate, errors, screenshot, close: () => ws.close() };
}
module.exports = { connect };
