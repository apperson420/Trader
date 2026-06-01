(() => {
  const read = (name, fallback = []) => {
    try { return JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  const write = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const $ = (id) => document.getElementById(id);

  const style = document.createElement('style');
  style.textContent = `
    html{scroll-padding-top:22px}body{padding-top:18px}.topbar{position:relative;z-index:2}.topbar h1{font-size:clamp(28px,4vw,54px);line-height:1;margin:0}.hero h2{font-size:clamp(32px,4.1vw,56px)!important;line-height:1.02!important}.hero{align-items:stretch}.panel,.card,.hero-card{backdrop-filter:blur(10px)}
    .chat-box,.kid-coach{max-height:min(62vh,620px)!important;width:min(360px,calc(100% - 28px))!important}.chat-log{max-height:330px!important}.kid-coach{right:14px!important;bottom:14px!important}.chat-box{left:14px!important;bottom:68px!important}.chat-fab{left:14px!important;bottom:14px!important}.coach-safe-hidden{display:none!important}.pro-command{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:9996;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;background:rgba(8,17,31,.9);border:1px solid rgba(167,243,208,.35);box-shadow:0 18px 60px rgba(0,0,0,.4);border-radius:999px;padding:8px}.pro-command button{width:auto;border-radius:999px;padding:10px 13px;font-size:13px}.pro-toast{position:fixed;top:12px;right:12px;z-index:9999;max-width:360px;border:1px solid rgba(167,243,208,.35);background:#10223d;border-radius:18px;padding:12px;color:#edf6ff;box-shadow:0 18px 60px rgba(0,0,0,.35)}.pro-score-note{display:block;margin-top:4px;color:#fbbf24;font-size:12px;line-height:1.35}.pro-mode-card{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.055);border-radius:18px;padding:14px}.pro-mode-card strong{color:#4cc9f0}.pro-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.pro-grid span{border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px;background:rgba(0,0,0,.15);color:#c7d4e5}@media(max-width:860px){body{padding-top:8px}.hero h2{font-size:32px!important}.pro-grid{grid-template-columns:1fr}.pro-command{left:8px;right:8px;transform:none;border-radius:18px}.chat-box,.kid-coach{left:8px!important;right:8px!important;width:auto!important;max-height:58vh!important}}
  `;
  document.head.appendChild(style);

  function safeScore() {
    const watchlist = read('watchlist');
    const checks = read('checks');
    const outcomes = read('outcomes');
    const journal = read('journal');
    const entry = Number($('tradeEntry')?.value || 100);
    const target = Number($('tradeTarget')?.value || 110);
    const stop = Number($('tradeStop')?.value || 95);
    const riskPct = Number($('riskPercent')?.value || 1);
    const rr = Math.abs(target - entry) / Math.max(0.01, Math.abs(entry - stop));
    let score = 20;
    score += Math.min(15, watchlist.length * 5);
    score += Math.min(20, checks.length * 3.4);
    score += Math.min(15, journal.length * 3);
    score += Math.min(20, outcomes.length * 4);
    if (rr >= 2) score += 12; else if (rr >= 1) score += 5;
    if (riskPct > 0 && riskPct <= 1) score += 8; else if (riskPct > 1) score -= 12;
    if (!watchlist.length) score = Math.min(score, 45);
    if (checks.length < 6) score = Math.min(score, 72);
    if (outcomes.length < 10) score = Math.min(score, 82);
    if (outcomes.length < 3) score = Math.min(score, 76);
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function applyScoreGovernor() {
    const scoreEl = $('smartScore');
    if (!scoreEl) return;
    const score = safeScore();
    scoreEl.textContent = `${score}%`;
    const card = scoreEl.closest('.card');
    if (card && !card.querySelector('.pro-score-note')) {
      const note = document.createElement('small');
      note.className = 'pro-score-note';
      note.textContent = 'Governed score: capped until watchlist, checklist, journal, and paper outcomes prove readiness.';
      card.appendChild(note);
    }
  }

  function addProCommand() {
    if (document.getElementById('proCommand')) return;
    const bar = document.createElement('div');
    bar.id = 'proCommand';
    bar.className = 'pro-command';
    bar.innerHTML = `<button id="proOpenCoach" type="button">Coach</button><button id="proOpenChat" type="button">AI Chat</button><button id="proFocus" type="button">Focus Mode</button><button id="proResetOverlays" type="button">Clean Screen</button><button id="proNext" type="button">Next Best Step</button>`;
    document.body.appendChild(bar);
    $('proOpenCoach').onclick = () => { const c = $('kidCoach'); const b = $('kidCoachBubble'); if (b) b.style.display = 'none'; if (c) c.style.display = 'block'; };
    $('proOpenChat').onclick = () => { const c = $('chatBox'); const b = $('chatFab'); if (b) b.style.display = 'none'; if (c) { c.style.display = 'grid'; c.classList.remove('coach-safe-hidden'); } };
    $('proResetOverlays').onclick = cleanScreen;
    $('proFocus').onclick = () => document.body.classList.toggle('focus-mode');
    $('proNext').onclick = nextBestStep;
  }

  function cleanScreen() {
    ['kidCoach','chatBox'].forEach((id) => { const el = $(id); if (el) el.style.display = 'none'; });
    ['kidCoachBubble','chatFab'].forEach((id) => { const el = $(id); if (el) el.style.display = 'inline-flex'; });
    const stop = $('chatStop'); if (stop) stop.click();
    toast('Screen cleaned. Coaching and chat are still available from the bottom command bar.');
  }

  function nextBestStep() {
    const watchlist = read('watchlist');
    const checks = read('checks');
    const outcomes = read('outcomes');
    let msg = 'Add one study symbol to the Watchlist, then press Market Intelligence.';
    if (watchlist.length && checks.length < 6) msg = 'Finish the 6 readiness guardrails before trusting a paper plan.';
    else if (watchlist.length && checks.length >= 6 && outcomes.length < 10) msg = `Record paper outcomes in Evolution Engine. You have ${outcomes.length}/10 starter evidence points.`;
    else if (outcomes.length >= 10) msg = 'Run Scenario Lab and Paper Broker only in paper mode. Compare expectancy before increasing confidence.';
    toast(msg);
  }

  function toast(message) {
    const old = document.querySelector('.pro-toast');
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = 'pro-toast';
    box.textContent = message;
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 5500);
  }

  function addExecutivePanel() {
    if (document.getElementById('proExecutivePanel')) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;
    const panel = document.createElement('section');
    panel.id = 'proExecutivePanel';
    panel.className = 'panel';
    panel.innerHTML = `<span class="label">Production command layer</span><h3>Clean-screen controls active</h3><p class="muted">The interface prioritizes clean-screen use, evidence-capped scores, visible next steps, paper-only execution, and beginner coaching without blocking the dashboard.</p><div class="pro-grid"><span>UX governor active</span><span>Smart score capped by evidence</span><span>Coach/chat minimized by default</span><span>Autonomy remains paper-only</span></div>`;
    hero.parentNode.insertBefore(panel, hero.nextSibling);
  }

  function tameOverlays() {
    setTimeout(() => {
      const c = $('kidCoach'); if (c) c.style.display = 'none';
      const chat = $('chatBox'); if (chat) chat.style.display = 'none';
      const fab = $('chatFab'); if (fab) fab.style.display = 'inline-flex';
      let bubble = $('kidCoachBubble');
      if (!bubble) {
        bubble = document.createElement('button');
        bubble.id = 'kidCoachBubble';
        bubble.textContent = 'Open Coach';
        bubble.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9995;width:auto;border-radius:999px;padding:12px 16px';
        document.body.appendChild(bubble);
      }
      bubble.style.display = 'inline-flex';
      bubble.onclick = () => { const coach = $('kidCoach'); if (coach) coach.style.display = 'block'; bubble.style.display = 'none'; };
    }, 900);
  }

  function boot() {
    addExecutivePanel();
    addProCommand();
    tameOverlays();
    applyScoreGovernor();
    setInterval(applyScoreGovernor, 1500);
    setTimeout(() => toast('Professional UX fix applied: clean screen, safer score, and bottom command bar are active.'), 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
