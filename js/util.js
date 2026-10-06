/* ============================================================
   Util — 共用工具：DOM、隨機、C/C++ 語法上色、Stepper（逐步模擬）、預測小工具
   ============================================================ */
window.Sims = window.Sims || {};
window.Util = (function () {
  const U = {};

  U.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  U.esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  U.fmt = (x, d = 2) => (Number.isInteger(x) ? String(x) : (+x).toFixed(d).replace(/\.?0+$/, ''));
  U.el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  U.pcls = i => 'pc-' + (((i % 8) + 8) % 8 + 1);              // process 顏色 class
  U.pcolor = i => `var(--p${((i % 8) + 8) % 8 + 1})`;

  /* ---------- 互動模擬外殼 ---------- */
  U.simShell = (title, desc) => {
    const el = U.el('div', 'sim');
    el.innerHTML = `<div class="sim-title">${title}</div>${desc ? `<div class="sim-desc">${desc}</div>` : ''}`;
    return el;
  };

  /* ---------- C / C++ 語法上色 ---------- */
  const KW = /\b(if|else|for|while|do|return|break|continue|switch|case|default|goto|sizeof|typedef|struct|union|enum|class|public|private|new|delete|true|false|nullptr|NULL|const|static|extern|volatile|inline|namespace|using|this|try|catch|throw)\b/;
  const TY = /\b(int|char|void|long|short|float|double|unsigned|signed|bool|size_t|pid_t|ssize_t|FILE|sem_t|pthread_t|pthread_mutex_t|atomic_int|semaphore|mutex|Semaphore|Mutex|auto)\b/;
  function tokenizeLine(line) {
    let out = '', i = 0;
    const push = (cls, txt) => { out += cls ? `<span class="${cls}">${U.esc(txt)}</span>` : U.esc(txt); };
    if (/^\s*#/.test(line)) return `<span class="tk-pp">${U.esc(line)}</span>`;
    while (i < line.length) {
      const rest = line.slice(i);
      let m;
      if ((m = rest.match(/^\/\/.*$/))) { push('tk-cm', m[0]); break; }
      if ((m = rest.match(/^\/\*.*?\*\//))) { push('tk-cm', m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^"(?:[^"\\]|\\.)*"/)) || (m = rest.match(/^'(?:[^'\\]|\\.)*'/))) { push('tk-str', m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^\d+(\.\d+)?[uUlLfF]*\b/))) { push('tk-num', m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^[A-Za-z_]\w*/))) {
        const w = m[0]; const after = rest.slice(w.length);
        if (KW.test(w)) push('tk-kw', w); else if (TY.test(w)) push('tk-type', w); else if (/^\s*\(/.test(after)) push('tk-fn', w); else push('', w);
        i += w.length; continue;
      }
      push('', rest[0]); i++;
    }
    return out;
  }
  // code({src, lang, title, hl:[行號], note}) → HTML 字串
  U.code = (src, opts = {}) => {
    if (typeof src === 'object') { opts = src; src = opts.src; }
    const lines = src.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
    const hl = new Set(opts.hl || []);
    const body = lines.map((l, i) => `<span class="line${hl.has(i + 1) ? ' hl' : ''}" data-ln="${i + 1}"><span class="ln">${opts.noln ? '' : i + 1}</span>${tokenizeLine(l)}</span>`).join('');
    return `<div class="code-block"><div class="code-head"><span>${opts.title || opts.lang || 'C'}</span>${opts.right ? `<span>${opts.right}</span>` : ''}</div><pre><code>${body}</code></pre></div>${opts.note ? `<div class="code-note">${opts.note}</div>` : ''}`;
  };
  // 在既有 code-block 中標記正在執行的行
  U.hlLines = (codeEl, lines, cls = 'hl-run') => {
    codeEl.querySelectorAll('.line').forEach(l => { l.classList.remove('hl-run', 'hl'); });
    (lines || []).forEach(n => { const l = codeEl.querySelector(`.line[data-ln="${n}"]`); if (l) l.classList.add(cls); });
  };

  /* ---------- Stepper：逐步模擬控制器 ----------
     steps: 陣列（每個元素是任意 state 物件，含 desc 說明文字）
     draw(step, index): 把該步驟畫到畫面
     opts: { autoMs, onIndex, logFn(step)->string }
  --------------------------------------------- */
  U.stepper = (host, steps, draw, opts = {}) => {
    const wrap = U.el('div', 'stepper');
    wrap.innerHTML = `
      <div class="stepper-bar">
        <button class="btn btn-sm" data-act="reset">↺ 重設</button>
        <button class="btn btn-sm" data-act="prev">← 上一步</button>
        <button class="btn btn-sm btn-primary" data-act="next">Next Step →</button>
        <button class="btn btn-sm" data-act="auto">▶ 自動播放</button>
        <button class="btn btn-sm btn-ghost" data-act="end">跳到最後</button>
        <span class="step-idx"></span>
      </div>
      <div class="step-desc"></div>
      ${opts.log ? '<div class="step-log"></div>' : ''}`;
    host.appendChild(wrap);
    const idxEl = wrap.querySelector('.step-idx'), descEl = wrap.querySelector('.step-desc'), logEl = wrap.querySelector('.step-log');
    const btn = a => wrap.querySelector(`[data-act="${a}"]`);
    let i = 0, timer = null;
    const api = {};
    function render() {
      if (!wrap.isConnected) { stop(); return; }   // 模擬已被重建，舊控制列不再作用
      const s = steps[i];
      idxEl.textContent = `Step ${i} / ${steps.length - 1}`;
      descEl.className = 'step-desc' + (s.cls ? ' ' + s.cls : '') + (i === steps.length - 1 ? ' done' : '');
      descEl.innerHTML = s.desc || '';
      btn('prev').disabled = i === 0; btn('next').disabled = i >= steps.length - 1;
      if (logEl && opts.log) {
        logEl.innerHTML = steps.slice(0, i + 1).map((st, k) => `<div class="${k === i ? 'cur' : ''}">${opts.log(st, k)}</div>`).join('');
        logEl.scrollTop = logEl.scrollHeight;
      }
      draw(s, i, steps);
      if (opts.onIndex) opts.onIndex(i, s);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; btn('auto').textContent = '▶ 自動播放'; } }
    api.go = n => { i = Math.max(0, Math.min(steps.length - 1, n)); render(); };
    api.next = () => { if (i < steps.length - 1) { i++; render(); } else stop(); };
    api.setSteps = ns => { stop(); steps = ns; i = 0; render(); };
    api.index = () => i;
    api.stop = stop;
    btn('next').addEventListener('click', () => { stop(); api.next(); });
    btn('prev').addEventListener('click', () => { stop(); api.go(i - 1); });
    btn('reset').addEventListener('click', () => { stop(); api.go(0); });
    btn('end').addEventListener('click', () => { stop(); api.go(steps.length - 1); });
    btn('auto').addEventListener('click', () => {
      if (timer) { stop(); return; }
      if (i >= steps.length - 1) i = -1;
      btn('auto').textContent = '⏸ 暫停';
      timer = setInterval(() => { if (i >= steps.length - 1) stop(); else api.next(); }, opts.autoMs || 1100);
    });
    render();
    return api;
  };

  /* ---------- 先預測再看（教學原則：自己猜 → 再驗證） ---------- */
  // predict(host, {q, options:[...], answer: index, explain, onReveal})
  U.predict = (host, cfg) => {
    const el = U.el('div', 'predict');
    el.innerHTML = `<div class="pd-q">🤔 先預測：${cfg.q}</div><div class="pd-opts">${cfg.options.map((o, i) => `<button class="btn btn-sm" data-i="${i}">${o}</button>`).join('')}</div><div class="pd-res"></div>`;
    host.appendChild(el);
    let done = false;
    el.querySelectorAll('.pd-opts button').forEach(b => b.addEventListener('click', () => {
      if (done) return; done = true;
      const i = +b.dataset.i, ok = i === cfg.answer;
      el.querySelectorAll('.pd-opts button').forEach((x, k) => { x.disabled = true; if (k === cfg.answer) x.classList.add('btn-success'); else if (k === i) x.style.borderColor = 'var(--danger)'; });
      el.querySelector('.pd-res').innerHTML = `<b style="color:${ok ? 'var(--success)' : 'var(--danger)'}">${ok ? '✓ 猜對了' : '✗ 不是這個'}</b>　${cfg.explain || ''}`;
      if (cfg.onReveal) cfg.onReveal(ok, i);
    }));
    return el;
  };

  /* ---------- 小表格 ---------- */
  U.table = (head, rows, cls = 'data mono') => `<div class="table-wrap"><table class="${cls}"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => (typeof c === 'object' && c && c.html != null) ? `<td class="${c.cls || ''}">${c.html}</td>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

  return U;
})();
