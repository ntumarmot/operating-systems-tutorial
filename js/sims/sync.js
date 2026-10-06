/* ============================================================
   Ch4：Race Condition、Mutex / Lock、Peterson's Solution
   ============================================================ */
(function (S) {
  const U = Util;
  const OPS = ['LOAD  reg, counter', 'ADD   reg, 1', 'STORE counter, reg'];

  /* ---------- Race Condition：counter++ 拆成三步，自己排交錯順序 ---------- */
  S.raceCondition = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Race Condition 實驗：counter++ 其實是三條指令', '<code>counter = 0</code>，Thread A 和 Thread B 各做一次 <code>counter++</code>。你來決定 CPU 下一步執行誰的指令。');
    el.innerHTML += `<div class="predict-slot"></div>
      <div class="sim-controls">
        <button class="btn btn-sm btn-primary" id="rc-a">▶ 執行 Thread A 的下一條</button>
        <button class="btn btn-sm btn-primary" id="rc-b" style="background:var(--p2);border-color:var(--p2)">▶ 執行 Thread B 的下一條</button>
        <button class="btn btn-sm" id="rc-seq">預設：A 全部跑完再 B</button>
        <button class="btn btn-sm" id="rc-bad">預設：交錯（A LOAD, B LOAD, …）</button>
        <button class="btn btn-sm btn-ghost" id="rc-reset">↺ 重設</button>
      </div>
      <div class="viz"><div class="viz-row" style="justify-content:space-between">
        <div class="box" style="text-align:center;padding:10px 18px"><div class="viz-label">共享記憶體</div>counter = <span class="sem-value" id="rc-mem">0</span></div>
        <div class="box"><div class="viz-label">Thread A 的暫存器</div>reg = <b id="rc-ra">?</b></div>
        <div class="box"><div class="viz-label">Thread B 的暫存器</div>reg = <b id="rc-rb">?</b></div>
      </div>
      <div class="interleave" style="margin-top:12px" id="rc-grid"></div></div>
      <div class="viz-label" style="margin-top:8px">執行順序（時間由上到下）</div><div class="step-log" id="rc-log"></div>
      <div class="sim-note" id="rc-note"></div>`;
    slot.appendChild(el);
    U.predict(el.querySelector('.predict-slot'), { q: '兩個 thread 各做一次 counter++，最後 counter 一定是 2 嗎？', options: ['一定是 2', '可能是 1 也可能是 2', '可能是 0'], answer: 1, explain: '往下做實驗就知道為什麼。' });
    let st;
    const reset = () => { st = { mem: 0, ra: null, rb: null, pa: 0, pb: 0, log: [] }; render(); };
    const exec = t => {
      const pc = t === 'A' ? st.pa : st.pb; if (pc >= 3) return;
      const regK = t === 'A' ? 'ra' : 'rb';
      if (pc === 0) st[regK] = st.mem; else if (pc === 1) st[regK] += 1; else st.mem = st[regK];
      st.log.push(`Thread ${t}: ${OPS[pc]}  →  ${pc === 2 ? 'counter = ' + st.mem : 'reg' + t + ' = ' + st[regK]}`);
      if (t === 'A') st.pa++; else st.pb++;
      render();
    };
    function render() {
      el.querySelector('#rc-mem').textContent = st.mem; el.querySelector('#rc-ra').textContent = st.ra == null ? '?' : st.ra; el.querySelector('#rc-rb').textContent = st.rb == null ? '?' : st.rb;
      el.querySelector('#rc-grid').innerHTML = `<div class="hdr"></div><div class="hdr ta">Thread A</div><div class="hdr tb">Thread B</div>` + OPS.map((op, i) => `<div class="hdr">${i + 1}</div><div class="op ${st.pa === i ? 'cur' : st.pa > i ? 'done' : ''}">${op}</div><div class="op ${st.pb === i ? 'cur' : st.pb > i ? 'done' : ''}">${op}</div>`).join('');
      el.querySelector('#rc-a').disabled = st.pa >= 3; el.querySelector('#rc-b').disabled = st.pb >= 3;
      el.querySelector('#rc-log').innerHTML = st.log.length ? st.log.map((l, i) => `<div class="${i === st.log.length - 1 ? 'cur' : ''}">${i + 1}. ${l}</div>`).join('') : '<div>（還沒執行任何指令）</div>';
      const done = st.pa >= 3 && st.pb >= 3;
      el.querySelector('#rc-note').innerHTML = done ? (st.mem === 2 ? '<b style="color:var(--success)">結果 counter = 2</b>：這次的順序剛好沒問題。但「剛好」不算對——換一種順序試試（按「交錯」）。' : `<b style="color:var(--danger)">結果 counter = ${st.mem}，少了一次！</b> 發生了什麼：兩個 thread 都在對方 STORE 之前就 LOAD 了舊值 0，各自加 1 之後都寫回 1——後寫的把先寫的蓋掉。<br>這就是 <b>Race Condition（競爭條件）</b>：最後結果取決於「誰先誰後」這種你控制不了的時序。同一段程式碼，有時對有時錯，而且錯的時候很難重現。<br><b>根本原因：</b>LOAD → ADD → STORE 這三步應該是「不可分割」的，但 CPU 隨時可能在中間被 timer interrupt 切走。`) : '執行到兩個 thread 都完成，看結果。';
    }
    el.querySelector('#rc-a').addEventListener('click', () => exec('A')); el.querySelector('#rc-b').addEventListener('click', () => exec('B'));
    el.querySelector('#rc-reset').addEventListener('click', reset);
    const play = seq => { reset(); let k = 0; const t = setInterval(() => { if (k >= seq.length) { clearInterval(t); return; } exec(seq[k++]); }, 500); };
    el.querySelector('#rc-seq').addEventListener('click', () => play('AAABBB'.split('')));
    el.querySelector('#rc-bad').addEventListener('click', () => play('ABABAB'.split('')));
    reset();
    if (o.script) setTimeout(() => play(o.script.split('')), 300);
  };

  /* ---------- Mutex / Lock：有鎖 vs 沒鎖 ---------- */
  S.mutexSim = function (slot) {
    const el = U.simShell('有 Lock vs 沒有 Lock：同一種交錯，結果差在哪', '兩邊都是「最壞的交錯順序」（A 剛 LOAD 就被切走）。左邊沒有鎖，右邊有鎖。逐步看 lock 到底擋住了什麼。');
    const code = `pthread_mutex_lock(&m);    // 進門：拿鎖，拿不到就等
counter++;                 //   ← Critical Section
pthread_mutex_unlock(&m);  // 出門：還鎖，叫醒等待者`;
    el.innerHTML += `${U.code(code, { title: '有鎖的版本' })}<div class="sim-split">
      <div><div class="sub-title"><b>沒有 Lock</b></div><div class="viz"><div class="kv"><span class="k">counter</span><span class="v" id="mx-n-mem">0</span><span class="k">Thread A</span><span class="v" id="mx-n-a">-</span><span class="k">Thread B</span><span class="v" id="mx-n-b">-</span></div></div></div>
      <div><div class="sub-title"><b>有 Lock（mutex）</b></div><div class="viz"><div class="kv"><span class="k">counter</span><span class="v" id="mx-l-mem">0</span><span class="k">lock 持有者</span><span class="v" id="mx-l-own">（沒人）</span><span class="k">等待 lock</span><span class="v" id="mx-l-wait">（沒人）</span><span class="k">Thread A</span><span class="v" id="mx-l-a">-</span><span class="k">Thread B</span><span class="v" id="mx-l-b">-</span></div></div></div>
    </div>`;
    slot.appendChild(el);
    const steps = [
      { n: [0, 'LOAD → regA=0', '-'], l: [0, 'A', '', 'lock() 成功 → 持有鎖', '-'], desc: 'Thread A 開始。左：直接 LOAD counter。右：先 <code>lock()</code>，鎖是空的，A 拿到。' },
      { n: [0, 'LOAD → regA=0', '-'], l: [0, 'A', '', 'LOAD → regA=0', '-'], desc: 'A 執行 LOAD（右邊是在鎖保護下）。' },
      { n: [0, '（被切走）regA=0', 'LOAD → regB=0'], l: [0, 'A', 'B', '（被切走）regA=0', 'lock() → 鎖被 A 拿走 → <b>Blocked</b>'], cls: 'warn', desc: '<b>Timer interrupt，切到 B。</b>左：B 也 LOAD 到 0（災難的開始）。右：B 呼叫 <code>lock()</code>，發現鎖在 A 手上 → B 進入 Waiting，<b>根本進不了 critical section</b>。' },
      { n: [0, '（被切走）regA=0', 'ADD → regB=1'], l: [0, 'A', 'B', 'ADD → regA=1', 'Blocked（等鎖）'], desc: '左：B 繼續 ADD。右：B 在睡，CPU 回到 A，A 做 ADD。' },
      { n: [1, '（被切走）regA=0', 'STORE → counter=1'], l: [1, 'A', 'B', 'STORE → counter=1', 'Blocked（等鎖）'], desc: '左：B STORE，counter=1。右：A STORE，counter=1。' },
      { n: [1, 'ADD → regA=1', '完成'], l: [1, '（沒人）', '', 'unlock() → 叫醒 B', 'Ready'], desc: '左：切回 A，A 用它手上<b>過期的</b> regA=0 繼續 ADD → 1。右：A <code>unlock()</code>，B 被叫醒。' },
      { n: [1, 'STORE → counter=1 ✗', '完成'], l: [1, 'B', '', '完成', 'lock() 成功 → LOAD → regB=<b>1</b>'], desc: '左：A STORE 1，<b>把 B 的結果蓋掉</b>，最後 counter=1。右：B 拿到鎖，此時才 LOAD，讀到的是<b>最新的</b> 1。' },
      { n: [1, '完成', '完成'], l: [2, '（沒人）', '', '完成', 'ADD → STORE → counter=2 ✓ → unlock()'], desc: '<b>結果：沒鎖 = 1（錯），有鎖 = 2（對）。</b><br><b>Lock 保護的到底是什麼？</b>不是「counter 這個變數」，而是「LOAD→ADD→STORE 這一段程式碼在任何時刻最多只有一個 thread 在裡面」。鎖把「三步」變成外人看起來的「一步」（原子性）。時序仍然可以任意交錯——但交錯只會發生在 critical section <b>之外</b>。' }
    ];
    U.stepper(el, steps, s => {
      el.querySelector('#mx-n-mem').textContent = s.n[0]; el.querySelector('#mx-n-a').innerHTML = s.n[1]; el.querySelector('#mx-n-b').innerHTML = s.n[2];
      el.querySelector('#mx-l-mem').textContent = s.l[0]; el.querySelector('#mx-l-own').textContent = s.l[1]; el.querySelector('#mx-l-wait').textContent = s.l[2] || '（沒人）'; el.querySelector('#mx-l-a').innerHTML = s.l[3]; el.querySelector('#mx-l-b').innerHTML = s.l[4];
    }, { autoMs: 1800 });
  };

  /* ---------- Peterson's Solution：兩個 process 逐步交錯 ---------- */
  S.peterson = function (slot) {
    const el = U.simShell("Peterson's Solution Simulator：你來安排 P0 / P1 的交錯", '每按一次就執行該 process 的<b>一行</b>。試著找出一種順序讓兩個 process 同時進入 critical section——你會發現辦不到。');
    const code = i => `// Process P${i}（j = ${1 - i}）
flag[${i}] = true;              // 1. 我想進去
turn = ${1 - i};                    // 2. 但先讓你
while (flag[${1 - i}] && turn == ${1 - i}) ; // 3. 你也想進、而且輪到你 → 我等
/* critical section */       // 4. 進入
flag[${i}] = false;             // 5. 我出來了
/* remainder section */      // 6.`;
    el.innerHTML += `<div class="sim-split"><div id="pt-c0">${U.code(code(0), { title: 'P0' })}</div><div id="pt-c1">${U.code(code(1), { title: 'P1' })}</div></div>
      <div class="sim-controls">
        <button class="btn btn-sm btn-primary" id="pt-s0">▶ P0 執行下一行</button>
        <button class="btn btn-sm btn-primary" id="pt-s1" style="background:var(--p2);border-color:var(--p2)">▶ P1 執行下一行</button>
        <button class="btn btn-sm" id="pt-worst">試試最壞交錯（兩邊同時想進）</button>
        <button class="btn btn-sm btn-ghost" id="pt-reset">↺ 重設</button>
      </div>
      <div class="viz"><div class="viz-row" style="justify-content:space-around">
        <div class="box" style="text-align:center">flag[0]<br><span class="sem-value" id="pt-f0">false</span></div>
        <div class="box" style="text-align:center">flag[1]<br><span class="sem-value" id="pt-f1">false</span></div>
        <div class="box" style="text-align:center">turn<br><span class="sem-value" id="pt-turn">0</span></div>
        <div class="box" style="text-align:center">在 Critical Section<br><span class="sem-value" id="pt-cs">（沒人）</span></div>
      </div><div class="viz-row" style="margin-top:10px"><span class="q-item" id="pt-st0"></span><span class="q-item" id="pt-st1"></span></div></div>
      <div class="step-log" id="pt-log"></div><div class="sim-note" id="pt-note"></div>`;
    slot.appendChild(el);
    let st; let csCount = [0, 0]; let maxWait = 0;
    const LINES = [2, 3, 4, 5, 6, 7];
    const reset = () => { st = { flag: [false, false], turn: 0, pc: [0, 0], spins: [0, 0], log: [] }; csCount = [0, 0]; render(); };
    function step(i) {
      const j = 1 - i, pc = st.pc[i];
      const L = ['flag[i] = true', 'turn = j', 'while(...)', 'critical section', 'flag[i] = false', 'remainder'];
      let msg = `P${i}: ${L[pc].replace('i', i).replace('j', j)}`;
      if (pc === 0) { st.flag[i] = true; st.pc[i] = 1; }
      else if (pc === 1) { st.turn = j; st.pc[i] = 2; }
      else if (pc === 2) {
        if (st.flag[j] && st.turn === j) { st.spins[i]++; msg += ` → flag[${j}]=true 且 turn=${j}，<b>繼續等</b>（第 ${st.spins[i]} 次）`; }
        else { st.pc[i] = 3; msg += ` → 條件不成立（${!st.flag[j] ? `flag[${j}]=false：對方不想進` : `turn=${i}：輪到我`}），<b>進入 CS</b>`; csCount[i]++; }
      }
      else if (pc === 3) { st.pc[i] = 4; msg += '（做完了 CS 的工作）'; }
      else if (pc === 4) { st.flag[i] = false; st.pc[i] = 5; st.spins[i] = 0; }
      else { st.pc[i] = 0; msg += ' → 回到開頭，又想進去'; }
      st.log.push(msg); render();
    }
    function render() {
      [0, 1].forEach(i => { U.hlLines(el.querySelector(`#pt-c${i} .code-block`), [LINES[st.pc[i]]], st.pc[i] === 3 ? 'hl-run' : 'hl'); el.querySelector(`#pt-st${i}`).innerHTML = `P${i}：${['準備進入', '設定 turn', st.spins[i] ? '<b style="color:var(--warn)">busy waiting</b>' : '檢查條件', '<b style="color:var(--success)">在 CS</b>', '離開 CS', 'remainder'][st.pc[i]]}`; });
      el.querySelector('#pt-f0').textContent = st.flag[0]; el.querySelector('#pt-f1').textContent = st.flag[1]; el.querySelector('#pt-turn').textContent = st.turn;
      const inCS = [0, 1].filter(i => st.pc[i] === 3);
      el.querySelector('#pt-cs').textContent = inCS.length ? inCS.map(i => 'P' + i).join(' 和 ') : '（沒人）';
      el.querySelector('#pt-cs').style.color = inCS.length > 1 ? 'var(--danger)' : 'var(--accent-text)';
      el.querySelector('#pt-log').innerHTML = st.log.length ? st.log.slice(-12).map((l, k, arr) => `<div class="${k === arr.length - 1 ? 'cur' : ''}">${l}</div>`).join('') : '<div>（尚未執行）</div>';
      el.querySelector('#pt-log').scrollTop = 1e6;
      el.querySelector('#pt-note').innerHTML = `<b>驗證三個條件</b><br>
        <b>Mutual Exclusion：</b>目前在 CS 的有 ${inCS.length} 個（永遠 ≤ 1）。要同時進入，需要 flag[0]=flag[1]=true 且 turn 同時等於 0 和 1——不可能，turn 只有一個值。<br>
        <b>Progress：</b>如果對方不想進（flag[j]=false），while 條件立刻不成立，我馬上進去；不會被「不想進的人」擋住。<br>
        <b>Bounded Waiting：</b>我在等的時候（spin），對方出來後若再想進會先執行 <code>turn = i</code>，把 turn 讓給我——所以我最多等對方進去<b>一次</b>。目前 P0 進入 ${csCount[0]} 次、P1 進入 ${csCount[1]} 次。`;
    }
    el.querySelector('#pt-s0').addEventListener('click', () => step(0)); el.querySelector('#pt-s1').addEventListener('click', () => step(1));
    el.querySelector('#pt-reset').addEventListener('click', reset);
    el.querySelector('#pt-worst').addEventListener('click', () => { reset(); const seq = [0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1]; let k = 0; const t = setInterval(() => { if (k >= seq.length) { clearInterval(t); return; } step(seq[k++]); }, 650); });
    reset();
  };
})(window.Sims);
