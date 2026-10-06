/* ============================================================
   Ch0：OS 是什麼 — 分層圖、User/Kernel Mode 與 System Call、Interrupt
   ============================================================ */
(function (S) {
  const U = Util;

  /* ---------- 分層圖：Application → OS → Hardware ---------- */
  S.osLayers = function (slot) {
    const el = U.simShell('三層架構：點一層，看它負責什麼', '也可以切換「如果沒有 OS」，看看每個應用程式得自己做哪些事。');
    el.innerHTML += `
      <div class="sim-controls"><label><input type="checkbox" id="no-os"> 如果沒有 OS……</label></div>
      <div class="viz"><div class="layers" id="layers">
        <div class="layer" data-k="app">Application<span class="sub">Chrome、Spotify、VS Code、你寫的 a.out</span></div>
        <div class="arrow-v">↓ system call ／ ↑ 結果、signal</div>
        <div class="layer" data-k="os">Operating System<span class="sub">Kernel：排程、記憶體、檔案、裝置、保護</span></div>
        <div class="arrow-v">↓ 特權指令、I/O 指令 ／ ↑ interrupt</div>
        <div class="layer" data-k="hw">Hardware<span class="sub">CPU、RAM、磁碟、網卡、鍵盤</span></div>
      </div></div>
      <div class="sim-note" id="layer-note">點上面任一層。</div>`;
    slot.appendChild(el);
    const NOTE = {
      app: '<b>Application</b>：只關心「自己的邏輯」。它不知道 RAM 有幾條、磁碟是 SSD 還是 HDD，也不知道旁邊還有 50 個 process。它要什麼（讀檔、開網路、要記憶體）就<b>請 OS 幫忙</b>——透過 system call。',
      os: '<b>Operating System（Kernel）</b>：唯一能直接碰硬體的軟體。它把「一顆 CPU、一塊 RAM、一顆磁碟」<b>抽象</b>成「每個程式都好像獨占一台電腦」（虛擬化），並在程式之間<b>仲裁</b>（誰先用 CPU、誰能碰哪塊記憶體）與<b>保護</b>（A 不能讀 B 的資料）。',
      hw: '<b>Hardware</b>：只會做很低階的事——「把這個位址的值搬到暫存器」「把這個磁區讀進 RAM」。它不知道「檔案」「視窗」「使用者」是什麼；這些都是 OS 建立的抽象概念。'
    };
    const NO_OS = {
      app: '<b>沒有 OS 的 Application</b>：得自己寫磁碟驅動程式、自己決定資料放在 RAM 哪裡、自己處理鍵盤中斷……而且一次只能跑一個程式（沒有人負責切換）。1950 年代真的是這樣：程式員直接對硬體寫程式。',
      os: '<b>沒有 OS</b>：這一層消失。沒有人負責分配 CPU 時間、沒有人保護記憶體、沒有 file system（磁碟只是一堆磁區）、任何程式當掉就是整台機器當掉。',
      hw: '<b>Hardware</b>：照舊。硬體不在乎有沒有 OS——它只是執行指令。差別在於「誰來下指令」：有 OS 時是 kernel 統一管理，沒有時是每個程式各自為政。'
    };
    let cur = null;
    const render = () => { const noos = el.querySelector('#no-os').checked; el.querySelectorAll('.layer').forEach(l => { l.classList.toggle('on', l.dataset.k === cur); if (l.dataset.k === 'os') l.style.opacity = noos ? .25 : 1; }); el.querySelector('#layer-note').innerHTML = cur ? (noos ? NO_OS[cur] : NOTE[cur]) : (noos ? '沒有 OS：Application 直接面對硬體。點一層看細節。' : '點上面任一層。'); };
    el.querySelectorAll('.layer').forEach(l => l.addEventListener('click', () => { cur = l.dataset.k; render(); }));
    el.querySelector('#no-os').addEventListener('change', render);
  };

  /* ---------- System Call 模擬：read(fd, buf, size) 的完整旅程 ---------- */
  S.syscallSim = function (slot, concept) {
    const el = U.simShell('System Call Simulator：一次 read() 到底發生什麼事', '左邊是程式碼（會標示目前執行到哪一行），右邊是 CPU 的模式與各層的狀態。注意「模式」在哪一步切換。');
    const code = `char buf[100];
int n = read(fd, buf, 100);   // 使用者程式呼叫 library function
// ---- libc 內部 ----
mov  eax, SYS_read           // 把 system call 編號放進暫存器
mov  edi, fd
mov  rsi, buf
mov  edx, 100
syscall                      // trap：切到 kernel mode
// ---- kernel：sys_read() ----
check_fd_and_permission(fd);
device_driver_read(...);      // 對硬體下指令、等待 I/O 完成
copy_to_user(buf, kernel_buf, n);
return n;                     // sysret：切回 user mode
// ---- 回到使用者程式 ----
printf("%d bytes", n);`;
    el.innerHTML += `<div class="sim-split">
      <div><div class="viz-label">程式碼</div>${U.code(code, { title: 'user program + libc + kernel' })}</div>
      <div>
        <div class="viz-label">CPU 狀態</div>
        <div class="viz"><div class="kv">
          <span class="k">Mode bit</span><span class="v" id="sc-mode">0（user）</span>
          <span class="k">正在執行</span><span class="v" id="sc-where">User program</span>
          <span class="k">能碰硬體？</span><span class="v" id="sc-hw">否</span>
        </div></div>
        <div class="layers" id="sc-layers">
          <div class="layer" data-k="app">User Program<span class="sub">user mode</span></div>
          <div class="layer" data-k="lib">libc wrapper<span class="sub">user mode</span></div>
          <div class="layer kernel-mode" data-k="os">Kernel：sys_read()<span class="sub">kernel mode</span></div>
          <div class="layer" data-k="dev">Device / Disk<span class="sub">hardware</span></div>
        </div>
      </div></div>`;
    slot.appendChild(el);
    const steps = [
      { hl: [1, 2], mode: 0, where: 'User program', layer: 'app', desc: '程式想讀檔案。但它<b>不能</b>直接對磁碟下指令——它在 user mode，I/O 指令是特權指令，執行會被 CPU 拒絕（trap）。所以它呼叫 <code>read()</code>。' },
      { hl: [4, 5, 6, 7], mode: 0, where: 'libc（仍是 user mode）', layer: 'lib', desc: '<code>read()</code> 其實是 libc 提供的包裝函式：把 system call 編號（SYS_read）和參數放進固定的暫存器。這一步<b>還是 user mode</b>。' },
      { hl: [8], mode: 1, where: '進入 kernel（trap handler）', layer: 'os', desc: '<b>關鍵一步：<code>syscall</code> 指令</b>。CPU 把 mode bit 從 0 切到 1（kernel mode），保存返回位址，跳到 kernel 事先登記好的 system call 進入點。這是<b>唯一</b>從 user mode 進入 kernel 的合法途徑之一（另一個是 interrupt）。' },
      { hl: [10], mode: 1, where: 'Kernel：sys_read()', layer: 'os', desc: 'Kernel 先<b>檢查</b>：這個 fd 是這個 process 開過的嗎？有讀取權限嗎？buf 指向的記憶體是它自己的嗎？——這就是為什麼 system call 是「守門員」：所有硬體存取都要經過檢查。' },
      { hl: [11], mode: 1, where: 'Kernel → Device driver', layer: 'dev', desc: 'Kernel 透過 device driver 對磁碟控制器下指令。這段通常要等很久（毫秒級），所以 kernel 會把這個 process 設為 <b>Waiting</b>，把 CPU 給別人；磁碟做完會用 <b>interrupt</b> 通知。' },
      { hl: [12], mode: 1, where: 'Kernel：sys_read()', layer: 'os', desc: '資料先進 kernel 的緩衝區，再<b>複製</b>到使用者的 <code>buf</code>。Kernel 不會讓使用者程式直接碰 kernel 記憶體。' },
      { hl: [13], mode: 0, where: '返回 user program', layer: 'app', desc: '<code>sysret</code>：mode bit 切回 0，回到 <code>syscall</code> 的下一條指令。回傳值（讀到的 byte 數）放在暫存器。' },
      { hl: [15], mode: 0, where: 'User program', layer: 'app', desc: '程式繼續執行。從它的角度看，只是「呼叫了一個函式」；但中間經歷了兩次模式切換、一次 I/O、可能還有一次 context switch。<br><b>結論：</b>Application 不能直接控制硬體，因為 user mode 沒有權限；所有硬體操作都必須經由 system call 交給 kernel 代為執行，kernel 才能檢查、仲裁、保護。' }
    ];
    const codeEl = el.querySelector('.code-block');
    U.stepper(el, steps, s => {
      U.hlLines(codeEl, s.hl);
      el.querySelector('#sc-mode').textContent = s.mode ? '1（kernel）' : '0（user）';
      el.querySelector('#sc-mode').style.color = s.mode ? 'var(--danger)' : 'var(--success)';
      el.querySelector('#sc-where').textContent = s.where; el.querySelector('#sc-hw').textContent = s.mode ? '是' : '否';
      el.querySelectorAll('#sc-layers .layer').forEach(l => l.classList.toggle('on', l.dataset.k === s.layer));
    }, { autoMs: 1800 });
  };

  /* ---------- Interrupt：硬體打斷 CPU ---------- */
  S.interruptSim = function (slot) {
    const el = U.simShell('Interrupt：硬體怎麼「打斷」CPU', 'CPU 正在跑 P1，磁碟突然說「資料好了」。看 CPU 如何暫停、處理、再回來。');
    el.innerHTML += `<div class="viz"><div class="viz-row" style="justify-content:space-between">
        <div class="cpu-box" id="ir-cpu"><div class="cpu-title">CPU</div><div class="kv"><span class="k">執行中</span><span class="v" id="ir-run">P1</span><span class="k">PC</span><span class="v" id="ir-pc">0x4010</span><span class="k">Mode</span><span class="v" id="ir-mode">user</span></div></div>
        <div class="box" id="ir-dev" style="align-self:center">💽 Disk controller<br><span id="ir-devs">busy…</span></div>
        <div class="box" id="ir-ivt">Interrupt Vector Table<br>#14 → disk_handler()</div>
      </div>
      <div style="margin-top:10px"><div class="viz-label">Kernel stack（保存的狀態）</div><div class="queue" id="ir-stack"><span class="q-empty">（空）</span></div></div></div>`;
    slot.appendChild(el);
    const steps = [
      { run: 'P1', pc: '0x4010', mode: 'user', dev: 'busy…', stack: [], on: 'cpu', desc: 'CPU 正在執行 P1 的指令，PC = 0x4010。磁碟正在背景搬資料（之前 P3 要求的）。' },
      { run: 'P1', pc: '0x4014', mode: 'user', dev: '完成！拉 IRQ 線', stack: [], on: 'dev', desc: '磁碟控制器做完了，把 CPU 的 <b>interrupt request 線</b>拉高。CPU 每執行完一條指令都會檢查這條線。' },
      { run: '（暫停 P1）', pc: '0x4014', mode: 'kernel', dev: 'IRQ pending', stack: ['PC=0x4014', 'PSW/flags', 'registers'], on: 'cpu', desc: 'CPU <b>自動</b>：切到 kernel mode、把 P1 的 PC 與狀態推進 kernel stack（不然回不來）。P1 本身完全不知道自己被打斷。' },
      { run: 'disk_handler()', pc: 'handler', mode: 'kernel', dev: 'ACK', stack: ['PC=0x4014', 'PSW/flags', 'registers'], on: 'ivt', desc: '查 <b>Interrupt Vector Table</b>：磁碟中斷編號 14 對應 <code>disk_handler()</code>。跳過去執行。Handler 把資料處理好，把 P3 從 Waiting 改成 Ready。' },
      { run: 'P1（恢復）', pc: '0x4014', mode: 'user', dev: 'idle', stack: [], on: 'cpu', desc: 'Handler 結束，從 kernel stack 還原 PC 與暫存器，切回 user mode。P1 從 0x4014 繼續，好像什麼都沒發生。<br><b>注意：</b>如果 scheduler 決定此時應該換 P3 跑（例如 P3 優先權較高），回來的就不是 P1 而是 P3——這就是 interrupt 引發 context switch 的情況。' }
    ];
    U.stepper(el, steps, s => {
      el.querySelector('#ir-run').textContent = s.run; el.querySelector('#ir-pc').textContent = s.pc; el.querySelector('#ir-mode').textContent = s.mode;
      el.querySelector('#ir-mode').style.color = s.mode === 'kernel' ? 'var(--danger)' : 'var(--success)';
      el.querySelector('#ir-devs').textContent = s.dev;
      el.querySelector('#ir-stack').innerHTML = s.stack.length ? s.stack.map(x => `<span class="q-item">${x}</span>`).join('') : '<span class="q-empty">（空）</span>';
      el.querySelector('#ir-cpu').classList.toggle('on', s.on === 'cpu'); el.querySelector('#ir-dev').classList.toggle('on', s.on === 'dev'); el.querySelector('#ir-ivt').classList.toggle('on', s.on === 'ivt');
    });
  };

  /* ---------- 特權指令：user mode 試著直接碰硬體 ---------- */
  S.privilegedDemo = function (slot) {
    const el = U.simShell('試試看：在 user mode 直接執行特權指令會怎樣？', '選一條指令，看 CPU 的反應。');
    el.innerHTML += `<div class="sim-controls">
        <button class="btn btn-sm" data-i="add">add eax, 1（一般指令）</button>
        <button class="btn btn-sm" data-i="in">in al, 0x60（讀鍵盤 port）</button>
        <button class="btn btn-sm" data-i="cli">cli（關閉 interrupt）</button>
        <button class="btn btn-sm" data-i="mov">mov cr3, eax（改 page table）</button>
      </div><div class="sim-note" id="pd-note">在 user mode 執行時……</div>`;
    slot.appendChild(el);
    const R = {
      add: '<b>✓ 正常執行。</b>算術、搬資料、跳躍這些「不會影響別人」的指令，user mode 隨便用。',
      in: '<b>✗ Trap！</b>直接讀 I/O port 是特權指令。CPU 產生 general protection fault，跳進 kernel；kernel 通常會把這個 process 殺掉（Segmentation fault）。想讀鍵盤請走 system call：<code>read(0, buf, n)</code>。',
      cli: '<b>✗ Trap！</b>如果 user 程式能關掉 interrupt，timer interrupt 就不會來，OS 永遠拿不回 CPU——一個無窮迴圈就能鎖死整台機器。所以只有 kernel 能做。',
      mov: '<b>✗ Trap！</b>改 page table 暫存器等於「重新定義我能看到哪些記憶體」。允許的話，任何程式都能讀其他程式（或 kernel）的記憶體。'
    };
    el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { el.querySelector('#pd-note').innerHTML = R[b.dataset.i]; el.querySelector('#pd-note').style.color = b.dataset.i === 'add' ? 'var(--success)' : 'var(--danger)'; }));
  };
})(window.Sims);
