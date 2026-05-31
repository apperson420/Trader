const store = {
  get watchlist() { return JSON.parse(localStorage.getItem('trader_watchlist') || '[]'); },
  set watchlist(v) { localStorage.setItem('trader_watchlist', JSON.stringify(v)); },
  get journal() { return JSON.parse(localStorage.getItem('trader_journal') || '[]'); },
  set journal(v) { localStorage.setItem('trader_journal', JSON.stringify(v)); }
};

const $ = (id) => document.getElementById(id);
const money = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number.isFinite(n) ? n : 0);

function updateCounts() {
  $('watchCount').textContent = store.watchlist.length;
  $('journalCount').textContent = store.journal.length;
}

function renderWatchlist() {
  const box = $('watchlist');
  const symbols = store.watchlist;
  box.innerHTML = symbols.length ? '' : '<p class="muted">No symbols yet. Add one above.</p>';
  symbols.forEach((symbol) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<div><strong>${symbol}</strong><p>Research-only watchlist item.</p></div><button class="ghost" data-remove="${symbol}">Remove</button>`;
    box.appendChild(item);
  });
  box.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      store.watchlist = store.watchlist.filter((s) => s !== button.dataset.remove);
      renderWatchlist();
      updateCounts();
    });
  });
}

function calculateRisk() {
  const account = Number($('accountSize').value || 0);
  const pct = Number($('riskPercent').value || 0);
  const entry = Number($('entryPrice').value || 0);
  const stop = Number($('stopPrice').value || 0);
  const risk = account * (pct / 100);
  const perUnit = Math.abs(entry - stop);
  const units = perUnit > 0 ? risk / perUnit : 0;
  $('maxRisk').textContent = money(risk);
  $('riskSummary').textContent = money(risk);
  $('suggestedUnits').textContent = units.toFixed(4);
}

function renderJournal() {
  const box = $('journalList');
  const notes = store.journal;
  box.innerHTML = notes.length ? '' : '<p class="muted">No journal notes yet.</p>';
  notes.slice().reverse().forEach((note) => {
    const item = document.createElement('div');
    item.className = 'item';
    item.innerHTML = `<div><strong>${note.title}</strong><p>${note.text}</p><p>${note.date}</p></div>`;
    box.appendChild(item);
  });
}

$('watchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const symbol = $('symbolInput').value.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
  if (!symbol) return;
  const symbols = [...new Set([...store.watchlist, symbol])];
  store.watchlist = symbols;
  $('symbolInput').value = '';
  renderWatchlist();
  updateCounts();
});

$('clearWatchlist').addEventListener('click', () => { store.watchlist = []; renderWatchlist(); updateCounts(); });
['accountSize','riskPercent','entryPrice','stopPrice'].forEach((id) => $(id).addEventListener('input', calculateRisk));

$('tradeForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const symbol = $('tradeSymbol').value.trim().toUpperCase() || 'UNKNOWN';
  const direction = $('tradeDirection').value;
  const entry = Number($('tradeEntry').value || 0);
  const target = Number($('tradeTarget').value || 0);
  const stop = Number($('tradeStop').value || 0);
  const reward = Math.abs(target - entry);
  const risk = Math.abs(entry - stop);
  const rr = risk > 0 ? reward / risk : 0;
  const verdict = rr >= 2 ? 'Strong paper setup' : rr >= 1 ? 'Needs review' : 'Weak risk/reward';
  $('tradeOutput').innerHTML = `<div><span>${symbol} ${direction}</span><strong>${verdict}</strong><p>Reward/risk ratio: ${rr.toFixed(2)}R. This is a simulation only; no order was sent.</p></div>`;
});

$('journalForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const title = $('journalTitle').value.trim() || 'Untitled note';
  const text = $('journalText').value.trim();
  if (!text) return;
  store.journal = [...store.journal, { title, text, date: new Date().toLocaleString() }];
  $('journalTitle').value = '';
  $('journalText').value = '';
  renderJournal();
  updateCounts();
});

$('clearJournal').addEventListener('click', () => { store.journal = []; renderJournal(); updateCounts(); });

renderWatchlist();
renderJournal();
calculateRisk();
updateCounts();
