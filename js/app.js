/* ============================================================
   App — 路由、側邊欄、主題、Dashboard、章節頁、錯題本、綜合測驗
   ============================================================ */
(function () {
  const $ = s => document.querySelector(s);
  const content = $('#content');

  // ---------- 主題 ----------
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    $('#theme-icon').textContent = t === 'dark' ? '☀' : '☾';
    $('#theme-label').textContent = t === 'dark' ? '淺色模式' : '深色模式';
  }
  function initTheme() {
    let t = Storage.getTheme();
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(t);
    $('#theme-toggle').addEventListener('click', () => { const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; Storage.setTheme(n); applyTheme(n); });
  }

  // ---------- 側邊欄 ----------
  function openSidebar(o) { $('#sidebar').classList.toggle('open', o); $('#overlay').classList.toggle('show', o); }
  function initSidebar() {
    $('#menu-btn').addEventListener('click', () => openSidebar(true));
    $('#sidebar-close').addEventListener('click', () => openSidebar(false));
    $('#overlay').addEventListener('click', () => openSidebar(false));
    $('#sidebar-nav').addEventListener('click', e => { if (e.target.closest('a') && window.innerWidth <= 960) openSidebar(false); });
  }
  function renderNav() {
    $('#nav-chapters').innerHTML = CONTENT.chapters.map(ch => {
      const p = Storage.chapterProgress(ch.id);
      const right = p.total && p.done === p.total ? '<span class="nav-done">✓</span>' : (p.done ? `<span class="nav-part">${p.done}/${p.total}</span>` : '');
      return `<a class="nav-item" href="#/ch/${ch.id}" data-route="ch:${ch.id}"><span class="nav-num">${ch.num}</span><span>${ch.title}</span>${right}</a>`;
    }).join('');
    const o = Storage.overallProgress();
    $('#sidebar-progress-pct').textContent = o.pct + '%'; $('#sidebar-progress-fill').style.width = o.pct + '%';
    const wc = Storage.activeWrongCount(); $('#nav-wrong-count').textContent = wc ? wc : '';
  }
  function setActive(route) { document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.route === route)); }
  function setCrumb(t) { $('#topbar-crumb').textContent = t; document.title = t + '｜OS Review'; }
  function setChapterBar(pct) { const bar = $('#chapter-progress'); if (pct == null) { bar.hidden = true; return; } bar.hidden = false; $('#chapter-progress-fill').style.width = pct + '%'; }
  const ui = { setCrumb, setActive, setChapterBar, renderNav };

  // ---------- 路由 ----------
  let observer = null;
  function route() {
    if (observer) { observer.disconnect(); observer = null; }
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    if (!parts.length) return renderDashboard();
    if (parts[0] === 'ch' && parts[1]) return renderChapter(parts[1], parts[2]);
    if (parts[0] === 'interview') return Interview.render(content, ui);
    if (parts[0] === 'trace') return Trace.render(content, ui, parts[1]);
    if (parts[0] === 'wrong') return renderWrong();
    if (parts[0] === 'quiz') return renderQuiz();
    if (parts[0] === 'sim' && parts[1]) return renderSim(parts[1]);
    renderDashboard();
  }

  // ---------- Dashboard ----------
  function asciiBar(pct) { const n = Math.round(pct / 10); return '█'.repeat(n) + '░'.repeat(10 - n); }
  function renderDashboard() {
    setActive('dashboard'); setCrumb('Dashboard'); setChapterBar(null);
    const o = Storage.overallProgress(), td = Storage.todayStats(), all = Storage.overallStats();
    const done = Storage.completedChapters(), wrong = Storage.activeWrongCount(), weak = Storage.weakestTopics(3), weakC = Storage.weakConcepts(3);
    const last = Storage.getLast(); const nx = nextChapter();
    const cont = last && CONTENT.chapters.find(c => c.id === last.chId) ? { href: `#/ch/${last.chId}${last.conceptId ? '/' + last.conceptId : ''}`, title: last.title } : { href: `#/ch/${nx.id}`, title: `Chapter ${nx.num} · ${nx.title}` };
    const traceDone = Object.keys(Storage.getTrace()).length;
    content.innerHTML = `
      <div class="page-header"><h1>Operating Systems Review</h1><p class="subtitle">作業系統互動複習 —— 為什麼需要它 → 直覺情境 → OS 怎麼做 → 看見內部狀態 → 定義 → 程式碼 → Trace → 題目</p></div>
      <div class="continue-card"><div><div class="cc-lbl">Continue Learning</div><div class="cc-title">${cont.title}</div></div><a class="btn btn-primary" href="${cont.href}">▶ 回到上次位置</a></div>
      <div class="card"><div class="card-title">Overall Progress</div><div class="overall-progress"><div class="pct-row"><span class="ascii-bar">${asciiBar(o.pct)} ${o.pct}%</span><span style="color:var(--text-3);font-size:.85rem">${o.done} / ${o.total} 個概念</span></div><div class="progress-bar lg"><div class="progress-fill" style="width:${o.pct}%"></div></div></div></div>
      <div class="stat-grid">
        <div class="stat-tile"><div class="stat-label">Chapters Completed</div><div class="stat-value">${done.length}<span style="font-size:1rem;color:var(--text-3)"> / ${CONTENT.chapters.length}</span></div></div>
        <div class="stat-tile"><div class="stat-label">Questions Answered</div><div class="stat-value">${all.count}</div><div class="stat-sub">今日 ${td.count} 題</div></div>
        <div class="stat-tile"><div class="stat-label">Accuracy</div><div class="stat-value">${all.acc == null ? '—' : all.acc + '%'}</div><div class="stat-sub">${td.acc != null ? '今日 ' + td.acc + '%' : '尚未作答'}</div></div>
        <div class="stat-tile"><div class="stat-label">Wrong Answers（未掌握）</div><div class="stat-value" style="color:${wrong ? 'var(--danger)' : 'inherit'}">${wrong}</div><div class="stat-sub"><a href="#/wrong">前往錯題本 →</a></div></div>
        <div class="stat-tile"><div class="stat-label">Trace 完成</div><div class="stat-value">${traceDone}<span style="font-size:1rem;color:var(--text-3)"> / ${TRACES.length}</span></div><div class="stat-sub"><a href="#/trace">OS Trace Mode →</a></div></div>
      </div>
      <div class="btn-row" style="margin:4px 0 8px"><a href="#/trace" class="btn btn-primary">⧉ OS Trace Mode</a><a href="#/interview" class="btn">🎓 OS Interview Mode</a><a href="#/quiz" class="btn">✓ 綜合測驗</a></div>

      <div class="section-title"><h3>核心主題熟練度</h3><span style="font-size:.75rem;color:var(--text-3)">概念完成度 50% ＋ 最近 20 題正確率 50%</span></div>
      <div class="topic-grid">${Storage.TOPICS.map(t => { const m = Storage.topicMastery(t.id); const chs = CONTENT.chapters.filter(c => c.topic === t.id); return `<a class="topic-tile" href="#/ch/${chs[0] ? chs[0].id : ''}" style="color:inherit;text-decoration:none"><div class="tt-name">${t.name}</div><div class="progress-bar"><div class="progress-fill" style="width:${m.pct}%;background:${m.pct >= 70 ? 'var(--success)' : m.pct >= 40 ? 'var(--warn)' : 'var(--accent)'}"></div></div><div class="tt-meta"><span>熟練度 ${m.pct}%</span><span>概念 ${m.done}/${m.total} · ${m.acc == null ? '未作答' : '正確率 ' + m.acc + '%'}</span></div></a>`; }).join('')}</div>

      <div class="section-title"><h3>Weakest Topics</h3></div>
      <div class="card">
        <ul class="review-list">${weak.map(w => `<li><span>${w.name}</span><span class="tag">熟練度 ${w.pct}%${w.acc != null ? ' · 正確率 ' + w.acc + '%' : ''}</span></li>`).join('')}</ul>
        ${weakC.length ? `<div class="card-title" style="margin-top:12px">最常錯的概念</div><ul class="review-list">${weakC.map(w => `<li><span><a href="#/ch/${w.chapter}/${w.conceptId}">${w.concept}</a> <span class="tag">${w.chapterTitle}</span></span><span class="tag">錯 ${w.score} 次 · ${w.items} 題未掌握</span></li>`).join('')}</ul>` : ''}
      </div>

      <div class="section-title"><h3>章節</h3></div>
      <div class="chapter-list">${CONTENT.chapters.map(ch => { const p = Storage.chapterProgress(ch.id); return `<a class="chapter-card" href="#/ch/${ch.id}"><div class="ch-num">Chapter ${ch.num}</div><div class="ch-title">${ch.title}</div><div class="progress-bar"><div class="progress-fill" style="width:${p.pct}%"></div></div><div class="ch-meta"><span>${ch.concepts.length} 個概念</span><span>${p.pct === 100 ? '✓ 完成' : p.pct + '%'}</span></div></a>`; }).join('')}</div>
      <div class="progress-backup card">
        <h3>學習進度備份</h3>
        <p>進度只保存在目前瀏覽器。匯出 JSON 檔後，可以在其他瀏覽器匯入；匯入會覆蓋目前的學習進度，但不會改變深淺色主題。</p>
        <div class="btn-row">
          <button class="btn" id="export-btn" type="button">匯出進度</button>
          <button class="btn" id="import-btn" type="button">匯入進度</button>
          <button class="btn btn-ghost" id="reset-btn" type="button">重設所有進度</button>
        </div>
        <input id="import-file" type="file" accept=".json,application/json" hidden>
        <p class="backup-status" id="backup-status" role="status" aria-live="polite" aria-atomic="true"></p>
      </div>`;
    const setBackupStatus = (message, kind = '') => {
      const status = $('#backup-status');
      status.className = 'backup-status' + (kind ? ' ' + kind : '');
      status.textContent = message;
    };
    $('#export-btn').addEventListener('click', () => {
      try {
        const blob = new Blob([JSON.stringify(Storage.exportProgress(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'os-review-progress-' + new Date().toLocaleDateString('sv-SE') + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setBackupStatus('已建立進度備份檔。', 'success');
      } catch (e) { setBackupStatus('匯出失敗：' + e.message, 'error'); }
    });
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const isJson = file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
      if (!isJson) { setBackupStatus('請選擇 JSON 格式的進度備份檔。', 'error'); return; }
      if (file.size > 10 * 1024 * 1024) { setBackupStatus('檔案超過 10 MB，無法匯入。', 'error'); return; }
      try {
        const backup = JSON.parse(await file.text());
        Storage.validateProgress(backup);
        if (!confirm('匯入會覆蓋目前的概念進度、答題紀錄、錯題本、面試、閱讀位置與 Trace 紀錄。確定要繼續嗎？')) {
          setBackupStatus('已取消匯入，目前進度沒有改變。');
          return;
        }
        Storage.importProgress(backup);
        renderNav(); renderDashboard();
        setBackupStatus('匯入完成，頁面已更新。', 'success');
      } catch (err) { setBackupStatus('匯入失敗：' + err.message, 'error'); }
    });
    $('#reset-btn').addEventListener('click', () => { if (confirm('確定要清除所有學習進度、答題紀錄、錯題本、面試與 Trace 紀錄嗎？')) { Storage.resetAll(); renderNav(); renderDashboard(); } });
  }
  function nextChapter() { return CONTENT.chapters.find(ch => Storage.chapterProgress(ch.id).pct < 100) || CONTENT.chapters[0]; }

  // ---------- 章節頁 ----------
  function renderChapter(chId, conceptId) {
    const ch = CONTENT.chapters.find(c => c.id === chId);
    if (!ch) return renderDashboard();
    const idx = CONTENT.chapters.indexOf(ch);
    setActive('ch:' + ch.id); setCrumb(`Chapter ${ch.num} · ${ch.title}`);
    const p = Storage.chapterProgress(ch.id); setChapterBar(p.pct);
    content.innerHTML = `
      <div class="chapter-header">
        <div class="ch-label">CHAPTER ${ch.num}${ch.topic ? ' · ' + (Storage.TOPICS.find(t => t.id === ch.topic) || { name: ch.topic }).name : ''}</div>
        <h1>${ch.title}</h1>
        ${ch.subtitle ? `<p class="subtitle" style="color:var(--text-2);margin-top:6px">${ch.subtitle}</p>` : ''}
        <div class="callout why"><div class="callout-title">這章在回答什麼問題？</div>${ch.why}</div>
        <ul class="concept-toc">${ch.concepts.map(c => `<li><a href="#/ch/${ch.id}/${c.id}" class="${Storage.isConceptDone(ch.id, c.id) ? 'done' : ''}">${c.title}</a></li>`).join('')}</ul>
      </div>
      <div id="concepts"></div>
      <div class="chapter-nav">
        ${idx > 0 ? `<a class="btn" href="#/ch/${CONTENT.chapters[idx - 1].id}"><span><span class="nav-lbl">上一章</span>← ${CONTENT.chapters[idx - 1].title}</span></a>` : '<span style="flex:1"></span>'}
        ${idx < CONTENT.chapters.length - 1 ? `<a class="btn" href="#/ch/${CONTENT.chapters[idx + 1].id}" style="text-align:right"><span><span class="nav-lbl">下一章</span>${CONTENT.chapters[idx + 1].title} →</span></a>` : '<span style="flex:1"></span>'}
      </div>`;
    const wrap = $('#concepts');
    ch.concepts.forEach((c, i) => wrap.appendChild(renderConcept(ch, c, i)));
    Quiz.renderMath($('.chapter-header'));
    Storage.setLast(ch.id, conceptId || ch.concepts[0].id, `Chapter ${ch.num} · ${ch.title}`);
    // 捲動時更新「上次學習位置」
    observer = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { const cid = e.target.id.replace(/^c-/, ''); const c = ch.concepts.find(x => x.id === cid); if (c) Storage.setLast(ch.id, cid, `Chapter ${ch.num} · ${c.title}`); } }); }, { rootMargin: '-40% 0px -50% 0px' });
    wrap.querySelectorAll('.concept').forEach(s => observer.observe(s));
    if (conceptId && !location.search.includes('noscroll')) { const target = document.getElementById('c-' + conceptId); if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 50); }
  }

  function block(step, label, inner, cls = '') { return `<div class="block ${cls}"><div class="block-label"><span class="step">${step}</span>${label}</div>${inner}</div>`; }
  function renderConcept(ch, c, i) {
    const sec = document.createElement('section'); sec.className = 'concept'; sec.id = 'c-' + c.id;
    const done = Storage.isConceptDone(ch.id, c.id);
    let n = 0; const nb = (label, inner, cls) => block(++n, label, inner, cls);
    let html = `<div class="concept-head"><h2><span class="concept-idx">${ch.num}.${i + 1}</span>${c.title}</h2>${done ? '<span class="done-chip">✓ 已完成</span>' : ''}</div>`;
    if (c.en) html += `<div class="one-liner" style="margin-bottom:16px;font-size:1rem">${c.en}</div>`;
    if (c.why) html += nb('為什麼需要它？', `<div>${c.why}</div>`);
    if (c.scenario) html += nb('直覺情境', `<div>${c.scenario}</div>`);
    if (c.how) html += nb('OS 如何處理', `<div>${c.how}</div>`);
    if (c.sim) html += nb('內部狀態視覺化', `<div class="sim-slot" data-sim="${c.sim}"></div>`);
    if (c.definition) html += nb('正式定義', `<div>${c.definition}</div>`);
    if (c.code) html += nb('演算法 / 程式碼', typeof c.code === 'string' ? c.code : Util.code(c.code));
    if (c.traceSim || c.trace) html += nb('Step-by-step Trace', `${c.trace ? `<div>${c.trace}</div>` : ''}${c.traceSim ? `<div class="sim-slot" data-sim="${c.traceSim}"></div>` : ''}`);
    if (c.extra) html += `<div class="block">${c.extra}</div>`;
    html += nb('題目', `<div class="cp-slot"></div>`);
    html += `<div class="concept-footer"><span style="font-size:.85rem;color:var(--text-3)">讀完、玩過模擬、做完題目後，把這個概念標記為完成。</span><button class="btn ${done ? 'btn-success' : ''} mark-btn">${done ? '✓ 已完成（點擊取消）' : '標記為已完成'}</button></div>`;
    sec.innerHTML = html;
    sec.querySelectorAll('.sim-slot').forEach(slot => {
      const name = slot.dataset.sim; if (!name) return;
      const fn = Sims[name];
      if (fn) { try { fn(slot, c); } catch (e) { console.error('sim error', name, e); slot.innerHTML = `<div class="callout warn">互動模擬載入失敗：${name}（${e.message}）</div>`; } }
      else slot.innerHTML = `<div class="callout info">（互動模擬「${name}」尚未實作）</div>`;
    });
    const cpSlot = sec.querySelector('.cp-slot');
    const qs = (c.checkpoint || []).map(q => Object.assign({}, q, { chapterId: ch.id, chapterTitle: ch.title, topic: ch.topic, concept: q.concept || c.id, conceptName: q.conceptName || c.title }));
    if (qs.length) cpSlot.appendChild(Quiz.renderCheckpoint(qs, `Checkpoint · ${c.title}`)); else cpSlot.innerHTML = '<div class="empty">此概念沒有練習題。</div>';
    sec.querySelector('.mark-btn').addEventListener('click', () => {
      const now = !Storage.isConceptDone(ch.id, c.id);
      Storage.setConceptDone(ch.id, c.id, now); renderNav(); setChapterBar(Storage.chapterProgress(ch.id).pct);
      const btn = sec.querySelector('.mark-btn'); btn.className = 'btn mark-btn ' + (now ? 'btn-success' : ''); btn.textContent = now ? '✓ 已完成（點擊取消）' : '標記為已完成';
      const head = sec.querySelector('.concept-head'); let chip = head.querySelector('.done-chip');
      if (now && !chip) head.insertAdjacentHTML('beforeend', '<span class="done-chip">✓ 已完成</span>'); else if (!now && chip) chip.remove();
      document.querySelectorAll('.concept-toc a').forEach(a => { if (a.getAttribute('href').endsWith('/' + c.id)) a.classList.toggle('done', now); });
    });
    Quiz.renderMath(sec);
    return sec;
  }

  // ---------- 錯題本 ----------
  function renderWrong(tab = 'active') {
    setActive('wrong'); setCrumb('錯題本'); setChapterBar(null);
    const list = Storage.wrongList(); const active = list.filter(w => !w.mastered), mastered = list.filter(w => w.mastered);
    const shown = tab === 'active' ? active : mastered;
    content.innerHTML = `
      <div class="page-header"><h1>錯題本</h1><p class="subtitle">答錯的題目會自動收進來。之後答對不會立刻移除——需要<b>連續答對兩次</b>才會標記為「已掌握」。</p></div>
      <div class="tabs"><button class="tab ${tab === 'active' ? 'active' : ''}" data-tab="active">未掌握（${active.length}）</button><button class="tab ${tab === 'mastered' ? 'active' : ''}" data-tab="mastered">已掌握（${mastered.length}）</button></div>
      <div id="wrong-list">${shown.length ? '' : `<div class="empty">${tab === 'active' ? '目前沒有未掌握的錯題 🎉' : '還沒有已掌握的題目。'}</div>`}</div>`;
    content.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => renderWrong(b.dataset.tab)));
    const wrap = $('#wrong-list');
    shown.forEach(w => {
      const el = document.createElement('div'); el.className = 'wrong-item' + (w.mastered ? ' mastered' : '');
      el.innerHTML = `
        <div class="wrong-meta"><span class="pill">${w.chapterTitle || w.chapter}</span><span class="pill">${w.concept}</span><span class="pill">${Quiz.TYPES[w.type] || w.type || ''}</span><span class="pill w">錯 ${w.wrongCount} 次</span><span class="pill ${w.mastered ? 'm' : ''}">${w.mastered ? '已掌握' : '連續答對 ' + (w.streak || 0) + '/2'}</span></div>
        <div class="wrong-q">${w.question}</div>
        <div class="wrong-row"><span class="lbl">我的答案</span><span style="color:var(--danger)">${Util.esc(w.myAnswer)}</span></div>
        <div class="wrong-row"><span class="lbl">正確答案</span><span style="color:var(--success)">${Util.esc(w.correctAnswer)}</span></div>
        <div class="wrong-row"><span class="lbl">解釋</span><span>${w.explanation}</span></div>
        <div class="btn-row"><button class="btn btn-sm retry-btn">重新作答</button><a class="btn btn-sm btn-ghost" href="#/ch/${w.chapter}/${w.conceptId}">回到概念</a><button class="btn btn-sm btn-ghost del-btn">移除</button></div>
        <div class="retry-slot"></div>`;
      el.querySelector('.retry-btn').addEventListener('click', () => {
        const q = Quiz.findQuestion(w.qid); const slot = el.querySelector('.retry-slot'); slot.innerHTML = '';
        if (!q) { slot.innerHTML = '<div class="empty">找不到原題目。</div>'; return; }
        const box = document.createElement('div'); box.className = 'checkpoint'; box.style.marginTop = '10px';
        box.appendChild(Quiz.renderQuestion(q, { retry: false, onAnswer: () => setTimeout(() => renderWrong(tab), 900) })); slot.appendChild(box);
      });
      el.querySelector('.del-btn').addEventListener('click', () => { Storage.removeWrong(w.qid); renderNav(); renderWrong(tab); });
      wrap.appendChild(el);
    });
    Quiz.renderMath(content);
  }

  // ---------- 綜合測驗 ----------
  function renderQuiz() {
    setActive('quiz'); setCrumb('綜合測驗'); setChapterBar(null);
    content.innerHTML = `
      <div class="page-header"><h1>綜合測驗</h1><p class="subtitle">從所有章節隨機抽題，混合 Concept / Trace / Calculation / Scenario / Code 五種題型。</p></div>
      <div class="card"><div class="sim-controls">
          <label>章節 <select id="qz-ch"><option value="all">全部章節</option>${CONTENT.chapters.map(c => `<option value="${c.id}">Ch${c.num} ${c.title}</option>`).join('')}</select></label>
          <label>題型 <select id="qz-type"><option value="all">全部</option>${Object.entries(Quiz.TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label>題數 <select id="qz-n"><option>5</option><option selected>10</option><option>15</option><option>20</option></select></label>
          <button class="btn btn-primary" id="qz-start">開始</button></div></div>
      <div id="qz-area"></div>`;
    $('#qz-start').addEventListener('click', () => {
      const chv = $('#qz-ch').value, tv = $('#qz-type').value, n = +$('#qz-n').value;
      let pool = Quiz.allQuestions().filter(q => (chv === 'all' || q.chapterId === chv) && (tv === 'all' || q.type === tv));
      pool = Util.shuffle(pool).slice(0, n);
      const area = $('#qz-area'); area.innerHTML = '';
      if (!pool.length) { area.innerHTML = '<div class="empty">此條件下沒有題目。</div>'; return; }
      let answered = 0, correct = 0;
      const summary = document.createElement('div'); summary.className = 'card'; summary.innerHTML = `<div class="card-title">本次成績</div><div id="qz-score">0 / ${pool.length}</div>`;
      area.appendChild(Quiz.renderCheckpoint(pool, '綜合測驗', { showConcept: true, retry: false, onAnswer: ok => { answered++; if (ok) correct++; $('#qz-score').innerHTML = `答對 <b>${correct}</b> / 已作答 ${answered} / 共 ${pool.length} 題${answered === pool.length ? `　·　正確率 <b>${Math.round(correct / pool.length * 100)}%</b>` : ''}`; } }));
      area.appendChild(summary);
      window.scrollTo({ top: area.offsetTop - 80, behavior: 'smooth' });
    });
  }

  // ---------- 單一互動模擬 ----------
  function renderSim(name) {
    setActive(''); setCrumb('互動模擬 · ' + name); setChapterBar(null);
    content.innerHTML = '<div class="page-header"><h1>' + name + '</h1></div><div id="sim-only"></div>';
    const fn = Sims[name];
    if (fn) fn($('#sim-only'), {}); else $('#sim-only').innerHTML = '<div class="empty">找不到模擬：' + name + '</div>';
  }

  document.addEventListener('os:answered', renderNav);
  window.addEventListener('hashchange', route);
  initTheme(); initSidebar(); renderNav(); route();
})();
