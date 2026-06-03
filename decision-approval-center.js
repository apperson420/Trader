(() => {
  const persist = window.TraderPersistence;
  const KEY = 'decision_approval_log';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };
  const v = (id, fallback = '') => document.getElementById(id)?.value || fallback;
  const num = (id, fallback = 0) => {
    const value = Number(v(id, fallback));
    return Number.isFinite(value) ? value : Number(fallback || 0);
  };

  function currentDraft() {
    const symbol = String(v('tradeSymbol', read('watchlist', [])[0] || 'AAPL')).trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 12) || 'AAPL';
    const direction = v('tradeDirection', 'Long');
    const entry = num('tradeEntry', 0);
    const stop = num('tradeStop', 0);
    const target = num('tradeTarget', 0);
    const account = num('accountSize', 0);
    const riskPct = num('riskPercent', 1);
    const checks = read('checks', []);
    const perUnitRisk = Math.abs(entry - stop);
    const reward = Math.abs(target - entry);
    const rr = perUnitRisk > 0 ? reward / perUnitRisk : 0;
    const riskDollars = account * (riskPct / 100);
    const blockers = [];
    if (!entry || !stop || !target) blockers.push('Missing entry, stop, or target.');
    if (riskPct > 1) blockers.push('Risk setting is above the conservative 1% line.');
    if (rr < 2) blockers.push('Reward/risk is below the 2R review target.');
    if (checks.length < 4) blockers.push('Checklist is not complete enough for serious review.');
    return { id: `decision-${Date.now()}`, time: new Date().toLocaleString(), symbol, direction, entry, stop, target, riskPct, riskDollars, rr, checklist: checks.length, blockers, status: 'pending_review' };
  }

  function addDecision() {
    const draft = currentDraft();
    write(KEY, [...read(KEY, []), draft].slice(-80));
    render();
  }

  function addFromAiLiveDraft() {
    const liveDraft = read('ai_live_assist_drafts', []).slice(-1)[0];
    if (!liveDraft) return;
    const draft = {
      id: `decision-ai-live-${Date.now()}`,
      time: new Date().toLocaleString(),
      symbol: liveDraft.symbol,
      direction: liveDraft.side === 'sell' ? 'Short' : 'Long',
      entry: liveDraft.limitPrice,
      stop: null,
      target: null,
      riskPct: null,
      riskDollars: null,
      rr: liveDraft.rewardRisk,
      checklist: liveDraft.checklistCount,
      blockers: [...(liveDraft.warnings || []), ...(liveDraft.missingEvidence || [])],
      status: 'pending_review',
      source: 'ai_live_assist_draft',
      note: 'Created from AI Live Assist draft as pending review only. This does not approve or submit anything.'
    };
    write(KEY, [...read(KEY, []), draft].slice(-80));
    render();
  }

  function updateDecision(id, status) {
    const rows = read(KEY, []);
    const next = rows.map((row) => row.id === id ? { ...row, status, reviewedAt: new Date().toLocaleString() } : row);
    write(KEY, next);
    render();
  }

  function exportLog() {
    const payload = { exportedAt: new Date().toISOString(), app: 'Trader Command Center', mode: 'human_decision_approval_log', safety: 'This log records human review status only. It does not execute account actions.', rows: read(KEY, []) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-decision-approval-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function render() {
    const box = document.getElementById('decisionApprovalList');
    const score = document.getElementById('decisionApprovalScore');
    if (!box || !score) return;
    const rows = read(KEY, []);
    const pending = rows.filter((row) => row.status === 'pending_review').length;
    score.textContent = `${pending} pending`;
    box.innerHTML = rows.length ? rows.slice().reverse().slice(0, 12).map((row) => `
      <article class="decision-card ${row.status === 'approved_for_manual_review' ? 'decision-ok' : row.status === 'rejected' ? 'decision-bad' : ''}">
        <strong>${esc(row.symbol)} ${esc(row.direction)} • ${Number(row.rr || 0).toFixed(2)}R</strong>
        <p>Risk setting: ${Number(row.riskPct || 0).toFixed(2)}% • Checklist: ${esc(row.checklist)}/6 • Status: ${esc(row.status)}</p>
        <small>${esc(row.blockers && row.blockers.length ? row.blockers.join(' ') : 'No major blockers recorded by the visible field review.')}</small>
        <div class="decision-actions">
          <button data-approve="${esc(row.id)}" type="button">Mark reviewed</button>
          <button data-reject="${esc(row.id)}" class="decision-secondary" type="button">Reject</button>
        </div>
      </article>`).join('') : '<p class="muted">No decision reviews yet.</p>';
    box.querySelectorAll('[data-approve]').forEach((button) => button.addEventListener('click', () => updateDecision(button.dataset.approve, 'approved_for_manual_review')));
    box.querySelectorAll('[data-reject]').forEach((button) => button.addEventListener('click', () => updateDecision(button.dataset.reject, 'rejected')));
  }

  function shell() {
    if (document.getElementById('decisionApprovalCenter')) return;
    const coach = document.getElementById('aiReviewCoach');
    const mode = document.getElementById('modeControlCenter');
    const section = document.createElement('section');
    section.id = 'decisionApprovalCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Decision Approval</span><h3>Human review queue</h3></div><strong id="decisionApprovalScore">0 pending</strong></div>
      <p class="muted">Use this as the bridge between software guidance and human judgment. It records review decisions only; it does not execute account actions or bypass any safety gate.</p>
      <div class="decision-actions"><button id="decisionCreate" type="button">Create review item from current plan</button><button id="decisionCreateFromAiLive" class="decision-secondary" type="button">Create pending review from AI live draft</button><button id="decisionExport" class="decision-secondary" type="button">Export decision log</button></div>
      <div id="decisionApprovalList" class="list"></div>`;
    if (coach?.parentNode) coach.parentNode.insertBefore(section, coach.nextSibling);
    else if (mode?.parentNode) mode.parentNode.insertBefore(section, mode.nextSibling);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.decision-actions{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.decision-actions button{width:auto}.decision-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.decision-card{border:1px solid rgba(255,255,255,.14);border-left:4px solid #fbbf24;border-radius:14px;padding:12px;background:rgba(255,255,255,.05);color:#d7e2f0;margin:10px 0}.decision-card strong{color:#edf6ff}.decision-card p{margin:6px 0}.decision-ok{border-left-color:#a7f3d0}.decision-bad{border-left-color:#f87171}@media(max-width:860px){.decision-actions button{width:100%}}`;
    document.head.appendChild(style);
    document.getElementById('decisionCreate').addEventListener('click', addDecision);
    document.getElementById('decisionCreateFromAiLive').addEventListener('click', addFromAiLiveDraft);
    document.getElementById('decisionExport').addEventListener('click', exportLog);
    document.addEventListener('trader:persistence-restored', render);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
