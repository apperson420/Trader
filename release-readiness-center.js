(() => {
  const persist = window.TraderPersistence;
  const KEY = 'release_readiness';
  const DEFAULT = { checked: [], updatedAt: null, exportedAt: null };
  const items = [
    ['paperDefault', 'Paper/research mode is the safe default.'],
    ['guidedWorkflow', 'Guided Workflow walks through watchlist, market intelligence, chart, evolution, validation, paper plan, and backup.'],
    ['backup', 'Backup/export works before relying on this browser.'],
    ['paperBroker', 'Alpaca paper setup is optional and server-side.'],
    ['liveLocked', 'Optional live trading is locked by default.'],
    ['liveKill', 'Emergency live kill switch is documented and visible.'],
    ['liveAllowlist', 'Optional live symbol allowlist is documented and visible.'],
    ['manualOnly', 'Live ticket is manual-only, limit/day only, human-reviewed, and exact-confirmation gated.'],
    ['qa', 'GitHub/Vercel QA and safety checks are the source of truth before release.'],
    ['noAdvice', 'No profit guarantees, no investment advice, and no autonomous live trading.']
  ];
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const read = () => {
    if (persist) return { ...DEFAULT, ...(persist.read(KEY, DEFAULT) || {}) };
    try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(`trader_${KEY}`) || 'null') || {}) }; } catch { return { ...DEFAULT }; }
  };
  const write = (next) => {
    const state = { ...read(), ...next, updatedAt: new Date().toISOString() };
    if (persist) persist.write(KEY, state);
    else localStorage.setItem(`trader_${KEY}`, JSON.stringify(state));
    return state;
  };
  function setChecked(id, done) {
    const current = new Set(read().checked || []);
    if (done) current.add(id); else current.delete(id);
    write({ checked: [...current] });
    render();
  }
  function exportReport() {
    const state = read();
    const complete = new Set(state.checked || []);
    const report = {
      exportedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      releaseReadiness: `${complete.size}/${items.length}`,
      safeDefault: 'paper/research mode',
      liveTradingPosture: 'optional manual live-readiness only; locked unless server-side env vars are configured',
      autonomousLiveTradingAllowed: false,
      browserSecretsAllowed: false,
      requiredHumanLiveControls: ['real-money acknowledgement', 'human review checkbox', 'exact confirmation phrase', 'server max-notional cap', 'optional kill switch', 'optional symbol allowlist'],
      checklist: items.map(([id, label]) => ({ id, label, complete: complete.has(id) })),
      note: 'This readiness receipt is not investment advice and does not prove profitability.'
    };
    write({ exportedAt: report.exportedAt });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-release-readiness-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    render();
  }
  function shell() {
    if (document.getElementById('releaseReadinessCenter')) return;
    const live = document.getElementById('liveTradingControl');
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'releaseReadinessCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Release Readiness</span><h3>Owner release checklist</h3></div><strong id="releaseReadyScore">0/${items.length}</strong></div>
      <p class="muted">Use this as the final owner gate before trusting or sharing the app. It keeps the product honest: useful for research, locked for live money, and never an autonomous profit machine.</p>
      <div id="releaseReadyItems" class="release-ready-items"></div>
      <div class="release-ready-actions">
        <button id="releaseReadyMarkCore" type="button">Mark safe core reviewed</button>
        <button id="releaseReadyExport" class="release-ready-secondary" type="button">Export readiness receipt</button>
        <button id="releaseReadyReset" class="release-ready-secondary" type="button">Reset checklist</button>
      </div>
      <p id="releaseReadyNote" class="muted"></p>`;
    if (live?.parentNode) live.parentNode.insertBefore(section, live.nextSibling);
    else if (safety?.parentNode) safety.parentNode.insertBefore(section, safety);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.release-ready-items{display:grid;gap:8px;margin:12px 0}.release-ready-item{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px;background:rgba(255,255,255,.05)}.release-ready-item input{width:auto;margin-top:3px}.release-ready-item strong{color:#edf6ff}.release-ready-item small{display:block;color:#c7d4e5;margin-top:3px}.release-ready-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.release-ready-actions button{width:auto}.release-ready-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}@media(max-width:860px){.release-ready-actions button{width:100%}}`;
    document.head.appendChild(style);
    document.getElementById('releaseReadyExport').addEventListener('click', exportReport);
    document.getElementById('releaseReadyReset').addEventListener('click', () => { write({ checked: [] }); render(); });
    document.getElementById('releaseReadyMarkCore').addEventListener('click', () => {
      write({ checked: items.map(([id]) => id) });
      render();
    });
    render();
  }
  function render() {
    const box = document.getElementById('releaseReadyItems');
    const score = document.getElementById('releaseReadyScore');
    const note = document.getElementById('releaseReadyNote');
    if (!box || !score || !note) return;
    const state = read();
    const checked = new Set(state.checked || []);
    score.textContent = `${checked.size}/${items.length}`;
    box.innerHTML = items.map(([id, label], index) => `<label class="release-ready-item"><input type="checkbox" data-ready-id="${esc(id)}" ${checked.has(id) ? 'checked' : ''}><span><strong>${index + 1}. ${esc(label)}</strong><small>${checked.has(id) ? 'Reviewed' : 'Not reviewed yet'}</small></span></label>`).join('');
    box.querySelectorAll('input[data-ready-id]').forEach((input) => input.addEventListener('change', () => setChecked(input.dataset.readyId, input.checked)));
    note.textContent = state.exportedAt ? `Last readiness receipt exported: ${new Date(state.exportedAt).toLocaleString()}` : 'No readiness receipt exported yet.';
  }
  document.addEventListener('trader:persistence-restored', render);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
