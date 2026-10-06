/* ============================================================
   Ch9：File System 與 I/O — open/read/write/close、I/O 方式（Polling / Interrupt / DMA）、Disk Scheduling
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- open / read / write / close ---------- */
  S.fileOpenSim = function (slot) {
    const el = U.simShell('open() → read() → close()：從 fd 到磁碟區塊', '追蹤 kernel 裡三層表格：per-process fd table → system-wide open file table → inode。');
    const code = `int fd = open("notes.txt", O_RDONLY);
char buf[64];
int n = read(fd, buf, 64);
n = read(fd, buf, 64);     // 再讀一次：從哪裡開始？
close(fd);`;
    el.innerHTML += `${U.code(code, { title: 'main.c' })}<div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:flex-start">
        <div class="pcb" id="fo-fdt"><div class="pcb-title">Process 的 fd table</div><div class="kv" id="fo-fd"></div></div><div class="arrow">→</div>
        <div class="pcb" id="fo-oft"><div class="pcb-title">Open File Table（全系統）</div><div class="kv" id="fo-of"></div></div><div class="arrow">→</div>
        <div class="pcb" id="fo-ino"><div class="pcb-title">inode #4021</div><div class="kv"><span class="k">type</span><span class="v">regular file</span><span class="k">size</span><span class="v">150 B</span><span class="k">owner / perm</span><span class="v">oliver / rw-r--r--</span><span class="k">blocks</span><span class="v">[ 812, 813 ]</span></div></div><div class="arrow">→</div>
        <div><div class="viz-label">Disk blocks</div><div class="frames" id="fo-blk"><div class="frame"><span class="fi">812</span><span class="fv" style="font-size:.6rem">byte 0–63</span></div><div class="frame"><span class="fi">813</span><span class="fv" style="font-size:.6rem">64–149</span></div></div></div>
      </div></div>`;
    slot.appendChild(el);
    const steps = [
      { hl: [1], fd: [['0', 'stdin'], ['1', 'stdout'], ['2', 'stderr']], of: [], on: 'fdt', desc: 'Process 一開始就有 fd 0/1/2。呼叫 <code>open("notes.txt")</code>：kernel 沿著目錄結構（/ → home → oliver → notes.txt）找到檔名對應的 <b>inode 編號</b>——目錄其實就是「檔名 → inode 號碼」的對照表。' },
      { hl: [1], fd: [['0', 'stdin'], ['1', 'stdout'], ['2', 'stderr'], ['3', '→ OFT[0]']], of: [['offset', '0'], ['mode', 'O_RDONLY'], ['inode', '#4021'], ['refcount', '1']], on: 'oft', desc: 'Kernel 檢查權限（rw-r--r--，讀取 OK），在 open file table 建一筆（<b>offset = 0</b>、模式、指向 inode），再在 process 的 fd table 找最小的空位 → <b>fd = 3</b>。回傳的整數 3 就是一張「票根」，程式之後都用它。' },
      { hl: [3], fd: [['0', 'stdin'], ['1', 'stdout'], ['2', 'stderr'], ['3', '→ OFT[0]']], of: [['offset', '0 → 64'], ['mode', 'O_RDONLY'], ['inode', '#4021'], ['refcount', '1']], on: 'ino', blk: 0, desc: '<code>read(3, buf, 64)</code>：fd 3 → OFT → offset 0 → inode 告訴 kernel「byte 0–63 在 block 812」→ 讀磁碟（或已在 buffer cache）→ 複製 64 bytes 到 buf → <b>offset 變成 64</b>。' },
      { hl: [4], fd: [['0', 'stdin'], ['1', 'stdout'], ['2', 'stderr'], ['3', '→ OFT[0]']], of: [['offset', '64 → 128'], ['mode', 'O_RDONLY'], ['inode', '#4021'], ['refcount', '1']], on: 'ino', blk: 1, desc: '第二次 <code>read</code>：程式沒有說「從哪裡讀」，因為 kernel 記得 offset = 64 → 從 block 813 讀 → offset 變 128。這就是為什麼連續 read 會讀到後面的內容。' },
      { hl: [5], fd: [['0', 'stdin'], ['1', 'stdout'], ['2', 'stderr']], of: [], on: 'fdt', desc: '<code>close(3)</code>：fd 3 的格子清空，OFT 的 refcount 減 1，變 0 就釋放那筆。inode 本身還在磁碟上——close 不會刪檔案。<br><b>面試常問：</b>fork 之後父子共用同一筆 OFT（refcount = 2），所以共用 offset：一個讀了，另一個接著讀後面。' }
    ];
    const codeEl = el.querySelector('.code-block');
    U.stepper(el, steps, s => {
      U.hlLines(codeEl, s.hl);
      el.querySelector('#fo-fd').innerHTML = s.fd.map(([k, v]) => `<span class="k">fd ${k}</span><span class="v">${v}</span>`).join('');
      el.querySelector('#fo-of').innerHTML = s.of.length ? s.of.map(([k, v]) => `<span class="k">${k}</span><span class="v">${v}</span>`).join('') : '<span class="k">（無此 process 的項目）</span><span></span>';
      ['fdt', 'oft', 'ino'].forEach(k => el.querySelector('#fo-' + k).classList.toggle('on', s.on === k));
      el.querySelectorAll('#fo-blk .frame').forEach((f, i) => f.classList.toggle('hit', s.blk === i));
    }, { autoMs: 2400 });
  };

  /* ---------- I/O 方式：Polling vs Interrupt vs DMA ---------- */
  S.ioMethods = function (slot) {
    const el = U.simShell('三種 I/O 方式：CPU 到底要做多少事', '同樣是「從磁碟讀 4 KB」。看 CPU 的時間花在哪裡。');
    el.innerHTML += `<div class="sim-controls"><label>方式 <select id="io-m"><option value="poll">Programmed I/O（polling）</option><option value="int">Interrupt-driven</option><option value="dma">DMA</option></select></label></div>
      <div class="viz"><div class="viz-label">CPU 時間軸（每格約 1 μs；磁碟傳一個 word 要好幾格）</div><div class="gantt-track" id="io-track" style="height:34px"></div><div class="viz-row" style="margin-top:8px;font-size:.78rem"><span><span class="pdot pc-3"></span>做有用的計算</span><span><span class="pdot pc-7"></span>忙著等 / 輪詢裝置</span><span><span class="pdot pc-2"></span>搬資料（一個 word 一個 word）</span><span><span class="pdot pc-1"></span>處理 interrupt</span></div></div>
      <div class="sim-note" id="io-note"></div>`;
    slot.appendChild(el);
    const draw = () => {
      const m = el.querySelector('#io-m').value; let segs, note;
      if (m === 'poll') { segs = [[3, 'pc-3', '算'], [10, 'pc-7', 'busy-wait: status ready?'], [2, 'pc-2', '搬'], [10, 'pc-7', 'wait'], [2, 'pc-2', '搬'], [10, 'pc-7', 'wait'], [2, 'pc-2', '搬'], [3, 'pc-3', '算']]; note = '<b>Polling：</b>CPU 一直讀 device 的 status register 問「好了沒？」，好了就搬一個 word，再問。CPU 幾乎全部時間耗在等。適合超快的裝置或簡單的嵌入式系統。'; }
      else if (m === 'int') { segs = [[3, 'pc-3', '算'], [10, 'pc-3', '跑別的 process'], [1, 'pc-1', 'ISR'], [2, 'pc-2', '搬'], [10, 'pc-3', '跑別的'], [1, 'pc-1', 'ISR'], [2, 'pc-2', '搬'], [10, 'pc-3', '跑別的'], [1, 'pc-1', 'ISR'], [2, 'pc-2', '搬']]; note = '<b>Interrupt-driven：</b>CPU 下指令後去做別的事；裝置準備好一個 word 就發 interrupt，CPU 進 ISR 搬一個 word。不用等了，但<b>每個 word 都要一次 interrupt + context 保存</b>——資料量大時 interrupt 多到吃掉 CPU。'; }
      else { segs = [[3, 'pc-3', '算'], [1, 'pc-1', '設定 DMA'], [30, 'pc-3', '跑別的 process（DMA controller 直接把 4 KB 搬進 RAM）'], [1, 'pc-1', 'ISR: 完成'], [3, 'pc-3', '算']]; note = '<b>DMA（Direct Memory Access）：</b>CPU 只告訴 DMA controller「從裝置搬 4 KB 到位址 X」，然後整塊傳輸都由 DMA controller 直接對記憶體做，<b>不經過 CPU</b>；全部搬完才發<b>一次</b> interrupt。CPU 幾乎全程在做有用的事。代價：DMA 和 CPU 搶記憶體匯流排（cycle stealing）。'; }
      const total = segs.reduce((s, x) => s + x[0], 0);
      el.querySelector('#io-track').innerHTML = segs.map(([w, c, t]) => `<div class="gantt-seg ${c}" style="flex:${w}" title="${t}"><span style="font-size:.65rem;font-weight:400">${w / total > .12 ? t : ''}</span></div>`).join('');
      const useful = segs.filter(x => x[1] === 'pc-3').reduce((s, x) => s + x[0], 0);
      el.querySelector('#io-note').innerHTML = note + `<br><span style="color:var(--text-3)">CPU 用在有用工作的比例：<b>${Math.round(useful / total * 100)}%</b></span>`;
    };
    el.querySelector('#io-m').addEventListener('change', draw); draw();
  };

  /* ---------- Disk Scheduling ---------- */
  S.diskSchedSim = function (slot) {
    const el = U.simShell('Disk Scheduling：磁頭怎麼走', '佇列：98 183 37 122 14 124 65 67，磁頭在 53，共 200 個 cylinder。選演算法，看磁頭移動路徑與總距離。');
    el.innerHTML += `<div class="sim-controls">
        <label>佇列 <input type="text" id="dk-q" value="98 183 37 122 14 124 65 67" style="width:200px"></label>
        <label>磁頭 <input type="number" id="dk-h" value="53" min="0" max="199" style="width:60px"></label>
        <label>演算法 <select id="dk-a">${Object.entries(Disk.ALGOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>方向 <select id="dk-d"><option value="up">往大（199）</option><option value="down">往小（0）</option></select></label>
        <button class="btn btn-sm btn-primary" id="dk-go">▶ 執行</button>
      </div>
      <svg id="dk-svg" viewBox="0 0 640 260" style="width:100%;height:auto;background:var(--bg-alt);border-radius:6px"></svg>
      <div id="dk-stp"></div><div class="sim-readout" id="dk-read"></div>`;
    slot.appendChild(el);
    let stepper = null, drawFn = null;
    function go() {
      const q = el.querySelector('#dk-q').value.split(/[\s,]+/).map(Number).filter(n => !Number.isNaN(n) && n >= 0 && n < 200);
      const head = Math.max(0, Math.min(199, +el.querySelector('#dk-h').value | 0)), algo = el.querySelector('#dk-a').value, dir = el.querySelector('#dk-d').value;
      const res = Disk.run(q, head, algo, { cylinders: 200, dir });
      const steps = [{ k: 0, desc: `磁頭在 ${head}，佇列：${q.join(', ')}。按 Next Step 移動。` }].concat(res.segments.map((s, i) => ({ k: i + 1, desc: `${s.from} → ${s.to}（移動 ${s.dist}）${s.note ? '：' + s.note : ''}。累計 ${res.segments.slice(0, i + 1).reduce((a, x) => a + x.dist, 0)}` })));
      const X = c => 30 + c / 199 * 580, Y = i => 30 + i * (200 / Math.max(1, res.segments.length));
      drawFn = s => {
        let svg = `<line x1="30" y1="20" x2="610" y2="20" stroke="var(--border-strong)"/>` + [0, 50, 100, 150, 199].map(c => `<text x="${X(c)}" y="14" font-size="10" fill="var(--text-3)" text-anchor="middle">${c}</text>`).join('');
        q.forEach(c => svg += `<line x1="${X(c)}" y1="20" x2="${X(c)}" y2="250" stroke="var(--border)" stroke-dasharray="2,3"/><text x="${X(c)}" y="258" font-size="9" fill="var(--text-2)" text-anchor="middle">${c}</text>`);
        let path = `M ${X(head)} ${Y(0)}`;
        res.segments.slice(0, s.k).forEach((sg, i) => path += ` L ${X(sg.to)} ${Y(i + 1)}`);
        svg += `<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
        svg += `<circle cx="${X(head)}" cy="${Y(0)}" r="4" fill="var(--text-2)"/>`;
        res.segments.slice(0, s.k).forEach((sg, i) => svg += `<circle cx="${X(sg.to)}" cy="${Y(i + 1)}" r="${i === s.k - 1 ? 6 : 4}" fill="${sg.note && !q.includes(sg.to) ? 'var(--warn)' : 'var(--accent)'}"/>`);
        el.querySelector('#dk-svg').innerHTML = svg;
        const done = res.segments.slice(0, s.k);
        el.querySelector('#dk-read').innerHTML = `<span>服務順序：<b>${done.filter(x => q.includes(x.to)).map(x => x.to).join(' → ') || '-'}</b></span><span>累計移動 <b>${done.reduce((a, x) => a + x.dist, 0)}</b> cylinders</span>${s.k === res.segments.length ? `<span>總移動 <b>${res.total}</b></span>` : ''}`;
      };
      if (stepper) stepper.setSteps(steps); else stepper = U.stepper(el.querySelector('#dk-stp'), steps, s => drawFn(s));
    }
    el.querySelector('#dk-go').addEventListener('click', go); go();
    el.insertAdjacentHTML('beforeend', `<div class="sim-note">教科書數字（磁頭 53）：FCFS 640、SSTF 236、SCAN（往 0）236、C-SCAN（往 199，含跳回）382、LOOK（往 0）208、C-LOOK 322。SSTF 短但可能 starvation（遠處的請求一直被插隊）；SCAN 像電梯，公平；C-SCAN 讓兩端的等待時間更均勻。</div>`);
  };
})(window.Sims);
