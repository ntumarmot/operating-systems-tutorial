/* ============================================================
   Ch8：Virtual Memory — Page Fault、Page Replacement、Thrashing
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- Page Fault 處理流程 ---------- */
  S.pageFaultSim = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Page Fault：Process 要 page 5，但它不在 RAM', '追蹤 OS 從 trap 到「重新執行同一條指令」的完整流程。注意 page table 的 valid bit 何時改變。');
    el.innerHTML += `<div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:flex-start">
        <div class="cpu-box" id="pf-cpu"><div class="cpu-title">CPU / Process</div><div class="kv"><span class="k">指令</span><span class="v" id="pf-ins">load page5[12]</span><span class="k">狀態</span><span class="v" id="pf-st">Running</span></div></div>
        <div><div class="viz-label">Page Table</div><table class="data mono" id="pf-pt"><thead><tr><th>Page</th><th>Frame</th><th>Valid</th></tr></thead><tbody></tbody></table></div>
        <div><div class="viz-label">RAM（4 frames）</div><div class="frames" id="pf-ram"></div></div>
        <div class="box" id="pf-disk" style="text-align:center">💽 Disk（swap）<br><span style="font-size:.7rem">page 5 在這裡</span></div>
      </div></div>`;
    slot.appendChild(el);
    const basePT = [[0, 3, 1], [1, null, 0], [2, 0, 1], [3, null, 0], [4, 1, 1], [5, null, 0]];
    const steps = [
      { pt: basePT, ram: ['pg0', 'pg4', null, 'pg2'], st: 'Running', on: 'cpu', desc: 'Process 執行到一條指令，要讀 page 5 的資料。RAM 只有 4 個 frame，目前放了 page 0、2、4；frame 2 是空的。' },
      { pt: basePT, ram: ['pg0', 'pg4', null, 'pg2'], st: 'Running', on: 'pt', hl: 5, cls: 'warn', desc: 'MMU 查 page table：page 5 的 <b>valid bit = 0</b>（不在 RAM）。硬體無法完成這次存取 → 產生 <b>Page Fault trap</b>，切到 kernel。' },
      { pt: basePT, ram: ['pg0', 'pg4', null, 'pg2'], st: 'Waiting（等磁碟）', on: 'os', desc: 'OS 的 page fault handler 先檢查：這是合法的位址嗎（在 process 的位址空間內）？是 → 是 demand paging 的正常情況，不是程式錯誤。如果不合法 → Segmentation fault。' },
      { pt: basePT, ram: ['pg0', 'pg4', '（保留）', 'pg2'], st: 'Waiting（等磁碟）', on: 'ram', hlf: 2, desc: 'OS 找一個 <b>free frame</b>：frame 2 是空的，用它。（如果沒有空的，就要跑 page replacement 演算法選一個 victim 踢掉——下一節。）' },
      { pt: basePT, ram: ['pg0', 'pg4', '⇣ 載入中', 'pg2'], st: 'Waiting（等磁碟）', on: 'disk', hlf: 2, desc: 'OS 對磁碟下 I/O 指令：把 page 5 從 swap 區讀進 frame 2。這要花<b>幾毫秒</b>（記憶體存取只要幾十奈秒，差了十萬倍），所以 process 進 Waiting，CPU 給別人用。' },
      { pt: [[0, 3, 1], [1, null, 0], [2, 0, 1], [3, null, 0], [4, 1, 1], [5, 2, 1]], ram: ['pg0', 'pg4', 'pg5', 'pg2'], st: 'Ready', on: 'pt', hl: 5, desc: '磁碟 interrupt：載入完成。OS 更新 page table：page 5 → frame 2，<b>valid bit = 1</b>。Process 回到 Ready。' },
      { pt: [[0, 3, 1], [1, null, 0], [2, 0, 1], [3, null, 0], [4, 1, 1], [5, 2, 1]], ram: ['pg0', 'pg4', 'pg5', 'pg2'], st: 'Running', on: 'cpu', desc: 'Process 被排回 CPU，<b>重新執行同一條指令</b>。這次查 page table：valid → frame 2 → 成功讀到資料。程式完全不知道中間發生了 page fault。<br><b>重點：</b>指令是「重新執行」而不是「繼續」——所以硬體必須能在指令中途安全地放棄再重來。' }
    ];
    U.stepper(el, steps, s => {
      el.querySelector('#pf-pt tbody').innerHTML = s.pt.map(r => `<tr><td ${s.hl === r[0] ? 'class="hl"' : ''}>${r[0]}</td><td ${s.hl === r[0] ? 'class="hl"' : ''}>${r[1] == null ? '-' : r[1]}</td><td class="${r[2] ? 'ok' : 'bad'} ${s.hl === r[0] ? 'hl' : ''}">${r[2] ? 'v' : 'i'}</td></tr>`).join('');
      el.querySelector('#pf-ram').innerHTML = s.ram.map((x, i) => `<div class="frame ${s.hlf === i ? 'on' : ''} ${x == null ? 'empty' : ''}"><span class="fi">fr${i}</span><span class="fv" style="font-size:.7rem">${x || '·'}</span></div>`).join('');
      el.querySelector('#pf-st').textContent = s.st;
      el.querySelector('#pf-cpu').classList.toggle('on', s.on === 'cpu'); el.querySelector('#pf-disk').classList.toggle('on', s.on === 'disk');
    }, { autoMs: o.autoMs || 2200 });
  };

  /* ---------- Page Replacement Simulator ---------- */
  S.pageReplaceSim = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Page Replacement Simulator：FIFO / LRU / Optimal', '輸入 reference string 和 frame 數，按 Next Step 一格一格看：Hit 還是 Fault？誰是 victim？最後比較三種演算法的 page fault 數。');
    el.innerHTML += `<div class="sim-controls">
        <label>Reference string <input type="text" id="pr-ref" value="${o.refs || '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1'}" style="width:260px"></label>
        <label>Frames <input type="number" id="pr-n" value="${o.frames || 3}" min="1" max="7" style="width:56px"></label>
        <label>演算法 <select id="pr-algo"><option value="FIFO">FIFO</option><option value="LRU">LRU</option><option value="OPT">Optimal</option></select></label>
        <button class="btn btn-sm btn-primary" id="pr-go">▶ 開始</button>
        <button class="btn btn-sm" id="pr-cmp">比較三種</button>
      </div>
      <div id="pr-out"></div>`;
    slot.appendChild(el);
    if (o.algo) el.querySelector('#pr-algo').value = o.algo;
    const parse = () => el.querySelector('#pr-ref').value.split(/[\s,]+/).map(Number).filter(n => !Number.isNaN(n));
    const out = el.querySelector('#pr-out');
    function go() {
      const refs = parse(), n = Math.max(1, Math.min(7, +el.querySelector('#pr-n').value | 0)), algo = el.querySelector('#pr-algo').value;
      if (!refs.length) { out.innerHTML = '<div class="empty">請輸入 reference string。</div>'; return; }
      const res = Mem.pageReplace(refs, n, algo);
      out.innerHTML = `<div class="ref-string" id="pr-rs"></div>
        <div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:center">
          <div class="box" style="text-align:center">Current Page<br><span class="sem-value" id="pr-cur">-</span></div>
          <div><div class="viz-label">Frames</div><div class="frames" id="pr-fr"></div></div>
          <div class="box" id="pr-hf" style="text-align:center;min-width:90px">-</div>
          <div class="box" style="text-align:center">Victim<br><b id="pr-v">-</b></div>
          <div class="box" style="text-align:center">Page Faults<br><span class="sem-value" id="pr-cnt">0</span></div>
        </div><div id="pr-extra" style="font-size:.8rem;color:var(--text-2);margin-top:6px"></div></div>
        <div class="viz-label">總表（每一欄 = 處理完該次存取後的 frames）</div><div class="pr-table" id="pr-tbl" style="grid-template-columns:repeat(${refs.length + 1}, minmax(30px, 1fr))"></div>
        <div id="pr-stp"></div>`;
      const steps = [{ i: -1, frames: Array(n).fill(null), desc: `${({ FIFO: 'FIFO：淘汰「最早載入」的 page（跟用不用無關）。', LRU: 'LRU：淘汰「最久沒被使用」的 page（看過去）。', OPT: 'Optimal：淘汰「最久之後才會再用到」的 page（看未來——實際上做不到，只當作比較基準）。' })[algo]} 按 Next Step 開始。` }].concat(res.steps.map(s => Object.assign({}, s, { desc: s.info })));
      U.stepper(el.querySelector('#pr-stp'), steps, (s, k) => {
        el.querySelector('#pr-rs').innerHTML = refs.map((r, i) => { const st = res.steps[i]; const cls = i === s.i ? 'cur' : i < s.i ? (st.hit ? 'done-hit' : 'done-fault') : ''; const fut = algo === 'OPT' && s.i >= 0 && i > s.i && s.fault && s.frames.includes(r) && refs.slice(s.i + 1, i).indexOf(r) < 0 ? 'future-use' : ''; return `<span class="${cls} ${fut}">${r}</span>`; }).join('');
        el.querySelector('#pr-cur').textContent = s.i < 0 ? '-' : s.ref;
        el.querySelector('#pr-fr').innerHTML = s.frames.map((f, i) => `<div class="frame ${f == null ? 'empty' : ''} ${s.i >= 0 && s.hit && s.hitIdx === i ? 'hit' : ''} ${s.i >= 0 && s.fault && s.victimIdx === i ? 'fault' : ''}"><span class="fi">fr${i}</span><span class="fv">${f == null ? '·' : f}</span>${algo === 'LRU' && f != null && s.lastUsed ? `<span style="font-size:.55rem;color:var(--text-3)">t=${s.lastUsed[f]}</span>` : ''}${algo === 'FIFO' && f != null && s.loadedAt ? `<span style="font-size:.55rem;color:var(--text-3)">in ${s.loadedAt[f]}</span>` : ''}</div>`).join('');
        const hf = el.querySelector('#pr-hf'); hf.textContent = s.i < 0 ? '-' : s.hit ? 'HIT' : 'PAGE FAULT'; hf.className = 'box ' + (s.i < 0 ? '' : s.hit ? 'ok' : 'bad');
        el.querySelector('#pr-v').textContent = s.victim == null ? '-' : s.victim;
        el.querySelector('#pr-cnt').textContent = s.i < 0 ? 0 : res.steps.slice(0, s.i + 1).filter(x => x.fault).length;
        el.querySelector('#pr-extra').innerHTML = s.i < 0 ? '' : algo === 'FIFO' ? `FIFO 指標下一個要淘汰 frame ${s.fifoPtr}` : algo === 'LRU' ? `最近使用時間：${s.frames.filter(f => f != null).map(f => `page ${f} → t=${s.lastUsed[f]}`).join('，')}` : '橘色虛線框 = 目前 frames 裡的 page 下一次被用到的位置';
        // 總表
        let t = `<div class="cell hdr">ref</div>${refs.map((r, i) => `<div class="cell hdr ${i === s.i ? 'cur' : ''}">${r}</div>`).join('')}`;
        for (let f = 0; f < n; f++) t += `<div class="cell hdr">fr${f}</div>${refs.map((r, i) => i <= s.i ? `<div class="cell ${i === s.i ? 'cur' : ''}">${res.steps[i].frames[f] == null ? '' : res.steps[i].frames[f]}</div>` : '<div class="cell"></div>').join('')}`;
        t += `<div class="cell hdr"></div>${refs.map((r, i) => i <= s.i ? `<div class="cell ${res.steps[i].hit ? 'h' : 'f'}">${res.steps[i].hit ? 'H' : 'F'}</div>` : '<div class="cell"></div>').join('')}`;
        el.querySelector('#pr-tbl').innerHTML = t;
        if (k === steps.length - 1) el.querySelector('#pr-extra').innerHTML += `<div style="margin-top:6px"><b>Total Page Faults = ${res.faults}</b>（${refs.length} 次存取，hit ${res.hits} 次）</div>`;
      });
      if (o.autoEnd) el.querySelector('#pr-stp [data-act="end"]').click();
    }
    el.querySelector('#pr-go').addEventListener('click', go);
    el.querySelector('#pr-cmp').addEventListener('click', () => {
      const refs = parse(), n = Math.max(1, Math.min(7, +el.querySelector('#pr-n').value | 0));
      const rows = ['FIFO', 'LRU', 'OPT'].map(a => { const r = Mem.pageReplace(refs, n, a); return [a, r.faults, r.hits, Math.round(r.hits / refs.length * 100) + '%']; });
      const bel = [3, 4].map(k => Mem.pageReplace(refs, k, 'FIFO').faults);
      out.innerHTML = U.table(['演算法', 'Page Faults', 'Hits', 'Hit ratio'], rows) + `<div class="sim-note">同一個 reference string、${n} 個 frame。OPT 一定最少（它是下界），LRU 通常接近 OPT，FIFO 最差。<br>順便看 <b>Belady's Anomaly</b>：這個字串用 FIFO，3 frames = ${bel[0]} 次 fault、4 frames = ${bel[1]} 次${bel[1] > bel[0] ? '——<b>frame 變多反而 fault 變多！</b>' : '。試試 reference string「1 2 3 4 1 2 5 1 2 3 4 5」，3 frames 是 9 次、4 frames 是 10 次。'}LRU 和 OPT 不會有這種現象（它們是 stack algorithm）。</div>`;
    });
    go();
  };

  /* ---------- Thrashing ---------- */
  S.thrashingSim = function (slot) {
    const el = U.simShell('Thrashing：process 越多，CPU 反而越閒', '拉動「同時執行的 process 數」。RAM 固定 64 frames；每個 process 至少需要約 12 frames 才不會一直 page fault。');
    el.innerHTML += `<div class="sim-controls"><label>同時執行的 process 數 <input type="range" id="th-n" min="1" max="12" value="3"><span class="val" id="th-nv">3</span></label></div>
      <canvas id="th-cv" width="640" height="220" style="width:100%;height:auto;border-radius:6px;background:var(--bg-alt)"></canvas>
      <div class="sim-readout" id="th-read"></div><div class="sim-note" id="th-note"></div>`;
    slot.appendChild(el);
    const FR = 64, NEED = 12;
    const util = n => { const per = FR / n; const pf = per >= NEED ? 0.02 * n : Math.min(0.98, 0.02 * n + Math.pow((NEED - per) / NEED, 1.5) * 1.2); const cpu = Math.min(1, n * 0.28) * (1 - pf); return { per, pf, cpu }; };
    function draw() {
      const n = +el.querySelector('#th-n').value; el.querySelector('#th-nv').textContent = n;
      const cv = el.querySelector('#th-cv'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
      const cs = getComputedStyle(document.documentElement); const col = k => cs.getPropertyValue(k).trim();
      const px = i => 50 + (i - 1) / 11 * (W - 80), py = v => H - 30 - v * (H - 60);
      ctx.strokeStyle = col('--border-strong'); ctx.beginPath(); ctx.moveTo(50, 20); ctx.lineTo(50, H - 30); ctx.lineTo(W - 20, H - 30); ctx.stroke();
      ctx.fillStyle = col('--text-3'); ctx.font = '11px sans-serif'; ctx.fillText('CPU utilization', 54, 16); ctx.fillText('process 數 →', W - 90, H - 10);
      ctx.strokeStyle = col('--success'); ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 1; i <= 12; i += 0.25) { const u = util(i).cpu; i === 1 ? ctx.moveTo(px(i), py(u)) : ctx.lineTo(px(i), py(u)); } ctx.stroke();
      ctx.strokeStyle = col('--danger'); ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); for (let i = 1; i <= 12; i += 0.25) { const u = util(i).pf; i === 1 ? ctx.moveTo(px(i), py(u)) : ctx.lineTo(px(i), py(u)); } ctx.stroke(); ctx.setLineDash([]);
      const u = util(n); ctx.fillStyle = col('--accent'); ctx.beginPath(); ctx.arc(px(n), py(u.cpu), 6, 0, 7); ctx.fill();
      ctx.fillStyle = col('--success'); ctx.fillText('— CPU utilization', W - 200, 30); ctx.fillStyle = col('--danger'); ctx.fillText('- - page fault rate', W - 200, 46);
      el.querySelector('#th-read').innerHTML = `<span>每個 process 分到 <b>${U.fmt(u.per, 1)}</b> frames（需要 ${NEED}）</span><span>Page fault 率 <b style="color:${u.pf > .5 ? 'var(--danger)' : 'inherit'}">${Math.round(u.pf * 100)}%</b></span><span>CPU utilization <b>${Math.round(u.cpu * 100)}%</b></span>`;
      el.querySelector('#th-note').innerHTML = u.per >= NEED ? '每個 process 的常用頁（working set）都放得進 RAM，page fault 少，加 process 會提高 CPU 使用率——多道程式的好處。' : u.pf < .5 ? '開始不夠：有些 process 的 working set 放不下，page fault 變多。CPU 使用率還在上升，但已經開始被 I/O 拖累。' : '<b style="color:var(--danger)">Thrashing！</b>每個 process 都放不下自己的 working set，一跑就 fault，把別人的頁踢掉，別人跑又 fault……CPU 大部分時間在等磁碟（RAM ↔ Disk 搬頁），使用率崩跌。<br><b>更糟的是：</b>老式 OS 看到 CPU 閒置會以為「應該多載入幾個 process」→ 雪上加霜。解法：用 working-set model 或 page-fault frequency 控制 multiprogramming 的程度——必要時把某些 process swap out。';
    }
    el.querySelector('#th-n').addEventListener('input', draw); draw();
    const obs = new MutationObserver(draw); obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };
})(window.Sims);
