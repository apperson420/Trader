(() => {
  const read = (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const style = document.createElement('style');
  style.textContent = `.real-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.real-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:13px}.real-card span{display:block;color:#c7d4e5;font-size:13px}.real-card strong{display:block;color:#4cc9f0;font-size:24px;margin:5px 0}.real-card p{color:#c7d4e5;margin:0}.real-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.real-actions button{width:auto}.real-list{display:grid;gap:10px}.real-row{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);border-radius:16px;padding:12px}.real-ok{border-left:4px solid #34d399}.real-warn{border-left:4px solid #fbbf24}.real-bad{border-left:4px solid #f87171}.real-row strong{color:#a7f3d0}.real-row p{color:#c7d4e5;margin:6px 0}.real-row small{color:#c7d4e5}.evo-meter{height:14px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:10px}.evo-meter>div{height:100%;width:0;background:linear-gradient(90deg,#4cc9f0,#a7f3d0)}.evo-table{display:grid;gap:8px;max-height:420px;overflow:auto}.evo-table .real-row{display:grid;grid-template-columns:100px 1fr;gap:10px}@media(max-width:860px){.real-grid{grid-template-columns:1fr}.real-actions button{width:100%}.evo-table .real-row{grid-template-columns:1fr}}`;
  document.head.appendChild(style);

  function metricData() {
    const outcomes = read('outcomes');
    const wins = outcomes.filter((x) => x.result === 'Win').length;
    const total = outcomes.length;
    const avgR = total ? outcomes.reduce((sum, x) => sum + Number(x.r || 0), 0) / total : 0;
    return { watchlist: read('watchlist').length, journal: read('journal').length, checks: read('checks').length, outcomes: total, playbooks: read('playbooks').length, brokerLogs: read('broker_logs').length, avgR, winRate: total ? Math.round((wins / total) * 100) : 0 };
  }

  function readiness(m) {
    let score = 0;
    if (m.watchlist > 0) score += 12;
    if (m.checks >= 6) score += 18;
    if (m.journal >= 3) score += 12;
    if (m.playbooks >= 1) score += 10;
    if (m.outcomes >= 10) score += 20;
    if (m.outcomes >= 20 && m.avgR > 0) score += 18;
    if (m.brokerLogs > 0) score += 10;
    return Math.min(100, score);
  }

  async function ping(url, expected = 200) {
    const start = performance.now();
    try {
      const response = await fetch(url);
      const text = await response.text();
      return { ok: response.status === expected || (expected === 200 && response.ok), status: response.status, ms: Math.round(performance.now() - start), detail: text.slice(0, 140) };
    } catch (error) {
      return { ok: false, status: 0, ms: Math.round(performance.now() - start), detail: error.message };
    }
  }

  function fallbackCandles(symbol) {
    let seed = Array.from(symbol).reduce((s, c) => s + c.charCodeAt(0), 97);
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let close = symbol === 'BTC' ? 65000 : 100;
    const candles = [];
    for (let i = 0; i < 520; i++) {
      const drift = 0.00035;
      const shock = (rand() - 0.5) * 0.045;
      const wave = Math.sin(i / 18) * 0.006;
      const open = close;
      close = Math.max(1, close * (1 + drift + shock + wave));
      candles.push({ time: Date.now() - (520 - i) * 86400000, open, high: Math.max(open, close) * 1.01, low: Math.min(open, close) * 0.99, close, volume: Math.round(1000000 * rand()) });
    }
    return candles;
  }

  async function loadCandles(symbol) {
    try {
      const r = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`);
      const data = await r.json();
      if (data.ok && Array.isArray(data.candles) && data.candles.length > 80) return { source: data.source, candles: data.candles };
      return { source: 'deterministic fallback series', candles: fallbackCandles(symbol) };
    } catch {
      return { source: 'deterministic fallback series', candles: fallbackCandles(symbol) };
    }
  }

  function sma(candles, i, period) {
    if (i < period) return null;
    let sum = 0;
    for (let x = i - period + 1; x <= i; x++) sum += candles[x].close;
    return sum / period;
  }

  function evaluate(candles, strategy) {
    const trades = [];
    let position = null;
    for (let i = Math.max(strategy.slow + 2, 30); i < candles.length; i++) {
      const fast = sma(candles, i, strategy.fast);
      const slow = sma(candles, i, strategy.slow);
      const prevFast = sma(candles, i - 1, strategy.fast);
      const prevSlow = sma(candles, i - 1, strategy.slow);
      if (!fast || !slow || !prevFast || !prevSlow) continue;
      const price = candles[i].close;
      if (!position && prevFast <= prevSlow && fast > slow) {
        position = { entry: price, stop: price * (1 - strategy.stopPct), target: price * (1 + strategy.targetPct), entryIndex: i };
      }
      if (position) {
        const hitStop = candles[i].low <= position.stop;
        const hitTarget = candles[i].high >= position.target;
        const timed = i - position.entryIndex >= strategy.maxHold;
        if (hitStop || hitTarget || timed || (prevFast >= prevSlow && fast < slow)) {
          const exit = hitStop ? position.stop : hitTarget ? position.target : price;
          const r = (exit - position.entry) / Math.max(0.01, position.entry - position.stop);
          trades.push(r);
          position = null;
        }
      }
    }
    const total = trades.length;
    const wins = trades.filter((r) => r > 0).length;
    const avgR = total ? trades.reduce((a, b) => a + b, 0) / total : -99;
    let equity = 0, peak = 0, drawdown = 0;
    for (const r of trades) { equity += r; peak = Math.max(peak, equity); drawdown = Math.min(drawdown, equity - peak); }
    const score = avgR * 100 + wins - Math.abs(drawdown) * 8 + Math.min(total, 60) * 0.6;
    return { ...strategy, trades: total, wins, winRate: total ? Math.round((wins / total) * 100) : 0, avgR, totalR: equity, maxDrawdownR: drawdown, score };
  }

  function randomStrategy(rand) {
    const fast = 3 + Math.floor(rand() * 25);
    const slow = fast + 8 + Math.floor(rand() * 90);
    return { fast, slow, stopPct: 0.01 + rand() * 0.09, targetPct: 0.015 + rand() * 0.18, maxHold: 3 + Math.floor(rand() * 45) };
  }

  function mutate(strategy, rand) {
    return {
      fast: Math.max(3, Math.min(35, Math.round(strategy.fast + (rand() - 0.5) * 8))),
      slow: Math.max(12, Math.min(140, Math.round(strategy.slow + (rand() - 0.5) * 18))),
      stopPct: Math.max(0.005, Math.min(0.12, strategy.stopPct + (rand() - 0.5) * 0.025)),
      targetPct: Math.max(0.01, Math.min(0.25, strategy.targetPct + (rand() - 0.5) * 0.05)),
      maxHold: Math.max(2, Math.min(70, Math.round(strategy.maxHold + (rand() - 0.5) * 12)))
    };
  }

  async function evolveStrategies() {
    const symbol = (document.getElementById('evoSymbol')?.value || 'BTC').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '') || 'BTC';
    const status = document.getElementById('evoStatus');
    const bar = document.getElementById('evoBar');
    const results = document.getElementById('evoResults');
    status.textContent = 'Loading candles';
    results.innerHTML = '<div class="real-row real-warn"><strong>Loading historical data...</strong><p>No trades are being placed. This is research/backtesting only.</p></div>';
    const { source, candles } = await loadCandles(symbol);
    let seed = 123456 + candles.length + symbol.length;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    let population = Array.from({ length: 60 }, () => randomStrategy(rand));
    let history = [];
    for (let gen = 1; gen <= 100; gen++) {
      const scored = population.map((s) => evaluate(candles, s)).sort((a, b) => b.score - a.score);
      history.push({ generation: gen, best: scored[0] });
      population = scored.slice(0, 12).map((s) => ({ fast: s.fast, slow: s.slow, stopPct: s.stopPct, targetPct: s.targetPct, maxHold: s.maxHold }));
      while (population.length < 60) population.push(mutate(population[Math.floor(rand() * population.length)], rand));
      if (gen % 10 === 0) {
        status.textContent = `Generation ${gen}/100`;
        bar.style.width = `${gen}%`;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    const best = history.at(-1).best;
    const report = { generatedAt: new Date().toISOString(), symbol, source, candles: candles.length, best, generations: history.map((h) => ({ generation: h.generation, score: h.best.score, avgR: h.best.avgR, trades: h.best.trades, winRate: h.best.winRate })) };
    write('real_strategy_evolution', report);
    status.textContent = '100 generations complete';
    bar.style.width = '100%';
    results.innerHTML = [
      `<div class="real-row ${best.avgR > 0 && best.trades >= 10 ? 'real-ok' : 'real-warn'}"><strong>Best evolved paper strategy for ${esc(symbol)}</strong><p>Fast SMA ${best.fast}, Slow SMA ${best.slow}, Stop ${(best.stopPct * 100).toFixed(2)}%, Target ${(best.targetPct * 100).toFixed(2)}%, Max hold ${best.maxHold} days.</p><small>${esc(source)} • ${candles.length} candles • ${best.trades} trades • ${best.winRate}% win rate • ${best.avgR.toFixed(2)} avg R • ${best.totalR.toFixed(2)} total R • ${best.maxDrawdownR.toFixed(2)} max drawdown R</small></div>`,
      `<div class="real-row real-warn"><strong>Governance result</strong><p>This is an evolved paper/backtest candidate, not a real-money signal. It must be paper-tested, journaled, and approved before any broker action.</p><small>100 actual algorithmic generations were run in your browser using historical/fallback candles.</small></div>`
    ].join('');
    const playbooks = read('playbooks');
    write('playbooks', [...playbooks, { name: `Evolved ${symbol} SMA playbook`, rules: `Fast ${best.fast} crossing above slow ${best.slow}; paper-only stop ${(best.stopPct * 100).toFixed(2)}%; paper-only target ${(best.targetPct * 100).toFixed(2)}%; max hold ${best.maxHold} days. Backtest avgR ${best.avgR.toFixed(2)} across ${best.trades} trades.`, date: new Date().toLocaleString() }]);
  }

  function build() {
    if (document.getElementById('realResultsEngine')) return;
    const safety = document.querySelector('.safety');
    if (!safety) return;
    const section = document.createElement('section');
    section.id = 'realResultsEngine';
    section.className = 'panel smart-panel';
    section.innerHTML = `<span class="label">Real Evolution Engine</span><h3>100-generation strategy evolution + production self-test</h3><p class="muted">This runs real browser-side evolutionary optimization over historical/fallback candles. It does not claim 100 years passed; it performs 100 actual algorithmic generations and records the best paper strategy.</p><div class="real-grid"><div class="real-card"><span>Readiness</span><strong id="realReady">0%</strong><p>Evidence-based, not assumed.</p></div><div class="real-card"><span>Paper outcomes</span><strong id="realOutcomes">0</strong><p>Recorded practice results.</p></div><div class="real-card"><span>Average R</span><strong id="realAvgR">0.00R</strong><p>Outcome expectancy proxy.</p></div><div class="real-card"><span>System status</span><strong id="realStatus">Unchecked</strong><p>Run self-test.</p></div></div><div class="real-actions"><button id="realRun" type="button">Run real self-test</button><button id="realFix" type="button">Apply safe defaults</button><button id="realExport" type="button">Export proof report</button></div><div id="realList" class="real-list"></div><hr style="border-color:rgba(255,255,255,.12);margin:18px 0"><span class="label">Actual 100-generation evolution</span><h3>Strategy optimizer</h3><form class="row-form" id="evoForm"><input id="evoSymbol" value="BTC" placeholder="BTC, ETH, SPY, AAPL"><button>Run 100 generations</button></form><div class="evo-meter"><div id="evoBar"></div></div><p class="muted" id="evoStatus">Ready.</p><div id="evoResults" class="evo-table"></div>`;
    safety.parentNode.insertBefore(section, safety);
    document.getElementById('realRun').onclick = runSelfTest;
    document.getElementById('realFix').onclick = applyDefaults;
    document.getElementById('realExport').onclick = exportReport;
    document.getElementById('evoForm').addEventListener('submit', (e) => { e.preventDefault(); evolveStrategies(); });
    renderMetrics();
  }

  function renderMetrics() {
    const m = metricData();
    document.getElementById('realReady').textContent = `${readiness(m)}%`;
    document.getElementById('realOutcomes').textContent = m.outcomes;
    document.getElementById('realAvgR').textContent = `${m.avgR.toFixed(2)}R`;
  }

  function row(title, ok, detail, meta = '') {
    return `<div class="real-row ${ok ? 'real-ok' : 'real-bad'}"><strong>${esc(title)}</strong><p>${esc(detail)}</p><small>${esc(meta)}</small></div>`;
  }

  async function runSelfTest() {
    renderMetrics();
    const list = document.getElementById('realList');
    list.innerHTML = '<div class="real-row real-warn"><strong>Running checks...</strong><p>Testing live app paths and local product evidence.</p></div>';
    const checks = [];
    checks.push(['App shell', await ping('/')]);
    checks.push(['App loader', await ping('/app.js')]);
    checks.push(['Market API', await ping('/api/market?symbol=BTC')]);
    checks.push(['History API', await ping('/api/history?symbol=BTC')]);
    checks.push(['AI chat API method gate', await ping('/api/ai-chat', 405)]);
    checks.push(['Paper broker API', await ping('/api/alpaca-paper?action=status')]);
    const m = metricData();
    const evidenceOk = m.watchlist > 0 && m.checks >= 6 && m.outcomes >= 10;
    const report = checks.map(([name, result]) => ({ name, ...result })).concat([{ name: 'Evidence maturity', ok: evidenceOk, status: evidenceOk ? 200 : 428, ms: 0, detail: evidenceOk ? 'Enough starter evidence exists.' : 'Needs watchlist, checklist, and at least 10 paper outcomes.' }]);
    write('real_results_report', { generatedAt: new Date().toISOString(), readiness: readiness(m), metrics: m, checks: report });
    document.getElementById('realStatus').textContent = report.every((x) => x.ok) ? 'Passed' : 'Needs work';
    list.innerHTML = report.map((x) => row(x.name, x.ok, x.detail, `status ${x.status}, ${x.ms}ms`)).join('');
  }

  function applyDefaults() {
    if (!read('watchlist').length) write('watchlist', ['BTC', 'SPY', 'AAPL']);
    if (!read('playbooks').length) write('playbooks', [{ name: 'Beginner paper setup', rules: 'Only paper trade when checklist is complete, risk is 1% or less, stop is defined, and reward is at least 2R.', date: new Date().toLocaleString() }]);
    const journal = read('journal');
    write('journal', [...journal, { title: 'Safe defaults applied', text: 'Added starter watchlist and beginner playbook. Still paper-only. Real money remains locked.', date: new Date().toLocaleString() }]);
    renderMetrics();
    runSelfTest();
  }

  function exportReport() {
    const report = { generatedAt: new Date().toISOString(), readiness: readiness(metricData()), metrics: metricData(), selfTest: read('real_results_report'), evolution: read('real_strategy_evolution') };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-real-evolution-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
