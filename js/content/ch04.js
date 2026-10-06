/* Chapter 4：Concurrency — Race Condition、Critical Section、Mutex、Peterson */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch4', num: 4, title: 'Concurrency 與 Race Condition', topic: 'sync',
  subtitle: '兩個 thread 各做一次 counter++，最後一定是 2 嗎？',
  why: R`<p>Ch2 說 thread 共享記憶體、Ch3 說 OS 隨時可能把 CPU 切走。把這兩件事放在一起：<b>兩個 thread 改同一個變數，中間隨時可能被切換</b>——會發生什麼？這章不先給定義，先讓你親手排出一個出錯的順序，看到結果不對，再告訴你它叫什麼、怎麼解。</p>`,
  concepts: [
    {
      id: 'race-condition',
      title: '競爭條件（Race Condition）',
      en: 'A race condition: the result depends on the timing of interleaved accesses to shared data. counter++ is three instructions, and a switch between them loses an update.',
      why: R`<p><code>counter = 0</code>。Thread A 執行 <code>counter++</code>，Thread B 也執行 <code>counter++</code>。最後一定是 2 嗎？</p><p>先別看答案。想一下 <code>counter++</code> 在 CPU 上到底是幾條指令。</p>`,
      scenario: R`<p><code>counter++</code> 在 C 裡是一行，但 CPU 沒有「把記憶體裡的數加一」的單一指令（就算有，多核之下也未必原子）。它其實是：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">LOAD  reg, counter    ; 把記憶體的值讀進暫存器
ADD   reg, 1          ; 暫存器加一
STORE counter, reg    ; 寫回記憶體</pre>
<p>三條指令之間，timer interrupt 隨時可能來。如果 A 剛 LOAD 到 0 就被切走，B 也 LOAD 到 0、加一、寫回 1，然後 A 醒來，用它手上<b>過期的</b> 0 加一，寫回 1——B 的那次加一就消失了。</p>`,
      how: R`<p>用下面的模擬<b>自己排順序</b>。先按「A 全部跑完再 B」，結果是 2。再按「交錯」，結果是 1。同一段程式碼，只因為切換時機不同，答案就不同——而且在真實系統裡，這種錯誤可能一萬次才出現一次，極難重現。</p>`,
      sim: 'raceCondition',
      definition: R`<ul>
<li><b>Race condition（競爭條件）</b>：多個 process / thread 同時存取並修改共享資料，最終結果取決於存取的交錯順序。</li>
<li><b>根本原因</b>：一段「應該不可分割」的操作（read-modify-write）在中途被打斷，而另一方在這期間也動了同一份資料。</li>
<li><b>不是只有 counter++</b>：linked list 的插入、bank account 的轉帳、Ch5 的 bounded buffer——任何「讀出來、算一算、寫回去」的動作都有同樣問題。</li>
<li>解法的核心思想：讓那段操作變成<b>原子的（atomic）</b>——外人看來要嘛整段沒開始、要嘛整段做完。方法就是接下來的 critical section 與 lock。</li>
</ul>`,
      code: { title: 'race.cpp — 跑幾次，結果幾乎每次不同', src: `#include <thread>
#include <iostream>
int counter = 0;

void add() { for (int i = 0; i < 1000000; i++) counter++; }

int main() {
    std::thread a(add), b(add);
    a.join(); b.join();
    std::cout << counter << "\\n";   // 期望 2000000，實際常常是 1xxxxxx
}`, note: '編譯：<code>g++ -O0 -pthread race.cpp</code>。開最佳化時編譯器可能把整個迴圈變成一條加法，反而看不到問題——這本身也說明 race 有多難重現。' },
      checkpoint: [
        { id: 'ch4-rc-1', type: 'trace', q: 'counter = 5。順序：A LOAD、B LOAD、A ADD、A STORE、B ADD、B STORE。最後 counter 是？', options: ['5', '6', '7', '不確定'], answer: 1, hint: '兩邊 LOAD 到的都是 5。', explanation: 'A 寫回 6，B 用它讀到的 5 加一也寫回 6。少了一次。' },
        { id: 'ch4-rc-2', type: 'trace', q: 'counter = 0。A 做 counter++ 兩次，B 做 counter++ 一次，任意交錯。最後 counter 的<b>最小</b>可能值是？', options: ['0', '1', '2', '3'], answer: 1, hint: '最壞情況：每次寫回都蓋掉別人的。', explanation: '例如 A LOAD 0、B LOAD 0、A 完成兩次（counter=2）、B STORE 1。或更極端的交錯也是 1。永遠至少會有一次成功的 +1，所以最小是 1。' },
        { id: 'ch4-rc-3', type: 'concept', q: 'Race condition 難以除錯的主要原因是？', options: ['錯誤訊息太長', '結果取決於時序，同樣的程式碼可能大多數時候正確，只在特定交錯下出錯', '只在 Linux 上發生', '編譯器會隱藏它'], answer: 1, explanation: '「有時對有時錯」正是時序相依的特徵；加 print 還可能改變時序讓 bug 消失（Heisenbug）。' },
        { id: 'ch4-rc-4', type: 'code', q: '下列哪段程式碼<b>沒有</b> race condition（假設兩個 thread 同時執行）？', code: `// (A) shared_list.push_back(x);
// (B) local_var = local_var + 1;   // local_var 是函式內的區域變數
// (C) if (balance >= 100) balance -= 100;
// (D) ++shared_counter;`, options: ['(A)', '(B)', '(C)', '(D)'], answer: 1, explanation: '區域變數在各 thread 自己的 stack 上，不共享。其他三者都是對共享資料的 read-modify-write。' }
      ]
    },
    {
      id: 'critical-section',
      title: '臨界區間問題（Critical Section Problem）',
      en: 'A critical section is code that touches shared data. A correct solution must guarantee mutual exclusion, progress, and bounded waiting.',
      why: R`<p>Race condition 的解法方向：把「碰共享資料的那段程式碼」圈起來，規定<b>一次只能有一個人在裡面</b>。但「規定」要寫成程式，而且要正確——什麼叫正確？光是「一次一個」還不夠，還得保證不會大家都卡在門外、也不會有人永遠進不去。</p>`,
      scenario: R`<p>一間只有一個馬桶的廁所（共享資源）。三個條件用廁所來想：</p>
<ol>
<li><b>Mutual Exclusion（互斥）</b>：一次只能一個人在裡面。——廢話，但這是最基本的。</li>
<li><b>Progress（進展）</b>：如果廁所是空的，而有人想進去，<b>不能</b>因為某個「不想上廁所的人」的緣故而進不去。決定誰進去，只能由想進去的人參與。——沒人用時不能鎖著。</li>
<li><b>Bounded Waiting（有限等待）</b>：我在排隊時，不能有人一直插隊讓我等無限久。從我提出請求到我進去，其他人進去的次數要有上限。——不能永遠讓我等。</li>
</ol>`,
      how: R`<p>程式碼的結構：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">do {
    entry section      ← 申請進入（拿鎖、舉手……）
    critical section   ← 碰共享資料
    exit section       ← 宣告離開（還鎖）
    remainder section  ← 其他跟共享資料無關的事
} while (true);</pre>
<p>所有解法（Peterson、lock、semaphore）都是在設計 entry / exit section 的內容。評斷一個解法就看它是否同時滿足三個條件——只滿足 mutual exclusion 的解法很容易寫，例如「永遠不准任何人進去」，但它違反 progress。</p>
<p>Kernel 自己也有這個問題：kernel 資料結構（process 表、free list）在被更新到一半時若被 interrupt 打斷，就會壞掉。單核可以暫時關 interrupt（<b>non-preemptive kernel</b>）；多核關 interrupt 沒用（別的核心還在跑），必須用 lock（<b>preemptive kernel</b>）。</p>`,
      definition: R`<ul>
<li><b>Critical section（臨界區間）</b>：process 中存取共享資料（變數、檔案、資料結構）的程式碼區段。</li>
<li><b>Critical section problem</b>：設計一個協定，使 process 能協調對 critical section 的進入。</li>
<li><b>Mutual exclusion</b>：若 P<sub>i</sub> 在 critical section，其他 process 不得在其 critical section 中。</li>
<li><b>Progress</b>：若無人在 critical section 且有人想進入，則只有<b>不在 remainder section 的 process</b> 能參與決定誰進入，且此決定不能無限期延遲。</li>
<li><b>Bounded waiting</b>：從一個 process 提出進入請求到獲准之間，其他 process 進入 critical section 的次數有上限。</li>
</ul>`,
      checkpoint: [
        { id: 'ch4-cs-1', type: 'scenario', q: '一個解法：用一個變數 turn，P0 只能在 turn==0 時進入、離開後設 turn=1；P1 反之（嚴格輪流）。若 P1 根本不想進入，P0 進去一次後想再進去，會怎樣？違反哪個條件？', options: ['可以進去；沒有違反', '進不去，因為 turn==1 而 P1 不想進；違反 Progress', '進不去；違反 Mutual Exclusion', '進不去；違反 Bounded Waiting'], answer: 1, hint: '一個「不想進去的人」擋住了想進去的人。', explanation: '嚴格輪流讓不在 critical section 也不想進的 P1 影響了 P0 能否進入，違反 Progress。' },
        { id: 'ch4-cs-2', type: 'concept', q: 'Bounded Waiting 保證的是？', options: ['critical section 的執行時間有上限', '一個 process 在等待進入時，其他 process 進入的次數有上限（不會 starvation）', 'critical section 一次只能一個人', 'process 一定會在固定時間內完成'], answer: 1, explanation: '它防止「一直被插隊」，與 critical section 本身多長無關。' },
        { id: 'ch4-cs-3', type: 'concept', q: '為什麼多核系統的 kernel 不能只靠「關閉 interrupt」來保護 kernel 資料結構？', options: ['因為關 interrupt 是非法的', '因為關 interrupt 只影響目前這顆核心，其他核心仍可同時存取該資料', '因為 interrupt 太多關不完', '其實可以'], answer: 1, explanation: '單核關 interrupt 等於沒人能打斷你；多核時別的核心根本不受影響，需要真正的 lock。' }
      ]
    },
    {
      id: 'mutex',
      title: 'Mutex Lock',
      en: 'A mutex is a lock with two operations: acquire() before the critical section, release() after. It makes the protected code atomic from the outside.',
      why: R`<p>Critical section problem 需要 entry / exit section。最簡單的實作：一把鎖。進門拿鎖（拿不到就等），出門還鎖。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">沒有 Lock
Thread A ───┐
Thread B ───┴→ 同時進入 → Race Condition

有 Lock
Thread A → LOCK → Critical Section → UNLOCK
Thread B → WAIT ─────────────────→ LOCK → Critical Section → UNLOCK</pre>
<p><b>Lock 保護的到底是什麼？</b>不是「counter 這個變數」——記憶體不會因為你拿了鎖就變得不能寫。Lock 保護的是<b>一段程式碼</b>：約定所有人碰 counter 之前都要先拿同一把鎖。只要有一個人不守約定（不拿鎖就直接改），保護就失效。</p>`,
      how: R`<p>lock 本身也是共享變數（<code>available</code>）。<code>acquire()</code> 要做「檢查 available 是否為 true，若是就設成 false」——這又是 read-modify-write，本身會有 race！所以 lock 的實作必須靠硬體提供的<b>原子指令</b>（test_and_set、compare_and_swap），或在單核上關 interrupt。這是「用一個更小的原子操作，建構更大的原子區段」。</p>
<p>拿不到鎖的時候怎麼等？兩種：</p>
<ul>
<li><b>Spinlock（busy waiting）</b>：迴圈一直試。浪費 CPU，但不用 context switch——critical section 很短（幾十條指令）、多核時划算。</li>
<li><b>Blocking mutex</b>：拿不到就進 Waiting，讓出 CPU；unlock 時叫醒等待者。有 context switch 成本，但不浪費 CPU——critical section 較長時划算。</li>
</ul>`,
      sim: 'mutexSim',
      definition: R`<ul>
<li><b>Mutex lock</b>：一個布林變數 available 加上兩個原子操作：<code>acquire()</code>（等到 available 為 true 後設為 false）、<code>release()</code>（設回 true）。</li>
<li><b>擁有權</b>：只有拿到鎖的 thread 可以釋放它（這是 mutex 和 semaphore 的差別之一，Ch5）。</li>
<li><b>Busy waiting / spinlock</b>：等待時持續佔用 CPU 檢查。</li>
<li><b>常見錯誤</b>：忘記 unlock（其他人永遠進不去）、在 critical section 內 return 或 throw 導致沒 unlock、對同一把非遞迴 mutex lock 兩次（自己等自己 = deadlock）。</li>
</ul>`,
      code: { title: 'mutex.cpp — 修好 Ch4.1 的 race', src: `#include <mutex>
std::mutex m;
int counter = 0;

void add() {
    for (int i = 0; i < 1000000; i++) {
        m.lock();        // entry section：拿不到就等
        counter++;       // critical section：LOAD/ADD/STORE 不會被別人插入
        m.unlock();      // exit section
    }
}
// 更安全的寫法：std::lock_guard<std::mutex> g(m);
// 離開作用域自動 unlock，即使中途 return / 例外也不會忘記還鎖。`, note: '結果保證是 2000000，但慢很多——每次迴圈都要 lock/unlock。這是正確性與效能的取捨；實務上會把整個迴圈包在一次 lock 裡，或改用 atomic。' },
      checkpoint: [
        { id: 'ch4-mx-1', type: 'code', q: '這段 lock 的使用方式有什麼問題？', code: `void withdraw(int amt) {
    m.lock();
    if (balance < amt) return;   // 餘額不足
    balance -= amt;
    m.unlock();
}`, options: ['沒有問題', '餘額不足時 return 沒有 unlock，之後所有人都拿不到鎖（deadlock）', 'lock 應該放在 if 後面', 'balance 不需要保護'], answer: 1, explanation: '提早 return 跳過了 unlock。用 RAII（lock_guard）或確保每條路徑都 unlock。' },
        { id: 'ch4-mx-2', type: 'concept', q: '為什麼 lock 的 acquire() 本身需要硬體原子指令支援？', options: ['因為 lock 存在 kernel 裡', '因為「檢查鎖是否空閒並佔用它」是 read-modify-write，若不原子，兩個 thread 可能同時認為鎖是空的', '因為 C 語言沒有布林型別', '其實不需要'], answer: 1, explanation: '用有 race 的操作去實作防 race 的工具是不行的；必須有硬體保證的原子操作當基礎。' },
        { id: 'ch4-mx-3', type: 'scenario', q: 'Critical section 只有 3 條指令，系統是 8 核。等待鎖時應該用 spinlock 還是 blocking？', options: ['Blocking，永遠比較省', 'Spinlock：等待時間短於一次 context switch 的成本，spin 反而划算', '兩者一樣', '都不需要，3 條指令不會有 race'], answer: 1, explanation: 'Context switch 要幾微秒；等幾條指令的時間更短。多核時持有者正在另一顆核心上跑，很快就會釋放。' },
        { id: 'ch4-mx-4', type: 'code', q: 'Thread A 用 lock m1 保護 counter；Thread B 直接改 counter 沒拿鎖。會有 race 嗎？', options: ['不會，因為 A 有拿鎖', '會，lock 是約定，B 不遵守約定就沒有保護', '不會，因為 B 只改一次', '編譯器會阻止 B'], answer: 1, explanation: 'Lock 保護的是「所有人都經過同一道門」這個約定，而非變數本身。' }
      ]
    },
    {
      id: 'peterson',
      title: "Peterson's Solution",
      en: "Peterson's algorithm is a two-process software solution using flag[] (I want in) and turn (you go first). It satisfies all three conditions, assuming loads/stores are atomic and in order.",
      why: R`<p>在硬體提供原子指令之前，能不能<b>純軟體</b>解 critical section problem？Peterson 給了一個兩個 process 的解，而且是理解三個條件最好的教材：它每一行都對應一個條件。</p>`,
      scenario: R`<p>兩個人要進一扇門。規則：</p><ol><li>先舉手（<code>flag[i] = true</code>）：「我想進去」。</li><li>然後說「你先」（<code>turn = j</code>）：把禮讓權給對方。</li><li>如果對方也舉著手<b>而且</b>輪到對方（<code>flag[j] && turn == j</code>），我就等；否則進去。</li><li>出來時放下手（<code>flag[i] = false</code>）。</li></ol><p>兩個人同時舉手、同時說「你先」——誰<b>後說</b>「你先」，turn 就是誰讓的，對方先進。因為 turn 只有一個值，不可能兩個人都認為「輪到我」。</p>`,
      how: R`<p><b>先看前 5 行（進入）</b>：</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">flag[i] = true;                  // 我想進去
turn = j;                        // 但先讓你
while (flag[j] && turn == j) ;   // 你也想、而且輪到你 → 我等</pre>
<ul><li><code>flag[i]</code>：process i <b>想不想</b>進入。這是給對方看的訊號。</li><li><code>turn</code>：發生衝突時<b>誰讓誰</b>。它是共享的、最後寫入者說了算。</li></ul>
<p><b>為什麼 while 要兩個條件都成立才等？</b>若對方不想進（flag[j] = false），我沒理由等 → Progress。若對方想進但 turn 是我 → 我先，對方等 → Mutual Exclusion。</p>
<p><b>再看離開</b>：<code>flag[i] = false</code>。對方的 while 條件立刻不成立，可以進了。</p>
<p><b>Bounded waiting 從哪來？</b>我在 while 裡等的時候，對方出來後如果又想進，會先執行 <code>turn = i</code>——把 turn 讓給我。所以我最多只會被對方超前一次。</p>`,
      sim: 'peterson',
      definition: R`<ul>
<li><b>Peterson's solution</b>：兩個 process 的軟體 critical section 解法，使用 <code>bool flag[2]</code> 與 <code>int turn</code> 兩個共享變數。</li>
<li>三個條件的證明：<b>ME</b>：兩者都在 CS ⇒ flag[0]=flag[1]=true 且各自通過 while ⇒ turn 同時 = 0 和 = 1，矛盾。<b>Progress</b>：不想進的 process 其 flag 為 false，不會擋住別人。<b>Bounded waiting</b>：最多被超前一次。</li>
<li><b>現代硬體上的限制</b>：CPU 和編譯器可能<b>重排</b> load/store（例如把 <code>flag[i] = true</code> 延後到 while 之後），Peterson 就失效。需要 memory barrier。這是它在教科書之外很少被使用的原因，但它仍是理解「為什麼三個條件缺一不可」的最佳範例。</li>
</ul>`,
      code: { title: 'peterson.c — 完整程式（process i，j = 1 − i）', src: `bool flag[2] = {false, false};
int  turn = 0;

void enter(int i) {
    int j = 1 - i;
    flag[i] = true;                     // 1. 宣告想進
    turn = j;                           // 2. 禮讓對方
    while (flag[j] && turn == j) ;      // 3. 對方想進且輪到對方 → busy wait
}
void leave(int i) {
    flag[i] = false;                    // 4. 收回宣告
}

/* 使用 */
enter(i);
/* critical section */
leave(i);
/* remainder section */` },
      checkpoint: [
        { id: 'ch4-pt-1', type: 'trace', q: "Peterson：P0 執行 flag[0]=true、turn=1。此時 P1 執行 flag[1]=true、turn=0。接著兩者都到 while。誰進入 critical section？", options: ['P0', 'P1', '兩個都進', '兩個都不進（deadlock）'], answer: 0, hint: 'turn 最後被寫成什麼？', explanation: 'turn 最後 = 0。P0 的 while 條件 flag[1] && turn==1 為 false → 進入；P1 的條件 flag[0] && turn==0 為 true → 等。' },
        { id: 'ch4-pt-2', type: 'code', q: '把 Peterson 的前兩行對調（先 turn = j，再 flag[i] = true）會怎樣？', options: ['沒差', '可能違反 Mutual Exclusion：P0 設 turn=1 後、還沒設 flag[0] 時，P1 執行完整個進入程序（turn=0，flag[0] 為 false 所以直接進）；P0 接著設 flag[0]=true，檢查 flag[1]&&turn==1，turn 是 0，也進去', '會 deadlock', '違反 Bounded Waiting'], answer: 1, hint: '設 turn 的時候對方看得到你的 flag 嗎？', explanation: '順序很重要：必須先舉手再禮讓。否則存在一種交錯讓兩者都進入。' },
        { id: 'ch4-pt-3', type: 'concept', q: "Peterson's solution 在現代多核 CPU 上可能失效的原因是？", options: ['變數太多', 'CPU 或編譯器可能重排記憶體讀寫順序，破壞演算法依賴的順序', '只支援 32 位元', '需要 kernel 支援'], answer: 1, explanation: '例如 flag[i]=true 的 store 被延後到 while 的 load 之後，對方就看不到你舉手。需 memory barrier。' },
        { id: 'ch4-pt-4', type: 'concept', q: 'flag[i] 與 turn 各自的角色是？', options: ['flag 記錄誰在 critical section；turn 記錄執行次數', 'flag[i] 表示 process i 想進入；turn 表示衝突時誰禮讓（最後寫入者禮讓）', 'flag 是鎖；turn 是計數器', '兩者可以互換'], answer: 1, explanation: 'flag 是意願、turn 是仲裁。缺 flag 就違反 Progress，缺 turn 就違反 Mutual Exclusion。' }
      ]
    },
    {
      id: 'hw-atomic',
      title: '硬體支援：test_and_set 與 compare_and_swap',
      en: 'Modern locks are built on atomic hardware instructions that read and write a memory word in one indivisible step.',
      why: R`<p>Mutex 的 acquire() 需要原子操作；Peterson 在現代硬體上不可靠。真正的答案是硬體直接提供「讀出舊值並寫入新值」的<b>單一不可分割指令</b>。所有現代 lock（pthread_mutex、spinlock、std::atomic）都建立在它之上。</p>`,
      scenario: R`<p>想像 lock 是一張桌上的牌，正面朝上 = 空閒。你要「看牌並翻面」——如果兩個人同時看到正面、同時翻，就都以為自己拿到了。<code>test_and_set</code> 是「看和翻在同一個瞬間完成」：硬體保證第二個人看到的一定是已經被翻過的牌。</p>`,
      how: R`<p><b>test_and_set(&lock)</b>：原子地「回傳 lock 的舊值，並把 lock 設為 true」。</p>
<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">while (test_and_set(&lock)) ;   // 舊值是 true → 別人拿著 → 繼續轉
/* critical section */
lock = false;</pre>
<p>第一個執行的人拿到舊值 false（進入），同時把它設 true；之後的人都拿到 true（等待）。</p>
<p><b>compare_and_swap(&v, expected, new)</b>：原子地「若 v == expected 則把 v 設為 new；回傳 v 的舊值」。更通用，可以實作 lock-free 資料結構。x86 的 <code>lock cmpxchg</code>、ARM 的 LL/SC 都是這類指令。</p>
<p>這個簡單版本滿足 ME 與 Progress，但<b>不滿足 Bounded Waiting</b>（誰搶到不一定）。教科書有加上 waiting[] 陣列的版本可修正。</p>`,
      definition: R`<ul><li><b>Atomic instruction</b>：硬體保證在執行期間不會被其他 CPU 或 interrupt 插入的指令，多核下透過鎖住記憶體匯流排或 cache line 實現。</li><li><b>test_and_set</b>、<b>compare_and_swap（CAS）</b>、<b>fetch_and_add</b>：常見的原子原語。</li><li><b>std::atomic&lt;int&gt;</b>：C++ 的封裝；<code>counter.fetch_add(1)</code> 是原子的 counter++，不需要 lock。</li></ul>`,
      code: { title: 'tas.cpp — 用 atomic 實作 spinlock', src: `#include <atomic>
std::atomic<bool> lock_{false};

void acquire() {
    while (lock_.exchange(true)) ;   // exchange = test_and_set：回傳舊值並設 true
}
void release() { lock_.store(false); }

// 或者根本不用鎖：
std::atomic<int> counter{0};
void add() { counter.fetch_add(1); }  // 硬體原子加法，沒有 race` },
      checkpoint: [
        { id: 'ch4-hw-1', type: 'trace', q: 'lock = false。Thread A 和 B 同時執行 test_and_set(&lock)。結果？', options: ['兩者都拿到 false，都進入', '恰好一個拿到 false（進入），另一個拿到 true（等待）', '兩者都拿到 true', '不確定'], answer: 1, explanation: '硬體序列化兩次執行：先執行者看到 false 並設 true，後執行者看到 true。' },
        { id: 'ch4-hw-2', type: 'concept', q: 'CAS(&v, 5, 9) 執行時 v = 7。執行後 v 是多少、回傳什麼？', options: ['v = 9，回傳 7', 'v = 7，回傳 7', 'v = 9，回傳 5', 'v = 5，回傳 9'], answer: 1, explanation: 'v ≠ expected(5)，不交換，回傳舊值 7。呼叫者由此知道「有人先改了」。' },
        { id: 'ch4-hw-3', type: 'concept', q: '用 std::atomic&lt;int&gt; 的 fetch_add 取代 mutex + counter++ 的好處是？', options: ['沒有好處', '不需要 lock，一條原子指令完成，避免 context switch 與 lock 競爭', '可以在 user mode 執行', '可以跨 process 使用'], answer: 1, explanation: '對簡單的計數，硬體原子指令遠比 lock 便宜；複雜的多步驟操作仍需要 lock。' }
      ]
    }
  ]
});
})();
