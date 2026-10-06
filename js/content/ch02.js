/* Chapter 2：Thread */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch2', num: 2, title: 'Thread：一個 Process 裡的多條執行流', topic: 'process',
  subtitle: 'Process vs Thread、共享什麼／各自擁有什麼、為什麼 thread 比較輕。',
  why: R`<p>瀏覽器一邊下載檔案、一邊播影片、一邊回應你的滑鼠。如果每件事都開一個 process，它們之間要分享資料（下載進度要顯示在畫面上）就得走 IPC，而且每個 process 各自一份記憶體，很浪費。有沒有辦法「在同一個記憶體空間裡，有好幾條獨立的執行流」？這就是 thread。</p>`,
  concepts: [
    {
      id: 'process-vs-thread',
      title: '行程與執行緒（Process vs Thread）',
      en: 'Threads within a process share code, data, heap, and open files, but each has its own registers, program counter, and stack.',
      why: R`<p>面試第一名常客：「Process 和 Thread 有什麼差別？」背誦版答案是「thread 是輕量級 process」——但這句話什麼都沒解釋。要能回答：<b>共享什麼、各自擁有什麼、為什麼因此比較輕、代價是什麼。</b></p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;line-height:1.45;background:var(--code-bg);padding:12px 16px;border-radius:6px;display:inline-block">Process A
┌──────────────────────────────────────┐
│  Code      ← shared                  │
│  Data      ← shared（全域變數）        │
│  Heap      ← shared（new 出來的東西）  │
│  Open files ← shared                 │
│                                      │
│  Thread 1        Thread 2            │
│  ┌──────────┐    ┌──────────┐        │
│  │ Registers│    │ Registers│        │
│  │ PC       │    │ PC       │        │
│  │ Stack    │    │ Stack    │        │
│  └──────────┘    └──────────┘        │
└──────────────────────────────────────┘</pre>
<p>兩個 thread 就像同一間辦公室（位址空間）裡的兩個員工：共用白板（data/heap）、共用文件櫃（open files），但各自有自己的筆記本（stack）和目前在做的事（PC）。</p>`,
      how: R`<p>為什麼各自需要 stack 和 PC？因為「執行流」的定義就是「執行到哪裡（PC）＋呼叫到哪一層（stack）」。兩條執行流若共用 stack，函式呼叫的 frame 就會打架。</p>
<p>為什麼共享 code / data / heap？因為 thread 的目的就是「在同一個程式的資料上並行工作」——下載 thread 把資料寫進 heap 的 buffer，顯示 thread 直接讀同一個 buffer，不需要複製、不需要 IPC。</p>
<p><b>代價</b>：共享沒有保護。一個 thread 寫壞 heap，所有 thread 遭殃；兩個 thread 同時改同一個變數，就是 Ch4 的 race condition。</p>`,
      sim: 'processVsThread',
      definition: R`<ul>
<li><b>Thread（執行緒）</b>：CPU 使用的基本單位，由 thread ID、PC、暫存器組、stack 組成。同一 process 的 threads 共享 code section、data section、heap、開啟的檔案與 signal。</li>
<li><b>Process（行程）</b>：資源分配的單位（位址空間、檔案、裝置）。傳統 process = 一個位址空間 + 一個 thread；多執行緒 process = 一個位址空間 + 多個 thread。</li>
</ul>
<table class="vs-table"><tr><th></th><th>Process</th><th>Thread</th></tr>
<tr><td>位址空間</td><td>各自獨立</td><td>同 process 共享</td></tr>
<tr><td>建立成本</td><td>高：複製位址空間（page table 等）</td><td>低：配一個 stack 和暫存器組</td></tr>
<tr><td>切換成本</td><td>高：換 page table，TLB/cache 失效</td><td>低：不換位址空間</td></tr>
<tr><td>溝通方式</td><td>IPC（pipe、socket、shared memory）</td><td>直接讀寫共享記憶體</td></tr>
<tr><td>隔離／保護</td><td>一個崩潰不影響其他</td><td>一個崩潰整個 process 一起死</td></tr>
<tr><td>同步需求</td><td>較少（本來就不共享）</td><td>必須（lock、semaphore）</td></tr></table>`,
      code: { title: 'threads.cpp — 兩個 thread 共享全域變數，各自有 stack', src: `#include <pthread.h>
#include <stdio.h>

int shared = 0;                     // Data：所有 thread 看到同一個

void* worker(void* arg) {
    int local = *(int*)arg;         // 每個 thread 自己的 stack 上
    shared += local;                // 兩個 thread 都改同一個 shared（Ch4：這裡有 race）
    return NULL;
}

int main() {
    pthread_t t1, t2;
    int a = 1, b = 2;
    pthread_create(&t1, NULL, worker, &a);   // 只配 stack + 暫存器，不複製記憶體
    pthread_create(&t2, NULL, worker, &b);
    pthread_join(t1, NULL); pthread_join(t2, NULL);
    printf("%d\\n", shared);        // 期望 3（但沒有同步時不保證）
}`, note: '對照 Ch1 的 fork 範例：fork 之後兩邊的 x 互不影響；這裡兩個 thread 改的是<b>同一個</b> shared。' },
      checkpoint: [
        { id: 'ch2-pt-1', type: 'concept', q: '同一 process 內的兩個 thread，下列何者是<b>各自擁有</b>而非共享？', options: ['Heap', '全域變數', 'Stack 與 Program Counter', '開啟的檔案'], answer: 2, explanation: '執行流需要自己的進度（PC）和呼叫紀錄（stack）；其餘資源共享。' },
        { id: 'ch2-pt-2', type: 'code', q: '下列程式輸出可能是什麼？', code: `int g = 0;
void* f(void*) { g = g + 10; return NULL; }
// main 建立兩個 thread 執行 f，然後 join，印出 g`, options: ['一定是 20', '一定是 10', '可能是 10 或 20（沒有同步）', '一定是 0'], answer: 2, hint: 'g 是共享的；g = g + 10 不是原子操作。', explanation: '兩個 thread 共享 g；若交錯執行，可能都讀到 0 然後都寫 10。這是 Ch4 的主題。' },
        { id: 'ch2-pt-3', type: 'scenario', q: '一個多執行緒的伺服器，其中一個 worker thread 解參考了空指標。結果是？', options: ['只有那個 thread 結束，其他 thread 繼續', '整個 process 崩潰，所有 thread 一起結束', 'OS 自動重啟該 thread', '只有 main thread 結束'], answer: 1, explanation: 'Thread 共享位址空間，segfault 的訊號送給整個 process。這是「隔離差」的代價，也是有些系統（如 Chrome 的分頁）選擇用 process 的原因。' },
        { id: 'ch2-pt-4', type: 'concept', q: '為什麼 thread 之間的溝通比 process 之間簡單？', options: ['因為 thread 有專用的通訊指令', '因為 thread 共享記憶體，直接讀寫同一變數即可；process 需要透過 kernel 提供的 IPC', '因為 thread 數量比較少', '其實一樣複雜'], answer: 1, explanation: '共享記憶體是最快的溝通方式，但也需要同步機制避免衝突。' }
      ]
    },
    {
      id: 'thread-models',
      title: '為什麼 Thread 比較輕？User Thread 與 Kernel Thread',
      en: 'Threads are cheaper to create and switch because they do not need a new address space. Whether the kernel knows about them depends on the threading model.',
      why: R`<p>「Thread 比較 lightweight」是結論，面試官想聽的是<b>原因</b>。而且追問常常是：「thread 是 OS 排程的嗎？」「user-level thread 和 kernel-level thread 差在哪？」</p>`,
      scenario: R`<p>建立一個 process（fork）：要複製 page table、設定新的位址空間、複製 fd 表……即使 Linux 用 copy-on-write 省掉了資料複製，光 page table 就是可觀的工作。建立一個 thread（pthread_create）：配一塊 stack（通常 8 MB 虛擬空間，實際用到才給）、初始化一組暫存器、登記到 kernel——就這樣。實測差距通常是 10 倍以上。</p>`,
      how: R`<p><b>三個「輕」的來源</b>：</p>
<ol>
<li><b>建立</b>：不用建位址空間。</li>
<li><b>切換</b>：不用換 page table，TLB 和 cache 裡的內容還是有用的。</li>
<li><b>溝通</b>：不用經過 kernel，直接讀寫共享記憶體。</li>
</ol>
<p><b>Kernel 知道 thread 存在嗎？</b>看模型：</p>
<ul>
<li><b>Kernel-level thread</b>（Linux、Windows 的預設）：kernel 為每個 thread 維護一個排程單位。好處：一個 thread 阻塞（等 I/O）其他 thread 照跑；多核可真正並行。壞處：建立／切換要進 kernel。</li>
<li><b>User-level thread</b>（早期 green threads、部分語言 runtime）：thread library 在 user space 自己排程，kernel 只看到一個 process。好處：切換超快（不進 kernel）。壞處：一個 thread 做阻塞 system call，整個 process 一起卡住；多核也用不到。</li>
<li><b>Many-to-One / One-to-One / Many-to-Many</b>：user thread 對 kernel thread 的對應方式。現代主流是 One-to-One。Go 的 goroutine 是 Many-to-Many 的變體（M:N）。</li>
</ul>`,
      definition: R`<ul>
<li><b>User-level thread</b>：由使用者空間的函式庫管理，kernel 不知情。</li>
<li><b>Kernel-level thread</b>：由 kernel 直接支援與排程。</li>
<li><b>Many-to-One</b>：多個 user thread 對應一個 kernel thread；一個阻塞全部阻塞。</li>
<li><b>One-to-One</b>：每個 user thread 對應一個 kernel thread；並行度高，但 thread 數受 kernel 限制。</li>
<li><b>Many-to-Many</b>：多個 user thread 多工到較少數的 kernel thread 上。</li>
</ul>
<div class="callout info"><div class="callout-title">面試 60 秒版</div>「Thread 是 CPU 排程的單位，process 是資源分配的單位。同一個 process 的 threads 共享位址空間（code、data、heap）和開啟的檔案，但各自有 stack、PC、暫存器。因為不用建立或切換位址空間，thread 的建立與 context switch 都比 process 便宜很多，溝通也直接透過共享記憶體。代價是沒有隔離：一個 thread 崩潰整個 process 一起死，而且共享資料需要同步機制避免 race condition。」</div>`,
      checkpoint: [
        { id: 'ch2-tm-1', type: 'concept', q: '在 Many-to-One 模型下，一個 user thread 呼叫阻塞的 read()，其他 user thread 會？', options: ['繼續執行', '全部一起被阻塞，因為 kernel 只看到一個排程單位', '被搬到另一顆 CPU', '自動變成 kernel thread'], answer: 1, explanation: 'Kernel 不知道有多個 thread，它把整個 process 設成 Waiting。' },
        { id: 'ch2-tm-2', type: 'concept', q: 'Thread 建立比 process 便宜的<b>主要</b>原因是？', options: ['thread 的程式碼比較短', '不需要建立新的位址空間（page table 等），只需配置 stack 與暫存器組', 'thread 不需要 PC', 'thread 沒有優先權'], answer: 1, explanation: '位址空間的建立與切換是 process 最昂貴的部分。' },
        { id: 'ch2-tm-3', type: 'scenario', q: '你的程式要充分利用 8 核 CPU 做平行運算。應該選擇哪種 thread 模型？', options: ['User-level thread（Many-to-One）', 'Kernel-level thread（One-to-One 或 Many-to-Many）', '不用 thread，用單一迴圈', '哪種都一樣'], answer: 1, explanation: '只有 kernel 看得到的 thread 才能被排到不同核心上真正並行。' }
      ]
    }
  ]
});
})();
