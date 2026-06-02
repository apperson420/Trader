(() => {
  const persist = window.TraderPersistence;
  const KEY = 'guided_workflow';
  const STORAGE_KEY = `trader_${KEY}`;
  const defaultState = {
    active: false,
    currentIndex: 0,
    completed: [],
    startedAt: null,
    updatedAt: null,
    receipts: []
  };

  const steps = [
    {
      id: 'watchlist',
      title: '1. Add a study symbol',
      target: '#watchForm',
      button: 'Go to Watchlist',
      plain: 'Type BTC, ETH, SPY, AAPL, or another symbol you want to study. This only creates a research watchlist item.',
      proof: () => read('watchlist', []).length > 0,
      proofText: 'At least one watchlist symbol exists.'
    },
    {
      id: 'market',
      title: '2. Run Market Intelligence',
      target: '#marketIntel',
      button: 'Go to Market Intelligence',
      plain: 'Check a read-only quote. This step looks at market data but cannot place a trade.',
      proof: () => read('market_logs', []).length > 0,
      proofText: 'A market intelligence check has been saved.'
    },
    {
      id: 'chart',
      title: '3. Check the real chart',
      target: '#chartEngine',
      button: 'Go to Chart Engine',
      plain: 'Load historical candles and save chart proof before trusting any idea.',
      proof: () => Boolean(read('chart_last', null)),
      proofText: 'A chart proof record exists.'
    },
    {
      id: 'evolution',
      title: '4. Run 100-generation evolution',
      target: '#realResultsEngine',
      button: 'Go to Evolution',
      plain: 'Run the research optimizer. It tests paper strategy versions on history. It is not a buy or sell signal.',
      proof: () => Boolean(read('real_strategy_evolution', null)),
      proofText: 'A strategy evolution report exists.'
    },
    {
      id: 'validation',
      title: '5. Run Walk-Forward Validation',
      target: '#validationForge',
      button: 'Go to Validation',
      plain: 'Use holdout and Monte Carlo-style checks to fight overfitting before promoting anything to paper practice.',
      proof: () => Boolean(read('validation_report', null)),
      proofText: 'A validation report exists.'
    },
    {
      id: 'paper-plan',
      title: '6. Create a visible paper plan',
      target: '#aiBrain',
      button: 'Go to AI Plans',
      plain: 'Create or promote a paper-only plan. Real money remains locked, and broker orders stay in the separate PAPER ONLY ticket.',
      proof: () => read('ai_plans', []).some((p) => /paper/i.test(`${p.status || ''} ${p.title || ''} ${p.adultGate || ''}`)),
      proofText: 'A paper-scoped AI plan exists.'
    },
    {
      id: 'backup',
      title: '7. Export a backup',
      target: '#persistenceEngine',
      button: 'Go to Backup',
      plain: 'Download a backup JSON so your watchlist, journal, reports, and logs are not trapped in one browser.',
      proof: () => Boolean(read('guided_workflow', null)?.receipts?.length),
      proofText: 'A workflow receipt has been exported.'
    }
  ];

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function read(name, fallback = []) {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  }

  function write(name, value) {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  }

  function readState() {
    if (persist) return { ...defaultState, ...(persist.read(KEY, defaultState) || {}) };
    try { return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}) }; } catch { return { ...defaultState }; }
  }

  function writeState(next) {
    const state = { ...defaultState, ...next, updatedAt: new Date().toISOString() };
    if (persist) persist.write(KEY, state);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function evidenceDone(step) {
    try { return Boolean(step.proof()); } catch { return false; }
  }

  function effectiveCompleted() {
    const state = readState();
    const completed = new Set(state.completed || []);
    steps.forEach((step) => { if (evidenceDone(step)) completed.add(step.id); });
    return completed;
  }

  function scrollToTarget(selector) {
    const start = Date.now();
    const tryScroll = () => {
      const target = document.querySelector(selector);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (selector === '#watchForm') document.getElementById('symbolInput')?.focus({ preventScroll: true });
        return true;
      }
      if (Date.now() - start < 5000) setTimeout(tryScroll, 150);
      return false;
    };
    return tryScroll();
  }

  function toast(message) {
    const old = document.querySelector('.workflow-toast');
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = 'workflow-toast';
    box.textContent = message;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5200);
  }

  function startWorkflow() {
    const state = readState();
    writeState({ ...state, active: true, currentIndex: Math.min(state.currentIndex || 0, steps.length - 1), startedAt: state.startedAt || new Date().toISOString() });
    renderWorkflow();
    openCurrentStep();
  }

  function stopWorkflow() {
    writeState({ ...readState(), active: false });
    renderWorkflow();
    toast('Guided workflow paused. Your progress is saved.');
  }

  function resetWorkflow() {
    writeState({ ...defaultState, active: true, startedAt: new Date().toISOString(), completed: [] });
    renderWorkflow();
    toast('Guided workflow reset. Start with the watchlist.');
  }

  function setManualComplete(id, done) {
    const state = readState();
    const completed = new Set(state.completed || []);
    if (done) completed.add(id);
    else completed.delete(id);
    writeState({ ...state, completed: [...completed] });
    renderWorkflow();
  }

  function currentIndex() {
    const state = readState();
    return Math.max(0, Math.min(Number(state.currentIndex || 0), steps.length - 1));
  }

  function openCurrentStep() {
    const step = steps[currentIndex()];
    if (!step) return;
    scrollToTarget(step.target);
    toast(`Current guided step: ${step.title}`);
  }

  function nextStep() {
    const state = readState();
    const done = effectiveCompleted();
    const index = currentIndex();
    const current = steps[index];
    if (current && !done.has(current.id)) {
      openCurrentStep();
      toast('Finish or mark the current paper/research step complete before moving on.');
      return;
    }
    const nextIndex = Math.min(index + 1, steps.length - 1);
    writeState({ ...state, active: true, currentIndex: nextIndex });
    renderWorkflow();
    scrollToTarget(steps[nextIndex].target);
  }

  function exportReceipt() {
    const state = readState();
    const done = effectiveCompleted();
    const report = {
      exportedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      mode: 'paper_research_only',
      noRealMoneyOrders: true,
      currentStep: steps[currentIndex()]?.id,
      completed: steps.filter((s) => done.has(s.id)).map((s) => s.id),
      remaining: steps.filter((s) => !done.has(s.id)).map((s) => s.id),
      evidence: steps.map((s) => ({ id: s.id, title: s.title, complete: done.has(s.id), proofText: s.proofText })),
      safety: 'This receipt is research documentation only. It is not investment advice and no real-money order was sent.'
    };
    const receipt = { time: new Date().toLocaleString(), completed: report.completed.length, total: steps.length };
    writeState({ ...state, receipts: [...(state.receipts || []), receipt].slice(-20) });
    const journal = read('journal', []);
    write('journal', [...journal, { title: 'Guided workflow receipt', text: `Completed ${report.completed.length}/${steps.length} paper/research steps. No real-money order was sent.`, date: new Date().toLocaleString() }]);
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-guided-workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    renderWorkflow();
  }

  function renderCards() {
    const box = document.getElementById('workflowSteps');
    if (!box) return;
    const state = readState();
    const done = effectiveCompleted();
    const index = currentIndex();
    const active = Boolean(state.active);
    box.innerHTML = steps.map((step, i) => {
      const complete = done.has(step.id);
      const current = active && i === index;
      return `
        <article class="workflow-step ${complete ? 'workflow-done' : ''} ${current ? 'workflow-current' : ''}">
          <div>
            <span>${current ? 'Current step' : complete ? 'Complete' : 'Waiting'}</span>
            <strong>${esc(step.title)}</strong>
            <p>${esc(step.plain)}</p>
            <small>${complete ? esc(step.proofText) : 'Complete this step manually or let the app detect evidence.'}</small>
          </div>
          <div class="workflow-card-actions">
            <button class="workflow-go" type="button" data-target="${esc(step.target)}">${esc(step.button)}</button>
            <button class="workflow-mark" type="button" data-step="${esc(step.id)}">${complete ? 'Mark not done' : 'Mark done'}</button>
          </div>
        </article>`;
    }).join('');
    box.querySelectorAll('.workflow-go').forEach((button) => button.addEventListener('click', () => scrollToTarget(button.dataset.target)));
    box.querySelectorAll('.workflow-mark').forEach((button) => button.addEventListener('click', () => setManualComplete(button.dataset.step, !done.has(button.dataset.step))));
  }

  function renderWorkflow() {
    const panel = document.getElementById('guidedWorkflow');
    if (!panel) return;
    const state = readState();
    const done = effectiveCompleted();
    const index = currentIndex();
    const percent = Math.round((done.size / steps.length) * 100);
    document.getElementById('workflowProgress').textContent = `${done.size}/${steps.length}`;
    document.getElementById('workflowCurrent').textContent = steps[index]?.title || 'Ready';
    document.getElementById('workflowMode').textContent = state.active ? 'Guiding' : 'Paused';
    document.getElementById('workflowBar').style.width = `${percent}%`;
    renderCards();
  }

  function shell() {
    if (document.getElementById('guidedWorkflow')) return;
    const hero = document.querySelector('.hero');
    const section = document.createElement('section');
    section.id = 'guidedWorkflow';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <span class="label">Guided Workflow Mode</span>
      <h3>Start Here: research workflow from symbol to backup</h3>
      <p class="muted">A beginner-safe path through the real product chain: watchlist to market intelligence to chart proof to evolution to validation to paper plan to backup. This is paper/research only and not investment advice.</p>
      <div class="workflow-summary">
        <div><span>Status</span><strong id="workflowMode">Paused</strong></div>
        <div><span>Progress</span><strong id="workflowProgress">0/${steps.length}</strong></div>
        <div><span>Current</span><strong id="workflowCurrent">Ready</strong></div>
      </div>
      <div class="workflow-meter"><div id="workflowBar"></div></div>
      <div class="workflow-actions">
        <button id="workflowStart" type="button">Start guided workflow</button>
        <button id="workflowOpen" type="button">Open current step</button>
        <button id="workflowNext" type="button">Next step</button>
        <button id="workflowReceipt" type="button">Export workflow receipt</button>
        <button id="workflowPause" class="workflow-secondary" type="button">Pause</button>
        <button id="workflowReset" class="workflow-secondary" type="button">Reset</button>
      </div>
      <div id="workflowSteps" class="workflow-steps"></div>`;
    if (hero?.parentNode) hero.parentNode.insertBefore(section, hero.nextSibling);
    else document.body.prepend(section);

    const style = document.createElement('style');
    style.textContent = `
      #guidedWorkflow{position:relative;overflow:hidden}
      .workflow-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
      .workflow-summary div{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:12px;background:rgba(255,255,255,.055)}
      .workflow-summary span{display:block;color:#c7d4e5;font-size:13px}.workflow-summary strong{display:block;color:#4cc9f0;margin-top:4px}
      .workflow-meter{height:14px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;margin:10px 0 14px}.workflow-meter div{height:100%;width:0;background:linear-gradient(90deg,#4cc9f0,#a7f3d0);transition:width .2s ease}
      .workflow-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}.workflow-actions button{width:auto}.workflow-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}
      .workflow-steps{display:grid;gap:10px}.workflow-step{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.045);border-radius:16px;padding:12px}.workflow-step span{display:inline-flex;border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:4px 8px;color:#d7e2f0;font-size:12px}.workflow-step strong{display:block;color:#edf6ff;margin:6px 0}.workflow-step p{color:#c7d4e5;margin:0 0 6px}.workflow-step small{color:#a7f3d0}.workflow-done{border-left:4px solid #34d399}.workflow-current{box-shadow:0 0 0 2px rgba(76,201,240,.28)}.workflow-card-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.workflow-card-actions button{width:auto;border-radius:12px}.workflow-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10001;max-width:440px;background:#10223d;color:#edf6ff;border:1px solid rgba(167,243,208,.45);border-radius:18px;padding:12px;box-shadow:0 18px 60px rgba(0,0,0,.35)}
      @media(max-width:860px){.workflow-summary{grid-template-columns:1fr}.workflow-step{grid-template-columns:1fr}.workflow-actions button,.workflow-card-actions button{width:100%}}
    `;
    document.head.appendChild(style);
    document.getElementById('workflowStart').addEventListener('click', startWorkflow);
    document.getElementById('workflowOpen').addEventListener('click', openCurrentStep);
    document.getElementById('workflowNext').addEventListener('click', nextStep);
    document.getElementById('workflowReceipt').addEventListener('click', exportReceipt);
    document.getElementById('workflowPause').addEventListener('click', stopWorkflow);
    document.getElementById('workflowReset').addEventListener('click', resetWorkflow);
    renderWorkflow();
  }

  document.addEventListener('trader:persistence-restored', renderWorkflow);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
