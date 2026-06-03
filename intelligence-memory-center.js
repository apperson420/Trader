(() => {
  const persist = window.TraderPersistence;
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };
  const sources = [
    ['AI coach reviews', 'ai_review_coach_notes'],
    ['AI live assist drafts', 'ai_live_assist_drafts'],
    ['Human decisions', 'decision_approval_log'],
    ['Journal notes', 'journal'],
    ['Checklist state', 'checks'],
    ['Strategy playbooks', 'playbooks'],
    ['Validation report', 'validation_report'],
    ['Evolution report', 'real_strategy_evolution'],
    ['Live safety logs', 'live_broker_logs'],
    ['Paper broker logs', 'broker_logs']
  ];
  function countFor(name) {
    const value = read(name, Array.isArray(name) ? [] : null);
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length ? 1 : 0;
    return value == null ? 0 : 1;
  }
  function snapshot() {
    const data = {};
    sources.forEach(([, key]) => { data[key] = read(key, Array.isArray(read(key, [])) ? [] : null); });
    const decisions = read('decision_approval_log', []);
    const reviews = read('ai_review_coach_notes', []);
    return {
      exportedAt: new Date().toISOString(),
      app: 'Trader Command Center',
      mode: 'intelligence_memory_receipt',
      safety: 'Software intelligence memory for coaching, review, and accountability only. It does not execute account actions.',
      counts: Object.fromEntries(sources.map(([label, key]) => [label, countFor(key)])),
      pendingDecisionReviews: decisions.filter((row) => row.status === 'pending_review').length,
      rejectedDecisions: decisions.filter((row) => row.status === 'rejected').length,
      reviewedDecisions: decisions.filter((row) => row.status === 'approved_for_manual_review').length,
      latestCoachReview: reviews[reviews.length - 1] || null,
      data
    };
  }
  function render() {
    const grid = document.getElementById('intelligenceMemoryGrid');
    const score = document.getElementById('intelligenceMemoryScore');
    if (!grid || !score) return;
    const snap = snapshot();
    const total = Object.values(snap.counts).reduce((sum, n) => sum + Number(n || 0), 0);
    score.textContent = `${total} records`;
    grid.innerHTML = sources.map(([label, key]) => `<article class="intel-memory-card"><strong>${esc(label)}</strong><p>${esc(countFor(key))} saved</p></article>`).join('');
    const notes = document.getElementById('intelligenceMemoryNotes');
    if (notes) notes.innerHTML = `<div class="intel-memory-note"><strong>Decision state</strong><p>${snap.pendingDecisionReviews} pending • ${snap.reviewedDecisions} reviewed • ${snap.rejectedDecisions} rejected</p></div>`;
  }
  function exportMemory() {
    const snap = snapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-intelligence-memory-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    render();
  }
  function summarizeToJournal() {
    const snap = snapshot();
    const text = `Intelligence memory summary: ${snap.pendingDecisionReviews} pending decision reviews, ${snap.reviewedDecisions} reviewed decisions, ${snap.rejectedDecisions} rejected decisions, ${snap.counts['AI coach reviews']} AI coach reviews, ${snap.counts['AI live assist drafts']} AI live assist drafts, ${snap.counts['Journal notes']} journal notes. This is a coaching/accountability summary only, not investment advice.`;
    write('journal', [...read('journal', []), { title: 'Intelligence memory summary', text, date: new Date().toLocaleString() }]);
    render();
  }
  function shell() {
    if (document.getElementById('intelligenceMemoryCenter')) return;
    const decision = document.getElementById('decisionApprovalCenter');
    const support = document.getElementById('supportRepairCenter');
    const section = document.createElement('section');
    section.id = 'intelligenceMemoryCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Intelligence Memory</span><h3>Coaching and decision evidence</h3></div><strong id="intelligenceMemoryScore">0 records</strong></div>
      <p class="muted">This keeps the AI coaching layer honest by making its review notes, decision approvals, journal evidence, validation results, and safety logs visible and exportable.</p>
      <div class="intel-memory-actions"><button id="intelligenceMemoryRefresh" type="button">Refresh memory view</button><button id="intelligenceMemoryExport" class="intel-memory-secondary" type="button">Export intelligence memory</button><button id="intelligenceMemoryJournal" class="intel-memory-secondary" type="button">Summarize to journal</button></div>
      <div id="intelligenceMemoryGrid" class="intel-memory-grid"></div>
      <div id="intelligenceMemoryNotes" class="list"></div>`;
    if (decision?.parentNode) decision.parentNode.insertBefore(section, decision.nextSibling);
    else if (support?.parentNode) support.parentNode.insertBefore(section, support.nextSibling);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.intel-memory-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.intel-memory-actions button{width:auto}.intel-memory-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.intel-memory-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.intel-memory-card,.intel-memory-note{border:1px solid rgba(255,255,255,.14);border-left:4px solid #4cc9f0;border-radius:14px;padding:12px;background:rgba(255,255,255,.05);color:#d7e2f0}.intel-memory-card strong,.intel-memory-note strong{color:#edf6ff}.intel-memory-card p,.intel-memory-note p{margin:6px 0 0}@media(max-width:860px){.intel-memory-actions button{width:100%}.intel-memory-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('intelligenceMemoryRefresh').addEventListener('click', render);
    document.getElementById('intelligenceMemoryExport').addEventListener('click', exportMemory);
    document.getElementById('intelligenceMemoryJournal').addEventListener('click', summarizeToJournal);
    document.addEventListener('trader:persistence-restored', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
