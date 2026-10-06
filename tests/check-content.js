const vm = require('vm'), fs = require('fs'); const dir = process.argv[2];
const ctx = { console, document: { createElement: () => ({}) } }; ctx.window = ctx; vm.createContext(ctx);
const files = ['js/engines/sched.js','js/engines/memory.js','js/engines/banker.js','js/engines/disk.js', ...['00','01','02','03','04','05','06','07','08','09'].map(n=>'js/content/ch'+n+'.js'),'js/content/interview.js','js/content/trace.js'];
files.forEach(f => vm.runInContext(fs.readFileSync(dir+'/'+f,'utf8'), ctx, { filename: f }));
const C = ctx.CONTENT; const ids = new Set(); let nq = 0, dup = []; const types = {};
C.chapters.forEach(ch => ch.concepts.forEach(c => (c.checkpoint||[]).forEach(q => { nq++; if (ids.has(q.id)) dup.push(q.id); ids.add(q.id); types[q.type]=(types[q.type]||0)+1; if (q.options && (q.answer==null||q.answer>=q.options.length)) console.log('BAD answer', q.id); if (!q.options && !q.fields) console.log('NO body', q.id); })));
console.log('chapters', C.chapters.length, 'concepts', C.chapters.reduce((s,c)=>s+c.concepts.length,0), 'questions', nq, 'dups', dup, types);
console.log('interview', ctx.INTERVIEW_QUESTIONS.length, 'traces', ctx.TRACES.length, 'trace dup', new Set(ctx.TRACES.map(t=>t.id)).size !== ctx.TRACES.length);
const used = new Set(); C.chapters.forEach(ch => ch.concepts.forEach(c => { if (c.sim) used.add(c.sim); if (c.traceSim) used.add(c.traceSim); })); ctx.TRACES.forEach(t => t.anim && used.add(t.anim.sim));
const defined = new Set(); fs.readdirSync(dir+'/js/sims').forEach(f => { const s = fs.readFileSync(dir+'/js/sims/'+f,'utf8'); [...s.matchAll(/S\.(\w+) = function/g)].forEach(m => defined.add(m[1])); });
console.log('missing sims:', [...used].filter(u => !defined.has(u))); console.log('unused sims:', [...defined].filter(d => !used.has(d) && !d.startsWith('_')));
// 反斜線被吃掉檢查：內容裡出現 "\n" 字面或 $ 未閉合
C.chapters.forEach(ch => ch.concepts.forEach(c => { const s = JSON.stringify(c); const d = (s.match(/\$/g)||[]).length; if (d % 2) console.log('odd $ count in', ch.id, c.id); }));
// 章節 topic 有效
C.chapters.forEach(ch => { if (!ch.topic) console.log('no topic', ch.id); });
