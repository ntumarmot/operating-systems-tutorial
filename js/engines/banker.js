/* ============================================================
   Banker — Banker's Algorithm 純引擎（不碰 DOM）
   輸入：available:[..]、max:[[..]]、allocation:[[..]]、ids:[名稱]
   safety() → { need, safe, sequence, steps:[{ work, finish, chosen, reason, released }] }
   request(pid, req) → { ok, reason, state?, safety? }
   ============================================================ */
window.Banker = (function () {
  const B = {};
  const sub = (a, b) => a.map((x, i) => x - b[i]);
  const add = (a, b) => a.map((x, i) => x + b[i]);
  const le = (a, b) => a.every((x, i) => x <= b[i]);
  B.need = (max, alloc) => max.map((row, i) => sub(row, alloc[i]));

  B.safety = (available, max, alloc, ids) => {
    const n = max.length;
    ids = ids || max.map((_, i) => 'P' + i);
    const need = B.need(max, alloc);
    let work = available.slice();
    const finish = Array(n).fill(false);
    const steps = [{ work: work.slice(), finish: finish.slice(), chosen: null, reason: `初始：Work = Available = [${work.join(', ')}]`, need }];
    const sequence = [];
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < n; i++) {
        if (!finish[i] && le(need[i], work)) {
          const released = alloc[i].slice();
          work = add(work, alloc[i]); finish[i] = true; sequence.push(ids[i]); progress = true;
          steps.push({ work: work.slice(), finish: finish.slice(), chosen: i, released, need,
            reason: `${ids[i]}：Need [${need[i].join(', ')}] ≤ Work → 可以完成。完成後歸還 Allocation [${released.join(', ')}]，Work 變成 [${work.join(', ')}]` });
          // 不重頭掃描：繼續往下找（與教科書的 safe sequence 一致）
        }
      }
    }
    const safe = finish.every(Boolean);
    const stuck = ids.filter((_, i) => !finish[i]);
    steps.push({ work: work.slice(), finish: finish.slice(), chosen: null, need, final: true,
      reason: safe ? `所有 process 都能完成 → Safe State。Safe Sequence：${sequence.join(' → ')}` : `剩下 ${stuck.join('、')} 的 Need 都大於 Work，無法完成 → Unsafe State（可能 deadlock）` });
    return { need, safe, sequence, steps, stuck };
  };

  B.request = (available, max, alloc, ids, pi, req) => {
    const need = B.need(max, alloc);
    if (!le(req, need[pi])) return { ok: false, reason: `Request [${req.join(', ')}] > Need [${need[pi].join(', ')}]：超過宣告的最大需求，錯誤` };
    if (!le(req, available)) return { ok: false, reason: `Request [${req.join(', ')}] > Available [${available.join(', ')}]：資源不夠，${ids[pi]} 必須等待` };
    // 假裝配置
    const av2 = sub(available, req), alloc2 = alloc.map((r, i) => i === pi ? add(r, req) : r.slice());
    const s = B.safety(av2, max, alloc2, ids);
    return { ok: s.safe, reason: s.safe ? `假裝配置後仍是 Safe State（${s.sequence.join(' → ')}）→ 核准` : '假裝配置後變成 Unsafe State → 拒絕，' + ids[pi] + ' 必須等待（恢復原狀）', state: { available: av2, alloc: alloc2 }, safety: s };
  };
  return B;
})();
