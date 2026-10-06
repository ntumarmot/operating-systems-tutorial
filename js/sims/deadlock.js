/* ============================================================
   Ch6：Deadlock — 兩個 process 卡死、Resource Allocation Graph、Banker's Algorithm
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- RAG 繪圖工具（共用） ---------- */
  function ragSVG(procs, res, edges, cycleSet) {
    // procs: ['P1',...]; res: [{id, inst}]; edges: [{from,to,type:'request'|'assign'}]
    const W = 520, H = 260; const px = i => 80 + i * (W - 160) / Math.max(1, procs.length - 1), rx = i => 80 + i * (W - 160) / Math.max(1, res.length - 1);
    const pos = {}; procs.forEach((p, i) => pos[p] = [procs.length === 1 ? W / 2 : px(i), 60]); res.forEach((r, i) => pos[r.id] = [res.length === 1 ? W / 2 : rx(i), 200]);
    const key = e => e.from + '>' + e.to;
    let s = `<svg viewBox="0 0 ${W} ${H}"><defs><marker id="rag-arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--text-2)"/></marker><marker id="rag-arr-c" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="var(--danger)"/></marker></defs>`;
    edges.forEach(e => {
      const [x1, y1] = pos[e.from], [x2, y2] = pos[e.to]; const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); const ux = dx / L, uy = dy / L;
      const r1 = e.type === 'request' ? 26 : 24, r2 = e.type === 'request' ? 24 : 26;
      const cyc = cycleSet && cycleSet.has(key(e));
      s += `<line class="e ${cyc ? 'cycle' : ''}" x1="${x1 + ux * r1}" y1="${y1 + uy * r1}" x2="${x2 - ux * r2}" y2="${y2 - uy * r2}" ${cyc ? 'marker-end="url(#rag-arr-c)"' : ''}/>`;
    });
    procs.forEach(p => { const [x, y] = pos[p]; s += `<circle class="node-p" cx="${x}" cy="${y}" r="24"/><text class="lbl" x="${x}" y="${y}">${p}</text>`; });
    res.forEach(r => { const [x, y] = pos[r.id]; s += `<rect class="node-r" x="${x - 26}" y="${y - 22}" width="52" height="44" rx="4"/><text class="lbl" x="${x}" y="${y - 30}">${r.id}</text>`; for (let k = 0; k < r.inst; k++) s += `<circle class="inst" cx="${x - (r.inst - 1) * 7 + k * 14}" cy="${y}" r="4"/>`; });
    return s + '</svg>';
  }
  // 找環（有向圖）：回傳邊集合 key
  function findCycle(nodes, edges) {
    const adj = {}; nodes.forEach(n => adj[n] = []); edges.forEach(e => adj[e.from].push(e.to));
    const color = {}, stack = [];
    let found = null;
    const dfs = n => { color[n] = 1; stack.push(n); for (const m of adj[n]) { if (found) return; if (color[m] === 1) { found = stack.slice(stack.indexOf(m)).concat(m); return; } if (!color[m]) dfs(m); } stack.pop(); color[n] = 2; };
    nodes.forEach(n => { if (!color[n] && !found) dfs(n); });
    if (!found) return null;
    const set = new Set(); for (let i = 0; i < found.length - 1; i++) set.add(found[i] + '>' + found[i + 1]);
    return { path: found, set };
  }
  S._rag = { ragSVG, findCycle };

  /* ---------- 兩個 process 互等 ---------- */
  S.deadlockIntro = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Deadlock 是怎麼一步一步走進去的', 'Process A 需要 R1 和 R2，Process B 也需要 R2 和 R1（順序相反）。看四個必要條件如何一個一個成立。');
    el.innerHTML += `<div class="viz rag" id="di-rag"></div><div class="viz"><div class="kv" style="grid-template-columns:max-content 1fr"><span class="k">Mutual Exclusion</span><span class="v" id="di-c1">-</span><span class="k">Hold and Wait</span><span class="v" id="di-c2">-</span><span class="k">No Preemption</span><span class="v" id="di-c3">-</span><span class="k">Circular Wait</span><span class="v" id="di-c4">-</span></div></div>`;
    slot.appendChild(el);
    const P = ['A', 'B'], R = [{ id: 'R1', inst: 1 }, { id: 'R2', inst: 1 }];
    const steps = [
      { edges: [], c: ['✓ R1、R2 都只有一個實例，一次只能給一個人（鎖、印表機都是這樣）', '-', '-', '-'], desc: '一開始沒有人持有資源。' },
      { edges: [{ from: 'R1', to: 'A', type: 'assign' }], c: ['✓', '-', '-', '-'], desc: 'A 呼叫 <code>lock(R1)</code>，拿到 R1。圖上：<b>R1 → A</b>（assignment edge：資源指向持有者）。' },
      { edges: [{ from: 'R1', to: 'A', type: 'assign' }, { from: 'R2', to: 'B', type: 'assign' }], c: ['✓', '-', '-', '-'], desc: 'Context switch，B 跑了，<code>lock(R2)</code>，拿到 R2。<b>R2 → B</b>。到目前為止都很正常。' },
      { edges: [{ from: 'R1', to: 'A', type: 'assign' }, { from: 'R2', to: 'B', type: 'assign' }, { from: 'A', to: 'R2', type: 'request' }], c: ['✓', '✓ A 拿著 R1，同時在等 R2', '✓ 沒有人能把 R1 從 A 手上搶走', '-'], desc: 'A 繼續：<code>lock(R2)</code>。R2 在 B 手上 → A 進入等待。圖上：<b>A → R2</b>（request edge：process 指向想要的資源）。A 手上的 R1 <b>不會</b>因為它在等就被收回。' },
      { edges: [{ from: 'R1', to: 'A', type: 'assign' }, { from: 'R2', to: 'B', type: 'assign' }, { from: 'A', to: 'R2', type: 'request' }, { from: 'B', to: 'R1', type: 'request' }], c: ['✓', '✓ 兩邊都拿著一個、等另一個', '✓', '✓ A → R2 → B → R1 → A 形成環'], cls: 'warn', desc: 'B 繼續：<code>lock(R1)</code>。R1 在 A 手上 → B 也等。<br><b>現在：</b>A 等 B 放 R2，B 等 A 放 R1，兩邊都在 Waiting 狀態，永遠不會被叫醒。這就是 <b>Deadlock（死結）</b>。四個條件全部成立；只要打破任何一個，deadlock 就不會發生（Chapter 6.3）。' }
    ];
    U.stepper(el, steps, s => {
      const cyc = findCycle(['A', 'B', 'R1', 'R2'], s.edges);
      el.querySelector('#di-rag').innerHTML = ragSVG(P, R, s.edges, cyc && cyc.set);
      s.c.forEach((c, i) => { const e = el.querySelector('#di-c' + (i + 1)); e.innerHTML = c; e.style.color = c.startsWith('✓') ? 'var(--danger)' : 'var(--text-3)'; });
    }, { autoMs: o.autoMs || 2200 });
  };

  /* ---------- RAG 建構器 ---------- */
  S.ragSim = function (slot) {
    const el = U.simShell('Resource Allocation Graph：自己加邊，看有沒有環', '單實例資源：<b>有環 = deadlock</b>。多實例資源：有環只是「可能」deadlock，還要看實例夠不夠。');
    el.innerHTML += `<div class="sim-controls">
        <label>Process <select id="rg-p"><option>P1</option><option>P2</option><option>P3</option></select></label>
        <label>Resource <select id="rg-r"><option>R1</option><option>R2</option><option>R3</option></select></label>
        <button class="btn btn-sm" id="rg-req">＋ request（P → R）</button><button class="btn btn-sm" id="rg-asg">＋ assign（R → P）</button>
        <button class="btn btn-sm btn-ghost" id="rg-clr">清除</button>
        <label>範例 <select id="rg-ex"><option value="">—</option><option value="dl">單實例 deadlock</option><option value="multi">多實例：有環但無 deadlock</option><option value="nocycle">無環</option></select></label>
      </div>
      <div class="sim-controls"><label>R1 實例 <input type="number" id="rg-i1" value="1" min="1" max="3" style="width:50px"></label><label>R2 實例 <input type="number" id="rg-i2" value="1" min="1" max="3" style="width:50px"></label><label>R3 實例 <input type="number" id="rg-i3" value="1" min="1" max="3" style="width:50px"></label></div>
      <div class="viz rag" id="rg-svg"></div><div class="sim-note" id="rg-note"></div>`;
    slot.appendChild(el);
    let edges = [];
    const inst = k => +el.querySelector('#rg-i' + k).value;
    const P = ['P1', 'P2', 'P3'];
    function render() {
      const R = [1, 2, 3].map(k => ({ id: 'R' + k, inst: inst(k) }));
      const cyc = findCycle(P.concat(R.map(r => r.id)), edges);
      el.querySelector('#rg-svg').innerHTML = ragSVG(P, R, edges, cyc && cyc.set);
      let note;
      if (!cyc) note = '<b style="color:var(--success)">沒有環 → 一定沒有 deadlock。</b>（無環是「沒有 deadlock」的充分條件。）';
      else {
        const multi = R.some(r => r.inst > 1 && cyc.path.includes(r.id));
        // 多實例：用「歸約」判斷——能否找到一個 process 的請求可被滿足
        const held = {}; R.forEach(r => held[r.id] = edges.filter(e => e.type === 'assign' && e.from === r.id).length);
        const avail = {}; R.forEach(r => avail[r.id] = r.inst - held[r.id]);
        let procsLeft = P.filter(p => edges.some(e => e.from === p || e.to === p)); let progress = true; const finished = [];
        while (progress) { progress = false; for (const p of procsLeft) { const reqs = edges.filter(e => e.type === 'request' && e.from === p); if (reqs.every(e => avail[e.to] > 0)) { edges.filter(e => e.type === 'assign' && e.to === p).forEach(e => avail[e.from]++); finished.push(p); procsLeft = procsLeft.filter(x => x !== p); progress = true; break; } } }
        note = `<b style="color:var(--danger)">有環：${cyc.path.join(' → ')}</b>。` + (multi ? (procsLeft.length ? `環上有多實例資源，但用「圖歸約」檢查：${procsLeft.join('、')} 的請求都無法滿足 → <b>仍是 deadlock</b>。` : `環上有多實例資源，圖歸約：${finished.join(' → ')} 都能依序完成 → <b>沒有 deadlock</b>（環只是必要條件）。`) : '所有資源都是單實例 → <b>一定是 deadlock</b>。');
      }
      el.querySelector('#rg-note').innerHTML = note + `<br><span style="color:var(--text-3);font-size:.8rem">目前邊：${edges.map(e => `${e.from}→${e.to}`).join('、') || '（無）'}</span>`;
    }
    const add = type => { const p = el.querySelector('#rg-p').value, r = el.querySelector('#rg-r').value; const e = type === 'request' ? { from: p, to: r, type } : { from: r, to: p, type }; if (!edges.some(x => x.from === e.from && x.to === e.to)) edges.push(e); render(); };
    el.querySelector('#rg-req').addEventListener('click', () => add('request')); el.querySelector('#rg-asg').addEventListener('click', () => add('assign'));
    el.querySelector('#rg-clr').addEventListener('click', () => { edges = []; render(); });
    [1, 2, 3].forEach(k => el.querySelector('#rg-i' + k).addEventListener('change', render));
    el.querySelector('#rg-ex').addEventListener('change', e => {
      const v = e.target.value; const setI = (a, b, c) => { el.querySelector('#rg-i1').value = a; el.querySelector('#rg-i2').value = b; el.querySelector('#rg-i3').value = c; };
      if (v === 'dl') { setI(1, 1, 1); edges = [{ from: 'R1', to: 'P1', type: 'assign' }, { from: 'P1', to: 'R2', type: 'request' }, { from: 'R2', to: 'P2', type: 'assign' }, { from: 'P2', to: 'R3', type: 'request' }, { from: 'R3', to: 'P3', type: 'assign' }, { from: 'P3', to: 'R1', type: 'request' }]; }
      else if (v === 'multi') { setI(2, 1, 1); edges = [{ from: 'R1', to: 'P1', type: 'assign' }, { from: 'P1', to: 'R2', type: 'request' }, { from: 'R2', to: 'P2', type: 'assign' }, { from: 'P2', to: 'R1', type: 'request' }, { from: 'R1', to: 'P3', type: 'assign' }]; }
      else if (v === 'nocycle') { setI(1, 1, 1); edges = [{ from: 'R1', to: 'P1', type: 'assign' }, { from: 'P1', to: 'R2', type: 'request' }, { from: 'R2', to: 'P2', type: 'assign' }, { from: 'R3', to: 'P3', type: 'assign' }]; }
      render();
    });
    render();
  };

  /* ---------- Banker's Algorithm Simulator ---------- */
  S.bankerSim = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell("Banker's Algorithm Simulator", '可以直接改表格。Need 由網站算（Need = Max − Allocation）。按「安全性檢查」逐步看 Work 怎麼變；也可以測試某個 process 的新請求。');
    const ids = ['P0', 'P1', 'P2', 'P3', 'P4'], RS = ['A', 'B', 'C'];
    let max = o.max || [[7, 5, 3], [3, 2, 2], [9, 0, 2], [2, 2, 2], [4, 3, 3]], alloc = o.alloc || [[0, 1, 0], [2, 0, 0], [3, 0, 2], [2, 1, 1], [0, 0, 2]], avail = o.available || [3, 3, 2];
    const mat = (name, m, editable) => `<div><div class="viz-label">${name}</div><table class="data mono"><thead><tr><th></th>${RS.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>${m.map((row, i) => `<tr><td>${ids[i]}</td>${row.map((v, j) => `<td>${editable ? `<input data-m="${name}" data-i="${i}" data-j="${j}" value="${v}">` : `<span data-need="${i}-${j}">${v}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    el.innerHTML += `<div class="viz-row" id="bk-mats"></div>
      <div class="sim-controls" style="margin-top:10px"><label>Available <span id="bk-avail"></span></label><button class="btn btn-sm btn-primary" id="bk-check">▶ 安全性檢查（逐步）</button></div>
      <div id="bk-out"></div>
      <div class="sim-controls" style="margin-top:14px;border-top:1px dashed var(--border);padding-top:10px"><label>測試請求：<select id="bk-rp">${ids.map((p, i) => `<option value="${i}">${p}</option>`).join('')}</select> 要求</label>${RS.map((r, j) => `<label>${r} <input type="number" id="bk-rq${j}" value="${[1, 0, 2][j]}" min="0" style="width:52px"></label>`).join('')}<button class="btn btn-sm" id="bk-req">檢查是否可核准</button></div>
      <div id="bk-req-out"></div>`;
    slot.appendChild(el);
    const need = () => Banker.need(max, alloc);
    function renderMats() {
      el.querySelector('#bk-mats').innerHTML = mat('Max', max, true) + mat('Allocation', alloc, true) + mat('Need', need(), false);
      el.querySelector('#bk-avail').innerHTML = RS.map((r, j) => `${r} <input type="number" data-av="${j}" value="${avail[j]}" min="0" style="width:52px">`).join(' ');
      el.querySelectorAll('input[data-m]').forEach(inp => inp.addEventListener('change', () => { const v = Math.max(0, +inp.value | 0); (inp.dataset.m === 'Max' ? max : alloc)[+inp.dataset.i][+inp.dataset.j] = v; renderMats(); }));
      el.querySelectorAll('input[data-av]').forEach(inp => inp.addEventListener('change', () => { avail[+inp.dataset.av] = Math.max(0, +inp.value | 0); }));
      const nd = need(); nd.forEach((row, i) => row.forEach((v, j) => { if (v < 0) el.querySelector(`[data-need="${i}-${j}"]`).style.color = 'var(--danger)'; }));
    }
    renderMats();
    function showSafety(host, s) {
      host.innerHTML = `<div class="viz"><div class="kv" style="grid-template-columns:max-content 1fr"><span class="k">Work（可用）</span><span class="v" id="bk-work"></span><span class="k">Finish</span><span class="v" id="bk-fin"></span><span class="k">這一步</span><span class="v" id="bk-cur" style="font-weight:400;font-family:var(--font)"></span></div></div><div id="bk-need-tbl"></div><div id="bk-stp"></div>`;
      U.stepper(host.querySelector('#bk-stp'), s.steps, st => {
        host.querySelector('#bk-work').textContent = '[' + st.work.join(', ') + ']';
        host.querySelector('#bk-fin').innerHTML = ids.map((p, i) => `<span class="q-item ${st.finish[i] ? 'run' : ''}">${p}${st.finish[i] ? ' ✓' : ''}</span>`).join(' ');
        host.querySelector('#bk-cur').innerHTML = st.chosen != null ? `<b>${ids[st.chosen]}</b> 可以完成，歸還 [${st.released.join(', ')}]` : (st.final ? (s.safe ? '<b style="color:var(--success)">Safe State</b>' : '<b style="color:var(--danger)">Unsafe State</b>') : '尋找 Need ≤ Work 且尚未完成的 process');
        host.querySelector('#bk-need-tbl').innerHTML = U.table(['', ...RS.map(r => 'Need ' + r), '≤ Work？'], ids.map((p, i) => { const ok = st.need[i].every((v, j) => v <= st.work[j]); return [p, ...st.need[i], { html: st.finish[i] ? '已完成' : ok ? '✓ 可以' : '✗ 不夠', cls: st.finish[i] ? '' : ok ? 'ok' : 'bad' }]; }));
      });
      host.insertAdjacentHTML('beforeend', `<div class="sim-note">${s.safe ? `<b style="color:var(--success)">Safe Sequence：${s.sequence.join(' → ')}</b>。存在至少一種順序讓所有人都能完成，所以現在的配置是安全的。` : `<b style="color:var(--danger)">Unsafe：${s.stuck.join('、')} 可能永遠等不到資源。</b>注意 unsafe ≠ 一定 deadlock，只是 OS 無法保證不會。`}</div>`);
    }
    el.querySelector('#bk-check').addEventListener('click', () => showSafety(el.querySelector('#bk-out'), Banker.safety(avail, max, alloc, ids)));
    el.querySelector('#bk-req').addEventListener('click', () => {
      const pi = +el.querySelector('#bk-rp').value, req = RS.map((_, j) => Math.max(0, +el.querySelector('#bk-rq' + j).value | 0));
      const r = Banker.request(avail, max, alloc, ids, pi, req);
      const host = el.querySelector('#bk-req-out');
      host.innerHTML = `<div class="callout ${r.ok ? 'success' : 'danger'}"><div class="callout-title">${ids[pi]} 請求 [${req.join(', ')}]：${r.ok ? '✓ 核准' : '✗ 拒絕 / 等待'}</div>${r.reason}</div>`;
      if (r.safety) { const h = U.el('div'); host.appendChild(h); h.insertAdjacentHTML('beforeend', `<div class="viz-label">假裝配置後（Available = [${r.state.available.join(', ')}]）的安全性檢查</div>`); const inner = U.el('div'); h.appendChild(inner); showSafety(inner, r.safety); }
    });
    if (o.autocheck) el.querySelector('#bk-check').click();
  };
})(window.Sims);
