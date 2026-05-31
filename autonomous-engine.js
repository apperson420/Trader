(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let timer = null;

  const style = document.createElement('style');
  style.textContent = `.auto-status{display:inline-flex;border-radius:999px;border:1px solid rgba(167,243,208,.35);padding:7px 11px;color:#a7f3d0;background:rgba(167,243,208,.1);font-weight:900}.auto-log{max-height:280px;overflow:auto}.auto-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px;margin-top:10px}.auto-card strong{color:#4cc9f0}.auto-steps{display:grid;gap:10px;margin-top:12px}.auto-steps div{border-left:4px solid #a7f3d0;padding:8px 10px;background:rgba(255,255,255,.045);border-radius:12px}.auto-stop{background:#fca5a5!important;color:#111827!important}.auto-approve{background:#a7f3d0!important;color:#06101d!important}`;
  document.head.appendChild(style);

  function addUI() {
    if (document.getElementById('autonomousEngine')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'autonomousEngine';
    section.className = 'grid two';
    section.innerHTML = `
      <article class="panel smart-panel">
        <div class="section-head"><div><span class="label">Autonomous Engine</span><h3>Safe paper-trading autopilot</h3></div><span id="autoStatus" class="auto-status">Stopped</span></div>
        <p class="muted">This is the path toward autonomy: it can observe your practice list, create paper plans, score them, add coach notes, and keep an audit trail. It still cannot place real trades.</p>
        <div class="form-grid">
          <label>Goal <select id="autoGoal"><option>Learn safely first</option><option>Build a profitable paper routine</option><option>Prepare for adult-reviewed real trading later</option></select></label>
          <label>Cycle speed <select id="autoSpeed"><option value="30000">Every 30 seconds</option><option value="60000">Every 1 minute</option><option value="120000">Every 2 minutes</option></select></label>
          <label>Mode <select id="autoMode"><option>Coach only</option><option>Generate paper plans</option><option>Generate and journal plans</option></select></label>
          <label>Safety lock <select id="autoSafety"><option>Adult approval required for real money</option><option>Paper only forever</option></select></label>
        </div>
        <div class="evo-actions">
          <button id="autoRunOnce" type="button">Run one cycle</button>
          <button id="autoStart" type="button">Start autopilot</button>
          <button id="autoStop" class="auto-stop" type="button">Stop</button>
        </div>
        <div id="autoCurrent" class="result-box stacked"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Autonomy audit trail</span><h3>Everything it does is visible</h3></div><button id="autoClear" class="ghost">Clear</button></div>
        <div id="autoLog" class="list auto-log"></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">7-year-old exact steps</span><h3>What to do when autopilot runs</h3></div></div>
        <div class="auto-steps">
          <div><strong>1. Add study symbols.</strong><p class="muted">Use Watchlist. Example: BTC, SPY, or a stock a grown-up says is okay to study.</p></div>
          <div><strong>2. Press Run one cycle.</strong><p class="muted">The robot coach makes a pretend plan. It does not buy or sell.</p></div>
          <div><strong>3. Read the warning.</strong><p class="muted">If it says stop, do not argue with it. Fix the plan first.</p></div>
          <div><strong>4. Journal the lesson.</strong><p class="muted">The path to real money is not guessing. It is practice, proof, and discipline.</p></div>
          <div><strong>5. Ask a grown-up.</strong><p class="muted">Real money can only happen later with adult approval, broker rules, taxes, and safety locks.</p></div>
        </div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">Autonomy roadmap</span><h3>How this becomes truly autonomous</h3></div></div>
        <div class="auto-steps">
          <div><strong>Stage 1: Autonomous paper coach.</strong><p class="muted">Implemented now. It plans and journals practice ideas.</p></div>
          <div><strong>Stage 2: Read-only market data.</strong><p class="muted">Future: connect safe public data APIs without keys in the browser.</p></div>
          <div><strong>Stage 3: Paper broker integration.</strong><p class="muted">Future: paper account only, with logs and stop buttons.</p></div>
          <div><strong>Stage 4: Real-money gate.</strong><p class="muted">Future: adult-owned account, legal compliance, tiny limits, explicit approval, and no secret actions.</p></div>
        </div>
      </article>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function scoreSymbol(symbol, index) {
    const checks = get('checks').length;
    const outcomes = get('outcomes');
    const wins = outcomes.filter((x) => x.symbol === symbol && x.result === 'Win').length;
    const losses = outcomes.filter((x) => x.symbol === symbol && x.result === 'Loss').length;
    let score = 55 + checks * 3 + wins * 4 - losses * 3 - index;
    score = Math.max(0, Math.min(100, score));
    return score;
  }

  function createPlan() {
    const watchlist = get('watchlist');
    const symbols = watchlist.length ? watchlist : ['BTC'];
    const ranked = symbols.map((s, i) => ({ symbol: s, score: scoreSymbol(s, i) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const riskPct = Number(document.getElementById('riskPercent')?.value || 1);
    const guardrail = riskPct <= 1 ? 'Risk looks small enough for paper practice.' : 'Risk is too high. Reduce to 1% or less before trusting the plan.';
    const action = best.score >= 75 ? 'Create a paper setup and journal the reason.' : best.score >= 55 ? 'Study only. Improve checklist before paper trading.' : 'Skip. The setup is not ready.';
    return { time: new Date().toLocaleString(), symbol: best.symbol, score: best.score, action, guardrail, goal: $('autoGoal').value, mode: $('autoMode').value };
  }

  function logPlan(plan) {
    const logs = get('auto_logs');
    set('auto_logs', [...logs, plan].slice(-40));
    if (plan.mode === 'Generate and journal plans') {
      const journal = get('journal');
      set('journal', [...journal, { title: `Autopilot paper plan: ${plan.symbol}`, text: `${plan.action} ${plan.guardrail} Score: ${plan.score}%. Goal: ${plan.goal}.`, date: plan.time }]);
    }
  }

  function render() {
    const logs = get('auto_logs');
    const latest = logs[logs.length - 1];
    const current = $('autoCurrent');
    if (current) current.innerHTML = latest ? `<div><span>Latest autonomous cycle</span><strong>${esc(latest.symbol)} • ${latest.score}%</strong><p>${esc(latest.action)}</p><p>${esc(latest.guardrail)}</p></div>` : '<div><span>Waiting</span><strong>No cycle yet</strong><p>Press Run one cycle to let the coach create a paper plan.</p></div>';
    const log = $('autoLog');
    if (log) log.innerHTML = logs.slice().reverse().map((x) => `<div class="auto-card"><strong>${esc(x.symbol)} • ${x.score}%</strong><p>${esc(x.action)}</p><p>${esc(x.guardrail)}</p><small>${esc(x.time)}</small></div>`).join('') || '<p class="muted">No autonomous actions yet.</p>';
  }

  function runCycle() {
    const plan = createPlan();
    logPlan(plan);
    render();
  }

  function start() {
    stop();
    $('autoStatus').textContent = 'Running';
    runCycle();
    timer = setInterval(runCycle, Number($('autoSpeed').value || 30000));
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    const status = $('autoStatus');
    if (status) status.textContent = 'Stopped';
  }

  addUI();
  $('autoRunOnce').addEventListener('click', runCycle);
  $('autoStart').addEventListener('click', start);
  $('autoStop').addEventListener('click', stop);
  $('autoClear').addEventListener('click', () => { set('auto_logs', []); render(); });
  render();
})();
