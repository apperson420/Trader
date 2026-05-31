(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const pct = (n) => `${Math.round(n * 100)}%`;
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const style = document.createElement('style');
  style.textContent = `.scenario-bars{display:grid;gap:8px;margin-top:12px}.scenario-bar{display:grid;grid-template-columns:115px 1fr 70px;gap:10px;align-items:center;color:#c7d4e5}.scenario-track{height:12px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}.scenario-fill{height:100%;background:linear-gradient(90deg,#4cc9f0,#a7f3d0);border-radius:999px}.scenario-note{border-left:4px solid #4cc9f0;padding-left:12px}.scenario-danger{border-left-color:#f87171}.scenario-warn{border-left-color:#fbbf24}@media(max-width:860px){.scenario-bar{grid-template-columns:1fr}.scenario-track{height:14px}}`;
  document.head.appendChild(style);

  function createLab() {
    if (document.getElementById('scenarioLab')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'scenarioLab';
    section.className = 'grid two';
    section.innerHTML = `
      <article class="panel smart-panel">
        <div class="section-head"><div><span class="label">Scenario Lab</span><h3>Stress-test a paper strategy</h3></div><strong id="scenarioGrade">Ready</strong></div>
        <div class="form-grid">
          <label>Planned trades <input id="simTrades" type="number" min="1" value="30" /></label>
          <label>Win rate % <input id="simWinRate" type="number" min="0" max="100" value="45" /></label>
          <label>Average win R <input id="simAvgWin" type="number" min="0" step="0.1" value="2" /></label>
          <label>Average loss R <input id="simAvgLoss" type="number" min="0" step="0.1" value="1" /></label>
          <label>Risk per trade % <input id="simRiskPct" type="number" min="0" step="0.1" value="1" /></label>
          <button id="runScenario" class="wide" type="button">Run Scenario Lab</button>
        </div>
        <div id="scenarioOutput" class="result-box stacked"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Distribution</span><h3>Possible paper outcomes</h3></div></div>
        <div id="scenarioBars" class="scenario-bars"></div>
        <p class="muted">This is a deterministic planning model, not a market prediction. It is only for sizing discipline and expectations.</p>
      </article>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function compute() {
    const trades = Math.max(1, Math.round(num($('simTrades').value)));
    const winRate = Math.max(0, Math.min(100, num($('simWinRate').value))) / 100;
    const avgWin = Math.max(0, num($('simAvgWin').value));
    const avgLoss = Math.max(0, num($('simAvgLoss').value));
    const riskPct = Math.max(0, num($('simRiskPct').value));
    const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
    const expectedR = expectancy * trades;
    const expectedAccountMove = expectedR * riskPct;
    const roughDrawdown = Math.sqrt(trades) * avgLoss * riskPct * Math.max(0.4, 1 - winRate);
    const breakEvenWinRate = (avgWin + avgLoss) > 0 ? avgLoss / (avgWin + avgLoss) : 1;
    const grade = expectancy > 0.6 ? 'Strong' : expectancy > 0.15 ? 'Positive' : expectancy > 0 ? 'Thin edge' : 'Negative';
    return { trades, winRate, avgWin, avgLoss, riskPct, expectancy, expectedR, expectedAccountMove, roughDrawdown, breakEvenWinRate, grade };
  }

  function render() {
    const s = compute();
    $('scenarioGrade').textContent = s.grade;
    const warnings = [];
    if (s.expectancy <= 0) warnings.push('The paper strategy expectancy is negative or flat. Improve win rate, average win, or average loss before trusting it.');
    if (s.riskPct > 1) warnings.push('Risk per trade is above conservative sizing. Consider reducing it while evidence is limited.');
    if (s.winRate < s.breakEvenWinRate) warnings.push('Win rate is below the break-even level for the selected win/loss profile.');
    if (!warnings.length) warnings.push('The model is positive on paper. Continue recording outcomes before increasing confidence.');
    $('scenarioOutput').innerHTML = `<div class="scenario-note ${s.expectancy <= 0 ? 'scenario-danger' : s.expectancy < 0.15 ? 'scenario-warn' : ''}"><span>Scenario result</span><strong>${esc(s.grade)} • ${s.expectancy.toFixed(2)}R expectancy</strong><p>Expected ${s.expectedR.toFixed(2)}R over ${s.trades} paper trades. Approx account move: ${s.expectedAccountMove.toFixed(1)}%. Rough drawdown pressure: ${s.roughDrawdown.toFixed(1)}%.</p><p>${esc(warnings.join(' '))}</p></div>`;
    const rows = [
      ['Win rate', s.winRate],
      ['Break-even win rate', s.breakEvenWinRate],
      ['Risk pressure', Math.min(1, s.riskPct / 3)],
      ['Drawdown pressure', Math.min(1, s.roughDrawdown / 20)]
    ];
    $('scenarioBars').innerHTML = rows.map(([label, value]) => `<div class="scenario-bar"><span>${esc(label)}</span><div class="scenario-track"><div class="scenario-fill" style="width:${Math.max(0, Math.min(100, value * 100))}%"></div></div><strong>${pct(value)}</strong></div>`).join('');
  }

  createLab();
  ['simTrades','simWinRate','simAvgWin','simAvgLoss','simRiskPct'].forEach((id) => $(id).addEventListener('input', render));
  $('runScenario').addEventListener('click', render);
  render();
})();
