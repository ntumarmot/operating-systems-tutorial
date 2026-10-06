/* Chapter 7：Memory Management */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch7', num: 7, title: 'Memory Management', topic: 'memory',
  subtitle: 'Logical vs Physical Address、MMU、連續配置與碎片、Paging、TLB。',
  why: R`<p>「程式認為自己有一大片從 0 開始的連續記憶體，但實體 RAM 真的是這樣嗎？」不是。300 個 process 都以為自己從位址 0 開始——它們顯然不能真的都在 0。這章講 OS 和硬體怎麼合作，把每個 process 眼中的「邏輯位址」對應到真正的「實體位址」，而且要快、要省、要能保護。</p>`,
  concepts: [
    {
      id: 'address-space',
      title: '邏輯位址、實體位址與 MMU',
      en: 'The CPU generates logical (virtual) addresses; the MMU translates them to physical addresses at run time. Programs never see physical addresses.',
      why: R`<p>如果程式裡的位址就是實體位址，那編譯時就得決定程式載到 RAM 的哪裡；兩個程式想用同一個位址就衝突；一個程式能任意讀寫別人的記憶體。要同時解決「不知道會被載到哪」「互不干擾」「不能碰別人」，需要在 CPU 和 RAM 之間加一層翻譯。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">CPU ──logical address（程式看到的）──▶ MMU ──physical address（RAM 看到的）──▶ RAM
                                        │
                              查表 / 加 base / 檢查 limit</pre>
<p>每個 process 都以為自己從 0 開始；MMU 用每個 process 自己的對映把它們送到 RAM 的不同地方。程式從頭到尾不知道、也不需要知道自己實際在哪。</p>`,
      how: R`<p>最簡單的 MMU：兩個暫存器。</p><ul><li><b>Base（relocation）register</b>：這個 process 在 RAM 的起始位址。實體位址 = 邏輯位址 + base。</li><li><b>Limit register</b>：這個 process 的大小。邏輯位址 ≥ limit → trap（存取越界，Segmentation fault）。</li></ul><p>Context switch 時 kernel 把新 process 的 base/limit 載入 MMU——所以切換 process 也就切換了它能看到的記憶體。這兩個暫存器只能在 kernel mode 修改（特權指令，Ch0）。</p><p>後面的 paging 只是把「一個 base」變成「一張表」，原理相同。</p>`,
      sim: 'mmuSim',
      definition: R`<ul><li><b>Logical address（邏輯位址／虛擬位址）</b>：CPU 執行指令時產生的位址；程式碼、指標、PC 裡的都是它。</li><li><b>Physical address（實體位址）</b>：送到記憶體匯流排、RAM 實際看到的位址。</li><li><b>Logical address space</b>：一個 process 所有邏輯位址的集合（例如 0 到 2<sup>48</sup>）。</li><li><b>MMU（Memory Management Unit）</b>：CPU 內負責把邏輯位址翻譯成實體位址的硬體。翻譯發生在<b>每一次</b>記憶體存取，所以必須是硬體做。</li><li><b>Binding time</b>：位址在編譯時（絕對碼）、載入時（重定位碼）或執行時（需要 MMU）決定。現代系統都是執行時。</li></ul>`,
      checkpoint: [
        { id: 'ch7-as-1', type: 'calc', q: 'base = 14000，limit = 12000。邏輯位址 346 對應的實體位址？邏輯位址 12500 會怎樣（填 0 代表 trap）？', fields: [{ label: '346 → 實體', answer: 14346 }, { label: '12500 → 實體（trap 填 0）', answer: 0 }], explanation: '346 < 12000，實體 = 346 + 14000 = 14346。12500 ≥ limit → trap。' },
        { id: 'ch7-as-2', type: 'concept', q: 'C 程式裡 printf("%p", &x) 印出來的是？', options: ['實體位址', '邏輯（虛擬）位址', '磁碟位址', 'MMU 的 base'], answer: 1, explanation: 'user 程式永遠只看得到邏輯位址；兩個 process 印出相同的位址值很正常，它們對應不同的實體位置。' },
        { id: 'ch7-as-3', type: 'concept', q: '為什麼位址翻譯必須由硬體（MMU）而不是 OS 軟體來做？', options: ['因為 OS 不會算加法', '因為每一條存取記憶體的指令都要翻譯，用軟體會慢上百倍', '因為 OS 沒有權限', '其實是 OS 做的'], answer: 1, explanation: 'OS 負責設定對映（填 base/limit 或 page table）；每次存取的翻譯由 MMU 硬體執行。' }
      ]
    },
    {
      id: 'contiguous',
      title: '連續配置：First / Best / Worst Fit',
      en: 'Contiguous allocation gives each process one block. Fixed partitions cause internal fragmentation; variable partitions with first/best/worst fit cause external fragmentation.',
      why: R`<p>有了 base/limit，每個 process 在 RAM 是一塊連續區域。process 來來去去，RAM 會變成「用、空、用、空」的樣子。新 process 來了，該放進哪個空洞（hole）？</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">RAM：[ OS ][ P1 ][ free 200 ][ P2 ][ free 300 ][ P3 ][ free 150 ]
新 process 需要 120：
  First Fit → 第一個夠大的：200 的那個
  Best Fit  → 夠大且最小的：150 的那個（剩 30，幾乎沒用的碎片）
  Worst Fit → 最大的：300 的那個（剩 180，還能再放東西）</pre>`,
      how: R`<ul>
<li><b>Fixed partition（固定分割）</b>：RAM 事先切成固定大小的格子，一格一個 process。簡單，但 process 用不完一格的部分浪費掉 → <b>internal fragmentation</b>。</li>
<li><b>Variable partition（可變分割）</b>：process 要多少給多少。OS 維護一個 hole 串列。process 離開時 hole 歸還並與相鄰 hole 合併。久了會有很多小 hole：加起來很大，但沒有一個夠放新 process → <b>external fragmentation</b>。</li>
<li><b>First fit</b>：從頭掃，第一個夠大的。快。</li>
<li><b>Best fit</b>：全部掃，最小的夠大者。留下最小碎片——但這些碎片小到沒人能用。</li>
<li><b>Worst fit</b>：最大的。留下的碎片大，希望還能用。實測通常最差。</li>
</ul>
<p>模擬顯示 first fit 和 best fit 在時間與空間利用率上通常比 worst fit 好；first fit 通常最快。<b>50% rule</b>：first fit 下，N 個已分配區塊平均會伴隨 0.5N 個 hole，約三分之一的記憶體無法使用。</p>`,
      sim: 'allocSim',
      definition: R`<ul><li><b>Dynamic storage allocation problem</b>：從一組大小不一的 hole 中滿足一個大小為 n 的請求。</li><li><b>Compaction</b>：把所有 process 搬到一起，碎片合併成一大塊。需要執行時重定位（有 MMU 才做得到），且搬移成本高。</li><li>更根本的解法：<b>不要求連續</b>——這就是下一節 paging 的動機。</li></ul>`,
      checkpoint: [
        { id: 'ch7-ca-1', type: 'scenario', q: 'Hole 依序為 100 KB、500 KB、200 KB、300 KB、600 KB。process 212 KB 用 First / Best / Worst Fit 各放進哪個 hole？', options: ['500 / 300 / 600', '500 / 300 / 500', '300 / 300 / 600', '200 / 300 / 600'], answer: 0, explanation: 'First：第一個 ≥ 212 的是 500。Best：≥ 212 中最小是 300。Worst：最大是 600。' },
        { id: 'ch7-ca-2', type: 'concept', q: 'Best fit 的主要缺點？', options: ['太快', '留下大量極小的、無法使用的碎片', '總是選最大的 hole', '需要 compaction'], answer: 1, explanation: '「剛剛好」的 hole 剩下的部分往往小到沒有 process 放得進去。' },
        { id: 'ch7-ca-3', type: 'scenario', q: 'Free 空間總共 500 KB，分散在 5 個各 100 KB 的 hole。一個 150 KB 的 process 能放進去嗎？這是什麼現象？', options: ['能，總量夠', '不能；external fragmentation', '不能；internal fragmentation', '能，OS 會自動拆成兩塊'], answer: 1, explanation: '連續配置要求一整塊；總量夠但沒有連續的夠大區塊 = external fragmentation。' }
      ]
    },
    {
      id: 'fragmentation',
      title: 'Internal vs External Fragmentation',
      en: 'Internal fragmentation is wasted space inside an allocated block; external fragmentation is free space scattered in holes too small to use.',
      why: R`<p>兩種碎片名字很像、常被搞混，但發生原因相反、解法也相反。面試被問到「paging 解決了什麼問題」時，答案就是「external fragmentation」——但 paging 又帶來 internal fragmentation。搞清楚才答得出來。</p>`,
      scenario: R`<p><b>Internal</b>：便當盒固定大小，你的菜只裝一半，剩下的空間是你的、但你沒用——別人也用不到。<b>External</b>：停車場總共還有 5 個車位的空間，但都是零碎的半個車位，一台車也停不進去。</p>`,
      how: R`<table class="vs-table"><tr><th></th><th>Internal fragmentation</th><th>External fragmentation</th></tr>
<tr><td>浪費在哪</td><td>已分配區塊的<b>內部</b></td><td>已分配區塊<b>之間</b>的 hole</td></tr>
<tr><td>原因</td><td>分配單位是固定大小（partition、page、block），需求不是整數倍</td><td>可變大小的分配與釋放使空間零碎化</td></tr>
<tr><td>誰會有</td><td>固定分割、paging（最後一頁）、檔案系統 block</td><td>可變分割、segmentation、malloc 的 heap</td></tr>
<tr><td>解法</td><td>縮小分配單位（但管理成本上升）</td><td>compaction，或改用非連續配置（paging）</td></tr></table>`,
      sim: 'fragmentation',
      definition: R`<ul><li><b>Internal fragmentation</b>：分配給 process 的記憶體大於其實際需求，多出的部分無法被其他 process 使用。</li><li><b>External fragmentation</b>：總可用記憶體足夠，但不連續，無法滿足請求。</li></ul>`,
      checkpoint: [
        { id: 'ch7-fr-1', type: 'concept', q: 'Paging 中，一個 process 大小 72,766 bytes，page size 2,048。最後一頁浪費多少？屬於哪種碎片？', options: ['1,086 bytes；internal', '1,086 bytes；external', '962 bytes；internal', '0；paging 沒有碎片'], answer: 2, hint: '72766 ÷ 2048 = 35 頁餘 1086。', explanation: '需要 36 頁，最後一頁只用 1086 bytes，浪費 2048 − 1086 = 962 bytes。這是在已分配的頁內部，屬於 internal。' },
        { id: 'ch7-fr-2', type: 'concept', q: 'Compaction 解決的是哪種碎片？需要什麼前提？', options: ['Internal；固定分割', 'External；執行時動態重定位（程式搬家後位址仍正確）', 'Internal；paging', 'External；不需前提'], answer: 1, explanation: '搬移 process 會改變它的實體位址，只有執行時綁定（MMU）才能在搬家後繼續正確執行。' },
        { id: 'ch7-fr-3', type: 'concept', q: 'Page size 變小，internal fragmentation 與 page table 大小如何變化？', options: ['兩者都變小', '碎片變小，page table 變大', '碎片變大，page table 變小', '兩者都變大'], answer: 1, explanation: '頁越小，最後一頁浪費越少；但頁數變多，page table 項目也變多。這是典型取捨。' }
      ]
    },
    {
      id: 'paging',
      title: '分頁（Paging）與位址轉換',
      en: 'Paging cuts logical memory into pages and physical memory into equal-size frames. A page table maps page → frame; the offset within the page is unchanged.',
      why: R`<p>External fragmentation 的根源是「process 必須連續」。如果 process 不需要連續放在 RAM，是不是就不用一直找一大塊連續空間？把 process 切成固定大小的小塊（page），RAM 也切成同樣大小的格子（frame），每一塊放進任何一個空格——任何空格都一樣大，永遠不會「太小放不下」。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">Logical memory        Page Table          Physical memory
┌────────┐            Page │ Frame         ┌────────┐ frame 0
│ page 0 │──┐          0   │  5            │        │
├────────┤  │          1   │  2            ├────────┤ frame 1
│ page 1 │  │          2   │  8            │ page 3 │
├────────┤  │          3   │  1            ├────────┤ frame 2
│ page 2 │  │                              │ page 1 │
├────────┤  │                              ├────────┤ ...
│ page 3 │  └─────────────────────────────▶│ page 0 │ frame 5
└────────┘                                 └────────┘</pre>
<p>程式看到的是左邊：連續的 page 0、1、2、3。實際上它們散在 frame 5、2、8、1。中間那張表是 OS 填的、MMU 查的。</p>`,
      how: R`<p>邏輯位址被<b>切成兩段</b>：高位是 <b>page number</b>（查表用），低位是 <b>offset</b>（頁內第幾個 byte）。</p>
<p>以 page size = 4 bytes、邏輯位址 13 為例：</p>
<ol><li>13 = 1101<sub>2</sub>。page size 4 = 2<sup>2</sup>，offset 佔 2 bits → offset = 01 = 1，page number = 11 = 3。（也就是 13 ÷ 4 = 3 餘 1。）</li><li>查 page table：page 3 → frame 1。</li><li>實體位址 = frame × page size + offset = 1 × 4 + 1 = <b>5</b>。</li></ol>
<p>注意 offset 完全沒變——paging 只換「哪一頁」，不動「頁內的位置」。這就是 <code>PA = frame × page_size + offset</code> 的來源：不是公式，是「換掉高位、保留低位」的自然結果。</p>
<p>用下面的模擬輸入不同的邏輯位址，看每一步。</p>`,
      sim: 'pagingSim',
      definition: R`<ul><li><b>Page</b>：邏輯記憶體的固定大小區塊（常見 4 KB）。</li><li><b>Frame</b>：實體記憶體的固定大小區塊，與 page 同大。</li><li><b>Page table</b>：每個 process 一張，index 是 page number，內容是 frame number（加上 valid、protection 等 bit）。由 <b>PTBR</b>（page-table base register）指向，context switch 時切換。</li><li>邏輯位址 m bits、page size 2<sup>n</sup>：高 m−n bits 是 page number，低 n bits 是 offset。</li><li><b>Paging 解決了什麼</b>：external fragmentation（任何 frame 都能用）與連續配置的限制。<b>帶來什麼</b>：internal fragmentation（最後一頁）、page table 的空間、每次存取多一次記憶體讀取（查表）。</li><li><b>Frame table</b>：OS 維護的全系統表，記錄每個 frame 是否空閒、屬於誰。</li></ul>`,
      checkpoint: [
        { id: 'ch7-pg-1', type: 'calc', q: 'Page size = 4，page table：0→5, 1→2, 2→8, 3→1。邏輯位址 13 的 page number、offset、實體位址？', fields: [{ label: 'Page number', answer: 3 }, { label: 'Offset', answer: 1 }, { label: '實體位址', answer: 5 }], explanation: '13 ÷ 4 = 3 餘 1；page 3 → frame 1；1 × 4 + 1 = 5。' },
        { id: 'ch7-pg-2', type: 'calc', q: 'Page size = 1 KB（1024）。邏輯位址 3000 的 page number 與 offset？若 page 2 → frame 7，實體位址？', fields: [{ label: 'Page number', answer: 2 }, { label: 'Offset', answer: 952 }, { label: '實體位址', answer: 8120 }], explanation: '3000 ÷ 1024 = 2 餘 952；7 × 1024 + 952 = 8120。' },
        { id: 'ch7-pg-3', type: 'calc', q: '32 位元邏輯位址，page size 4 KB。offset 佔幾個 bit？page table 最多有幾個項目？', fields: [{ label: 'Offset bits', answer: 12 }, { label: '項目數', answer: 1048576 }], hint: '4 KB = 2^12；32 − 12 = 20。', explanation: 'offset 12 bits；page number 20 bits → 2^20 = 1,048,576 項。每項 4 bytes 就是 4 MB——這是為什麼需要多層 page table。' },
        { id: 'ch7-pg-4', type: 'concept', q: 'Paging 主要解決了什麼問題？', options: ['Internal fragmentation', 'External fragmentation：process 不需連續存放，任何空 frame 都可用', 'Page fault', 'Thrashing'], answer: 1, explanation: '固定大小的 frame 消除了「hole 太小」的問題；代價是最後一頁的 internal fragmentation。' },
        { id: 'ch7-pg-5', type: 'concept', q: '同一個 process 中，兩個相鄰的 page 在實體記憶體中？', options: ['一定相鄰', '不一定相鄰，可以在任何 frame', '一定不相鄰', '一定在同一個 frame'], answer: 1, explanation: '這正是 paging 的重點：邏輯上連續、實體上任意。' }
      ]
    },
    {
      id: 'tlb',
      title: 'TLB（Translation Lookaside Buffer）',
      en: 'The TLB is a small, fast cache of recent page→frame translations inside the MMU. A hit avoids the extra memory access to the page table.',
      why: R`<p>Page table 在記憶體裡。所以每次程式存取記憶體，MMU 都要<b>先讀一次記憶體</b>查表，再讀一次真正的資料——存取次數翻倍，程式慢一半。這不能接受。解法和所有「太慢」的問題一樣：加 cache。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">CPU ─ page# ─▶ TLB ─ hit ─▶ frame# ──▶ 存取資料（1 次記憶體存取）
                │
               miss
                ▼
           Page Table（在 RAM）─▶ frame# ──▶ 存取資料（2 次記憶體存取）
                │
                └─ 把 (page#, frame#) 放進 TLB</pre>
<p>程式有<b>局部性</b>：連續的指令通常在同一頁，迴圈反覆碰同幾頁。所以一個只有 64～1024 個項目的 TLB，hit ratio 常常超過 99%。</p>`,
      how: R`<ul><li>TLB 是 MMU 裡的<b>associative memory</b>：所有項目同時比對，一個 cycle 內回答。</li><li>Hit：直接拿 frame number。Miss：查 page table，把結果放進 TLB（滿了就用 LRU 或隨機踢掉一個）。</li><li><b>Context switch 時 TLB 要清空</b>（不同 process 的 page 3 對應不同 frame），或用 <b>ASID</b>（address-space ID）標記每個項目屬於哪個 process，就不用清。這是 process 切換比 thread 切換貴的原因之一（Ch2）。</li></ul>
<p><b>Effective Access Time（EAT）</b>：記憶體存取 100 ns，TLB 查詢 10 ns，hit ratio α：</p>
<p>EAT = α × (10 + 100) + (1 − α) × (10 + 100 + 100)。α = 0.8 → 130 ns；α = 0.99 → 111 ns。</p>`,
      sim: 'tlbSim',
      definition: R`<ul><li><b>TLB</b>：快取 page table 項目的硬體 cache，位於 MMU 內。</li><li><b>TLB hit / miss</b>：page number 在 / 不在 TLB。</li><li><b>Hit ratio</b>：命中比例。</li><li><b>Wired-down entries</b>：kernel 重要頁面的 TLB 項目可被固定不淘汰。</li></ul>`,
      checkpoint: [
        { id: 'ch7-tlb-1', type: 'calc', q: 'TLB 查詢 10 ns，記憶體存取 100 ns，hit ratio 80%。EAT 是多少 ns？', fields: [{ label: 'EAT (ns)', answer: 130 }], explanation: '0.8 × 110 + 0.2 × 210 = 88 + 42 = 130。' },
        { id: 'ch7-tlb-2', type: 'calc', q: '同上，hit ratio 提升到 98%。EAT？', fields: [{ label: 'EAT (ns)', answer: 112 }], explanation: '0.98 × 110 + 0.02 × 210 = 107.8 + 4.2 = 112。' },
        { id: 'ch7-tlb-3', type: 'concept', q: '為什麼 context switch 到另一個 process 時要清空 TLB（或使用 ASID）？', options: ['因為 TLB 會過熱', '因為 TLB 裡的 page→frame 對映屬於前一個 process，對新 process 是錯的', '因為新 process 的 page 比較多', '不需要清空'], answer: 1, explanation: '每個 process 有自己的 page table；同一個 page number 對應不同 frame。' },
        { id: 'ch7-tlb-4', type: 'concept', q: 'TLB miss 時發生什麼？', options: ['產生 page fault', 'MMU 去記憶體讀 page table 取得 frame，並把該項目放入 TLB', 'process 被終止', 'OS 從磁碟載入頁面'], answer: 1, explanation: 'TLB miss 只是 cache miss，頁面仍在記憶體；page fault 是頁面不在記憶體（Ch8），兩者不同。' }
      ]
    }
  ]
});
})();
