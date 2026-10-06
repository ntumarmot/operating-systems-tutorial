/* ============================================================
   Trace — OS Trace Mode
   給一個情境 + 一個事件 → 先預測「接下來會怎樣」→ 答完才播放動畫
   題目資料在 js/content/trace.js（TRACES）
   ============================================================ */
window.Trace = (function () {
  const T = {};
  T.render = (content, ui, id) => {
    ui.setActive('trace'); ui.setCrumb('⧉ OS Trace Mode'); ui.setChapterBar(null);
    const t = id && TRACES.find(x => x.id === id);
    if (!t) return renderList(content);
    renderOne(content, t);
  };

  function renderList(content) {
    const rec = Storage.getTrace();
    const tags = [...new Set(TRACES.map(t => t.tag))];
    content.innerHTML = `
      <div class="page-header"><h1>⧉ OS Trace Mode</h1><p class="subtitle">每題給你一個「OS 此刻的內部狀態」和一個事件。<b>先預測</b>接下來會發生什麼，答完才會播放動畫驗證。這是面試裡最常被問的形式：「如果現在發生 X，OS 會怎麼做？」</p></div>
      <div class="btn-row" style="margin-bottom:16px"><button class="btn btn-primary" id="tr-random">🎲 隨機抽一題</button></div>
      ${tags.map(tag => `<div class="section-title"><h3>${tag}</h3></div><div class="trace-list">${TRACES.filter(t => t.tag === tag).map(t => { const r = rec[t.id]; return `<a class="trace-card" href="#/trace/${t.id}"><div class="tc-tag">${t.tag}</div><div class="tc-title">${t.title}</div>${r ? `<div class="tc-done">${r.correct ? '✓ 答對 ' + r.correct + ' 次' : ''}${r.tries > r.correct ? (r.correct ? ' · ' : '') + '答錯 ' + (r.tries - r.correct) + ' 次' : ''}</div>` : '<div class="tc-tag">尚未挑戰</div>'}</a>`; }).join('')}</div>`).join('')}`;
    document.getElementById('tr-random').addEventListener('click', () => { const t = Util.shuffle(TRACES)[0]; location.hash = '#/trace/' + t.id; });
  }

  function renderOne(content, t) {
    const idx = TRACES.indexOf(t); const nextT = TRACES[(idx + 1) % TRACES.length];
    content.innerHTML = `
      <div class="page-header"><div class="ch-label" style="font-family:var(--mono);font-size:.8rem;color:var(--accent-text)">TRACE · ${t.tag}</div><h1>${t.title}</h1></div>
      <div class="trace-scene"><div class="tag">目前狀態</div><div style="margin-top:6px">${t.scene}</div><div class="tag" style="margin-top:12px">然後發生</div><div><span class="event">⚡ ${t.event}</span></div></div>
      <div class="card"><div class="card-title">預測</div><div style="font-weight:600;margin-bottom:10px">${t.q}</div><div class="q-options" id="tr-opts">${t.options.map((o, i) => `<button class="q-option" data-i="${i}"><span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${o}</span></button>`).join('')}</div><div id="tr-res"></div></div>
      <div id="tr-anim"></div>
      <div class="btn-row" style="margin-top:20px"><a class="btn" href="#/trace">← 回到列表</a><a class="btn btn-primary" href="#/trace/${nextT.id}">下一題：${nextT.title} →</a>${t.link ? `<a class="btn btn-ghost" href="${t.link}">回到相關章節</a>` : ''}</div>`;
    Quiz.renderMath(content);
    let done = false;
    content.querySelectorAll('#tr-opts .q-option').forEach(b => b.addEventListener('click', () => {
      if (done) return; done = true;
      const i = +b.dataset.i, ok = i === t.answer;
      content.querySelectorAll('#tr-opts .q-option').forEach((x, k) => { x.disabled = true; if (k === t.answer) x.classList.add('correct'); else if (k === i) x.classList.add('wrong'); });
      Storage.recordTrace(t.id, ok);
      document.getElementById('tr-res').innerHTML = `<div class="q-panel ${ok ? 'answer' : 'explain'}"><b style="color:${ok ? 'var(--success)' : 'var(--danger)'}">${ok ? '✓ 預測正確' : '✗ 不是這樣'}</b>　${t.explanation}</div>`;
      const anim = document.getElementById('tr-anim');
      anim.innerHTML = '<div class="section-title"><h3>播放動畫：實際發生的事</h3></div>';
      if (t.anim) { const fn = Sims[t.anim.sim]; if (fn) { try { fn(anim, { simOpts: t.anim.simOpts || {} }); } catch (e) { console.error(e); anim.innerHTML += `<div class="callout warn">動畫載入失敗：${e.message}</div>`; } } }
      if (t.after) anim.insertAdjacentHTML('beforeend', `<div class="callout success"><div class="callout-title">結論</div>${t.after}</div>`);
      Quiz.renderMath(anim);
      setTimeout(() => anim.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }));
  }
  return T;
})();
