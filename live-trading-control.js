(() => {
  const persist = window.TraderPersistence;
  const LOG_KEY = 'live_broker_logs';
  const ACK_KEY = 'live_trading_acknowledged';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };

  function addLog(title, text) {
    const row = { title, text, time: new Date().toLocaleString() };
    write(LOG_KEY, [...read(LOG_KEY, []), row].slice(-80));
    renderLogs();
  }

  function acknowledged() {
    return read(ACK_KEY, null)?.accepted === true;
  }

  function setAcknowledged(value) {
    write(ACK_KEY, value ? { accepted: true, time: new Date().toISOString() } : null);
    renderGate();
  }

  async function checkStatus() {
    const out = document.getElementById('liveControlOutput');
    out.innerHTML = '<div class="live-control-note">Checking server-side live trading gate...</div>';
    try {
      const response = await fetch('/api/alpaca-live?action=setup-status');
      const data = await response.json();
      const checks = data.checks || {};
      const rows = Object.entries(checks).map(([key, ok]) => `<span>${esc(key)}: ${ok ? 'OK' : 'locked/missing'}</span>`).join('');
      out.innerHTML = `<div class="live-control-note ${data.configured ? '' : 'live-control-bad'}"><strong>${data.configured ? 'Server live gate configured' : 'Server live gate locked'}</strong><p>${esc(data.message || 'No message returned.')}</p><div class="live-control-grid">${rows}</div><p class="muted">Max notional cap: ${esc(data.maxNotional || 0)}</p></div>`;
      addLog('Live setup check', `${data.configured ? 'Configured' : 'Locked'} - ${data.message || ''}`);
    } catch (error) {
      out.innerHTML = `<div class="live-control-note live-control-bad">${esc(error.message || 'Live setup check failed safely.')}</div>`;
      addLog('Live setup check failed', error.message || 'Unknown error');
    }
  }

  function renderGate() {
    const state = document.getElementById('liveControlGate');
    const checklist = document.getElementById('liveControlChecklist');
    if (!state || !checklist) return;
    const ok = acknowledged();
    state.textContent = ok ? 'Local acknowledgement saved' : 'Local acknowledgement missing';
    checklist.classList.toggle('live-control-ready', ok);
  }

  function renderLogs() {
    const box = document.getElementById('liveControlLogs');
    if (!box) return;
    const logs = read(LOG_KEY, []);
    box.innerHTML = logs.length ? logs.slice().reverse().slice(0, 8).map((row) => `<div class="item"><div><strong>${esc(row.title)}</strong><p>${esc(row.text)}</p><p>${esc(row.time)}</p></div></div>`).join('') : '<p class="muted">No live-mode log entries yet.</p>';
  }

  function exportChecklist() {
    const report = {
      exportedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      mode: 'optional_live_trading_readiness',
      realMoneyWarning: true,
      notInvestmentAdvice: true,
      autonomousLiveTradingAllowed: false,
      requiredServerVariables: [
        'TRADER_ENABLE_LIVE_TRADING=I_UNDERSTAND_LIVE_TRADING_RISK',
        'ALPACA_LIVE_KEY_ID',
        'ALPACA_LIVE_SECRET_KEY',
        'ALPACA_LIVE_BASE_URL=https://api.alpaca.markets',
        'TRADER_LIVE_MAX_NOTIONAL'
      ],
      allowedMode: 'manual-only, server-gated, capped, non-autonomous',
      confirmationRequired: 'LIVE ORDER - I ACCEPT REAL MONEY RISK',
      localAcknowledgement: acknowledged(),
      note: 'Use the broker directly for final review. This app must not choose trades or guarantee profit.'
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-live-readiness-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('Live readiness exported', 'Downloaded live-mode readiness checklist.');
  }

  function shell() {
    if (document.getElementById('liveTradingControl')) return;
    const paper = document.getElementById('paperBroker');
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'liveTradingControl';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Optional Live Trading</span><h3>Real-money mode is locked by default</h3></div><strong id="liveControlGate">Local acknowledgement missing</strong></div>
      <p class="muted">This app can include an optional real-money path, but it is not autonomous. Live mode is manual-only, server-gated, capped, and never controlled by AI, Safe Autopilot, Guided Workflow, Strategy Evolution, or Validation Forge.</p>
      <div class="live-control-warning"><strong>Real money warning</strong><p>Live trading can lose money. Nothing here is investment advice, no profit is guaranteed, and you must verify every action directly with your broker.</p></div>
      <div id="liveControlChecklist" class="persist-steps">
        <div><strong>1. Server-side unlock required.</strong><p class="muted">Set TRADER_ENABLE_LIVE_TRADING=I_UNDERSTAND_LIVE_TRADING_RISK in Vercel. Without that exact value, live mode remains locked.</p></div>
        <div><strong>2. Live broker keys stay server-side.</strong><p class="muted">Use ALPACA_LIVE_KEY_ID and ALPACA_LIVE_SECRET_KEY only as Vercel environment variables. Never paste live secrets into this browser.</p></div>
        <div><strong>3. Risk cap required.</strong><p class="muted">Set TRADER_LIVE_MAX_NOTIONAL to a small dollar amount. The backend blocks requests above that cap.</p></div>
        <div><strong>4. Manual-only final action.</strong><p class="muted">AI/autopilot cannot submit live orders. A human must review risk, broker status, account balance, order details, fees, and tax consequences.</p></div>
      </div>
      <div class="live-control-actions">
        <button id="liveControlStatus" type="button">Check live setup</button>
        <button id="liveControlAck" type="button">I understand real-money risk</button>
        <button id="liveControlLock" class="live-control-secondary" type="button">Lock local acknowledgement</button>
        <button id="liveControlExport" class="live-control-secondary" type="button">Export readiness checklist</button>
      </div>
      <div id="liveControlOutput" class="list"></div>
      <div id="liveControlLogs" class="list"></div>`;
    if (paper?.parentNode) paper.parentNode.insertBefore(section, paper.nextSibling);
    else if (safety?.parentNode) safety.parentNode.insertBefore(section, safety);
    else document.querySelector('.shell')?.appendChild(section);

    const style = document.createElement('style');
    style.textContent = `.live-control-warning,.live-control-note{border-left:4px solid #fbbf24;background:rgba(251,191,36,.08);border-radius:14px;padding:12px;margin:12px 0;color:#edf6ff}.live-control-bad{border-left-color:#f87171;background:rgba(248,113,113,.08)}.live-control-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.live-control-actions button{width:auto}.live-control-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.live-control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.live-control-grid span{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px;background:rgba(255,255,255,.055)}.live-control-ready{box-shadow:0 0 0 2px rgba(251,191,36,.25)}@media(max-width:860px){.live-control-actions button{width:100%}.live-control-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('liveControlStatus').addEventListener('click', checkStatus);
    document.getElementById('liveControlAck').addEventListener('click', () => { setAcknowledged(true); addLog('Local live risk acknowledgement', 'User acknowledged real-money risk locally. Server gates still apply.'); });
    document.getElementById('liveControlLock').addEventListener('click', () => { setAcknowledged(false); addLog('Local live acknowledgement locked', 'Local acknowledgement was removed.'); });
    document.getElementById('liveControlExport').addEventListener('click', exportChecklist);
    renderGate();
    renderLogs();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
