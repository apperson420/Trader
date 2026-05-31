(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let loop = null;

  const style = document.createElement('style');
  style.textContent = `.ai-chip{display:inline-flex;border:1px solid rgba(167,243,208,.35);background:rgba(167,243,208,.1);color:#a7f3d0;border-radius:999px;padding:7px 10px;margin:4px;font-weight:900}.ai-board{display:grid;gap:10px}.ai-agent{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.ai-agent strong{color:#4cc9f0}.ai-agent p{color:#c7d4e5}.ai-danger{border-left:4px solid #f87171}.ai-warn{border-left:4px solid #fbbf24}.ai-good{border-left:4px solid #34d399}.ai-action{border-left:4px solid #4cc9f0}.ai-status{display:inline-flex;border-radius:999px;border:1px solid rgba(255,255,255,.16);padding:7px 11px;color:#d7e2f0;background:rgba(255,255,255,.06);font-weight:900}.ai-approve{background:#a7f3d0!important;color:#06101d!important}.ai-stop{background:#fca5a5!important;color:#111827!important}`;
  document.head.appendChild(style);

  function memory() {
    return {
      watchlist: get('watchlist'),
      journal: get('journal'),
      checks: get('checks'),
      outcomes: get('outcomes'),
      playbooks: get('playbooks'),
      autoLogs: get('auto_logs'),
      aiPlans: get('ai_plans')
    };
  }

  function maturity(m) {
    let score = 10;
    score += Math.min(20, m.watchlist.length * 4);
    score += Math.min(20, m.checks.length * 4);
    score += Math.min(20, m.journal.length * 2);
    score += Math.min(20, m.outcomes.length * 4);
    score += Math.min(10, m.playbooks.length * 5);
    return Math.max(0, Math.min(100, score));
  }

  function council() {
    const m = memory();
    const riskPct = Number(document.getElementById('riskPercent')?.value || 1);
    const mat = maturity(m);
    const wins = m.outcomes.filter((x) => x.result === 'Win').length;
    const losses = m.outcomes.filter((x) => x.result === 'Loss').length;
    const total = m.outcomes.length;
    const winRate = total ? Math.round((wins / total) * 100) : 0;
    const avgR = total ? m.outcomes.reduce((sum, x) => sum + Number(x.r || 0), 0) / total : 0;
    const next = [];
    if (!m.watchlist.length) next.push('Add 1 to 3 study symbols to the watchlist.');
    if (m.checks.length < 6) next.push('Finish the readiness checklist before trusting any idea.');
    if (!m.playbooks.length) next.push('Create one simple playbook rule in kid-simple words.');
    if (m.outcomes.length < 10) next.push('Record at least 10 paper outcomes before thinking about real-money readiness.');
    if (riskPct > 1) next.push('Lower risk to 1% or less while learning.');
    if (!next.length) next.push('Run Scenario Lab, then continue paper tracking for consistency.');
    const realMoneyGate = mat >= 85 && m.outcomes.length >= 20 && avgR > 0 && winRate >= 45 && riskPct <= 1;
    return {
      mat, winRate, avgR, riskPct, realMoneyGate, next,
      agents: [
        { name: 'Kid Coach', kind: 'ai-good', text: 'Use tiny steps: watch, plan, practice, write the lesson, repeat.' },
        { name: 'Risk Guardian', kind: riskPct <= 1 ? 'ai-good' : 'ai-danger', text: riskPct <= 1 ? 'Risk is small enough for practice mode.' : 'Risk is too high for a learner. Set it to 1% or less.' },
        { name: 'Planner Agent', kind: 'ai-action', text: next[0] },
        { name: 'Project Brain', kind: m.journal.length ? 'ai-good' : 'ai-warn', text: m.journal.length ? `Memory has ${m.journal.length} journal notes.` : 'Memory is empty. Start journaling every practice action.' },
        { name: 'Compliance Guard', kind: 'ai-warn', text: realMoneyGate ? 'Paper evidence is improving, but real money still requires adult approval and legal/broker rules.' : 'Real money remains locked. Keep proving skill in paper mode.' }
      ]
    };
  }

  function createPlan() {
    const c = council();
    const symbol = memory().watchlist[0] || 'BTC';
    const plan = {
      time: new Date().toLocaleString(),
      title: c.realMoneyGate ? 'Adult review readiness checkpoint' : 'Next safe AI practice step',
      symbol,
      maturity: c.mat,
      instruction: c.next[0],
      childStep: `Do this first: ${c.next[0]}`,
      adultGate: c.realMoneyGate ? 'Show the full paper record to a grown-up before any real-money decision.' : 'Real money stays locked. Practice only.',
      status: 'Proposed'
    };
    set('ai_plans', [...get('ai_plans'), plan].slice(-50));
    render();
  }

  function approveLatest() {
    const plans = get('ai_plans');
    const latest = plans[plans.length - 1];
    if (!latest) return;
    latest.status = 'Approved for paper practice';
    latest.approvedAt = new Date().toLocaleString();
    set('ai_plans', plans);
    const journal = get('journal');
    set('journal', [...journal, { title: `AI Brain plan: ${latest.symbol}`, text: `${latest.instruction} ${latest.adultGate}`, date: latest.approvedAt }]);
    render();
  }

  function render() {
    const box = document.getElementById('aiBrainOutput');
    if (!box) return;
    const c = council();
    const plans = get('ai_plans');
    document.getElementById('aiMaturity').textContent = `${c.mat}%`;
    document.getElementById('aiGate').textContent = c.realMoneyGate ? 'Adult review only' : 'Real money locked';
    box.innerHTML = `<div class="ai-board">${c.agents.map((a) => `<div class="ai-agent ${a.kind}"><strong>${esc(a.name)}</strong><p>${esc(a.text)}</p></div>`).join('')}</div>`;
    const planBox = document.getElementById('aiPlans');
    planBox.innerHTML = plans.slice().reverse().slice(0, 6).map((p) => `<div class="ai-agent ai-action"><strong>${esc(p.title)} • ${esc(p.symbol)}</strong><p>${esc(p.childStep)}</p><p>${esc(p.adultGate)}</p><span class="ai-status">${esc(p.status)}</span><small> ${esc(p.time)}</small></div>`).join('') || '<p class="muted">No AI plans yet. Press Generate AI Next Step.</p>';
  }

  function shell() {
    if (document.getElementById('aiBrain')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'aiBrain';
    section.className = 'grid two';
    section.innerHTML = `
      <article class="panel smart-panel">
        <div class="section-head"><div><span class="label">Cross-Repo AI Brain</span><h3>Agent council from our AI repos</h3></div><strong id="aiMaturity">0%</strong></div>
        <p class="muted">This imports the project patterns from SingularityOS, ProjectBrain, AetherForge, and IncomeOS: memory, safe autopilot, no-loss upgrades, beginner coaching, compliance guardrails, and visible approval gates.</p>
        <div><span class="ai-chip">Project Brain memory</span><span class="ai-chip">Safe Autopilot</span><span class="ai-chip">Kid Coach</span><span class="ai-chip">Compliance Guard</span><span class="ai-chip">No hidden trades</span></div>
        <div id="aiBrainOutput" class="result-box stacked"></div>
        <div class="evo-actions"><button id="aiThink" type="button">Generate AI Next Step</button><button id="aiApprove" class="ai-approve" type="button">Approve for paper practice</button><button id="aiStart" type="button">Start AI Coach Loop</button><button id="aiStop" class="ai-stop" type="button">Stop AI Loop</button></div>
      </article>
      <article class="panel">
        <div class="section-head"><div><span class="label">AI Plans</span><h3>Visible proposed actions</h3></div><span id="aiGate" class="ai-status">Real money locked</span></div>
        <div id="aiPlans" class="list"></div>
      </article>`;
    safety.parentNode.insertBefore(section, safety);
    document.getElementById('aiThink').addEventListener('click', createPlan);
    document.getElementById('aiApprove').addEventListener('click', approveLatest);
    document.getElementById('aiStart').addEventListener('click', () => { if (loop) clearInterval(loop); createPlan(); loop = setInterval(createPlan, 45000); });
    document.getElementById('aiStop').addEventListener('click', () => { if (loop) clearInterval(loop); loop = null; });
  }

  shell();
  render();
})();
