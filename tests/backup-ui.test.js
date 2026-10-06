const { connect } = require('./cdp.js');

(async () => {
  const c = await connect(process.argv[2]);
  const base = process.argv[3];
  await c.navigate(base + '?noscroll#/', 1000);

  const controls = await c.evaluate(`(function () {
    return {
      exportText: document.getElementById('export-btn').textContent,
      importText: document.getElementById('import-btn').textContent,
      accept: document.getElementById('import-file').accept,
      live: document.getElementById('backup-status').getAttribute('aria-live')
    };
  })()`);
  if (controls.exportText !== '匯出進度' || controls.importText !== '匯入進度' || controls.live !== 'polite') {
    throw new Error('備份控制項未正確載入：' + JSON.stringify(controls));
  }

  const exportResult = await c.evaluate(`(async function () {
    document.getElementById('export-btn').click();
    await new Promise(r => setTimeout(r, 100));
    return document.getElementById('backup-status').textContent;
  })()`);
  if (!exportResult.includes('已建立')) throw new Error('匯出回饋失敗：' + exportResult);

  const importResult = await c.evaluate(`(async function () {
    const first = CONTENT.chapters[0].concepts[0];
    Storage.setConceptDone(CONTENT.chapters[0].id, first.id, true);
    localStorage.setItem('os_theme', 'dark');
    const backup = Storage.exportProgress();
    Storage.resetAll();
    const input = document.getElementById('import-file');
    const choose = async (data, name, type, answer) => {
      window.confirm = () => answer;
      const file = new File([JSON.stringify(data)], name, { type });
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 150));
      return document.getElementById('backup-status').textContent;
    };
    const cancelled = await choose(backup, 'progress.json', 'application/json', false);
    const emptyAfterCancel = Storage.overallProgress().done === 0;
    const imported = await choose(backup, 'progress.json', 'application/json', true);
    const restored = Storage.isConceptDone(CONTENT.chapters[0].id, first.id);
    const theme = localStorage.getItem('os_theme');
    return { cancelled, emptyAfterCancel, imported, restored, theme };
  })()`);
  if (!importResult.cancelled.includes('已取消') || !importResult.emptyAfterCancel ||
      !importResult.imported.includes('匯入完成') || !importResult.restored || importResult.theme !== 'dark') {
    throw new Error('匯入流程失敗：' + JSON.stringify(importResult));
  }

  const invalidResult = await c.evaluate(`(async function () {
    const input = document.getElementById('import-file');
    const file = new File(['{}'], 'progress.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 100));
    return document.getElementById('backup-status').textContent;
  })()`);
  if (!invalidResult.includes('JSON')) throw new Error('錯誤檔案沒有顯示可恢復說明：' + invalidResult);

  await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await c.navigate(base + '?desktop#/', 700);
  await c.evaluate(`document.querySelector('.progress-backup').scrollIntoView({ block: 'center' })`);
  await c.screenshot('/tmp/os-review-backup-desktop.png');
  await c.evaluate(`(function () { localStorage.setItem('os_theme', 'light'); document.documentElement.setAttribute('data-theme', 'light'); })()`);
  await c.screenshot('/tmp/os-review-backup-light.png');
  await c.evaluate(`(function () { localStorage.setItem('os_theme', 'dark'); document.documentElement.setAttribute('data-theme', 'dark'); })()`);

  await c.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
  await c.navigate(base + '?mobile#/', 700);
  const mobileLayout = await c.evaluate(`(function () {
    document.querySelector('.progress-backup').scrollIntoView({ block: 'center' });
    return { overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, sidebarOpen: document.getElementById('sidebar').classList.contains('open') };
  })()`);
  if (mobileLayout.overflow || mobileLayout.sidebarOpen) throw new Error('行動版佈局異常：' + JSON.stringify(mobileLayout));
  await c.screenshot('/tmp/os-review-backup-mobile.png');

  await c.send('Emulation.setDeviceMetricsOverride', { width: 812, height: 375, deviceScaleFactor: 1, mobile: true });
  await c.navigate(base + '?landscape#/', 700);
  const landscapeOverflow = await c.evaluate(`document.documentElement.scrollWidth > document.documentElement.clientWidth`);
  if (landscapeOverflow) throw new Error('橫向行動版出現水平滾動。');
  const errs = c.errors();
  if (errs.length) throw new Error('瀏覽器錯誤：' + errs.join(' | '));
  console.log('BACKUP UI ALL OK', JSON.stringify({ controls, importResult, invalidResult }));
  c.close();
})().catch(e => { console.error(e); process.exit(1); });
