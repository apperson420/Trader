(() => {
  const key = (name) => `trader_${name}`;
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(key(name)) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(key(name), JSON.stringify(value));
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  const style = document.createElement('style');
  style.textContent = `
    .evo-table{width:100%;border-collapse:collapse;margin-top:12px;color:#c7d4e5}.evo-table th,.evo-table td{border-bottom:1px solid rgba(255,255,255,.12);padding:9px;text-align:left}.evo-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.evo-actions button,.evo-actions label{width:auto}.evo-chip{display:inline-flex;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 10px;margin:4px;background:rgba(255,255,255,.06);color:#c7d4e5}.evo-warning{border-left:4px solid #fbbf24;padding-left:12px}.evo-good{border-left:4px solid #34d399;padding-left:12px}.evo-danger{border-left:4px solid #f87171;padding-left:12px}.evo-file{display:inline-flex;align-items:center;cursor:pointer;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:12px 14px;color:#edf6ff;font-weight:900}.evo-file input{display:none}@media(max-width:860px){.evo-table{font-size:13px}}`;
  document.head.appendChild(style);

  function buildShell() {
    const safety = document.querySelector('.safety');
    if (!safety || document.getElementById('evolutionLab')) return;
    const section = document.createElement('section');
    section.id = 'evolutionLab';
    section.className = 'grid two';
    section.innerHTML = `
      <article class="panel smart-panel">
        <div class="section-head"><div><span class="label">Evolution Engine</span><h3>Performance intelligence</h3></div><strong id="evoGrade">New</strong></div>
        <div class="grid stats" style="grid-template-columns:repeat(2,1fr)">
          <article class="card"><span class="label">Paper trades</span><strong id="evoTrades">0</strong><small>recorded outcomes</small></article>
          <article class="card"><span class="label">Win rate</span><strong id="evoWinRate">0%</strong><small>from outcomes</small></article>
          <article class="card"><span class="label">Avg R</span><strong id="evoAvgR">0.00R</strong><small>mean result</small></article>
          <article class="card"><span class="label">Expectancy</span><strong id="evoExpectancy">0.00R</strong><small>per paper trade</small></article>
        </div>
        <div id="evoCoach" class="result-box stacked"></div>
        <table class="evo-table"><thead><tr><th>Symbol</th><th>Result</th><th>R</th><th>Discipline</th></tr></thead><tbody id="evoRows"></tbody></table>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Outcome Recorder</span><h3>Teach the system from paper results</h3></div><button id="clearOutcomes" class="ghost">Clear</button></div>
        <form id="outcomeForm" class="form-grid">
          <label>Symbol <input id="outSymbol" value="BTC" /></label>
          <label>Setup name <input id="outSetup" placeholder="Breakout, pullback, range" /></label>
          <label>Result <select id="outResult"><option>Win</option><option>Loss</option><option>Breakeven</option></select></label>
          <label>Realized R <input id="outR" type="number" step="0.1" value="1" /></label>
          <label>Followed plan? <select id="outDiscipline"><option>Yes</option><option>Mostly</option><option>No</option></select></label>
          <label>Lesson <input id="outLesson" placeholder="What should improve next time?" /></label>
          <button class="wide">Save outcome</button>
        </form>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Playbook Builder</span><h3>Reusable rules</h3></div><button id="clearPlaybooks" class="ghost">Clear</button></div>
        <form id="playbookForm" class="journal-form">
          <input id="playName" placeholder="Setup name" />
          <textarea id="playRules" placeholder="Entry rules, invalidation, sizing, when to skip"></textarea>
          <button>Save playbook rule</button>
        </form>
        <div id="playbookList" class="list"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Project Brain Backup</span><h3>Export / import local memory</h3></div></div>
        <p class="muted">Exports watchlist, journal, checklist, outcomes, and playbooks from this browser. It does not include broker keys or real account data.</p>
        <div class="evo-actions">
          <button id="exportBrain" type="button">Export Brain JSON</button>
          <label class="evo-file">Import Brain JSON<input id="importBrain" type="file" accept="application/json" /></label>
        </div>
        <div id="backupStatus" class="list"></div>
      </article>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function metrics() {
    const outcomes = get('outcomes');
    const total = outcomes.length;
    const wins = outcomes.filter((x) => x.result === 'Win').length;
    const losses = outcomes.filter((x) => x.result === 'Loss').length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;
    const avgR = total ? outcomes.reduce((sum, x) => sum + number(x.r), 0) / total : 0;
    const discipline = total ? Math.round((outcomes.filter((x) => x.discipline !== 'No').length / total) * 100) : 100;
    return { outcomes, total, wins, losses, winRate, avgR, expectancy: avgR, discipline };
  }

  function coach(m) {
    const tips = [];
    if (!m.total) tips.push(['evo-warning', 'Start by recording paper outcomes. The system gets smarter after it has results to learn from.']);
    if (m.total >= 3 && m.expectancy < 0) tips.push(['evo-danger', 'Expectancy is negative. Reduce size, trade less often, and identify the setup that causes most losses.']);
    if (m.total >= 3 && m.winRate < 40 && m.avgR < 1) tips.push(['evo-warning', 'Win rate and average R are both weak. Tighten setup filters before adding more trades.']);
    if (m.discipline < 75) tips.push(['evo-danger', 'Discipline is the bottleneck. Do not trust any setup until you consistently follow the plan.']);
    if (m.total >= 5 && m.expectancy > 0 && m.discipline >= 80) tips.push(['evo-good', 'Paper performance is improving. Keep risk small and continue collecting evidence.']);
    if (!tips.length) tips.push(['evo-good', 'No major red flags from recorded outcomes. Keep journaling and protect the downside.']);
    return tips;
  }

  function renderEvolution() {
    const m = metrics();
    if (!$('evoTrades')) return;
    $('evoTrades').textContent = m.total;
    $('evoWinRate').textContent = `${m.winRate}%`;
    $('evoAvgR').textContent = `${m.avgR.toFixed(2)}R`;
    $('evoExpectancy').textContent = `${m.expectancy.toFixed(2)}R`;
    $('evoGrade').textContent = m.total < 3 ? 'Learning' : m.expectancy > 0 && m.discipline >= 80 ? 'Improving' : m.expectancy < 0 ? 'Repair' : 'Review';
    $('evoCoach').innerHTML = coach(m).map(([cls, text]) => `<div class="${cls}"><span>Synthetic coach</span><strong>${esc(text)}</strong></div>`).join('');
    $('evoRows').innerHTML = m.outcomes.slice().reverse().slice(0, 8).map((x) => `<tr><td>${esc(x.symbol)}</td><td>${esc(x.result)}</td><td>${number(x.r).toFixed(2)}R</td><td>${esc(x.discipline)}</td></tr>`).join('') || '<tr><td colspan="4">No outcomes recorded yet.</td></tr>';
  }

  function renderPlaybooks() {
    const list = $('playbookList');
    if (!list) return;
    const playbooks = get('playbooks');
    list.innerHTML = playbooks.length ? '' : '<p class="muted">No playbook rules yet.</p>';
    playbooks.slice().reverse().forEach((p) => {
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `<div><strong>${esc(p.name)}</strong><p>${esc(p.rules)}</p><p>${esc(p.date)}</p></div>`;
      list.appendChild(item);
    });
  }

  function wire() {
    $('outcomeForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const outcome = { symbol: $('outSymbol').value.trim().toUpperCase() || 'UNKNOWN', setup: $('outSetup').value.trim(), result: $('outResult').value, r: number($('outR').value), discipline: $('outDiscipline').value, lesson: $('outLesson').value.trim(), date: new Date().toLocaleString() };
      set('outcomes', [...get('outcomes'), outcome]);
      $('outLesson').value = '';
      renderEvolution();
    });
    $('clearOutcomes').addEventListener('click', () => { set('outcomes', []); renderEvolution(); });
    $('playbookForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('playName').value.trim() || 'Unnamed setup';
      const rules = $('playRules').value.trim();
      if (!rules) return;
      set('playbooks', [...get('playbooks'), { name, rules, date: new Date().toLocaleString() }]);
      $('playName').value = '';
      $('playRules').value = '';
      renderPlaybooks();
    });
    $('clearPlaybooks').addEventListener('click', () => { set('playbooks', []); renderPlaybooks(); });
    $('exportBrain').addEventListener('click', () => {
      const data = { exportedAt: new Date().toISOString(), watchlist: get('watchlist'), journal: get('journal'), checks: get('checks'), outcomes: get('outcomes'), playbooks: get('playbooks') };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trader-command-center-brain-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      $('backupStatus').innerHTML = '<p class="muted">Export created.</p>';
    });
    $('importBrain').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const data = JSON.parse(await file.text());
      ['watchlist','journal','checks','outcomes','playbooks'].forEach((name) => { if (Array.isArray(data[name])) set(name, data[name]); });
      $('backupStatus').innerHTML = '<p class="muted">Import complete. Refresh if the top dashboard did not update immediately.</p>';
      renderEvolution();
      renderPlaybooks();
    });
  }

  buildShell();
  wire();
  renderEvolution();
  renderPlaybooks();
})();
