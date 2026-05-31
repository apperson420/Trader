(() => {
  const get = (name, fallback = []) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let learningLoop = null;

  const style = document.createElement('style');
  style.textContent = `.chat-fab{position:fixed;left:18px;bottom:18px;z-index:9997;width:auto;border-radius:999px;padding:13px 16px}.chat-box{position:fixed;left:18px;bottom:76px;z-index:9997;width:min(430px,calc(100% - 36px));max-height:74vh;display:grid;grid-template-rows:auto 1fr auto;background:#10223d;border:2px solid rgba(76,201,240,.45);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden}.chat-head{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.12);display:flex;justify-content:space-between;gap:10px;align-items:center}.chat-head strong{color:#a7f3d0}.chat-log{padding:14px;overflow:auto;display:grid;gap:10px}.chat-msg{border:1px solid rgba(255,255,255,.14);border-radius:16px;padding:11px;line-height:1.45}.chat-user{background:rgba(76,201,240,.12)}.chat-ai{background:rgba(167,243,208,.08)}.chat-ai strong{color:#a7f3d0}.chat-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.12)}.chat-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 12px 12px}.chat-actions button{width:auto}.self-loop{border-left:4px solid #a7f3d0;padding-left:12px}.self-warn{border-left-color:#fbbf24}.self-danger{border-left-color:#f87171}@media(max-width:860px){.chat-box{left:12px;right:12px;bottom:72px;width:auto}.chat-fab{left:12px;bottom:12px}}@media print{.chat-box,.chat-fab{display:none!important}}`;
  document.head.appendChild(style);

  function memory() {
    return {
      watchlist: get('watchlist'),
      journal: get('journal'),
      checks: get('checks'),
      outcomes: get('outcomes'),
      playbooks: get('playbooks'),
      autoLogs: get('auto_logs'),
      aiPlans: get('ai_plans'),
      marketLogs: get('market_logs'),
      chatLearning: get('chat_learning')
    };
  }

  function addMessage(role, text, meta = '') {
    const messages = get('chat_messages');
    set('chat_messages', [...messages, { role, text, meta, time: new Date().toLocaleString() }].slice(-80));
    renderMessages();
  }

  function renderMessages() {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const messages = get('chat_messages');
    log.innerHTML = messages.map((m) => `<div class="chat-msg ${m.role === 'user' ? 'chat-user' : 'chat-ai'}"><strong>${m.role === 'user' ? 'You' : 'AI Coach'}</strong><p>${esc(m.text)}</p>${m.meta ? `<small>${esc(m.meta)}</small>` : ''}</div>`).join('') || '<div class="chat-msg chat-ai"><strong>AI Coach</strong><p>Hi. I can explain every button, make safe paper-trading plans, and improve from your journal and paper outcomes. Ask: “What should I do next?”</p></div>';
    log.scrollTop = log.scrollHeight;
  }

  function localEvolution() {
    const m = memory();
    const lessons = [];
    if (!m.watchlist.length) lessons.push('The user needs watchlist symbols before the system can study anything.');
    if (m.checks.length < 6) lessons.push('The checklist is incomplete; coach the user to finish guardrails.');
    if (m.outcomes.length < 10) lessons.push('The system needs more paper outcomes before judging income readiness.');
    const avgR = m.outcomes.length ? m.outcomes.reduce((sum, x) => sum + Number(x.r || 0), 0) / m.outcomes.length : 0;
    if (m.outcomes.length >= 3 && avgR <= 0) lessons.push('Paper expectancy is not positive; recommend smaller risk and stricter playbook filters.');
    if (!m.playbooks.length) lessons.push('The user needs at least one simple playbook rule.');
    if (!lessons.length) lessons.push('The user is building evidence; recommend Scenario Lab and continued paper journaling.');
    set('chat_learning', [...m.chatLearning, { time: new Date().toLocaleString(), lessons }].slice(-50));
    return lessons;
  }

  async function askAI(message) {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, memory: memory() })
    });
    return response.json();
  }

  async function send(message) {
    const text = String(message || document.getElementById('chatInput').value || '').trim();
    if (!text) return;
    document.getElementById('chatInput').value = '';
    addMessage('user', text);
    addMessage('ai', 'Thinking through the safest next step...', 'temporary');
    const messages = get('chat_messages').filter((m) => m.meta !== 'temporary');
    set('chat_messages', messages);
    let result;
    try { result = await askAI(text); } catch { result = { answer: 'The online AI path failed safely. Use paper mode, run Smart Analyst, and record the lesson.', evolution: ['Improve offline fallback.'], usedExternalAI: false, model: 'safe-fallback' }; }
    addMessage('ai', result.answer || 'I had a safe failure. Try again in paper mode.', result.usedExternalAI ? `AI model: ${result.model}` : 'Local governed coach');
    const learning = get('chat_learning');
    set('chat_learning', [...learning, { time: new Date().toLocaleString(), from: text, improvements: result.evolution || [] }].slice(-50));
  }

  function createShell() {
    if (document.getElementById('chatFab')) return;
    const fab = document.createElement('button');
    fab.id = 'chatFab';
    fab.className = 'chat-fab';
    fab.textContent = 'AI Coach Chat';
    document.body.appendChild(fab);
    const box = document.createElement('section');
    box.id = 'chatBox';
    box.className = 'chat-box';
    box.style.display = 'none';
    box.innerHTML = `<div class="chat-head"><div><span class="label">Supervised AI Intelligence</span><br><strong>Self-improving trading coach</strong></div><button id="chatClose" class="ghost" type="button">Close</button></div><div id="chatLog" class="chat-log"></div><form id="chatForm" class="chat-form"><input id="chatInput" placeholder="Ask what to do next..." /><button>Send</button></form><div class="chat-actions"><button id="chatNext" type="button">What should I do next?</button><button id="chatExplain" type="button">Explain like I am 7</button><button id="chatImprove" type="button">Self-improve now</button><button id="chatLoop" type="button">Start learning loop</button><button id="chatStop" class="ghost" type="button">Stop loop</button></div>`;
    document.body.appendChild(box);
    fab.onclick = () => { box.style.display = 'grid'; fab.style.display = 'none'; renderMessages(); };
    document.getElementById('chatClose').onclick = () => { box.style.display = 'none'; fab.style.display = 'inline-flex'; };
    document.getElementById('chatForm').addEventListener('submit', (event) => { event.preventDefault(); send(); });
    document.getElementById('chatNext').onclick = () => send('What should I do next to safely work toward making money through trading?');
    document.getElementById('chatExplain').onclick = () => send('Explain this app and the next safest step like I am 7 years old.');
    document.getElementById('chatImprove').onclick = () => { const lessons = localEvolution(); addMessage('ai', `I improved my coaching rules from your current data: ${lessons.join(' ')}`, 'Self-improvement memory saved'); };
    document.getElementById('chatLoop').onclick = () => { if (learningLoop) clearInterval(learningLoop); localEvolution(); addMessage('ai', 'Learning loop started. I will periodically review local memory and update coaching priorities.', 'Self-evolving loop'); learningLoop = setInterval(() => { const lessons = localEvolution(); addMessage('ai', `Self-evolution check: ${lessons[0]}`, 'Automatic learning loop'); }, 60000); };
    document.getElementById('chatStop').onclick = () => { if (learningLoop) clearInterval(learningLoop); learningLoop = null; addMessage('ai', 'Learning loop stopped. Nothing runs in the background now.', 'Stopped'); };
    renderMessages();
  }

  createShell();
})();
