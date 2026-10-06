/* Chapter 9：File System 與 I/O */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch9', num: 9, title: 'File System 與 I/O', topic: 'fs',
  subtitle: 'File、Directory、inode、File Descriptor、open/read/write/close、Device Controller、Interrupt、DMA、Disk Scheduling。',
  why: R`<p>磁碟只認得「第 812 個磁區」；程式想要的是「notes.txt 的第 3 行」。中間那一整套翻譯——檔名 → inode → block 位址，以及 open() 回傳的那個整數到底是什麼——就是檔案系統。另一半是 I/O：CPU 和慢一萬倍的裝置怎麼合作而不浪費時間。</p>`,
  concepts: [
    {
      id: 'file-basics',
      title: 'File、Directory、inode 與 File Descriptor',
      en: 'A file is named bytes plus metadata (inode). A directory maps names to inode numbers. open() returns a file descriptor: an index into the process table of open files.',
      why: R`<p><code>int fd = open("notes.txt", O_RDONLY)</code>——為什麼回傳一個整數？那個 3 是什麼？兩次 <code>read(fd, buf, 64)</code> 為什麼第二次會讀到後面的內容——程式沒有說「從第 64 byte 開始」？答案都在 kernel 的三層表格裡。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">Process                Kernel（全系統）           Disk
fd table               open file table            inode #4021
┌───┬──────┐           ┌────────────────┐         ┌───────────────┐
│ 0 │stdin │           │ offset: 64     │         │ size: 150     │
│ 1 │stdout│           │ mode: RDONLY   │────────▶│ owner, perm   │
│ 2 │stderr│           │ inode: #4021   │         │ blocks: 812,  │──▶ [812][813]
│ 3 │──────┼──────────▶│ refcount: 1    │         │         813   │
└───┴──────┘           └────────────────┘         └───────────────┘</pre>
<p><b>fd</b> 只是「這個 process 的 fd table 的索引」。它指向一筆 open file table 項目（記錄<b>目前讀到哪</b>），再指向 <b>inode</b>（檔案本體的 metadata：大小、權限、資料在磁碟的哪些 block）。檔名<b>不在</b> inode 裡——檔名存在目錄裡，目錄就是「檔名 → inode 號碼」的對照表。</p>`,
      how: R`<ul><li><b>open()</b>：沿路徑查目錄找到 inode 號碼 → 讀 inode 進記憶體 → 檢查權限 → 建 open file table 項目（offset = 0）→ 在 fd table 找最小空位 → 回傳索引。</li><li><b>read(fd, buf, n)</b>：fd → open file table → offset 與 inode → 算出第幾個 block → 讀（先看 buffer cache）→ 複製到 buf → offset += 實際讀到的數量。</li><li><b>write()</b>：同上，但改資料、可能配置新 block、更新 inode 大小。通常先寫進 kernel 的 buffer cache，之後才真的寫磁碟（所以斷電可能遺失）。</li><li><b>close()</b>：清 fd table 格子，open file table refcount−1，歸零就釋放。</li></ul><p><b>fork 之後</b>父子的 fd table 是複製的，但指向<b>同一筆</b> open file table（refcount = 2）→ 共用 offset。這就是 shell 重導向和 pipe 的基礎。</p>`,
      sim: 'fileOpenSim',
      definition: R`<ul><li><b>File</b>：有名稱的、存在次級儲存體上的相關資訊集合。OS 看來就是一串 byte。</li><li><b>Metadata（attributes）</b>：名稱、類型、大小、位置、權限、時間戳。存放在 inode（UNIX）或 MFT（NTFS）。</li><li><b>inode（index node）</b>：UNIX 檔案系統中每個檔案一個的資料結構，含 metadata 與資料 block 的位址（直接指標 + 間接指標）。不含檔名。</li><li><b>Directory</b>：特殊的檔案，內容是 (檔名, inode 號碼) 的列表。樹狀目錄、hard link（多個檔名指向同一 inode）、symbolic link（內容是另一個路徑的檔案）。</li><li><b>File descriptor</b>：process 的開啟檔案表的索引；0/1/2 預設為 stdin/stdout/stderr。</li><li><b>Allocation methods</b>：contiguous（快、有碎片）、linked（無碎片、隨機存取慢）、indexed（inode 就是這類）。</li></ul>`,
      checkpoint: [
        { id: 'ch9-fb-1', type: 'code', q: '執行下列程式後，檔案內容是？', code: `int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
write(fd, "AB", 2);
write(fd, "CD", 2);
close(fd);`, options: ['CD（第二次覆蓋第一次）', 'ABCD（offset 在 open file table 中累進）', 'AB', 'ABAB'], answer: 1, explanation: '每次 write 後 offset 前進，第二次從 offset 2 開始寫。' },
        { id: 'ch9-fb-2', type: 'concept', q: '檔名存在哪裡？', options: ['inode 裡', '目錄（directory）的項目裡，對應到 inode 號碼', '檔案的第一個 block', 'open file table'], answer: 1, explanation: '所以同一個 inode 可以有多個名字（hard link），而 inode 本身不知道自己叫什麼。' },
        { id: 'ch9-fb-3', type: 'trace', q: '父 process open 一個檔案得到 fd 3，然後 fork。子 process read 了 10 bytes。父 process 接著 read 會從哪裡開始？', options: ['byte 0', 'byte 10：父子共用同一筆 open file table 項目與 offset', '會出錯', '取決於誰先 close'], answer: 1, explanation: 'fork 複製 fd table 但兩者指向同一筆 open file entry，offset 共享。' },
        { id: 'ch9-fb-4', type: 'concept', q: 'open() 回傳的 file descriptor 是？', options: ['inode 號碼', '磁碟 block 位址', '該 process 的開啟檔案表的索引（一個小整數）', '檔案的記憶體位址'], answer: 2, explanation: '它只在該 process 內有意義；不同 process 的 fd 3 可能是完全不同的檔案。' }
      ]
    },
    {
      id: 'io',
      title: 'I/O：Device Controller、Interrupt 與 DMA',
      en: 'Devices are managed through controllers with registers. Polling wastes CPU; interrupts let the CPU do other work; DMA moves whole blocks without CPU involvement.',
      why: R`<p>磁碟比 CPU 慢十萬倍。CPU 對磁碟下指令後，該做什麼？站著等（polling）？做別的、等磁碟叫它（interrupt）？如果一次要搬 4 KB，CPU 要一個 word 一個 word 搬嗎？三種做法的 CPU 利用率天差地遠。</p>`,
      scenario: R`<p>你叫外送（下 I/O 指令）。<b>Polling</b>：每 30 秒開門看一次有沒有到。<b>Interrupt</b>：外送員按門鈴。<b>DMA</b>：外送員有鑰匙，自己把東西放到冰箱，放完才按一次門鈴——你連開門都不用。</p>`,
      how: R`<ul><li><b>Device controller</b>：每種裝置有一個控制器（硬體），有 status、command、data 等暫存器。CPU 透過 <b>port I/O</b> 指令或 <b>memory-mapped I/O</b>（把暫存器映射到位址空間）跟它溝通。<b>Device driver</b> 是 kernel 裡懂這個控制器的軟體。</li><li><b>Programmed I/O（polling）</b>：CPU 迴圈讀 status 暫存器直到 ready，再搬一個 word。適合超快或超簡單的裝置。</li><li><b>Interrupt-driven I/O</b>：下指令後 CPU 去跑別的 process；裝置每準備好一個 word 就 interrupt；ISR 搬一個 word。資料量大時 interrupt 太多。</li><li><b>DMA（Direct Memory Access）</b>：CPU 告訴 DMA controller「來源、目的位址、長度」，DMA controller 直接對記憶體匯流排搬整塊，完成才發<b>一次</b> interrupt。CPU 幾乎不參與。代價：與 CPU 搶匯流排（cycle stealing）。</li></ul>`,
      sim: 'ioMethods',
      definition: R`<ul><li><b>I/O subsystem</b>：kernel 中負責裝置管理的部分，提供 scheduling、buffering、caching、spooling、error handling。</li><li><b>Buffering</b>：處理速度不匹配與資料大小不匹配。<b>Caching</b>：把常用資料留在快的記憶體。<b>Spooling</b>：一次只能服務一個請求的裝置（印表機）的佇列。</li><li><b>Blocking vs non-blocking I/O</b>：blocking 讓 process 睡到完成；non-blocking 立刻回傳目前可得的量；asynchronous 完成後另行通知。</li></ul>`,
      checkpoint: [
        { id: 'ch9-io-1', type: 'concept', q: 'DMA 最主要的好處是？', options: ['讓磁碟轉更快', '大量資料傳輸不需要 CPU 逐字搬移，CPU 可執行其他工作，且只需一次 interrupt', '不需要 device driver', '消除所有 interrupt'], answer: 1, explanation: '傳輸完成才 interrupt 一次；相較 interrupt-driven 每個 word 一次，大幅減少 CPU 負擔。' },
        { id: 'ch9-io-2', type: 'scenario', q: '一個嵌入式系統只有一個非常快的感測器，每微秒產生一筆 4 bytes 資料。用哪種 I/O 方式最合理？', options: ['Interrupt-driven（每筆一個 interrupt）', 'Polling：資料來得比 interrupt 處理還快，interrupt 的 overhead 反而更大', 'DMA 到磁碟', '不可能處理'], answer: 1, explanation: '當裝置幾乎總是 ready，polling 的檢查成本低於 interrupt 的 context 保存成本。' },
        { id: 'ch9-io-3', type: 'concept', q: 'Memory-mapped I/O 指的是？', options: ['把檔案映射到記憶體', '把裝置控制器的暫存器對映到位址空間，用一般的 load/store 指令存取', '用 DMA 讀記憶體', '把記憶體當作磁碟'], answer: 1, explanation: '例如寫某個特定位址等於對顯示卡下指令；和 mmap 檔案是不同概念。' }
      ]
    },
    {
      id: 'disk-sched',
      title: 'Disk Scheduling：FCFS / SSTF / SCAN / C-SCAN',
      en: 'Traditional disks pay a seek cost per head movement. Scheduling the request queue (SSTF, SCAN, C-SCAN, LOOK) reduces total movement, at the risk of starvation.',
      why: R`<p>傳統硬碟的磁頭移動（seek）是毫秒級，是 I/O 最慢的部分。佇列裡有 8 個請求分散在不同磁軌，照到達順序服務磁頭會來回亂跑。像電梯一樣「順路服務」可以少跑很多——這就是 disk scheduling。（SSD 沒有磁頭，這些演算法對 SSD 意義不大，但仍是經典考題。）</p>`,
      scenario: R`<p>佇列 98, 183, 37, 122, 14, 124, 65, 67，磁頭在 53，共 200 個 cylinder。</p><ul><li><b>FCFS</b>：53→98→183→37→122→14→124→65→67，總移動 <b>640</b>。</li><li><b>SSTF</b>（最近的先）：53→65→67→37→14→98→122→124→183，<b>236</b>。</li><li><b>SCAN</b>（電梯，先往 0）：53→37→14→0→65→67→98→122→124→183，<b>236</b>。</li><li><b>C-SCAN</b>（往 199，到底跳回 0）：53→65→…→183→199→0→14→37，<b>382</b>（含跳回）。</li><li><b>LOOK / C-LOOK</b>：同 SCAN/C-SCAN 但到最後一個請求就回頭，不走到底：LOOK 208、C-LOOK 322。</li></ul>`,
      how: R`<ul><li><b>SSTF</b>：貪婪，總是選離磁頭最近的。移動少，但遠處的請求可能 <b>starvation</b>（一直有近的插隊）。</li><li><b>SCAN</b>：磁頭往一個方向走到底，沿路服務，再反向。公平，但剛走過的地方要等最久（最遠端的等待時間不均）。</li><li><b>C-SCAN</b>：只往一個方向服務，到底後直接跳回起點（跳回途中不服務）。等待時間更均勻。</li><li><b>LOOK / C-LOOK</b>：不走到物理盡頭，走到該方向最後一個請求就回頭。實務上用這個。</li></ul><p>磁碟存取時間 = seek time + rotational latency + transfer time。排程只能改善 seek。</p>`,
      sim: 'diskSchedSim',
      definition: R`<ul><li><b>Seek time</b>：磁頭移到目標 cylinder 的時間。<b>Rotational latency</b>：等目標磁區轉到磁頭下的時間。<b>Transfer time</b>：資料傳輸時間。</li><li><b>Disk scheduling</b>：決定服務 I/O 請求佇列的順序以減少 seek。</li><li>SSD：無機械移動，FCFS 或簡單的合併即可；重點變成 wear leveling 與並行。</li></ul>`,
      checkpoint: [
        { id: 'ch9-ds-1', type: 'calc', q: '佇列 98, 183, 37, 122, 14, 124, 65, 67，磁頭 53。FCFS 與 SSTF 的總移動量？', fields: [{ label: 'FCFS', answer: 640 }, { label: 'SSTF', answer: 236 }], explanation: 'FCFS：45+85+146+85+108+110+59+2 = 640。SSTF：12+2+30+23+84+24+2+59 = 236。' },
        { id: 'ch9-ds-2', type: 'calc', q: '同上，SCAN 先往 0 方向（會走到 0），總移動量？', fields: [{ label: 'SCAN', answer: 236 }], explanation: '53→0 = 53，0→183 = 183，共 236。' },
        { id: 'ch9-ds-3', type: 'concept', q: 'SSTF 的主要缺點？', options: ['移動量最大', '遠處的請求可能 starvation', '需要知道未來請求', '只適用 SSD'], answer: 1, explanation: '貪婪演算法：只要近處一直有新請求，遠處的永遠排不到。' },
        { id: 'ch9-ds-4', type: 'concept', q: 'C-SCAN 相較 SCAN 的改進是？', options: ['移動量一定較少', '等待時間更均勻：單向服務，避免剛被掃過的區域要等磁頭來回一整趟', '不需要方向', '可以避免 starvation 而 SCAN 不行'], answer: 1, explanation: 'SCAN 兩端的請求等待時間差異大；C-SCAN 把磁碟當成環狀，每個位置的平均等待接近。' }
      ]
    }
  ]
});
})();
