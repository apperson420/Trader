(() => {
  const PREFIX = 'trader_';
  const BUNDLE_KEY = `${PREFIX}persistence_bundle_v1`;
  const MIGRATION_KEY = `${PREFIX}persistence_migration_v1`;
  const SYNC_KEY = `${PREFIX}persistence_last_sync`;
  const KEYS = [
    ['watchlist', []],
    ['journal', []],
    ['checks', []],
    ['outcomes', []],
    ['playbooks', []],
    ['ai_plans', []],
    ['broker_logs', []],
    ['broker_setup_checks', []],
    ['validation_report', null],
    ['real_strategy_evolution', null],
    ['chart_last', null],
    ['market_logs', []],
    ['real_results_report', null],
    ['auto_logs', []],
    ['chat_messages', []],
    ['chat_learning', []],
    ['free_tools_registry', []],
    ['setup_wizard', null],
    ['guided_workflow', null]
  ];
  const KEY_SET = new Set(KEYS.map(([name]) => `${PREFIX}${name}`));
  const ARRAY_KEYS = new Set(KEYS.filter(([, fallback]) => Array.isArray(fallback)).map(([name]) => name));
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const originalClear = localStorage.clear.bind(localStorage);
  let cloudConfigured = false;
  let cloudBusy = false;
  let syncTimer = null;
  let suppressMirror = false;

  function fallbackFor(name) {
    const found = KEYS.find(([key]) => key === name);
    const value = found ? found[1] : [];
    return Array.isArray(value) ? [] : value;
  }

  function safeParse(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function rawWrite(key, value) {
    suppressMirror = true;
    originalSetItem(key, value);
    suppressMirror = false;
  }

  function read(name, fallback = fallbackFor(name)) {
    return safeParse(localStorage.getItem(`${PREFIX}${name}`), fallback);
  }

  function write(name, value) {
    localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(value));
  }

  function hasUsefulValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (!value || typeof value !== 'object') return value != null;
    return Object.keys(value).length > 0;
  }

  function mergeArrays(localValue, cloudValue) {
    const seen = new Set();
    const merged = [];
    [...(Array.isArray(cloudValue) ? cloudValue : []), ...(Array.isArray(localValue) ? localValue : [])].forEach((item) => {
      const sig = JSON.stringify(item);
      if (!seen.has(sig)) {
        seen.add(sig);
        merged.push(item);
      }
    });
    return merged;
  }

  function mergeData(localData, cloudData) {
    const merged = {};
    for (const [name] of KEYS) {
      const localValue = localData[name];
      const cloudValue = cloudData ? cloudData[name] : undefined;
      if (ARRAY_KEYS.has(name)) merged[name] = mergeArrays(localValue, cloudValue);
      else merged[name] = hasUsefulValue(localValue) ? localValue : (cloudValue ?? fallbackFor(name));
    }
    return merged;
  }

  function collectData() {
    const data = {};
    for (const [name, fallback] of KEYS) data[name] = read(name, fallback);
    return data;
  }

  function buildBundle(reason = 'local_snapshot') {
    return {
      schemaVersion: 1,
      app: 'Trader Command Center',
      reason,
      exportedAt: new Date().toISOString(),
      safety: 'paper only, research only, not investment advice, no real-money order was sent',
      keys: KEYS.map(([name]) => name),
      data: collectData()
    };
  }

  function saveBundle(reason = 'local_snapshot') {
    const bundle = buildBundle(reason);
    rawWrite(BUNDLE_KEY, JSON.stringify(bundle));
    return bundle;
  }

  function restoreData(data, reason = 'restore') {
    if (!data || typeof data !== 'object') throw new Error('Backup file did not include usable Trader data.');
    for (const [name, fallback] of KEYS) {
      const incoming = data[name];
      if (incoming === undefined) continue;
      if (Array.isArray(fallback) && !Array.isArray(incoming)) continue;
      rawWrite(`${PREFIX}${name}`, JSON.stringify(incoming));
    }
    saveBundle(reason);
    scheduleCloudSave(reason);
    refreshExistingUi();
  }

  function migrateLegacyKeys() {
    const bundle = safeParse(localStorage.getItem(BUNDLE_KEY), null);
    if (bundle?.data) {
      for (const [name, fallback] of KEYS) {
        const key = `${PREFIX}${name}`;
        if (localStorage.getItem(key) == null && bundle.data[name] !== undefined) rawWrite(key, JSON.stringify(bundle.data[name] ?? fallback));
      }
      return bundle;
    }
    const migrated = saveBundle('legacy_localStorage_migration');
    rawWrite(MIGRATION_KEY, JSON.stringify({ migratedAt: new Date().toISOString(), keys: migrated.keys }));
    return migrated;
  }

  function scheduleMirror(reason = 'local_change') {
    if (suppressMirror) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      saveBundle(reason);
      scheduleCloudSave(reason);
      renderStatus();
    }, 250);
  }

  function patchedSetItem(key, value) {
    originalSetItem(key, value);
    if (KEY_SET.has(key)) scheduleMirror('localStorage_write');
  }

  function patchedRemoveItem(key) {
    originalRemoveItem(key);
    if (KEY_SET.has(key)) scheduleMirror('localStorage_remove');
  }

  function patchedClear() {
    originalClear();
    scheduleMirror('localStorage_clear');
  }

  try {
    localStorage.setItem = patchedSetItem;
    localStorage.removeItem = patchedRemoveItem;
    localStorage.clear = patchedClear;
  } catch {
    // Periodic snapshots still migrate direct localStorage writes if a browser blocks method wrapping.
  }

  async function api(action, payload) {
    const options = payload ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) } : undefined;
    const response = await fetch(`/api/persistence?action=${encodeURIComponent(action)}`, options);
    return response.json();
  }

  async function initCloud() {
    try {
      const status = await api('status');
      cloudConfigured = Boolean(status.configured);
      if (!cloudConfigured) return status;
      const remote = await api('load');
      if (remote.ok && remote.payload?.data) {
        const merged = mergeData(collectData(), remote.payload.data);
        restoreData(merged, 'supabase_merge');
      } else {
        await scheduleCloudSave('supabase_initial_seed', true);
      }
      return status;
    } catch (error) {
      return { configured: false, ok: false, message: error.message };
    } finally {
      renderStatus();
    }
  }

  async function scheduleCloudSave(reason = 'local_change', now = false) {
    if (!cloudConfigured || cloudBusy) return;
    const run = async () => {
      cloudBusy = true;
      try {
        const result = await api('save', saveBundle(reason));
        if (result.ok) rawWrite(SYNC_KEY, JSON.stringify({ syncedAt: new Date().toISOString(), reason }));
      } catch {
        // Local storage remains the source of safety if cloud sync is unavailable.
      } finally {
        cloudBusy = false;
        renderStatus();
      }
    };
    if (now) await run();
    else setTimeout(run, 600);
  }

  function downloadBackup() {
    const bundle = saveBundle('manual_export');
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-command-center-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Backup downloaded. It includes app memory only, not broker keys or secrets.');
  }

  async function importBackup(file) {
    const parsed = safeParse(await file.text(), null);
    const data = parsed?.data || parsed;
    restoreData(data, 'manual_import');
    setMessage('Backup restored. If a number did not refresh yet, reload the page once.');
  }

  function dataCount(name) {
    const value = read(name);
    if (Array.isArray(value)) return value.length;
    return hasUsefulValue(value) ? 1 : 0;
  }

  function setMessage(text, bad = false) {
    const box = $('persistMessage');
    if (box) box.innerHTML = `<div class="persist-note ${bad ? 'persist-bad' : ''}">${esc(text)}</div>`;
  }

  function renderStatus() {
    const mode = $('persistMode');
    const counts = $('persistCounts');
    const sync = $('persistSync');
    if (!mode || !counts || !sync) return;
    mode.textContent = cloudConfigured ? 'Supabase-ready sync' : 'Local browser backup';
    const last = safeParse(localStorage.getItem(SYNC_KEY), null);
    sync.textContent = cloudConfigured ? (last ? `Last cloud save: ${new Date(last.syncedAt).toLocaleString()}` : 'Cloud configured; waiting for first save.') : 'Supabase not configured. LocalStorage fallback is active.';
    counts.innerHTML = [
      ['Watchlist', 'watchlist'],
      ['Journal', 'journal'],
      ['Outcomes', 'outcomes'],
      ['Playbooks', 'playbooks'],
      ['AI plans', 'ai_plans'],
      ['Broker logs', 'broker_logs'],
      ['Reports', 'validation_report'],
      ['Workflow', 'guided_workflow']
    ].map(([label, name]) => `<span>${label}: ${dataCount(name)}</span>`).join('');
  }

  function refreshExistingUi() {
    document.dispatchEvent(new CustomEvent('trader:persistence-restored', { detail: buildBundle('ui_refresh') }));
  }

  function addPanel() {
    if ($('persistenceEngine')) return;
    const safety = document.querySelector('.safety');
    if (!safety) return;
    const section = document.createElement('section');
    section.id = 'persistenceEngine';
    section.className = 'panel smart-panel';
    section.innerHTML = `
      <div class="section-head"><div><span class="label">Persistence and backup</span><h3>Save the whole research brain</h3></div><strong id="persistMode">Checking</strong></div>
      <p class="muted">The app works right now with local browser storage. Supabase is optional and server-side: add the environment variables on Vercel, then this panel can sync the same paper-only research memory without putting secrets in browser code.</p>
      <div class="persist-grid" id="persistCounts"></div>
      <div class="evo-actions">
        <button id="persistExport" type="button">Export full backup JSON</button>
        <label class="persist-file">Import backup JSON<input id="persistImport" type="file" accept="application/json" /></label>
        <button id="persistPush" type="button">Save to Supabase if configured</button>
      </div>
      <div class="persist-steps">
        <div><strong>1. Default mode needs no account.</strong><p class="muted">If Supabase is missing, keep using the app normally. Your watchlist, journal, checks, outcomes, playbooks, AI plans, logs, chart proof, guided workflow state, and reports stay in this browser.</p></div>
        <div><strong>2. Optional Supabase setup.</strong><p class="muted">Create a Supabase table named trader_persistence with columns id text primary key, payload jsonb, updated_at timestamptz. On Vercel, add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Optional: TRADER_PERSISTENCE_KEY.</p></div>
        <div><strong>3. Keep secrets server-side.</strong><p class="muted">Never paste service keys into the browser. This panel only calls /api/persistence. Trading remains paper only and research only.</p></div>
      </div>
      <p id="persistSync" class="muted">Checking persistence status...</p>
      <div id="persistMessage" class="list"></div>`;
    safety.parentNode.insertBefore(section, safety);
    $('persistExport').addEventListener('click', downloadBackup);
    $('persistImport').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      importBackup(file).catch((error) => setMessage(error.message || 'Import failed safely.', true));
      event.target.value = '';
    });
    $('persistPush').addEventListener('click', async () => {
      if (!cloudConfigured) return setMessage('Supabase is not configured yet. Add server-side Vercel environment variables first.', true);
      await scheduleCloudSave('manual_supabase_save', true);
      setMessage('Saved the current paper/research memory to Supabase.');
    });
  }

  const style = document.createElement('style');
  style.textContent = `.persist-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.persist-grid span{border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.16);border-radius:12px;padding:9px;color:#d7e2f0}.persist-steps{display:grid;gap:10px;margin-top:12px}.persist-steps div,.persist-note{border-left:4px solid #a7f3d0;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.045);color:#d7e2f0}.persist-note.persist-bad{border-left-color:#f87171}.persist-file{display:inline-flex;align-items:center;width:auto;cursor:pointer;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:12px 14px;color:#edf6ff;font-weight:900}.persist-file input{display:none}@media(max-width:860px){.persist-grid{grid-template-columns:1fr}.persist-file,.evo-actions button{width:100%}}`;
  document.head.appendChild(style);

  window.TraderPersistence = {
    keys: KEYS.map(([name]) => name),
    read,
    write,
    exportBundle: () => saveBundle('manual_export'),
    importBundle: (bundle) => restoreData(bundle?.data || bundle, 'programmatic_import'),
    mode: () => cloudConfigured ? 'supabase-ready' : 'localStorage-fallback'
  };

  migrateLegacyKeys();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addPanel); else addPanel();
  initCloud();
  setInterval(() => {
    saveBundle('periodic_snapshot');
    renderStatus();
  }, 15000);
  document.addEventListener('trader:persistence-restored', () => setTimeout(renderStatus, 50));
})();