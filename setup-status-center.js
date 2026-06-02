(() => {
  const persist = window.TraderPersistence;
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const now = () => new Date().toLocaleString();
  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };
  let latest = [];

  async function safeJson(url, label) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      let data = null;
      try { data = await response.json(); } catch { data = { ok: false, message: 'Response was not JSON.' }; }
      return { label, ok: response.ok && data.ok !== false, status: response.status, data };
    } catch (error) {
      return { label, ok: false, status: 0, data: { message: error.message || 'Check failed safely.' } };
    }
  }

  function summarize(result) {
    const data = result.data || {};
    if (result.label === 'Local app shell') return document.getElementById('guidedWorkflow') && document.getElementById('persistenceEngine') ? 'Core UI modules are visible.' : 'Some core UI modules are not visible yet. Hard refresh after deployment.';
    if (result.label === 'Backup system') return data.configured ? 'Supabase backup appears configured.' : 'Local browser backup is active; Supabase is optional.';
    if (result.label === 'Paper broker') return data.configured ? 'Paper broker setup appears configured server-side.' : 'Paper broker setup is optional and currently locked/missing.';
    if (result.label === 'Live readiness') return data.configured ? 'Manual live-readiness gate appears configured; live action still requires human controls.' : (data.message || 'Manual live-readiness remains locked.');
    if (result.label === 'Market data') return result.ok ? 'Read-only market endpoint responded.' : (data.message || 'Market endpoint did not respond cleanly.');
    if (result.label === 'Historical data') return result.ok ? 'History endpoint responded.' : (data.message || 'History endpoint did not respond cleanly.');
    return data.message || 'Checked.';
  }

  function normalize(result) {
    const data = result.data || {};
    const blockedSafely = result.label === 'Live readiness' && data.configured === false;
    const optionalMissing = ['Backup system', 'Paper broker'].includes(result.label) && data.configured === false;
    return { ...result, good: Boolean(result.ok || blockedSafely || optionalMissing), summary: summarize(result) };
  }

  async function runChecks() {
    const box = document.getElementById('setupStatusResults');
    const score = document.getElementById('setupStatusScore');
    if (!box || !score) return;
    box.innerHTML = '<div class="setup-status-card">Checking app setup safely...</div>';
    score.textContent = 'Checking';
    const local = { label: 'Local app shell', ok: true, status: 200, data: { ok: true } };
    const checks = await Promise.all([
      Promise.resolve(local),
      safeJson('/api/persistence?action=status', 'Backup system'),
      safeJson('/api/alpaca-paper?action=setup-status', 'Paper broker'),
      safeJson('/api/alpaca-live?action=setup-status', 'Live readiness'),
      safeJson('/api/market?symbol=BTC', 'Market data'),
      safeJson('/api/history?symbol=BTC', 'Historical data')
    ]);
    latest = checks.map(normalize);
    renderResults();
    const journal = read('journal', []);
    write('journal', [...journal, { title: 'Setup status check', text: `Setup Status Center checked ${latest.filter((x) => x.good).length}/${latest.length} areas at ${now()}. Optional locked services are acceptable until configured.`, date: now() }]);
  }

  function renderResults() {
    const box = document.getElementById('setupStatusResults');
    const score = document.getElementById('setupStatusScore');
    if (!box || !score) return;
    const good = latest.filter((item) => item.good).length;
    score.textContent = latest.length ? `${good}/${latest.length}` : 'Not checked';
    box.innerHTML = latest.length ? latest.map((item) => `
      <article class="setup-status-card ${item.good ? 'setup-status-ok' : 'setup-status-bad'}">
        <strong>${esc(item.label)}</strong>
        <p>${esc(item.summary)}</p>
        <small>Status: ${esc(item.status)} • ${item.good ? 'acceptable' : 'needs attention'}</small>
      </article>`).join('') : '<p class="muted">No setup check has been run yet.</p>';
  }

  function exportReceipt() {
    const receipt = {
      exportedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      mode: 'setup_status_receipt',
      safety: 'Paper/research is the default. Optional live-readiness may remain locked safely.',
      checks: latest.map((item) => ({ label: item.label, acceptable: item.good, status: item.status, summary: item.summary })),
      note: 'This receipt records setup state only. It is not investment advice and does not prove trading performance.'
    };
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-setup-status-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shell() {
    if (document.getElementById('setupStatusCenter')) return;
    const readiness = document.getElementById('releaseReadinessCenter');
    const persistence = document.getElementById('persistenceEngine');
    const section = document.createElement('section');
    section.id = 'setupStatusCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Setup Status</span><h3>One-button environment check</h3></div><strong id="setupStatusScore">Not checked</strong></div>
      <p class="muted">Checks the safe pieces a beginner needs: local app shell, backup status, paper broker readiness, live-readiness lock/config status, market data, and history data. Optional services may stay locked until you configure them server-side.</p>
      <div class="setup-status-actions">
        <button id="setupStatusRun" type="button">Run setup status check</button>
        <button id="setupStatusExport" class="setup-status-secondary" type="button">Export setup receipt</button>
      </div>
      <div id="setupStatusResults" class="setup-status-grid"><p class="muted">No setup check has been run yet.</p></div>`;
    if (readiness?.parentNode) readiness.parentNode.insertBefore(section, readiness.nextSibling);
    else if (persistence?.parentNode) persistence.parentNode.insertBefore(section, persistence.nextSibling);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.setup-status-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.setup-status-actions button{width:auto}.setup-status-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.setup-status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.setup-status-card{border:1px solid rgba(255,255,255,.14);border-left:4px solid #4cc9f0;border-radius:14px;padding:12px;background:rgba(255,255,255,.05);color:#d7e2f0}.setup-status-card strong{color:#edf6ff}.setup-status-card p{margin:6px 0}.setup-status-card small{color:#c7d4e5}.setup-status-ok{border-left-color:#a7f3d0}.setup-status-bad{border-left-color:#f87171}@media(max-width:860px){.setup-status-actions button{width:100%}.setup-status-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('setupStatusRun').addEventListener('click', runChecks);
    document.getElementById('setupStatusExport').addEventListener('click', exportReceipt);
    renderResults();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
