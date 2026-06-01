(() => {
  const get = (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const pct = (n) => `${(Number(n || 0) * 100).toFixed(2)}%`;

  const style = document.createElement('style');
  style.textContent = `.vf-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.vf-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.vf-card span{display:block;color:#c7d4e5;font-size:13px}.vf-card strong{display:block;color:#4cc9f0;font-size:22px;margin-top:5px}.vf-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.vf-actions button{width:auto}.vf-list{display:grid;gap:10px}.vf-row{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);border-radius:16px;padding:12px}.vf-ok{border-left:4px solid #34d399}.vf-warn{border-left:4px solid #fbbf24}.vf-bad{border-left:4px solid #f87171}.vf-row strong{color:#a7f3d0}.vf-row p{color:#c7d4e5;margin:6px 0}.vf-tag{display:inline-flex;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:4px 8px;margin:3px 4px 0 0;color:#d7e2f0;font-size:12px}@media(max-width:860px){.vf-grid{grid-template-columns:1fr}.vf-actions button{width:100%}}`;
  document.head.appendChild(style);

  async function history(symbol) {
    const r = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`);
    const data = await r.json();
    if (data.ok && data.candles?.length > 80) return data;
    throw new Error(data.message || 'No historical data available.');
  }

  function sma(candles, i, period) {
    if (i < period - 1) return null;
    let sum = 0;
    for (let x = i - period + 1; x <= i; x++) sum += candles[x].close;
    return sum / period;
  }

  function tradesFor(candles, strategy) {
    const trades = [];
    let position = null;
    const fast = Math.max(3, Number(strategy.fast || 10));
    const slow = Math.max(fast + 2, Number(strategy.slow || 30));
    const stopPct = Math.max(0.005, Number(strategy.stopPct || 0.03));
    const targetPct = Math.max(0.01, Number(strategy.targetPct || 0.06));
    const maxHold = Math.max(2, Number(strategy.maxHold || 20));
    for (let i = slow + 1; i < candles.length; i++) {
      const f = sma(candles, i, fast), s = sma(candles, i, slow), pf = sma(candles, i - 1, fast), ps = sma(candles, i - 1, slow);
      if (!f || !s || !pf || !ps) continue;
      const price = candles[i].close;
      if (!position && pf <= ps && f > s) {
        position = { entry: price, stop: price * (1 - stopPct), target: price * (1 + targetPct), entryIndex: i, entryTime: candles[i].time };
      }
      if (position) {
        const hitStop = candles[i].low <= position.stop;
        const hitTarget = candles[i].high >= position.target;
        const timedOut = i - position.entryIndex >= maxHold;
        const crossExit = pf >= ps && f < s;
        if (hitStop || hitTarget || timedOut || crossExit) {
          const exit = hitStop ? position.stop : hitTarget ? position.target : price;
          trades.push({ r: (exit - position.entry) / Math.max(0.01, position.entry - position.stop), entry: position.entry, exit, entryTime: position.entryTime, exitTime: candles[i].time, bars: i - position.entryIndex });
          position = null;
        }
      }
    }
    return trades;
  }

  function stats(trades) {
    const total = trades.length;
    const wins = trades.filter((x) => x.r > 0).length;
    const avgR = total ? trades.reduce((s, x) => s + x.r, 0) / total : 0;
    let equity = 0, peak = 0, dd = 0;
    for (const t of trades) { equity += t.r; peak = Math.max(peak, equity); dd = Math.min(dd, equity - peak); }
    return { trades: total, wins, winRate: total ? wins / total : 0, avgR, totalR: equity, maxDrawdownR: dd };
  }

  function latestStrategy(symbol) {
    const evolved = get('real_strategy_evolution', null);
    if (evolved?.best && (!symbol || evolved.symbol === symbol)) return evolved.best;
    const playbooks = get('playbooks');
    const found = playbooks.slice().reverse().find((p) => /Fast\s+\d+.*slow\s+\d+/i.test(p.rules || ''));
    if (found) {
      const fast = Number((found.rules.match(/Fast\s+(\d+)/i) || [])[1] || 10);
      const slow = Number((found.rules.match(/slow\s+(\d+)/i) || [])[1] || 30);
      const stopPct = Number((found.rules.match(/stop\s+([0-9.]+)%/i) || [])[1] || 3) / 100;
      const targetPct = Number((found.rules.match(/target\s+([0-9.]+)%/i) || [])[1] || 6) / 100;
      const maxHold = Number((found.rules.match(/max hold\s+(\d+)/i) || [])[1] || 20);
      return { fast, slow, stopPct, targetPct, maxHold };
    }
    return { fast: 10, slow: 30, stopPct: 0.03, targetPct: 0.06, maxHold: 20 };
  }

  function monteCarlo(trades) {
    if (trades.length < 5) return { worst20: 0, median20: 0, pass: false };
    let seed = trades.length * 8191;
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const results = [];
    for (let sim = 0; sim < 500; sim++) {
      let total = 0;
      for (let i = 0; i < Math.min(20, trades.length); i++) total += trades[Math.floor(rand() * trades.length)].r;
      results.push(total);
    }
    results.sort((a, b) => a - b);
    return { worst20: results[Math.floor(results.length * 0.05)], median20: results[Math.floor(results.length * 0.5)], pass: results[Math.floor(results.length * 0.05)] > -6 };
  }

  async function validate() {
    const symbol = (document.getElementById('vfSymbol').value || 'BTC').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '') || 'BTC';
    const out = document.getElementById('vfOutput');
    out.innerHTML = '<div class="vf-row vf-warn"><strong>Validating...</strong><p>Loading historical candles and separating train/test evidence.</p></div>';
    try {
      const data = await history(symbol);
      const candles = data.candles.slice(-520);
      const split = Math.floor(candles.length * 0.7);
      const train = candles.slice(0, split);
      const test = candles.slice(split);
      const strategy = latestStrategy(symbol);
      const trainTrades = tradesFor(train, strategy);
      const testTrades = tradesFor(test, strategy);
      const allTrades = tradesFor(candles, strategy);
      const trainStats = stats(trainTrades);
      const testStats = stats(testTrades);
      const allStats = stats(allTrades);
      const mc = monteCarlo(allTrades);
      const overfitPenalty = trainStats.avgR > 0 && testStats.avgR <= 0 ? 'Training looked better than test; likely overfit.' : 'Train/test behavior is not obviously overfit.';
      const pass = testStats.trades >= 3 && testStats.avgR > 0 && allStats.avgR > 0 && mc.pass;
      const report = { symbol, source: data.source, checkedAt: new Date().toISOString(), strategy, train: trainStats, test: testStats, all: allStats, monteCarlo: mc, pass, overfitPenalty };
      set('validation_report', report);
      document.getElementById('vfStatus').textContent = pass ? 'Candidate' : 'Not ready';
      document.getElementById('vfHoldout').textContent = `${testStats.avgR.toFixed(2)}R`;
      document.getElementById('vfTrades').textContent = allStats.trades;
      document.getElementById('vfRisk').textContent = `${mc.worst20.toFixed(1)}R`;
      out.innerHTML = `<div class="vf-row ${pass ? 'vf-ok' : 'vf-bad'}"><strong>${pass ? 'Validated paper candidate' : 'Rejected for now'}: ${esc(symbol)}</strong><p>${esc(overfitPenalty)} This is paper/backtest evidence only, not a buy/sell instruction.</p><span class="vf-tag">Train ${trainStats.trades} trades / ${trainStats.avgR.toFixed(2)} avg R</span><span class="vf-tag">Holdout ${testStats.trades} trades / ${testStats.avgR.toFixed(2)} avg R</span><span class="vf-tag">All ${allStats.trades} trades / ${allStats.totalR.toFixed(2)} total R</span><span class="vf-tag">Worst 20-trade sim ${mc.worst20.toFixed(1)}R</span></div>`;
    } catch (error) {
      document.getElementById('vfStatus').textContent = 'Failed safely';
      out.innerHTML = `<div class="vf-row vf-bad"><strong>Validation failed safely</strong><p>${esc(error.message)}</p></div>`;
    }
  }

  function promote() {
    const report = get('validation_report', null);
    const out = document.getElementById('vfOutput');
    if (!report) { out.innerHTML = '<div class="vf-row vf-warn"><strong>Run validation first.</strong><p>No report exists yet.</p></div>'; return; }
    if (!report.pass) { out.innerHTML += '<div class="vf-row vf-bad"><strong>Promotion blocked</strong><p>The holdout and Monte Carlo checks did not pass. Keep it in research mode.</p></div>'; return; }
    const plans = get('ai_plans');
    const plan = { time: new Date().toLocaleString(), title: `Validated paper plan: ${report.symbol}`, symbol: report.symbol, maturity: 0, instruction: `Use validated paper-only SMA setup fast ${report.strategy.fast} / slow ${report.strategy.slow}. Risk stays at 1% or less.`, childStep: `Paper only: watch ${report.symbol}, write the entry/stop/target, then ask a grown-up before any real-money thought.`, adultGate: 'Real money remains locked. Paper broker only after explicit PAPER ONLY confirmation.', status: 'Validated paper candidate' };
    set('ai_plans', [...plans, plan].slice(-80));
    const journal = get('journal');
    set('journal', [...journal, { title: `Validated strategy: ${report.symbol}`, text: `Holdout avg ${report.test.avgR.toFixed(2)}R, all avg ${report.all.avgR.toFixed(2)}R, worst simulation ${report.monteCarlo.worst20.toFixed(1)}R. Promoted to paper plan only.`, date: new Date().toLocaleString() }]);
    out.innerHTML += '<div class="vf-row vf-ok"><strong>Promoted to paper plan</strong><p>Saved to AI Plans and Journal. Real-money execution is still locked.</p></div>';
  }

  function exportReport() {
    const report = get('validation_report', { message: 'No validation run yet.' });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-validation-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function shell() {
    if (document.getElementById('validationForge')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'validationForge';
    section.className = 'panel smart-panel';
    section.innerHTML = `<span class="label">Walk-Forward Validation Forge</span><h3>Fight overfitting before any paper promotion</h3><p class="muted">This tests evolved strategies on separated train/holdout data and Monte Carlo simulations. It promotes only paper candidates with actual out-of-sample evidence.</p><div class="vf-grid"><div class="vf-card"><span>Status</span><strong id="vfStatus">Unchecked</strong></div><div class="vf-card"><span>Holdout avg R</span><strong id="vfHoldout">0.00R</strong></div><div class="vf-card"><span>Total trades</span><strong id="vfTrades">0</strong></div><div class="vf-card"><span>Worst sim</span><strong id="vfRisk">0R</strong></div></div><form id="vfForm" class="row-form"><input id="vfSymbol" value="BTC" placeholder="BTC, ETH, SPY, AAPL"><button>Validate strategy</button></form><div class="vf-actions"><button id="vfPromote" type="button">Promote only if validated</button><button id="vfExport" type="button">Export validation report</button></div><div id="vfOutput" class="vf-list"></div>`;
    safety.parentNode.insertBefore(section, safety);
    document.getElementById('vfForm').addEventListener('submit', (e) => { e.preventDefault(); validate(); });
    document.getElementById('vfPromote').onclick = promote;
    document.getElementById('vfExport').onclick = exportReport;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell); else shell();
})();
