(() => {
  const PREFIX = 'trader_';
  const REPORT_KEY = 'vault_reports';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const now = () => new Date().toISOString();
  const safeParse = (raw, fallback) => { try { return raw == null ? fallback : JSON.parse(raw); } catch { return fallback; } };
  const read = (name, fallback = []) => safeParse(localStorage.getItem(`${PREFIX}${name}`), fallback);
  const write = (name, value) => localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(value));

  function allTraderKeys() {
    return Object.keys(localStorage).filter((key) => key.startsWith(PREFIX)).sort();
  }

  function redactedValue(key, raw) {
    if (/secret|password|token|api[_-]?key|owner/i.test(key)) return '[redacted-if-present]';
    return safeParse(raw, raw);
  }

  function makeVault(reason = 'manual_vault_export') {
    const keys = allTraderKeys();
    const data = {};
    keys.forEach((key) => { data[key] = redactedValue(key, localStorage.getItem(key)); });
    return {
      schemaVersion: 1,
      app: 'Trader Command Center',
      reason,
      exportedAt: now(),
      keyCount: keys.length,
      keys,
      safety: 'Contains Trader browser app memory only. Suspicious secret-like key names are redacted. Owner access code is session-only and should not appear here.',
      noLossRule: 'Use this file to preserve app state before major upgrades, hard refreshes, browser moves, or live-mode setup changes.',
      data
    };
  }

  function saveReport(vault) {
    const reports = read(REPORT_KEY, []);
    write(REPORT_KEY, [...reports, { exportedAt: vault.exportedAt, keyCount: vault.keyCount, reason: vault.reason }].slice(-30));
  }

  function downloadVault() {
    const vault = makeVault('manual_no_loss_export');
    saveReport(vault);
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-no-loss-vault-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`No-loss vault exported with ${vault.keyCount} Trader keys.`);
    render();
  }

  async function importVault(file) {
    const parsed = safeParse(await file.text(), null);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) throw new Error('Vault import failed: file does not contain Trader vault data.');
    let restored = 0;
    Object.entries(parsed.data).forEach(([key, value]) => {
      if (!key.startsWith(PREFIX)) return;
      if (value === '[redacted-if-present]') return;
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      restored += 1;
    });
    saveReport({ exportedAt: now(), keyCount: restored, reason: 'vault_import' });
    document.dispatchEvent(new CustomEvent('trader:persistence-restored', { detail: makeVault('vault_import_refresh') }));
    setMessage(`Vault imported. Restored ${restored} Trader keys. Hard refresh once if a panel still looks stale.`);
    render();
  }

  function runIntegrityCheck() {
    const keys = allTraderKeys();
    const broken = [];
    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      try { JSON.parse(raw); } catch { broken.push(key); }
    });
    const report = { exportedAt: now(), keyCount: keys.length, brokenJsonKeys: broken, reason: 'vault_integrity_check' };
    saveReport(report);
    setMessage(broken.length ? `Integrity warning: ${broken.length} keys are not JSON. Export a vault before changing anything.` : `Integrity OK: ${keys.length} Trader keys are readable.` , broken.length > 0);
    render();
  }

  function setMessage(text, bad = false) {
    const box = document.getElementById('vaultMessage');
    if (box) box.innerHTML = `<div class="vault-note ${bad ? 'vault-bad' : ''}">${esc(text)}</div>`;
  }

  function render() {
    const score = document.getElementById('vaultScore');
    const grid = document.getElementById('vaultGrid');
    const history = document.getElementById('vaultHistory');
    if (!score || !grid || !history) return;
    const keys = allTraderKeys();
    const categories = [
      ['Core', ['watchlist', 'journal', 'checks']],
      ['AI intelligence', ['ai_review_coach_notes', 'decision_approval_log', 'ai_live_assist_drafts', 'chat_messages', 'chat_learning']],
      ['Strategy evidence', ['playbooks', 'validation_report', 'real_strategy_evolution', 'real_results_report']],
      ['Broker/safety', ['broker_logs', 'live_broker_logs', 'trading_mode_control', 'live_trading_acknowledged']],
      ['Setup/product', ['guided_workflow', 'release_readiness', 'support_reports', 'vault_reports']]
    ];
    score.textContent = `${keys.length} keys`;
    grid.innerHTML = categories.map(([label, names]) => {
      const count = names.filter((name) => localStorage.getItem(`${PREFIX}${name}`) != null).length;
      return `<article class="vault-card"><strong>${esc(label)}</strong><p>${count}/${names.length} expected areas have saved state.</p></article>`;
    }).join('');
    const reports = read(REPORT_KEY, []);
    history.innerHTML = reports.length ? reports.slice().reverse().slice(0, 6).map((row) => `<div class="vault-card"><strong>${esc(row.reason || 'vault report')}</strong><p>${esc(row.exportedAt)} • ${esc(row.keyCount)} keys</p></div>`).join('') : '<p class="muted">No vault exports or integrity checks yet.</p>';
  }

  function shell() {
    if (document.getElementById('noLossDataVault')) return;
    const memory = document.getElementById('intelligenceMemoryCenter');
    const support = document.getElementById('supportRepairCenter');
    const section = document.createElement('section');
    section.id = 'noLossDataVault';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">No-Loss Data Vault</span><h3>Protect every saved app state</h3></div><strong id="vaultScore">0 keys</strong></div>
      <p class="muted">Use this before major upgrades or setup changes. It scans all Trader browser memory keys, exports a no-loss vault, and can restore Trader keys without touching unrelated browser storage.</p>
      <div class="vault-actions"><button id="vaultExport" type="button">Export no-loss vault</button><label class="vault-import">Import vault<input id="vaultImport" type="file" accept="application/json" /></label><button id="vaultCheck" class="vault-secondary" type="button">Run integrity check</button><button id="vaultRefresh" class="vault-secondary" type="button">Refresh vault view</button></div>
      <div id="vaultGrid" class="vault-grid"></div>
      <div id="vaultMessage" class="list"></div>
      <div id="vaultHistory" class="list"></div>`;
    if (memory?.parentNode) memory.parentNode.insertBefore(section, memory.nextSibling);
    else if (support?.parentNode) support.parentNode.insertBefore(section, support.nextSibling);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.vault-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.vault-actions button,.vault-import{width:auto}.vault-secondary,.vault-import{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.vault-import{display:inline-flex;align-items:center;border-radius:14px;padding:12px 14px;font-weight:900;cursor:pointer}.vault-import input{display:none}.vault-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vault-card,.vault-note{border:1px solid rgba(255,255,255,.14);border-left:4px solid #4cc9f0;border-radius:14px;padding:12px;background:rgba(255,255,255,.05);color:#d7e2f0;margin:8px 0}.vault-card strong{color:#edf6ff}.vault-card p{margin:6px 0 0}.vault-bad{border-left-color:#f87171}@media(max-width:860px){.vault-actions button,.vault-import{width:100%;justify-content:center}.vault-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('vaultExport').addEventListener('click', downloadVault);
    document.getElementById('vaultCheck').addEventListener('click', runIntegrityCheck);
    document.getElementById('vaultRefresh').addEventListener('click', render);
    document.getElementById('vaultImport').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      importVault(file).catch((error) => setMessage(error.message || 'Vault import failed safely.', true));
      event.target.value = '';
    });
    document.addEventListener('trader:persistence-restored', render);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
