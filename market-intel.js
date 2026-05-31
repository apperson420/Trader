(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

  const style = document.createElement('style');
  style.textContent = `.market-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px;margin-top:10px}.market-card strong{color:#4cc9f0}.market-good{border-left:4px solid #34d399}.market-warn{border-left:4px solid #fbbf24}.market-danger{border-left:4px solid #f87171}.market-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}.market-row span{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:9px;background:rgba(0,0,0,.15);color:#c7d4e5}@media(max-width:860px){.market-row{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  function addUI() {
    if (document.getElementById('marketIntel')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'marketIntel';
    section.className = 'grid two';
    section.innerHTML = `
      <article class="panel smart-panel">
        <div class="section-head"><div><span class="label">Read-Only Market Intelligence</span><h3>Real quotes, no trading</h3></div><strong id="marketStatus">Safe</strong></div>
        <p class="muted">This is the next autonomy step: the app can observe market prices without storing broker keys or placing orders. Crypto quotes use a no-key public source; stocks/ETFs require a server-side Vercel environment variable.</p>
        <form id="marketForm" class="row-form">
          <input id="marketSymbol" placeholder="BTC, ETH, SPY, NVDA" value="BTC" />
          <button>Get quote</button>
        </form>
        <div id="marketOutput" class="result-box stacked"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Income Engine Discipline</span><h3>What the system must prove</h3></div></div>
        <div class="auto-steps">
          <div><strong>1. Observe only.</strong><p class="muted">Collect read-only prices and never execute hidden orders.</p></div>
          <div><strong>2. Generate a paper thesis.</strong><p class="muted">Use Smart Analyst, Scenario Lab, and AI Brain to decide whether the idea is worth practicing.</p></div>
          <div><strong>3. Record outcomes.</strong><p class="muted">The product improves only after repeated paper results, not guesses.</p></div>
          <div><strong>4. Gate real money.</strong><p class="muted">Real trading requires an adult-owned account, legal rules, broker setup, tiny limits, and explicit approval.</p></div>
        </div>
      </article>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function suggestionFromQuote(q) {
    if (!q.ok) return { cls: 'market-warn', text: q.message || 'No quote was available. Use paper mode only.' };
    const watchlist = get('watchlist');
    if (!watchlist.includes(q.symbol)) set('watchlist', [...watchlist, q.symbol]);
    const text = `${q.symbol} quote loaded at ${money(q.price)}. Next: run Smart Analyst, then Scenario Lab. Do not treat a quote as a buy signal.`;
    return { cls: 'market-good', text };
  }

  async function fetchQuote(symbol) {
    const response = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`);
    return response.json();
  }

  async function run(symbol) {
    const out = document.getElementById('marketOutput');
    document.getElementById('marketStatus').textContent = 'Loading';
    out.innerHTML = '<div><span>Market data</span><strong>Checking read-only quote...</strong><p>No trade can be placed from this panel.</p></div>';
    const q = await fetchQuote(symbol);
    const tip = suggestionFromQuote(q);
    document.getElementById('marketStatus').textContent = q.ok ? 'Observed' : 'Needs setup';
    out.innerHTML = `<div class="market-card ${tip.cls}"><span>${esc(q.source || 'Market source')}</span><strong>${esc(q.symbol || symbol)} ${q.ok ? money(q.price) : 'not available'}</strong><p>${esc(tip.text)}</p><div class="market-row"><span>Mode: ${esc(q.mode || 'read_only')}</span><span>Asset: ${esc(q.assetClass || 'unknown')}</span><span>Time: ${esc(q.time || new Date().toLocaleString())}</span></div></div>`;
    const logs = get('market_logs');
    set('market_logs', [...logs, { ...q, checkedAt: new Date().toLocaleString() }].slice(-50));
  }

  addUI();
  document.getElementById('marketForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const symbol = document.getElementById('marketSymbol').value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '') || 'BTC';
    run(symbol);
  });
  run('BTC');
})();
