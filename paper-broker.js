(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

  const style = document.createElement('style');
  style.textContent = `.broker-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px;margin-top:10px}.broker-card strong{color:#4cc9f0}.broker-good{border-left:4px solid #34d399}.broker-warn{border-left:4px solid #fbbf24}.broker-danger{border-left:4px solid #f87171}.broker-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.broker-row span{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:9px;background:rgba(0,0,0,.15);color:#c7d4e5}.broker-pill{display:inline-flex;border:1px solid rgba(167,243,208,.35);background:rgba(167,243,208,.1);color:#a7f3d0;border-radius:999px;padding:6px 9px;margin:3px;font-weight:900;font-size:12px}.broker-lock{border-left:4px solid #f87171;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.045);color:#d7e2f0}.broker-small{font-size:13px;color:#c7d4e5}.broker-setup-grid{display:grid;gap:10px}.broker-step{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);border-radius:14px;padding:10px}.broker-step input{width:auto;margin-top:4px}.broker-code{font-family:Consolas,monospace;color:#a7f3d0}.broker-status-list{display:grid;gap:8px;margin-top:10px}.broker-status-list span{display:block;border-radius:12px;padding:8px 10px;background:rgba(0,0,0,.16);color:#d7e2f0}@media(max-width:860px){.broker-row{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  function ownerHeaders(base = {}) {
    const code = window.TraderOwnerAccess?.getCode?.() || '';
    return code ? { ...base, 'x-trader-owner-code': code } : base;
  }

  async function api(action, payload) {
    const headers = ownerHeaders(payload ? { 'content-type': 'application/json' } : {});
    const options = payload ? { method: 'POST', headers, body: JSON.stringify(payload) } : { headers };
    const response = await fetch(`/api/alpaca-paper?action=${encodeURIComponent(action)}`, options);
    return response.json();
  }

  function addUI() {
    if (document.getElementById('paperBroker')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'paperBroker';
    section.className = 'grid two';
    section.innerHTML = `
      <article class="panel smart-panel">
        <div class="section-head"><div><span class="label">Paper Broker Control Center</span><h3>Alpaca paper trading, safely gated</h3></div><strong id="brokerStatus">Locked</strong></div>
        <p class="muted">This is the professional bridge from learning app to real paper brokerage. It checks account status, positions, open paper orders, and can submit paper-only orders only after explicit confirmation.</p>
        <div><span class="broker-pill">Paper only</span><span class="broker-pill">Server-side keys</span><span class="broker-pill">Visible audit log</span><span class="broker-pill">No real-money orders</span><span class="broker-pill">Owner access aware</span></div>
        <div class="evo-actions"><button id="brokerCheck" type="button">Check paper account</button><button id="brokerPositions" type="button">Load positions</button><button id="brokerOrders" type="button">Load open orders</button></div>
        <div id="brokerOutput" class="result-box stacked"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Paper Order Ticket</span><h3>Explicit approval required</h3></div></div>
        <div class="broker-lock"><strong>Safety lock:</strong> This form can only submit to Alpaca paper trading after Vercel has paper keys configured and the confirmation field says PAPER ONLY. If owner access is configured, unlock it at the top first.</div>
        <form id="paperOrderForm" class="form-grid">
          <label>Symbol <input id="paperSymbol" value="AAPL" /></label>
          <label>Quantity <input id="paperQty" type="number" min="1" step="1" value="1" /></label>
          <label>Side <select id="paperSide"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
          <label>Order type <select id="paperType"><option value="market">Market</option><option value="limit">Limit</option></select></label>
          <label>Limit price <input id="paperLimit" type="number" min="0" step="0.01" placeholder="Only for limit orders" /></label>
          <label>Time in force <select id="paperTif"><option value="day">Day</option><option value="gtc">GTC</option></select></label>
          <label class="wide">Confirmation <input id="paperConfirm" placeholder="Type PAPER ONLY" /></label>
          <button class="wide" type="submit">Submit paper order</button>
        </form>
        <p class="broker-small">This is not investment advice. A paper fill does not prove a strategy works. Keep using Smart Analyst, Scenario Lab, journal, and Evolution Engine.</p>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Paper setup wizard</span><h3>Connect Alpaca safely</h3></div><strong id="brokerSetupGrade">Not checked</strong></div>
        <div class="broker-lock"><strong>Never paste keys here.</strong> Add keys only in Vercel Environment Variables. This browser can check setup status, but it cannot see your secrets.</div>
        <div class="broker-setup-grid">
          <label class="broker-step"><input class="brokerSetupCheck" type="checkbox" value="account"><span><strong>1. Create an Alpaca paper account.</strong><p class="muted">Choose paper trading only. Do not connect a real-money account for this app.</p></span></label>
          <label class="broker-step"><input class="brokerSetupCheck" type="checkbox" value="env"><span><strong>2. Add server-side Vercel variables.</strong><p class="muted"><span class="broker-code">ALPACA_PAPER_KEY_ID</span> and <span class="broker-code">ALPACA_PAPER_SECRET_KEY</span>. Optional base URL must be <span class="broker-code">https://paper-api.alpaca.markets</span>.</p></span></label>
          <label class="broker-step"><input class="brokerSetupCheck" type="checkbox" value="redeploy"><span><strong>3. Redeploy Vercel.</strong><p class="muted">Redeploy after adding variables so the serverless paper endpoint can read them.</p></span></label>
          <label class="broker-step"><input class="brokerSetupCheck" type="checkbox" value="owner"><span><strong>4. Unlock owner access if configured.</strong><p class="muted">If TRADER_OWNER_ACCESS_CODE is set in Vercel, enter it in Owner Access before broker checks.</p></span></label>
          <label class="broker-step"><input class="brokerSetupCheck" type="checkbox" value="status"><span><strong>5. Run the setup check.</strong><p class="muted">The app should report paper-only keys present before any paper order ticket is used.</p></span></label>
          <label class="broker-step"><input class="brokerSetupCheck" type="checkbox" value="practice"><span><strong>6. Practice tiny paper orders.</strong><p class="muted">Use tiny size, explicit PAPER ONLY confirmation, and journal every result. No real-money order is sent.</p></span></label>
        </div>
        <div class="evo-actions"><button id="brokerSetupCheck" type="button">Run setup check</button><button id="brokerSetupReset" class="ghost" type="button">Reset checklist</button></div>
        <div id="brokerSetupOutput" class="broker-status-list"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Paper broker audit</span><h3>Visible record</h3></div><button id="brokerClear" class="ghost" type="button">Clear</button></div>
        <div id="brokerLog" class="list"></div>
      </article>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function record(kind, payload) {
    const logs = get('broker_logs');
    set('broker_logs', [...logs, { kind, payload, time: new Date().toLocaleString() }].slice(-80));
    renderLog();
  }
  function setupChecks() { return new Set(get('broker_setup_checks')); }
  function saveSetupChecks() {
    const values = Array.from(document.querySelectorAll('.brokerSetupCheck:checked')).map((box) => box.value);
    set('broker_setup_checks', values);
    renderSetupGrade();
  }
  function renderSetupGrade() {
    const checked = setupChecks();
    const grade = document.getElementById('brokerSetupGrade');
    if (grade) grade.textContent = `${checked.size}/6 done`;
  }
  function restoreSetupChecks() {
    const checked = setupChecks();
    document.querySelectorAll('.brokerSetupCheck').forEach((box) => {
      box.checked = checked.has(box.value);
      box.addEventListener('change', saveSetupChecks);
    });
    renderSetupGrade();
  }
  function renderSetupStatus(result) {
    const out = document.getElementById('brokerSetupOutput');
    if (!out) return;
    const checks = result.checks || {};
    out.innerHTML = [
      `<span>${checks.OWNER_ACCESS ? 'Ready' : 'Locked'}: owner access if configured</span>`,
      `<span>${checks.ALPACA_PAPER_KEY_ID ? 'Ready' : 'Missing'}: ALPACA_PAPER_KEY_ID on the server</span>`,
      `<span>${checks.ALPACA_PAPER_SECRET_KEY ? 'Ready' : 'Missing'}: ALPACA_PAPER_SECRET_KEY on the server</span>`,
      `<span>${checks.ALPACA_PAPER_BASE_URL ? 'Ready' : 'Blocked'}: paper-only base URL (${esc(result.baseHost || 'not checked')})</span>`,
      `<span>${esc(result.message || 'Setup checked safely.')}</span>`
    ].join('');
    if (result.ok) {
      const checked = setupChecks();
      checked.add('status');
      checked.add('owner');
      set('broker_setup_checks', [...checked]);
      document.querySelectorAll('.brokerSetupCheck').forEach((box) => { box.checked = checked.has(box.value); });
      renderSetupGrade();
    }
    record('Paper setup check', result);
  }
  function renderLog() {
    const box = document.getElementById('brokerLog');
    if (!box) return;
    const logs = get('broker_logs');
    box.innerHTML = logs.slice().reverse().slice(0, 12).map((x) => `<div class="broker-card"><strong>${esc(x.kind)}</strong><p>${esc(JSON.stringify(x.payload).slice(0, 220))}</p><small>${esc(x.time)}</small></div>`).join('') || '<p class="muted">No broker audit events yet.</p>';
  }
  function renderResult(title, result) {
    const out = document.getElementById('brokerOutput');
    const configured = Boolean(result.configured);
    const ok = Boolean(result.ok);
    document.getElementById('brokerStatus').textContent = result.ownerAccessRequired && !result.ownerAccessVerified ? 'Owner locked' : configured ? (ok ? 'Paper ready' : 'Check warning') : 'Needs setup';
    const cls = !configured ? 'broker-warn' : ok ? 'broker-good' : 'broker-danger';
    const msg = result.message || (result.data ? JSON.stringify(result.data).slice(0, 800) : 'No details returned.');
    let account = '';
    if (result.data && result.data.account_number) account = `<div class="broker-row"><span>Buying power: ${money(result.data.buying_power)}</span><span>Equity: ${money(result.data.equity)}</span><span>Status: ${esc(result.data.status)}</span></div>`;
    out.innerHTML = `<div class="broker-card ${cls}"><span>${esc(title)}</span><strong>${configured ? 'Paper broker contacted' : 'Paper broker not configured'}</strong><p>${esc(msg)}</p>${account}</div>`;
    record(title, result);
  }
  async function check(action, label) {
    document.getElementById('brokerOutput').innerHTML = '<div><span>Paper broker</span><strong>Checking safely...</strong><p>No real-money action is possible from this endpoint.</p></div>';
    const result = await api(action);
    renderResult(label, result);
  }
  async function submitOrder(event) {
    event.preventDefault();
    const payload = { symbol: document.getElementById('paperSymbol').value.trim().toUpperCase(), qty: Number(document.getElementById('paperQty').value || 0), side: document.getElementById('paperSide').value, type: document.getElementById('paperType').value, time_in_force: document.getElementById('paperTif').value, limit_price: Number(document.getElementById('paperLimit').value || 0), confirmation: document.getElementById('paperConfirm').value.trim() };
    document.getElementById('brokerOutput').innerHTML = '<div><span>Paper order</span><strong>Submitting only if safety gates pass...</strong><p>Confirmation, owner access if configured, and server-side paper keys are required.</p></div>';
    const result = await api('submit-order', payload);
    renderResult('Paper order submission', result);
    if (result.ok) {
      const journal = get('journal');
      set('journal', [...journal, { title: `Paper broker order: ${payload.symbol}`, text: `${payload.side} ${payload.qty} ${payload.symbol} via ${payload.type}. Paper-only order response recorded in broker audit.`, date: new Date().toLocaleString() }]);
    }
  }

  addUI();
  document.getElementById('brokerCheck').addEventListener('click', () => check('status', 'Paper account status'));
  document.getElementById('brokerPositions').addEventListener('click', () => check('positions', 'Paper positions'));
  document.getElementById('brokerOrders').addEventListener('click', () => check('orders', 'Open paper orders'));
  document.getElementById('paperOrderForm').addEventListener('submit', submitOrder);
  document.getElementById('brokerClear').addEventListener('click', () => { set('broker_logs', []); renderLog(); });
  document.getElementById('brokerSetupCheck').addEventListener('click', async () => renderSetupStatus(await api('setup-status')));
  document.getElementById('brokerSetupReset').addEventListener('click', () => { set('broker_setup_checks', []); restoreSetupChecks(); document.getElementById('brokerSetupOutput').innerHTML = '<span>Setup checklist reset. Paper trading remains locked until setup is checked again.</span>'; });
  document.addEventListener('trader:owner-access-changed', () => renderSetupGrade());
  restoreSetupChecks();
  renderLog();
  check('status', 'Paper account status');
})();
