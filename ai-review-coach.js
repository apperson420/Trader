(() => {
  const persist = window.TraderPersistence;
  const KEY = 'ai_review_coach_notes';
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
  const n = (id, fallback = 0) => {
    const value = Number(v(id, fallback));
    return Number.isFinite(value) ? value : Number(fallback || 0);
  };

  function buildReview() {
    const symbol = String(v('tradeSymbol', read('watchlist', [])[0] || 'AAPL')).trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '').slice(0, 12) || 'AAPL';
    const direction = v('tradeDirection', 'Long');
    const entry = n('tradeEntry', 0);
    const target = n('tradeTarget', 0);
    const stop = n('tradeStop', 0);
    const account = n('accountSize', 0);
    const riskPct = n('riskPercent', 1);
    const checks = read('checks', []);
    const journal = read('journal', []);
    const perUnit = Math.abs(entry - stop);
    const maxRisk = account * (riskPct / 100);
    const qty = perUnit > 0 ? Math.max(1, Math.floor(maxRisk / perUnit)) : 1;
    const reward = Math.abs(target - entry);
    const rr = perUnit > 0 ? reward / perUnit : 0;
    const cautions = [];
    if (!entry || !target || !stop) cautions.push('Entry, target, and stop should all be filled before trusting the plan.');
    if (riskPct > 1) cautions.push('Risk is above a conservative 1% setting.');
    if (rr < 2) cautions.push('Reward/risk is below a strong 2R planning threshold.');
    if (checks.length < 4) cautions.push('The readiness checklist is not complete.');
    if (journal.length < 3) cautions.push('Journal history is still thin; more paper examples would improve feedback quality.');
    const text = [
      `Review target: ${symbol} ${direction}`,
      `Suggested review quantity from the visible risk calculator: ${qty}`,
      `Estimated reward/risk from visible fields: ${rr.toFixed(2)}R`,
      `Checklist completed: ${checks.length}/6`,
      `Journal examples available: ${journal.length}`,
      '',
      'Coach guidance:',
      cautions.length ? cautions.map((x) => `- ${x}`).join('\n') : '- No major blocker found in the visible fields, but that does not make the idea safe or profitable.',
      '',
      'This is a coaching note only. It does not choose for you, does not take action, and is not investment advice.'
    ].join('\n');
    return { symbol, direction, qty, rr, checks: checks.length, journal: journal.length, cautions, text, time: new Date().toLocaleString() };
  }

  function createNote() {
    const note = buildReview();
    write(KEY, [...read(KEY, []), note].slice(-50));
    const box = document.getElementById('aiReviewCoachOutput');
    if (box) box.innerHTML = `<div class="ai-review-note"><strong>Coach review created</strong><pre>${esc(note.text)}</pre></div>`;
    renderHistory();
  }

  function saveToJournal() {
    const note = buildReview();
    write('journal', [...read('journal', []), { title: `AI coach review: ${note.symbol}`, text: note.text, date: note.time }]);
    write(KEY, [...read(KEY, []), note].slice(-50));
    const box = document.getElementById('aiReviewCoachOutput');
    if (box) box.innerHTML = '<div class="ai-review-note"><strong>Saved to journal.</strong><p>The note was saved as coaching evidence only.</p></div>';
    renderHistory();
  }

  function renderHistory() {
    const box = document.getElementById('aiReviewCoachHistory');
    if (!box) return;
    const rows = read(KEY, []);
    box.innerHTML = rows.length ? rows.slice().reverse().slice(0, 6).map((row) => `<div class="ai-review-card"><strong>${esc(row.symbol)} ${esc(row.direction)}</strong><p>${esc(row.time)} • ${Number(row.rr || 0).toFixed(2)}R • checklist ${esc(row.checks)}/6</p><small>${esc((row.cautions || []).slice(0, 2).join(' ') || 'No major coach caution saved.')}</small></div>`).join('') : '<p class="muted">No AI coach reviews yet.</p>';
  }

  function shell() {
    if (document.getElementById('aiReviewCoach')) return;
    const mode = document.getElementById('modeControlCenter');
    const workflow = document.getElementById('guidedWorkflow');
    const section = document.createElement('section');
    section.id = 'aiReviewCoach';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">AI Review Coach</span><h3>Guidance before any serious decision</h3></div><strong>Coach only</strong></div>
      <p class="muted">This coach reads visible plan fields, checklist progress, and journal history to create a review note. It does not take action, does not guarantee profit, and does not replace your judgment.</p>
      <div class="ai-review-actions"><button id="aiReviewCreate" type="button">Create coach review</button><button id="aiReviewJournal" class="ai-review-secondary" type="button">Save review to journal</button></div>
      <div id="aiReviewCoachOutput" class="list"></div>
      <div id="aiReviewCoachHistory" class="list"></div>`;
    if (mode?.parentNode) mode.parentNode.insertBefore(section, mode.nextSibling);
    else if (workflow?.parentNode) workflow.parentNode.insertBefore(section, workflow.nextSibling);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.ai-review-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.ai-review-actions button{width:auto}.ai-review-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.ai-review-note,.ai-review-card{border:1px solid rgba(255,255,255,.14);border-left:4px solid #4cc9f0;border-radius:14px;padding:12px;background:rgba(255,255,255,.05);color:#d7e2f0;margin:10px 0}.ai-review-note pre{white-space:pre-wrap;overflow:auto;color:#d7e2f0}.ai-review-card strong{color:#edf6ff}.ai-review-card p{margin:6px 0}@media(max-width:860px){.ai-review-actions button{width:100%}}`;
    document.head.appendChild(style);
    document.getElementById('aiReviewCreate').addEventListener('click', createNote);
    document.getElementById('aiReviewJournal').addEventListener('click', saveToJournal);
    renderHistory();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
