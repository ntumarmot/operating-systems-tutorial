const { connect } = require('./cdp.js');
(async () => {
  const c = await connect(process.argv[2]); const base = process.argv[3];
  const routes = ['#/', '#/ch/ch0', '#/ch/ch1', '#/ch/ch2', '#/ch/ch3', '#/ch/ch4', '#/ch/ch5', '#/ch/ch6', '#/ch/ch7', '#/ch/ch8', '#/ch/ch9', '#/interview', '#/trace', '#/quiz', '#/wrong'];
  let fail = 0;
  for (const r of routes) {
    await c.navigate(base + '?noscroll&v=' + Date.now() + r, 1200);
    const info = await c.evaluate(`(function(){ const sims=document.querySelectorAll('.sim').length; const failed=[...document.querySelectorAll('.callout.warn')].filter(x=>/載入失敗|尚未實作/.test(x.textContent)).map(x=>x.textContent); const qs=document.querySelectorAll('.question').length; return {sims, failed, qs, title: document.title, h: document.body.scrollHeight}; })()`);
    const errs = c.errors();
    if (errs.length || (info.failed && info.failed.length)) fail++;
    console.log(r.padEnd(14), JSON.stringify(info), errs.length ? 'ERRORS: ' + errs.join(' | ') : '');
  }
  // 逐一敲每個 stepper 的 Next / 跳到最後 / 重設，以及所有 sim 內的按鈕（排除危險按鈕）
  for (const r of routes.slice(1, 11)) {
    await c.navigate(base + '?noscroll&v=' + Date.now() + r, 1000);
    const res = await c.evaluate(`(async function(){ let clicks=0; const btns=[...document.querySelectorAll('.sim button')].filter(b=>!b.disabled && !/自動播放|重設所有/.test(b.textContent)); for (const b of btns){ try{ b.click(); clicks++; }catch(e){ return {err:String(e), clicks}; } } await new Promise(r=>setTimeout(r,300)); const ends=[...document.querySelectorAll('.sim [data-act="end"]')]; ends.forEach(b=>b.click()); const nexts=[...document.querySelectorAll('.sim [data-act="reset"]')]; nexts.forEach(b=>b.click()); for(let k=0;k<3;k++){ document.querySelectorAll('.sim [data-act="next"]').forEach(b=>{ if(!b.disabled) b.click(); }); } return {clicks, ends: ends.length}; })()`);
    await new Promise(r => setTimeout(r, 2500));
    const errs = c.errors(); if (errs.length || res.err) fail++;
    console.log('interact', r.padEnd(10), JSON.stringify(res), errs.length ? 'ERRORS: ' + errs.join(' | ') : '');
  }
  // 每個 trace：點正確答案，確認動畫載入
  await c.navigate(base + '?v=' + Date.now() + '#/trace', 900);
  const ids = await c.evaluate(`TRACES.map(t=>t.id)`);
  for (const id of ids) {
    await c.navigate(base + '?v=' + Date.now() + '#/trace/' + id, 900);
    const res = await c.evaluate(`(async function(){ const t=TRACES.find(x=>x.id==='${id}'); document.querySelectorAll('#tr-opts .q-option')[t.answer].click(); await new Promise(r=>setTimeout(r,2500)); return { sims: document.querySelectorAll('#tr-anim .sim').length, res: document.querySelector('#tr-res').textContent.slice(0,12), failed: [...document.querySelectorAll('#tr-anim .callout.warn')].map(x=>x.textContent) }; })()`);
    const errs = c.errors(); if (errs.length || res.failed.length) fail++;
    console.log('trace', id.padEnd(14), JSON.stringify(res), errs.length ? 'ERRORS: ' + errs.join(' | ') : '');
  }
  // quiz：作答一題正確、一題錯誤，檢查 storage
  await c.navigate(base + '?v=' + Date.now() + '#/ch/ch1', 900);
  const qz = await c.evaluate(`(async function(){ const q=document.querySelector('.question'); const qid=q.dataset.qid; const Q=Quiz.findQuestion(qid); q.querySelectorAll('.q-option')[(Q.answer+1)%Q.options.length].click(); q.querySelector('.btn-primary').click(); await new Promise(r=>setTimeout(r,200)); const w=Storage.wrongList(); return { wrong: w.length, first: w[0] && w[0].qid, answered: Storage.overallStats().count, last: Storage.getLast() }; })()`);
  console.log('quiz/storage', JSON.stringify(qz));
  await c.navigate(base + '#/', 800);
  const dash = await c.evaluate(`document.querySelector('.stat-grid').textContent.replace(/\\s+/g,' ').slice(0,200)`);
  console.log('dashboard', dash, c.errors());
  await c.navigate(base + '#/wrong', 800); console.log('wrong page items', await c.evaluate(`document.querySelectorAll('.wrong-item').length`), c.errors());
  await c.navigate(base + '#/interview', 800); const iv = await c.evaluate(`(async function(){ document.getElementById('iv-a60').click(); document.getElementById('iv-hint').click(); await new Promise(r=>setTimeout(r,100)); return document.querySelectorAll('.answer-version').length; })()`); console.log('interview panels', iv, c.errors());
  await c.navigate(base + '#/quiz', 800); const qq = await c.evaluate(`(async function(){ document.getElementById('qz-start').click(); await new Promise(r=>setTimeout(r,200)); return document.querySelectorAll('#qz-area .question').length; })()`); console.log('quiz questions', qq, c.errors());
  console.log(fail ? 'SMOKE FAILURES: ' + fail : 'SMOKE ALL OK');
  c.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
