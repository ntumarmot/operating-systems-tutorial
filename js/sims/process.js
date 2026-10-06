/* ============================================================
   Ch1–2：Program vs Process、記憶體配置、Process State、PCB / Context Switch、Process vs Thread
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- Program vs Process ---------- */
  S.programVsProcess = function (slot) {
    const el = U.simShell('同一份 program，可以變成好幾個 process', '按「執行」把磁碟上的 chrome.exe 載入成 process。每次執行都是一個<b>新的、獨立的</b> process。');
    el.innerHTML += `<div class="sim-controls"><button class="btn btn-sm btn-primary" id="pv-run">▶ 執行 chrome.exe</button><button class="btn btn-sm" id="pv-kill">✕ 結束最後一個</button></div>
      <div class="viz"><div class="viz-row" style="align-items:stretch">
        <div style="flex:0 0 160px"><div class="viz-label">磁碟（被動）</div><div class="box" style="padding:12px">📄 chrome.exe<br><span style="color:var(--text-3);font-size:.72rem">120 MB 的機器碼 + 資料<br>不會「動」，只是檔案</span></div></div>
        <div class="arrow">→ load →</div>
        <div style="flex:1"><div class="viz-label">記憶體（主動：有狀態、有 PC）</div><div class="viz-row" id="pv-procs"><span class="q-empty">目前沒有 process。</span></div></div>
      </div></div>`;
    slot.appendChild(el);
    let procs = []; let nextPid = 1204;
    const render = () => {
      const w = el.querySelector('#pv-procs');
      w.innerHTML = procs.length ? procs.map((p, i) => `<div class="pcb ${i === procs.length - 1 ? 'on' : ''}"><div class="pcb-title">Process PID ${p.pid}</div><div class="kv"><span class="k">State</span><span class="v">${p.state}</span><span class="k">PC</span><span class="v">${p.pc}</span><span class="k">Heap</span><span class="v">${p.heap} MB</span><span class="k">開啟的檔案</span><span class="v">${p.files}</span></div></div>`).join('') : '<span class="q-empty">目前沒有 process。</span>';
    };
    el.querySelector('#pv-run').addEventListener('click', () => { if (procs.length >= 4) return; procs.push({ pid: nextPid++, state: ['Running', 'Ready', 'Waiting'][procs.length % 3], pc: '0x' + (0x4000 + Math.floor(Math.random() * 0xfff)).toString(16), heap: 40 + Math.floor(Math.random() * 300), files: 3 + Math.floor(Math.random() * 20) }); render(); });
    el.querySelector('#pv-kill').addEventListener('click', () => { procs.pop(); render(); });
    el.insertAdjacentHTML('beforeend', '<div class="sim-note">每個 process 有<b>自己的</b> PID、狀態、Program Counter、heap、開啟的檔案——即使它們來自同一份 chrome.exe。Program 是「食譜」，Process 是「正在照著食譜煮的那一鍋」。</div>');
  };

  /* ---------- Process 記憶體配置：Text / Data / Heap / Stack ---------- */
  S.memoryLayout = function (slot) {
    const el = U.simShell('一步一步看：每個變數住在哪裡', '按 Next Step 執行程式，右邊的記憶體配置會跟著變。特別注意 <code>p</code> 和 <code>*p</code> 住在不同的地方。');
    const code = `int g = 1;                 // 全域變數

void foo(int a) {
    int y = a * 2;         // foo 的區域變數
}

int main() {
    int x = 5;             // main 的區域變數
    int* p = new int(10);  // p 是區域變數，new 出來的 int 不是
    foo(x);
    delete p;
    return 0;
}`;
    el.innerHTML += `<div class="sim-split">
      <div>${U.code(code, { title: 'main.cpp' })}</div>
      <div><div class="mem-addr-lbl">High Address（0x7fff…）</div>
        <div class="mem-layout">
          <div class="mem-seg stack" id="ml-stack"><b>Stack</b><span class="sub">區域變數、參數、返回位址；往低位址長</span><div id="ml-stack-items"></div></div>
          <div class="mem-seg gap">↓ ↑<br>（未使用）</div>
          <div class="mem-seg" id="ml-heap"><b>Heap</b><span class="sub">new / malloc；往高位址長</span><div id="ml-heap-items"></div></div>
          <div class="mem-seg" id="ml-data"><b>Data</b><span class="sub">全域、static 變數</span><div id="ml-data-items"></div></div>
          <div class="mem-seg" id="ml-text"><b>Text</b><span class="sub">機器碼：main、foo</span></div>
        </div><div class="mem-addr-lbl">Low Address（0x0000…）</div></div></div>`;
    slot.appendChild(el);
    const chip = (name, val, addr, cls = '') => `<div class="box ${cls}" style="margin-top:4px;font-size:.75rem">${name} = ${val} <span style="color:var(--text-3)">@${addr}</span></div>`;
    const steps = [
      { hl: [1], data: [['g', 1, '0x0060']], stack: [], heap: [], on: 'data', desc: '程式一載入，<code>g</code> 就在 <b>Data</b> 段——它的空間在編譯時就決定了，整個 process 存活期間都在。' },
      { hl: [7, 8], data: [['g', 1, '0x0060']], stack: [['main()', [['x', 5, '0x7ffc']]]], heap: [], on: 'stack', desc: '進入 <code>main</code>：在 <b>Stack</b> 上推一個 frame。<code>x</code> 住在裡面。' },
      { hl: [9], data: [['g', 1, '0x0060']], stack: [['main()', [['x', 5, '0x7ffc'], ['p', '0x6000', '0x7ff4']]]], heap: [['int', 10, '0x6000']], on: 'heap', desc: '<code>new int(10)</code>：在 <b>Heap</b> 要一塊空間放 10，位址 0x6000。<code>p</code> 本身是區域變數，在 <b>Stack</b>，裡面存的是 0x6000。<br><b>問題：</b>x 在哪？→ Stack。p 在哪？→ Stack。new int(10) 在哪？→ Heap。' },
      { hl: [10, 3, 4], data: [['g', 1, '0x0060']], stack: [['main()', [['x', 5, '0x7ffc'], ['p', '0x6000', '0x7ff4']]], ['foo()', [['a', 5, '0x7fe8'], ['y', 10, '0x7fe4']]]], heap: [['int', 10, '0x6000']], on: 'stack', desc: '呼叫 <code>foo(x)</code>：再推一個 frame（位址更低）。參數 <code>a</code> 是 x 的<b>複製</b>，<code>y</code> 是 foo 的區域變數。' },
      { hl: [5, 10], data: [['g', 1, '0x0060']], stack: [['main()', [['x', 5, '0x7ffc'], ['p', '0x6000', '0x7ff4']]]], heap: [['int', 10, '0x6000']], on: 'stack', desc: '<code>foo</code> 返回：它的 frame <b>自動彈掉</b>，a、y 消失。這就是 Stack 的好處——不用手動釋放，LIFO 自然對應函式呼叫。' },
      { hl: [11], data: [['g', 1, '0x0060']], stack: [['main()', [['x', 5, '0x7ffc'], ['p', '0x6000（dangling）', '0x7ff4']]]], heap: [], on: 'heap', desc: '<code>delete p</code>：Heap 上的那塊被歸還。注意 <code>p</code> 還在 Stack 上，只是它指的東西不存在了（dangling pointer）。忘記 delete 就是 memory leak：Heap 不會自己收。' },
      { hl: [12], data: [['g', 1, '0x0060']], stack: [], heap: [], on: 'stack', desc: '<code>main</code> 返回，最後一個 frame 彈掉。Process 結束，OS 回收<b>全部</b>記憶體（包含沒 delete 的 heap）。' }
    ];
    const codeEl = el.querySelector('.code-block');
    U.stepper(el, steps, s => {
      U.hlLines(codeEl, s.hl);
      el.querySelector('#ml-data-items').innerHTML = s.data.map(d => chip(...d)).join('');
      el.querySelector('#ml-heap-items').innerHTML = s.heap.map(d => chip(...d, 'ok')).join('') || '<div style="color:var(--text-3);font-size:.7rem">（空）</div>';
      el.querySelector('#ml-stack-items').innerHTML = s.stack.slice().reverse().map(f => `<div class="box" style="margin-top:6px;text-align:left"><div style="font-size:.72rem;color:var(--accent-text)">frame: ${f[0]}</div>${f[1].map(v => chip(...v)).join('')}</div>`).join('') || '<div style="color:var(--text-3);font-size:.7rem">（空）</div>';
      ['stack', 'heap', 'data', 'text'].forEach(k => el.querySelector('#ml-' + k).classList.toggle('on', k === s.on));
    }, { autoMs: 2000 });
  };

  /* ---------- Process State Simulator（支援多個 process） ---------- */
  S.processState = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell(o.title || 'Process State Simulator：你來當 OS', o.desc || '選一個 process，觸發事件，看它在狀態圖裡怎麼移動。灰色按鈕 = 在目前狀態下不可能發生的事件。');
    const NODES = { New: [60, 70], Ready: [200, 70], Running: [360, 70], Terminated: [510, 70], Waiting: [280, 190] };
    const EDGES = [
      { id: 'admit', from: 'New', to: 'Ready', label: 'admit', path: 'M 96 70 L 162 70', lx: 129, ly: 60 },
      { id: 'dispatch', from: 'Ready', to: 'Running', label: 'dispatch', path: 'M 236 76 L 322 76', lx: 279, ly: 92 },
      { id: 'timer', from: 'Running', to: 'Ready', label: 'timer interrupt', path: 'M 322 62 Q 279 20 236 62', lx: 279, ly: 36 },
      { id: 'io', from: 'Running', to: 'Waiting', label: 'I/O request', path: 'M 372 92 Q 380 160 318 186', lx: 388, ly: 150 },
      { id: 'iodone', from: 'Waiting', to: 'Ready', label: 'I/O complete', path: 'M 242 186 Q 180 160 196 92', lx: 172, ly: 150 },
      { id: 'exit', from: 'Running', to: 'Terminated', label: 'exit', path: 'M 396 70 L 472 70', lx: 434, ly: 60 }
    ];
    const svg = `<svg viewBox="0 0 570 240"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="var(--text-3)"/></marker></defs>
      ${EDGES.map(e => `<path class="edge" data-e="${e.id}" d="${e.path}"/><text class="edge-label" data-e="${e.id}" x="${e.lx}" y="${e.ly}">${e.label}</text>`).join('')}
      ${Object.entries(NODES).map(([k, [x, y]]) => `<g data-n="${k}"><ellipse class="st" cx="${x}" cy="${y}" rx="38" ry="22"/><text class="st-label" x="${x}" y="${y}">${k}</text><g class="chips" data-chips="${k}"></g></g>`).join('')}
    </svg>`;
    el.innerHTML += `<div class="sim-controls" id="ps-ctl">
        <label>操作對象 <select id="ps-sel"></select></label>
        <button class="btn btn-sm" data-ev="admit">admit</button>
        <button class="btn btn-sm btn-primary" data-ev="dispatch">CPU dispatch</button>
        <button class="btn btn-sm" data-ev="timer">timer interrupt</button>
        <button class="btn btn-sm" data-ev="io">I/O request</button>
        <button class="btn btn-sm" data-ev="iodone">I/O complete</button>
        <button class="btn btn-sm" data-ev="exit">process exit</button>
        <button class="btn btn-sm btn-ghost" id="ps-add">＋ 新增 process</button>
        <button class="btn btn-sm btn-ghost" id="ps-reset">↺ 重設</button>
      </div>
      <div class="viz state-diagram">${svg}</div>
      <div class="viz-row" id="ps-table" style="margin-top:8px"></div>
      <div class="step-log" id="ps-log"></div>`;
    slot.appendChild(el);
    const preset = () => (o.preset || [{ id: 'P1', state: 'New' }]).map(p => Object.assign({}, p));
    let procs = preset(), sel = procs[0].id, log = [], lastEdge = null;
    const byId = id => procs.find(p => p.id === id);
    const running = () => procs.find(p => p.state === 'Running');
    const can = (p, ev) => {
      const e = EDGES.find(x => x.id === ev); if (!p || p.state !== e.from) return false;
      if (ev === 'dispatch' && running()) return false; // 一顆 CPU 只能跑一個
      return true;
    };
    const REASON = {
      admit: p => `${p.id}：OS 完成 PCB 建立、配置記憶體 → 進入 Ready Queue 等 CPU。`,
      dispatch: p => `${p.id}：scheduler 選中它，dispatcher 做 context switch → Running。`,
      timer: p => `${p.id}：時間片用完，timer interrupt 把它踢回 Ready（它還想跑，只是輪到別人）。`,
      io: p => `${p.id}：呼叫 read() 等 I/O → Waiting（Blocked）。即使 CPU 空著，它也不能跑，因為在等資料。`,
      iodone: p => `${p.id}：裝置 interrupt 通知 I/O 完成 → 回到 Ready（不是直接 Running！還要等 scheduler 選它）。`,
      exit: p => `${p.id}：呼叫 exit() → Terminated，OS 回收資源。`
    };
    function apply(ev, pid) {
      const p = byId(pid || sel); if (!can(p, ev)) return false;
      const e = EDGES.find(x => x.id === ev); p.state = e.to; lastEdge = ev;
      log.push(REASON[ev](p)); render(); return true;
    }
    function render() {
      const selEl = el.querySelector('#ps-sel'); selEl.innerHTML = procs.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.id}（${p.state}）</option>`).join('');
      const p = byId(sel);
      el.querySelectorAll('[data-ev]').forEach(b => b.disabled = !can(p, b.dataset.ev));
      el.querySelectorAll('.edge, .edge-label').forEach(x => x.classList.toggle('on', x.dataset.e === lastEdge));
      el.querySelectorAll('[data-n]').forEach(g => g.querySelector('.st').classList.toggle('on', procs.some(q => q.state === g.dataset.n)));
      Object.keys(NODES).forEach(k => {
        const g = el.querySelector(`[data-chips="${k}"]`); const here = procs.filter(q => q.state === k); const [x, y] = NODES[k];
        g.innerHTML = here.map((q, i) => { const idx = procs.indexOf(q); const cx = x - (here.length - 1) * 11 + i * 22; return `<circle cx="${cx}" cy="${y + 30}" r="9" fill="${U.pcolor(idx)}"/><text x="${cx}" y="${y + 31}" font-size="8" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-weight="700">${q.id.replace('P', '')}</text>`; }).join('');
      });
      el.querySelector('#ps-table').innerHTML = procs.map((q, i) => `<span class="q-item ${q.state === 'Running' ? 'run' : q.state === 'Waiting' ? 'wait' : ''}"><span class="pdot" style="background:${U.pcolor(i)}"></span>${q.id}: ${q.state}</span>`).join('');
      el.querySelector('#ps-log').innerHTML = log.length ? log.map((l, i) => `<div class="${i === log.length - 1 ? 'cur' : ''}">${i + 1}. ${l}</div>`).join('') : '<div>（事件紀錄）</div>';
      el.querySelector('#ps-log').scrollTop = 1e6;
    }
    el.querySelector('#ps-sel').addEventListener('change', e => { sel = e.target.value; render(); });
    el.querySelectorAll('[data-ev]').forEach(b => b.addEventListener('click', () => apply(b.dataset.ev)));
    el.querySelector('#ps-add').addEventListener('click', () => { if (procs.length >= 6) return; const id = 'P' + (procs.length + 1); procs.push({ id, state: 'New' }); sel = id; log.push(`${id}：fork()/exec() 建立 → New。`); render(); });
    el.querySelector('#ps-reset').addEventListener('click', () => { procs = preset(); sel = procs[0].id; log = []; lastEdge = null; render(); });
    render();
    // 腳本（Trace mode 用）：依序套用事件
    if (o.script) { let k = 0; const t = setInterval(() => { if (k >= o.script.length) { clearInterval(t); return; } const [ev, pid] = o.script[k++]; sel = pid; apply(ev, pid); }, o.scriptMs || 1300); }
    el.insertAdjacentHTML('beforeend', `<div class="sim-note">${o.note || '試試：讓 P1 admit → dispatch → I/O request，然後新增 P2 並 dispatch 它。注意 P1 的 I/O 完成後<b>回到 Ready</b>，不是直接搶回 CPU。也試試在 P2 Running 時對 P1 按 dispatch——按鈕是灰的，因為 CPU 只有一顆。'}</div>`);
  };

  /* ---------- PCB 與 Context Switch ---------- */
  S.contextSwitch = function (slot, concept) {
    const o = (concept && concept.simOpts) || {};
    const el = U.simShell('Context Switch 動畫：CPU 從 Process A 換到 Process B', '看清楚：任何時刻 CPU 只跑<b>一個</b> process。「同時」是切換得夠快造成的錯覺。');
    const pcb = (id, cls) => `<div class="pcb" id="cs-pcb-${id}"><div class="pcb-title">PCB_${id}（在 kernel 記憶體）</div><div class="kv">
        <span class="k">PID</span><span class="v">${id === 'A' ? 101 : 102}</span>
        <span class="k">State</span><span class="v" id="cs-${id}-state">-</span>
        <span class="k">PC</span><span class="v" id="cs-${id}-pc">-</span>
        <span class="k">Registers</span><span class="v" id="cs-${id}-reg">-</span>
        <span class="k">Sched info</span><span class="v">prio 2</span>
        <span class="k">Memory info</span><span class="v">page table ${id === 'A' ? '0x10' : '0x20'}</span>
      </div></div>`;
    el.innerHTML += `<div class="viz"><div class="viz-row" style="justify-content:space-between;align-items:stretch">
        ${pcb('A')}
        <div class="cpu-box" id="cs-cpu" style="align-self:center"><div class="cpu-title">CPU（只有一組暫存器）</div><div class="kv">
          <span class="k">執行中</span><span class="v" id="cs-cpu-run">-</span>
          <span class="k">PC</span><span class="v" id="cs-cpu-pc">-</span>
          <span class="k">Registers</span><span class="v" id="cs-cpu-reg">-</span>
          <span class="k">Mode</span><span class="v" id="cs-cpu-mode">-</span></div></div>
        ${pcb('B')}
      </div></div>`;
    slot.appendChild(el);
    const steps = [
      { A: ['Running', '0x4010', 'eax=7, ebx=3'], B: ['Ready', '0x8200', 'eax=0, ebx=9'], cpu: ['Process A', '0x4014', 'eax=7, ebx=3', 'user'], on: 'A', desc: 'Process A 正在 CPU 上執行。CPU 的 PC、暫存器都是 A 的值（PCB_A 裡的 PC 是上次保存的，此刻已經過時）。B 在 Ready Queue，它的所有狀態靜靜躺在 PCB_B。' },
      { A: ['Running', '0x4010', 'eax=7, ebx=3'], B: ['Ready', '0x8200', 'eax=0, ebx=9'], cpu: ['（被 timer 打斷）', '0x4018', 'eax=8, ebx=3', 'kernel'], on: 'cpu', cls: 'warn', desc: '<b>Timer Interrupt！</b>CPU 切到 kernel mode，跳進 interrupt handler。A 執行到 PC=0x4018，eax 剛變成 8——這些值<b>只存在 CPU 暫存器裡</b>，如果不保存就永遠消失。' },
      { A: ['Ready', '0x4018', 'eax=8, ebx=3'], B: ['Ready', '0x8200', 'eax=0, ebx=9'], cpu: ['kernel: scheduler', '0x4018', 'eax=8, ebx=3', 'kernel'], on: 'A', desc: '<b>保存 context：</b>kernel 把 CPU 的 PC (0x4018)、暫存器 (eax=8…)、狀態寫進 <b>PCB_A</b>，並把 A 的 state 改成 Ready。現在 A 「可以被完整還原」了。' },
      { A: ['Ready', '0x4018', 'eax=8, ebx=3'], B: ['Ready', '0x8200', 'eax=0, ebx=9'], cpu: ['kernel: scheduler', '-', '-', 'kernel'], on: 'cpu', desc: 'Scheduler 決定：下一個跑 B。（用什麼規則決定，是 Chapter 3 的事。）' },
      { A: ['Ready', '0x4018', 'eax=8, ebx=3'], B: ['Running', '0x8200', 'eax=0, ebx=9'], cpu: ['Process B', '0x8200', 'eax=0, ebx=9', 'kernel→user'], on: 'B', desc: '<b>載入 context：</b>從 <b>PCB_B</b> 把 PC=0x8200、暫存器灌進 CPU，切換 page table（記憶體空間也換了），把 B 的 state 改成 Running。' },
      { A: ['Ready', '0x4018', 'eax=8, ebx=3'], B: ['Running', '0x8200', 'eax=0, ebx=9'], cpu: ['Process B', '0x8204', 'eax=1, ebx=9', 'user'], on: 'B', desc: 'CPU 回到 user mode，從 0x8200 開始執行 B。B 完全不知道剛剛發生了什麼，A 也不知道自己被暫停了。<br><b>重點：</b>整個過程 CPU 沒有做任何「有用的工作」——這段時間叫 <b>context switch overhead</b>（通常幾微秒）。切換越頻繁，浪費越多。' }
    ];
    const set = (id, v) => { const e = el.querySelector('#cs-' + id); if (e.textContent !== v) { e.textContent = v; e.classList.remove('chg'); void e.offsetWidth; e.classList.add('chg'); } };
    U.stepper(el, steps, s => {
      set('A-state', s.A[0]); set('A-pc', s.A[1]); set('A-reg', s.A[2]);
      set('B-state', s.B[0]); set('B-pc', s.B[1]); set('B-reg', s.B[2]);
      set('cpu-run', s.cpu[0]); set('cpu-pc', s.cpu[1]); set('cpu-reg', s.cpu[2]); set('cpu-mode', s.cpu[3]);
      el.querySelector('#cs-pcb-A').classList.toggle('on', s.on === 'A'); el.querySelector('#cs-pcb-B').classList.toggle('on', s.on === 'B'); el.querySelector('#cs-cpu').classList.toggle('on', s.on === 'cpu');
    }, { autoMs: o.autoMs || 2200 });
  };

  /* ---------- Process vs Thread ---------- */
  S.processVsThread = function (slot) {
    const el = U.simShell('同一個 Process 裡的 Threads：什麼共享、什麼各自擁有', '點「新增 thread」或「fork 新 process」，比較兩者要複製多少東西。');
    el.innerHTML += `<div class="sim-controls"><button class="btn btn-sm btn-primary" id="pt-thread">＋ 新增 thread（pthread_create）</button><button class="btn btn-sm" id="pt-fork">＋ fork 新 process</button><button class="btn btn-sm btn-ghost" id="pt-reset">↺</button></div>
      <div class="viz"><div class="viz-row" id="pt-area" style="align-items:stretch"></div></div>
      <div class="sim-readout" id="pt-read"></div>`;
    slot.appendChild(el);
    let procs = [{ threads: 1 }];
    const render = () => {
      el.querySelector('#pt-area').innerHTML = procs.map((p, i) => `<div class="proc-box" style="flex:1;min-width:240px"><div class="proc-title">Process ${String.fromCharCode(65 + i)}（PID ${100 + i}）</div>
        <div class="viz-label">所有 thread 共享</div><div class="shared-row"><span class="box on">Code</span><span class="box on">Data（全域變數）</span><span class="box on">Heap</span><span class="box on">開啟的檔案</span></div>
        <div class="viz-label">每個 thread 各自擁有</div><div class="thread-row">${Array.from({ length: p.threads }, (_, k) => `<div class="thread-box"><div class="t-title">Thread ${k + 1}</div><div class="box" style="font-size:.72rem">Registers</div><div class="box" style="font-size:.72rem;margin-top:3px">PC</div><div class="box" style="font-size:.72rem;margin-top:3px">Stack</div></div>`).join('')}</div></div>`).join('');
      const nt = procs.reduce((s, p) => s + p.threads, 0);
      el.querySelector('#pt-read').innerHTML = `<span>Process 數：<b>${procs.length}</b></span><span>Thread 總數：<b>${nt}</b></span><span>獨立的位址空間（page table）：<b>${procs.length}</b></span><span>Stack 數：<b>${nt}</b></span>`;
    };
    el.querySelector('#pt-thread').addEventListener('click', () => { if (procs[0].threads < 4) procs[0].threads++; render(); });
    el.querySelector('#pt-fork').addEventListener('click', () => { if (procs.length < 3) procs.push({ threads: 1 }); render(); });
    el.querySelector('#pt-reset').addEventListener('click', () => { procs = [{ threads: 1 }]; render(); });
    render();
    el.insertAdjacentHTML('beforeend', `<div class="sim-note"><b>為什麼 thread 比較 lightweight？</b><br>1. <b>建立</b>：新 thread 只要配一個 stack 和一組暫存器；fork 要複製整個位址空間（page table、data、heap……即使有 copy-on-write 也要複製 page table）。<br>2. <b>切換</b>：同 process 的 thread 之間切換不用換 page table，TLB 不用清空（cache 還熱著）；process 切換要換位址空間，cache/TLB 全部失效。<br>3. <b>溝通</b>：thread 直接讀寫共享的 heap/data；process 之間要走 IPC（pipe、shared memory）——但代價是 thread 之間<b>沒有保護</b>，一個 thread 寫壞 heap，全部遭殃。這也是 Chapter 4 race condition 的來源。</div>`);
  };
})(window.Sims);
