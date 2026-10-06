/* Chapter 1：Process */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch1', num: 1, title: 'Process：程式活起來之後', topic: 'process',
  subtitle: 'Program vs Process、記憶體配置、Process State、PCB、Context Switch。',
  why: R`<p>Chrome、Spotify、VS Code 同時開著，CPU 只有幾顆。OS 到底怎麼讓它們「看起來」同時在跑？答案需要三個零件：一個描述「正在執行的程式」的單位（<b>process</b>）、一個記錄它進度的資料結構（<b>PCB</b>）、一個在它們之間切換的機制（<b>context switch</b>）。這章把三個零件一個一個拆開看。</p>`,
  concepts: [
    {
      id: 'program-process',
      title: '程式與行程（Program vs Process）',
      en: 'A program is a passive file on disk. A process is a program in execution: code plus its current state (PC, registers, stack, heap, open files).',
      why: R`<p>如果「程式」和「正在跑的程式」是同一件事，那開兩個 Chrome 視窗、或兩個人同時執行同一個 <code>ls</code>，它們就會共用同一份變數、同一個進度——顯然不對。OS 需要一個「執行中的實例」的概念，每個實例有自己的狀態。</p>`,
      scenario: R`<p><code>chrome.exe</code> 躺在硬碟上，是一份 120 MB 的檔案：機器碼＋初始資料。它不會「動」。</p><p>你雙擊它：OS 把它載進記憶體、建立 stack 和 heap、設定 PC 指向第一條指令、登記在 process 表裡——現在它是一個 <b>process</b>，PID 1204。再雙擊一次：另一個 process，PID 1337，有自己的記憶體、自己的進度。同一份食譜，兩鍋各煮各的。</p>`,
      how: R`<p>執行一個程式時，OS 做的事（<code>fork</code> + <code>exec</code> 的效果）：</p>
<ol>
<li>配置一個 <b>PID</b>，建立 <b>PCB</b>（下下節）。</li>
<li>建立<b>位址空間</b>：把程式的 text（機器碼）和 data 段從檔案載入（或 lazy 載入），配置 stack 與 heap。</li>
<li>設定初始暫存器：PC 指向程式進入點、SP 指向 stack 頂端。</li>
<li>把 process 放進 Ready Queue，等 scheduler 挑它上 CPU。</li>
</ol>`,
      sim: 'programVsProcess',
      definition: R`<table class="vs-table"><tr><th></th><th>Program（程式）</th><th>Process（行程）</th></tr>
<tr><td>本質</td><td>被動的檔案：指令 + 資料</td><td>主動的實體：指令 + 目前狀態</td></tr>
<tr><td>存在位置</td><td>磁碟</td><td>記憶體（+ kernel 的 PCB）</td></tr>
<tr><td>擁有什麼</td><td>程式碼、初始資料</td><td>PC、暫存器、stack、heap、開啟的檔案、PID、狀態</td></tr>
<tr><td>數量關係</td><td>一份 program</td><td>可以對應多個 process</td></tr></table>
<p><b>Process = program in execution</b>：這句定義現在讀起來應該很自然——它就是「程式 + 執行到哪裡 + 目前的資料」。</p>`,
      code: { title: 'fork.c — 一個 program，變成兩個 process', src: `#include <stdio.h>
#include <unistd.h>

int main() {
    int x = 10;
    pid_t pid = fork();          // 從這裡開始有兩個 process，各自一份 x
    if (pid == 0) {
        x += 1;                  // child 改自己的 x
        printf("child:  x = %d\\n", x);   // 11
    } else {
        x += 100;                // parent 改自己的 x
        printf("parent: x = %d\\n", x);   // 110
    }
    return 0;
}`, note: '<code>fork()</code> 複製整個 process（位址空間、PCB 大部分欄位），回傳值在 child 是 0、在 parent 是 child 的 PID。兩邊的 x 互不影響——因為它們是兩個 process，各有各的記憶體。' },
      checkpoint: [
        { id: 'ch1-pp-1', type: 'concept', q: 'Program 與 Process 最本質的差別是？', options: ['Process 比較大', 'Program 是磁碟上的被動檔案；Process 是執行中的實體，帶有 PC、暫存器、stack 等狀態', 'Program 用 C 寫，Process 用組合語言', 'Process 只能有一個'], answer: 1, explanation: '「執行中」意味著有進度（PC）和動態資料（stack/heap）。同一 program 可以產生多個 process。' },
        { id: 'ch1-pp-2', type: 'code', q: '執行下列程式，最後兩行輸出各是什麼？', code: `int x = 5;
pid_t p = fork();
if (p == 0) x = x * 2;
else        x = x + 1;
printf("%d\\n", x);`, options: ['兩行都印 10', '兩行都印 6', '一行 10（child）、一行 6（parent）', '一行 11、一行 12'], answer: 2, hint: 'fork 之後 x 有幾份？', explanation: 'fork 後兩個 process 各有一份 x。child（p==0）把它變 10；parent 把它變 6。彼此看不到對方的修改。' },
        { id: 'ch1-pp-3', type: 'scenario', q: '開兩個終端機各執行一次同一個 <code>./a.out</code>，其中一個當掉（segfault）。另一個會？', options: ['也一起當掉，因為是同一個 program', '不受影響，因為它們是不同的 process，記憶體互相隔離', '會暫停等待第一個重啟', '會收到對方的資料'], answer: 1, explanation: 'Process 之間有獨立的位址空間，OS 保護它們互不干擾。這正是 process 抽象的價值之一。' }
      ]
    },
    {
      id: 'memory-layout',
      title: 'Process 的記憶體配置：Text / Data / Heap / Stack',
      en: 'A process address space has four regions: text (code), data (globals), heap (dynamic, grows up), and stack (locals and calls, grows down).',
      why: R`<p>面試必考：「Heap 和 Stack 有什麼差別？」<code>int x = 5; int* p = new int(10);</code>——x 在哪？p 在哪？那個 10 在哪？講不清楚這題，後面 thread 共享什麼、為什麼會 memory leak、stack overflow 是什麼都講不清楚。</p>`,
      scenario: R`<p>一個 process 眼中的記憶體是一條從 0 到很大的連續空間（實際上是虛擬的，Ch7 會揭曉）。OS 和編譯器把它分成幾區：</p>
<pre style="font-family:var(--mono);font-size:.82rem;line-height:1.45;background:var(--code-bg);padding:12px 16px;border-radius:6px;display:inline-block">High Address
┌─────────────┐
│   Stack     │ ← 區域變數、參數、返回位址（往下長）
│      ↓      │
│             │
│      ↑      │
│   Heap      │ ← new / malloc（往上長）
├─────────────┤
│    Data     │ ← 全域變數、static 變數
├─────────────┤
│    Text     │ ← 機器碼（唯讀）
└─────────────┘
Low Address</pre>
<p>Stack 和 Heap 從兩端往中間長——這樣任何一邊需要多一點時都有空間，直到兩邊撞在一起（或撞到限制）。</p>`,
      how: R`<ul>
<li><b>Text</b>：程式的機器碼。唯讀、大小固定、可以被多個 process 共享（兩個 Chrome 共用同一份 code）。</li>
<li><b>Data</b>：全域變數與 static 變數。大小在編譯時決定，整個 process 存活期間都在。</li>
<li><b>Heap</b>：<code>malloc</code> / <code>new</code> 要的空間。大小執行期才知道、由程式員手動管理（<code>free</code> / <code>delete</code>）、忘了還就是 <b>memory leak</b>。</li>
<li><b>Stack</b>：每呼叫一個函式就推一個 <b>stack frame</b>（參數、區域變數、返回位址），函式返回就彈掉。自動管理、LIFO、很快，但大小有限（通常 8 MB）——遞迴太深就 <b>stack overflow</b>。</li>
</ul>`,
      sim: 'memoryLayout',
      definition: R`<table class="vs-table"><tr><th></th><th>Stack</th><th>Heap</th></tr>
<tr><td>放什麼</td><td>區域變數、函式參數、返回位址</td><td>動態配置的物件（new / malloc）</td></tr>
<tr><td>誰管理</td><td>編譯器自動（函式返回即釋放）</td><td>程式員手動（或 GC）</td></tr>
<tr><td>配置速度</td><td>極快（移動 SP 一個指令）</td><td>較慢（要找空間、可能碎片化）</td></tr>
<tr><td>大小</td><td>有限（例如 8 MB），超過即 stack overflow</td><td>受限於虛擬記憶體，可以很大</td></tr>
<tr><td>生命週期</td><td>函式作用域</td><td>直到 free / delete</td></tr>
<tr><td>常見錯誤</td><td>回傳區域變數的位址、遞迴過深</td><td>memory leak、double free、dangling pointer</td></tr>
<tr><td>Thread</td><td>每個 thread 一個</td><td>同 process 的 thread 共享</td></tr></table>`,
      code: { title: 'where.cpp — 每個東西住在哪', src: `int g = 1;                // Data（全域）
static int cnt = 0;       // Data（static）

int* make() {
    int local = 3;        // Stack（make 的 frame）
    int* q = new int(7);  // q 在 Stack；*q（那個 7）在 Heap
    return q;             // 回傳 heap 位址 → 安全；若回傳 &local → 危險（frame 已消失）
}

int main() {
    int x = 5;            // Stack（main 的 frame）
    int* p = new int(10); // p：Stack；new int(10)：Heap
    int* r = make();      // r：Stack，指向 heap 上的 7
    delete p; delete r;   // 歸還 heap；p、r 本身仍在 stack 上直到 main 返回
}`, note: '<b>x 在 Stack、p 在 Stack、new int(10) 在 Heap。</b>「指標本身」和「指標指向的東西」住在不同地方——這是最常混淆的點。' },
      checkpoint: [
        { id: 'ch1-mem-1', type: 'code', q: '<code>int* p = new int(10);</code> 執行在 main() 裡。下列何者正確？', options: ['p 和 10 都在 heap', 'p 和 10 都在 stack', 'p 在 stack，10 在 heap', 'p 在 heap，10 在 stack'], answer: 2, explanation: 'p 是 main 的區域變數（stack），它的值是一個 heap 位址；new 出來的 int 住在 heap。' },
        { id: 'ch1-mem-2', type: 'code', q: '這段程式有什麼問題？', code: `int* f() {
    int a = 42;
    return &a;
}`, options: ['沒問題', '回傳了 stack 上區域變數的位址，函式返回後該記憶體已無效（dangling pointer）', '會 memory leak', 'a 應該宣告成 static 才能回傳值'], answer: 1, hint: 'f 返回時它的 stack frame 怎麼了？', explanation: 'f 的 frame 在返回時彈掉，&a 指向已被回收的 stack 空間，之後的讀寫是未定義行為。' },
        { id: 'ch1-mem-3', type: 'concept', q: '為什麼 stack 配置比 heap 快得多？', options: ['因為 stack 在 cache 裡', '因為 stack 配置只是移動 stack pointer，heap 要搜尋合適的空閒區塊並處理碎片', '因為 stack 比較小', '其實 heap 比較快'], answer: 1, explanation: 'Stack 是 LIFO，配置／釋放就是 SP 加減；heap 是一般化的動態配置器，要維護空閒串列。' },
        { id: 'ch1-mem-4', type: 'scenario', q: '一個遞迴函式沒有終止條件，最後程式會因為什麼而崩潰？', options: ['Heap 用完（memory leak）', 'Stack overflow：每層呼叫推一個 frame，超過 stack 上限', 'Data 段溢位', 'Text 段被覆寫'], answer: 1, explanation: '每次呼叫都在 stack 推 frame，stack 大小有限（常見 8 MB），超出即 stack overflow（通常表現為 segfault）。' }
      ]
    },
    {
      id: 'process-state',
      title: 'Process 狀態（Process State）',
      en: 'A process moves among New, Ready, Running, Waiting, and Terminated. Only one process per CPU is Running; the rest are waiting for the CPU or for an event.',
      why: R`<p>300 個 process、4 顆 CPU。任何時刻最多 4 個真的在執行——其他 296 個在做什麼？有的在等 CPU（想跑但沒輪到），有的在等磁碟或網路（就算給它 CPU 也沒用）。OS 必須<b>區分這兩種「沒在跑」</b>，否則 scheduler 會把 CPU 給一個正在等資料的 process，白白浪費。</p>`,
      scenario: R`<p>醫院掛號：你拿到號碼牌（<b>New → Ready</b>），坐在候診區等叫號（<b>Ready</b>），叫到你進去看診（<b>Running</b>），醫生說先去抽血（<b>Waiting</b>：等檢驗結果，就算診間空著你也不能進去），抽完回候診區等（<b>Waiting → Ready</b>），再叫到你（<b>Running</b>），看完離開（<b>Terminated</b>）。中間如果醫生說「你先出去讓下一位」（<b>timer interrupt：Running → Ready</b>），你回候診區但不用重新掛號。</p>`,
      how: R`<pre style="font-family:var(--mono);font-size:.82rem;line-height:1.45;background:var(--code-bg);padding:12px 16px;border-radius:6px;display:inline-block">        admit          dispatch
 New ─────────▶ Ready ◀──────────▶ Running ──exit──▶ Terminated
                  ▲    timer/preempt    │
                  │                     │ I/O request
                  │   I/O complete      ▼
                  └───────────────── Waiting</pre>
<p>五個轉換，每個都有明確的觸發者：</p>
<ul>
<li><b>Ready → Running</b>（dispatch）：scheduler 選它，dispatcher 做 context switch。</li>
<li><b>Running → Ready</b>（timer interrupt / 被搶佔）：它還能跑，只是輪到別人。</li>
<li><b>Running → Waiting</b>（I/O request、wait()、等 lock）：它<b>自己</b>要求等某件事。</li>
<li><b>Waiting → Ready</b>（I/O complete、事件發生）：由 interrupt handler 改狀態。注意是回到 <b>Ready</b>，不是 Running。</li>
<li><b>Running → Terminated</b>（exit）：正常結束或被殺。</li>
</ul>`,
      sim: 'processState',
      definition: R`<ul>
<li><b>New</b>：正在被建立（PCB 配置中、尚未進入 Ready Queue）。</li>
<li><b>Ready</b>：具備執行條件，等待被分配 CPU。所有 Ready 的 process 在 <b>Ready Queue</b>。</li>
<li><b>Running</b>：指令正在 CPU 上執行。每顆 CPU 同時最多一個。</li>
<li><b>Waiting / Blocked</b>：等待某事件（I/O 完成、signal、lock 釋放）。在對應的 <b>device queue / wait queue</b>。</li>
<li><b>Terminated</b>：執行結束，等待 OS 回收資源（在 Linux 上父 process 尚未 wait() 時稱為 zombie）。</li>
</ul>`,
      checkpoint: [
        { id: 'ch1-st-1', type: 'trace', q: 'P1 Running 時呼叫 <code>read()</code> 讀磁碟。此時 P1 進入哪個狀態？資料到了之後又進入哪個狀態？', options: ['Ready → Running', 'Waiting → Running', 'Waiting → Ready', 'Ready → Waiting'], answer: 2, hint: 'I/O 完成後需要等 scheduler 嗎？', explanation: '等 I/O 是 Waiting；I/O 完成後回到 Ready Queue 排隊，不會直接搶回 CPU。' },
        { id: 'ch1-st-2', type: 'concept', q: 'Ready 與 Waiting 的關鍵差別是？', options: ['Ready 的優先權比較高', 'Ready 只差 CPU 就能跑；Waiting 就算給 CPU 也不能跑，因為在等某個事件', 'Waiting 的 process 已經結束', '沒有差別，都是沒在跑'], answer: 1, explanation: 'Scheduler 只從 Ready Queue 挑人，正因為 Waiting 的 process 給了 CPU 也無事可做。' },
        { id: 'ch1-st-3', type: 'trace', q: '單核系統。P1 Running、P2 Ready、P3 Waiting。發生 timer interrupt 且 scheduler 決定換 P2。三者的新狀態是？', options: ['P1 Waiting、P2 Running、P3 Ready', 'P1 Ready、P2 Running、P3 Waiting', 'P1 Terminated、P2 Running、P3 Ready', 'P1 Ready、P2 Running、P3 Ready'], answer: 1, explanation: 'Timer interrupt 把 P1 踢回 Ready（它沒在等任何事件）；P3 仍在等 I/O，與 timer 無關。' },
        { id: 'ch1-st-4', type: 'concept', q: '一台 4 核電腦，處於 Running 狀態的 process 最多幾個？', options: ['1', '4', '無上限', '等於 Ready Queue 長度'], answer: 1, explanation: 'Running 代表指令正在某顆 CPU 上執行；一顆 CPU 一次只能執行一個。' }
      ]
    },
    {
      id: 'pcb',
      title: 'Process Control Block（PCB）與 Program Counter',
      en: 'The PCB is the kernel data structure holding everything needed to stop a process and later resume it exactly where it left off.',
      why: R`<p>要把一個 process 暫停、去跑別的、之後再回來<b>從同一個地方繼續</b>，OS 必須記住它「跑到哪裡」和「當時所有的暫存器值」。這些東西在 CPU 裡只有一份——換人跑就會被覆蓋。所以要有個地方存起來：每個 process 一個 PCB。</p>`,
      scenario: R`<p>PCB 是 process 的「身分證 + 存檔點」。OS 的 process 表就是一堆 PCB；Ready Queue、wait queue 裡排的其實都是 PCB 的指標。</p>
<pre style="font-family:var(--mono);font-size:.82rem;line-height:1.45;background:var(--code-bg);padding:12px 16px;border-radius:6px;display:inline-block">┌──────────────────────────┐
│ PID            1204      │
│ State          Ready     │
│ Program Counter 0x4018   │ ← 下一條要執行的指令位址
│ CPU Registers  eax=8…    │ ← 暫停當下的所有暫存器
│ Scheduling     prio 2,   │
│   info         used 35ms │
│ Memory info    page table│ ← 位址空間在哪
│ Open files     fd 0,1,2,3│
│ Accounting     cpu time  │
│ Parent         PID 1000  │
└──────────────────────────┘</pre>`,
      how: R`<p><b>Program Counter 到底是什麼？</b>CPU 裡的一個暫存器，存「下一條要執行的指令的位址」。CPU 的迴圈就是：讀 PC 指向的指令 → 執行 → PC 加上指令長度（或跳到別處）→ 重複。所以「process 跑到哪裡」<b>完全由 PC 決定</b>；把 PC 存起來，就是把進度存起來。</p>
<p>Context switch 時（下一節），kernel 把 CPU 的 PC 和暫存器<b>複製到 PCB</b>；要恢復時再<b>從 PCB 複製回 CPU</b>。PCB 裡的 PC 只有在 process 沒在跑時才是「正確的」——它在跑的時候，真正的 PC 在 CPU 裡。</p>`,
      definition: R`<p><b>PCB（Process Control Block，又稱 task_struct）</b>：kernel 為每個 process 維護的資料結構，包含：</p>
<ul>
<li><b>Process ID</b>：唯一識別碼。</li>
<li><b>Process State</b>：New / Ready / Running / Waiting / Terminated。</li>
<li><b>Program Counter</b>：下一條指令的位址。</li>
<li><b>CPU Registers</b>：通用暫存器、stack pointer、狀態暫存器——暫停時的快照。</li>
<li><b>CPU Scheduling Information</b>：優先權、在哪個 queue、已用的 CPU 時間。</li>
<li><b>Memory-Management Information</b>：page table 指標、base/limit。</li>
<li><b>Accounting / I/O Status</b>：CPU 使用量、開啟的檔案、配置的裝置。</li>
</ul>`,
      code: { title: '簡化版 PCB（Linux 的 task_struct 有數百個欄位）', src: `struct pcb {
    int        pid;
    enum { NEW, READY, RUNNING, WAITING, TERMINATED } state;
    uint64_t   pc;                 // program counter
    uint64_t   regs[16];           // 通用暫存器快照
    uint64_t   sp;                 // stack pointer
    int        priority;
    uint64_t   cpu_time_used;
    struct page_table* pgd;        // 位址空間
    struct file* fd_table[MAX_FD]; // 開啟的檔案
    struct pcb* parent;
    struct pcb* next;              // 串在 ready queue / wait queue 上
};` },
      checkpoint: [
        { id: 'ch1-pcb-1', type: 'concept', q: 'Program Counter 是什麼？', options: ['程式已執行的指令總數', 'CPU 中存放「下一條要執行的指令位址」的暫存器', 'process 的優先權', '程式碼的行數'], answer: 1, explanation: 'PC 決定 CPU 接下來執行哪一條指令；保存／還原 PC 就是保存／還原執行進度。' },
        { id: 'ch1-pcb-2', type: 'scenario', q: 'P1 正在 Running。此時 PCB_1 裡存的 PC 值與 CPU 的 PC 暫存器，哪個是「正確的目前進度」？', options: ['PCB_1 裡的', 'CPU 暫存器裡的', '兩者永遠相同', '都不是'], answer: 1, hint: 'PCB 是什麼時候被寫入的？', explanation: 'PCB 裡的 PC 是上次 context switch 時存的快照；process 執行時，真正的進度在 CPU 暫存器裡，PCB 的值已過時。' },
        { id: 'ch1-pcb-3', type: 'concept', q: 'Ready Queue 裡實際上排的是什麼？', options: ['process 的機器碼', 'process 的 PCB（或其指標）', 'process 的 stack', '使用者的視窗'], answer: 1, explanation: 'Kernel 的各種 queue 都是把 PCB 串起來；scheduler 挑選的也是 PCB。' }
      ]
    },
    {
      id: 'context-switch',
      title: '內容切換（Context Switch）',
      en: 'A context switch saves the running process state into its PCB and loads another PCB into the CPU. It is pure overhead: no useful work happens during it.',
      why: R`<p>有了 PCB，OS 就能在 process 之間切換。但要理解一件常被誤會的事：<b>context switch 不是「兩個 process 同時跑」</b>——它是 CPU 從 A 完全離開、再完全進入 B。「同時」只是切換得夠快（每秒幾百到幾千次）造成的錯覺。</p>`,
      scenario: R`<p>一位老師（CPU）同時輔導兩個學生 A、B，但一次只能看一本作業。看 A 的作業看到第 3 頁第 5 行，鈴響（timer interrupt）。老師在便條紙（PCB_A）寫下「A：第 3 頁第 5 行，剛算到 x=8」，翻開 B 的便條紙（PCB_B）：「B：第 1 頁第 2 行」，翻到那頁繼續看 B。整個「寫便條、換本子、找頁數」的過程沒有任何作業被批改——這是純粹的 <b>overhead</b>。</p>`,
      how: R`<ol>
<li>某個事件讓 CPU 進入 kernel：timer interrupt、I/O interrupt、system call（例如 process 自己 <code>read()</code> 而必須等）。</li>
<li>Kernel <b>保存</b>目前 process 的 context 到它的 PCB：PC、所有暫存器、狀態。</li>
<li>Scheduler 選出下一個 process（Ch3）。</li>
<li>Kernel <b>載入</b>新 process 的 PCB：把 PC、暫存器灌回 CPU，切換 page table（記憶體空間跟著換）。</li>
<li>切回 user mode，CPU 從新 process 的 PC 繼續。</li>
</ol>
<p>成本：幾百奈秒到幾微秒的純 kernel 時間，加上更隱性的成本——<b>cache、TLB 全部失效</b>（新 process 的資料都不在 cache 裡），所以切換後的一小段時間會跑得特別慢。這就是為什麼 Round Robin 的 quantum 不能太小（Ch3）。</p>`,
      sim: 'contextSwitch',
      definition: R`<ul>
<li><b>Context</b>：process 在 CPU 上執行所需的全部狀態（PC、暫存器、記憶體對映）。</li>
<li><b>Context switch</b>：保存目前 process 的 context 到 PCB，並載入另一個 process 的 context 的過程。</li>
<li><b>Dispatcher</b>：實際執行切換（含切換模式、跳到新 PC）的 kernel 模組；從停止一個到開始另一個之間的延遲稱為 <b>dispatch latency</b>。</li>
<li><b>觸發時機</b>：timer 到期、I/O interrupt、process 進入 Waiting（system call 阻塞）、process 結束、更高優先權 process 變 Ready（搶佔式）。</li>
</ul>`,
      checkpoint: [
        { id: 'ch1-cs-1', type: 'concept', q: 'Context switch 期間，CPU 在做什麼？', options: ['同時執行兩個 process', '執行 kernel 程式碼保存與載入 PCB，沒有執行任何 user 程式的有用工作', '執行新 process 的第一條指令', '閒置'], answer: 1, explanation: 'Context switch 是純 overhead；切換越頻繁，浪費越多。' },
        { id: 'ch1-cs-2', type: 'trace', q: 'Process A 執行到 PC=0x4018、eax=8 時被 timer 打斷，切換到 B。當 A 之後再度被排程時，它從哪裡開始、eax 是多少？', options: ['從程式開頭、eax=0', '從 0x4018、eax=8（從 PCB_A 還原）', '從 B 停下的地方', '從 0x4018，但 eax 內容不保證'], answer: 1, explanation: '這正是 PCB 的目的：完整還原，A 完全感覺不到自己被暫停過。' },
        { id: 'ch1-cs-3', type: 'concept', q: '為什麼 process 之間的 context switch 通常比同一 process 內 thread 之間的切換昂貴？', options: ['因為 process 的 PCB 比較大', '因為要切換位址空間（page table），造成 TLB 與 cache 失效', '因為 process 切換需要重新開機', '兩者成本一樣'], answer: 1, explanation: 'Thread 共享位址空間，不用換 page table；process 切換後 TLB/cache 的內容都不再有效。' }
      ]
    }
  ]
});
})();
