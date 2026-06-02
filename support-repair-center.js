(() => {
  const persist = window.TraderPersistence;
  const KEY = 'support_reports';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };
  const modules = [
    ['Guided Workflow', '#guidedWorkflow'],
    ['Mode Control', '#modeControlCenter'],
    ['Setup Status', '#setupStatusCenter'],
    ['Release Readiness', '#releaseReadinessCenter'],
    ['Persistence / Backup', '#persistenceEngine'],
    ['Paper Broker', '#paperBroker'],
    ['Optional Live Trading', '#liveTradingControl'],
    ['Chart Engine', '#chartEngine'],
    ['Strategy Evolution', '#realResultsEngine'],
    ['Validation Forge', '#validationForge'],
    ['AI Coach Chat', '#aiChat'],
    ['Kid Coach', '#kidCoach']
  ];

  function safeCount(name) {
    const value = read(name, []);
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return value == null ? 0 : 1;
  }

  function snapshot() {
    const scripts = Array.from(document.querySelectorAll('script[src]')).map((s) => s.getAttribute('src'));
    const panels = modules.map(([label, selector]) => ({ label, selector, visible: Boolean(document.querySelector(selector)) }));
    const dataCounts = {
      watchlist: safeCount('watchlist'),
      journal: safeCount('journal'),
      checks: safeCount('checks'),
      ai_plans: safeCount('ai_plans'),
      broker_logs: safeCount('broker_logs'),
      live_broker_logs: safeCount('live_broker_logs'),
      guided_workflow: safeCount('guided_workflow'),
      release_readiness: safeCount('release_readiness'),
      support_reports: safeCount(KEY)
    };
    return {
      generatedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      url: location.href,
      userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight },
      online: navigator.onLine,
      persistenceMode: persist?.mode ? persist.mode() : 'localStorage-fallback',
      scripts,
      panels,
      dataCounts,
      safety: 'No broker keys, secrets, tokens, passwords, or API key values are included in this support bundle.',
      reminders: [
        'Paper/research is the default mode.',
        'Optional live trading stays manual-only and locked unless server-side gates are intentionally configured.',
        'This is not investment advice and does not guarantee profit.'
      ]
    };
  }

  function renderHealth() {
    const box = document.getElementById('supportHealthGrid');
    const score = document.getElementById('supportHealthScore');
    if (!box || !score) return;
    const snap = snapshot();
    const visible = snap.panels.filter((p) => p.visible).length;
    score.textContent = `${visible}/${snap.panels.length}`;
    box.innerHTML = snap.panels.map((panel) => `
      <article class="support-health-card ${panel.visible ? 'support-ok' : 'support-warn'}">
        <strong>${esc(panel.label)}</strong>
        <p>${panel.visible ? 'Visible in the app.' : 'Not visible yet. Try hard refresh, then run setup status.'}</p>
      </article>`).join('');
  }

  function saveReport(report) {
    const current = read(KEY, []);
    write(KEY, [...current, { exportedAt: report.generatedAt, panelCount: report.panels.filter((p) => p.visible).length, url: report.url }].slice(-20));
  }

  function exportSupportBundle() {
    const report = snapshot();
    saveReport(report);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-support-bundle-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Support bundle exported. It excludes broker secrets and API key values.');
    renderHealth();
  }

  async function copySummary() {
    const snap = snapshot();
    const text = [
      'Trader Command Center support summary',
      `Generated: ${snap.generatedAt}`,
      `URL: ${snap.url}`,
      `Persistence: ${snap.persistenceMode}`,
      `Panels visible: ${snap.panels.filter((p) => p.visible).length}/${snap.panels.length}`,
      `Missing panels: ${snap.panels.filter((p) => !p.visible).map((p) => p.label).join(', ') || 'none'}`,
      'Safety: no secrets included; paper/research by default; no autonomous live trading.'
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Support summary copied to clipboard.');
    } catch {
      setMessage(text);
    }
  }

  function setMessage(text) {
    const box = document.getElementById('supportRepairMessage');
    if (box) box.innerHTML = `<div class="support-note">${esc(text)}</div>`;
  }

  function hardRefreshHelp() {
    setMessage('Windows hard refresh: press Ctrl + F5. If the app still looks wrong, open DevTools with F12, right-click reload, then choose Empty Cache and Hard Reload.');
  }

  function scrollTo(selector) {
    const target = document.querySelector(selector);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function repairLocalView() {
    document.querySelectorAll('.kid-highlight').forEach((el) => el.classList.remove('kid-highlight'));
    document.body.classList.remove('workflow-compact');
    renderHealth();
    setMessage('Local view repair ran: removed temporary highlights, refreshed health cards, and kept all saved app data.');
  }

  function shell() {
    if (document.getElementById('supportRepairCenter')) return;
    const setup = document.getElementById('setupStatusCenter');
    const readiness = document.getElementById('releaseReadinessCenter');
    const section = document.createElement('section');
    section.id = 'supportRepairCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Support / Repair</span><h3>Fix view issues and export diagnostics</h3></div><strong id="supportHealthScore">Not checked</strong></div>
      <p class="muted">Use this when panels look duplicated, missing, overlapped, or stale after upgrades. It does not delete your data and never exports broker secrets or API key values.</p>
      <div class="support-actions">
        <button id="supportCheck" type="button">Refresh health view</button>
        <button id="supportBundle" type="button">Export support bundle</button>
        <button id="supportCopy" class="support-secondary" type="button">Copy support summary</button>
        <button id="supportBackup" class="support-secondary" type="button">Export full app backup</button>
        <button id="supportSetup" class="support-secondary" type="button">Go to setup status</button>
        <button id="supportHardRefresh" class="support-secondary" type="button">Show hard-refresh help</button>
        <button id="supportRepairView" class="support-secondary" type="button">Repair local view</button>
      </div>
      <div id="supportHealthGrid" class="support-health-grid"></div>
      <div id="supportRepairMessage" class="list"></div>`;
    if (setup?.parentNode) setup.parentNode.insertBefore(section, setup.nextSibling);
    else if (readiness?.parentNode) readiness.parentNode.insertBefore(section, readiness.nextSibling);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.support-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.support-actions button{width:auto}.support-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.support-health-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.support-health-card,.support-note{border:1px solid rgba(255,255,255,.14);border-left:4px solid #4cc9f0;border-radius:14px;padding:10px;background:rgba(255,255,255,.05);color:#d7e2f0}.support-health-card strong{color:#edf6ff}.support-health-card p{margin:6px 0 0}.support-ok{border-left-color:#a7f3d0}.support-warn{border-left-color:#fbbf24}@media(max-width:860px){.support-actions button{width:100%}.support-health-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('supportCheck').addEventListener('click', renderHealth);
    document.getElementById('supportBundle').addEventListener('click', exportSupportBundle);
    document.getElementById('supportCopy').addEventListener('click', copySummary);
    document.getElementById('supportBackup').addEventListener('click', () => {
      if (persist?.exportBundle) {
        const bundle = persist.exportBundle();
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trader-full-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage('Full app backup exported.');
      } else setMessage('Persistence export is not available yet. Try hard refresh first.');
    });
    document.getElementById('supportSetup').addEventListener('click', () => scrollTo('#setupStatusCenter'));
    document.getElementById('supportHardRefresh').addEventListener('click', hardRefreshHelp);
    document.getElementById('supportRepairView').addEventListener('click', repairLocalView);
    renderHealth();
  }

  document.addEventListener('trader:persistence-restored', renderHealth);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
