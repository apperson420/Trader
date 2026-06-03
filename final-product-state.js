(() => {
  const targets = {
    setup: '#setupStatusCenter',
    workflow: '#guidedWorkflow',
    review: '#aiReviewCoach',
    liveAssist: '#aiLiveAssist',
    decision: '#decisionApprovalCenter',
    memory: '#intelligenceMemoryCenter',
    vault: '#noLossDataVault',
    liveTicket: '#manualLiveOrderTicket',
    support: '#supportRepairCenter'
  };

  function scrollToTarget(selector, message) {
    const note = document.getElementById('finalProductMessage');
    const start = Date.now();
    const tryScroll = () => {
      const target = document.querySelector(selector);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (note && message) note.textContent = message;
        return;
      }
      if (Date.now() - start < 5000) setTimeout(tryScroll, 160);
      else if (note) note.textContent = 'That section is still loading. Wait a moment, then try again.';
    };
    tryScroll();
  }

  function list(items) {
    return items.map((item) => `<li>${item}</li>`).join('');
  }

  function shell() {
    if (document.getElementById('finalProductState')) return;
    const hero = document.querySelector('.hero');
    const section = document.createElement('section');
    section.id = 'finalProductState';
    section.className = 'panel smart-panel final-product-state';
    section.innerHTML = `
      <div class="section-head">
        <div><span class="label">Final Product State</span><h3>What is ready, optional, and locked</h3></div>
        <strong>Beginner-safe map</strong>
      </div>
      <p class="muted">Start here. Trader Command Center is a paper/research-first command center. It can coach, review, score, simulate, validate, draft, journal, and back up evidence. Live-money action stays locked behind human-approved manual gates.</p>
      <div class="final-product-actions">
        <button id="finalBeginnerStart" type="button">Beginner Safe Start</button>
        <button data-final-target="setup" type="button">Setup Status Center</button>
        <button data-final-target="workflow" type="button">Guided Workflow</button>
        <button data-final-target="review" type="button">AI Review Coach</button>
        <button data-final-target="liveAssist" type="button">AI Live Assist</button>
        <button data-final-target="decision" type="button">Decision Approval</button>
        <button data-final-target="memory" type="button">Intelligence Memory</button>
        <button data-final-target="vault" type="button">No-Loss Data Vault</button>
        <button data-final-target="liveTicket" type="button">Manual Live Order Ticket</button>
        <button data-final-target="support" type="button">Support / Repair</button>
      </div>
      <p id="finalProductMessage" class="final-product-message">Ready. Use Beginner Safe Start first.</p>
      <div class="final-product-grid">
        <article>
          <h4>A. Ready now</h4>
          <ul>${list(['Watchlist','Risk calculator','Smart Analyst','Journal','Guided Workflow','AI Review Coach','AI Live Assist draft-only mode','Decision Approval Center','Intelligence Memory Center','No-Loss Data Vault','Setup Status Center','Support / Repair Center','Release Readiness Center'])}</ul>
        </article>
        <article>
          <h4>B. Optional setup</h4>
          <ul>${list(['Owner Access','Supabase cloud backup','Alpaca paper trading','Alpaca live readiness','OpenAI / AI chat if configured server-side','Market data provider if configured server-side'])}</ul>
        </article>
        <article>
          <h4>C. Locked / intentionally blocked</h4>
          <ul>${list(['unattended autonomous live trading','AI live order submission','hidden broker actions','browser-stored broker secrets','profit guarantees','investment advice claims'])}</ul>
        </article>
        <article>
          <h4>D. Click order for a beginner</h4>
          <ol>${list(['Open Setup Status Center','Export No-Loss Data Vault','Use Guided Workflow','Add/watch symbols','Run Smart Analyst','Create AI Review Coach note','Create Decision Approval item','Use AI Live Assist draft only if live review is needed','Use Manual Live Ticket only after all live gates are configured and reviewed'])}</ol>
        </article>
      </div>
      <details class="final-product-unfinished" open>
        <summary>What is still not finished?</summary>
        <ul>${list(['Optional env vars are still required for cloud, paper, live, AI chat, and extra market-data features.','A fully sellable SaaS would still need real authentication, user accounts, per-user database rows, rate limits, billing if selling, terms/risk acceptance, and production monitoring.','Local npm is still missing on this Windows machine unless installed or added to PATH.','Live trading remains human-approved only.'])}</ul>
      </details>`;

    if (hero?.parentNode) hero.parentNode.insertBefore(section, hero.nextSibling);
    else document.querySelector('.shell')?.prepend(section);

    const style = document.createElement('style');
    style.textContent = `.final-product-state{border-left:4px solid #a7f3d0}.final-product-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.final-product-actions button{width:auto;border-radius:12px}.final-product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.final-product-grid article,.final-product-unfinished,.final-product-message{border:1px solid rgba(255,255,255,.14);border-radius:14px;background:rgba(255,255,255,.05);padding:12px;color:#d7e2f0}.final-product-grid h4{margin:0 0 8px;color:#edf6ff}.final-product-grid ul,.final-product-grid ol,.final-product-unfinished ul{margin:0;padding-left:20px;line-height:1.55}.final-product-message{border-left:4px solid #4cc9f0;margin:10px 0}.final-product-unfinished{margin-top:12px;border-left:4px solid #fbbf24}.final-product-unfinished summary{cursor:pointer;font-weight:900;color:#edf6ff}@media(max-width:860px){.final-product-actions button{width:100%}.final-product-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);

    document.getElementById('finalBeginnerStart').addEventListener('click', () => {
      scrollToTarget(targets.setup, 'Start here. Run setup status first. Then export a no-loss vault before changing anything.');
    });
    section.querySelectorAll('[data-final-target]').forEach((button) => {
      button.addEventListener('click', () => scrollToTarget(targets[button.dataset.finalTarget], `Opened ${button.textContent}.`));
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
