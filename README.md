# OS Review｜作業系統互動複習網站

純前端（HTML / CSS / JavaScript）的作業系統互動學習系統。無後端、無框架、無需安裝套件；KaTeX 已放在 `vendor/`，**離線可用**。
所有學習進度（已完成概念、答題紀錄、錯題本、上次學習位置、Trace 紀錄）存在瀏覽器的 `localStorage`。

## 如何在本機啟動

### 方法一：直接開啟

在 Finder 雙擊 `index.html`，或：

```bash
open index.html
```

### 方法二：本機伺服器（建議）

```bash
cd os-review
python3 -m http.server 8000
```

打開 <http://localhost:8000>。

## 教學流程

每個概念依固定順序呈現（沒有的段落會自動略過）：

1. **為什麼需要它？** → 2. **直覺情境** → 3. **OS 如何處理** → 4. **內部狀態視覺化**（互動模擬） → 5. **正式定義** → 6. **演算法 / 程式碼**（C / C++） → 7. **Step-by-step Trace** → 8. **題目**

## 章節與互動模擬

| 章節 | 主題 | 互動模擬 |
|---|---|---|
| Ch0 OS 是什麼 | 分層、User/Kernel Mode、System Call、Interrupt | 三層架構圖、特權指令實驗、**System Call Simulator**、Interrupt 流程 |
| Ch1 Process | Program vs Process、記憶體配置、Process State、PCB、Context Switch | Program→Process、**記憶體配置逐步（Stack/Heap/Data/Text）**、**Process State Simulator**（可多 process）、**Context Switch 動畫** |
| Ch2 Thread | Process vs Thread、Thread 模型 | 共享 / 各自擁有比較 |
| Ch3 CPU Scheduling | 度量、FCFS、SJF/SRTF、Preemption、RR、Priority | Gantt 教學、**Scheduling Simulator**（可編輯、六種演算法、Next Step、Ready Queue、剩餘時間、Waiting/Turnaround/Response、比較所有演算法）、**SJF vs SRTF 並排** |
| Ch4 Concurrency | Race Condition、Critical Section、Mutex、Peterson、硬體原子指令 | **counter++ 交錯實驗**（自己排順序）、有鎖 vs 沒鎖、**Peterson Simulator** |
| Ch5 Semaphore | Semaphore、Producer-Consumer、Readers-Writers、Dining Philosophers | **3 資源 5 process**、**Bounded Buffer（mutex/empty/full）**、Readers-Writers、**哲學家（可製造 deadlock）** |
| Ch6 Deadlock | 四條件、RAG、Prevention/Avoidance/Detection、Banker's | 兩 process 卡死動畫、**RAG 建構器（找環）**、**Banker's Simulator**（安全序列逐步、請求檢查） |
| Ch7 Memory | MMU、連續配置、碎片、Paging、TLB | Base/Limit、**First/Best/Worst Fit Simulator**、Internal vs External、**Paging 位址轉換逐步**、**TLB hit/miss** |
| Ch8 Virtual Memory | Demand Paging、Page Fault、Page Replacement、Thrashing | **Page Fault 流程**、**FIFO/LRU/OPT Simulator**（Next Step、victim、總表、三者比較、Belady）、Thrashing 曲線 |
| Ch9 File System & I/O | inode、fd、open/read/write/close、Polling/Interrupt/DMA、Disk Scheduling | fd table→OFT→inode、三種 I/O 方式時間軸、**磁頭移動動畫** |

其他頁面：

- **OS Trace Mode**（`#/trace`）：給情境 + 事件 → 先預測 → 答完才播放動畫驗證（14 題）。
- **OS Interview Mode**（`#/interview`）：隨機抽題，只顯示問題；提供提示、30 秒回答、60 秒完整回答、可能的追問、下一題。
- **綜合測驗**（`#/quiz`）：Concept / Trace / Calculation / Scenario / Code 五種題型隨機抽題。
- **錯題本**（`#/wrong`）：記錄題目、我的答案、正確答案、解釋、所屬概念與章節、錯誤次數；需**連續答對兩次**才標記「已掌握」。
- **Dashboard**：Overall Progress、Chapters Completed、Questions Answered、Accuracy、Weakest Topics、Wrong Answers、Continue Learning（回到上次位置），以及六大核心主題（Process & Thread / CPU Scheduling / Synchronization / Deadlock / Memory / Virtual Memory）熟練度。

## 檔案結構

