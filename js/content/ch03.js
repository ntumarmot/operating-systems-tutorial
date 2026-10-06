/* Chapter 3：CPU Scheduling */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
const P3 = R`<table class="data mono"><tr><th>Process</th><th>Arrival</th><th>Burst</th></tr><tr><td>P1</td><td>0</td><td>8</td></tr><tr><td>P2</td><td>1</td><td>4</td></tr><tr><td>P3</td><td>2</td><td>2</td></tr></table>`;
CONTENT.chapters.push({
  id: 'ch3', num: 3, title: 'CPU Scheduling', topic: 'sched',
  subtitle: 'Ready Queue 裡有一堆 process，下一個給誰？先看懂 Gantt Chart，再談演算法。',
  why: R`<p>Ready Queue 裡有 10 個 process 都想要 CPU。給誰？給多久？這個決定影響：使用者按下按鍵多久有反應（response）、一個工作從提交到完成要多久（turnaround）、CPU 有沒有被浪費。沒有一個答案對所有情況都最好——所以有一整套演算法，各有取捨。這章的目標是<b>看到 Gantt Chart 就能算出所有數字，並解釋每種演算法為什麼會這樣排</b>。</p>`,
  concepts: [
    {
      id: 'metrics',
      title: '排程的度量：Turnaround / Waiting / Response Time',
      en: 'Turnaround = completion − arrival. Waiting = turnaround − burst. Response = first run − arrival. Read them off the Gantt chart before memorizing formulas.',
      why: R`<p>要比較排程演算法，得先有「好」的定義。「快」是什麼意思？從按下 Enter 到看到第一個字（response）？到整個跑完（turnaround）？還是總共在排隊的時間（waiting）？三者不同，而且會互相牴觸——一個演算法可以 response 很好但 turnaround 很差。</p>`,
      scenario: R`<p>你去餐廳（arrival = 到店時間），餐點需要 10 分鐘料理（burst）。廚房只有一個爐子，前面有人。你 12:00 到，12:20 廚師開始煮你的，12:30 上菜。</p><ul><li><b>Turnaround</b> = 12:30 − 12:00 = 30 分鐘（從到店到吃到）。</li><li><b>Waiting</b> = 30 − 10 = 20 分鐘（純等待，不含料理時間）。</li><li><b>Response</b> = 12:20 − 12:00 = 20 分鐘（第一次被服務）。</li></ul><p>若廚師煮你的煮到一半跑去煮別人的再回來，waiting 會變長但 response 不變——這就是為什麼要分開看。</p>`,
      how: R`<p><b>Gantt Chart</b> 是把「哪段時間 CPU 在跑誰」畫成一條時間軸。所有數字都能從它讀出來：</p>
<ul>
<li><b>Arrival Time</b>：process 進入 Ready Queue 的時刻。</li>
<li><b>Burst Time</b>：process 需要的 CPU 總時間（假設已知——實務上要預估）。</li>
<li><b>Completion Time</b>：在 Gantt 上最後一格結束的時刻。</li>
<li><b>Turnaround Time</b> = Completion − Arrival：從到達到完成。</li>
<li><b>Waiting Time</b> = Turnaround − Burst：在 Ready Queue 等的總時間（在 Gantt 上：到達之後，不是它顏色的格子數）。</li>
<li><b>Response Time</b> = 第一次拿到 CPU 的時刻 − Arrival。</li>
</ul>
<p>非搶佔式演算法：process 一拿到 CPU 就跑完，所以 Waiting = Response。搶佔式：可能被中斷好幾次，Waiting ≥ Response。</p>`,
      sim: 'ganttIntro',
      definition: R`<p>目標（通常互相衝突）：</p><ul><li><b>CPU utilization</b>：讓 CPU 越忙越好。</li><li><b>Throughput</b>：單位時間完成幾個 process。</li><li><b>Turnaround time</b>：越小越好。</li><li><b>Waiting time</b>：越小越好（演算法唯一能直接影響的量——burst 是固定的）。</li><li><b>Response time</b>：互動系統最在意。</li></ul><p>比較時通常看<b>平均值</b>，有時也看變異數（可預測性）。</p>`,
      checkpoint: [
        { id: 'ch3-m-1', type: 'calc', q: 'P2 在 t=1 到達，burst = 4，第一次拿到 CPU 是 t=8，中間沒被中斷，t=12 完成。求 Turnaround、Waiting、Response。', fields: [{ label: 'Turnaround', answer: 11 }, { label: 'Waiting', answer: 7 }, { label: 'Response', answer: 7 }], hint: 'Turnaround = 完成 − 到達；Waiting = Turnaround − Burst。', explanation: 'Turnaround = 12 − 1 = 11；Waiting = 11 − 4 = 7；Response = 8 − 1 = 7。非搶佔時 Waiting = Response。' },
        { id: 'ch3-m-2', type: 'concept', q: '在搶佔式排程下，Waiting Time 與 Response Time 的關係是？', options: ['永遠相等', 'Waiting ≥ Response，因為 process 第一次執行後可能再被搶佔而繼續等', 'Response ≥ Waiting', '無關'], answer: 1, explanation: 'Response 只算到第一次拿到 CPU；之後被搶佔的等待都算進 Waiting。' },
        { id: 'ch3-m-3', type: 'calc', q: 'Gantt：| P1 0–3 | P2 3–5 | P1 5–9 |。P1 到達 0、burst 7。P1 的 Waiting 與 Response？', fields: [{ label: 'Waiting', answer: 2 }, { label: 'Response', answer: 0 }], explanation: 'Turnaround = 9 − 0 = 9，Waiting = 9 − 7 = 2（就是 3–5 那段）；Response = 0 − 0 = 0。' }
      ]
    },
    {
      id: 'fcfs',
      title: 'First-Come, First-Served（FCFS）',
      en: 'FCFS runs processes in arrival order, non-preemptively. Simple and fair in one sense, but a long job in front makes everyone wait (convoy effect).',
      why: R`<p>最直覺的規則：誰先來誰先用，用完才換。實作只要一個 FIFO queue。問題是：如果第一個到的是個要跑 24 秒的大工作，後面兩個只要 3 秒的小工作就得乾等 24 秒。</p>`,
      scenario: R`<p>超市只有一個結帳櫃台，你前面的人推了一整車（burst 24），你只買一瓶水（burst 3）。FCFS 就是「排隊，不准插隊」。如果你能先結，全店平均等待時間會大幅下降——這個觀察引出下一節 SJF。</p>`,
      how: R`<p>Ready Queue 是 FIFO。CPU 空了就取隊首，跑到它結束或它自己去等 I/O。<b>非搶佔</b>：中途來了任何人都不會打斷。</p>
<p>教科書例子：P1(burst 24)、P2(3)、P3(3) 同時在 t=0 到達，順序 P1、P2、P3：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">0          24    27    30
|    P1     | P2  | P3  |</pre>
<p>Waiting：P1=0、P2=24、P3=27，平均 <b>17</b>。若順序改成 P2、P3、P1：Waiting 0、3、6，平均 <b>3</b>。同一組工作，只是順序不同，差了近 6 倍——這叫 <b>convoy effect</b>：一堆短工作被一個長工作拖住。</p>`,
      sim: 'schedSim', simOpts: { algo: 'FCFS', procs: [{ id: 'P1', arrival: 0, burst: 24 }, { id: 'P2', arrival: 0, burst: 3 }, { id: 'P3', arrival: 0, burst: 3 }], title: 'FCFS：試試把 P1 的 burst 改小、或把到達時間錯開', desc: '按「執行」後用 Next Step 逐格看。再按「比較所有演算法」看同一組資料在其他演算法下的差異。' },
      definition: R`<ul><li><b>FCFS</b>：依到達順序（FIFO）非搶佔地分配 CPU。</li><li><b>Convoy effect</b>：CPU-bound 的長工作佔著 CPU，使 I/O-bound 的短工作排隊，導致 I/O 裝置閒置、CPU 使用率與平均等待都惡化。</li><li>優點：實作簡單、無 starvation（每個人終究輪得到）。缺點：平均等待時間可能很差、不適合互動系統。</li></ul>`,
      checkpoint: [
        { id: 'ch3-f-1', type: 'calc', q: 'FCFS，P1(0, 8)、P2(1, 4)、P3(2, 2)。求平均 Waiting Time（保留兩位小數）。', fields: [{ label: '平均 Waiting', answer: 5.67, tol: 0.02 }], hint: 'Gantt：P1 0–8、P2 8–12、P3 12–14。', explanation: 'Waiting：P1 = 0，P2 = 8 − 1 = 7，P3 = 12 − 2 = 10。平均 = 17 / 3 ≈ 5.67。' },
        { id: 'ch3-f-2', type: 'concept', q: 'Convoy effect 指的是？', options: ['多個 process 同時到達', '短工作被前面的長工作拖住，整體等待時間惡化', 'CPU 過熱降頻', 'process 之間互相等待形成環'], answer: 1, explanation: '車隊效應：一台慢車帶頭，後面一整排快車都得跟著慢。' },
        { id: 'ch3-f-3', type: 'trace', q: 'FCFS 下，P1 正在執行（還剩 10），此時 burst 只有 1 的 P2 到達。接下來？', options: ['P2 立刻搶走 CPU', 'P1 繼續跑完，P2 在 Ready Queue 等', 'P1 和 P2 輪流', 'P2 被拒絕'], answer: 1, explanation: 'FCFS 是非搶佔的：到達順序決定一切，之後來的再短也要等。' }
      ]
    },
    {
      id: 'sjf-srtf',
      title: 'Shortest Job First（SJF）與 SRTF',
      en: 'SJF picks the shortest burst next and is provably optimal for average waiting time. SRTF is its preemptive version: a newly arrived shorter job takes the CPU.',
      why: R`<p>FCFS 的教訓：讓短工作先跑，平均等待就會小。推到極致：<b>永遠先跑最短的</b>。可以證明這在平均 Waiting Time 上是最佳的（把短的往前移，總是讓更多人少等）。問題是：OS 怎麼知道一個 process 還要跑多久？</p>`,
      scenario: R`<p>P1(0, 8)、P2(1, 4)、P3(2, 2)。</p>
<p><b>SJF（非搶佔）</b>：t=0 只有 P1，跑它。t=8 P1 結束，Ready Queue 有 P2(4)、P3(2) → 選 P3 → 再 P2。</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">0        8   10      14
|   P1   | P3 |  P2   |     平均 Waiting = (0 + 9 + 6)/3 = 5</pre>
<p><b>SRTF（搶佔）</b>：t=1 P2 到達，剩餘 4 &lt; P1 剩餘 7 → 搶走。t=2 P3 到達，2 &lt; P2 剩餘 3 → 再搶。</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">0 1  2   4   7        14
|P1|P2| P3 | P2 |  P1   |     平均 Waiting = (6 + 2 + 0)/3 ≈ 2.67</pre>`,
      how: R`<ul>
<li><b>SJF</b>：CPU 空時，從 Ready Queue 選 burst 最短的；一旦開始就跑完（非搶佔）。</li>
<li><b>SRTF（Shortest Remaining Time First）</b>：每當有新 process 到達，比較「新來的 burst」和「正在跑的剩餘時間」，短的贏。</li>
<li><b>Burst 怎麼預估</b>：用過去的 CPU burst 做指數平均：$\tau_{n+1} = \alpha t_n + (1-\alpha)\tau_n$。$t_n$ 是最近一次實際 burst，$\tau_n$ 是上次的預測，$\alpha$ 通常 0.5。</li>
<li><b>Starvation</b>：如果短工作源源不絕，長工作可能永遠排不到。</li>
</ul>`,
      sim: 'schedSim', simOpts: { algo: 'SRTF', procs: [{ id: 'P1', arrival: 0, burst: 8 }, { id: 'P2', arrival: 1, burst: 4 }, { id: 'P3', arrival: 2, burst: 2 }], title: 'SJF / SRTF Simulator', desc: '預設是 SRTF。逐步看 t=1、t=2 發生的搶佔；再切到 SJF 比較。' },
      definition: R`<ul><li><b>SJF</b>：選擇下一個 CPU burst 最短的 process；非搶佔。對平均等待時間最佳，但需要知道（預估）burst。</li><li><b>SRTF / Preemptive SJF</b>：新 process 到達時若其 burst 小於目前 process 的剩餘時間則搶佔。</li><li>Tie-break（本站規則）：burst 相同時先到者優先。</li></ul>`,
      checkpoint: [
        { id: 'ch3-s-1', type: 'calc', q: 'SJF（非搶佔），P1(0, 6)、P2(0, 8)、P3(0, 7)、P4(0, 3) 同時到達。求平均 Waiting Time。', fields: [{ label: '平均 Waiting', answer: 7 }], hint: '順序 P4 → P1 → P3 → P2。', explanation: 'Gantt：P4 0–3、P1 3–9、P3 9–16、P2 16–24。Waiting = 3、16、9、0，平均 28/4 = 7。' },
        { id: 'ch3-s-2', type: 'calc', q: 'SRTF，P1(0, 8)、P2(1, 4)、P3(2, 9)、P4(3, 5)。求平均 Waiting Time。', fields: [{ label: '平均 Waiting', answer: 6.5 }], hint: 'Gantt：P1 0–1、P2 1–5、P4 5–10、P1 10–17、P3 17–26。', explanation: 'Waiting：P1 = 17−0−8 = 9，P2 = 5−1−4 = 0，P3 = 26−2−9 = 15，P4 = 10−3−5 = 2。平均 26/4 = 6.5。' },
        { id: 'ch3-s-3', type: 'concept', q: 'SJF 在實務上最大的困難是？', options: ['實作太複雜', '無法事先知道 process 的 CPU burst 長度，只能預估', '會產生 convoy effect', '不能用在單核'], answer: 1, explanation: '常用指數平均預估過去的 burst；預估不準時 SJF 的最佳性就不成立。' },
        { id: 'ch3-s-4', type: 'trace', q: 'SRTF：P1 正在跑，剩餘 5。P2 到達，burst 5。會發生什麼？', options: ['P2 搶佔 P1', 'P1 繼續跑（相等時不換人，避免無謂的 context switch）', 'P1 和 P2 各跑一半', '兩個都停下來'], answer: 1, explanation: '搶佔需要「嚴格更短」。相等時換人只會多一次 context switch 而沒有好處。' }
      ]
    },
    {
      id: 'preemption',
      title: 'Preemptive vs Non-preemptive',
      en: 'Non-preemptive: a process keeps the CPU until it blocks or finishes. Preemptive: the OS can take the CPU away (timer, higher priority, shorter job).',
      why: R`<p>SJF 和 SRTF 用同一個原則（短的先），結果卻不同——差別只在<b>能不能中途把 CPU 拿走</b>。這個「能不能拿走」是排程裡最根本的分水嶺，決定了 response time、實作複雜度，甚至會不會有 race condition。</p>`,
      scenario: R`<p>同一組 P1(0, 8)、P2(1, 4)、P3(2, 2)，並排看 SJF 與 SRTF。關鍵時刻是 t=1：P2 到了、比 P1 剩下的短。<b>非搶佔</b>說「P1 已經拿到了，讓它跑完」；<b>搶佔</b>說「現在有更好的選擇，換」。</p>`,
      how: R`<p>排程決策發生在四個時機：</p>
<ol>
<li>Running → Waiting（process 自己去等 I/O）</li>
<li>Running → Ready（timer interrupt、被搶佔）</li>
<li>Waiting → Ready（I/O 完成）</li>
<li>Terminated</li>
</ol>
<p>只在 1 和 4 做決策 = <b>非搶佔式</b>（process 自願放棄才換人）。也在 2、3 做決策 = <b>搶佔式</b>。</p>
<p>搶佔的代價：更多 context switch；kernel 資料結構可能在更新到一半時被打斷（所以 kernel 內部也需要同步——Ch4）；需要 timer 硬體。搶佔的好處：response time 好、不會被一個無窮迴圈卡死、能照優先權即時反應。</p>`,
      sim: 'preemptCompare',
      definition: R`<table class="vs-table"><tr><th></th><th>Non-preemptive</th><th>Preemptive</th></tr>
<tr><td>CPU 何時換人</td><td>process 結束或自願等待</td><td>此外還有 timer 到期、更高優先／更短工作到達</td></tr>
<tr><td>演算法</td><td>FCFS、SJF、非搶佔 Priority</td><td>SRTF、RR、搶佔 Priority</td></tr>
<tr><td>Response time</td><td>差（長工作擋住所有人）</td><td>好</td></tr>
<tr><td>Overhead</td><td>低</td><td>context switch 多</td></tr>
<tr><td>共享資料風險</td><td>低</td><td>需要同步機制</td></tr></table>`,
      checkpoint: [
        { id: 'ch3-p-1', type: 'concept', q: '「搶佔（preemption）」的意思是？', options: ['process 自願放棄 CPU', 'OS 在 process 未完成、也未自願等待的情況下把 CPU 收回給別人', '兩個 process 同時使用 CPU', 'process 優先權被降低'], answer: 1, explanation: '關鍵是「非自願」：process 還能跑、還想跑，但 CPU 被拿走了。' },
        { id: 'ch3-p-2', type: 'concept', q: '下列哪個排程決策時機只會出現在搶佔式排程？', options: ['process 呼叫 read() 進入 Waiting', 'process 呼叫 exit()', 'timer interrupt 到期使 Running 變 Ready', 'process 正常結束'], answer: 2, explanation: '前兩者是 process 自願放棄；timer 強制收回 CPU 是搶佔的特徵。' },
        { id: 'ch3-p-3', type: 'scenario', q: '一個互動式桌面系統，使用者希望點擊後立刻有反應。應該選？', options: ['非搶佔式 FCFS', '搶佔式（例如 RR 或搶佔 Priority）', '非搶佔式 SJF', '不需要排程'], answer: 1, explanation: '互動系統最在意 response time，需要能中斷長工作讓新輸入被處理。' }
      ]
    },
    {
      id: 'rr',
      title: 'Round Robin（RR）',
      en: 'RR gives each process a fixed time quantum in FIFO order. Great response time; quantum too small wastes time on context switches, too large degenerates to FCFS.',
      why: R`<p>互動系統要的是「每個人都很快得到一點點服務」——不是誰先誰後、也不是誰短誰先，而是<b>輪流</b>。給每個 process 一小段時間（quantum），時間到就換下一個，排到隊尾。</p>`,
      scenario: R`<p>P1(24)、P2(3)、P3(3) 同時到達，quantum = 4：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">0     4    7    10                              30
| P1  | P2 | P3 |            P1                  |
平均 Waiting = (6 + 4 + 7)/3 ≈ 5.67（FCFS 是 17）</pre>
<p>P2、P3 只等了 4 和 7 就跑完了。P1 雖然拖到 30，但它本來就要 24。</p>`,
      how: R`<ul>
<li>Ready Queue 是 FIFO。取隊首，設 timer = quantum。</li>
<li>process 在 quantum 內結束 → 直接換下一個。</li>
<li>quantum 用完還沒結束 → timer interrupt → 放回隊尾 → 換下一個。</li>
<li>新到達的 process 加在隊尾。本站規則：quantum 用完的同一時刻有新 process 到達，<b>新到達者先入隊</b>，被換下的排它後面。</li>
</ul>
<p><b>Quantum 怎麼選</b>：太小（例如 1 ms）→ context switch overhead 占比太高；太大（例如 1 s）→ 退化成 FCFS。經驗法則：讓 80% 的 CPU burst 短於 quantum，常見 10–100 ms。Context switch 約 1–10 μs，所以 quantum 要遠大於它。</p>`,
      sim: 'schedSim', simOpts: { algo: 'RR', quantum: 4, procs: [{ id: 'P1', arrival: 0, burst: 24 }, { id: 'P2', arrival: 0, burst: 3 }, { id: 'P3', arrival: 0, burst: 3 }], title: 'Round Robin：改 quantum 看差別', desc: '把 quantum 改成 1、4、30，觀察 Gantt、平均 Waiting 與 context switch 次數。' },
      definition: R`<ul><li><b>Round Robin</b>：FCFS + 搶佔（時間片）。每個 process 一次最多執行一個 <b>time quantum</b>（time slice）。</li><li>n 個 process、quantum q：每個 process 最多等 (n−1)q 就能再拿到 CPU → 沒有 starvation。</li><li>平均 turnaround 通常比 SJF 差，但 response time 好。</li></ul>`,
      checkpoint: [
        { id: 'ch3-rr-1', type: 'calc', q: 'RR，quantum = 2。P1(0, 8)、P2(1, 4)、P3(2, 2)。求平均 Waiting Time（兩位小數）。', fields: [{ label: '平均 Waiting', answer: 4.33, tol: 0.02 }], hint: 'Gantt：P1 0–2、P2 2–4、P3 4–6、P1 6–8、P2 8–10、P1 10–14。', explanation: 'Waiting：P1 = 14−0−8 = 6，P2 = 10−1−4 = 5，P3 = 6−2−2 = 2。平均 13/3 ≈ 4.33。' },
        { id: 'ch3-rr-2', type: 'calc', q: 'RR，quantum = 4。P1(0, 24)、P2(0, 3)、P3(0, 3)。求 P1 的 Turnaround 與平均 Turnaround（兩位小數）。', fields: [{ label: 'P1 Turnaround', answer: 30 }, { label: '平均 Turnaround', answer: 15.67, tol: 0.02 }], explanation: 'Completion：P1 = 30、P2 = 7、P3 = 10。平均 = 47/3 ≈ 15.67。' },
        { id: 'ch3-rr-3', type: 'concept', q: 'RR 的 quantum 設得非常大（大於所有 burst）會變成？', options: ['SJF', 'FCFS', 'Priority', 'SRTF'], answer: 1, explanation: '沒有人會被 timer 打斷，就是依到達順序跑完——FCFS。' },
        { id: 'ch3-rr-4', type: 'scenario', q: 'quantum 設成 1 μs、context switch 也要 1 μs。會怎樣？', options: ['response time 極佳，沒有缺點', '約一半的 CPU 時間花在 context switch 上，效率極差', 'process 會 starvation', '和 quantum = 10 ms 沒差別'], answer: 1, explanation: '每跑 1 μs 就切換 1 μs，有用工作只剩 50%。quantum 必須遠大於 switch 成本。' }
      ]
    },
    {
      id: 'priority',
      title: 'Priority Scheduling',
      en: 'Each process has a priority; the CPU goes to the highest. SJF is priority scheduling with priority = predicted burst. Risk: starvation, fixed by aging.',
      why: R`<p>有些 process 就是比較重要：系統程式、即時的音訊、使用者正在互動的視窗。RR 一視同仁，SJF 只看長度。需要一個能表達「重要性」的機制。</p>`,
      scenario: R`<p>P1(10, 優先權 3)、P2(1, 1)、P3(2, 4)、P4(1, 5)、P5(5, 2)，同時到達，數字小 = 優先權高：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">0    1      6           16    18   19
| P2 |  P5  |     P1     | P3  | P4 |     平均 Waiting = (6+0+16+18+1)/5 = 8.2</pre>
<p>P4 優先權最低，等了 18。如果一直有優先權比它高的 process 進來，它<b>永遠</b>跑不到——這叫 <b>starvation（indefinite blocking）</b>。傳說 1973 年 MIT 的一台 IBM 7094 被關機時，發現一個 1967 年提交的低優先權 job 還在等。</p>`,
      how: R`<ul>
<li>每個 process 一個優先權數字（內部：時間限制、記憶體需求、I/O 比例；外部：使用者、部門、付費等級）。</li>
<li>Ready Queue 依優先權排序（或多個 queue）。</li>
<li>非搶佔版：CPU 空時挑最高優先。搶佔版：更高優先的 process 到達就搶。</li>
<li><b>Aging</b>：等越久，優先權慢慢提高。例如每 15 分鐘升一級，最低的也終究會升到頂——解決 starvation。</li>
</ul>
<p>SJF 其實就是 priority scheduling，優先權 = 預測的 burst（越短越高）。</p>`,
      sim: 'schedSim', simOpts: { algo: 'PRIO', procs: [{ id: 'P1', arrival: 0, burst: 10, priority: 3 }, { id: 'P2', arrival: 0, burst: 1, priority: 1 }, { id: 'P3', arrival: 0, burst: 2, priority: 4 }, { id: 'P4', arrival: 0, burst: 1, priority: 5 }, { id: 'P5', arrival: 0, burst: 5, priority: 2 }], title: 'Priority Scheduling：切換非搶佔 / 搶佔', desc: '試試把某個 process 的到達時間改成 3、優先權改成 0，看搶佔版（Priority (P)）與非搶佔版的差別。' },
      definition: R`<ul><li><b>Priority scheduling</b>：依優先權分配 CPU；相同優先權用 FCFS。可搶佔或非搶佔。</li><li><b>Starvation</b>：低優先權 process 可能無限期得不到 CPU。</li><li><b>Aging</b>：隨等待時間逐步提升優先權，保證最終會被排程。</li><li><b>Multilevel queue</b>：不同類型的 process 放不同 queue（前景互動用 RR、背景批次用 FCFS），queue 之間有固定優先或時間比例。<b>Multilevel feedback queue</b> 允許 process 在 queue 之間移動（用太多 CPU 就降級）——是最通用、也最複雜的做法，Linux CFS、Windows 都是這類思想的變體。</li></ul>`,
      checkpoint: [
        { id: 'ch3-pr-1', type: 'calc', q: '非搶佔 Priority（小 = 高），同時到達：P1(10, 3)、P2(1, 1)、P3(2, 4)、P4(1, 5)、P5(5, 2)。求平均 Waiting Time。', fields: [{ label: '平均 Waiting', answer: 8.2 }], hint: '順序 P2 → P5 → P1 → P3 → P4。', explanation: 'Waiting：P2 = 0、P5 = 1、P1 = 6、P3 = 16、P4 = 18。平均 41/5 = 8.2。' },
        { id: 'ch3-pr-2', type: 'concept', q: 'Aging 解決什麼問題？怎麼做？', options: ['解決 convoy effect；縮短 quantum', '解決 starvation；隨等待時間提高優先權', '解決 deadlock；降低優先權', '解決 thrashing；減少 process 數'], answer: 1, explanation: '低優先權 process 等得越久優先權越高，最終一定會被排到。' },
        { id: 'ch3-pr-3', type: 'trace', q: '搶佔式 Priority。P1（優先權 3）正在跑。P2（優先權 1）到達。接下來？', options: ['P1 跑完再換 P2', 'P2 立刻搶佔，P1 回 Ready Queue', 'P1 和 P2 輪流', 'P2 被丟棄'], answer: 1, explanation: '搶佔式：更高優先權（數字更小）到達就搶。非搶佔式才會等 P1 跑完。' },
        { id: 'ch3-pr-4', type: 'concept', q: 'SJF 可以視為哪種排程的特例？', options: ['RR，quantum = burst', 'Priority scheduling，優先權 = 預測的 burst 長度', 'FCFS 反過來', 'Multilevel queue'], answer: 1, explanation: 'burst 越短優先權越高，就是 SJF。' }
      ]
    }
  ]
});
})();
