(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(Number(n)) ? Number(n) : 0);

  const style = document.createElement('style');
  style.textContent = `.chart-canvas{width:100%;height:320px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(0,0,0,.18);margin-top:12px}.indicator-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px}.indicator-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.indicator-card strong{display:block;color:#4cc9f0;font-size:22px}.indicator-card span{color:#c7d4e5;font-size:13px}.chart-note{border-left:4px solid #a7f3d0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.045);color:#d7e2f0;margin-top:12px}@media(max-width:860px){.indicator-grid{grid-template-columns:1fr}.chart-canvas{height:260px}}`;
  document.head.appendChild(style);

  function fakeSeries(symbol, base) {
    const seed = Array.from(symbol).reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const rows = [];
    let price = Number(base) || 100;
    for (let i = 0; i < 80; i++) {
      const wave = Math.sin((i + seed) / 5) * 0.012 + Math.cos((i + seed) / 11) * 0.008;
      price = Math.max(0.01, price * (1 + wave));
      rows.push({ x: i, close: Number(price.toFixed(2)) });
    }
    return rows;
  }

  function sma(rows, period) {
    return rows.map((row, i) => {
      if (i < period - 1) return null;
      const slice = rows.slice(i - period + 1, i + 1);
      return slice.reduce((sum, x) => sum + x.close, 0) / period;
    });
  }

  function rsi(rows, period = 14) {
    if (rows.length <= period) return 50;
    let gains = 0, losses = 0;
    for (let i = rows.length - period; i < rows.length; i++) {
      const diff = rows[i].close - rows[i - 1].close;
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  function draw(canvas, rows) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);
    const pad = 28;
    const min = Math.min(...rows.map((r) => r.close));
    const max = Math.max(...rows.map((r) => r.close));
    const y = (v) => rect.height - pad - ((v - min) / Math.max(0.01, max - min)) * (rect.height - pad * 2);
    const x = (i) => pad + (i / Math.max(1, rows.length - 1)) * (rect.width - pad * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const gy = pad + i * ((rect.height - pad * 2) / 4);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(rect.width - pad, gy); ctx.stroke();
    }
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    rows.forEach((r, i) => { if (i === 0) ctx.moveTo(x(i), y(r.close)); else ctx.lineTo(x(i), y(r.close)); });
    ctx.stroke();
    const ma = sma(rows, 20);
    ctx.strokeStyle = '#a7f3d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ma.forEach((v, i) => { if (v == null) return; if (i === 19) ctx.moveTo(x(i), y(v)); else ctx.lineTo(x(i), y(v)); });
    ctx.stroke();
    ctx.fillStyle = '#c7d4e5';
    ctx.font = '12px Arial';
    ctx.fillText(money(max), pad, 18);
    ctx.fillText(money(min), pad, rect.height - 8);
  }

  async function quote(symbol) {
    const r = await fetch(`/api/market?symbol=${encodeURIComponent(symbol)}`);
    return r.json();
  }

  async function run(symbol = 'BTC') {
    const q = await quote(symbol);
    const rows = fakeSeries(symbol, q.price || 100);
    const current = rows[rows.length - 1].close;
    const ma20 = sma(rows, 20).at(-1);
    const momentum = ((current - rows[rows.length - 20].close) / rows[rows.length - 20].close) * 100;
    const rsiValue = rsi(rows);
    document.getElementById('chartTitle').textContent = `${symbol} research chart`;
    document.getElementById('chartStats').innerHTML = `<div class="indicator-card"><span>Quote</span><strong>${money(q.price || current)}</strong></div><div class="indicator-card"><span>20-period average</span><strong>${money(ma20)}</strong></div><div class="indicator-card"><span>Momentum</span><strong>${momentum.toFixed(1)}%</strong></div><div class="indicator-card"><span>RSI-style score</span><strong>${rsiValue.toFixed(0)}</strong></div>`;
    const note = rsiValue > 70 ? 'Overheated practice warning: do not chase. Wait for a plan.' : rsiValue < 30 ? 'Oversold practice warning: still do not guess. Require confirmation.' : 'Neutral practice zone: use Smart Analyst before any paper plan.';
    document.getElementById('chartCoach').textContent = note;
    draw(document.getElementById('researchChart'), rows);
    set('chart_last', { symbol, q, current, ma20, momentum, rsiValue, note, checkedAt: new Date().toLocaleString() });
  }

  function shell() {
    if (document.getElementById('chartEngine')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'chartEngine';
    section.className = 'panel';
    section.innerHTML = `<span class="label">Professional Chart Engine</span><h3 id="chartTitle">Research chart</h3><p class="muted">A lightweight built-in chart/indicator layer. It uses real current quotes when available and deterministic research series for visual strategy practice. This is not a buy/sell signal.</p><form id="chartForm" class="row-form"><input id="chartSymbol" value="BTC" placeholder="BTC, ETH, SPY, AAPL" /><button>Load chart</button></form><canvas id="researchChart" class="chart-canvas"></canvas><div id="chartStats" class="indicator-grid"></div><div id="chartCoach" class="chart-note">Load a symbol to start.</div>`;
    safety.parentNode.insertBefore(section, safety);
    document.getElementById('chartForm').addEventListener('submit', (event) => { event.preventDefault(); run(document.getElementById('chartSymbol').value.trim().toUpperCase() || 'BTC'); });
    window.addEventListener('resize', () => { const last = get('chart_last', null); if (last && last.symbol) run(last.symbol); });
  }

  shell();
  run('BTC');
})();
