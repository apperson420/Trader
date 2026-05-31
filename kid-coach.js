(() => {
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const qs = (s) => document.querySelector(s);
  const lessons = [
    { title: 'Start here', target: '.hero', say: 'This app is practice first. We are learning how money choices work before anyone risks real money. A grown-up must help with anything real.' },
    { title: 'Watchlist', target: '#watchForm', say: 'Type one thing you want to study, like BTC or SPY, then press Add. This is like making a list of things to watch, not buying them.' },
    { title: 'Risk calculator', target: '#accountSize', say: 'Pretend this is your practice money. The risk percent says how much you could lose if the plan is wrong. Keep it tiny, usually 1% or less.' },
    { title: 'Entry price', target: '#entryPrice', say: 'Entry means the pretend price where the plan starts. Do not guess. Write down why that price matters.' },
    { title: 'Stop price', target: '#stopPrice', say: 'Stop means the pretend price where you admit the idea was wrong. Good traders protect money before thinking about winning.' },
    { title: 'Paper simulator', target: '#tradeForm', say: 'This lets you test an idea with pretend numbers. It never sends a real trade. Look for a reward that is bigger than the risk.' },
    { title: 'Smart Analyst', target: '.smart-panel', say: 'The coach checks if your plan is careful. A high score does not mean guaranteed money. It means the practice plan is cleaner.' },
    { title: 'Checklist', target: '.checklist-controls', say: 'Check every box before trusting a plan. If you cannot check a box honestly, slow down and fix the plan.' },
    { title: 'Journal', target: '#journalForm', say: 'Write what happened and what you learned. The goal is to become calmer and smarter each time.' },
    { title: 'Evolution Engine', target: '#evolutionLab', say: 'After practice trades, record what happened. The app learns your paper results and tells you what to improve.' },
    { title: 'Scenario Lab', target: '#scenarioLab', say: 'This tests if a strategy could work over many practice trades. It helps you see risk before real money is ever considered.' },
    { title: 'Money Mission', target: '#moneyMission', say: 'To try to make real money later, first prove skill with paper trading, show the journal to a grown-up, and never trade real money alone.' }
  ];
  let step = 0;

  const style = document.createElement('style');
  style.textContent = `
    .kid-coach{position:fixed;right:18px;bottom:18px;z-index:9999;width:min(390px,calc(100% - 36px));background:#10223d;border:2px solid rgba(167,243,208,.55);box-shadow:0 24px 80px rgba(0,0,0,.45);border-radius:24px;padding:16px;color:#edf6ff}.kid-coach h3{margin:0 0 6px;font-size:20px}.kid-coach p{margin:6px 0;color:#d7e2f0;line-height:1.45}.kid-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.kid-row button{width:auto}.kid-pill{display:inline-flex;border-radius:999px;background:rgba(167,243,208,.14);border:1px solid rgba(167,243,208,.35);padding:6px 10px;color:#a7f3d0;font-weight:900;font-size:12px}.kid-highlight{outline:4px solid #a7f3d0!important;outline-offset:6px;transition:outline .2s}.money-card{background:linear-gradient(180deg,#10223d,#0f1b30)}.money-steps{counter-reset:mission;display:grid;gap:10px;margin-top:12px}.money-steps li{list-style:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);border-radius:16px;padding:12px;color:#d7e2f0}.money-steps li:before{counter-increment:mission;content:counter(mission);display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#a7f3d0;color:#06101d;font-weight:900;margin-right:8px}.coach-tag{display:inline-flex;margin:4px 4px 0 0;border-radius:999px;border:1px solid rgba(255,255,255,.18);padding:6px 9px;color:#d7e2f0;background:rgba(255,255,255,.06);font-size:13px}@media(max-width:860px){.kid-coach{left:12px;right:12px;bottom:12px;width:auto}}@media print{.kid-coach{display:none!important}}`;
  document.head.appendChild(style);

  function addMoneyMission() {
    if (document.getElementById('moneyMission')) return;
    const safety = qs('.safety');
    if (!safety) return;
    const section = document.createElement('section');
    section.id = 'moneyMission';
    section.className = 'panel money-card';
    section.innerHTML = `
      <span class="label">7-year-old coach</span>
      <h3>Money Mission: the safe path from practice to real-world learning</h3>
      <p class="muted">The goal is to learn skills that can help with real money later. This app does not promise profits and does not place trades. A grown-up must be in charge of any real account or real money decision.</p>
      <ol class="money-steps">
        <li><strong>Learn the words.</strong> Watchlist means study list. Entry means plan start. Stop means protect money. Target means pretend goal.</li>
        <li><strong>Practice with paper trades.</strong> Use fake numbers until the journal shows careful choices, not guessing.</li>
        <li><strong>Protect money first.</strong> Risk should usually be 1% or less while learning. Losing small is part of staying safe.</li>
        <li><strong>Record every result.</strong> Save wins, losses, and lessons in the journal and Evolution Engine.</li>
        <li><strong>Prove consistency.</strong> Do not think about real money until paper results and discipline look good over many trades.</li>
        <li><strong>Ask a grown-up.</strong> Real money, broker accounts, taxes, and rules require an adult. Never trade real money alone.</li>
      </ol>
      <div><span class="coach-tag">Practice first</span><span class="coach-tag">Tiny risk</span><span class="coach-tag">Journal always</span><span class="coach-tag">Adult approval</span><span class="coach-tag">No guarantees</span></div>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function renderCoach() {
    let box = document.getElementById('kidCoach');
    if (!box) {
      box = document.createElement('aside');
      box.id = 'kidCoach';
      box.className = 'kid-coach';
      document.body.appendChild(box);
    }
    const lesson = lessons[step];
    box.innerHTML = `<span class="kid-pill">Coach for a 7-year-old</span><h3>${esc(lesson.title)}</h3><p>${esc(lesson.say)}</p><p><strong>Money rule:</strong> real money is only for a grown-up-approved plan after lots of practice.</p><div class="kid-row"><button id="kidPrev" type="button">Back</button><button id="kidShow" type="button">Show me</button><button id="kidNext" type="button">Next</button><button id="kidHide" class="ghost" type="button">Hide</button></div>`;
    document.getElementById('kidPrev').onclick = () => { step = (step - 1 + lessons.length) % lessons.length; clearHighlight(); renderCoach(); };
    document.getElementById('kidNext').onclick = () => { step = (step + 1) % lessons.length; clearHighlight(); renderCoach(); };
    document.getElementById('kidShow').onclick = () => showTarget(lesson.target);
    document.getElementById('kidHide').onclick = () => { clearHighlight(); box.style.display = 'none'; showBubble(); };
  }

  function clearHighlight() {
    document.querySelectorAll('.kid-highlight').forEach((el) => el.classList.remove('kid-highlight'));
  }

  function showTarget(selector) {
    clearHighlight();
    const el = qs(selector);
    if (!el) return;
    el.classList.add('kid-highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showBubble() {
    let bubble = document.getElementById('kidCoachBubble');
    if (!bubble) {
      bubble = document.createElement('button');
      bubble.id = 'kidCoachBubble';
      bubble.textContent = 'Open Coach';
      bubble.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9998;width:auto;border-radius:999px;padding:12px 16px';
      document.body.appendChild(bubble);
    }
    bubble.style.display = 'inline-flex';
    bubble.onclick = () => { bubble.style.display = 'none'; const box = document.getElementById('kidCoach'); if (box) box.style.display = 'block'; renderCoach(); };
  }

  addMoneyMission();
  renderCoach();
})();
