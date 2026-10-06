// 引擎測試：node tests/engines.test.js "<專案路徑>"
global.window = {};
{
require(process.argv[2] + "/js/engines/sched.js"); const S = window.Sched;
const g = r => r.gantt.map(x => `${x.id||'idle'}[${x.start}-${x.end}]`).join(' ');
let ok = true; const eq = (a, b, m) => { if (Math.abs(a - b) > 1e-9) { ok = false; console.log('FAIL', m, a, b); } };
let r = S.run([{id:'P1',arrival:0,burst:24},{id:'P2',arrival:0,burst:3},{id:'P3',arrival:0,burst:3}], 'FCFS'); eq(r.avg.waiting, 17, 'fcfs'); console.log('FCFS', g(r));
r = S.run([{id:'P1',arrival:0,burst:6},{id:'P2',arrival:0,burst:8},{id:'P3',arrival:0,burst:7},{id:'P4',arrival:0,burst:3}], 'SJF'); eq(r.avg.waiting, 7, 'sjf'); console.log('SJF', g(r));
r = S.run([{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:9},{id:'P4',arrival:3,burst:5}], 'SRTF'); eq(r.avg.waiting, 6.5, 'srtf'); console.log('SRTF', g(r), r.metrics.P1.completion, r.metrics.P3.completion);
r = S.run([{id:'P1',arrival:0,burst:24},{id:'P2',arrival:0,burst:3},{id:'P3',arrival:0,burst:3}], 'RR', {quantum:4}); eq(r.avg.waiting, 17/3, 'rr'); console.log('RR', g(r));
r = S.run([{id:'P1',arrival:0,burst:10,priority:3},{id:'P2',arrival:0,burst:1,priority:1},{id:'P3',arrival:0,burst:2,priority:4},{id:'P4',arrival:0,burst:1,priority:5},{id:'P5',arrival:0,burst:5,priority:2}], 'PRIO'); eq(r.avg.waiting, 8.2, 'prio'); console.log('PRIO', g(r));
// spec example: P1 0 8, P2 1 4, P3 2 2
r = S.run([{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:2}], 'SJF'); console.log('SJF spec', g(r), r.avg);
r = S.run([{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:2}], 'SRTF'); console.log('SRTF spec', g(r), r.avg);
r = S.run([{id:'P1',arrival:0,burst:8},{id:'P2',arrival:1,burst:4},{id:'P3',arrival:2,burst:2}], 'RR', {quantum:2}); console.log('RR spec', g(r), r.avg);
// idle gap
r = S.run([{id:'P1',arrival:0,burst:2},{id:'P2',arrival:5,burst:2}], 'FCFS'); console.log('idle', g(r), r.avg);
// RR arrival same time as quantum expiry: P1 0 5, P2 2 3, q=2 => P1[0-2] P2 arrives at 2, P2 first, P1 tail
r = S.run([{id:'P1',arrival:0,burst:5},{id:'P2',arrival:2,burst:3}], 'RR', {quantum:2}); console.log('RR tie', g(r));
r = S.run([{id:'P1',arrival:0,burst:5,priority:2},{id:'P2',arrival:1,burst:3,priority:1}], 'PRIO_P'); console.log('PRIO_P', g(r));
console.log(ok ? 'ALL OK' : 'FAILURES');
}
{
const d = process.argv[2];
require(d + '/js/engines/memory.js'); require(d + '/js/engines/banker.js'); require(d + '/js/engines/disk.js');
const { Mem, Banker, Disk } = window; let ok = true; const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) { ok = false; console.log('FAIL', m, a, b); } };
const refs = [7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1];
eq(Mem.pageReplace(refs, 3, 'FIFO').faults, 15, 'fifo'); eq(Mem.pageReplace(refs, 3, 'OPT').faults, 9, 'opt'); eq(Mem.pageReplace(refs, 3, 'LRU').faults, 12, 'lru');
const r8 = [7,0,1,2,0,3,0,4]; console.log('spec', ['FIFO','LRU','OPT'].map(a => a + '=' + Mem.pageReplace(r8, 3, a).faults).join(' '));
// Belady: 1 2 3 4 1 2 5 1 2 3 4 5: FIFO 3 frames 9, 4 frames 10
const bel = [1,2,3,4,1,2,5,1,2,3,4,5]; eq(Mem.pageReplace(bel, 3, 'FIFO').faults, 9, 'belady3'); eq(Mem.pageReplace(bel, 4, 'FIFO').faults, 10, 'belady4');
eq(Mem.translate(13, 4, [5,6,1,2]).physical, 9, 'translate'); // page 3 offset 1 -> frame 2 -> 9
// Banker textbook
const max = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]], alloc = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
const s = Banker.safety([3,3,2], max, alloc); eq(s.safe, true, 'safe'); eq(s.sequence, ['P1','P3','P4','P0','P2'], 'seq');
const rq = Banker.request([3,3,2], max, alloc, ['P0','P1','P2','P3','P4'], 1, [1,0,2]); eq(rq.ok, true, 'req1'); 
const rq2 = Banker.request([2,3,0], max, rq.state.alloc, ['P0','P1','P2','P3','P4'], 4, [3,3,0]); eq(rq2.ok, false, 'req4 wait'); console.log(rq2.reason);
const rq3 = Banker.request([2,3,0], max, rq.state.alloc, ['P0','P1','P2','P3','P4'], 0, [0,2,0]); eq(rq3.ok, false, 'req0 unsafe'); console.log(rq3.reason);
// Disk textbook
const q = [98,183,37,122,14,124,65,67];
eq(Disk.run(q, 53, 'FCFS').total, 640, 'fcfs'); eq(Disk.run(q, 53, 'SSTF').total, 236, 'sstf');
eq(Disk.run(q, 53, 'SCAN', { dir: 'down' }).total, 236, 'scan'); eq(Disk.run(q, 53, 'CSCAN', { dir: 'up' }).total, 382, 'cscan');
eq(Disk.run(q, 53, 'LOOK', { dir: 'down' }).total, 208, 'look'); eq(Disk.run(q, 53, 'CLOOK', { dir: 'up' }).total, 322, 'clook');
console.log(Disk.run(q, 53, 'SSTF').order.join(' '));
// allocation
const blocks = [{start:0,size:100,pid:'OS'},{start:100,size:200,pid:null},{start:300,size:100,pid:'P1'},{start:400,size:300,pid:null},{start:700,size:100,pid:'P2'},{start:800,size:150,pid:null}];
eq(Mem.chooseHole(blocks, 120, 'first').index, 1, 'first'); eq(Mem.chooseHole(blocks, 120, 'best').index, 5, 'best'); eq(Mem.chooseHole(blocks, 120, 'worst').index, 3, 'worst');
const b2 = Mem.place(blocks, 1, 120, 'P3'); eq(b2.length, 7, 'split'); const b3 = Mem.release(b2, 'P1'); eq(b3.find(b=>b.start===220).size, 480, 'coalesce');
console.log(ok ? 'ALL OK' : 'FAILURES');
}
