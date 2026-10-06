/* ============================================================
   Mem — 記憶體相關純演算法引擎（不碰 DOM）
   - translate：邏輯位址 → page / offset → frame → 實體位址
   - allocate：First / Best / Worst Fit
   - pageReplace：FIFO / LRU / OPT 逐步結果
   ============================================================ */
window.Mem = (function () {
  const M = {};

  /* ---------- 位址轉換 ---------- */
  // pageTable: 陣列，index = page number，值 = frame number（或 null = 不在記憶體）
  M.translate = (logical, pageSize, pageTable) => {
    const offsetBits = Math.log2(pageSize);
    const page = Math.floor(logical / pageSize), offset = logical % pageSize;
    const entry = pageTable[page];
    const frame = entry == null ? null : (typeof entry === 'object' ? entry.frame : entry);
    const valid = page < pageTable.length && frame != null;
    return { logical, pageSize, offsetBits: Number.isInteger(offsetBits) ? offsetBits : null, page, offset, frame, valid, physical: valid ? frame * pageSize + offset : null, outOfRange: page >= pageTable.length };
  };

  /* ---------- 連續配置：First / Best / Worst Fit ----------
     blocks: [{ start, size, pid }]，pid 為 null 表示 free hole
     回傳 { index (被選中的 block 索引或 -1), candidates:[索引...], reason } ---------- */
  M.chooseHole = (blocks, size, strategy) => {
    const cands = blocks.map((b, i) => ({ b, i })).filter(x => x.b.pid == null && x.b.size >= size);
    if (!cands.length) return { index: -1, candidates: [], reason: '沒有任何 hole 夠大（External Fragmentation：總 free 空間可能夠，但沒有一塊連續的夠大）' };
    let pick;
    if (strategy === 'first') pick = cands[0];
    else if (strategy === 'best') pick = cands.reduce((a, c) => c.b.size < a.b.size ? c : a);
    else pick = cands.reduce((a, c) => c.b.size > a.b.size ? c : a);
    const reason = { first: '從低位址開始掃描，第一個夠大的 hole 就用', best: '掃描所有 hole，選「夠大且最小」的（剩下的碎片最小）', worst: '掃描所有 hole，選「最大」的（剩下的碎片最大，希望還能再被利用）' }[strategy];
    return { index: pick.i, candidates: cands.map(c => c.i), reason };
  };
  // 在 hole 中放入 process，回傳新的 blocks（不修改原陣列）
  M.place = (blocks, index, size, pid) => {
    const out = blocks.map(b => Object.assign({}, b));
    const h = out[index];
    if (h.size === size) { h.pid = pid; return out; }
    const rest = { start: h.start + size, size: h.size - size, pid: null };
    h.size = size; h.pid = pid;
    out.splice(index + 1, 0, rest);
    return out;
  };
  // 釋放並合併相鄰 hole
  M.release = (blocks, pid) => {
    let out = blocks.map(b => Object.assign({}, b, { pid: b.pid === pid ? null : b.pid }));
    const merged = [];
    out.forEach(b => { const last = merged[merged.length - 1]; if (last && last.pid == null && b.pid == null) last.size += b.size; else merged.push(b); });
    return merged;
  };
  M.freeTotal = blocks => blocks.filter(b => b.pid == null).reduce((s, b) => s + b.size, 0);
  M.largestHole = blocks => Math.max(0, ...blocks.filter(b => b.pid == null).map(b => b.size));

  /* ---------- Page Replacement ----------
     refs: 數字陣列；nFrames；algo: 'FIFO' | 'LRU' | 'OPT'
     回傳 { steps:[{ i, ref, frames:[...], hit, fault, victim, loadedAt, info }], faults, hits } ---------- */
  M.pageReplace = (refs, nFrames, algo) => {
    const frames = Array(nFrames).fill(null);
    const lastUsed = {}, loadedAt = {};
    let fifoPtr = 0, faults = 0, hits = 0;
    const steps = [];
    refs.forEach((ref, i) => {
      const idx = frames.indexOf(ref);
      let victim = null, victimIdx = null, info = '';
      let hit = idx >= 0;
      if (hit) {
        hits++;
        info = algo === 'LRU' ? `Hit：更新 page ${ref} 的最近使用時間為 t=${i}` : `Hit：page ${ref} 已在 frame ${idx}`;
      } else {
        faults++;
        const empty = frames.indexOf(null);
        if (empty >= 0) { victimIdx = empty; info = `Fault：frame ${empty} 是空的，直接載入 page ${ref}`; }
        else {
          if (algo === 'FIFO') { victimIdx = fifoPtr; fifoPtr = (fifoPtr + 1) % nFrames; victim = frames[victimIdx]; info = `Fault：FIFO 淘汰最早載入的 page ${victim}（t=${loadedAt[victim]} 載入）`; }
          else if (algo === 'LRU') {
            victimIdx = 0;
            frames.forEach((p, k) => { if (lastUsed[p] < lastUsed[frames[victimIdx]]) victimIdx = k; });
            victim = frames[victimIdx];
            info = `Fault：LRU 淘汰最久沒用的 page ${victim}（上次使用 t=${lastUsed[victim]}）`;
          } else {
            // OPT：看未來，淘汰「最久之後才會再用」的；永遠不用者優先，平手取 frame 索引最小
            let best = -1, bestDist = -1;
            const dists = frames.map(p => { const nx = refs.slice(i + 1).indexOf(p); return nx < 0 ? Infinity : nx + 1; });
            dists.forEach((d, k) => { if (d > bestDist) { bestDist = d; best = k; } });
            victimIdx = best; victim = frames[victimIdx];
            info = `Fault：OPT 看未來——${frames.map((p, k) => `page ${p} ${dists[k] === Infinity ? '不會再用' : '在 ' + dists[k] + ' 步後用到'}`).join('、')}，淘汰 page ${victim}`;
          }
        }
        frames[victimIdx] = ref; loadedAt[ref] = i;
      }
      lastUsed[ref] = i;
      steps.push({ i, ref, frames: frames.slice(), hit, fault: !hit, victim, victimIdx: hit ? null : victimIdx, hitIdx: hit ? idx : null, info, lastUsed: Object.assign({}, lastUsed), loadedAt: Object.assign({}, loadedAt), fifoPtr });
    });
    return { steps, faults, hits, algo, nFrames, refs: refs.slice() };
  };

  /* ---------- TLB + Page Table 逐步存取（教學用） ----------
     tlb: [{page, frame}] 有限容量，FIFO 取代 ---------- */
  M.tlbAccess = (page, tlb, pageTable, capacity) => {
    const hitEntry = tlb.find(e => e.page === page);
    if (hitEntry) return { hit: true, frame: hitEntry.frame, tlb: tlb.slice() };
    const frame = pageTable[page];
    const next = tlb.slice(); if (next.length >= capacity) next.shift(); next.push({ page, frame });
    return { hit: false, frame, tlb: next };
  };

  return M;
})();
