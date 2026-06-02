(() => {
  const persist = window.TraderPersistence;
  const LOG_KEY = 'live_broker_logs';
  const ACK_KEY = 'live_trading_acknowledged';
  const CONFIRMATION = 'LIVE ORDER - I ACCEPT REAL MONEY RISK';
  const DEFAULT_SETUP = { checked: false, configured: false, maxNotional: 0, message: 'Setup has not been checked yet.', killSwitchLocked: false, allowedSymbolsConfigured: false, allowedSymbols: [] };
  let setupState = { ...DEFAULT_SETUP };
  let accountState = { checked: false, configured: false, ok: false, data: null, message: 'Account has not been checked yet.' };

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };

  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };

  function sanitize(value, depth = 0) {
    if (depth > 5) return '[nested]';
    if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
    if (!value || typeof value !== 'object') return value;
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      if (/secret|token|password|key/i.test(key)) clean[key] = '[redacted]';
      else clean[key] = sanitize(item, depth + 1);
    }
    return clean;
  }

  function addLog(title, payload) {
    const row = { title, payload: sanitize(payload), time: new Date().toLocaleString() };
    write(LOG_KEY, [...read(LOG_KEY, []), row].slice(-100));
    renderLogs();
  }

  function acknowledged() {
    return read(ACK_KEY, null)?.accepted === true;
  }

  function setAcknowledged(value) {
    write(ACK_KEY, value ? { accepted: true, time: new Date().toISOString() } : null);
    renderGate();
    updateTicketState();
  }

  async function liveApi(action, payload) {
    const options = payload ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : undefined;
    const response = await fetch(`/api/alpaca-live?action=${encodeURIComponent(action)}`, options);
    return response.json();
  }

  function publicCheckLabel(key) {
    const text = String(key || '').toLowerCase();
    if (text.includes('kill_switch')) return 'Emergency kill switch off';
    if (text.includes('allowed_symbols')) return 'Optional symbol allowlist';
    if (text.includes('enable')) return 'Owner live-mode unlock';
    if (text.includes('key_id')) return 'Live broker key id on server';
    if (text.includes('secret')) return 'Live broker secret on server';
    if (text.includes('base_url')) return 'Live broker endpoint';
    if (text.includes('max_notional')) return 'Server max-notional cap';
    return 'Server safety check';
  }

  function publicCheckValue(key, value) {
    const text = String(key || '').toLowerCase();
    if (text.includes('allowed_symbols') && value === 'not_set_all_symbols_allowed') return 'not set - all symbols allowed';
    if (text.includes('kill_switch')) return value ? 'OK' : 'LOCKED';
    return value ? 'OK' : 'locked/missing';
  }

  function renderSetup(data) {
    const out = document.getElementById('liveControlOutput');
    const checks = Object.entries(data.checks || {}).map(([key, ok]) => `<span>${esc(publicCheckLabel(key))}: ${esc(publicCheckValue(key, ok))}</span>`).join('');
    const allowlist = data.allowedSymbolsConfigured
      ? `<p class="muted">Allowed live symbols: ${esc((data.allowedSymbols || []).join(', '))}</p>`
      : '<p class="muted">Optional symbol allowlist is not set. The server still enforces the live unlock, kill switch, account check, manual ticket, and max-notional cap.</p>';
    const kill = data.killSwitchLocked
      ? '<p class="live-kill">Emergency kill switch is ON. Live order submission is locked.</p>'
      : '<p class="live-ok">Emergency kill switch is OFF. Other live gates still apply.</p>';
    out.innerHTML = `<div class="live-control-note ${data.configured ? '' : 'live-control-bad'}"><strong>${data.configured ? 'Server live gate configured' : 'Server live gate locked'}</strong><p>${esc(data.message || 'No message returned.')}</p><div class="live-control-grid">${checks}</div><p class="muted">Server max-notional cap: ${money(data.maxNotional || 0)}</p>${allowlist}${kill}</div>`;
  }

  async function checkStatus() {
    const out = document.getElementById('liveControlOutput');
    out.innerHTML = '<div class="live-control-note">Checking server-side live trading gate...</div>';
    try {
      const data = await liveApi('setup-status');
      setupState = {
        checked: true,
        configured: Boolean(data.configured),
        maxNotional: Number(data.maxNotional || 0),
        message: data.message || '',
        killSwitchLocked: Boolean(data.killSwitchLocked),
        allowedSymbolsConfigured: Boolean(data.allowedSymbolsConfigured),
        allowedSymbols: Array.isArray(data.allowedSymbols) ? data.allowedSymbols : []
      };
      renderSetup(data);
      addLog('setup check', { configured: data.configured, maxNotional: data.maxNotional, killSwitchLocked: data.killSwitchLocked, allowedSymbolsConfigured: data.allowedSymbolsConfigured, message: data.message, checks: data.checks });
    } catch (error) {
      setupState = { ...DEFAULT_SETUP, checked: true, message: error.message || 'Setup check failed safely.' };
      out.innerHTML = `<div class="live-control-note live-control-bad">${esc(setupState.message)}</div>`;
      addLog('setup check failed', { message: setupState.message });
    }
    renderCap();
    updateTicketState();
    return setupState;
  }

  async function checkAccount() {
    const out = document.getElementById('liveAccountOutput');
    out.innerHTML = '<div class="live-control-note">Checking live account status safely...</div>';
    try {
      const data = await liveApi('status');
      accountState = { checked: true, configured: Boolean(data.configured), ok: Boolean(data.ok), data: sanitize(data.data || data), message: data.message || '' };
      const account = data.data || {};
      const details = data.configured && account
        ? `<div class="live-control-grid"><span>Status: ${esc(account.status || 'not returned')}</span><span>Buying power: ${esc(account.buying_power ? money(account.buying_power) : 'broker did not return')}</span><span>Equity: ${esc(account.equity ? money(account.equity) : 'broker did not return')}</span><span>Trading blocked: ${esc(String(account.trading_blocked ?? 'not returned'))}</span></div>`
        : `<p>${esc(data.message || 'Live account is not configured or could not be checked.')}</p>`;
      out.innerHTML = `<div class="live-control-note ${data.ok ? '' : 'live-control-bad'}"><strong>${data.ok ? 'Live account checked' : 'Live account check blocked'}</strong>${details}<p class="muted">Broker/account buying-power checks still apply at the broker after this app checks the server cap.</p></div>`;
      addLog('account check', { ok: data.ok, configured: data.configured, status: data.status, account: accountState.data, message: data.message });
    } catch (error) {
      accountState = { checked: true, configured: false, ok: false, data: null, message: error.message || 'Account check failed safely.' };
      out.innerHTML = `<div class="live-control-note live-control-bad">${esc(accountState.message)}</div>`;
      addLog('account check failed', { message: accountState.message });
    }
    updateTicketState();
    return accountState;
  }

  function ticketValues() {
    const symbol = document.getElementById('liveTicketSymbol')?.value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '') || '';
    const qty = Number(document.getElementById('liveTicketQty')?.value || 0);
    const limit = Number(document.getElementById('liveTicketLimit')?.value || 0);
    const side = document.getElementById('liveTicketSide')?.value || 'buy';
    const confirmation = document.getElementById('liveTicketConfirm')?.value.trim() || '';
    const risk = Boolean(document.getElementById('liveTicketRiskAck')?.checked);
    const humanReviewed = Boolean(document.getElementById('liveTicketHumanReviewed')?.checked);
    return {
      symbol,
      qty,
      limit,
      side,
      type: 'limit',
      time_in_force: 'day',
      confirmation,
      risk,
      humanReviewed,
      notional: qty * limit
    };
  }

  function validationMessage(values = ticketValues()) {
    if (!acknowledged() || !values.risk) return 'Locked: click the real-money risk acknowledgement first.';
    if (!values.humanReviewed) return 'Locked: human review checkbox is required.';
    if (values.confirmation !== CONFIRMATION) return 'Locked: type the exact confirmation phrase.';
    if (!values.symbol) return 'Locked: enter a positive symbol.';
    if (!Number.isFinite(values.qty) || values.qty <= 0) return 'Locked: quantity must be positive.';
    if (!Number.isFinite(values.limit) || values.limit <= 0) return 'Locked: limit price must be positive.';
    if (!setupState.checked) return 'Locked: run setup check first.';
    if (setupState.killSwitchLocked) return 'Locked: emergency server kill switch is active.';
    if (setupState.allowedSymbolsConfigured && !setupState.allowedSymbols.includes(values.symbol)) return 'Locked: symbol is not on the server allowlist.';
    if (!setupState.configured) return 'Locked: server live gate is not configured.';
    if (!accountState.checked) return 'Locked: check live account before submit.';
    if (!accountState.configured || !accountState.ok) return 'Locked: live account check did not pass.';
    if (!Number.isFinite(setupState.maxNotional) || setupState.maxNotional <= 0) return 'Locked: server max-notional cap is missing.';
    if (values.notional > setupState.maxNotional) return 'Locked: estimated notional is over the server cap.';
    return 'Ready for manual submit after account check. Broker buying-power checks still apply.';
  }

  function renderCap() {
    const values = ticketValues();
    const box = document.getElementById('liveTicketCapStatus');
    const cap = setupState.maxNotional || 0;
    if (!box) return;
    const under = cap > 0 && values.notional > 0 && values.notional <= cap;
    const over = cap > 0 && values.notional > cap;
    const allowText = setupState.allowedSymbolsConfigured
      ? `Allowed symbols: ${setupState.allowedSymbols.join(', ') || 'none returned'}. ${values.symbol && !setupState.allowedSymbols.includes(values.symbol) ? 'This symbol is not allowed.' : ''}`
      : 'No server symbol allowlist is set.';
    box.innerHTML = `<div class="live-cap ${over ? 'live-cap-over' : under ? 'live-cap-under' : ''}"><span>Estimated notional</span><strong>${money(values.notional)}</strong><p>Server max-notional cap: ${cap > 0 ? money(cap) : 'not checked yet'}. ${over ? 'This ticket is over the cap and blocked.' : under ? 'This ticket is under the cap.' : 'Run setup check and enter quantity plus limit price.'}</p><p class="muted">${esc(allowText)}</p><p class="muted">Broker/account buying-power checks still apply.</p></div>`;
  }

  function updateTicketState() {
    renderCap();
    const values = ticketValues();
    const message = validationMessage(values);
    const status = document.getElementById('liveTicketStatus');
    const submit = document.getElementById('liveTicketSubmit');
    if (status) status.textContent = message;
    if (submit) submit.disabled = !message.startsWith('Ready');
  }

  function renderGate() {
    const state = document.getElementById('liveControlGate');
    const checklist = document.getElementById('liveControlChecklist');
    if (!state || !checklist) return;
    const ok = acknowledged();
    state.textContent = ok ? 'Local risk acknowledgement saved' : 'Live ticket locked';
    checklist.classList.toggle('live-control-ready', ok);
  }

  function renderLogs() {
    const box = document.getElementById('liveControlLogs');
    if (!box) return;
    const logs = read(LOG_KEY, []);
    box.innerHTML = logs.length
      ? logs.slice().reverse().slice(0, 10).map((row) => `<div class="item"><div><strong>${esc(row.title)}</strong><p>${esc(JSON.stringify(row.payload).slice(0, 420))}</p><p>${esc(row.time)}</p></div></div>`).join('')
      : '<p class="muted">No live-mode log entries yet.</p>';
  }

  function lockLiveMode(reason = 'Manual lock requested.') {
    setAcknowledged(false);
    const risk = document.getElementById('liveTicketRiskAck');
    const human = document.getElementById('liveTicketHumanReviewed');
    const confirm = document.getElementById('liveTicketConfirm');
    if (risk) risk.checked = false;
    if (human) human.checked = false;
    if (confirm) confirm.value = '';
    addLog('lock live mode', { reason });
    updateTicketState();
  }

  async function submitTicket(event) {
    event.preventDefault();
    const values = ticketValues();
    const preMessage = validationMessage(values);
    if (!preMessage.startsWith('Ready')) {
      addLog('blocked ticket', { reason: preMessage, ticket: { symbol: values.symbol, qty: values.qty, side: values.side, limit: values.limit, notional: values.notional } });
      document.getElementById('liveTicketResponse').innerHTML = `<div class="live-control-note live-control-bad"><strong>Ticket blocked</strong><p>${esc(preMessage)}</p></div>`;
      updateTicketState();
      return;
    }

    const setup = await checkStatus();
    if (!setup.configured || values.notional > setup.maxNotional || setup.killSwitchLocked || (setup.allowedSymbolsConfigured && !setup.allowedSymbols.includes(values.symbol))) {
      addLog('blocked ticket', { reason: validationMessage(values), ticket: { symbol: values.symbol, qty: values.qty, side: values.side, limit: values.limit, notional: values.notional } });
      document.getElementById('liveTicketResponse').innerHTML = `<div class="live-control-note live-control-bad"><strong>Ticket blocked</strong><p>${esc(validationMessage(values))}</p></div>`;
      return;
    }

    const account = await checkAccount();
    if (!account.configured || !account.ok) {
      addLog('blocked ticket', { reason: 'Live account check did not pass.', account: account.data || account.message });
      document.getElementById('liveTicketResponse').innerHTML = '<div class="live-control-note live-control-bad"><strong>Ticket blocked</strong><p>Live account check did not pass. No live order was sent.</p></div>';
      return;
    }

    const payload = {
      manualSubmission: true,
      humanReviewed: true,
      confirmation: values.confirmation,
      symbol: values.symbol,
      qty: values.qty,
      side: values.side,
      type: 'limit',
      time_in_force: 'day',
      limit_price: values.limit,
      clientContext: 'manual_live_order_ticket_v1'
    };
    addLog('submitted manual live ticket', { symbol: values.symbol, qty: values.qty, side: values.side, type: 'limit', time_in_force: 'day', limitPrice: values.limit, estimatedNotional: values.notional });
    const responseBox = document.getElementById('liveTicketResponse');
    responseBox.innerHTML = '<div class="live-control-note">Submitting manual live limit-day ticket to the server gate...</div>';
    try {
      const data = await liveApi('submit-order', payload);
      addLog('broker response', data);
      responseBox.innerHTML = `<div class="live-control-note ${data.ok ? '' : 'live-control-bad'}"><strong>${data.ok ? 'Broker response received' : 'Live order was not accepted'}</strong><p>${esc(data.message || data.warning || 'Review the response below and verify directly with Alpaca.')}</p><pre class="live-response">${esc(JSON.stringify(sanitize(data), null, 2))}</pre></div>`;
    } catch (error) {
      addLog('broker response failed', { message: error.message || 'Submit failed safely.' });
      responseBox.innerHTML = `<div class="live-control-note live-control-bad"><strong>Submit failed safely</strong><p>${esc(error.message || 'No live order response was received.')}</p></div>`;
    } finally {
      lockLiveMode('Live ticket attempt finished; local live mode relocked.');
    }
  }

  function exportChecklist() {
    const report = {
      exportedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      mode: 'optional_manual_live_trading_readiness',
      realMoneyWarning: true,
      notInvestmentAdvice: true,
      autonomousLiveTradingAllowed: false,
      allowedFlow: 'manual-only, limit-only, day-only, human-reviewed, server-capped',
      emergencyKillSwitch: 'TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING locks live order submission',
      optionalSymbolAllowlist: 'TRADER_LIVE_ALLOWED_SYMBOLS limits manual live tickets to specific symbols',
      confirmationRequired: CONFIRMATION,
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
    addLog('live readiness exported', report);
  }

  function shell() {
    if (document.getElementById('liveTradingControl')) return;
    const paper = document.getElementById('paperBroker');
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'liveTradingControl';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Optional Live Trading</span><h3>Manual live trading is locked by default</h3></div><strong id="liveControlGate">Live ticket locked</strong></div>
      <p class="muted">This optional area is for human-reviewed real-money readiness only. The app does not choose trades. AI/autopilot cannot submit live trades. Guided Workflow, AI Coach, Safe Autopilot, Strategy Evolution, Validation Forge, and AI Brain are not connected to live order submission.</p>
      <div class="live-control-warning"><strong>Real money warning</strong><p>Real money can be lost. Nothing here is investment advice, no profit is guaranteed, and you must verify every action directly with your broker.</p></div>
      <div id="liveControlChecklist" class="persist-steps">
        <div><strong>1. Server-side unlock required.</strong><p class="muted">The owner must enable live mode in Vercel server settings. Without the exact server unlock, live mode remains locked.</p></div>
        <div><strong>2. Emergency kill switch stays available.</strong><p class="muted">Set TRADER_LIVE_KILL_SWITCH=LOCK_LIVE_TRADING to immediately block live order submission without deleting broker keys.</p></div>
        <div><strong>3. Optional symbol allowlist.</strong><p class="muted">Set TRADER_LIVE_ALLOWED_SYMBOLS to restrict manual live tickets to specific symbols.</p></div>
        <div><strong>4. Live broker keys stay server-side.</strong><p class="muted">Live broker credentials belong only in Vercel environment variables. Never paste live secrets into this browser.</p></div>
        <div><strong>5. Risk cap required.</strong><p class="muted">The server must have a small max-notional cap. The backend blocks requests above that cap.</p></div>
        <div><strong>6. Manual-only final action.</strong><p class="muted">A human must review risk, broker status, account balance, order details, fees, and tax consequences.</p></div>
      </div>
      <div class="live-control-actions">
        <button id="liveControlStatus" type="button">Check live setup</button>
        <button id="liveControlAck" type="button">I understand real-money risk</button>
        <button id="liveControlLock" class="live-control-secondary" type="button">Lock live mode</button>
        <button id="liveControlExport" class="live-control-secondary" type="button">Export readiness checklist</button>
      </div>
      <div id="liveControlOutput" class="list"></div>
      <article id="manualLiveOrderTicket" class="live-ticket" aria-label="Manual Live Order Ticket">
        <div class="section-head"><div><span class="label">Manual Live Order Ticket</span><h3>Human-reviewed limit-day ticket</h3></div><strong id="liveTicketStatus">Locked: run setup check first.</strong></div>
        <p class="muted">This manual ticket is locked by default. It only allows limit orders, day orders, a buy/sell side, a positive symbol, a positive quantity, and a positive limit price. Broker buying-power checks still apply.</p>
        <form id="liveTicketForm" class="form-grid">
          <label>Symbol <input id="liveTicketSymbol" autocomplete="off" placeholder="AAPL" /></label>
          <label>Side <select id="liveTicketSide"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
          <label>Quantity <input id="liveTicketQty" type="number" min="0" step="1" placeholder="1" /></label>
          <label>Limit price <input id="liveTicketLimit" type="number" min="0" step="0.01" placeholder="100.00" /></label>
          <label>Order type <input value="Limit only" disabled /></label>
          <label>Time in force <input value="Day only" disabled /></label>
          <label class="wide live-check"><input id="liveTicketRiskAck" type="checkbox" /> I understand this is real money and losses are possible.</label>
          <label class="wide live-check"><input id="liveTicketHumanReviewed" type="checkbox" /> I am a human and I reviewed symbol, side, quantity, limit price, risk, and broker account status.</label>
          <label class="wide">Exact confirmation <input id="liveTicketConfirm" autocomplete="off" placeholder="${CONFIRMATION}" /></label>
          <div id="liveTicketCapStatus" class="wide"></div>
          <button id="liveTicketSubmit" class="wide" type="submit" disabled>Submit manual live limit-day ticket</button>
        </form>
        <div class="live-control-actions">
          <button id="liveTicketSetup" type="button">Run setup check</button>
          <button id="liveTicketAccount" class="live-control-secondary" type="button">Check account before submit</button>
          <button id="liveTicketLock" class="live-control-secondary" type="button">Lock live mode</button>
        </div>
        <div id="liveAccountOutput" class="list"></div>
        <div id="liveTicketResponse" class="list"></div>
      </article>
      <div id="liveControlLogs" class="list"></div>`;

    if (paper?.parentNode) paper.parentNode.insertBefore(section, paper.nextSibling);
    else if (safety?.parentNode) safety.parentNode.insertBefore(section, safety);
    else document.querySelector('.shell')?.appendChild(section);

    const style = document.createElement('style');
    style.textContent = `.live-control-warning,.live-control-note,.live-ticket{border-left:4px solid #fbbf24;background:rgba(251,191,36,.08);border-radius:14px;padding:12px;margin:12px 0;color:#edf6ff}.live-ticket{border:1px solid rgba(251,191,36,.32);background:rgba(255,255,255,.04)}.live-control-bad{border-left-color:#f87171;background:rgba(248,113,113,.08)}.live-ok{border-left:4px solid #a7f3d0;background:rgba(167,243,208,.08);border-radius:12px;padding:8px 10px}.live-kill{border-left:4px solid #f87171;background:rgba(248,113,113,.1);border-radius:12px;padding:8px 10px}.live-control-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.live-control-actions button{width:auto}.live-control-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.live-control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.live-control-grid span,.live-cap{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:10px;background:rgba(255,255,255,.055)}.live-control-ready{box-shadow:0 0 0 2px rgba(251,191,36,.25)}.live-check{display:grid;grid-template-columns:auto 1fr;align-items:center}.live-check input{width:auto}.live-cap strong{display:block;font-size:24px;margin:4px 0}.live-cap-under{border-left:4px solid #a7f3d0}.live-cap-over{border-left:4px solid #f87171}.live-response{white-space:pre-wrap;overflow:auto;max-height:360px;color:#d7e2f0}.live-ticket button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:860px){.live-control-actions button{width:100%}.live-control-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);

    document.getElementById('liveControlStatus').addEventListener('click', checkStatus);
    document.getElementById('liveControlAck').addEventListener('click', () => { setAcknowledged(true); addLog('real-money risk acknowledgement', { accepted: true, note: 'Local acknowledgement saved. Server gates still apply.' }); });
    document.getElementById('liveControlLock').addEventListener('click', () => lockLiveMode('User clicked Lock live mode.'));
    document.getElementById('liveControlExport').addEventListener('click', exportChecklist);
    document.getElementById('liveTicketSetup').addEventListener('click', checkStatus);
    document.getElementById('liveTicketAccount').addEventListener('click', checkAccount);
    document.getElementById('liveTicketLock').addEventListener('click', () => lockLiveMode('User clicked ticket Lock live mode.'));
    document.getElementById('liveTicketForm').addEventListener('submit', submitTicket);
    ['liveTicketSymbol', 'liveTicketSide', 'liveTicketQty', 'liveTicketLimit', 'liveTicketRiskAck', 'liveTicketHumanReviewed', 'liveTicketConfirm'].forEach((id) => {
      document.getElementById(id).addEventListener('input', updateTicketState);
      document.getElementById(id).addEventListener('change', updateTicketState);
    });
    renderGate();
    renderLogs();
    updateTicketState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
