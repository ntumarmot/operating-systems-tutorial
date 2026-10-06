/* ============================================================
   Ch7：Memory Management — MMU、連續配置（First/Best/Worst Fit）、碎片、Paging、TLB
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- MMU：Base + Limit ---------- */
  S.mmuSim = function (slot) {
    const el = U.simShell('CPU → MMU → RAM：邏輯位址怎麼變實體位址', '最簡單的 MMU：一個 base（重定位）暫存器 + 一個 limit 暫存器。輸入程式「以為」的位址，看它實際落在 RAM 哪裡。');
    el.innerHTML += `<div class="sim-controls"><label>邏輯位址 <input type="number" id="mm-la" value="346" min="0" style="width:80px"></label><label>base <input type="number" id="mm-base" value="14000" style="width:80px"></label><label>limit <input type="number" id="mm-lim" value="12000" style="width:80px"></label></div>
      <div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:center">
        <div class="box" style="text-align:center">CPU<br>邏輯位址<br><b id="mm-o1">-</b></div><div class="arrow">→</div>
        <div class="box" id="mm-chk" style="text-align:center">MMU 檢查<br><span id="mm-o2">-</span></div><div class="arrow">→</div>
        <div class="box" style="text-align:center">+ base<br><span id="mm-o3">-</span></div><div class="arrow">→</div>
        <div class="box" style="text-align:center">RAM<br>實體位址<br><b id="mm-o4">-</b></div>
      </div></div><div class="sim-note" id="mm-note"></div>`;
    slot.appendChild(el);
    const g = id => +el.querySelector('#' + id).value;
    const draw = () => {
      const la = g('mm-la'), base = g('mm-base'), lim = g('mm-lim'), ok = la >= 0 && la < lim;
      el.querySelector('#mm-o1').textContent = la; el.querySelector('#mm-o2').innerHTML = `${la} &lt; ${lim}？ <b style="color:${ok ? 'var(--success)' : 'var(--danger)'}">${ok ? '是' : '否'}</b>`;
      el.querySelector('#mm-chk').className = 'box ' + (ok ? 'ok' : 'bad');
      el.querySelector('#mm-o3').textContent = ok ? `${la} + ${base}` : '（不執行）'; el.querySelector('#mm-o4').textContent = ok ? la + base : 'trap!';
      el.querySelector('#mm-note').innerHTML = ok ? `程式碼裡寫的是 ${la}（<b>logical address</b>，從 0 算起），CPU 送出去的也是 ${la}；MMU 在硬體層加上 base，記憶體匯流排上看到的是 ${la + base}（<b>physical address</b>）。程式從頭到尾不知道 base 是多少——這就是為什麼同一支程式可以被載到 RAM 的任何地方。` : `<b style="color:var(--danger)">Addressing error → trap 到 OS</b>：${la} ≥ limit ${lim}，這個 process 試圖存取不屬於它的記憶體。OS 通常會送 SIGSEGV（Segmentation fault）把它殺掉。這就是<b>保護</b>：A 永遠碰不到 B 的記憶體。`;
    };
    el.querySelectorAll('input').forEach(i => i.addEventListener('input', draw)); draw();
  };

  /* ---------- 連續配置 Simulator ---------- */
  S.allocSim = function (slot) {
    const TOTAL = 1000;
    const el = U.simShell('Memory Allocation Simulator：First / Best / Worst Fit', '記憶體共 1000 KB。輸入新 process 的大小、選策略，看它被放在哪個 hole；也可以移除 process 製造碎片。');
    el.innerHTML += `<div class="sim-controls">
        <label>新 process 大小 <input type="number" id="al-size" value="120" min="1" max="1000" style="width:70px"> KB</label>
        <label>策略 <select id="al-strat"><option value="first">First Fit</option><option value="best">Best Fit</option><option value="worst">Worst Fit</option></select></label>
        <button class="btn btn-sm btn-primary" id="al-add">▶ 配置</button>
        <button class="btn btn-sm" id="al-compact">Compaction（搬移合併）</button>
        <button class="btn btn-sm btn-ghost" id="al-reset">↺</button></div>
      <div class="viz"><div class="mem-bar" id="al-bar"></div><div class="mem-scale"><span>0</span><span>${TOTAL} KB</span></div>
      <div class="viz-row" id="al-procs" style="margin-top:8px"></div></div>
      <div class="sim-readout" id="al-read"></div><div class="sim-note" id="al-note">點記憶體上的 process 可以釋放它。</div>`;
    slot.appendChild(el);
    const init = () => [{ start: 0, size: 100, pid: 'OS' }, { start: 100, size: 200, pid: null }, { start: 300, size: 100, pid: 'P1' }, { start: 400, size: 300, pid: null }, { start: 700, size: 100, pid: 'P2' }, { start: 800, size: 200, pid: null }];
    let blocks = init(), nextP = 3, highlight = null;
    function render() {
      el.querySelector('#al-bar').innerHTML = blocks.map((b, i) => `<div class="mem-blk ${b.pid == null ? 'free' : 'used ' + (b.pid === 'OS' ? 'pc-8' : U.pcls(+b.pid.slice(1)))} ${highlight && highlight.cands.includes(i) ? 'cand' : ''} ${highlight && highlight.chosen === i ? 'chosen' : ''}" style="flex:${b.size}" data-i="${i}" title="${b.pid || 'free'} ${b.start}–${b.start + b.size}">${b.pid || 'free'}<br>${b.size}</div>`).join('');
      el.querySelectorAll('.mem-blk.used').forEach(d => d.addEventListener('click', () => { const b = blocks[+d.dataset.i]; if (b.pid !== 'OS') { blocks = Mem.release(blocks, b.pid); highlight = null; el.querySelector('#al-note').innerHTML = `釋放 ${b.pid}，相鄰的 hole 已合併。`; render(); } }));
      const free = Mem.freeTotal(blocks), largest = Mem.largestHole(blocks), holes = blocks.filter(b => b.pid == null).length;
      el.querySelector('#al-read').innerHTML = `<span>Free 總量 <b>${free}</b> KB</span><span>Hole 數 <b>${holes}</b></span><span>最大 hole <b>${largest}</b> KB</span><span>External fragmentation：<b>${free - largest}</b> KB 是「有但不連續」</span>`;
    }
    el.querySelector('#al-add').addEventListener('click', () => {
      const size = Math.max(1, +el.querySelector('#al-size').value | 0), strat = el.querySelector('#al-strat').value;
      const r = Mem.chooseHole(blocks, size, strat);
      if (r.index < 0) { highlight = null; el.querySelector('#al-note').innerHTML = `<b style="color:var(--danger)">配置失敗：</b>${r.reason}。Free 總量 ${Mem.freeTotal(blocks)} KB ≥ ${size}？${Mem.freeTotal(blocks) >= size ? '<b>是</b>——這就是 external fragmentation：空間夠，卻沒有一塊連續的夠大。可以試 Compaction。' : '否，真的不夠。'}`; render(); return; }
      const holesTxt = r.candidates.map(i => `${blocks[i].size} KB@${blocks[i].start}`).join('、');
      const pid = 'P' + nextP++;
      highlight = { cands: r.candidates, chosen: r.index };
      const before = blocks; blocks = Mem.place(blocks, r.index, size, pid);
      el.querySelector('#al-note').innerHTML = `<b>${({ first: 'First', best: 'Best', worst: 'Worst' })[strat]} Fit：</b>${r.reason}。夠大的 hole 有：${holesTxt} → 選 <b>${before[r.index].size} KB@${before[r.index].start}</b>，放入 ${pid}（${size} KB），剩下 ${before[r.index].size - size} KB 的碎片。`;
      highlight = { cands: r.candidates.map(i => i > r.index ? i + (before[r.index].size > size ? 1 : 0) : i), chosen: r.index };
      render();
    });
    el.querySelector('#al-compact').addEventListener('click', () => { let cur = 0; const used = blocks.filter(b => b.pid != null).map(b => { const nb = { start: cur, size: b.size, pid: b.pid }; cur += b.size; return nb; }); if (cur < TOTAL) used.push({ start: cur, size: TOTAL - cur, pid: null }); blocks = used; highlight = null; el.querySelector('#al-note').innerHTML = '<b>Compaction：</b>把所有 process 往低位址搬，碎片合併成一大塊。代價：要搬資料，而且 process 執行中的位址都要重定位（需要動態重定位硬體）。'; render(); });
    el.querySelector('#al-reset').addEventListener('click', () => { blocks = init(); nextP = 3; highlight = null; render(); });
    render();
  };

  /* ---------- Internal vs External Fragmentation ---------- */
  S.fragmentation = function (slot) {
    const el = U.simShell('Internal vs External Fragmentation：差在「浪費在哪裡」', '左：固定分割（每格 100 KB），process 用不完的部分浪費在<b>格子裡</b>。右：可變分割，浪費在<b>格子之間</b>。');
    el.innerHTML += `<div class="sim-controls"><label>Process 大小 <input type="range" id="fr-size" min="10" max="250" value="70"><span class="val" id="fr-v">70</span> KB</label></div>
      <div class="sim-split">
        <div><div class="sub-title"><b>固定分割（100 KB × 4）→ Internal</b></div><div class="mem-bar" id="fr-fixed"></div><div class="sim-readout" id="fr-fr"></div></div>
        <div><div class="sub-title"><b>可變分割 → External</b></div><div class="mem-bar" id="fr-var"></div><div class="sim-readout" id="fr-vr"></div></div>
      </div>`;
    slot.appendChild(el);
    const draw = () => {
      const s = +el.querySelector('#fr-size').value; el.querySelector('#fr-v').textContent = s;
      const need = Math.ceil(s / 100), waste = need * 100 - s;
      el.querySelector('#fr-fixed').innerHTML = [0, 1, 2, 3].map(i => i < need ? `<div class="mem-blk used pc-1" style="flex:1;position:relative">P${i < need - 1 ? '' : ''}<span style="position:absolute;right:0;top:0;bottom:0;width:${i === need - 1 ? waste : 0}%;background:repeating-linear-gradient(45deg,rgba(255,255,255,.5),rgba(255,255,255,.5) 3px,transparent 3px,transparent 6px)"></span></div>` : '<div class="mem-blk free" style="flex:1">free</div>').join('');
      el.querySelector('#fr-fr').innerHTML = `<span>佔用 ${need} 格 = ${need * 100} KB，實際只用 ${s} KB</span><span><b>Internal fragmentation = ${waste} KB</b>（在格子內、別人用不到）</span>`;
      // variable: P 70 | hole 30 | P 150 | hole 40 | ...
      const layout = [['P1', 70], [null, 30], ['P2', 150], [null, 40], ['P3', 60], [null, 50]];
      const holes = layout.filter(x => !x[0]).map(x => x[1]); const total = holes.reduce((a, b) => a + b, 0), largest = Math.max(...holes);
      el.querySelector('#fr-var').innerHTML = layout.map(([p, sz]) => p ? `<div class="mem-blk used pc-2" style="flex:${sz}">${p}</div>` : `<div class="mem-blk free ${sz >= s ? 'chosen' : ''}" style="flex:${sz}">${sz}</div>`).join('');
      el.querySelector('#fr-vr').innerHTML = `<span>hole 總共 ${total} KB，最大 ${largest} KB</span><span>${s} KB 的 process 放得下？<b style="color:${largest >= s ? 'var(--success)' : 'var(--danger)'}">${largest >= s ? '可以' : total >= s ? '不行——空間夠但不連續 = External fragmentation' : '不行（真的不夠）'}</b></span>`;
    };
    el.querySelector('#fr-size').addEventListener('input', draw); draw();
  };

  /* ---------- Paging：位址轉換 ---------- */
  S.pagingSim = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Paging Address Translation：一步一步算', '輸入邏輯位址，按 Next Step 看它如何被拆成 page number / offset，查表得到 frame，再組成實體位址。可以改 page size 和 page table。');
    el.innerHTML += `<div class="sim-controls">
        <label>邏輯位址 <input type="number" id="pg-la" value="${o.logical != null ? o.logical : 13}" min="0" style="width:80px"></label>
        <label>Page size <select id="pg-ps"><option>4</option><option>8</option><option>16</option><option>256</option><option>1024</option><option>4096</option></select> bytes</label>
      </div>
      <div class="viz-row" style="align-items:flex-start">
        <div><div class="viz-label">Page Table（可編輯 frame）</div><table class="data mono" id="pg-pt"><thead><tr><th>Page</th><th>Frame</th></tr></thead><tbody></tbody></table></div>
        <div style="flex:1;min-width:260px"><div class="viz-label">計算</div><div class="viz"><div class="kv" style="grid-template-columns:max-content 1fr">
          <span class="k">邏輯位址</span><span class="v" id="pg-o0">-</span>
          <span class="k">二進位</span><span class="v" id="pg-o1">-</span>
          <span class="k">Page number</span><span class="v" id="pg-o2">-</span>
          <span class="k">Offset</span><span class="v" id="pg-o3">-</span>
          <span class="k">查表 → Frame</span><span class="v" id="pg-o4">-</span>
          <span class="k">實體位址</span><span class="v" id="pg-o5">-</span>
        </div></div></div>
      </div>
      <div class="viz-row" style="margin-top:8px"><div><div class="viz-label">Logical memory（pages）</div><div class="frames" id="pg-lm"></div></div><div><div class="viz-label">Physical memory（frames）</div><div class="frames" id="pg-pm"></div></div></div>
      <div id="pg-stp"></div>`;
    slot.appendChild(el);
    let pt = (o.pageTable || [5, 2, 8, 1]).slice(); const NF = 10;
    el.querySelector('#pg-ps').value = o.pageSize || 4;
    function renderPT() { el.querySelector('#pg-pt tbody').innerHTML = pt.map((f, i) => `<tr data-p="${i}"><td>${i}</td><td><input data-p="${i}" value="${f}"></td></tr>`).join(''); el.querySelectorAll('#pg-pt input').forEach(inp => inp.addEventListener('change', () => { pt[+inp.dataset.p] = Math.max(0, Math.min(NF - 1, +inp.value | 0)); inp.value = pt[+inp.dataset.p]; build(); })); }
    renderPT();
    let stepper = null, drawFn = null;
    function build() {
      const la = Math.max(0, +el.querySelector('#pg-la').value | 0), ps = +el.querySelector('#pg-ps').value;
      const r = Mem.translate(la, ps, pt); const bits = r.offsetBits; const bin = la.toString(2).padStart(bits + 2, '0');
      const steps = [
        { o: [la, '', '', '', '', ''], hl: null, desc: `CPU 送出邏輯位址 <b>${la}</b>。程式以為自己的記憶體從 0 開始、連續一大片；實際上每 ${ps} bytes 切成一頁，分散在 RAM 各處。` },
        { o: [la, `${bin.slice(0, -bits)}<span style="color:var(--p2)">${bin.slice(-bits)}</span>`, '', '', '', ''], desc: `Page size = ${ps} = 2<sup>${bits}</sup>，所以 offset 佔最低 <b>${bits}</b> 個 bit（橘色），剩下的高位 bit 是 page number。硬體只是「切 bit」，不用做除法。` },
        { o: [la, `${bin.slice(0, -bits)}<span style="color:var(--p2)">${bin.slice(-bits)}</span>`, `${la} ÷ ${ps} = <b>${r.page}</b>`, `${la} mod ${ps} = <b>${r.offset}</b>`, '', ''], hl: r.page, desc: `Page number = ⌊${la} / ${ps}⌋ = <b>${r.page}</b>，offset = ${la} mod ${ps} = <b>${r.offset}</b>。` },
        r.valid ? { o: [la, bin, r.page, r.offset, `page ${r.page} → <b>frame ${r.frame}</b>`, ''], hl: r.page, pm: r.frame, desc: `拿 page number 當索引查 <b>page table</b>：page ${r.page} 對應 frame <b>${r.frame}</b>。（page table 本身在記憶體裡，由 PTBR 暫存器指向。）` }
          : { o: [la, bin, r.page, r.offset, '<b style="color:var(--danger)">無此 page → trap</b>', ''], hl: r.page, cls: 'warn', desc: `page ${r.page} 超出 page table 範圍（只有 ${pt.length} 頁）→ 這個 process 存取了不屬於它的位址，硬體 trap 給 OS（通常是 Segmentation fault）。` },
        r.valid ? { o: [la, bin, r.page, r.offset, r.frame, `${r.frame} × ${ps} + ${r.offset} = <b>${r.physical}</b>`], hl: r.page, pm: r.frame, desc: `實體位址 = frame × page size + offset = ${r.frame} × ${ps} + ${r.offset} = <b>${r.physical}</b>。offset 完全不變——只有「哪一頁」被換成「哪一格」。這就是公式 <code>PA = frame × page_size + offset</code> 的來源。` } : null
      ].filter(Boolean);
      const draw = s => {
        s.o.forEach((v, i) => el.querySelector('#pg-o' + i).innerHTML = v === '' ? '-' : v);
        el.querySelectorAll('#pg-pt tr[data-p]').forEach(tr => tr.querySelectorAll('td').forEach(td => td.classList.toggle('hl', s.hl != null && +tr.dataset.p === s.hl)));
        el.querySelector('#pg-lm').innerHTML = pt.map((f, i) => `<div class="frame ${s.hl === i ? 'on' : ''}"><span class="fi">pg</span><span class="fv">${i}</span></div>`).join('');
        const inv = {}; pt.forEach((f, i) => inv[f] = i);
        el.querySelector('#pg-pm').innerHTML = Array.from({ length: NF }, (_, f) => `<div class="frame ${s.pm === f ? 'hit' : ''} ${inv[f] == null ? 'empty' : ''}"><span class="fi">fr${f}</span><span class="fv">${inv[f] != null ? 'pg' + inv[f] : '·'}</span></div>`).join('');
      };
      drawFn = draw;
      if (stepper) stepper.setSteps(steps); else stepper = U.stepper(el.querySelector('#pg-stp'), steps, s => drawFn(s));
      if (o.autoEnd) stepper.go(steps.length - 1);
    }
    el.querySelector('#pg-la').addEventListener('input', build); el.querySelector('#pg-ps').addEventListener('change', build);
    build();
  };

  /* ---------- TLB ---------- */
  S.tlbSim = function (slot) {
    const el = U.simShell('TLB：把最近查過的 page → frame 快取起來', 'TLB 只有 3 格。依序存取下面的 page，看哪些是 hit、哪些要走慢速的 page table。');
    el.innerHTML += `<div class="sim-controls"><label>存取的 page 序列 <input type="text" id="tl-seq" value="0 1 0 2 3 1 0 4 0 1" style="width:200px"></label><button class="btn btn-sm btn-primary" id="tl-go">▶ 重新開始</button></div>
      <div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:center">
        <div class="box" style="text-align:center">CPU<br>page <b id="tl-cur">-</b></div><div class="arrow">→</div>
        <div id="tl-tlbbox" class="box"><div class="viz-label">TLB（3 entries）</div><div id="tl-tlb"></div></div><div class="arrow" id="tl-arrow">→</div>
        <div class="box" id="tl-ptbox"><div class="viz-label">Page Table（在 RAM，慢）</div><div class="kv" id="tl-pt"></div></div>
      </div><div style="margin-top:8px;font-size:.9rem" id="tl-res"></div></div>
      <div id="tl-stp"></div><div class="sim-readout" id="tl-read"></div>`;
    slot.appendChild(el);
    const PT = [5, 2, 8, 1, 9, 3];
    let stepper = null, drawFn = null;
    function go() {
      const seq = el.querySelector('#tl-seq').value.split(/[\s,]+/).map(Number).filter(n => !Number.isNaN(n) && n >= 0 && n < PT.length);
      let tlb = []; let hits = 0, miss = 0;
      const steps = [{ cur: '-', tlb: [], res: '', hits: 0, miss: 0, desc: 'TLB 一開始是空的（例如剛 context switch 完，TLB 被清空）。' }];
      seq.forEach(p => { const r = Mem.tlbAccess(p, tlb, PT, 3); tlb = r.tlb; if (r.hit) hits++; else miss++; steps.push({ cur: p, tlb: tlb.slice(), hit: r.hit, frame: r.frame, hits, miss, desc: r.hit ? `<b style="color:var(--success)">TLB Hit：</b>page ${p} 在 TLB 裡 → frame ${r.frame}，<b>不用</b>去記憶體查 page table，只花一次記憶體存取（拿資料）。` : `<b style="color:var(--danger)">TLB Miss：</b>page ${p} 不在 TLB → 去 RAM 查 page table（多一次記憶體存取）→ frame ${r.frame} → 把 (${p} → ${r.frame}) 放進 TLB${r.tlb.length >= 3 && steps.length > 3 ? '（滿了，FIFO 踢掉最舊的）' : ''}。` }); });
      const draw = s => {
        el.querySelector('#tl-cur').textContent = s.cur;
        el.querySelector('#tl-tlb').innerHTML = s.tlb.length ? s.tlb.map(e => `<div style="font-family:var(--mono);font-size:.8rem;${s.cur === e.page ? 'color:var(--success);font-weight:700' : ''}">page ${e.page} → frame ${e.frame}</div>`).join('') : '<span class="q-empty">（空）</span>';
        el.querySelector('#tl-tlbbox').className = 'box ' + (s.hit === true ? 'ok' : s.hit === false ? 'bad' : '');
        el.querySelector('#tl-ptbox').className = 'box ' + (s.hit === false ? 'on' : 'dim');
        el.querySelector('#tl-arrow').textContent = s.hit === false ? '→ miss →' : s.hit ? '→ hit ✓' : '→';
        el.querySelector('#tl-pt').innerHTML = PT.map((f, i) => `<span class="k">page ${i}</span><span class="v" style="${s.hit === false && s.cur === i ? 'color:var(--accent-text)' : ''}">frame ${f}</span>`).join('');
        const total = s.hits + s.miss, ratio = total ? s.hits / total : 0;
        el.querySelector('#tl-read').innerHTML = `<span>Hit <b>${s.hits}</b></span><span>Miss <b>${s.miss}</b></span><span>Hit ratio <b>${total ? Math.round(ratio * 100) + '%' : '-'}</b></span><span>若記憶體存取 100 ns、TLB 10 ns：EAT = ${total ? `${U.fmt(ratio, 2)} × 110 + ${U.fmt(1 - ratio, 2)} × 210 = <b>${U.fmt(ratio * 110 + (1 - ratio) * 210, 1)} ns</b>` : '-'}</span>`;
      };
      drawFn = draw;
      if (stepper) stepper.setSteps(steps); else stepper = U.stepper(el.querySelector('#tl-stp'), steps, s => drawFn(s));
    }
    el.querySelector('#tl-go').addEventListener('click', go); go();
  };
})(window.Sims);
