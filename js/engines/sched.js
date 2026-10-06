/* ============================================================
   Sched — CPU Scheduling 純演算法引擎（不碰 DOM）
   支援：FCFS / SJF / SRTF / RR / PRIO（非搶佔）/ PRIO_P（搶佔）
   輸入：procs = [{ id, arrival, burst, priority? }]，priority 數字越小優先權越高
   輸出：{ steps, gantt, metrics, avg, algo, quantum }
     steps[k] = { time, running, ready:[id...], remaining:{id:rem}, events:[...], desc }
       代表「時間 time 的狀態」與「[time, time+1) 這一格會執行誰」
     gantt = [{ id, start, end }]（連續同一 process 已合併，id=null 表示 idle）
     metrics[id] = { arrival, burst, completion, turnaround, waiting, response, firstStart }
   Tie-break 規則（所有 sim 與題目一致）：
     - 同時到達：依輸入順序進 ready queue
     - SJF / SRTF / Priority 相同時：先到者優先，再依輸入順序；SRTF/PRIO_P 若與正在執行者相同，不換人
     - RR：時間片用完的同時有新 process 到達 → 新到達者先進 queue，被換下的排最後
   ============================================================ */
window.Sched = (function () {
  const ALGOS = {
    FCFS: { name: 'FCFS', full: 'First-Come, First-Served', preemptive: false },
    SJF: { name: 'SJF', full: 'Shortest Job First（非搶佔）', preemptive: false },
    SRTF: { name: 'SRTF', full: 'Shortest Remaining Time First（搶佔式 SJF）', preemptive: true },
    RR: { name: 'RR', full: 'Round Robin', preemptive: true },
    PRIO: { name: 'Priority', full: 'Priority（非搶佔，數字小 = 優先）', preemptive: false },
    PRIO_P: { name: 'Priority (P)', full: 'Priority（搶佔，數字小 = 優先）', preemptive: true }
  };

  function run(input, algo, opts = {}) {
    const quantum = Math.max(1, opts.quantum || 2);
    const P = input.map((p, i) => ({ id: p.id, arrival: +p.arrival, burst: +p.burst, priority: p.priority == null ? 0 : +p.priority, idx: i, rem: +p.burst, firstStart: null, completion: null }));
    const byId = {}; P.forEach(p => byId[p.id] = p);
    const n = P.length;
    let t = 0, running = null, qleft = 0, ready = [], completed = 0;
    const steps = [], raw = [];
    const guard = P.reduce((s, p) => s + p.burst, 0) + Math.max(0, ...P.map(p => p.arrival)) + 2;
    const snap = () => { const r = {}; P.forEach(p => r[p.id] = p.rem); return r; };
    const cmpArr = (a, b) => a.arrival - b.arrival || a.idx - b.idx;

    while (completed < n && t <= guard) {
      const events = [];
      // (1) 完成判定：上一格跑完了
      if (running && running.rem === 0) {
        running.completion = t; completed++;
        events.push({ type: 'complete', id: running.id, text: `${running.id} 執行完畢（Completion Time = ${t}）` });
        running = null;
      }
      if (completed === n) { steps.push({ time: t, running: null, ready: [], remaining: snap(), events, final: true, desc: events.map(e => e.text).join('；') + '。所有 process 完成。' }); break; }
      // (2) 新到達
      const arrived = P.filter(p => p.arrival === t).sort((a, b) => a.idx - b.idx);
      arrived.forEach(p => { ready.push(p); events.push({ type: 'arrive', id: p.id, text: `${p.id} 到達，進入 Ready Queue` }); });
      // (3) 決策
      let dispatched = null, preempted = null;
      const pick = (cands, keyFn) => {
        let best = null;
        cands.forEach(c => { if (!best || keyFn(c) < keyFn(best) || (keyFn(c) === keyFn(best) && cmpArr(c, best) < 0)) best = c; });
        return best;
      };
      if (algo === 'FCFS') {
        if (!running && ready.length) { dispatched = ready.shift(); }
      } else if (algo === 'SJF') {
        if (!running && ready.length) { dispatched = pick(ready, p => p.burst); ready = ready.filter(p => p !== dispatched); }
      } else if (algo === 'PRIO') {
        if (!running && ready.length) { dispatched = pick(ready, p => p.priority); ready = ready.filter(p => p !== dispatched); }
      } else if (algo === 'SRTF' || algo === 'PRIO_P') {
        const key = algo === 'SRTF' ? (p => p.rem) : (p => p.priority);
        if (ready.length) {
          const best = pick(ready, key);
          if (!running) { dispatched = best; ready = ready.filter(p => p !== best); }
          else if (key(best) < key(running)) { preempted = running; ready.push(running); dispatched = best; ready = ready.filter(p => p !== best); running = null; }
        }
      } else if (algo === 'RR') {
        if (running && qleft === 0) {
          preempted = running; ready.push(running); running = null;   // 新到達者已先進 queue
          events.push({ type: 'quantum', id: preempted.id, text: `${preempted.id} 時間片（q = ${quantum}）用完，回到 Ready Queue 尾端` });
        }
        if (!running && ready.length) { dispatched = ready.shift(); qleft = quantum; }
      }
      if (preempted && algo !== 'RR') events.push({ type: 'preempt', id: preempted.id, text: `${preempted.id} 被搶佔（${algo === 'SRTF' ? '剩餘時間' : '優先權'}輸給 ${dispatched.id}），回到 Ready Queue` });
      if (dispatched) {
        running = dispatched;
        if (running.firstStart == null) { running.firstStart = t; events.push({ type: 'dispatch', id: running.id, text: `Dispatch ${running.id}（第一次取得 CPU，Response Time = ${t - running.arrival}）` }); }
        else events.push({ type: 'dispatch', id: running.id, text: `Dispatch ${running.id}（剩餘 ${running.rem}）` });
      }
      if (!running && !events.length) events.push({ type: 'idle', text: 'CPU 閒置（沒有 process 可跑）' });
      else if (!running) events.push({ type: 'idle', text: 'CPU 閒置' });

      const stepReady = ready.map(p => p.id);
      // 若這格什麼都沒發生（單純繼續跑），也記錄一步（讓 Gantt 一格一格前進）
      const desc = events.map(e => e.text).join('；') || (running ? `${running.id} 繼續執行` : '');
      steps.push({ time: t, running: running ? running.id : null, ready: stepReady, remaining: snap(), events, qleft: algo === 'RR' ? qleft : null, desc: desc || `${running.id} 繼續執行（剩餘 ${running.rem}）` });
      // (4) 執行一格
      raw.push(running ? running.id : null);
      if (running) { running.rem--; if (algo === 'RR') qleft--; }
      t++;
    }
    if (completed < n) { // guard 觸發（不應發生）
      steps.push({ time: t, running: null, ready: [], remaining: snap(), events: [], final: true, desc: '模擬提前結束。' });
    }

    // Gantt 合併
    const gantt = [];
    raw.forEach((id, i) => { const last = gantt[gantt.length - 1]; if (last && last.id === id) last.end = i + 1; else gantt.push({ id, start: i, end: i + 1 }); });
    // Metrics
    const metrics = {}; let sw = 0, st = 0, sr = 0;
    P.forEach(p => {
      const turnaround = p.completion - p.arrival, waiting = turnaround - p.burst, response = p.firstStart - p.arrival;
      metrics[p.id] = { arrival: p.arrival, burst: p.burst, priority: p.priority, completion: p.completion, turnaround, waiting, response, firstStart: p.firstStart };
      sw += waiting; st += turnaround; sr += response;
    });
    const avg = { waiting: sw / n, turnaround: st / n, response: sr / n, end: t };
    return { steps, gantt, metrics, avg, algo, quantum, order: P.map(p => p.id) };
  }

  // 只回傳「決策點」步驟（事件發生的那些 tick），用於精簡顯示
  function decisionSteps(res) { return res.steps.filter(s => s.events.length || s.final); }

  return { ALGOS, run, decisionSteps };
})();
