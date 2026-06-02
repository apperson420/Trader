(() => {
  const persist = window.TraderPersistence;
  const KEY = 'setup_wizard';
  const STORAGE_KEY = `trader_${KEY}`;
  const defaultState = {
    hidden: false,
    completed: [],
    lastOpenedAt: null,
    updatedAt: null
  };
  const targetAliases = {
    '#watchForm': '#watchForm',
    '#marketIntel': '#marketIntel',
    '#chartEngine': '#chartEngine',
    '#realResultsEngine': '#realResultsEngine',
    '#validationForge': '#validationForge',
    '#persistenceEngine': '#persistenceEngine',
    '#paperBroker': '#paperBroker'
  };
  const steps = [
    {
      id: 'watchlist',
      title: 'Add your first watchlist symbol',
      text: 'Type BTC, ETH, SPY, or another symbol you want to study. This only tracks it for research.',
      target: '#watchForm',
      button: 'Add a symbol'
    },
    {
      id: 'market',
      title: 'Run Market Intelligence',
      text: 'Check a read-only quote. The app can look at market data, but it cannot place a trade from this step.',
      target: '#marketIntel',
      button: 'Open Market Intelligence'
    },
    {
      id: 'chart',
      title: 'Open Professional Chart Engine',
      text: 'Load a real historical chart and save chart proof before trusting any idea.',
      target: '#chartEngine',
      button: 'Open Chart Engine'
    },
    {
      id: 'evolution',
      title: 'Run 100-generation strategy evolution',
      text: 'Let the research optimizer test many paper strategy versions on historical data. It is not a signal to trade.',
      target: '#realResultsEngine',
      button: 'Open Evolution'
    },
    {
      id: 'validation',
      title: 'Run Walk-Forward Validation Forge',
      text: 'Check holdout and Monte Carlo-style risk before promoting anything to a paper plan.',
      target: '#validationForge',
      button: 'Open Validation'
    },
    {
      id: 'backup',
      title: 'Export or back up your data',
      text: 'Download a backup JSON so your watchlist, journal, reports, and logs are not stuck in one browser.',
      target: '#persistenceEngine',
      button: 'Open Backup'
    },
    {
      id: 'alpaca',
      title: 'Optional Alpaca paper setup',
      text: 'Only use Alpaca paper keys in Vercel server settings. Never paste broker secrets into this browser.',
      target: '#paperBroker',
      button: 'Open Paper Setup'
    },
    {
      id: 'supabase',
      title: 'Optional Supabase backup setup',
      text: 'Supabase is optional. Local browser storage works by default; service keys belong only on the server.',
      target: '#persistenceEngine',
      button: 'Open Supabase Notes'
    }
  ];

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

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

  function setComplete(id, done) {
    const state = readState();
    const completed = new Set(state.completed || []);
    if (done) completed.add(id);
    else completed.delete(id);
    writeState({ ...state, completed: [...completed] });
    renderSteps();
  }

  function findTarget(selector) {
    const direct = document.querySelector(selector);
    if (direct) return direct;
    const alias = targetAliases[selector];
    return alias ? document.querySelector(alias) : null;
  }

  function scrollToTarget(selector) {
    const start = Date.now();
    const tryScroll = () => {
      const target = findTarget(selector);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (selector === '#watchForm') document.getElementById('symbolInput')?.focus({ preventScroll: true });
        return;
      }
      if (Date.now() - start < 5000) setTimeout(tryScroll, 160);
    };
    tryScroll();
  }

  function setOpen(open) {
    const panel = document.getElementById('setupWizard');
    const button = document.getElementById('setupWizardOpen');
    if (!panel || !button) return;
    panel.classList.toggle('setup-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.textContent = open ? 'Hide setup wizard' : 'Open setup wizard';
    if (open) writeState({ ...readState(), hidden: false, lastOpenedAt: new Date().toISOString() });
  }

  function dismissForever() {
    writeState({ ...readState(), hidden: true });
    setOpen(false);
  }

  function renderSteps() {
    const box = document.getElementById('setupWizardSteps');
    const count = document.getElementById('setupWizardCount');
    if (!box || !count) return;
    const state = readState();
    const completed = new Set(state.completed || []);
    count.textContent = `${completed.size}/${steps.length} done`;
    box.innerHTML = steps.map((step, index) => {
      const done = completed.has(step.id);
      return `
        <article class="setup-step ${done ? 'setup-done' : ''}">
          <label>
            <input class="setup-check" type="checkbox" data-step="${esc(step.id)}" ${done ? 'checked' : ''}>
            <span><strong>${index + 1}. ${esc(step.title)}</strong><small>${esc(step.text)}</small></span>
          </label>
          <button class="setup-jump" type="button" data-target="${esc(step.target)}">${esc(step.button)}</button>
        </article>`;
    }).join('');
    box.querySelectorAll('.setup-check').forEach((input) => {
      input.addEventListener('change', () => setComplete(input.dataset.step, input.checked));
    });
    box.querySelectorAll('.setup-jump').forEach((button) => {
      button.addEventListener('click', () => scrollToTarget(button.dataset.target));
    });
  }

  function render() {
    if (document.getElementById('setupWizardDock')) return;
    const style = document.createElement('style');
    style.textContent = `
      .setup-dock{margin:0 0 18px 0;border:1px solid rgba(255,255,255,.18);border-radius:20px;background:rgba(15,27,48,.88);box-shadow:0 18px 50px rgba(0,0,0,.18);padding:14px;position:relative;z-index:1}
      .setup-dock-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .setup-dock-head h3{margin:4px 0 6px;font-size:24px}.setup-dock-actions{display:flex;gap:8px;flex-wrap:wrap}.setup-dock-actions button{width:auto;border-radius:12px}
      .setup-wizard{display:none;margin-top:12px;border-top:1px solid rgba(255,255,255,.14);padding-top:12px}
      .setup-wizard.setup-open{display:grid;gap:12px}
      .setup-wizard[aria-hidden="true"]{display:none}
      .setup-copy{display:grid;gap:10px}
      .setup-note,.setup-step{border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.055);padding:12px}
      .setup-note strong{display:block;color:#a7f3d0;margin-bottom:5px}.setup-note p,.setup-step small{display:block;color:#c7d4e5;line-height:1.45;margin:0}
      .setup-step{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.setup-step label{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start}.setup-step input{width:auto;margin-top:3px}.setup-step strong{color:#edf6ff}.setup-step.setup-done{border-left:4px solid #a7f3d0}
      .setup-actions{display:flex;gap:10px;flex-wrap:wrap}.setup-actions button,.setup-jump{width:auto;border-radius:12px}.setup-secondary{background:rgba(255,255,255,.1);color:#edf6ff;border:1px solid rgba(255,255,255,.2)}
      @media(max-width:700px){.setup-dock-actions,.setup-actions{display:grid;grid-template-columns:1fr}.setup-dock-actions button,.setup-actions button,.setup-jump{width:100%}.setup-step{grid-template-columns:1fr}}
      @media print{.setup-dock{display:none!important}}
    `;
    document.head.appendChild(style);

    const dock = document.createElement('section');
    dock.id = 'setupWizardDock';
    dock.className = 'setup-dock';
    dock.innerHTML = `
      <div class="setup-dock-head">
        <div><span class="label">First-run setup</span><h3>Start safely in 10 minutes</h3><p class="muted">This setup guide now lives inside the page, so it does not cover or overlap the dashboard.</p></div>
        <div class="setup-dock-actions">
          <button id="setupWizardOpen" type="button" aria-controls="setupWizard" aria-expanded="false">Open setup wizard</button>
          <button id="setupWizardDone" class="setup-secondary" type="button">Do not show again</button>
        </div>
      </div>
      <aside id="setupWizard" class="setup-wizard" aria-hidden="true">
        <div class="setup-copy">
          <div class="setup-note"><strong>Paper and research only</strong><p>No real-money trades are sent. This app helps you study, chart, test, validate, and journal ideas. It is not investment advice.</p></div>
          <div class="setup-note"><strong>What works now</strong><p>Watchlist, journal, Smart Analyst, Market Intelligence, historical charts, 100-generation evolution, validation, backup export/import, and optional paper-broker setup checks.</p></div>
          <div class="setup-note"><strong>Optional setup</strong><p>Alpaca paper keys, Supabase backup, OpenAI, and stock quote keys belong in Vercel server settings. The app still works without them.</p></div>
          <div class="section-head"><div><span class="label">Checklist</span><h3>What to click first</h3></div><strong id="setupWizardCount">0/${steps.length} done</strong></div>
          <div id="setupWizardSteps"></div>
        </div>
        <div class="setup-actions">
          <button id="setupWizardLater" class="setup-secondary" type="button">Collapse setup guide</button>
        </div>
      </aside>
    `;

    const workflow = document.getElementById('guidedWorkflow');
    const hero = document.querySelector('.hero');
    if (workflow?.parentNode) workflow.parentNode.insertBefore(dock, workflow.nextSibling);
    else if (hero?.parentNode) hero.parentNode.insertBefore(dock, hero.nextSibling);
    else document.body.prepend(dock);

    const panel = document.getElementById('setupWizard');
    document.getElementById('setupWizardOpen').addEventListener('click', () => setOpen(!panel.classList.contains('setup-open')));
    document.getElementById('setupWizardLater').addEventListener('click', () => setOpen(false));
    document.getElementById('setupWizardDone').addEventListener('click', dismissForever);
    renderSteps();
    if (!readState().hidden) setTimeout(() => setOpen(true), 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
