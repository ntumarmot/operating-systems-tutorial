/* Chapter 0：Operating System 是什麼？ */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch0', num: 0, title: 'Operating System 是什麼？', topic: 'basics',
  subtitle: '在談 process、scheduling、paging 之前，先搞清楚 OS 到底站在哪裡、為什麼非它不可。',
  why: R`<p>你同時開著 Chrome、Spotify、VS Code。電腦只有一顆（或幾顆）CPU、一條記憶體、一顆硬碟——但每個程式都<b>以為</b>自己獨占整台機器，而且互相不會踩到對方。這個「以為」是誰製造的？</p><p>答案是作業系統（Operating System）。這章回答兩個問題：<b>沒有 OS，程式會怎樣？</b>以及<b>OS 最重要的工作到底是什麼？</b></p>`,
  concepts: [
    {
      id: 'os-role',
      title: '作業系統的位置與工作（Operating System）',
      en: 'The OS sits between applications and hardware: it virtualizes resources, arbitrates access, and protects programs from each other.',
      why: R`<p>想像沒有 OS 的世界：你寫一個「印出 Hello」的程式，得自己知道螢幕的記憶體位址、自己寫硬碟驅動程式才能存檔、自己處理鍵盤中斷。而且一次只能跑一個程式——因為沒有人負責在程式之間切換。1950 年代真的是這樣，程式員直接對硬體寫程式，一台機器一次一個 job。</p>`,
      scenario: R`<p>你同時開 Chrome、Spotify、VS Code。CPU 只有 4 核，但活著的 process 有 300 個。RAM 16 GB，但所有程式「要求」的記憶體加起來超過。硬碟只有一顆磁頭，但三個程式同時在讀寫。</p><p>每個程式都覺得自己有一顆 CPU、一整片連續的記憶體、自己的檔案。<b>這個假象</b>就是 OS 的產品。</p>`,
      how: R`<p>OS 做三件事，貫穿整個課程：</p>
<ol>
<li><b>虛擬化（Virtualization）</b>：把一顆 CPU 變成「每個 process 都有一顆」（Ch1–3：process、scheduling）；把一塊 RAM 變成「每個 process 都有自己從 0 開始的位址空間」（Ch7–8：paging、virtual memory）。</li>
<li><b>仲裁（Arbitration）／並行（Concurrency）</b>：多個程式搶同一個資源時決定誰先（scheduling），並提供工具讓它們安全地共用（Ch4–6：lock、semaphore、deadlock）。</li>
<li><b>保護與抽象（Protection & Abstraction）</b>：A 不能讀 B 的記憶體、不能直接碰硬體；磁碟磁區被包裝成「檔案」、裝置被包裝成「read/write」（Ch0、Ch9）。</li>
</ol>
<p>所以「OS 最重要的工作」用一句話講：<b>把有限、混亂的硬體，包裝成安全、公平、好用的抽象，讓很多程式同時使用。</b></p>`,
      sim: 'osLayers',
      definition: R`<ul>
<li><b>作業系統（Operating System, OS）</b>：管理硬體資源、為應用程式提供服務的系統軟體。</li>
<li><b>核心（Kernel）</b>：OS 中永遠駐留在記憶體、擁有最高權限、直接操作硬體的部分。日常說「OS」時多半指 kernel；shell、GUI、工具程式則是跑在 kernel 之上的一般程式。</li>
<li><b>應用程式（Application）</b>：在 user mode 執行、透過 system call 向 kernel 要服務的程式。</li>
<li><b>硬體（Hardware）</b>：CPU、記憶體、I/O 裝置。只執行指令，不理解「檔案」「使用者」這些概念。</li>
</ul>`,
      extra: R`<div class="callout info"><div class="callout-title">面試一句話</div>「OS 是硬體與應用程式之間的<b>資源管理者</b>和<b>抽象層</b>：它讓多個程式安全地共用 CPU、記憶體、I/O，並且讓每個程式都像獨占整台機器。」</div>`,
      checkpoint: [
        { id: 'ch0-role-1', type: 'concept', q: '下列哪一項最能概括 OS「最重要的工作」？', options: ['提供漂亮的圖形介面', '把有限的硬體資源虛擬化、仲裁並保護，讓多個程式安全地共用', '讓程式跑得比沒有 OS 時更快', '負責編譯程式碼'], answer: 1, hint: '想想「沒有 OS」時會少掉什麼。', explanation: 'GUI 只是其中一種應用；OS 的核心價值是資源管理（虛擬化、仲裁）與保護／抽象。事實上 OS 本身會消耗資源，程式不會因為 OS 而變快。' },
        { id: 'ch0-role-2', type: 'scenario', q: '如果沒有 OS，下列哪個敘述<b>正確</b>？', options: ['程式可以同時執行更多，因為少了 OS 的負擔', '每個程式必須自己實作磁碟驅動、記憶體配置，而且一次只能跑一個', '硬體會自動保護程式不互相干擾', '程式仍然可以用 open()/read() 存取檔案'], answer: 1, hint: '「檔案」是誰的抽象？「切換程式」是誰做的？', explanation: '沒有 OS 就沒有 process 切換、沒有檔案系統、沒有記憶體保護；每個程式直接面對硬體，且只能一次一個。' },
        { id: 'ch0-role-3', type: 'concept', q: 'Kernel 與「OS」的關係，下列何者正確？', options: ['Kernel 是 OS 中駐留記憶體、擁有最高權限、直接管理硬體的核心部分', 'Kernel 是 OS 的圖形介面', 'Kernel 就是 shell', 'Kernel 只在開機時執行'], answer: 0, explanation: 'Shell、GUI 都是跑在 kernel 之上的程式；kernel 才是真正在管硬體的那一層。' }
      ]
    },
    {
      id: 'kernel-modes',
      title: '使用者模式與核心模式（User Mode / Kernel Mode）',
      en: 'A mode bit in the CPU decides whether privileged instructions are allowed. Applications run in user mode; only the kernel runs in kernel mode.',
      why: R`<p>如果任何程式都能直接對硬碟下指令、改記憶體對映表、關掉 interrupt，那「保護」就是空話：一個有 bug 的程式能寫壞別人的資料，一個惡意程式能讀你的密碼。所以需要一個<b>硬體層級</b>的機制，區分「誰可以做危險的事」。</p>`,
      scenario: R`<p>一間公司的大樓：一般員工（application）可以在辦公室做事，但機房（硬體）需要門禁卡。想拿機房裡的東西，得填申請單（system call），由 IT 人員（kernel）代為操作。IT 人員會檢查你有沒有權限、要拿的是不是你的東西。</p>`,
      how: R`<p>CPU 裡有一個 <b>mode bit</b>：0 = kernel mode（又叫 supervisor / privileged mode），1 = user mode（不同架構定義的數字不同，觀念一樣）。</p>
<ul>
<li>某些指令被標為<b>特權指令（privileged instruction）</b>：I/O 指令、修改 page table 暫存器、關閉 interrupt、設定 timer、halt……</li>
<li>在 user mode 執行特權指令，CPU <b>不會執行</b>，而是產生一個 trap（例外），跳進 kernel；kernel 通常直接把這個 process 殺掉。</li>
<li>從 user mode 進入 kernel mode 只有兩條路：<b>system call</b>（程式主動要求）與 <b>interrupt / trap</b>（硬體或錯誤觸發）。而且進去之後跳到哪裡，是 kernel 事先設定好的——程式不能指定「進 kernel mode 然後執行我這段程式碼」。</li>
</ul>
<p>這就是為什麼 application 不能直接控制硬體：<b>不是 OS 不想給，而是 CPU 硬體不允許</b>。</p>`,
      sim: 'privilegedDemo',
      definition: R`<ul>
<li><b>Dual-mode operation</b>：CPU 至少提供兩種執行模式，由 mode bit 區分。</li>
<li><b>User mode</b>：應用程式執行的模式，不能執行特權指令、不能存取 kernel 記憶體。</li>
<li><b>Kernel mode</b>：kernel 執行的模式，可執行所有指令、存取所有記憶體。</li>
<li><b>Timer</b>：一種特權裝置，定時產生 interrupt，讓 kernel 有機會拿回 CPU——防止 user 程式無窮迴圈霸佔 CPU。</li>
</ul>`,
      checkpoint: [
        { id: 'ch0-mode-1', type: 'concept', q: '為什麼設定 timer 必須是特權指令？', options: ['因為 timer 硬體很貴', '如果 user 程式能關掉 timer，OS 就永遠拿不回 CPU，一個無窮迴圈就能鎖死系統', '因為 timer 只有 kernel 看得懂', '其實不需要是特權指令'], answer: 1, hint: 'OS 靠什麼「打斷」正在跑的程式？', explanation: 'Timer interrupt 是 OS 搶回 CPU 的手段。若 user 能改它，就能無限期霸佔 CPU。' },
        { id: 'ch0-mode-2', type: 'scenario', q: '一個 user mode 程式執行了 I/O 指令試圖直接讀硬碟。CPU 會？', options: ['正常執行，因為讀取不會破壞資料', '產生 trap 進入 kernel，kernel 通常終止該程式', '自動切換到 kernel mode 然後執行該指令', '等到 OS 有空再執行'], answer: 1, explanation: '特權指令在 user mode 不會被執行，而是產生 trap；kernel 視為非法操作處理。想讀硬碟要走 system call。' },
        { id: 'ch0-mode-3', type: 'concept', q: '從 user mode 進入 kernel mode 的合法途徑是？', options: ['程式直接把 mode bit 改成 kernel', '呼叫 system call，或發生 interrupt / trap', '程式跳到 kernel 的程式碼位址', '呼叫任何 C 函式'], answer: 1, explanation: '進入 kernel 的同時，執行位址被強制跳到 kernel 事先設定的入口——程式不能決定進去之後跑什麼。' }
      ]
    },
    {
      id: 'syscall',
      title: '系統呼叫（System Call）',
      en: 'A system call is the controlled entry point from user mode into the kernel: the program asks the OS to do something it is not allowed to do itself.',
      why: R`<p>前一節說 application 不能直接碰硬體。但程式總得讀檔案、開網路、要記憶體、建立新 process——這些全部需要硬體。所以必須有一個<b>受控的門</b>：程式提出請求，kernel 檢查後代為執行。這扇門就是 system call。</p>`,
      scenario: R`<p>你在 C 裡寫 <code>read(fd, buf, 100)</code>，感覺就像呼叫一個普通函式。實際上這行會：切換 CPU 模式、進入 kernel、檢查權限、對磁碟下指令、可能讓你的 process 睡一陣子、把資料複製回你的 buffer、再切回 user mode。整趟大約幾百奈秒到幾毫秒——比普通函式呼叫慢上百倍以上。</p>`,
      how: R`<ol>
<li>程式呼叫 libc 的包裝函式 <code>read()</code>，它把 <b>system call 編號</b>（例如 SYS_read = 0）和參數放進約定的暫存器。</li>
<li>執行 <code>syscall</code>（x86-64）／<code>svc</code>（ARM）指令：CPU 切到 kernel mode，保存返回位址，跳到 kernel 的 system call 進入點。</li>
<li>Kernel 用編號查 <b>system call table</b>，找到 <code>sys_read()</code>，<b>先驗證所有參數</b>（fd 是不是你的？buf 是不是你的記憶體？）。</li>
<li>執行實際工作（可能觸發 I/O、讓 process 進入 Waiting）。</li>
<li>把結果放進暫存器，執行 <code>sysret</code> 回到 user mode，回到 <code>syscall</code> 的下一條指令。</li>
</ol>`,
      sim: 'syscallSim',
      definition: R`<ul>
<li><b>System call</b>：作業系統提供給程式的程式化介面（API），是 user mode 程式請求 kernel 服務的唯一正規途徑。</li>
<li><b>常見分類</b>：process 控制（fork, exec, exit, wait）、檔案（open, read, write, close）、裝置（ioctl）、資訊（getpid, time）、通訊（pipe, socket）、保護（chmod）。</li>
<li><b>API vs system call</b>：程式通常呼叫的是 libc / POSIX API（如 <code>printf</code>），API 內部再呼叫 system call（<code>write</code>）。一個 <code>printf</code> 可能只觸發零次或一次 <code>write</code>（因為有 buffering）。</li>
</ul>`,
      code: { title: 'syscall.c — 直接用 syscall() 發出 system call', src: `#include <unistd.h>
#include <sys/syscall.h>

int main() {
    const char msg[] = "hi\\n";
    // 等價於 write(1, msg, 3)，但跳過 libc 包裝，直接指定 system call 編號
    long n = syscall(SYS_write, 1, msg, 3);
    // 這一行執行時：user → kernel（sys_write）→ user
    return 0;
}`, note: '在 Linux x86-64 上 SYS_write = 1。<code>strace ./a.out</code> 可以看到程式發出的每一個 system call——面試時說得出這個工具是加分。' },
      checkpoint: [
        { id: 'ch0-sc-1', type: 'concept', q: 'System call 與一般函式呼叫最根本的差別是？', options: ['System call 的參數比較多', 'System call 會切換 CPU 到 kernel mode，執行的是 kernel 的程式碼', 'System call 只能用組合語言寫', '一般函式呼叫不能傳指標'], answer: 1, explanation: '差別在特權：system call 跨越 user/kernel 邊界，因此有模式切換與參數驗證的成本。' },
        { id: 'ch0-sc-2', type: 'scenario', q: '<code>printf("hello")</code> 執行後，一定會立刻發生一次 <code>write</code> system call嗎？', options: ['一定會，每個 printf 對應一個 write', '不一定，libc 會先放進 buffer，累積或遇到換行／flush 才呼叫 write', '不會，printf 不需要 system call', 'printf 本身就是 system call'], answer: 1, hint: 'API 與 system call 是兩層。', explanation: 'printf 是 libc 的 API，內部有 buffering；真正碰硬體的是 write system call。這也是為什麼程式當掉時最後幾行 printf 可能沒印出來。' },
        { id: 'ch0-sc-3', type: 'code', q: '下面程式碼中，哪一行會造成 user → kernel 的模式切換？', code: `int x = compute(a, b);      // 1
int fd = open("f.txt", 0);   // 2
strcpy(buf, "abc");          // 3
x = x * 2 + 1;               // 4`, options: ['第 1 行', '第 2 行', '第 3 行', '第 4 行'], answer: 1, explanation: 'open() 需要存取檔案系統與磁碟，必須經由 kernel；compute、strcpy、算術都在 user mode 完成。' }
      ]
    },
    {
      id: 'interrupt',
      title: '中斷（Interrupt）',
      en: 'An interrupt is a hardware signal that makes the CPU stop what it is doing, save state, and run a kernel handler. It is how the OS regains control and how devices report completion.',
      why: R`<p>CPU 對磁碟說「幫我讀這個磁區」，磁碟要 5 毫秒才能做完——這段時間 CPU 可以執行一千萬條指令。如果 CPU 站在旁邊一直問「好了沒？」（polling），就浪費了。而且，如果一個 user 程式陷入無窮迴圈，OS 要怎麼拿回 CPU？程式又不會主動讓出來。</p><p>兩個問題同一個答案：<b>讓硬體主動打斷 CPU</b>。</p>`,
      scenario: R`<p>你在讀書（CPU 執行 P1）。門鈴響了（磁碟 interrupt）。你在書頁夾上書籤（保存 PC 與暫存器），去應門（執行 handler），收完包裹回來翻到書籤那頁繼續讀（還原狀態）。書本身完全不知道你剛剛離開過。</p>`,
      how: R`<ol>
<li>裝置控制器完成工作，把 CPU 的 interrupt request 線拉高。</li>
<li>CPU 每執行完一條指令會檢查這條線。有 interrupt → 切到 kernel mode，把目前的 PC 和狀態暫存器推進 kernel stack。</li>
<li>查 <b>Interrupt Vector Table</b>：每種 interrupt 有一個編號，對應一個 handler（ISR, Interrupt Service Routine）的位址。</li>
<li>執行 handler：讀取裝置資料、把等這個 I/O 的 process 改成 Ready……</li>
<li>Handler 結束，還原 PC 與暫存器，切回 user mode。<b>回到哪個 process</b>由 scheduler 決定——可能是原本的，也可能換人。</li>
</ol>
<p><b>Timer interrupt</b> 是最重要的一種：硬體時鐘每隔一段時間（例如 1–10 ms）打斷 CPU 一次，kernel 因此定期拿到控制權，可以決定要不要換另一個 process 跑。這是所有搶佔式排程的基礎（Ch3）。</p>`,
      sim: 'interruptSim',
      definition: R`<ul>
<li><b>Interrupt（硬體中斷）</b>：由外部裝置非同步發出的訊號，通知 CPU 有事件發生（I/O 完成、timer 到期、鍵盤按鍵）。</li>
<li><b>Trap / Exception（軟體中斷）</b>：由目前執行的指令同步引發——system call 指令、除以零、page fault、非法指令。處理流程與 interrupt 相同。</li>
<li><b>Interrupt vector table</b>：interrupt 編號 → handler 位址的表格，位於 kernel 記憶體。</li>
<li><b>Interrupt-driven</b>：現代 OS 是「事件驅動」的——kernel 平時不主動跑，全靠 interrupt 與 system call 觸發。</li>
</ul>
<table class="vs-table"><tr><th></th><th>Interrupt</th><th>Trap / Exception</th></tr><tr><td>來源</td><td>硬體裝置（非同步）</td><td>正在執行的指令（同步）</td></tr><tr><td>例子</td><td>timer、磁碟完成、鍵盤</td><td>system call、page fault、除以零</td></tr><tr><td>與目前指令的關係</td><td>無關，隨時可能來</td><td>就是這條指令造成的</td></tr></table>`,
      checkpoint: [
        { id: 'ch0-int-1', type: 'concept', q: 'Timer interrupt 對 OS 最重要的意義是？', options: ['讓程式知道現在幾點', '讓 kernel 定期取回 CPU 控制權，是搶佔式排程的基礎', '加速 I/O', '避免記憶體洩漏'], answer: 1, explanation: '沒有 timer interrupt，一個不主動讓出 CPU 的程式可以永遠霸佔 CPU。' },
        { id: 'ch0-int-2', type: 'trace', q: 'CPU 正在執行 P1，磁碟發出 interrupt（P3 之前要求的資料到了）。Handler 執行完後，下列敘述何者正確？', options: ['一定回到 P1 繼續執行', 'P3 立刻開始執行', 'P3 變成 Ready；接下來執行誰由 scheduler 決定', '磁碟資料會直接送到 P1'], answer: 2, hint: 'I/O 完成後 process 回到哪個狀態？', explanation: 'I/O 完成 → P3 從 Waiting 變 Ready。是否立刻搶走 CPU 取決於排程策略（例如 P3 優先權較高就可能搶）。' },
        { id: 'ch0-int-3', type: 'concept', q: '下列何者是 trap（同步例外）而不是硬體 interrupt？', options: ['鍵盤按下', '網卡收到封包', '程式執行除以零', 'timer 到期'], answer: 2, explanation: 'Trap 是目前指令直接造成的（除以零、page fault、syscall）；其他三者來自外部裝置。' }
      ]
    }
  ]
});
})();
