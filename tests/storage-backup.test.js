const assert = require('node:assert/strict');
const test = require('node:test');

let failNextWrite = false;
const saved = new Map();
global.window = global;
global.localStorage = {
  getItem: key => saved.has(key) ? saved.get(key) : null,
  setItem(key, value) {
    if (failNextWrite) { failNextWrite = false; throw new Error('storage full'); }
    saved.set(key, value);
  },
  removeItem: key => saved.delete(key)
};
global.CONTENT = { chapters: [{
  id: 'ch1', num: 1, title: '第一章', concepts: [{
    id: 'c1', title: '概念一', checkpoint: [{
      id: 'q1', q: '目前題目', options: ['錯誤答案', '正確答案'], answer: 1,
      explanation: '目前解析', concept: 'c1', conceptName: '概念一', type: 'concept'
    }]
  }]
}] };
global.Quiz = { allQuestions: () => [{
  id: 'q1', q: '目前題目', options: ['錯誤答案', '正確答案'], answer: 1,
  explanation: '目前解析', concept: 'c1', conceptName: '概念一',
  chapterId: 'ch1', chapterTitle: '第一章', topic: 'process', type: 'concept'
}] };
global.TRACES = [{ id: 'tr1' }];
require('../js/storage.js');

function backup() {
  return {
    format: 'os-review-progress', version: 1, exportedAt: '2026-10-06T00:00:00.000Z',
    data: {
      progress: { concepts: { 'ch1/c1': 10 }, chapters: { ch1: 10 } },
      answers: [{ qid: 'q1', correct: false, concept: 'c1', chapter: 'ch1', topic: 'process', type: 'concept', ts: 10, day: '2026-10-06' }],
      wrong: { q1: { qid: 'q1', wrongCount: 2, streak: 0, mastered: false, lastWrong: 10,
        myAnswer: '<img src=x onerror=alert(1)>', correctAnswer: '被篡改的答案', question: '<script>bad()</script>' } },
      interview: { seen: { iv1: 3 } },
      last: { chId: 'ch1', conceptId: 'c1', title: '<img src=x>', ts: 10 },
      trace: { tr1: { tries: 2, correct: 1, last: 10 } }
    }
  };
}

test('匯出與匯入保留六類學習資料，題目與位置文字取自目前內容', () => {
  saved.clear();
  Storage.importProgress(backup());
  const result = Storage.exportProgress();
  assert.deepEqual(result.data.progress, backup().data.progress);
  assert.deepEqual(result.data.answers, backup().data.answers);
  assert.deepEqual(result.data.interview, backup().data.interview);
  assert.deepEqual(result.data.trace, backup().data.trace);
  assert.equal(result.data.wrong.q1.question, '目前題目');
  assert.equal(result.data.wrong.q1.correctAnswer, '正確答案');
  assert.equal(result.data.last.title, 'Chapter 1 · 概念一');
  assert.equal(saved.get('os_theme'), undefined);
});

test('無效檔案不會覆蓋原本資料', () => {
  const before = new Map(saved);
  const invalid = backup();
  invalid.data.answers = 'bad';
  assert.throws(() => Storage.importProgress(invalid), /格式錯誤/);
  assert.deepEqual(saved, before);
});

test('題庫找不到的錯題或 Trace 會拒絕匯入，主題不受影響', () => {
  saved.set('os_theme', 'dark');
  const before = new Map(saved);
  const invalid = backup();
  invalid.data.wrong.oldQuestion = { ...invalid.data.wrong.q1, qid: 'oldQuestion' };
  assert.throws(() => Storage.importProgress(invalid), /找不到的錯題/);
  assert.deepEqual(saved, before);
  const invalidTrace = backup();
  invalidTrace.data.trace.oldTrace = { tries: 1, correct: 0, last: 10 };
  assert.throws(() => Storage.importProgress(invalidTrace), /找不到的 Trace/);
  Storage.importProgress(backup());
  assert.equal(saved.get('os_theme'), 'dark');
});

test('儲存失敗時還原所有原本資料', () => {
  const before = new Map(saved);
  failNextWrite = true;
  assert.throws(() => Storage.importProgress(backup()), /原有進度已保留/);
  assert.deepEqual(saved, before);
});
