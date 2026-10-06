/* ============================================================
   Disk — 磁碟排程純引擎（FCFS / SSTF / SCAN / C-SCAN / LOOK / C-LOOK）
   run(requests, head, algo, { cylinders, dir }) → { order:[..], path:[..含起點與邊界..], total, segments:[{from,to,dist,note}] }
   ============================================================ */
window.Disk = (function () {
  const D = {};
  D.ALGOS = { FCFS: 'FCFS', SSTF: 'SSTF（最短尋道優先）', SCAN: 'SCAN（電梯）', CSCAN: 'C-SCAN', LOOK: 'LOOK', CLOOK: 'C-LOOK' };
  D.run = (requests, head, algo, opts = {}) => {
    const maxCyl = (opts.cylinders || 200) - 1, dir = opts.dir || 'up';
    const segs = []; let cur = head, total = 0; const order = [];
    const go = (to, note, isReq = true) => { const d = Math.abs(to - cur); segs.push({ from: cur, to, dist: d, note: note || '' }); total += d; cur = to; if (isReq) order.push(to); };
    let pending = requests.slice();
    if (algo === 'FCFS') pending.forEach(r => go(r, '依到達順序'));
    else if (algo === 'SSTF') {
      while (pending.length) { let best = pending.reduce((a, r) => Math.abs(r - cur) < Math.abs(a - cur) ? r : a); pending = pending.filter(r => r !== best); go(best, `離目前磁頭最近（距離 ${Math.abs(best - cur)}）`); }
    } else {
      const up = pending.filter(r => r >= head).sort((a, b) => a - b), down = pending.filter(r => r < head).sort((a, b) => b - a);
      if (algo === 'SCAN') {
        if (dir === 'up') { up.forEach(r => go(r)); if (up.length || down.length) { if (cur !== maxCyl) go(maxCyl, '走到最尾端才回頭', false); } down.forEach(r => go(r)); }
        else { down.forEach(r => go(r)); if (cur !== 0) go(0, '走到 0 才回頭', false); up.forEach(r => go(r)); }
      } else if (algo === 'CSCAN') {
        if (dir === 'up') { up.forEach(r => go(r)); if (down.length) { if (cur !== maxCyl) go(maxCyl, '走到尾端', false); go(0, '跳回 0（這段通常也算移動）', false); down.reverse().forEach(r => go(r)); } }
        else { down.forEach(r => go(r)); if (up.length) { if (cur !== 0) go(0, '走到 0', false); go(maxCyl, '跳回尾端', false); up.reverse().forEach(r => go(r)); } }
      } else if (algo === 'LOOK') {
        if (dir === 'up') { up.forEach(r => go(r)); down.forEach(r => go(r, segs.length && r === down[0] ? '到最後一個請求就回頭' : '')); }
        else { down.forEach(r => go(r)); up.forEach(r => go(r)); }
      } else if (algo === 'CLOOK') {
        if (dir === 'up') { up.forEach(r => go(r)); down.reverse().forEach((r, k) => go(r, k === 0 ? '跳到另一端最遠的請求' : '')); }
        else { down.forEach(r => go(r)); up.reverse().forEach((r, k) => go(r, k === 0 ? '跳到另一端最遠的請求' : '')); }
      }
    }
    return { order, total, segments: segs, path: [head].concat(segs.map(s => s.to)) };
  };
  return D;
})();