```
os-review/
├── index.html
├── css/style.css              樣式（light / dark 主題變數、responsive、所有視覺元件）
├── js/
│   ├── util.js                DOM 工具、C/C++ 語法上色、Stepper（逐步控制列）、預測小工具
│   ├── storage.js             localStorage 封裝（進度、答題、錯題、上次位置、Trace、主題熟練度）
│   ├── quiz.js                題目渲染與作答（五種題型）
│   ├── interview.js           Interview Mode
│   ├── trace.js               Trace Mode
│   ├── app.js                 路由、側邊欄、Dashboard、章節頁、錯題本、綜合測驗
│   ├── engines/               純演算法（不碰 DOM，可用 node 測試）
│   │   ├── sched.js           FCFS / SJF / SRTF / RR / Priority（含逐步狀態與指標）
│   │   ├── memory.js          位址轉換、First/Best/Worst Fit、FIFO/LRU/OPT、TLB
│   │   ├── banker.js          Banker's 安全性與請求演算法
│   │   └── disk.js            FCFS / SSTF / SCAN / C-SCAN / LOOK / C-LOOK
│   ├── sims/                  互動模擬（每個 Sims.名稱 = (slot, concept) => …）
│   │   ├── basics.js  process.js  scheduling.js  sync.js  semaphore.js
│   │   ├── deadlock.js  memory.js  vm.js  fsio.js
│   └── content/               教學內容（純資料）
│       ├── ch00.js … ch09.js
│       ├── interview.js       面試題庫
│       └── trace.js           Trace 題庫
└── vendor/katex/              KaTeX（本機版）
```

## 網址路由

- `#/` Dashboard
- `#/ch/ch3` 第 3 章；`#/ch/ch3/rr` 直接跳到該概念（網址加 `?noscroll` 可停用自動捲動）
- `#/trace`、`#/trace/tr-timer` Trace Mode
- `#/interview`、`#/quiz`、`#/wrong`
- `#/sim/schedSim` 單獨開啟某個互動模擬（除錯用）

## 修改或新增內容

- **概念物件**（`js/content/chXX.js`）欄位：`id`、`title`、`en`（一句英文摘要）、`why`、`scenario`、`how`、`sim`（模擬名稱）、`simOpts`（傳給模擬的參數）、`definition`、`code`（`{ src, title, note }` 或 HTML）、`traceSim` / `trace`、`extra`、`checkpoint`。
- **題目**：`{ id, type, q, options, answer, hint, explanation }`（選擇）或 `{ id, type: 'calc', q, fields: [{ label, answer, tol }] }`（計算）；`type` 可為 `concept | trace | calc | scenario | code`；`code` 題可加 `code` 欄位顯示程式碼。**`id` 必須全站唯一**（錯題本靠它追蹤）。
- **章節** 需設定 `topic`（`process | sched | sync | deadlock | memory | vm | basics | fs`），Dashboard 的熟練度依此彙整。
- **內容字串**用 `String.raw`（`R\`...\``）撰寫，可直接放 HTML 與 LaTeX（`$...$`）。避免在內容裡使用反引號與 `${`。
- **新增模擬**：在 `js/sims/` 定義 `S.名稱 = function (slot, concept) {...}`，用 `Util.simShell()` 建外殼、`Util.stepper()` 做逐步控制。
- **Trace 題**：在 `js/content/trace.js` 加入 `{ id, tag, title, scene, event, q, options, answer, explanation, anim: { sim, simOpts }, after, link }`。
- **面試題**：在 `js/content/interview.js` 加入 `{ id, tag, q, hint, a30, a60, followup, link }`。

## 測試

演算法引擎可直接用 Node 驗證（教科書數值）：

```bash
node -e "global.window={}; require('./js/engines/sched.js'); const r=window.Sched.run([{id:'P1',arrival:0,burst:24},{id:'P2',arrival:0,burst:3},{id:'P3',arrival:0,burst:3}],'RR',{quantum:4}); console.log(r.gantt, r.avg)"
```

Tie-break 規則（所有模擬與題目一致）：同時到達依輸入順序；SJF/SRTF/Priority 相同時先到者優先；SRTF/搶佔 Priority 與執行中者相同時不換人；RR 時間片用完同時有新到達者 → 新到達者先入隊。

## 重設進度

Dashboard 最下方「重設所有進度」，或在 DevTools 執行 `localStorage.clear()`。

### 內建測試腳本（`tests/`）

```bash
node tests/engines.test.js "$PWD"      # 排程 / 分頁 / Banker / 磁碟引擎對照教科書數值
node tests/check-content.js "$PWD"     # 題目 id 唯一性、模擬名稱是否存在、章節 topic
# 瀏覽器煙霧測試：先啟動 http.server 與 headless Chrome（--remote-debugging-port=9333），再
node tests/smoke.js 9333 http://127.0.0.1:8000/index.html
```
