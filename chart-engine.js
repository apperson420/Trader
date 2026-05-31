(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

  const style = document.createElement('style');
  style.textContent = `.chart-canvas{width:100%;height:380px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(0,0,0,.18);margin-top:12px}.indicator-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.indicator-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.indicator-card strong{display:block;color:#4cc9f0;font-size:22px}.indicator-card span{color:#c7d4e5;font-size:13px}.chart-note{border-left:4px solid #a7f3d0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.045);color:#d7e2f0;margin-top:12px}.chart-toolbar{display:grid;grid-template-columns:1fr auto auto;gap:10px;margin-top:12px}.chart-badge{display:inline-flex;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:6px 9px;margin:4px 4px 0 0;color:#d7e2f0;font-size:12px}.chart-proof{display:grid;gap:8px;margin-top:10px}.chart-proof div{border-left:4px solid #4cc9f0;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.045);color:#c7d4e5}@media(max-width:860px){.indicator-grid,.chart-toolbar{grid-template-columns:1fr}.chart-canvas{height:280px}}`;
  document.head.appendChild(style);

  function fallbackCandles(symbol) {
    let seed = Array.from(symbol).reduce((sum, c) => sum + c.charCodeAt(0), 101);
    const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let close = symbol === 'BTC' ? 65000 : 100;
    const candles = [];
    for (let i = 0; i < 220; i++) {
      const open = close;
      close = Math.max(1, close * (1 + (rand() - 0.48) * 0.04 + Math.sin(i / 18) * 0.006));
      candles.push({ time: Date.now() - (220 - i) * 86400000, open, high: Math.max(open, close) * (1 + rand() * 0.012), low: Math.min(open, close) * (1 - rand() * 0.012), close, volume: Math.round(100000 * rand()) });
    }
    return { ok: true, source: 'deterministic fallback research candles', candles };
  }

  function sma(rows, period) {
    return rows.map((row, i) => {
      if (i < period - 1) return null;
      let sum = 0;
      for (let x = i - period + 1; x <= i; x++) sum += rows[x].close;
      return sum / period;
    });
  }

  function atr(rows, period = 14) {
    if (rows.length <= period) return 0;
    const trs = [];
    for (let i = 1; i < rows.length; i++) trs.push(Math.max(rows[i].high - rows[i].low, Math.abs(rows[i].high - rows[i - 1].close), Math.abs(rows[i].low - rows[i - 1].close)));
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  }

  function rsi(rows, period = 14) {
    if (rows.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = rows.length - period; i < rows.length; i++) {
      const diff = rows[i].close - rows[i - 1].close;
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    return 100 - (100 / (1 + gains / losses));
  }

  function draw(canvas, rows, fastMa, slowMa) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const pad = 34;
    const min = Math.min(...rows.flatMap((r) => [r.low, r.close]));
    const max = Math.max(...rows.flatMap((r) => [r.high, r.close]));
    const y = (v) => rect.height - pad - ((v - min) / Math.max(0.01, max - min)) * (rect.height - pad * 2);
    const x = (i) => pad + (i / Math.max(1, rows.length - 1)) * (rect.width - pad * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const gy = pad + i * ((rect.height - pad * 2) / 4); ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(rect.width - pad, gy); ctx.stroke(); }
    const w = Math.max(2, (rect.width - pad * 2) / rows.length * 0.55);
    rows.forEach((r, i) => {
      const xi = x(i), up = r.close >= r.open;
      ctx.strokeStyle = up ? '#a7f3d0' : '#fca5a5';
      ctx.fillStyle = up ? 'rgba(167,243,208,.8)' : 'rgba(252,165,165,.8)';
      ctx.beginPath(); ctx.moveTo(xi, y(r.high)); ctx.lineTo(xi, y(r.low)); ctx.stroke();
      const top = y(Math.max(r.open, r.close)); const h = Math.max(2, Math.abs(y(r.open) - y(r.close)));
      ctx.fillRect(xi - w / 2, top, w, h);
    });
    function line(values, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); let started = false;
      values.forEach((v, i) => { if (v == null) return; if (!started) { ctx.moveTo(x(i), y(v)); started = true; } else ctx.lineTo(x(i), y(v)); });
      ctx.stroke();
    }
    line(fastMa, '#4cc9f0');
    line(slowMa, '#a7f3d0');
    ctx.fillStyle = '#c7d4e5'; ctx.font = '12px Arial'; ctx.fillText(money(max), pad, 18); ctx.fillText(money(min), pad, rect.height - 8);
  }

  function backtest(rows, fast = 10, slow = 30) {
    const f = sma(rows, fast), s = sma(rows, slow), trades = [];
    let entry = null;
    for (let i = slow + 1; i < rows.length; i++) {
      if (!f[i] || !s[i] || !f[i - 1] || !s[i - 1]) continue;
      if (!entry && f[i - 1] <= s[i - 1] && f[i] > s[i]) entry = rows[i].close;
      else if (entry && f[i - 1] >= s[i - 1] && f[i] < s[i]) { trades.push((rows[i].close - entry) / entry); entry = null; }
    }
    const wins = trades.filter((x) => x > 0).length;
    const avg = trades.length ? trades.reduce((a, b) => a + b, 0) / trades.length : 0;
    const total = trades.reduce((a, b) => a + b, 0);
    return { trades: trades.length, winRate: trades.length ? Math.round((wins / trades.length) * 100) : 0, avg, total };
  }

  async function history(symbol) {
    try {
      const r = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}`);
      const data = await r.json();
      if (data.ok && data.candles?.length) return data;
    } catch {}
    return fallbackCandles(symbol);
  }

  async function run(symbol = 'BTC') {
    document.getElementById('chartCoach').textContent = 'Loading real historical candles...';
    const data = await history(symbol);
    const rows = data.candles.slice(-220);
    const current = rows.at(-1).close;
    const fastMa = sma(rows, 10);
    const slowMa = sma(rows, 30);
    const ma10 = fastMa.at(-1);
    const ma30 = slowMa.at(-1);
    const momentum = ((current - rows[Math.max(0, rows.length - 30)].close) / rows[Math.max(0, rows.length - 30)].close) * 100;
    const rsiValue = rsi(rows);
    const atrValue = atr(rows);
    const bt = backtest(rows, 10, 30);
    document.getElementById('chartTitle').textContent = `${symbol} real historical research chart`;
    document.getElementById('chartStats').innerHTML = `<div class="indicator-card"><span>Last close</span><strong>${money(current)}</strong></div><div class="indicator-card"><span>10 / 30 MA</span><strong>${money(ma10)} / ${money(ma30)}</strong></div><div class="indicator-card"><span>30-day momentum</span><strong>${momentum.toFixed(1)}%</strong></div><div class="indicator-card"><span>RSI / ATR</span><strong>${rsiValue.toFixed(0)} / ${money(atrValue)}</strong></div>`;
    const note = rsiValue > 70 ? 'Overheated practice warning: do not chase. Wait for a paper setup and a stop.' : rsiValue < 30 ? 'Oversold practice warning: still do not guess. Require a written plan.' : 'Neutral practice zone: use Smart Analyst, Scenario Lab, and paper journaling before any broker action.';
    document.getElementById('chartCoach').innerHTML = `${esc(note)}<div class="chart-proof"><div>Data source: ${esc(data.source || 'history API')} • Candles: ${rows.length}</div><div>Simple 10/30 crossover backtest: ${bt.trades} trades, ${bt.winRate}% win rate, ${(bt.avg * 100).toFixed(2)}% average move, ${(bt.total * 100).toFixed(2)}% total raw move. Research only.</div></div>`;
    draw(document.getElementById('researchChart'), rows, fastMa, slowMa);
    set('chart_last', { symbol, dataSource: data.source, current, ma10, ma30, momentum, rsiValue, atrValue, backtest: bt, checkedAt: new Date().toLocaleString() });
  }

  function shell() {
    if (document.getElementById('chartEngine')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'chartEngine';
    section.className = 'panel';
    section.innerHTML = `<span class="label">Professional Chart Engine</span><h3 id="chartTitle">Real historical research chart</h3><p class="muted">This uses the live historical-candle API, draws candlesticks, overlays 10/30 moving averages, and runs a simple research backtest. It is not a buy/sell signal.</p><form id="chartForm" class="chart-toolbar"><input id="chartSymbol" value="BTC" placeholder="BTC, ETH, SPY, AAPL" /><button>Load real chart</button><button id="chartSave" type="button">Save chart proof</button></form><canvas id="researchChart" class="chart-canvas"></canvas><div id="chartStats" class="indicator-grid"></div><div id="chartCoach" class="chart-note">Load a symbol to start.</div>`;
    safety.parentNode.insertBefore(section, safety);
    document.getElementById('chartForm').addEventListener('submit', (event) => { event.preventDefault(); run(document.getElementById('chartSymbol').value.trim().toUpperCase() || 'BTC'); });
    document.getElementById('chartSave').addEventListener('click', () => { const last = get('chart_last', null); if (!last) return; const journal = get('journal'); set('journal', [...journal, { title: `Chart proof: ${last.symbol}`, text: `Historical chart checked from ${last.dataSource}. RSI ${last.rsiValue?.toFixed?.(0)}, momentum ${last.momentum?.toFixed?.(1)}%, backtest trades ${last.backtest?.trades}. Research only.`, date: new Date().toLocaleString() }]); });
    window.addEventListener('resize', () => { const last = get('chart_last', null); if (last && last.symbol) run(last.symbol); });
  }

  shell();
  run('BTC');
})();
