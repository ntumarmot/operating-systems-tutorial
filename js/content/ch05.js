/* Chapter 5：Semaphore 與經典同步問題 */
window.CONTENT = window.CONTENT || { chapters: [] };
(function () {
const R = String.raw;
CONTENT.chapters.push({
  id: 'ch5', num: 5, title: 'Semaphore 與經典同步問題', topic: 'sync',
  subtitle: 'Semaphore 為什麼存在、wait/signal、Producer-Consumer、Readers-Writers、Dining Philosophers。',
  why: R`<p>Mutex 只能表達「一次一個」。但很多問題不是這樣：印表機有 3 台，一次可以 3 個人用；buffer 有 5 格，producer 放滿了才要等；consumer 要等到「有東西」才能拿——這是「等某個條件成立」，而不是「等鎖」。需要一個更一般的工具。</p>`,
  concepts: [
    {
      id: 'semaphore',
      title: '號誌（Semaphore）',
      en: 'A semaphore is an integer with two atomic operations: wait() decrements and blocks if negative; signal() increments and wakes a waiter. It counts available resources.',
      why: R`<p>三個場景 mutex 都做不好：</p><ol><li><b>N 個相同資源</b>：3 台印表機。mutex 只能鎖一台。</li><li><b>順序</b>：B 必須等 A 做完某件事才能開始。mutex 沒有「等事件」的概念。</li><li><b>生產與消費</b>：buffer 空的時候 consumer 要睡，有東西時被叫醒。</li></ol><p>共同點：需要一個<b>計數器</b>，加上「數到零就睡、有人加一就醒」的機制。這就是 semaphore。</p>`,
      scenario: R`<p>停車場有 3 個車位，入口有個計數器顯示剩餘車位。</p><ul><li>車進來（<code>wait</code>）：計數器減一。若減完小於 0，表示沒位子，在門口排隊。</li><li>車出去（<code>signal</code>）：計數器加一。若加完仍 ≤ 0，表示有人在排隊，放一台進來。</li></ul><p>計數器 ≥ 0 時 = 剩幾個位子；&lt; 0 時 = 有幾台在排隊。</p>`,
      how: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">wait(S):                    signal(S):
    S.value--;                  S.value++;
    if (S.value < 0) {          if (S.value <= 0) {
        把自己加入 S.list;           從 S.list 取出一個 P;
        block();                    wakeup(P);
    }                           }</pre>
<p>兩個操作本身必須是原子的（內部用 spinlock 或關 interrupt 保護），但它們很短，所以「等待」是真正的 block（不是 busy waiting）。</p>
<p><b>兩種用法</b>：</p>
<ul><li><b>Binary semaphore</b>（初始值 1）：當 mutex 用。wait = lock，signal = unlock。</li><li><b>Counting semaphore</b>（初始值 N）：管理 N 個相同資源。</li></ul>
<p><b>當作「事件」用</b>：初始值 0。B 執行 <code>wait(S)</code> 會立刻睡；A 做完事執行 <code>signal(S)</code> 叫醒 B。這保證 B 的程式碼在 A 之後執行。</p>`,
      sim: 'semaphoreSim',
      definition: R`<ul>
<li><b>Semaphore</b>：一個整數變數 S，只能透過兩個原子操作存取：<code>wait(S)</code>（又稱 P、down、acquire）與 <code>signal(S)</code>（又稱 V、up、release）。</li>
<li><b>Binary semaphore</b>：值只有 0 或 1。</li><li><b>Counting semaphore</b>：值可為任意非負整數（初始值），代表可用資源數。</li>
<li><b>Mutex vs Semaphore</b>：mutex 有<b>擁有權</b>（誰 lock 誰 unlock），語意是「互斥」；semaphore 沒有擁有權（A wait、B signal 是合法且常見的），語意是「計數／同步」。</li>
<li>使用錯誤的典型：signal 和 wait 順序寫反、忘記 signal、兩個 wait 順序造成 deadlock（下一節）。</li>
</ul>`,
      code: { title: 'sem.c — POSIX semaphore：用 semaphore 保證順序', src: `#include <semaphore.h>
#include <pthread.h>
sem_t done;                       // 初始值 0：當作「事件」

void* producer(void*) {
    prepare_data();
    sem_post(&done);              // signal：資料好了
    return NULL;
}
void* consumer(void*) {
    sem_wait(&done);              // wait：資料還沒好就睡在這裡
    use_data();                   // 保證在 prepare_data() 之後執行
    return NULL;
}
int main() {
    sem_init(&done, 0, 0);        // 第三個參數 = 初始值
    /* 建立兩個 thread ... */
}`, note: '注意 consumer 的 wait 和 producer 的 signal 是<b>不同</b> thread 執行的——這在 mutex 是不允許的（unlock 別人的鎖），在 semaphore 是正常用法。' },
      checkpoint: [
        { id: 'ch5-sm-1', type: 'trace', q: 'S = 3。P1、P2、P3、P4、P5 依序各執行一次 wait(S)。此時 S 的值與等待佇列？', options: ['S = 0，佇列空', 'S = −2，佇列 [P4, P5]', 'S = 3，佇列 [P4, P5]', 'S = −2，佇列 [P1, P2]'], answer: 1, explanation: '前三個拿到資源（S: 3→2→1→0），P4、P5 讓 S 變 −1、−2 並進入佇列。|S| = 排隊人數。' },
        { id: 'ch5-sm-2', type: 'trace', q: '接上題，P2 執行 signal(S)。結果？', options: ['S = −1，P4 被叫醒並取得資源', 'S = −1，P5 被叫醒', 'S = 1，沒人被叫醒', 'S = 0，P2 再次進入'], answer: 0, explanation: 'S 從 −2 變 −1，仍 ≤ 0 表示有人等 → 叫醒佇列第一個 P4。' },
        { id: 'ch5-sm-3', type: 'concept', q: 'Mutex 與 Semaphore 最核心的差別是？', options: ['Semaphore 比較快', 'Mutex 有擁有權（只有 lock 者能 unlock），用於互斥；Semaphore 無擁有權、可計數，用於同步或管理多個資源', 'Mutex 只能在 kernel 用', '兩者完全相同'], answer: 1, explanation: '「A wait、B signal」在 semaphore 是正常的（表達順序），在 mutex 是錯誤的。' },
        { id: 'ch5-sm-4', type: 'code', q: '想讓 thread B 的 step2() 一定在 thread A 的 step1() 之後執行。semaphore S 的初始值應該是？', code: `// A:            // B:
step1();          sem_wait(&S);
sem_post(&S);     step2();`, options: ['1', '0', '2', '−1'], answer: 1, explanation: '初始 0：B 若先到會睡；A 做完 signal 才放行。初始 1 的話 B 會直接通過，順序不保證。' }
      ]
    },
    {
      id: 'producer-consumer',
      title: 'Producer-Consumer（Bounded Buffer）',
      en: 'Producers put items into a fixed-size buffer; consumers take them. Three semaphores: empty (free slots), full (items), mutex (buffer access).',
      why: R`<p>這是最經典的同步問題，因為它同時需要三件事：<b>互斥</b>（兩個人不能同時動 buffer 的指標）、<b>滿了要等</b>、<b>空了要等</b>。用一個 mutex 做不到後兩件——它引出 counting semaphore 的真正用途。</p>`,
      scenario: R`<pre style="font-family:var(--mono);font-size:.82rem;background:var(--code-bg);padding:10px 14px;border-radius:6px;display:inline-block">Producer ──put──▶ [ ][ ][ ][ ][ ] ──take──▶ Consumer
                    buffer (N = 5)

empty = 5   還有幾個空位（producer 要等它 > 0）
full  = 0   有幾個東西（consumer 要等它 > 0）
mutex = 1   同一時間只能一個人動 buffer</pre>
<p>鍵盤驅動程式（producer）與讀鍵盤的程式（consumer）、網卡與 TCP stack、pipe 的兩端——全都是這個模型。</p>`,
      how: R`<p>Producer 先 <code>wait(empty)</code>（沒空位就睡），再 <code>wait(mutex)</code> 進 buffer，放完 <code>signal(mutex)</code>，最後 <code>signal(full)</code> 告訴 consumer 多了一個。Consumer 對稱。</p>
<p><b>順序為什麼重要？</b>如果 producer 先 <code>wait(mutex)</code> 再 <code>wait(empty)</code>：buffer 滿時，producer 拿著 mutex 在 empty 上睡著；consumer 想拿東西，先 <code>wait(mutex)</code>——拿不到，也睡。兩個都在睡，沒人能叫醒對方：<b>deadlock</b>。規則：<b>先等資源條件，再拿互斥鎖</b>。</p>`,
      sim: 'producerConsumer',
      definition: R`<p>共享：<code>buffer[N]</code>、<code>in</code>、<code>out</code>；semaphore：<code>mutex = 1</code>、<code>empty = N</code>、<code>full = 0</code>。任何時刻 <code>empty + full = N − (正在操作中的數量)</code>。</p>`,
      code: { title: 'bounded_buffer.c', src: `sem_t mutex, empty, full;   // 初始 1, N, 0
int buffer[N], in = 0, out = 0;

void producer() {
    while (true) {
        item = produce();
        sem_wait(&empty);           // 有空位嗎？
        sem_wait(&mutex);           // 進入 buffer
        buffer[in] = item; in = (in + 1) % N;
        sem_post(&mutex);
        sem_post(&full);            // 多一個東西
    }
}
void consumer() {
    while (true) {
        sem_wait(&full);            // 有東西嗎？
        sem_wait(&mutex);
        item = buffer[out]; out = (out + 1) % N;
        sem_post(&mutex);
        sem_post(&empty);           // 多一個空位
        consume(item);
    }
}` },
      checkpoint: [
        { id: 'ch5-pc-1', type: 'code', q: '把 producer 的 wait(empty) 與 wait(mutex) 對調。buffer 滿的時候會發生什麼？', options: ['正常運作', 'Producer 持有 mutex 後在 empty 上阻塞；consumer 拿不到 mutex 也阻塞 → deadlock', 'Consumer 會覆蓋資料', 'Buffer 會溢位'], answer: 1, explanation: '拿著互斥鎖去等資源，就會把能釋放資源的人擋在門外。' },
        { id: 'ch5-pc-2', type: 'trace', q: 'N = 5，buffer 目前有 2 個東西，沒有人在操作。empty、full 各是多少？', options: ['empty = 2，full = 3', 'empty = 3，full = 2', 'empty = 5，full = 0', 'empty = 0，full = 5'], answer: 1, explanation: 'full = 物品數 = 2；empty = 空位數 = 5 − 2 = 3。' },
        { id: 'ch5-pc-3', type: 'concept', q: '為什麼需要 mutex？empty 和 full 不是已經限制了同時操作的人數嗎？', options: ['其實不需要', 'empty/full 只限制「總量」，不阻止一個 producer 和一個 consumer（或兩個 producer）同時修改 in/out 指標與 buffer', 'mutex 是為了效能', 'mutex 用來計數'], answer: 1, explanation: '例如 empty = 3 允許三個 producer 同時通過 wait(empty)，它們會同時改 in。這是 race，需要 mutex。' },
        { id: 'ch5-pc-4', type: 'trace', q: 'buffer 空，consumer 先執行到 wait(full)。接著 producer 完整跑一輪。consumer 的狀態變化？', options: ['一直阻塞', '在 wait(full) 阻塞 → producer signal(full) 後被叫醒 → 繼續 wait(mutex) → 取出', '不會阻塞，直接取出 0', '會被 producer 搶佔'], answer: 1, explanation: 'full 從 0 → wait 讓它變 −1（睡）→ producer post 讓它變 0 並叫醒 consumer。' }
      ]
    },
    {
      id: 'readers-writers',
      title: 'Readers-Writers',
      en: 'Many readers may read simultaneously, but a writer needs exclusive access. read_count tracks readers; the first reader locks out writers and the last reader lets them in.',
      why: R`<p>資料庫、設定檔、DNS 快取：<b>讀的人多、寫的人少</b>。如果用一個 mutex，讀者之間也互斥，明明可以一起讀卻得排隊。想要：讀者可以同時、但寫者要獨占。</p>`,
      scenario: R`<p>圖書館的一本參考書：很多人可以同時站在旁邊看；但編輯要修訂時，得等所有人離開，而且修訂期間沒人能看。問題是：誰負責告訴編輯「現在沒人在看了」？→ 最後一個離開的讀者。誰負責告訴編輯「有人開始看了」？→ 第一個進來的讀者。</p>`,
      how: R`<ul><li><code>rw_mutex</code>（初始 1）：寫者拿它獨占；<b>第一個</b>讀者也拿它（代表整群讀者），<b>最後一個</b>讀者還它。</li><li><code>read_count</code>：目前讀者數。它是共享變數，改它要用 <code>mutex</code>（初始 1）保護。</li></ul><p>這是「讀者優先」版本：只要有讀者在，寫者就進不去；讀者源源不絕時寫者 <b>starvation</b>。「寫者優先」版本反過來：有寫者在等，新讀者就不准進。實務上 pthread 的 <code>rwlock</code> 就是這個模型的封裝。</p>`,
      sim: 'readersWriters',
      definition: R`<p>Readers-writers problem：多個 process 共享一份資料；reader 只讀，writer 會改。要求：writer 與任何其他 process 互斥；reader 之間不互斥。變體依「誰優先」分為 first（reader 優先）與 second（writer 優先）。</p>`,
      code: { title: 'rw.c', src: `sem_t rw_mutex = 1, mutex = 1;
int read_count = 0;

void writer() {
    sem_wait(&rw_mutex);
    /* write */
    sem_post(&rw_mutex);
}
void reader() {
    sem_wait(&mutex);
    read_count++;
    if (read_count == 1) sem_wait(&rw_mutex);   // 第一個讀者：擋住寫者
    sem_post(&mutex);
    /* read */
    sem_wait(&mutex);
    read_count--;
    if (read_count == 0) sem_post(&rw_mutex);   // 最後一個讀者：放行寫者
    sem_post(&mutex);
}` },
      checkpoint: [
        { id: 'ch5-rw-1', type: 'trace', q: '兩個 reader 在讀（read_count = 2）。writer 到達執行 wait(rw_mutex)。接著兩個 reader 依序離開。writer 何時進入？', options: ['立刻', '第一個 reader 離開時', '第二個（最後一個）reader 離開、執行 signal(rw_mutex) 時', '永遠不會'], answer: 2, explanation: 'rw_mutex 由第一個讀者拿走，只有 read_count 歸零時才還。' },
        { id: 'ch5-rw-2', type: 'concept', q: '為什麼 read_count 需要 mutex 保護？', options: ['因為它是全域變數', '因為 read_count++ / -- 與 if 判斷是 read-modify-write，多個 reader 同時執行會有 race（例如兩個都以為自己是第一個）', '因為 semaphore 不能存整數', '其實不需要'], answer: 1, explanation: '若兩個 reader 同時 read_count++ 且都看到 1，會 wait(rw_mutex) 兩次，第二個永遠卡住。' },
        { id: 'ch5-rw-3', type: 'scenario', q: '讀者優先版本中，誰可能 starvation？', options: ['reader', 'writer：只要一直有新 reader 進來，rw_mutex 永遠不會被還', '兩者都不會', '兩者都會'], answer: 1, explanation: '新 reader 只要看 read_count > 0 就直接進，不理會等待中的 writer。' }
      ]
    },
    {
      id: 'dining-philosophers',
      title: 'Dining Philosophers',
      en: 'Five philosophers, five chopsticks; each needs two. Naive "pick left then right" can deadlock when everyone holds one. Fixes break the circular wait.',
      why: R`<p>這不是真的在講吃飯——它是「多個 process 各需要多個資源」的最小模型，用來展示：<b>每個人都很守規矩（拿到才用、用完就還），整體卻可以全部卡死</b>。它是 Ch6 deadlock 的預告。</p>`,
      scenario: R`<p>圓桌五個哲學家，每兩人之間一根筷子（共五根）。要吃飯需要左右兩根。規則：先拿左邊，再拿右邊，吃完放下。</p><p>最壞情況：五個人同時餓了，同時拿起左邊那根。現在每個人手上一根，右邊那根在鄰居手上。每個人都在等鄰居放下——但鄰居也在等。沒有人會放下手上的（為什麼要放？我還差一根就能吃了）。<b>永遠卡住。</b></p>`,
      how: R`<p>用 semaphore 陣列 <code>chopstick[5]</code>，初始都是 1。哲學家 i：<code>wait(chopstick[i]); wait(chopstick[(i+1)%5]); eat; signal(...); signal(...)</code>。</p>
<p>三種修法，每種都打破了「環」：</p>
<ol>
<li><b>最多 4 人同時入座</b>：5 根筷子 4 個人，鴿籠原理保證至少一人能拿到兩根。</li>
<li><b>兩根一起拿</b>（原子地）：拿不到兩根就一根也不拿。消除 hold-and-wait。</li>
<li><b>不對稱</b>：奇數號先拿左、偶數號先拿右。這樣「每個人都拿著左邊等右邊」的環不可能形成。</li>
</ol>
<p>解了 deadlock 之後還要注意 <b>starvation</b>：某個哲學家可能一直搶不到（兩邊鄰居輪流吃）。</p>`,
      sim: 'philosophers',
      definition: R`<p>Dining philosophers problem：N 個 process 環狀排列，每個需要與相鄰兩個 process 共用的兩個資源。展示 deadlock 的四個條件（Ch6）在最簡單的規則下如何同時成立，以及如何用「破壞 circular wait」或「破壞 hold and wait」來避免。</p>`,
      code: { title: 'philosophers.c — 不對稱解法', src: `sem_t chopstick[5];   // 都初始化為 1

void philosopher(int i) {
    int first  = (i % 2 == 0) ? (i + 1) % 5 : i;   // 偶數先拿右邊
    int second = (i % 2 == 0) ? i : (i + 1) % 5;   // 奇數先拿左邊
    while (true) {
        think();
        sem_wait(&chopstick[first]);
        sem_wait(&chopstick[second]);
        eat();
        sem_post(&chopstick[second]);
        sem_post(&chopstick[first]);
    }
}` },
      checkpoint: [
        { id: 'ch5-dp-1', type: 'trace', q: '五個哲學家同時執行 wait(chopstick[i])（都拿到左邊）。接下來每個人執行 wait(chopstick[(i+1)%5])。結果？', options: ['大家輪流吃', '全部阻塞——每根筷子都被拿走，每個人都在等：deadlock', '有一個人能吃', '系統會自動釋放筷子'], answer: 1, explanation: '五根筷子都被拿走，五個 wait 全部阻塞，沒有任何 signal 會發生。' },
        { id: 'ch5-dp-2', type: 'concept', q: '「最多允許 4 人同時入座」為什麼能避免 deadlock？', options: ['因為 4 是偶數', '5 根筷子分給最多 4 人，至少有一人能拿到兩根、吃完釋放，打破等待鏈', '因為第 5 個人會強制別人放下', '它其實不能避免'], answer: 1, explanation: '鴿籠原理：4 人拿 5 根筷子，必有人拿到 2 根。' },
        { id: 'ch5-dp-3', type: 'concept', q: '奇偶不對稱解法打破了 deadlock 的哪個必要條件？', options: ['Mutual Exclusion', 'Hold and Wait', 'No Preemption', 'Circular Wait'], answer: 3, explanation: '相鄰兩人對同一根筷子的拿取順序不同，「每人拿左等右」的環無法形成。' }
      ]
    }
  ]
});
})();
