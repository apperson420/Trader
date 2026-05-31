(() => {
  const read = (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const style = document.createElement('style');
  style.textContent = `.real-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.real-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:13px}.real-card span{display:block;color:#c7d4e5;font-size:13px}.real-card strong{display:block;color:#4cc9f0;font-size:24px;margin:5px 0}.real-card p{color:#c7d4e5;margin:0}.real-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.real-actions button{width:auto}.real-list{display:grid;gap:10px}.real-row{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);border-radius:16px;padding:12px}.real-ok{border-left:4px solid #34d399}.real-warn{border-left:4px solid #fbbf24}.real-bad{border-left:4px solid #f87171}.real-row strong{color:#a7f3d0}.real-row p{color:#c7d4e5;margin:6px 0}.real-row small{color:#c7d4e5}@media(max-width:860px){.real-grid{grid-template-columns:1fr}.real-actions button{width:100%}}`;
  document.head.appendChild(style);

  function metricData() {
    const outcomes = read('outcomes');
    const wins = outcomes.filter((x) => x.result === 'Win').length;
    const losses = outcomes.filter((x) => x.result === 'Loss').length;
    const total = outcomes.length;
    const avgR = total ? outcomes.reduce((sum, x) => sum + Number(x.r || 0), 0) / total : 0;
    const winRate = total ? Math.round((wins / total) * 100) : 0;
    return {
      watchlist: read('watchlist').length,
      journal: read('journal').length,
      checks: read('checks').length,
      outcomes: total,
      playbooks: read('playbooks').length,
      brokerLogs: read('broker_logs').length,
      avgR,
      winRate
    };
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

  function build() {
    if (document.getElementById('realResultsEngine')) return;
    const safety = document.querySelector('.safety');
    if (!safety) return;
    const section = document.createElement('section');
    section.id = 'realResultsEngine';
    section.className = 'panel smart-panel';
    section.innerHTML = `<span class="label">Real Results Engine</span><h3>Production self-test and evidence dashboard</h3><p class="muted">This replaces roadmap-only output with working product checks: live endpoints, local memory, evidence maturity, paper-broker readiness, and exportable proof.</p><div class="real-grid"><div class="real-card"><span>Readiness</span><strong id="realReady">0%</strong><p>Evidence-based, not assumed.</p></div><div class="real-card"><span>Paper outcomes</span><strong id="realOutcomes">0</strong><p>Recorded practice results.</p></div><div class="real-card"><span>Average R</span><strong id="realAvgR">0.00R</strong><p>Outcome expectancy proxy.</p></div><div class="real-card"><span>System status</span><strong id="realStatus">Unchecked</strong><p>Run self-test.</p></div></div><div class="real-actions"><button id="realRun" type="button">Run real self-test</button><button id="realFix" type="button">Apply safe defaults</button><button id="realExport" type="button">Export proof report</button></div><div id="realList" class="real-list"></div>`;
    safety.parentNode.insertBefore(section, safety);
    document.getElementById('realRun').onclick = runSelfTest;
    document.getElementById('realFix').onclick = applyDefaults;
    document.getElementById('realExport').onclick = exportReport;
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
    checks.push(['AI chat API method gate', await ping('/api/ai-chat', 405)]);
    checks.push(['Paper broker API', await ping('/api/alpaca-paper?action=status')]);
    const m = metricData();
    const evidenceOk = m.watchlist > 0 && m.checks >= 6 && m.outcomes >= 10;
    const brokerReady = m.brokerLogs > 0;
    const report = checks.map(([name, result]) => ({ name, ...result })).concat([
      { name: 'Evidence maturity', ok: evidenceOk, status: evidenceOk ? 200 : 428, ms: 0, detail: evidenceOk ? 'Enough starter evidence exists.' : 'Needs watchlist, checklist, and at least 10 paper outcomes.' },
      { name: 'Paper broker activity', ok: brokerReady, status: brokerReady ? 200 : 428, ms: 0, detail: brokerReady ? 'Broker audit log exists.' : 'Paper broker is not configured or has not been tested yet.' }
    ]);
    write('real_results_report', { generatedAt: new Date().toISOString(), readiness: readiness(m), metrics: m, checks: report });
    const allOk = report.every((x) => x.ok);
    document.getElementById('realStatus').textContent = allOk ? 'Passed' : 'Needs work';
    list.innerHTML = report.map((x) => row(x.name, x.ok, x.detail, `status ${x.status}, ${x.ms}ms`)).join('');
  }

  function applyDefaults() {
    if (!read('watchlist').length) write('watchlist', ['BTC', 'SPY', 'AAPL']);
    if (!read('playbooks').length) write('playbooks', [{ name: 'Beginner paper setup', rules: 'Only paper trade when the checklist is complete, risk is 1% or less, stop is defined, and reward is at least 2R.', date: new Date().toLocaleString() }]);
    const journal = read('journal');
    write('journal', [...journal, { title: 'Safe defaults applied', text: 'Added starter watchlist and beginner playbook. Still paper-only. Real money remains locked.', date: new Date().toLocaleString() }]);
    renderMetrics();
    runSelfTest();
  }

  function exportReport() {
    const report = read('real_results_report', { generatedAt: new Date().toISOString(), readiness: readiness(metricData()), metrics: metricData(), checks: [] });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-real-results-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
