/* Chapter 6：Deadlock */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch6', num: 6, title: 'Deadlock', topic: 'deadlock',
  subtitle: '四個必要條件、Resource Allocation Graph、Prevention / Avoidance / Detection、Banker\'s Algorithm。',
  why: R`<p>Ch5 的哲學家全部卡死，每個人都沒做錯任何事。這種「大家互相等、永遠等不到」的狀況叫 deadlock。這章回答：它<b>什麼時候</b>會發生（四個條件）、怎麼<b>看出來</b>（RAG）、以及 OS 有哪幾種態度（預防、避免、偵測、視而不見）。</p>`,
  concepts: [
    {
      id: 'deadlock-intro',
      title: 'Deadlock 與四個必要條件',
      en: 'Deadlock: a set of processes each waiting for a resource held by another in the set. It requires mutual exclusion, hold-and-wait, no preemption, and circular wait — all four.',
      why: R`<p>Process A 拿著 Resource 1、等 Resource 2。Process B 拿著 Resource 2、等 Resource 1。誰都走不了。這個情況要成立，需要哪些「前提」？找出前提，就知道打破哪一個能讓它不發生。</p>`,
      scenario: R`<p>單線道的橋，兩台車從兩端同時開上來，在中間對峙。</p><ul><li>橋一次只能一台車過（<b>Mutual Exclusion</b>）。</li><li>兩台車都已經在橋上、等對方退（<b>Hold and Wait</b>）。</li><li>沒有拖吊車會把其中一台強制拖走（<b>No Preemption</b>）。</li><li>A 等 B 退，B 等 A 退（<b>Circular Wait</b>）。</li></ul><p>四個條件<b>同時</b>成立才會卡住。任何一個不成立（例如有拖吊車），就解開了。</p>`,
      how: R`<p>程式裡最常見的 deadlock 就是<b>兩把鎖、不同順序</b>：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">Thread A            Thread B
lock(m1);           lock(m2);
lock(m2);  ← 等 B   lock(m1);  ← 等 A</pre>
<p>用下面的動畫看四個條件如何一步一步成立。</p>`,
      sim: 'deadlockIntro',
      definition: R`<ul>
<li><b>Deadlock（死結）</b>：一組 process 中的每一個都在等待只有該組中其他 process 才能引發的事件（通常是釋放資源）。</li>
<li><b>四個必要條件</b>（必須同時成立；Coffman conditions）：<ol><li><b>Mutual exclusion</b>：至少有一個資源是非共享的，一次只能一個 process 用。</li><li><b>Hold and wait</b>：process 持有至少一個資源，同時在等待其他被佔用的資源。</li><li><b>No preemption</b>：資源不能被強制收回，只能由持有者自願釋放。</li><li><b>Circular wait</b>：存在一組 {P<sub>0</sub>, …, P<sub>n</sub>}，P<sub>0</sub> 等 P<sub>1</sub> 的資源，…，P<sub>n</sub> 等 P<sub>0</sub> 的資源。</li></ol></li>
<li>「必要」的意思：deadlock ⇒ 四條件成立；但四條件成立不一定 deadlock（例如資源有多個實例時）。</li>
</ul>`,
      code: { title: 'deadlock.cpp — 最常見的寫法錯誤', src: `std::mutex m1, m2;

void threadA() {
    std::lock_guard<std::mutex> a(m1);
    std::lock_guard<std::mutex> b(m2);   // 若 B 已持有 m2 → 等
}
void threadB() {
    std::lock_guard<std::mutex> b(m2);
    std::lock_guard<std::mutex> a(m1);   // 若 A 已持有 m1 → 等 → deadlock
}
// 修法 1：兩邊都用同樣順序（先 m1 再 m2）→ 破壞 circular wait
// 修法 2：std::scoped_lock lk(m1, m2);  → 一次拿兩把，拿不到就都不拿（破壞 hold and wait）` },
      checkpoint: [
        { id: 'ch6-dl-1', type: 'code', q: '上面 threadA / threadB 的程式，一定會 deadlock 嗎？', options: ['一定會', '不一定：只有在 A 拿到 m1 後、拿 m2 前，B 剛好拿到 m2 的交錯下才會', '永遠不會', '只在單核會'], answer: 1, explanation: '若 A 一口氣拿到兩把鎖再換 B 跑，就沒事。Deadlock 也是時序相依的——所以很難重現。' },
        { id: 'ch6-dl-2', type: 'concept', q: '下列哪一項<b>不是</b> deadlock 的必要條件？', options: ['Mutual Exclusion', 'Hold and Wait', 'Starvation', 'Circular Wait'], answer: 2, explanation: 'Starvation 是「一直排不到」，process 仍有機會前進；deadlock 是「永遠不可能前進」。兩者不同。' },
        { id: 'ch6-dl-3', type: 'scenario', q: '系統規定「任何 process 一次只能持有一個資源」。這打破了哪個條件？', options: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'Circular Wait'], answer: 1, explanation: '不可能「拿著一個等另一個」。代價是資源利用率低、可能 starvation。' },
        { id: 'ch6-dl-4', type: 'concept', q: 'Deadlock 與 Starvation 的差別是？', options: ['沒有差別', 'Deadlock 中的 process 永遠無法前進（互相等待）；Starvation 是 process 一直沒被選到，但理論上仍可能前進', 'Starvation 比較嚴重', 'Deadlock 只發生在單核'], answer: 1, explanation: 'Aging 能解 starvation；deadlock 需要打破必要條件或外力介入。' }
      ]
    },
    {
      id: 'rag',
      title: 'Resource Allocation Graph（RAG）',
      en: 'Processes are circles, resources are squares. Request edge P→R, assignment edge R→P. A cycle is necessary for deadlock; with single-instance resources it is sufficient.',
      why: R`<p>四個條件裡，前三個是系統的性質（資源本來就互斥、本來就不能搶），只有 <b>circular wait</b> 是「當下的狀態」。要判斷現在有沒有 deadlock，就是要找環。把「誰拿著什麼、誰在等什麼」畫成圖，找環就變成圖論問題。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">   P1 ──request──▶ R2            ○ process
   ▲                │            □ resource（裡面的點 = 實例數）
 assign             assign      P → R：P 在等 R（request edge）
   │                ▼           R → P：R 已分配給 P（assignment edge）
   R1 ◀──request── P2

   P1 → R2 → P2 → R1 → P1：一個環</pre>`,
      how: R`<ul>
<li>process 請求資源：加一條 request edge P → R。</li><li>資源分配給它：request edge 反轉成 assignment edge R → P。</li><li>釋放：刪掉 assignment edge。</li>
</ul>
<p><b>判斷規則：</b></p>
<ul><li>圖中<b>沒有環</b> → 一定沒有 deadlock。</li><li>有環，且環上每個資源都只有<b>一個實例</b> → 一定 deadlock。</li><li>有環，但有資源有<b>多個實例</b> → 可能 deadlock，要進一步用「圖歸約」或偵測演算法檢查（看有沒有 process 的請求能被滿足、完成後釋放資源、讓其他人也能完成）。</li></ul>`,
      sim: 'ragSim',
      definition: R`<ul><li><b>RAG</b>：有向圖 G = (V, E)，V = P ∪ R。E 含 request edge (P<sub>i</sub> → R<sub>j</sub>) 與 assignment edge (R<sub>j</sub> → P<sub>i</sub>)。</li><li>環是 deadlock 的<b>必要</b>條件；單實例資源時亦為<b>充分</b>條件。</li><li>多實例時用 <b>deadlock detection algorithm</b>（與 Banker's 安全性檢查類似，但用 Request 矩陣取代 Need）。</li></ul>`,
      checkpoint: [
        { id: 'ch6-rag-1', type: 'scenario', q: 'RAG 中 R1 → P1、P1 → R2、R2 → P2、P2 → R1，R1 與 R2 都只有一個實例。是否 deadlock？', options: ['否', '是：有環且皆為單實例', '不確定', '只有 P1 deadlock'], answer: 1, explanation: '單實例 + 環 = deadlock（充分條件）。' },
        { id: 'ch6-rag-2', type: 'scenario', q: '同上的環，但 R1 有兩個實例，第二個實例分配給了 P3，且 P3 沒有在等任何資源。是否 deadlock？', options: ['是', '否：P3 會完成並釋放 R1，P2 可取得 R1 完成，接著 P1 也能完成', '不確定', 'P3 也會 deadlock'], answer: 1, explanation: '多實例時環只是必要條件；圖歸約可以把所有 process 都消掉，所以沒有 deadlock。' },
        { id: 'ch6-rag-3', type: 'concept', q: 'RAG 中「P3 → R1」這條邊代表？', options: ['R1 已分配給 P3', 'P3 正在請求（等待）R1', 'P3 釋放了 R1', 'P3 擁有 R1 的所有實例'], answer: 1, explanation: 'process 指向資源 = 請求；資源指向 process = 已分配。' }
      ]
    },
    {
      id: 'handling',
      title: 'Deadlock 的處理策略：Prevention / Avoidance / Detection / Recovery',
      en: 'Prevention breaks one of the four conditions by design. Avoidance uses extra information (max needs) to stay in safe states. Detection lets it happen and recovers. Ignoring it is what most OSes do.',
      why: R`<p>知道 deadlock 怎麼發生後，OS 有四種態度，從「絕不讓它發生」到「發生了再說」到「當它不存在」。每種的代價不同，理解取捨比背名詞重要。</p>`,
      scenario: R`<table class="vs-table"><tr><th>策略</th><th>做法</th><th>比喻</th><th>代價</th></tr>
<tr><td>Prevention</td><td>在設計上讓四個條件之一永遠不成立</td><td>單行道規則：永遠不會對撞</td><td>資源利用率低、限制多</td></tr>
<tr><td>Avoidance</td><td>事先知道每個 process 的最大需求，每次分配前檢查是否仍「安全」</td><td>銀行審核貸款：確保任何情況下都能還得出來</td><td>需要事先宣告、每次分配都要算</td></tr>
<tr><td>Detection & Recovery</td><td>放任，定期跑演算法找 deadlock，找到就殺 process 或搶資源</td><td>塞車了叫拖吊車</td><td>偵測有成本、恢復會損失工作</td></tr>
<tr><td>Ignore（鴕鳥）</td><td>假設它很少發生，發生了讓使用者重開</td><td>—</td><td>Linux、Windows 對一般 process 的做法</td></tr></table>`,
      how: R`<p><b>Prevention 逐條打破：</b></p>
<ul>
<li><b>Mutual exclusion</b>：無法打破（有些資源天生不可共享）。</li>
<li><b>Hold and wait</b>：要求 process 一開始就申請所有需要的資源；或申請新資源前先釋放手上全部。→ 利用率低、starvation。</li>
<li><b>No preemption</b>：拿不到新資源時，強制釋放手上的（適用於狀態可保存還原的資源，如 CPU、記憶體；不適用印表機）。</li>
<li><b>Circular wait</b>：給所有資源編號，規定<b>只能依遞增順序申請</b>。這是實務上最常用的：例如 kernel 規定 lock 的取得順序。</li>
</ul>
<p><b>Avoidance</b>：每個 process 事先宣告最大需求。系統維持在 <b>safe state</b>——存在一個順序讓所有 process 都能拿到最大需求並完成。單實例資源用 RAG 加「claim edge」；多實例用 Banker's algorithm（下一節）。</p>
<p><b>Recovery</b>：終止 process（全部或一次一個，選代價最小的），或搶佔資源（要處理 rollback 與 starvation）。</p>`,
      definition: R`<ul><li><b>Safe state</b>：存在一個 safe sequence &lt;P<sub>1</sub>,…,P<sub>n</sub>&gt;，使每個 P<sub>i</sub> 的需求都能由「目前可用資源 + 前面所有 P<sub>j</sub> 持有的資源」滿足。</li><li>Safe ⇒ 沒有 deadlock；Unsafe ⇒ <b>可能</b> deadlock（不是一定）。Avoidance 的原則：絕不進入 unsafe state。</li></ul>`,
      checkpoint: [
        { id: 'ch6-h-1', type: 'concept', q: '「所有 lock 必須依固定編號順序取得」屬於哪種策略、打破哪個條件？', options: ['Avoidance；Hold and Wait', 'Prevention；Circular Wait', 'Detection；No Preemption', 'Prevention；Mutual Exclusion'], answer: 1, explanation: '順序申請使環不可能形成。這是實務上最常見的 prevention 手段。' },
        { id: 'ch6-h-2', type: 'concept', q: 'Unsafe state 代表？', options: ['已經 deadlock', '一定會 deadlock', '系統無法保證不會 deadlock（存在一種請求順序導致 deadlock）', '沒有 deadlock'], answer: 2, explanation: 'Unsafe 只是失去保證；process 可能不會真的要到最大需求。Avoidance 的目標是永遠不進 unsafe。' },
        { id: 'ch6-h-3', type: 'scenario', q: '一般桌面作業系統（Linux、Windows）對使用者程式的 deadlock 採取什麼態度？', options: ['Banker\'s algorithm', 'Prevention', '忽略：假設罕見，由使用者或程式自行處理', '每秒偵測一次'], answer: 2, explanation: '避免與偵測的成本太高；一般 OS 把責任留給應用程式（例如用 lock ordering）。' },
        { id: 'ch6-h-4', type: 'concept', q: 'Prevention 與 Avoidance 的差別？', options: ['沒有差別', 'Prevention 靠設計規則讓某條件永遠不成立；Avoidance 靠額外資訊（最大需求）動態判斷每次分配是否安全', 'Avoidance 比較簡單', 'Prevention 需要知道最大需求'], answer: 1, explanation: 'Prevention 是靜態限制、avoidance 是動態決策。' }
      ]
    },
    {
      id: 'banker',
      title: "Banker's Algorithm",
      en: "Given Available, Max, and Allocation, compute Need = Max − Allocation. A state is safe if some order lets every process finish. Grant a request only if the resulting state is safe.",
      why: R`<p>Avoidance 需要一個可執行的「安全檢查」。銀行家演算法的比喻：銀行有一定現金（Available），每個客戶事先說最多會借多少（Max），目前已借多少（Allocation）。銀行要確保：不管客戶怎麼借，總能找到一個順序讓所有人借到上限、還錢、下一個人再借——絕不會出現「大家都借了一半、都還差一點、銀行沒錢了」。</p>`,
      scenario: R`<p>先搞懂四張表的關係，再看演算法：</p>
<ul><li><b>Available[j]</b>：資源 j 目前還剩幾個。</li><li><b>Max[i][j]</b>：process i 最多會要幾個資源 j（事先宣告）。</li><li><b>Allocation[i][j]</b>：process i 現在拿著幾個。</li><li><b>Need[i][j] = Max[i][j] − Allocation[i][j]</b>：還會再要幾個。這張表不用輸入，算出來的。</li></ul>
<p>核心問題只有一個：「<b>用現在剩的（Available），能不能滿足某個 process 剩下的需求（Need）？</b>」能的話它就能跑完、把 Allocation 全部還回來，Available 變大，再看下一個。</p>`,
      how: R`<p><b>安全性演算法：</b></p>
<ol><li>Work = Available；Finish[i] = false。</li><li>找一個 i：Finish[i] = false 且 Need[i] ≤ Work（每個資源都 ≤）。找不到 → 跳到 4。</li><li>Work = Work + Allocation[i]；Finish[i] = true；回到 2。</li><li>全部 Finish = true → safe，找到的順序就是 safe sequence；否則 unsafe。</li></ol>
<p><b>資源請求演算法（P<sub>i</sub> 請求 Request）：</b></p>
<ol><li>Request ≤ Need[i]？否 → 錯誤（超過宣告）。</li><li>Request ≤ Available？否 → P<sub>i</sub> 等待。</li><li><b>假裝</b>分配：Available −= Request，Allocation[i] += Request，Need[i] −= Request。</li><li>跑安全性演算法。Safe → 真的分配；Unsafe → 還原，P<sub>i</sub> 等待。</li></ol>`,
      sim: 'bankerSim',
      definition: R`<p>教科書例子（5 個 process、資源 A/B/C 共 10/5/7）：</p>
<table class="data mono"><tr><th></th><th>Allocation</th><th>Max</th><th>Need</th></tr><tr><td>P0</td><td>0 1 0</td><td>7 5 3</td><td>7 4 3</td></tr><tr><td>P1</td><td>2 0 0</td><td>3 2 2</td><td>1 2 2</td></tr><tr><td>P2</td><td>3 0 2</td><td>9 0 2</td><td>6 0 0</td></tr><tr><td>P3</td><td>2 1 1</td><td>2 2 2</td><td>0 1 1</td></tr><tr><td>P4</td><td>0 0 2</td><td>4 3 3</td><td>4 3 1</td></tr></table>
<p>Available = 3 3 2。Safe sequence：P1 → P3 → P4 → P0 → P2（Work：3 3 2 → 5 3 2 → 7 4 3 → 7 4 5 → 7 5 5 → 10 5 7）。</p>
<p>P1 請求 (1, 0, 2)：≤ Need、≤ Available，假裝分配後 Available = 2 3 0，仍 safe → 核准。之後 P4 請求 (3, 3, 0) → 超過 Available → 等。P0 請求 (0, 2, 0) → 假裝分配後 unsafe → 拒絕。</p>`,
      checkpoint: [
        { id: 'ch6-bk-1', type: 'calc', q: 'Max = (7, 5, 3)，Allocation = (0, 1, 0)。Need 的三個值？', fields: [{ label: 'Need A', answer: 7 }, { label: 'Need B', answer: 4 }, { label: 'Need C', answer: 3 }], explanation: 'Need = Max − Allocation，逐項相減。' },
        { id: 'ch6-bk-2', type: 'trace', q: '教科書例子，Available = (3, 3, 2)。安全性演算法第一輪掃描（從 P0 開始），第一個可以完成的 process 是？', options: ['P0（Need 7 4 3）', 'P1（Need 1 2 2）', 'P2（Need 6 0 0）', 'P3（Need 0 1 1）'], answer: 1, hint: '逐項比較 Need ≤ Work。', explanation: 'P0 的 Need 7 > 3 不行；P1 的 1 2 2 ≤ 3 3 2 可以。' },
        { id: 'ch6-bk-3', type: 'calc', q: '接上題，P1 完成後 Work 變成多少？（P1 的 Allocation = 2 0 0）', fields: [{ label: 'Work A', answer: 5 }, { label: 'Work B', answer: 3 }, { label: 'Work C', answer: 2 }], explanation: 'Work = Available + Allocation[P1] = (3+2, 3+0, 2+0)。' },
        { id: 'ch6-bk-4', type: 'scenario', q: 'P4 請求 (3, 3, 0)，Available = (2, 3, 0)，Need[P4] = (4, 3, 1)。結果？', options: ['核准', '錯誤：超過 Need', '等待：超過 Available（A 需要 3 但只剩 2）', '需要跑安全性演算法才知道'], answer: 2, explanation: 'Request ≤ Need 通過，但 Request ≤ Available 不通過，直接等待，不需要安全性檢查。' },
        { id: 'ch6-bk-5', type: 'concept', q: "Banker's algorithm 在實務上很少直接使用的主要原因？", options: ['它是錯的', '需要 process 事先宣告最大資源需求，且 process 數與資源種類固定——一般系統做不到', '只能處理兩個 process', '需要特殊硬體'], answer: 1, explanation: '複雜度 O(m·n²) 不是主因；主因是「事先知道最大需求」的假設在動態系統中不成立。' }
      ]
    }
  ]
});
})();
