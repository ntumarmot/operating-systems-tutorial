/* ============================================================
   Storage — localStorage 封裝
   保存：已完成概念/章節、答題紀錄、錯題本、上次學習位置、Trace 完成紀錄、主題
   ============================================================ */
window.Storage = (function () {
  const KEYS = {
    progress: 'os_progress',
    answers: 'os_answers',
    wrong: 'os_wrong',
    theme: 'os_theme',
    interview: 'os_interview',
    last: 'os_last',
    trace: 'os_trace'
  };

  function get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 無視配額錯誤 */ }
  }
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const St = {};

  // ---- 主題定義（Dashboard 熟練度用）----
  St.TOPICS = [
    { id: 'process', name: 'Process & Thread' },
    { id: 'sched', name: 'CPU Scheduling' },
    { id: 'sync', name: 'Synchronization' },
    { id: 'deadlock', name: 'Deadlock' },
    { id: 'memory', name: 'Memory' },
    { id: 'vm', name: 'Virtual Memory' }
  ];

  // ---- 進度 ----
  St.getProgress = () => get(KEYS.progress, { concepts: {}, chapters: {} });
  St.isConceptDone = (chId, cId) => !!St.getProgress().concepts[chId + '/' + cId];
  St.setConceptDone = (chId, cId, done = true) => {
    const p = St.getProgress();
    if (done) p.concepts[chId + '/' + cId] = Date.now(); else delete p.concepts[chId + '/' + cId];
    const ch = CONTENT.chapters.find(c => c.id === chId);
    if (ch) {
      const all = ch.concepts.every(c => p.concepts[chId + '/' + c.id]);
      if (all) p.chapters[chId] = Date.now(); else delete p.chapters[chId];
    }
    set(KEYS.progress, p);
  };
  St.chapterProgress = chId => {
    const ch = CONTENT.chapters.find(c => c.id === chId);
    if (!ch || !ch.concepts.length) return { done: 0, total: 0, pct: 0 };
    const p = St.getProgress();
    const done = ch.concepts.filter(c => p.concepts[chId + '/' + c.id]).length;
    return { done, total: ch.concepts.length, pct: Math.round(done / ch.concepts.length * 100) };
  };
  St.overallProgress = () => {
    let done = 0, total = 0;
    CONTENT.chapters.forEach(ch => { const r = St.chapterProgress(ch.id); done += r.done; total += r.total; });
    return { done, total, pct: total ? Math.round(done / total * 100) : 0 };
  };
  St.completedChapters = () => { const p = St.getProgress(); return CONTENT.chapters.filter(ch => p.chapters[ch.id]); };

  // ---- 答題紀錄 ----
  St.getAnswers = () => get(KEYS.answers, []);
  St.recordAnswer = rec => {
    const a = St.getAnswers();
    a.push(Object.assign({ ts: Date.now(), day: todayKey() }, rec));
    if (a.length > 5000) a.splice(0, a.length - 5000);
    set(KEYS.answers, a);
  };
  St.todayStats = () => {
    const t = todayKey();
    const a = St.getAnswers().filter(r => r.day === t);
    const correct = a.filter(r => r.correct).length;
    return { count: a.length, correct, acc: a.length ? Math.round(correct / a.length * 100) : null };
  };
  St.overallStats = () => {
    const a = St.getAnswers();
    const correct = a.filter(r => r.correct).length;
    return { count: a.length, correct, acc: a.length ? Math.round(correct / a.length * 100) : null };
  };

  // ---- 主題熟練度：概念完成度 50% + 最近 20 題正確率 50% ----
  St.topicMastery = topicId => {
    const chs = CONTENT.chapters.filter(c => c.topic === topicId);
    const p = St.getProgress();
    let total = 0, done = 0;
    chs.forEach(ch => ch.concepts.forEach(c => { total++; if (p.concepts[ch.id + '/' + c.id]) done++; }));
    const donePct = total ? done / total : 0;
    const chIds = new Set(chs.map(c => c.id));
    const ans = St.getAnswers().filter(r => chIds.has(r.chapter) || r.topic === topicId).slice(-20);
    const acc = ans.length ? ans.filter(r => r.correct).length / ans.length : null;
    const score = acc == null ? donePct * 0.5 : donePct * 0.5 + acc * 0.5;
    return { pct: Math.round(score * 100), donePct: Math.round(donePct * 100), acc: acc == null ? null : Math.round(acc * 100), answered: ans.length, done, total };
  };
  St.weakestTopics = (n = 3) => St.TOPICS.map(t => Object.assign({ id: t.id, name: t.name }, St.topicMastery(t.id))).sort((a, b) => a.pct - b.pct).slice(0, n);

  // ---- 錯題本 ----
  St.getWrong = () => get(KEYS.wrong, {});
  St.recordWrong = (q, myAnswerText, correctText) => {
    const w = St.getWrong();
    const cur = w[q.id] || { qid: q.id, wrongCount: 0, streak: 0, mastered: false };
    cur.question = q.q; cur.myAnswer = myAnswerText; cur.correctAnswer = correctText;
    cur.explanation = q.explanation || '';
    cur.concept = q.conceptName || q.concept || ''; cur.conceptId = q.concept || '';
    cur.chapter = q.chapterId || ''; cur.chapterTitle = q.chapterTitle || '';
    cur.topic = q.topic || ''; cur.type = q.type;
    cur.wrongCount += 1; cur.streak = 0; cur.mastered = false; cur.lastWrong = Date.now();
    w[q.id] = cur; set(KEYS.wrong, w);
  };
  St.recordCorrect = q => {
    const w = St.getWrong();
    if (!w[q.id]) return;
    w[q.id].streak = (w[q.id].streak || 0) + 1;
    if (w[q.id].streak >= 2) w[q.id].mastered = true; // 連續答對兩次才算掌握
    set(KEYS.wrong, w);
  };
  St.removeWrong = qid => { const w = St.getWrong(); delete w[qid]; set(KEYS.wrong, w); };
  St.wrongList = () => Object.values(St.getWrong()).sort((a, b) => (b.lastWrong || 0) - (a.lastWrong || 0));
  St.activeWrongCount = () => St.wrongList().filter(x => !x.mastered).length;
  St.weakConcepts = (n = 3) => {
    const map = {};
    St.wrongList().forEach(w => {
      if (w.mastered) return;
      const k = w.conceptId || w.concept;
      if (!map[k]) map[k] = { concept: w.concept, conceptId: w.conceptId, chapter: w.chapter, chapterTitle: w.chapterTitle, score: 0, items: 0 };
      map[k].score += w.wrongCount; map[k].items += 1;
    });
    return Object.values(map).sort((a, b) => b.score - a.score).slice(0, n);
  };

  // ---- 上次學習位置 ----
  St.getLast = () => get(KEYS.last, null);
  St.setLast = (chId, conceptId, title) => set(KEYS.last, { chId, conceptId, title, ts: Date.now() });

  // ---- Trace Mode 紀錄 ----
  St.getTrace = () => get(KEYS.trace, {});
  St.recordTrace = (id, correct) => { const t = St.getTrace(); const cur = t[id] || { tries: 0, correct: 0 }; cur.tries++; if (correct) cur.correct++; cur.last = Date.now(); t[id] = cur; set(KEYS.trace, t); };

  // ---- 主題 ----
  St.getTheme = () => { try { return localStorage.getItem(KEYS.theme); } catch (e) { return null; } };
  St.setTheme = t => { try { localStorage.setItem(KEYS.theme, t); } catch (e) {} };

  // ---- 面試模式 ----
  St.getInterview = () => get(KEYS.interview, { seen: {} });
  St.markInterviewSeen = id => { const s = St.getInterview(); s.seen[id] = (s.seen[id] || 0) + 1; set(KEYS.interview, s); };

  // ---- 重設 ----
  St.resetAll = () => { Object.values(KEYS).forEach(k => { if (k !== KEYS.theme) localStorage.removeItem(k); }); };

  return St;
})();
