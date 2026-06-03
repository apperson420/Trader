(() => {
  const persist = window.TraderPersistence;
  const KEY = 'ai_live_assist_drafts';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const money = (value) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
  const read = (name, fallback = []) => {
    if (persist) return persist.read(name, fallback);
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => {
    if (persist) persist.write(name, value);
    else localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  };
  const field = (id, fallback = '') => document.getElementById(id)?.value || fallback;
  const num = (id, fallback = 0) => {
    const value = Number(field(id, fallback));
    return Number.isFinite(value) ? value : Number(fallback || 0);
  };

  function latest(name, fallback = null) {
    const value = read(name, fallback);
    return Array.isArray(value) ? value[value.length - 1] || null : value;
  }

  function visibleEvidence() {
    const symbol = String(field('tradeSymbol', read('watchlist', [])[0] || '')).trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
    const direction = field('tradeDirection', 'Long');
    const entry = num('tradeEntry', 0);
    const target = num('tradeTarget', 0);
    const stop = num('tradeStop', 0);
    const account = num('accountSize', 0);
    const riskPercent = num('riskPercent', 0);
    const checks = read('checks', []);
    const journal = read('journal', []);
    const approvals = read('decision_approval_log', []);
    const reviews = read('ai_review_coach_notes', []);
    const validation = latest('validation_report', null);
    const evolution = latest('real_strategy_evolution', null);
    const riskDollars = account * (riskPercent / 100);
    const riskPerUnit = Math.abs(entry - stop);
    const rewardPerUnit = Math.abs(target - entry);
    const rr = riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0;
    const qty = riskPerUnit > 0 ? Math.max(0, Math.floor((riskDollars / riskPerUnit) * 10000) / 10000) : 0;
    return { symbol, direction, entry, target, stop, account, riskPercent, checks, journal, approvals, reviews, validation, evolution, riskDollars, riskPerUnit, rewardPerUnit, rr, qty };
  }

  function buildDraft() {
    const e = visibleEvidence();
    const side = e.direction === 'Short' ? 'sell' : 'buy';
    const warnings = [];
    const missing = [];
    if (!e.symbol) missing.push('Add a symbol in the current plan first.');
    if (!e.entry || e.entry <= 0) missing.push('Add a positive entry price to use as the draft limit price.');
    if (!e.stop || e.stop <= 0) missing.push('Add a positive stop price so risk per unit can be estimated.');
    if (!e.target || e.target <= 0) missing.push('Add a positive target so reward/risk can be reviewed.');
    if (!e.account || e.account <= 0) missing.push('Add account size to the visible risk calculator.');
    if (!e.riskPercent || e.riskPercent <= 0) missing.push('Add a positive risk percent to the visible risk calculator.');
    if (e.checks.length < 4) warnings.push('Checklist is light. Complete more safety checks before any human review.');
    if (e.journal.length < 1) warnings.push('No journal history is available for context.');
    if (e.riskPercent > 1) warnings.push('Risk percent is above the conservative 1% review line.');
    if (e.rr > 0 && e.rr < 2) warnings.push('Reward/risk is below 2R, so the idea needs careful human review.');
    if (!e.validation) missing.push('No walk-forward validation report is saved.');
    if (!e.evolution) missing.push('No strategy evolution report is saved.');
    if (!e.reviews.length) missing.push('No AI Review Coach note is saved.');
    if (!e.approvals.length) missing.push('No decision approval record is saved.');
    if (!e.qty || e.qty <= 0) warnings.push('Suggested quantity is zero because visible risk inputs are incomplete or invalid.');
    return {
      id: `ai-live-draft-${Date.now()}`,
      createdAt: new Date().toLocaleString(),
      mode: 'draft only - human review required',
      symbol: e.symbol || 'NEEDS_SYMBOL',
      side,
      suggestedQuantity: e.qty,
      limitPrice: e.entry,
      estimatedNotional: e.qty * e.entry,
      estimatedRiskPerUnit: e.riskPerUnit,
      rewardRisk: e.rr,
      checklistCount: e.checks.length,
      checklistTotal: 6,
      journalCount: e.journal.length,
      decisionApprovalCount: e.approvals.length,
      aiReviewCount: e.reviews.length,
      hasValidationReport: Boolean(e.validation),
      hasEvolutionReport: Boolean(e.evolution),
      warnings,
      missingEvidence: missing,
      humanReviewRequired: true,
      safety: 'AI Live Assist can coach, score, review, and draft only. It cannot submit, approve, unlock, or bypass manual live ticket gates.'
    };
  }

  function saveDraft(draft) {
    const rows = read(KEY, []);
    write(KEY, [...rows, draft].slice(-80));
    document.dispatchEvent(new CustomEvent('trader:ai-live-draft-created', { detail: draft }));
  }

  function renderDraft(draft) {
    const box = document.getElementById('aiLiveAssistOutput');
    const history = read(KEY, []);
    if (!box) return;
    if (!draft && history.length) draft = history[history.length - 1];
    if (!draft) {
      box.innerHTML = '<p class="muted">No AI live assist draft yet.</p>';
      return;
    }
    const warnings = draft.warnings.length ? draft.warnings.map((item) => `<li>${esc(item)}</li>`).join('') : '<li>No major warning from visible fields, but human review is still required.</li>';
    const missing = draft.missingEvidence.length ? draft.missingEvidence.map((item) => `<li>${esc(item)}</li>`).join('') : '<li>No missing evidence detected by this draft.</li>';
    box.innerHTML = `
      <article class="ai-live-draft">
        <div class="section-head"><div><span class="label">Draft only</span><h4>${esc(draft.symbol)} ${esc(draft.side)} review draft</h4></div><strong>Human review required</strong></div>
        <div class="ai-live-grid">
          <span>Suggested quantity: <strong>${esc(draft.suggestedQuantity)}</strong></span>
          <span>Limit price from entry: <strong>${money(draft.limitPrice)}</strong></span>
          <span>Estimated notional: <strong>${money(draft.estimatedNotional)}</strong></span>
          <span>Risk per unit: <strong>${money(draft.estimatedRiskPerUnit)}</strong></span>
          <span>Reward/risk: <strong>${Number(draft.rewardRisk || 0).toFixed(2)}R</strong></span>
          <span>Checklist: <strong>${esc(draft.checklistCount)}/${esc(draft.checklistTotal)}</strong></span>
          <span>Journal notes: <strong>${esc(draft.journalCount)}</strong></span>
          <span>AI reviews: <strong>${esc(draft.aiReviewCount)}</strong></span>
        </div>
        <h4>Warnings and blockers</h4><ul>${warnings}</ul>
        <h4>Missing evidence</h4><ul>${missing}</ul>
        <p class="muted">This is not investment advice and does not guarantee profit. A human must review the broker account, risk, setup, allowlist, kill switch, max-notional cap, and manual ticket gates.</p>
      </article>`;
  }

  function createDraft() {
    const draft = buildDraft();
    saveDraft(draft);
    renderDraft(draft);
  }

  function copyToTicket() {
    const draft = read(KEY, []).slice(-1)[0];
    const out = document.getElementById('aiLiveAssistCopyStatus');
    if (!draft) {
      if (out) out.textContent = 'Create a draft first.';
      return;
    }
    const fields = [
      ['liveTicketSymbol', draft.symbol === 'NEEDS_SYMBOL' ? '' : draft.symbol],
      ['liveTicketSide', draft.side],
      ['liveTicketQty', draft.suggestedQuantity > 0 ? String(draft.suggestedQuantity) : ''],
      ['liveTicketLimit', draft.limitPrice > 0 ? String(draft.limitPrice) : '']
    ];
    fields.forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (out) out.textContent = 'Draft fields copied into the manual ticket only. Review boxes, confirmation, and submit stay untouched.';
  }

  function shell() {
    if (document.getElementById('aiLiveAssist')) return;
    const live = document.getElementById('liveTradingControl');
    const decision = document.getElementById('decisionApprovalCenter');
    const section = document.createElement('section');
    section.id = 'aiLiveAssist';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">AI Live Assist</span><h3>Draft-only live ticket review helper</h3></div><strong>Draft only</strong></div>
      <p class="muted">AI can coach, score, review, and draft from visible app evidence. AI cannot submit live trades, approve trades, check the human-review box, type the required live confirmation phrase, unlock owner access, bypass live setup, ignore the kill switch, skip the allowlist, skip account checks, exceed the max-notional cap, or bypass manual ticket gates.</p>
      <p class="muted">This is not investment advice and does not guarantee profit. Use it as a review note only.</p>
      <div class="ai-live-actions">
        <button id="aiLiveCreateDraft" type="button">Create AI-guided draft</button>
        <button id="aiLiveCopyTicket" class="ai-live-secondary" type="button">Copy draft fields into manual live ticket</button>
      </div>
      <p id="aiLiveAssistCopyStatus" class="muted">Copying can fill symbol, side, quantity, and limit only.</p>
      <div id="aiLiveAssistOutput" class="list"></div>`;
    if (live?.parentNode) live.parentNode.insertBefore(section, live.nextSibling);
    else if (decision?.parentNode) decision.parentNode.insertBefore(section, decision);
    else document.querySelector('.shell')?.appendChild(section);
    const style = document.createElement('style');
    style.textContent = `.ai-live-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.ai-live-actions button{width:auto}.ai-live-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.ai-live-draft{border:1px solid rgba(255,255,255,.14);border-left:4px solid #4cc9f0;border-radius:14px;padding:12px;background:rgba(255,255,255,.05);color:#d7e2f0}.ai-live-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ai-live-grid span{border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.14);padding:9px}@media(max-width:860px){.ai-live-actions button{width:100%}.ai-live-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
    document.getElementById('aiLiveCreateDraft').addEventListener('click', createDraft);
    document.getElementById('aiLiveCopyTicket').addEventListener('click', copyToTicket);
    document.addEventListener('trader:persistence-restored', () => renderDraft());
    renderDraft();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
