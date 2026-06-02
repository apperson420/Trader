(() => {
  const STORAGE_KEY = 'trader_layout_polish';
  const defaultState = { compactWorkflow: true, quietSetup: true };
  const readState = () => {
    try { return { ...defaultState, ...(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {}) }; } catch { return { ...defaultState }; }
  };
  const writeState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readState(), ...state, updatedAt: new Date().toISOString() }));

  function injectStyles() {
    if (document.getElementById('layoutPolishStyles')) return;
    const style = document.createElement('style');
    style.id = 'layoutPolishStyles';
    style.textContent = `
      body{background:radial-gradient(circle at top left,rgba(76,201,240,.13),transparent 34rem),linear-gradient(180deg,#08111f,#07101d 52%,#08111f)}
      .topbar{padding:20px 0 10px}.topbar h1{margin:.2rem 0 0}.shell{gap:14px}.hero{align-items:center;min-height:auto}.hero h2{font-size:clamp(30px,4.6vw,54px);line-height:1.02;margin:14px 0}.hero p{max-width:68ch}.panel,.card,.hero-card{box-shadow:0 18px 56px rgba(0,0,0,.22)}.panel{padding:18px}.section-head{align-items:center;flex-wrap:wrap}.section-head h3{margin:.2rem 0}.card{padding:16px}.card strong{font-size:clamp(26px,4vw,32px)}button{min-height:42px}.row-form button,.form-grid button,.workflow-actions button,.setup-dock-actions button,.setup-actions button,.evo-actions button{white-space:nowrap}.setup-dock{background:rgba(15,27,48,.72)!important}.setup-dock-head h3{font-size:21px!important}.setup-dock:not(.setup-priority){opacity:.94}.setup-wizard.setup-open{max-height:520px;overflow:auto}.workflow-actions{align-items:center}.workflow-primary-actions{display:flex;gap:10px;flex-wrap:wrap}.workflow-secondary-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}.workflow-compact #workflowSteps .workflow-step:not(.workflow-current):not(.workflow-done){display:none}.workflow-compact #workflowSteps{position:relative}.workflow-compact #workflowSteps::after{content:'Compact view hides waiting steps. Use Show all steps to review the full checklist.';display:block;color:#c7d4e5;font-size:13px;margin-top:4px}.workflow-toggle-full{background:rgba(255,255,255,.1)!important;color:#edf6ff!important;border:1px solid rgba(255,255,255,.18)!important}.workflow-step{transition:transform .18s ease,box-shadow .18s ease}.workflow-current{background:rgba(76,201,240,.08)!important}.workflow-card-actions button{min-width:132px}.result-box,.mini-grid{gap:10px}.list{gap:8px}.item{padding:10px 12px}.polish-skipbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}.polish-skipbar button{width:auto;background:rgba(255,255,255,.09);color:#edf6ff;border:1px solid rgba(255,255,255,.18);border-radius:999px;min-height:36px;padding:8px 12px}.polish-skipbar strong{color:#a7f3d0;margin-right:4px}.polish-section-note{color:#c7d4e5;font-size:13px;margin:8px 0 0}@media(max-width:860px){.hero-card strong{font-size:26px}.panel{padding:15px}.workflow-secondary-actions,.workflow-primary-actions{width:100%;display:grid;grid-template-columns:1fr}.workflow-card-actions{justify-content:stretch}.workflow-card-actions button{width:100%}.polish-skipbar button{width:100%}}`;
    document.head.appendChild(style);
  }

  function addSkipbar() {
    if (document.getElementById('layoutPolishSkipbar')) return;
    const shell = document.querySelector('.shell');
    const hero = document.querySelector('.hero');
    if (!shell || !hero) return;
    const bar = document.createElement('nav');
    bar.id = 'layoutPolishSkipbar';
    bar.className = 'polish-skipbar';
    bar.setAttribute('aria-label', 'Quick product navigation');
    bar.innerHTML = `<strong>Quick jump:</strong>
      <button type="button" data-target="#guidedWorkflow">Start Here</button>
      <button type="button" data-target="#watchForm">Watchlist</button>
      <button type="button" data-target="#chartEngine">Chart</button>
      <button type="button" data-target="#validationForge">Validation</button>
      <button type="button" data-target="#persistenceEngine">Backup</button>`;
    shell.insertBefore(bar, hero.nextSibling);
    bar.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
      const target = document.querySelector(button.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function splitWorkflowActions() {
    const actions = document.querySelector('#guidedWorkflow .workflow-actions');
    if (!actions || actions.dataset.polished === 'true') return;
    actions.dataset.polished = 'true';
    const primary = document.createElement('div');
    primary.className = 'workflow-primary-actions';
    const secondary = document.createElement('div');
    secondary.className = 'workflow-secondary-actions';
    ['workflowStart', 'workflowOpen', 'workflowNext'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) primary.appendChild(button);
    });
    ['workflowReceipt', 'workflowPause', 'workflowReset'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) secondary.appendChild(button);
    });
    const toggle = document.createElement('button');
    toggle.id = 'workflowToggleFull';
    toggle.className = 'workflow-toggle-full';
    toggle.type = 'button';
    secondary.appendChild(toggle);
    actions.appendChild(primary);
    actions.appendChild(secondary);
    const sync = () => {
      const state = readState();
      document.body.classList.toggle('workflow-compact', Boolean(state.compactWorkflow));
      toggle.textContent = state.compactWorkflow ? 'Show all steps' : 'Compact steps';
    };
    toggle.addEventListener('click', () => {
      const state = readState();
      writeState({ compactWorkflow: !state.compactWorkflow });
      sync();
    });
    sync();
  }

  function quietSetupDock() {
    const setup = document.getElementById('setupWizard');
    const open = document.getElementById('setupWizardOpen');
    const dock = document.getElementById('setupWizardDock');
    if (!setup || !open || !dock || dock.dataset.polished === 'true') return;
    dock.dataset.polished = 'true';
    dock.classList.remove('setup-priority');
    const note = document.createElement('p');
    note.className = 'polish-section-note';
    note.textContent = 'Tip: use Guided Workflow first. Open this setup guide only when you want the longer checklist.';
    dock.querySelector('.setup-dock-head > div')?.appendChild(note);
  }

  function tick() {
    injectStyles();
    addSkipbar();
    splitWorkflowActions();
    quietSetupDock();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick);
  else tick();
  document.addEventListener('trader:persistence-restored', tick);
  setTimeout(tick, 400);
  setTimeout(tick, 1200);
})();
