(() => {
  const KEY = 'trader_owner_access_code';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function getCode() { return sessionStorage.getItem(KEY) || ''; }
  function setCode(value) { if (value) sessionStorage.setItem(KEY, value); else sessionStorage.removeItem(KEY); }

  window.TraderOwnerAccess = {
    getCode,
    headers() { const code = getCode(); return code ? { 'x-trader-owner-code': code } : {}; },
    isUnlocked() { return Boolean(getCode()); },
    lock() { setCode(''); document.dispatchEvent(new CustomEvent('trader:owner-access-changed')); },
    unlock(code) { setCode(String(code || '').trim()); document.dispatchEvent(new CustomEvent('trader:owner-access-changed')); }
  };

  async function status() {
    try {
      const response = await fetch('/api/owner-access', { cache: 'no-store', headers: window.TraderOwnerAccess.headers() });
      return response.json();
    } catch (error) {
      return { ok: false, required: false, verified: false, message: error.message || 'Owner access check failed safely.' };
    }
  }

  function setMessage(text, bad = false) {
    const box = document.getElementById('ownerAccessMessage');
    if (box) box.innerHTML = `<div class="owner-note ${bad ? 'owner-bad' : ''}">${esc(text)}</div>`;
  }

  async function refresh() {
    const gate = document.getElementById('ownerAccessGate');
    const input = document.getElementById('ownerAccessCode');
    if (!gate) return;
    const s = await status();
    gate.textContent = s.required ? (s.verified ? 'Owner access verified' : 'Owner access required') : 'Owner code not configured';
    gate.dataset.verified = String(Boolean(s.verified));
    if (input && s.verified) input.value = '';
    setMessage(s.message || 'Owner access status checked.', s.required && !s.verified);
  }

  function shell() {
    if (document.getElementById('ownerAccessCenter')) return;
    const hero = document.querySelector('.hero');
    const section = document.createElement('section');
    section.id = 'ownerAccessCenter';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Owner Access</span><h3>Private-use gate for sensitive setup</h3></div><strong id="ownerAccessGate">Checking</strong></div>
      <p class="muted">For private deployments, add TRADER_OWNER_ACCESS_CODE in Vercel. This browser stores the code only in sessionStorage, not in backups. It helps protect setup, backup sync, and broker endpoints from casual public use.</p>
      <div class="owner-actions">
        <input id="ownerAccessCode" type="password" placeholder="Owner access code" autocomplete="off" />
        <button id="ownerAccessUnlock" type="button">Unlock this session</button>
        <button id="ownerAccessLock" class="owner-secondary" type="button">Lock session</button>
        <button id="ownerAccessCheck" class="owner-secondary" type="button">Check owner access</button>
      </div>
      <div id="ownerAccessMessage" class="list"></div>`;
    if (hero?.parentNode) hero.parentNode.insertBefore(section, hero.nextSibling);
    else document.querySelector('.shell')?.prepend(section);
    const style = document.createElement('style');
    style.textContent = `.owner-actions{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.owner-actions input{max-width:280px}.owner-actions button{width:auto}.owner-secondary{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:#edf6ff}.owner-note{border-left:4px solid #a7f3d0;background:rgba(167,243,208,.08);border-radius:14px;padding:12px;color:#edf6ff}.owner-bad{border-left-color:#fbbf24;background:rgba(251,191,36,.08)}#ownerAccessGate[data-verified="true"]{color:#a7f3d0}@media(max-width:860px){.owner-actions input,.owner-actions button{width:100%;max-width:none}}`;
    document.head.appendChild(style);
    document.getElementById('ownerAccessUnlock').addEventListener('click', () => { window.TraderOwnerAccess.unlock(document.getElementById('ownerAccessCode').value); refresh(); });
    document.getElementById('ownerAccessLock').addEventListener('click', () => { window.TraderOwnerAccess.lock(); refresh(); });
    document.getElementById('ownerAccessCheck').addEventListener('click', refresh);
    refresh();
  }

  document.addEventListener('trader:owner-access-changed', refresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', shell);
  else shell();
})();
