/* Chapter 8：Virtual Memory */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch8', num: 8, title: 'Virtual Memory', topic: 'vm',
  subtitle: 'Demand Paging、Page Fault、Page Replacement（FIFO / LRU / Optimal）、Thrashing。',
  why: R`<p>「我的電腦只有 16 GB RAM，為什麼所有程式加起來可以看起來使用更多 memory？」因為 paging 之後，一個 page 不一定要在 RAM 裡——可以暫時放在磁碟，需要時再搬進來。這章講「不在 RAM 的 page 被存取時發生什麼」（page fault）、「RAM 滿了要踢誰」（page replacement）、以及「踢太頻繁會怎樣」（thrashing）。</p>`,
  concepts: [
    {
      id: 'virtual-memory',
      title: '虛擬記憶體與 Demand Paging',
      en: 'Virtual memory separates logical memory from physical memory. Demand paging loads a page only when it is first accessed; the valid bit says whether it is in RAM.',
      why: R`<p>一個程式的錯誤處理程式碼、很少用的功能、超大的陣列——大多數時候根本不會碰到。全部載進 RAM 是浪費。而且程式的位址空間（64 位元）遠大於 RAM。如果 page 可以「需要時才載入」，那 RAM 只要放<b>正在用的</b>那部分，剩下的留在磁碟。</p>`,
      scenario: R`<p>Chrome 宣稱用了 2 GB「虛擬記憶體」，但實際在 RAM 的（resident set）可能只有 500 MB——其餘的 page 從沒被碰過（根本沒載入）、或很久沒用被換到磁碟的 <b>swap</b> 區了。程式自己完全不知道，它以為 2 GB 都在。</p>`,
      how: R`<ul><li>Page table 每項多一個 <b>valid bit</b>：1 = 在 RAM（frame number 有效），0 = 不在（可能在磁碟，或根本不屬於這個 process）。</li><li><b>Lazy loading</b>：process 啟動時幾乎不載入任何 page，全部 valid = 0。</li><li>第一次存取某頁 → valid = 0 → <b>page fault</b> → OS 從磁碟載入（下一節）。</li><li>之後存取 → valid = 1 → 正常。</li></ul><p>Fork 的 <b>copy-on-write</b> 也靠這個：父子共享 page，標為唯讀；誰想寫就 fault，OS 這時才複製那一頁。</p>`,
      definition: R`<ul><li><b>Virtual memory</b>：把使用者的邏輯記憶體與實體記憶體分離的技術，讓 process 的位址空間可以大於實體記憶體，且只有部分在 RAM。</li><li><b>Demand paging</b>：page 只在被存取時才從磁碟載入。</li><li><b>Backing store / swap space</b>：磁碟上存放不在 RAM 的 page 的區域。</li><li><b>Resident set</b>：process 目前在 RAM 中的 page 集合。</li><li><b>Pure demand paging</b>：一開始一頁都不載入。</li></ul>`,
      checkpoint: [
        { id: 'ch8-vm-1', type: 'concept', q: 'Virtual memory 讓「所有程式加起來的記憶體用量超過實體 RAM」成為可能，關鍵機制是？', options: ['壓縮 RAM 內容', '只把正在使用的 page 放在 RAM，其餘留在磁碟，需要時才載入', '每個程式輪流使用 RAM', '增加 RAM 的時脈'], answer: 1, explanation: '這就是 demand paging；程式的大部分 page 可能從未載入。' },
        { id: 'ch8-vm-2', type: 'concept', q: 'Page table 的 valid bit = 0 代表？', options: ['該頁是唯讀的', '該頁不在實體記憶體中（在磁碟上或不屬於此 process）', '該頁被 TLB 快取了', '該頁被鎖定'], answer: 1, explanation: '存取 valid = 0 的頁會觸發 page fault，由 OS 判斷是合法（載入）還是非法（segfault）。' },
        { id: 'ch8-vm-3', type: 'scenario', q: '程式 <code>malloc(1 GB)</code> 成功回傳，但系統只剩 200 MB 空閒 RAM。可能嗎？', options: ['不可能，malloc 會失敗', '可能：配置的是虛擬位址空間，實體 page 在第一次寫入時才透過 page fault 分配', '可能，但程式會立刻當掉', '可能，OS 會先壓縮其他程式'], answer: 1, explanation: 'Lazy allocation：沒碰過的 page 不佔 RAM。真的寫滿 1 GB 時才會開始 swap。' }
      ]
    },
    {
      id: 'page-fault',
      title: 'Page Fault',
      en: 'A page fault is a trap raised when a process touches a page not in RAM. The OS finds a frame, reads the page from disk, updates the page table, and restarts the instruction.',
      why: R`<p>Demand paging 的核心事件：process 要 page 5，page table 說「不在」。硬體不能完成這次存取——那接下來誰做什麼、順序是什麼、process 這段時間在哪個狀態？這是 OS 最常被問的 trace 題之一。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">Process 要 page 5
   ↓
Page Table：page 5 valid = 0
   ↓
Page Fault（trap 進 kernel）
   ↓
OS 檢查：合法位址？ 否 → 殺掉 process（segfault）
   ↓ 是
OS 找一個 free frame（沒有 → page replacement）
   ↓
從 Disk 讀 page 5 進 frame（process 進 Waiting，CPU 給別人）
   ↓
更新 Page Table：page 5 → frame k，valid = 1
   ↓
重新執行那條指令</pre>`,
      how: R`<p>用下面的動畫逐步看。幾個常被忽略的細節：</p>
<ul><li>fault 期間 process 是 <b>Waiting</b>（等磁碟 I/O），不是 Running——所以 page fault 會引發 context switch。</li><li>指令是<b>重新執行</b>（restart），不是「從中斷處繼續」。硬體必須支援在指令中途放棄。</li><li>一次 page fault 的成本約 8 ms（磁碟）vs 記憶體存取 200 ns——差 <b>40,000 倍</b>。EAT = (1 − p) × 200 + p × 8,000,000 ns。要讓效能損失 &lt; 10%，p 必須 &lt; 0.0000025——每 40 萬次存取最多 1 次 fault。</li></ul>`,
      sim: 'pageFaultSim',
      definition: R`<ul><li><b>Page fault</b>：存取 valid bit = 0 的 page 所引發的 trap。</li><li><b>Major fault</b>：需要從磁碟讀取。<b>Minor fault</b>：page 其實在 RAM（例如共享的、或剛被回收還沒清），只需更新 page table。</li><li><b>Page fault rate p</b>：0 ≤ p ≤ 1，每次存取發生 fault 的機率。</li><li><b>EAT</b> = (1 − p) × 記憶體存取時間 + p × page fault 時間。</li></ul>`,
      checkpoint: [
        { id: 'ch8-pf-1', type: 'trace', q: 'Process 存取的 page 不在 RAM。依序會發生？', options: ['TLB miss → 查 page table → 讀資料', 'trap → OS 檢查合法性 → 找 frame → 磁碟讀入 → 更新 page table → 重新執行指令', 'process 被終止', 'OS 直接從磁碟讀資料給 CPU，不經過 RAM'], answer: 1, explanation: '這是完整的 page fault 處理流程；process 在磁碟 I/O 期間為 Waiting。' },
        { id: 'ch8-pf-2', type: 'calc', q: '記憶體存取 200 ns，page fault 處理 8 ms（8,000,000 ns），page fault rate = 0.001。EAT 約幾 ns？', fields: [{ label: 'EAT (ns)', answer: 8199.8, tol: 1 }], explanation: '0.999 × 200 + 0.001 × 8,000,000 = 199.8 + 8000 ≈ 8200 ns。千分之一的 fault 率就讓存取慢 40 倍。' },
        { id: 'ch8-pf-3', type: 'concept', q: 'Page fault 與 TLB miss 的差別？', options: ['一樣', 'TLB miss：對映不在 cache 但頁在 RAM，硬體查表即可；Page fault：頁不在 RAM，需要 OS 介入做磁碟 I/O', 'Page fault 比較快', 'TLB miss 需要 OS 處理'], answer: 1, explanation: 'TLB miss 約幾十 ns 由硬體解決；page fault 約幾 ms 由軟體解決。' },
        { id: 'ch8-pf-4', type: 'scenario', q: 'Page fault 處理過程中，該 process 處於什麼狀態？為什麼？', options: ['Running，因為它在等 OS', 'Waiting，因為在等磁碟 I/O，CPU 可給其他 process', 'Ready', 'Terminated'], answer: 1, explanation: '磁碟 I/O 要幾毫秒，讓 CPU 空等太浪費。' }
      ]
    },
    {
      id: 'page-replacement',
      title: 'Page Replacement：FIFO / LRU / Optimal',
      en: 'When no frame is free, the OS must evict a victim page. FIFO evicts the oldest, LRU the least recently used, OPT the one used farthest in the future (a lower bound).',
      why: R`<p>Page fault 要找 free frame。RAM 滿了怎麼辦？得選一個 page 踢出去（寫回磁碟如果它被改過）。選誰？選錯了它馬上又被用到，又一次 fault。目標：<b>最小化 page fault 數</b>。</p>`,
      scenario: R`<p>Reference string 7 0 1 2 0 3 0 4，3 個 frame。前三個 7、0、1 各佔一個 frame（3 次 fault，無可避免）。第四個 2 來了，滿了——踢誰？</p><ul><li><b>FIFO</b>：踢最早進來的 7。</li><li><b>LRU</b>：踢最久沒用的 7（此例剛好一樣）。</li><li><b>OPT</b>：看未來：0 下一步就用、1 之後不再用、7 也不再用 → 踢 7 或 1。</li></ul><p>差異在後面：下一個 0 來——如果剛剛踢的是 0，就又 fault。</p>`,
      how: R`<ul>
<li><b>FIFO</b>：queue 記錄載入順序，踢最舊的。簡單，但「舊」不代表「沒用」——常駐的頁（例如迴圈）也會被踢。而且有 <b>Belady's anomaly</b>：frame 變多 fault 反而可能變多。</li>
<li><b>Optimal（OPT / MIN）</b>：踢「未來最久才會再用」的。fault 數最少（可證明），但需要知道未來，實際不可行——只當作比較基準。</li>
<li><b>LRU</b>：踢「過去最久沒用」的。用過去近似未來（局部性），效果通常接近 OPT，沒有 Belady's anomaly。實作成本高：每次存取要更新時間戳或移動串列，硬體很少完整支援。</li>
<li><b>LRU 近似</b>：reference bit（硬體每次存取設 1，OS 定期清 0）、<b>second-chance / clock</b>（FIFO 但 reference bit = 1 的給第二次機會）。實際 OS 用的是這類。</li>
</ul>`,
      sim: 'pageReplaceSim',
      definition: R`<ul><li><b>Reference string</b>：page number 的存取序列。</li><li><b>Victim page</b>：被選中換出的 page。若 <b>dirty bit</b> = 1（曾被修改）需寫回磁碟，否則直接丟棄。</li><li><b>Belady's anomaly</b>：增加 frame 數反而增加 page fault 的現象（FIFO 有；LRU、OPT 這類 stack algorithm 沒有）。</li><li>教科書字串 7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1、3 frames：FIFO 15、OPT 9、LRU 12 次 fault。</li></ul>`,
      checkpoint: [
        { id: 'ch8-pr-1', type: 'calc', q: 'Reference string 7 0 1 2 0 3 0 4，3 frames。FIFO、LRU、OPT 各幾次 page fault？', fields: [{ label: 'FIFO', answer: 7 }, { label: 'LRU', answer: 6 }, { label: 'OPT', answer: 6 }], hint: '前三次一定 fault。用模擬器驗證。', explanation: 'FIFO：7 0 1 F F F，2 踢 7 F，0 hit，3 踢 0 F，0 踢 1 F，4 踢 2 F → 7。LRU：2 踢 7 F，0 hit，3 踢 1 F，0 hit，4 踢 2 F → 6。OPT：2 踢 7 F，0 hit，3 踢 2 或 1（都不再用）F，0 hit，4 踢任一（都不再用）F → 6。' },
        { id: 'ch8-pr-2', type: 'trace', q: 'LRU，3 frames 目前是 [2, 0, 3]，最近使用時間分別 t=3、t=4、t=5。下一個存取 page 4。victim 是？', options: ['2', '0', '3', '4'], answer: 0, explanation: 'LRU 踢最久沒用的：page 2（t=3）。' },
        { id: 'ch8-pr-3', type: 'calc', q: 'Reference string 1 2 3 4 1 2 5 1 2 3 4 5，FIFO。3 frames 與 4 frames 各幾次 fault？', fields: [{ label: '3 frames', answer: 9 }, { label: '4 frames', answer: 10 }], explanation: '4 個 frame 反而多一次——這就是 Belady\'s anomaly。' },
        { id: 'ch8-pr-4', type: 'concept', q: '為什麼 OPT 不能直接用在真實系統？', options: ['太慢', '需要知道未來的 reference string', '會有 Belady\'s anomaly', '需要太多 frame'], answer: 1, explanation: '它是理論下界，用來評估其他演算法有多接近最佳。' },
        { id: 'ch8-pr-5', type: 'concept', q: 'Second-chance（clock）演算法是哪種演算法的近似？', options: ['FIFO 的近似', 'LRU 的近似：用 reference bit 給最近用過的頁第二次機會', 'OPT 的精確實作', 'Random'], answer: 1, explanation: '完整 LRU 硬體成本高；clock 用一個 bit 近似「最近有沒有用過」。' }
      ]
    },
    {
      id: 'thrashing',
      title: 'Thrashing',
      en: 'Thrashing: processes spend more time paging than executing because they do not have enough frames for their working sets. CPU utilization collapses.',
      why: R`<p>如果 process 一直 page fault，CPU 大部分時間不是在算東西，而是在 RAM ↔ Disk 搬 page。更糟的是這會自我惡化：CPU 看起來很閒 → OS 以為可以多載入幾個 process → 每個 process 分到的 frame 更少 → fault 更多。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">低 Page Fault → CPU Utilization 高
   每個 process 的常用頁都在 RAM，CPU 一直有事做

大量 Page Fault → Thrashing
   process A fault → 踢掉 B 的頁 → B 跑 → fault → 踢掉 A 的頁 → …
   CPU 使用率崩跌，磁碟燈狂閃</pre>`,
      how: R`<p><b>原因</b>：每個 process 有一個 <b>working set</b>——最近一段時間內用到的 page 集合（迴圈裡的程式碼和資料）。只要 working set 放得進 RAM，fault 就很少；一旦分到的 frame 少於 working set 大小，就會不停 fault。當所有 process 的 working set 總和大於 RAM，系統整體 thrashing。</p>
<p><b>解法</b>：</p><ul><li><b>Working-set model</b>：OS 估計每個 process 的 working set 大小 WSS<sub>i</sub>。若 ΣWSS<sub>i</sub> &gt; 總 frame 數，就把某個 process 整個 swap out（降低 multiprogramming 程度）。</li><li><b>Page-fault frequency（PFF）</b>：直接量 fault 率。太高 → 給它更多 frame；太低 → 收回一些。沒有 frame 可給 → swap out 某個 process。</li><li><b>Local replacement</b>：process 只能踢自己的頁，避免一個 process 的 thrashing 拖累全部。</li></ul>`,
      sim: 'thrashingSim',
      definition: R`<ul><li><b>Thrashing</b>：process 花在 paging 的時間多於執行的時間的狀態。</li><li><b>Working set</b>：process 在最近 Δ 次記憶體存取中觸及的 page 集合；Δ 是 working-set window。</li><li><b>Locality</b>：程式在一段時間內傾向存取一小群 page（時間局部性 + 空間局部性）。這是 demand paging、TLB、cache 能運作的根本假設。</li><li><b>Degree of multiprogramming</b>：同時在記憶體中的 process 數。</li></ul>`,
      checkpoint: [
        { id: 'ch8-th-1', type: 'scenario', q: '系統 CPU 使用率很低、磁碟活動極高、每個 process 都很慢。最可能是？應該怎麼做？', options: ['CPU 太慢；換 CPU', 'Thrashing；減少同時執行的 process 數（swap out 一些）或增加 RAM', 'Deadlock；重開機', '正常現象'], answer: 1, explanation: '低 CPU + 高磁碟 = 在搬 page。直覺反應（多載入 process 讓 CPU 忙）會讓情況更糟。' },
        { id: 'ch8-th-2', type: 'concept', q: 'Working set 是？', options: ['process 的全部 page', 'process 最近一段時間存取過的 page 集合，反映它目前的局部性', 'RAM 中所有 process 的 page', '最常被踢出的 page'], answer: 1, explanation: '只要 working set 在 RAM，process 就能順暢執行；這是分配 frame 的依據。' },
        { id: 'ch8-th-3', type: 'trace', q: 'Process A 正在 thrashing，系統使用 global replacement。對其他 process 的影響？', options: ['沒有影響', 'A 頻繁 fault 會踢掉其他 process 的頁，把 thrashing 傳染出去', '其他 process 會更快', 'A 會被自動終止'], answer: 1, explanation: 'Global replacement 讓 A 可以拿走任何人的 frame。Local replacement 可以隔離。' }
      ]
    }
  ]
});
})();
