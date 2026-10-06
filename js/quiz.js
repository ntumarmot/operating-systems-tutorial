/* ============================================================
   Quiz — Checkpoint / 測驗題渲染與作答邏輯
   題型：concept / trace / calc / scenario / code
   形式：選擇題（options + answer）、計算題（fields，數值容差）
   按鈕：提示 / 看答案 / 看解析（看過答案就不計分）
   ============================================================ */
window.Quiz = (function () {
  const Q = {};
  const TYPE_LABEL = { concept: 'Concept', trace: 'Trace', calc: 'Calculation', scenario: 'Scenario', code: 'Code' };
  Q.TYPES = TYPE_LABEL;

  Q.renderMath = el => {
    if (window.renderMathInElement) {
      try {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false }
          ],
          ignoredClasses: ['code-block'],
          throwOnError: false
        });
      } catch (e) { console.warn(e); }
    }
  };

  Q.allQuestions = () => {
    const list = [];
    CONTENT.chapters.forEach(ch => ch.concepts.forEach(c => (c.checkpoint || []).forEach(q => {
      list.push(Object.assign({}, q, { chapterId: ch.id, chapterTitle: ch.title, topic: ch.topic, concept: q.concept || c.id, conceptName: q.conceptName || c.title }));
    })));
    return list;
  };
  Q.findQuestion = id => Q.allQuestions().find(q => q.id === id);

  const correctText = q => {
    if (q.options) return q.options[q.answer];
    return q.fields.map(f => `${f.label} = ${f.answer}`).join('，');
  };

  Q.renderQuestion = (q, opts = {}) => {
    const el = document.createElement('div');
    el.className = 'question'; el.dataset.qid = q.id;
    let selected = null, submitted = false, peeked = false;
    const typeCls = q.type || 'concept';
    el.innerHTML = `
      <div class="q-meta">
        <span class="q-type t-${typeCls}">${TYPE_LABEL[typeCls] || typeCls}</span>
        ${opts.showConcept && q.conceptName ? `<span>${q.chapterTitle ? q.chapterTitle + ' · ' : ''}${q.conceptName}</span>` : ''}
        ${opts.index != null ? `<span>Q${opts.index}</span>` : ''}
      </div>
      <div class="q-text">${q.q}${q.code ? Util.code(q.code, { lang: q.lang || 'C', noln: !!q.noln }) : ''}</div>
      <div class="q-body"></div>
      <div class="q-actions"></div>
      <div class="q-panels"></div>`;
    const body = el.querySelector('.q-body'), actions = el.querySelector('.q-actions'), panels = el.querySelector('.q-panels');

    let inputs = [];
    if (q.options) {
      const wrap = document.createElement('div'); wrap.className = 'q-options';
      q.options.forEach((opt, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'q-option';
        b.innerHTML = `<span class="opt-key">${String.fromCharCode(65 + i)}</span><span>${opt}</span>`;
        b.addEventListener('click', () => { if (submitted) return; selected = i; wrap.querySelectorAll('.q-option').forEach(x => x.classList.remove('selected')); b.classList.add('selected'); });
        wrap.appendChild(b);
      });
      body.appendChild(wrap);
    } else if (q.fields) {
      const wrap = document.createElement('div'); wrap.className = 'q-fields';
      q.fields.forEach((f, i) => {
        const l = document.createElement('label');
        l.innerHTML = `<span>${f.label} =</span> <input type="text" inputmode="decimal" placeholder="輸入數值" data-i="${i}">`;
        wrap.appendChild(l); inputs.push(l.querySelector('input'));
      });
      body.appendChild(wrap);
    }

    const mk = (txt, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-sm ' + (cls || ''); b.textContent = txt; b.addEventListener('click', fn); actions.appendChild(b); return b; };
    const result = document.createElement('span'); result.className = 'q-result';
    const panel = (kind, html) => {
      const ex = panels.querySelector('.q-panel.' + kind);
      if (ex) { ex.remove(); return; }
      const p = document.createElement('div'); p.className = 'q-panel ' + kind; p.innerHTML = html; panels.appendChild(p); Q.renderMath(p);
    };

    const submitBtn = mk('送出答案', 'btn-primary', () => {
      if (submitted) return;
      let correct, myText;
      if (q.options) {
        if (selected === null) { result.className = 'q-result no'; result.textContent = '請先選一個選項'; actions.appendChild(result); return; }
        correct = selected === q.answer; myText = q.options[selected];
        body.querySelectorAll('.q-option').forEach((b, i) => { if (i === q.answer) b.classList.add('correct'); else if (i === selected) b.classList.add('wrong'); });
      } else {
        const vals = inputs.map(inp => parseFloat(String(inp.value).replace(/,/g, '')));
        if (vals.some(v => Number.isNaN(v))) { result.className = 'q-result no'; result.textContent = '請填入所有數值'; actions.appendChild(result); return; }
        const each = q.fields.map((f, i) => Math.abs(vals[i] - f.answer) <= (f.tol ?? 0.01));
        correct = each.every(Boolean);
        each.forEach((ok, i) => inputs[i].classList.add(ok ? 'correct' : 'wrong'));
        myText = q.fields.map((f, i) => `${f.label} = ${vals[i]}`).join('，');
      }
      submitted = true; submitBtn.disabled = true;
      result.className = 'q-result ' + (correct ? 'ok' : 'no');
      result.textContent = correct ? '✓ 答對了' : '✗ 答錯了';
      actions.appendChild(result);
      if (!peeked) {
        Storage.recordAnswer({ qid: q.id, correct, concept: q.concept, chapter: q.chapterId, topic: q.topic, type: q.type });
        if (correct) Storage.recordCorrect(q); else Storage.recordWrong(q, myText, correctText(q));
        if (opts.onAnswer) opts.onAnswer(correct, q);
        document.dispatchEvent(new CustomEvent('os:answered'));
      }
      if (!correct) panel('explain', `<b>解析：</b>${q.explanation || ''}`);
    });
    mk('提示', '', () => panel('hint', `<b>提示：</b>${q.hint || '（這題沒有提示，試著回想定義。）'}`));
    mk('看答案', '', () => {
      if (!submitted) { peeked = true; submitBtn.disabled = true; result.className = 'q-result'; result.textContent = '已看答案，這次不計分'; actions.appendChild(result); }
      panel('answer', `<b>答案：</b>${correctText(q)}`);
    });
    mk('看解析', '', () => {
      if (!submitted && !peeked) { peeked = true; submitBtn.disabled = true; result.className = 'q-result'; result.textContent = '已看解析，這次不計分'; actions.appendChild(result); }
      panel('explain', `<b>解析：</b>${q.explanation || ''}`);
    });
    if (opts.retry !== false) mk('再答一次', 'btn-ghost', () => { const fresh = Q.renderQuestion(q, opts); el.replaceWith(fresh); });

    Q.renderMath(el);
    return el;
  };

  Q.renderCheckpoint = (questions, title = 'Checkpoint', opts = {}) => {
    const wrap = document.createElement('div'); wrap.className = 'checkpoint';
    wrap.innerHTML = `<div class="checkpoint-head"><span>${title}</span><span style="color:var(--text-3);font-weight:400">${questions.length} 題</span></div>`;
    questions.forEach((q, i) => wrap.appendChild(Q.renderQuestion(q, Object.assign({ index: i + 1 }, opts))));
    return wrap;
  };

  return Q;
})();
