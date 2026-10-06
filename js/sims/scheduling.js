/* ============================================================
   Ch3：CPU Scheduling — Gantt 圖教學、完整 Scheduling Simulator、Preemptive vs Non-preemptive
   ============================================================ */
(function (S) {
  const U = Util;
  const DEFAULT = [{ id: 'P1', arrival: 0, burst: 8, priority: 3 }, { id: 'P2', arrival: 1, burst: 4, priority: 1 }, { id: 'P3', arrival: 2, burst: 2, priority: 2 }];
  const pidx = (ids, id) => ids.indexOf(id);

  /* 畫 Gantt：res = Sched.run 結果；upto = 目前時間（之後的格子變淡） */
  function ganttHTML(res, upto) {
    const end = res.avg.end || 1;
    const segs = res.gantt.map(g => {
      const w = (g.end - g.start) / end * 100;
      const cls = g.id == null ? 'idle' : U.pcls(pidx(res.order, g.id));
      const fut = upto != null && g.start >= upto ? ' future' : '';
      return `<div class="gantt-seg ${cls}${fut}" style="flex:0 0 ${w}%" title="${g.id || 'idle'}: ${g.start}–${g.end}">${g.id || ''}</div>`;
    }).join('');
    const ticks = new Set([0, end]); res.gantt.forEach(g => ticks.add(g.start));
    const tk = [...ticks].sort((a, b) => a - b).map(t => `<span style="left:${t / end * 100}%">${t}</span>`).join('');
    const now = upto != null ? `<div class="gantt-now" style="left:${Math.min(upto, end) / end * 100}%"></div>` : '';
    return `<div class="gantt"><div class="gantt-track">${segs}</div><div class="gantt-ticks">${tk}${now}</div></div>`;
  }
  S._ganttHTML = ganttHTML;

  function metricsTable(res, opts = {}) {
    const rows = res.order.map(id => { const m = res.metrics[id]; return [`<span class="pdot ${U.pcls(pidx(res.order, id))}"></span>${id}`, m.arrival, m.burst, m.completion, `${m.completion} − ${m.arrival} = <b>${m.turnaround}</b>`, `${m.turnaround} − ${m.burst} = <b>${m.waiting}</b>`, `${m.firstStart} − ${m.arrival} = <b>${m.response}</b>`]; });
    rows.push(['<b>平均</b>', '', '', '', `<b>${U.fmt(res.avg.turnaround)}</b>`, `<b>${U.fmt(res.avg.waiting)}</b>`, `<b>${U.fmt(res.avg.response)}</b>`]);
    return U.table(['Process', 'Arrival', 'Burst', 'Completion', 'Turnaround = C − A', 'Waiting = T − B', 'Response = 首次執行 − A'], rows);
  }

  /* ---------- Gantt 圖與三種時間（用固定例子教） ---------- */
  S.ganttIntro = function (slot) {
    const el = U.simShell('先看懂 Gantt Chart，再看三種時間怎麼從圖上讀出來', '這是 FCFS 排 P1(0, 8)、P2(1, 4)、P3(2, 2) 的結果。點一個 process，圖上會標出它的到達、開始、完成。');
    const res = Sched.run(DEFAULT, 'FCFS');
    el.innerHTML += `<div class="sim-controls">${res.order.map((id, i) => `<button class="btn btn-sm" data-p="${id}"><span class="pdot ${U.pcls(i)}"></span>${id}</button>`).join('')}</div>
      <div id="gi-gantt">${ganttHTML(res)}</div><div id="gi-marks" style="position:relative;height:26px;font-family:var(--mono);font-size:.75rem"></div><div class="sim-note" id="gi-note">上面每一格代表 1 個時間單位；顏色代表當時 CPU 在跑誰。</div>`;
    slot.appendChild(el);
    el.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.p, m = res.metrics[id], end = res.avg.end;
      const mark = (t, txt, color) => `<span style="position:absolute;left:${t / end * 100}%;transform:translateX(-50%);color:${color};white-space:nowrap">▲ ${txt}(${t})</span>`;
      el.querySelector('#gi-marks').innerHTML = mark(m.arrival, 'arrival', 'var(--text-2)') + mark(m.firstStart, 'start', 'var(--success)') + mark(m.completion, 'complete', 'var(--danger)');
      el.querySelector('#gi-note').innerHTML = `<b>${id}</b>：在 t=${m.arrival} 到達，t=${m.firstStart} 第一次拿到 CPU，t=${m.completion} 完成。
        <ul style="margin:6px 0 0">
        <li><b>Turnaround Time</b> = 完成 − 到達 = ${m.completion} − ${m.arrival} = <b>${m.turnaround}</b>（從「進門」到「出門」總共花的時間）</li>
        <li><b>Waiting Time</b> = Turnaround − Burst = ${m.turnaround} − ${m.burst} = <b>${m.waiting}</b>（在 Ready Queue 裡乾等的時間；圖上就是到達之後、不是它顏色的格子數）</li>
        <li><b>Response Time</b> = 第一次執行 − 到達 = ${m.firstStart} − ${m.arrival} = <b>${m.response}</b>（使用者按下去多久之後「有反應」）</li></ul>
        在 FCFS 這種非搶佔演算法裡，Waiting = Response（拿到 CPU 就一路跑完）。搶佔式就不一定了——下一個模擬可以驗證。`;
    }));
  };

  /* ---------- 完整 Scheduling Simulator ---------- */
  S.schedSim = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell(o.title || 'CPU Scheduling Simulator', o.desc || '編輯 process、選演算法，按「執行」畫 Gantt Chart；用 Next Step 逐格看 Ready Queue 與剩餘時間怎麼變。');
    const algos = o.algos || Object.keys(Sched.ALGOS);
    el.innerHTML += `<div class="table-wrap"><table class="data mono" id="ss-table"><thead><tr><th>Process</th><th>Arrival</th><th>Burst</th><th>Priority<br><span style="font-weight:400;font-size:.7rem">（小 = 高）</span></th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="sim-controls">
        <button class="btn btn-sm btn-ghost" id="ss-add">＋ 新增 process</button>
        <label>演算法 <select id="ss-algo">${algos.map(a => `<option value="${a}" ${a === (o.algo || 'FCFS') ? 'selected' : ''}>${Sched.ALGOS[a].name} — ${Sched.ALGOS[a].full}</option>`).join('')}</select></label>
        <label id="ss-qwrap">Quantum <input type="number" id="ss-q" value="${o.quantum || 2}" min="1" max="20" style="width:60px"></label>
        <button class="btn btn-sm btn-primary" id="ss-run">▶ 執行</button>
        <button class="btn btn-sm" id="ss-compare">比較所有演算法</button>
      </div>
      <div id="ss-out"></div>`;
    slot.appendChild(el);
    let procs = (o.procs || DEFAULT).map(p => Object.assign({}, p));
    const tbody = el.querySelector('#ss-table tbody');
    function renderTable() {
      tbody.innerHTML = procs.map((p, i) => `<tr><td><span class="pdot ${U.pcls(i)}"></span>${p.id}</td><td><input data-i="${i}" data-k="arrival" value="${p.arrival}"></td><td><input data-i="${i}" data-k="burst" value="${p.burst}"></td><td><input data-i="${i}" data-k="priority" value="${p.priority == null ? 1 : p.priority}"></td><td><button class="btn btn-sm btn-ghost" data-del="${i}">✕</button></td></tr>`).join('');
      tbody.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => { const v = Math.max(0, Math.floor(+inp.value || 0)); procs[+inp.dataset.i][inp.dataset.k] = inp.dataset.k === 'burst' ? Math.max(1, v) : v; inp.value = procs[+inp.dataset.i][inp.dataset.k]; }));
      tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => { if (procs.length > 1) { procs.splice(+b.dataset.del, 1); procs.forEach((p, i) => p.id = 'P' + (i + 1)); renderTable(); } }));
    }
    renderTable();
    el.querySelector('#ss-add').addEventListener('click', () => { if (procs.length < 8) { procs.push({ id: 'P' + (procs.length + 1), arrival: procs.length, burst: 3, priority: procs.length + 1 }); renderTable(); } });
    const toggleQ = () => el.querySelector('#ss-qwrap').style.display = el.querySelector('#ss-algo').value === 'RR' ? '' : 'none';
    el.querySelector('#ss-algo').addEventListener('change', toggleQ); toggleQ();
    const readout = el.querySelector('#ss-out');
    let stepper = null;
    function run() {
      const algo = el.querySelector('#ss-algo').value, q = +el.querySelector('#ss-q').value || 2;
      const res = Sched.run(procs, algo, { quantum: q });
      readout.innerHTML = `<div class="viz-label" style="margin-top:8px">Gantt Chart（${Sched.ALGOS[algo].name}${algo === 'RR' ? '，q = ' + q : ''}）</div><div id="ss-gantt"></div>
        <div class="viz"><div class="kv" style="grid-template-columns:max-content 1fr">
          <span class="k">Current Time</span><span class="v" id="ss-t"></span>
          <span class="k">Running</span><span class="v" id="ss-run-p"></span>
          <span class="k">Ready Queue</span><span class="v"><div class="queue" id="ss-ready"></div></span>
          <span class="k">Remaining Burst</span><span class="v" id="ss-rem"></span>
          ${algo === 'RR' ? '<span class="k">剩餘 quantum</span><span class="v" id="ss-ql"></span>' : ''}
        </div></div>
        <div id="ss-stepper"></div>
        <div id="ss-metrics" style="margin-top:12px"></div>`;
      const steps = res.steps;
      stepper = U.stepper(el.querySelector('#ss-stepper'), steps, (s, i) => {
        el.querySelector('#ss-gantt').innerHTML = ganttHTML(res, s.time);
        el.querySelector('#ss-t').textContent = s.time;
        el.querySelector('#ss-run-p').innerHTML = s.running ? `<span class="q-item run"><span class="pdot ${U.pcls(pidx(res.order, s.running))}"></span>${s.running}</span>` : (s.final ? '—（全部完成）' : 'idle');
        el.querySelector('#ss-ready').innerHTML = s.ready.length ? s.ready.map(id => `<span class="q-item"><span class="pdot ${U.pcls(pidx(res.order, id))}"></span>${id}（剩 ${s.remaining[id]}）</span>`).join('<span class="arrow">→</span>') : '<span class="q-empty">（空）</span>';
        el.querySelector('#ss-rem').innerHTML = res.order.map(id => `${id}: ${s.remaining[id]}`).join('　');
        if (s.qleft != null && el.querySelector('#ss-ql')) el.querySelector('#ss-ql').textContent = s.running ? s.qleft : '-';
        const mt = el.querySelector('#ss-metrics');
        mt.innerHTML = s.final ? `<div class="viz-label">最後結果</div>${metricsTable(res)}` : `<div class="empty">走到最後一步（或按「跳到最後」）會顯示 Waiting / Turnaround / Response 計算表。</div>`;
      }, { log: (st) => `t=${st.time}: ${st.desc}` });
    }
    el.querySelector('#ss-run').addEventListener('click', run);
    el.querySelector('#ss-compare').addEventListener('click', () => {
      const q = +el.querySelector('#ss-q').value || 2;
      const rows = Object.keys(Sched.ALGOS).map(a => { const r = Sched.run(procs, a, { quantum: q }); return [Sched.ALGOS[a].name + (a === 'RR' ? ` (q=${q})` : ''), U.fmt(r.avg.waiting), U.fmt(r.avg.turnaround), U.fmt(r.avg.response), r.gantt.filter(g => g.id != null).length - 1]; });
      readout.innerHTML = `<div class="viz-label" style="margin-top:8px">同一組 process，六種演算法的平均值</div>${U.table(['演算法', '平均 Waiting', '平均 Turnaround', '平均 Response', 'Context switch 次數'], rows)}
        ${Object.keys(Sched.ALGOS).map(a => `<div style="font-size:.78rem;color:var(--text-3);margin-top:6px">${Sched.ALGOS[a].name}</div>${ganttHTML(Sched.run(procs, a, { quantum: q }))}`).join('')}
        <div class="sim-note">觀察：SJF / SRTF 的平均 Waiting 最小（可證明最佳），但長工作可能一直被插隊（starvation）；RR 的 Response 好，但切換多、Turnaround 差；FCFS 最簡單但有 convoy effect。沒有「最好」的演算法，只有「最適合目標」的。</div>`;
    });
    if (o.autorun !== false) run();
    if (o.autoplay && stepper) { setTimeout(() => el.querySelector('[data-act="auto"]').click(), 400); }
  };

  /* ---------- Preemptive vs Non-preemptive：SJF vs SRTF 並排 ---------- */
  S.preemptCompare = function (slot) {
    const procs = [{ id: 'P1', arrival: 0, burst: 8 }, { id: 'P2', arrival: 1, burst: 4 }, { id: 'P3', arrival: 2, burst: 2 }];
    const el = U.simShell('同一組 process：SJF（非搶佔）vs SRTF（搶佔）', 'P1(0, 8)、P2(1, 4)、P3(2, 2)。兩邊同步逐格前進，看 t=1 時 P2 到達，CPU 會不會被搶走。');
    const a = Sched.run(procs, 'SJF'), b = Sched.run(procs, 'SRTF');
    const side = (id, title) => `<div><div class="sub-title"><b>${title}</b></div><div id="${id}-g"></div><div class="kv" style="grid-template-columns:max-content 1fr"><span class="k">Running</span><span class="v" id="${id}-r"></span><span class="k">Ready</span><span class="v" id="${id}-q"></span><span class="k">說明</span><span class="v" id="${id}-d" style="font-weight:400;font-family:var(--font);font-size:.8rem"></span></div></div>`;
    el.innerHTML += `<div class="sim-split">${side('pc-a', 'SJF：決定了就跑完')}${side('pc-b', 'SRTF：每次有人到達就重新比較')}</div><div id="pc-stepper"></div><div id="pc-final"></div>`;
    slot.appendChild(el);
    const n = Math.max(a.steps.length, b.steps.length);
    const steps = Array.from({ length: n }, (_, i) => ({ i, sa: a.steps[Math.min(i, a.steps.length - 1)], sb: b.steps[Math.min(i, b.steps.length - 1)], desc: `t = ${i}` }));
    steps[1].desc = 't = 1：<b>P2 到達，burst 4 &lt; P1 剩餘 7</b>。左邊 SJF 不理它（非搶佔：P1 已經拿到 CPU，就讓它跑完）；右邊 SRTF 立刻把 P1 換下來。這就是 <b>Preemption（搶佔）</b>：OS 在 process 沒有自願放棄 CPU 的情況下把它拿走。';
    steps[2].desc = 't = 2：P3 到達，burst 2。SRTF 再搶一次（P3 的 2 &lt; P2 剩餘 3）；SJF 依然讓 P1 跑。';
    steps[n - 1].desc = '結束。比較平均 Waiting Time：SJF = ' + U.fmt(a.avg.waiting) + '，SRTF = ' + U.fmt(b.avg.waiting) + '。搶佔讓短工作更早完成，平均等待更低；代價是 P1 被中斷兩次（context switch overhead）與 P1 的 turnaround 變長。';
    const fill = (id, res, s) => {
      el.querySelector(`#${id}-g`).innerHTML = ganttHTML(res, s.time);
      el.querySelector(`#${id}-r`).textContent = s.running || (s.final ? '完成' : 'idle');
      el.querySelector(`#${id}-q`).textContent = s.ready.length ? s.ready.map(x => `${x}(剩${s.remaining[x]})`).join(' → ') : '（空）';
      el.querySelector(`#${id}-d`).innerHTML = s.desc;
    };
    U.stepper(el.querySelector('#pc-stepper'), steps, s => { fill('pc-a', a, s.sa); fill('pc-b', b, s.sb); el.querySelector('#pc-final').innerHTML = s.i === n - 1 ? `<div class="sim-split"><div>${metricsTable(a)}</div><div>${metricsTable(b)}</div></div>` : ''; });
  };
})(window.Sims);
