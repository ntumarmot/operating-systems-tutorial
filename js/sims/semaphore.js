/* ============================================================
   Ch5：Semaphore、Producer-Consumer、Readers-Writers、Dining Philosophers
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- Counting Semaphore：3 個資源、5 個 process ---------- */
  S.semaphoreSim = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Counting Semaphore：3 個資源、5 個 process', '每個 process 用 <code>wait(S)</code> 要一個資源、<code>signal(S)</code> 歸還。看 S 的值、等待佇列、誰拿到資源。');
    const N = 3;
    el.innerHTML += `<div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:center">
        <div class="box" style="text-align:center;padding:10px 16px">Semaphore S<br><span class="sem-value" id="sm-val">${N}</span><div style="font-size:.7rem;color:var(--text-3)">= 還剩幾個資源</div></div>
        <div><div class="viz-label">資源</div><div class="res-pool" id="sm-res"></div></div>
        <div><div class="viz-label">S 的等待佇列（Blocked）</div><div class="queue" id="sm-wait"></div></div>
      </div></div>
      <div class="sim-controls" id="sm-ctl"></div>
      <div class="step-log" id="sm-log"></div><div class="sim-note" id="sm-note"></div>`;
    slot.appendChild(el);
    let st;
    const reset = () => { st = { val: N, res: Array(N).fill(null), wait: [], holding: {}, log: [] }; render(); };
    function wait(p) {
      st.val--; let msg = `${p} wait(S)：S = ${st.val + 1} → ${st.val}`;
      if (st.val < 0) { st.wait.push(p); msg += `　S < 0 → <b>${p} 進入等待佇列（Blocked）</b>。|S| = 等待的人數 = ${-st.val}`; }
      else { const k = st.res.indexOf(null); st.res[k] = p; st.holding[p] = k; msg += `　S ≥ 0 → ${p} 取得資源 R${k}`; }
      st.log.push(msg); render();
    }
    function signal(p) {
      const k = st.holding[p]; st.res[k] = null; delete st.holding[p]; st.val++;
      let msg = `${p} signal(S)：釋放 R${k}，S = ${st.val - 1} → ${st.val}`;
      if (st.val <= 0) { const w = st.wait.shift(); st.res[k] = w; st.holding[w] = k; msg += `　S ≤ 0 表示有人在等 → <b>叫醒 ${w}</b>，它直接取得 R${k}`; }
      st.log.push(msg); render();
    }
    function render() {
      el.querySelector('#sm-val').textContent = st.val; el.querySelector('#sm-val').style.color = st.val < 0 ? 'var(--danger)' : 'var(--accent-text)';
      el.querySelector('#sm-res').innerHTML = st.res.map((r, i) => `<div class="res ${r ? 'held' : ''}">R${i}${r ? '<br>' + r : ''}</div>`).join('');
      el.querySelector('#sm-wait').innerHTML = st.wait.length ? st.wait.map(w => `<span class="q-item wait">${w}</span>`).join('<span class="arrow">→</span>') : '<span class="q-empty">（空）</span>';
      el.querySelector('#sm-ctl').innerHTML = ['P1', 'P2', 'P3', 'P4', 'P5'].map(p => { const has = p in st.holding, waiting = st.wait.includes(p); return `<span class="q-item ${has ? 'run' : waiting ? 'wait' : ''}">${p} ${has ? `<button class="btn btn-sm" data-sig="${p}">signal()</button>` : waiting ? '等待中' : `<button class="btn btn-sm btn-primary" data-wait="${p}">wait()</button>`}</span>`; }).join('') + '<button class="btn btn-sm btn-ghost" id="sm-reset">↺</button>';
      el.querySelectorAll('[data-wait]').forEach(b => b.addEventListener('click', () => wait(b.dataset.wait)));
      el.querySelectorAll('[data-sig]').forEach(b => b.addEventListener('click', () => signal(b.dataset.sig)));
      el.querySelector('#sm-reset').addEventListener('click', reset);
      el.querySelector('#sm-log').innerHTML = st.log.length ? st.log.map((l, i) => `<div class="${i === st.log.length - 1 ? 'cur' : ''}">${l}</div>`).join('') : '<div>（按任一 process 的 wait()）</div>';
      el.querySelector('#sm-log').scrollTop = 1e6;
      el.querySelector('#sm-note').innerHTML = '<b>讀法：</b>S ≥ 0 時，S = 還能讓幾個 process 進來；S &lt; 0 時，|S| = 有幾個 process 在排隊。試試：P1、P2、P3 wait() → P4、P5 wait()（被擋）→ P2 signal() → 看誰被叫醒（FIFO：P4）。';
    }
    reset();
    if (o.script) { let k = 0; const t = setInterval(() => { if (k >= o.script.length) { clearInterval(t); return; } const [op, p] = o.script[k++]; op === 'wait' ? wait(p) : signal(p); }, 900); }
  };

  /* ---------- Producer-Consumer（Bounded Buffer） ---------- */
  S.producerConsumer = function (slot) {
    const N = 5;
    const el = U.simShell('Producer-Consumer：三個 semaphore 怎麼合作', `Buffer 大小 ${N}。按 Producer / Consumer 執行<b>一步</b>（每個 wait/signal 各算一步），看 <code>empty</code>、<code>full</code>、<code>mutex</code> 的值。`);
    const codeP = `// Producer
wait(empty);   // 有空位嗎？沒有就等
wait(mutex);   // 進入 buffer（互斥）
buffer[in] = item; in = (in+1) % N;
signal(mutex); // 離開 buffer
signal(full);  // 多了一個東西可以拿`;
    const codeC = `// Consumer
wait(full);    // 有東西嗎？沒有就等
wait(mutex);
item = buffer[out]; out = (out+1) % N;
signal(mutex);
signal(empty); // 多了一個空位`;
    el.innerHTML += `<div class="sim-split"><div id="pcs-cp">${U.code(codeP, { title: 'producer' })}</div><div id="pcs-cc">${U.code(codeC, { title: 'consumer' })}</div></div>
      <div class="sim-controls"><button class="btn btn-sm btn-primary" id="pcs-p">▶ Producer 下一步</button><button class="btn btn-sm btn-primary" id="pcs-c" style="background:var(--p2);border-color:var(--p2)">▶ Consumer 下一步</button><button class="btn btn-sm btn-ghost" id="pcs-reset">↺</button></div>
      <div class="viz"><div class="viz-row" style="justify-content:space-around;align-items:center">
        <div class="box" style="text-align:center">empty<br><span class="sem-value" id="pcs-e">${N}</span></div>
        <div class="box" style="text-align:center">full<br><span class="sem-value" id="pcs-f">0</span></div>
        <div class="box" style="text-align:center">mutex<br><span class="sem-value" id="pcs-m">1</span></div>
        <div><div class="viz-label">Buffer</div><div class="buffer" id="pcs-buf"></div><div style="font-size:.72rem;color:var(--text-3);margin-top:4px" id="pcs-io"></div></div>
      </div><div class="viz-row" style="margin-top:8px"><span class="q-item" id="pcs-sp"></span><span class="q-item" id="pcs-sc"></span></div></div>
      <div class="step-log" id="pcs-log"></div>`;
    slot.appendChild(el);
    let st;
    const reset = () => { st = { e: N, f: 0, m: 1, buf: Array(N).fill(null), in: 0, out: 0, pc: [0, 0], blocked: [null, null], item: 1, log: [] }; render(); };
    // 步驟：0 wait(sem1) 1 wait(mutex) 2 操作 3 signal(mutex) 4 signal(sem2)
    function step(who) {
      const isP = who === 0, pc = st.pc[who], name = isP ? 'Producer' : 'Consumer';
      if (st.blocked[who]) { // 重試被擋的 wait
        const s = st.blocked[who];
        if (st[s] > 0) { st[s]--; st.blocked[who] = null; st.pc[who] = pc + 1; st.log.push(`${name}：${s} 現在 > 0，wait(${s}) 通過 → ${s} = ${st[s]}`); }
        else st.log.push(`${name}：wait(${s}) 仍然被擋（${s} = 0），繼續等`);
        return render();
      }
      if (pc === 0) { const s = isP ? 'e' : 'f'; const nm = isP ? 'empty' : 'full'; if (st[s] > 0) { st[s]--; st.pc[who] = 1; st.log.push(`${name}：wait(${nm}) → ${nm} = ${st[s]}`); } else { st.blocked[who] = s; st.log.push(`${name}：wait(${nm})，但 ${nm} = 0 → <b>Blocked</b>（${isP ? 'buffer 滿了' : 'buffer 空的'}）`); } }
      else if (pc === 1) { if (st.m > 0) { st.m--; st.pc[who] = 2; st.log.push(`${name}：wait(mutex) → mutex = 0，進入 buffer`); } else { st.blocked[who] = 'm'; st.log.push(`${name}：wait(mutex)，mutex = 0（對方在 buffer 裡）→ <b>Blocked</b>`); } }
      else if (pc === 2) { if (isP) { st.buf[st.in] = 'i' + st.item++; st.log.push(`Producer：buffer[${st.in}] = ${st.buf[st.in]}，in → ${(st.in + 1) % N}`); st.in = (st.in + 1) % N; } else { const it = st.buf[st.out]; st.buf[st.out] = null; st.log.push(`Consumer：取出 buffer[${st.out}] = ${it}，out → ${(st.out + 1) % N}`); st.out = (st.out + 1) % N; } st.pc[who] = 3; }
      else if (pc === 3) { st.m++; st.pc[who] = 4; st.log.push(`${name}：signal(mutex) → mutex = 1`); }
      else { const s = isP ? 'f' : 'e'; const nm = isP ? 'full' : 'empty'; st[s]++; st.pc[who] = 0; st.log.push(`${name}：signal(${nm}) → ${nm} = ${st[s]}`); }
      render();
    }
    function render() {
      el.querySelector('#pcs-e').textContent = st.e; el.querySelector('#pcs-f').textContent = st.f; el.querySelector('#pcs-m').textContent = st.m;
      el.querySelector('#pcs-buf').innerHTML = st.buf.map((b, i) => `<div class="slot ${b ? 'full' : ''} ${i === st.in ? 'in' : ''} ${i === st.out ? 'out' : ''}">${b || ''}</div>`).join('');
      el.querySelector('#pcs-io').textContent = `in = ${st.in}（綠框）　out = ${st.out}（橘框）`;
      const stat = w => st.blocked[w] ? `<b style="color:var(--warn)">Blocked on ${({ e: 'empty', f: 'full', m: 'mutex' })[st.blocked[w]]}</b>` : ['下一步 wait', '下一步 wait(mutex)', '<b style="color:var(--success)">在 buffer 中</b>', '下一步 signal(mutex)', '下一步 signal'][st.pc[w]];
      el.querySelector('#pcs-sp').innerHTML = 'Producer：' + stat(0); el.querySelector('#pcs-sc').innerHTML = 'Consumer：' + stat(1);
      U.hlLines(el.querySelector('#pcs-cp .code-block'), [st.pc[0] + 2], st.pc[0] === 2 ? 'hl-run' : 'hl'); U.hlLines(el.querySelector('#pcs-cc .code-block'), [st.pc[1] + 2], st.pc[1] === 2 ? 'hl-run' : 'hl');
      el.querySelector('#pcs-log').innerHTML = st.log.length ? st.log.slice(-10).map((l, i, a) => `<div class="${i === a.length - 1 ? 'cur' : ''}">${l}</div>`).join('') : '<div>（開始吧：先按 Consumer，看它為什麼被擋）</div>';
      el.querySelector('#pcs-log').scrollTop = 1e6;
    }
    el.querySelector('#pcs-p').addEventListener('click', () => step(0)); el.querySelector('#pcs-c').addEventListener('click', () => step(1)); el.querySelector('#pcs-reset').addEventListener('click', reset);
    reset();
    el.insertAdjacentHTML('beforeend', '<div class="sim-note"><b>三個 semaphore 各管一件事：</b><code>empty</code>（空位數）擋住「滿了還要放」；<code>full</code>（物品數）擋住「空的還要拿」；<code>mutex</code> 擋住「兩個人同時動 buffer」。<br><b>常見考題：</b>把 producer 的 <code>wait(empty)</code> 和 <code>wait(mutex)</code> 對調會怎樣？→ buffer 滿時 producer 拿著 mutex 睡著，consumer 拿不到 mutex 也無法消費 → <b>deadlock</b>。</div>');
  };

  /* ---------- Readers-Writers ---------- */
  S.readersWriters = function (slot) {
    const el = U.simShell('Readers-Writers：多個 reader 可以一起，writer 要獨占', '第一個進來的 reader 幫大家鎖 <code>rw_mutex</code>，最後一個離開的 reader 負責解鎖。<code>read_count</code> 本身也是共享變數，所以要 <code>mutex</code> 保護。');
    const codeR = `// Reader
wait(mutex);
read_count++;
if (read_count == 1) wait(rw_mutex); // 第一個 reader 擋住 writer
signal(mutex);
/* 讀資料 */
wait(mutex);
read_count--;
if (read_count == 0) signal(rw_mutex); // 最後一個 reader 放行
signal(mutex);`;
    const codeW = `// Writer
wait(rw_mutex);
/* 寫資料 */
signal(rw_mutex);`;
    el.innerHTML += `<div class="sim-split"><div>${U.code(codeR, { title: 'reader' })}</div><div>${U.code(codeW, { title: 'writer' })}</div></div>
      <div class="sim-controls">
        <button class="btn btn-sm btn-primary" id="rw-rin">Reader 進入</button><button class="btn btn-sm" id="rw-rout">Reader 離開</button>
        <button class="btn btn-sm btn-primary" id="rw-win" style="background:var(--p2);border-color:var(--p2)">Writer 進入</button><button class="btn btn-sm" id="rw-wout">Writer 離開</button>
        <button class="btn btn-sm btn-ghost" id="rw-reset">↺</button></div>
      <div class="viz"><div class="viz-row" style="justify-content:space-around;align-items:center">
        <div class="box" style="text-align:center">read_count<br><span class="sem-value" id="rw-rc">0</span></div>
        <div class="box" style="text-align:center">rw_mutex<br><span class="sem-value" id="rw-rm">1</span></div>
        <div class="box" style="text-align:center">mutex<br><span class="sem-value">1</span></div>
        <div><div class="viz-label">共享資料區</div><div class="queue" id="rw-data"></div></div>
        <div><div class="viz-label">等待中</div><div class="queue" id="rw-wait"></div></div>
      </div></div><div class="step-log" id="rw-log"></div>`;
    slot.appendChild(el);
    let st;
    const reset = () => { st = { rc: 0, rw: 1, readers: 0, writer: false, waitR: 0, waitW: 0, log: [] }; render(); };
    const L = m => { st.log.push(m); render(); };
    el.querySelector('#rw-rin').addEventListener('click', () => {
      if (st.writer) { st.waitR++; return L('Reader：read_count 變 1 時要 wait(rw_mutex)，但 writer 持有 → <b>Reader 等待</b>'); }
      st.rc++; st.readers++; if (st.rc === 1) { st.rw = 0; L('第一個 Reader：read_count = 1 → wait(rw_mutex) 成功（rw_mutex = 0），從此 writer 進不來'); } else L(`Reader：read_count = ${st.rc}，不用再碰 rw_mutex，直接進去讀（多個 reader 共存）`);
    });
    el.querySelector('#rw-rout').addEventListener('click', () => {
      if (!st.readers) return; st.rc--; st.readers--;
      if (st.rc === 0) { st.rw = 1; let m = '最後一個 Reader 離開：read_count = 0 → signal(rw_mutex)'; if (st.waitW) { st.waitW--; st.writer = true; st.rw = 0; m += ' → 等待中的 Writer 被叫醒，進入'; } L(m); } else L(`Reader 離開：read_count = ${st.rc}`);
    });
    el.querySelector('#rw-win').addEventListener('click', () => {
      if (st.writer || st.rc > 0) { st.waitW++; return L(`Writer：wait(rw_mutex)，rw_mutex = 0（${st.writer ? '另一個 writer' : st.rc + ' 個 reader'} 在裡面）→ <b>Writer 等待</b>`); }
      st.writer = true; st.rw = 0; L('Writer：wait(rw_mutex) 成功 → 獨占資料區');
    });
    el.querySelector('#rw-wout').addEventListener('click', () => {
      if (!st.writer) return; st.writer = false; st.rw = 1; let m = 'Writer 離開：signal(rw_mutex)';
      if (st.waitR) { const n = st.waitR; st.waitR = 0; st.rc += n; st.readers += n; st.rw = 0; m += ` → ${n} 個等待的 reader 一起進入（read_count = ${st.rc}）`; }
      else if (st.waitW) { st.waitW--; st.writer = true; st.rw = 0; m += ' → 下一個 writer 進入'; }
      L(m);
    });
    el.querySelector('#rw-reset').addEventListener('click', reset);
    function render() {
      el.querySelector('#rw-rc').textContent = st.rc; el.querySelector('#rw-rm').textContent = st.rw;
      el.querySelector('#rw-data').innerHTML = (st.writer ? '<span class="q-item run" style="border-color:var(--p2)">Writer（獨占）</span>' : '') + Array.from({ length: st.readers }, (_, i) => `<span class="q-item run">Reader ${i + 1}</span>`).join('') || '<span class="q-empty">（空）</span>';
      el.querySelector('#rw-wait').innerHTML = Array.from({ length: st.waitR }, () => '<span class="q-item wait">R</span>').join('') + Array.from({ length: st.waitW }, () => '<span class="q-item wait">W</span>').join('') || '<span class="q-empty">（空）</span>';
      el.querySelector('#rw-log').innerHTML = st.log.length ? st.log.slice(-8).map((l, i, a) => `<div class="${i === a.length - 1 ? 'cur' : ''}">${l}</div>`).join('') : '<div>（試試：Reader 進入 ×2 → Writer 進入 → Reader 離開 ×2）</div>';
    }
    reset();
    el.insertAdjacentHTML('beforeend', '<div class="sim-note">這是「reader 優先」版本：只要一直有 reader 進來，writer 可能<b>永遠等不到</b>（starvation）。writer 優先版本則反過來。面試常問：「這個版本誰會餓死？」</div>');
  };

  /* ---------- Dining Philosophers ---------- */
  S.philosophers = function (slot) {
    const el = U.simShell('Dining Philosophers：五個人、五根筷子', '點哲學家拿起左邊筷子、再拿右邊；兩根都有才能吃。試試讓五個人<b>都先拿左邊</b>——就 deadlock 了。');
    el.innerHTML += `<div class="sim-controls">
        <label>解法 <select id="ph-mode"><option value="naive">無（每人先左後右）</option><option value="asym">奇偶不對稱（偶數先右）</option><option value="limit">最多 4 人同時入座</option></select></label>
        <button class="btn btn-sm" id="ph-all">全部拿左邊（製造 deadlock）</button>
        <button class="btn btn-sm btn-ghost" id="ph-reset">↺</button></div>
      <div class="viz philo"><svg viewBox="0 0 300 300" id="ph-svg"></svg></div>
      <div class="sim-controls" id="ph-btns"></div><div class="sim-note" id="ph-note"></div>`;
    slot.appendChild(el);
    const N = 5; let st;
    const reset = () => { st = { chop: Array(N).fill(null), has: Array.from({ length: N }, () => []), seated: 0, log: '' }; render(); };
    const mode = () => el.querySelector('#ph-mode').value;
    const left = i => i, right = i => (i + 1) % N;
    const firstChop = i => (mode() === 'asym' && i % 2 === 0) ? right(i) : left(i);
    const secondChop = i => firstChop(i) === left(i) ? right(i) : left(i);
    function pick(i) {
      const h = st.has[i];
      if (h.length === 2) { st.chop[left(i)] = null; st.chop[right(i)] = null; st.has[i] = []; if (mode() === 'limit') st.seated--; st.log = `哲學家 ${i} 吃完了，放下兩根筷子。`; return render(); }
      if (mode() === 'limit' && h.length === 0) { if (st.seated >= 4) { st.log = `哲學家 ${i} 想入座，但已經有 4 人在座 → 等待（這保證至少有一人能拿到兩根筷子）。`; return render(); } st.seated++; }
      const want = h.length === 0 ? firstChop(i) : secondChop(i);
      if (st.chop[want] != null) { st.log = `哲學家 ${i} 想拿筷子 ${want}，但被哲學家 ${st.chop[want]} 拿走了 → <b>等待</b>（拿著手上的不放：Hold and Wait）。`; return render(); }
      st.chop[want] = i; h.push(want); st.log = `哲學家 ${i} 拿起筷子 ${want}${h.length === 2 ? '，兩根都有 → <b>開始吃</b>' : ''}。`; render();
    }
    function render() {
      const svg = el.querySelector('#ph-svg'); const cx = 150, cy = 150, R = 105;
      let s = `<circle cx="${cx}" cy="${cy}" r="70" fill="var(--bg-alt)" stroke="var(--border-strong)"/>`;
      for (let i = 0; i < N; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / N, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        const eating = st.has[i].length === 2, waiting = st.has[i].length === 1;
        s += `<circle cx="${x}" cy="${y}" r="24" fill="${eating ? 'var(--success-soft)' : waiting ? 'var(--warn-soft)' : 'var(--surface)'}" stroke="${eating ? 'var(--success)' : waiting ? 'var(--warn)' : 'var(--border-strong)'}" stroke-width="2"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" fill="var(--text)">P${i}</text><text x="${x}" y="${y + 34}" text-anchor="middle" font-size="9" fill="var(--text-3)">${eating ? '吃' : waiting ? '等' : '想'}</text>`;
        const ca = a + Math.PI / N, chx = cx + 72 * Math.cos(ca), chy = cy + 72 * Math.sin(ca);
        const owner = st.chop[i];
        s += `<rect x="${chx - 4}" y="${chy - 12}" width="8" height="24" rx="2" transform="rotate(${ca * 180 / Math.PI + 90} ${chx} ${chy})" fill="${owner == null ? 'var(--text-3)' : U.pcolor(owner)}"/><text x="${chx}" y="${chy - 16}" text-anchor="middle" font-size="8" fill="var(--text-3)">c${i}</text>`;
      }
      svg.innerHTML = s;
      el.querySelector('#ph-btns').innerHTML = Array.from({ length: N }, (_, i) => `<button class="btn btn-sm ${st.has[i].length === 2 ? 'btn-success' : ''}" data-ph="${i}">P${i}：${st.has[i].length === 2 ? '吃完放下' : st.has[i].length === 1 ? '拿另一根' : '拿第一根'}</button>`).join('');
      el.querySelectorAll('[data-ph]').forEach(b => b.addEventListener('click', () => pick(+b.dataset.ph)));
      const dead = st.has.every(h => h.length === 1);
      el.querySelector('#ph-note').innerHTML = (dead ? '<b style="color:var(--danger)">Deadlock！</b>每個人手上一根、等右邊那根，右邊那根在鄰居手上，鄰居也在等……形成一個<b>環</b>（Circular Wait）。沒有人會放下筷子（No Preemption），所以永遠卡住。<br>' : '') + (st.log || '筷子 c<i>i</i> 在哲學家 P<i>i</i> 的左手邊（P<i>i</i> 的右邊筷子是 c<i>i+1</i>）。');
    }
    el.querySelector('#ph-all').addEventListener('click', () => { reset(); for (let i = 0; i < N; i++) pick(i); });
    el.querySelector('#ph-reset').addEventListener('click', reset); el.querySelector('#ph-mode').addEventListener('change', reset);
    reset();
  };
})(window.Sims);
