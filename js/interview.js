/* ============================================================
   Interview — OS Interview Mode
   隨機抽題 → 只顯示問題 → 提示 / 30 秒回答 / 60 秒完整回答 / 下一題
   ============================================================ */
window.Interview = (function () {
  const I = {};
  let filter = 'all', pool = [], cur = null, timerId = null, seconds = 0;
  function buildPool() { pool = Util.shuffle(INTERVIEW_QUESTIONS.filter(q => filter === 'all' || q.tag === filter)); }
  function next() { if (!pool.length) buildPool(); cur = pool.pop(); if (cur) Storage.markInterviewSeen(cur.id); }
  function stopTimer() { clearInterval(timerId); timerId = null; }

  I.render = (content, ui) => {
    ui.setActive('interview'); ui.setCrumb('🎓 OS Interview Mode'); ui.setChapterBar(null);
    stopTimer();
    const tags = [...new Set(INTERVIEW_QUESTIONS.map(q => q.tag))];
    content.innerHTML = `
      <div class="page-header"><h1>🎓 OS Interview Mode</h1><p class="subtitle">隨機抽一題，先<b>用自己的話大聲說出來</b>，再看參考答案對照。目標：30 秒能講重點，60 秒能講完整、舉例、說出常見追問。</p></div>
      <div class="chip-row" id="iv-chips"><button class="chip ${filter === 'all' ? 'active' : ''}" data-tag="all">全部（${INTERVIEW_QUESTIONS.length}）</button>${tags.map(t => `<button class="chip ${filter === t ? 'active' : ''}" data-tag="${t}">${t}（${INTERVIEW_QUESTIONS.filter(q => q.tag === t).length}）</button>`).join('')}</div>
      <div class="interview-card" id="iv-card"></div>
      <div class="callout info" style="margin-top:20px"><div class="callout-title">口頭回答的結構</div><ul style="margin-bottom:0"><li><b>一句話定義</b> → <b>為什麼需要它</b>（解決什麼問題）→ <b>一個具體例子</b>或內部機制 → <b>常見誤解 / 取捨</b>。</li><li>能畫圖就畫：Gantt chart、state diagram、page table。面試官在看你能不能「看見」OS 內部。</li><li>被追問不確定時：「我理解的機制是……，細節我需要再確認」比硬掰好。</li></ul></div>`;
    content.querySelectorAll('#iv-chips .chip').forEach(b => b.addEventListener('click', () => { filter = b.dataset.tag; pool = []; I.render(content, ui); }));
    next(); drawCard();
  };

  function drawCard() {
    const card = document.getElementById('iv-card');
    if (!cur) { card.innerHTML = '<div class="empty">沒有題目。</div>'; return; }
    seconds = 0;
    card.innerHTML = `
      <div class="interview-tag">${cur.tag}</div><div class="interview-q">${cur.q}</div><div class="timer" id="iv-timer">00:00</div>
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-sm" id="iv-timer-btn">▶ 開始計時</button><button class="btn btn-sm" id="iv-hint">提示</button>
        <button class="btn btn-sm" id="iv-a30">30 秒回答</button><button class="btn btn-sm" id="iv-a60">60 秒完整回答</button>
        <button class="btn btn-sm btn-primary" id="iv-next">下一題 →</button></div>
      <div class="interview-panel" id="iv-panel"></div>`;
    const panel = document.getElementById('iv-panel');
    document.getElementById('iv-timer-btn').addEventListener('click', e => {
      if (timerId) { stopTimer(); e.target.textContent = '▶ 繼續計時'; return; }
      e.target.textContent = '⏸ 暫停';
      timerId = setInterval(() => { seconds++; const t = document.getElementById('iv-timer'); if (!t) { stopTimer(); return; } t.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); t.style.color = seconds > 60 ? 'var(--danger)' : seconds > 30 ? 'var(--warn)' : 'var(--text-2)'; }, 1000);
    });
    document.getElementById('iv-hint').addEventListener('click', () => { if (panel.querySelector('.hint')) return; panel.insertAdjacentHTML('afterbegin', `<div class="q-panel hint"><b>提示：</b>${cur.hint}</div>`); Quiz.renderMath(panel); });
    const show = (k, title, body) => { if (panel.querySelector('.av-' + k)) return; stopTimer(); panel.insertAdjacentHTML('beforeend', `<div class="answer-version av-${k}"><div class="av-title">${title}</div>${body}</div>`); Quiz.renderMath(panel); };
    document.getElementById('iv-a30').addEventListener('click', () => show('30', '⏱ 30 秒回答', cur.a30));
    document.getElementById('iv-a60').addEventListener('click', () => { show('60', '⏱ 60 秒完整回答', cur.a60 + (cur.followup ? `<div class="callout warn" style="margin-bottom:0"><div class="callout-title">可能的追問</div>${cur.followup}</div>` : '') + (cur.link ? `<div style="font-size:.85rem;margin-top:8px"><a href="${cur.link}">→ 回到相關章節複習</a></div>` : '')); });
    document.getElementById('iv-next').addEventListener('click', () => { stopTimer(); next(); drawCard(); });
  }
  return I;
})();
