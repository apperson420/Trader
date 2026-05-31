(() => {
  const read = (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const eras = [
    ['Years 1-5', 'Foundation', 'Stabilize UX, paper broker, real market data, QA, and beginner coaching.'],
    ['Years 6-10', 'Evidence Engine', 'Historical candles, backtesting, strategy comparison, confidence scoring, and cloud memory.'],
    ['Years 11-20', 'Autonomous Paper Lab', 'Scheduled paper-trading agents, portfolio simulation, audit trails, risk caps, and strategy retirement.'],
    ['Years 21-35', 'Research Institution', 'Macro/fundamental/news research, multi-model AI review, and regulated compliance playbooks.'],
    ['Years 36-50', 'Self-Repairing Product', 'Automated tests, rollback, anomaly detection, and user-simulator QA before every release.'],
    ['Years 51-75', 'Compounding Knowledge System', 'Long-term memory, strategy genealogy, market-regime libraries, and performance attribution.'],
    ['Years 76-100', 'Legacy-Grade Operating System', 'Durable governance, portability, privacy, transparent autonomy, and no-loss upgrade law.']
  ];

  const upgradeFamilies = [
    'UX polish and accessibility',
    '7-year-old coach clarity',
    'Risk controls and score gates',
    'Read-only data adapters',
    'Paper broker execution safety',
    'Backtesting and simulation',
    'Charting and indicators',
    'AI coach intelligence',
    'Memory and persistence',
    'Audit logs and compliance',
    'CI/CD and release safety',
    'Security and secret protection',
    'Observability and monitoring',
    'Desktop packaging',
    'Documentation and setup guides',
    'Strategy lifecycle management',
    'Market-regime detection',
    'Portfolio/risk allocation',
    'Self-repair and rollback',
    'Product analytics and user simulation'
  ];

  function scoreState() {
    const watchlist = read('watchlist');
    const checks = read('checks');
    const outcomes = read('outcomes');
    const journal = read('journal');
    const playbooks = read('playbooks');
    const brokerLogs = read('broker_logs');
    let score = 12;
    score += Math.min(12, watchlist.length * 4);
    score += Math.min(12, checks.length * 2);
    score += Math.min(18, outcomes.length * 2);
    score += Math.min(14, journal.length * 2);
    score += Math.min(12, playbooks.length * 4);
    score += Math.min(8, brokerLogs.length * 2);
    score += 12; // deployed app + market/AI modules
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function generateUpgrades() {
    const upgrades = [];
    for (let year = 1; year <= 100; year++) {
      const family = upgradeFamilies[(year - 1) % upgradeFamilies.length];
      const era = eras.find((e, i) => year <= [5, 10, 20, 35, 50, 75, 100][i]) || eras.at(-1);
      upgrades.push({
        year,
        era: era[1],
        family,
        title: `Year ${year}: ${family}`,
        action: actionFor(family, year),
        safety: 'Preserve paper-first governance, no hidden orders, explicit approval gates, and no profit guarantees.'
      });
    }
    return upgrades;
  }

  function actionFor(family, year) {
    const map = {
      'UX polish and accessibility': 'Remove friction, shrink overlays, improve mobile layout, add plain-English labels, and keep the dashboard calm.',
      '7-year-old coach clarity': 'Teach one safe step at a time, highlight the exact control, and explain money/risk in child-simple words.',
      'Risk controls and score gates': 'Cap readiness scores until journal, checklist, outcomes, and paper evidence prove maturity.',
      'Read-only data adapters': 'Add another read-only source with safe failure behavior and no browser-exposed secrets.',
      'Paper broker execution safety': 'Improve paper-order tickets, confirmation gates, audit logs, and stop controls.',
      'Backtesting and simulation': 'Convert paper ideas into repeatable tests and compare expectancy, drawdown, and sample size.',
      'Charting and indicators': 'Improve chart clarity, add useful indicators, and label everything as research rather than signals.',
      'AI coach intelligence': 'Improve AI next-step reasoning using local memory, paper outcomes, and strategy evidence.',
      'Memory and persistence': 'Make progress portable, exportable, restorable, and eventually cloud-persistent with user control.',
      'Audit logs and compliance': 'Record every automated suggestion/action with why, when, and what safety gate applied.',
      'CI/CD and release safety': 'Add checks that prevent broken code, unsafe secrets, and untested releases from shipping.',
      'Security and secret protection': 'Keep keys server-side, scan for accidental secrets, and never store broker keys in the browser.',
      'Observability and monitoring': 'Track errors, uptime, API failures, and user confusion points without invading privacy.',
      'Desktop packaging': 'Prepare Windows-friendly app packaging, shortcuts, and beginner launch instructions.',
      'Documentation and setup guides': 'Turn setup into step-by-step instructions that assume the user knows nothing about computers.',
      'Strategy lifecycle management': 'Promote, pause, retire, or repair paper strategies based on evidence rather than hope.',
      'Market-regime detection': 'Classify market conditions and warn when a playbook does not fit the current regime.',
      'Portfolio/risk allocation': 'Limit total exposure, correlate risks, and prevent stacking too many similar ideas.',
      'Self-repair and rollback': 'Detect broken modules, offer recovery, and preserve the last known-good version.',
      'Product analytics and user simulation': 'Use synthetic beginner tests and usage patterns to find confusing flows before release.'
    };
    return `${map[family] || 'Improve the product safely.'} Cycle ${year} must be additive and no-loss.`;
  }

  function build() {
    if (document.getElementById('centuryEvolution')) return;
    const safety = document.querySelector('.safety');
    if (!safety) return;
    const section = document.createElement('section');
    section.id = 'centuryEvolution';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <span class="label">100-Year Evolution Engine</span>
      <h3>Century-grade product evolution simulator</h3>
      <p class="muted">This does not pretend to wait 100 real years. It creates a 100-year product-evolution doctrine, upgrade queue, and maturity simulator so every future upgrade compounds instead of drifting.</p>
      <div class="ce-grid">
        <div class="ce-card"><span>Current maturity</span><strong id="ceScore">0%</strong><p>Based on evidence stored in this browser.</p></div>
        <div class="ce-card"><span>Upgrade horizon</span><strong>100 years</strong><p>100 additive cycles, no-loss governance.</p></div>
        <div class="ce-card"><span>Safety law</span><strong>Paper first</strong><p>No hidden trades, no guarantees.</p></div>
        <div class="ce-card"><span>Next era</span><strong id="ceEra">Foundation</strong><p id="ceEraText">Stabilize the base.</p></div>
      </div>
      <div class="ce-actions"><button id="ceGenerate" type="button">Generate 100-year plan</button><button id="ceSave" type="button">Save to Project Brain</button><button id="ceExport" type="button">Export century plan</button></div>
      <div id="ceTimeline" class="ce-timeline"></div>
      <div id="ceQueue" class="ce-queue"></div>`;
    safety.parentNode.insertBefore(section, safety);

    const style = document.createElement('style');
    style.textContent = `.ce-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.ce-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:13px}.ce-card span{display:block;color:#c7d4e5;font-size:13px}.ce-card strong{display:block;color:#4cc9f0;font-size:24px;margin:5px 0}.ce-card p{color:#c7d4e5;margin:0}.ce-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.ce-actions button{width:auto}.ce-timeline,.ce-queue{display:grid;gap:10px}.ce-era,.ce-upgrade{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);border-radius:16px;padding:12px}.ce-era strong,.ce-upgrade strong{color:#a7f3d0}.ce-upgrade span{display:inline-flex;border-radius:999px;border:1px solid rgba(255,255,255,.16);padding:4px 8px;color:#d7e2f0;margin-right:6px;font-size:12px}@media(max-width:860px){.ce-grid{grid-template-columns:1fr}.ce-actions button{width:100%}}`;
    document.head.appendChild(style);

    document.getElementById('ceGenerate').onclick = renderPlan;
    document.getElementById('ceSave').onclick = savePlan;
    document.getElementById('ceExport').onclick = exportPlan;
    renderPlan();
  }

  function renderPlan() {
    const score = scoreState();
    document.getElementById('ceScore').textContent = `${score}%`;
    const era = score < 35 ? eras[0] : score < 55 ? eras[1] : score < 72 ? eras[2] : score < 85 ? eras[3] : eras[4];
    document.getElementById('ceEra').textContent = era[1];
    document.getElementById('ceEraText').textContent = era[2];
    document.getElementById('ceTimeline').innerHTML = eras.map((e) => `<div class="ce-era"><strong>${esc(e[0])}: ${esc(e[1])}</strong><p>${esc(e[2])}</p></div>`).join('');
    const upgrades = generateUpgrades();
    write('century_upgrades', upgrades);
    document.getElementById('ceQueue').innerHTML = upgrades.slice(0, 20).map((u) => `<div class="ce-upgrade"><strong>${esc(u.title)}</strong><p>${esc(u.action)}</p><span>${esc(u.era)}</span><span>${esc(u.family)}</span></div>`).join('') + `<p class="muted">Showing first 20 of 100 upgrade cycles. Export for the full century plan.</p>`;
  }

  function savePlan() {
    const plans = read('ai_plans');
    const upgrade = generateUpgrades()[0];
    write('ai_plans', [...plans, { time: new Date().toLocaleString(), title: 'Century Evolution next step', symbol: 'PRODUCT', maturity: scoreState(), instruction: upgrade.action, childStep: `Do this next: ${upgrade.action}`, adultGate: 'Product evolution only. Real money remains governed and paper-first.', status: 'Proposed' }]);
    toast('Century plan saved to AI Plans / Project Brain memory.');
  }

  function exportPlan() {
    const data = { exportedAt: new Date().toISOString(), app: 'Trader Command Center', doctrine: '100-year no-loss governed evolution', maturity: scoreState(), eras, upgrades: generateUpgrades() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-century-evolution-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toast(message) {
    const old = document.querySelector('.ce-toast'); if (old) old.remove();
    const box = document.createElement('div');
    box.className = 'ce-toast';
    box.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10000;max-width:420px;background:#10223d;color:#edf6ff;border:1px solid rgba(167,243,208,.45);border-radius:18px;padding:12px;box-shadow:0 18px 60px rgba(0,0,0,.35)';
    box.textContent = message;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
