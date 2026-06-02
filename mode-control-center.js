(() => {
  const persist = window.TraderPersistence;
  const KEY = 'trading_mode_control';
  const DEFAULT = { mode: 'paper', updatedAt: null, liveReadinessViewed: false, liveAcknowledged: false };
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const read = (name, fallback) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    const next = { ...value, updatedAt: new Date().toISOString() };
    if (persist) persist.write(name, next);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(next));
  };
  const readState = () => ({ ...DEFAULT, ...(read(KEY, DEFAULT) || {}) });
  const writeState = (next) => write(KEY, { ...readState(), ...next });

  function activeMode() {
    return readState().mode === 'live-readiness' ? 'live-readiness' : 'paper';
  }

  function setMode(mode) {
    writeState({ mode });
    renderMode();
    const target = mode === 'live-readiness' ? document.getElementById('liveTradingControl') : document.getElementById('guidedWorkflow');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderMode() {
    const panel = document.getElementById('modeControlCenter');
    if (!panel) return;
    const mode = activeMode();
    panel.dataset.mode = mode;
    document.getElementById('modeControlStatus').textContent = mode === 'paper' ? 'Paper / Research active' : 'Live readiness review active';
    document.getElementById('modeControlPaper').setAttribute('aria-pressed', String(mode === 'paper'));
    document.getElementById('modeControlLive').setAttribute('aria-pressed', String(mode === 'live-readiness'));
    document.body.classList.toggle('live-readiness-mode', mode === 'live-readiness');
    const explainer = document.getElementById('modeControlExplainer');
    explainer.innerHTML = mode === 'paper'
      ? '<strong>Safe default:</strong> Paper/research mode is active. Guided Workflow, AI Coach, Safe Autopilot, strategy evolution, validation, charting, and broker practice remain paper/research scoped.'
      : '<strong>Review mode only:</strong> You are viewing live-readiness controls. AI/autopilot still cannot place live trades. Real-money setup remains locked unless server-side gates are configured.';
  }

  async function checkLiveGate() {
    const output = document.getElementById('modeControlOutput');
    output.innerHTML = '<div class="mode-note">Checking live-readiness gate...</div>';
    try {
      const res = await fetch('/api/alpaca-live?action=setup-status');
      const data = await res.json();
      const checks = Object.entries(data.checks || {}).map(([k, v]) => `<span>${esc(k)}: ${v ? 'OK' : 'locked/missing'}</span>`).join('');
      output.innerHTML = `<div class="mode-note ${data.configured ? '' : 'mode-bad'}"><strong>${data.configured ? 'Server live gate configured' : 'Server live gate locked'}</strong><p>${esc(data.message || 'No status message returned.')}</p><div class="mode-check-grid">${checks}</div></div>`;
      writeState({ liveReadinessViewed: true, lastLiveGateConfigured: Boolean(data.configured) });
      renderMode();
    } catch (error) {
      output.innerHTML = `<div class="mode-note mode-bad">${esc(error.message || 'Live gate check failed safely.')}</div>`;
    }
  }

  function shell() {
    if (document.getElementById('modeControlCenter')) return;
    const workflow = document.getElementById('guidedWorkflow');
    const hero = document.querySelector('.hero');
    const section = document.createElement('section');
    section.id = 'modeControlCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Mode Control</span><h3>Choose paper practice or live-readiness review</h3></div><strong id="modeControlStatus">Paper / Research active</strong></div>
      <p class="muted">Paper/research is the safe default. Live-readiness is an optional real-money review area; it does not allow AI, Safe Autopilot, Guided Workflow, Strategy Evolution, or Validation Forge to place live trades.</p>
      <div class="mode-actions">
        <button id="modeControlPaper" type="button" aria-pressed="true">Use Paper / Research</button>
        <button id="modeControlLive" class="mode-secondary" type="button" aria-pressed="false">Review Optional Live Setup</button>
        <button id="modeControlCheck" class="mode-secondary" type="button">Check Live Gate</button>
      </div>
      <div id="modeControlExplainer" class="mode-note"></div>
      <div id="modeControlOutput" class="list"></div>`;
    if (workflow?.parentNode) workflow.parentNode.insertBefore(section, workflow.nextSibling);
    else if (hero?.parentNode) hero.parentNode.insertBefore(section, hero.nextSibling);
    else document.querySelector('.shell')?.prepend(section);

    const style = document.createElement('style');
    style.textContent = `.mode-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.mode-actions button{width:auto}.mode-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.mode-note{border-left:4px solid #4cc9f0;background:rgba(76,201,240,.08);border-radius:14px;padding:12px;color:#edf6ff}.mode-bad{border-left-color:#f87171;background:rgba(248,113,113,.08)}.mode-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.mode-check-grid span{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px;background:rgba(255,255,255,.055)}#modeControlCenter[data-mode="live-readiness"]{box-shadow:0 0 0 2px rgba(251,191,36,.25),0 18px 56px rgba(0,0,0,.22)}#modeControlCenter[data-mode="live-readiness"] #modeControlStatus{color:#fbbf24}@media(max-width:860px){.mode-actions button{width:100%}.mode-check-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('modeControlPaper').addEventListener('click', () => setMode('paper'));
    document.getElementById('modeControlLive').addEventListener('click', () => setMode('live-readiness'));
    document.getElementById('modeControlCheck').addEventListener('click', checkLiveGate);
    renderMode();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
