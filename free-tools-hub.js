(() => {
  const get = (name, fallback = {}) => JSON.parse(localStorage.getItem(`trader_${name}`) || JSON.stringify(fallback));
  const set = (name, value) => localStorage.setItem(`trader_${name}`, JSON.stringify(value));
  const esc = (value) => String(value || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const tools = [
    ['Active','GitHub','Core platform','Source code, commits, issues, project history','Live: app code is pushed here'],
    ['Active','Vercel','Hosting/backend','Free hosting, deployments, serverless APIs','Live: app and API routes deploy here'],
    ['Active','Coinbase Exchange API','Market data','No-key crypto quotes/order books','Live: BTC/ETH/etc read-only quotes'],
    ['Active','Browser localStorage','Storage','Local watchlist, journal, outcomes, playbooks','Live: browser memory'],
    ['Optional','OpenAI API support','AI','Server-side AI Coach Chat when key is added','Ready: add OPENAI_API_KEY in Vercel'],

    ['Broker/Paper','Alpaca Paper Trading','Paper broker','Paper-only broker setup wizard and explicit PAPER ONLY ticket','Live setup-ready paper adapter'],
    ['Broker/Paper','TradingView Paper Trading','Manual companion','Manual charting and practice','External manual companion'],
    ['Broker/Paper','Interactive Brokers Paper Trading','Paper broker','Advanced paper trading account','External account required'],
    ['Broker/Paper','QuantConnect Paper/Backtesting','Backtesting','Serious algo strategy research','External free tier / LEAN compatible'],
    ['Broker/Paper','LEAN Engine by QuantConnect','Backtesting engine','Local algorithmic backtesting engine','Local install candidate'],
    ['Broker/Paper','Backtrader','Backtesting engine','Python backtesting framework','Local install candidate'],
    ['Broker/Paper','Backtesting.py','Backtesting engine','Simple Python backtests','Local install candidate'],
    ['Broker/Paper','vectorbt','Backtesting engine','Fast vectorized strategy research','Local install candidate'],
    ['Broker/Paper','Freqtrade','Crypto bot framework','Crypto dry-run, backtesting, strategy framework','Local/server candidate'],
    ['Broker/Paper','Jesse','Crypto backtesting','Crypto strategy research/backtesting','Local install candidate'],
    ['Broker/Paper','Hummingbot','Crypto automation','Market-making/research automation','Local install candidate'],
    ['Broker/Paper','Zipline Reloaded','Backtesting engine','Older-style quant backtesting','Local install candidate'],
    ['Broker/Paper','bt','Portfolio backtesting','Portfolio strategy testing','Local install candidate'],
    ['Broker/Paper','PyPortfolioOpt','Portfolio optimization','Portfolio allocation optimizer','Local install candidate'],
    ['Broker/Paper','TA-Lib / pandas-ta','Indicators','Technical indicators','Local install candidate'],

    ['Market Data','Binance public API','Market data','Crypto quotes/candles where available','Read-only adapter planned'],
    ['Market Data','Kraken public API','Market data','Crypto quotes/candles','Read-only adapter planned'],
    ['Market Data','CoinGecko API','Market data','Crypto prices and market data','Read-only adapter planned'],
    ['Market Data','Alpha Vantage','Market data','Stocks, ETFs, FX, indicators','Ready: add ALPHA_VANTAGE_API_KEY'],
    ['Market Data','Twelve Data','Market data','Stocks/forex/crypto data','Ready with free API key'],
    ['Market Data','Finnhub','Market data/news','Stocks/forex/crypto/news','Ready with free API key'],
    ['Market Data','Polygon.io','Market data','Limited free market data','Ready with free API key'],
    ['Market Data','Stooq','Historical data','Free historical CSV-style market data','Read-only adapter planned'],
    ['Market Data','Yahoo Finance via yfinance','Research data','Unofficial research/backtesting data','Local Python candidate'],
    ['Market Data','Nasdaq Data Link free datasets','Datasets','Macro and market datasets','Dataset adapter planned'],
    ['Market Data','FRED','Economic data','Economic indicators','Read-only adapter planned'],
    ['Market Data','SEC EDGAR API','Fundamentals','Company filings and fundamentals','Read-only adapter planned'],
    ['Market Data','Financial Modeling Prep','Fundamentals/quotes','Fundamentals and quotes','Ready with free API key'],
    ['Market Data','IEX Cloud alternatives/free datasets','Market data','Alternative free datasets','Research adapter planned'],

    ['AI Local','Ollama','Local AI','Local assistant/strategy explainer','Local desktop integration planned'],
    ['AI Local','LM Studio','Local AI','Run local models with GUI','Local desktop integration planned'],
    ['AI Local','llama.cpp','Local AI runtime','Lightweight local model runtime','Local desktop integration planned'],
    ['AI Local','Open WebUI','AI UI','Local AI chat dashboard','Local companion planned'],
    ['AI Local','AnythingLLM','Project brain','Local document/project memory','Local companion planned'],
    ['AI Local','Flowise','AI workflows','Visual AI workflow builder','Optional workflow companion'],
    ['AI Local','LangChain','AI framework','Agent/tool orchestration','Backend architecture candidate'],
    ['AI Local','LangGraph','AI framework','Safer multi-step agent workflows','Backend architecture candidate'],
    ['AI Local','LlamaIndex','RAG/memory','Project memory and retrieval','Backend architecture candidate'],
    ['AI Local','LiteLLM','Model routing','Model routing/fallbacks','Backend architecture candidate'],
    ['AI Local','Hugging Face Transformers','Local AI models','Local AI model library','Local Python candidate'],
    ['AI Local','Sentence Transformers','Embeddings','Local embeddings/memory search','Local Python candidate'],
    ['AI Local','ChromaDB','Vector memory','Local vector memory','Local Python candidate'],
    ['AI Local','Qdrant','Vector database','Vector database','Local/cloud candidate'],
    ['AI Local','SQLite','Database','Local app database','Local/desktop candidate'],
    ['AI Local','DuckDB','Analytics DB','Local analytics/backtesting data engine','Local/desktop candidate'],

    ['Build Tools','VS Code','Editor','Main code editor','External dev tool'],
    ['Build Tools','GitHub Desktop','Git GUI','Beginner-friendly Git','External dev tool'],
    ['Build Tools','Codex in ChatGPT','Coding assistant','Repo/code upgrades','External assistant'],
    ['Build Tools','Gemini Code Assist for individuals','Coding assistant','Coding help free tier','External assistant'],
    ['Build Tools','GitHub Copilot Free','Coding assistant','Limited free coding help','External assistant'],
    ['Build Tools','Cursor Free','AI IDE','AI coding IDE free tier','External IDE'],
    ['Build Tools','Continue.dev','Local coding assistant','Open-source VS Code assistant','Local/IDE companion'],
    ['Build Tools','Cline','Agentic coding','Agentic VS Code workflows','Local/IDE companion'],
    ['Build Tools','Roo Code','Agentic coding','Agentic coding workflows','Local/IDE companion'],
    ['Build Tools','Aider','Terminal coding agent','Terminal pair programming','Local companion'],
    ['Build Tools','OpenHands','Autonomous software agent','Autonomous software workbench','Local/server candidate'],
    ['Build Tools','Eclipse Theia','IDE platform','Open-source custom IDE platform','Long-term platform candidate'],
    ['Build Tools','Replit Free','Cloud IDE','Quick prototypes','External companion'],
    ['Build Tools','StackBlitz','Browser IDE','Browser dev environment','External companion'],
    ['Build Tools','CodeSandbox','Browser IDE','Browser app prototyping','External companion'],

    ['Hosting','Netlify','Hosting/backend','Static site plus functions','Deployment alternative'],
    ['Hosting','Cloudflare Pages','Hosting','Fast static hosting','Deployment alternative'],
    ['Hosting','Cloudflare Workers','Serverless','Serverless APIs and cron','Backend alternative'],
    ['Hosting','Supabase','Backend','Database/auth/storage','Ready with project credentials'],
    ['Hosting','Firebase','Backend','Auth/database/hosting','Ready with project credentials'],
    ['Hosting','Neon','Database','Serverless Postgres','Ready with project credentials'],
    ['Hosting','Turso','Database','Edge SQLite','Ready with project credentials'],
    ['Hosting','Railway','Backend','Backend prototypes','Deployment alternative'],
    ['Hosting','Render','Backend','Backend/web services','Deployment alternative'],
    ['Hosting','Deta Space / alternatives','Small app hosting','Small app hosting','Deployment alternative'],
    ['Hosting','GitHub Pages','Static hosting','Docs/static hosting','Docs deployment candidate'],
    ['Hosting','Fly.io','Backend hosting','Small apps and services','Advanced deployment candidate'],

    ['Analytics','Vercel Analytics','Analytics','Visitor analytics','Enable in Vercel'],
    ['Analytics','Vercel Speed Insights','Performance','Performance monitoring','Enable in Vercel'],
    ['Analytics','Google Analytics','Analytics','Traffic analytics','Ready with measurement ID'],
    ['Analytics','Microsoft Clarity','Analytics','Session behavior insights','Ready with project ID'],
    ['Analytics','Sentry','Error monitoring','Frontend/backend error monitoring','Ready with DSN'],
    ['Analytics','Logtail/Better Stack','Logs/uptime','Logs and uptime','Ready with token'],
    ['Analytics','UptimeRobot','Uptime','Uptime checks','External monitor'],
    ['Analytics','Grafana Cloud','Metrics','Dashboards and metrics','External/free tier'],
    ['Analytics','Prometheus + Grafana local','Metrics','Local monitoring stack','Local install candidate'],
    ['Analytics','PostHog','Product analytics','Product usage analytics','Ready with project key/self-host'],

    ['Security','GitHub Dependabot','Dependency alerts','Dependency vulnerability alerts','Enable in GitHub'],
    ['Security','GitHub CodeQL','Code scanning','Static security scanning','Enable in GitHub Actions'],
    ['Security','Gitleaks','Secret scanning','Detect committed secrets','CI/local candidate'],
    ['Security','TruffleHog','Secret scanning','Detect committed secrets','CI/local candidate'],
    ['Security','Semgrep','Static analysis','Security/code rules','CI/local candidate'],
    ['Security','OWASP ZAP','Web security testing','Web vulnerability scanning','CI/local candidate'],
    ['Security','Snyk','Dependency security','Dependency vulnerability checks','Ready with account/token'],
    ['Security','npm audit','JS dependency scan','Node dependency scan','CI candidate'],
    ['Security','pip-audit','Python dependency scan','Python dependency scan','CI/local candidate'],

    ['Automation','GitHub Actions','CI/automation','Tests, scheduled checks, artifacts','CI ready'],
    ['Automation','n8n','Automation','Self-hosted automation workflows','Local/server candidate'],
    ['Automation','Node-RED','Automation','Visual automation','Local/server candidate'],
    ['Automation','Activepieces','Automation','Open-source Zapier-like workflows','Local/server candidate'],
    ['Automation','Make','Automation','Cloud workflows free tier','External companion'],
    ['Automation','Zapier','Automation','Simple automations free tier','External companion'],
    ['Automation','Pipedream','Automation','API workflows free tier','External companion'],
    ['Automation','Cron-job.org','Scheduler','Scheduled URL calls','External scheduler'],
    ['Automation','Cloudflare Cron Triggers','Scheduler','Scheduled worker tasks','Cloudflare candidate'],

    ['Storage','IndexedDB','Browser storage','Larger browser-side memory','Browser upgrade candidate'],
    ['Storage','Supabase Postgres','Database','Cloud Postgres database','Ready with credentials'],
    ['Storage','Neon Postgres','Database','Serverless Postgres','Ready with credentials'],
    ['Storage','Turso SQLite','Database','Edge SQLite','Ready with credentials'],
    ['Storage','Firebase Firestore','Database','Cloud app data','Ready with credentials'],
    ['Storage','MongoDB Atlas','Database','Document database','Ready with credentials'],
    ['Storage','Cloudflare D1','Database','Edge SQLite-like DB','Cloudflare candidate'],
    ['Storage','Cloudflare R2','Object storage','Backups/exports','Cloudflare candidate'],
    ['Storage','GitHub repo JSON files','Static storage','Static config/docs only','Docs/config candidate'],

    ['Charts','TradingView Lightweight Charts','Charts','Professional financial charts','Frontend chart candidate'],
    ['Charts','Apache ECharts','Charts','Advanced interactive charts','Frontend chart candidate'],
    ['Charts','Chart.js','Charts','Simple charts','Frontend chart candidate'],
    ['Charts','D3.js','Charts','Custom visualizations','Advanced frontend candidate'],
    ['Charts','Recharts','Charts','React charts','Future React version candidate'],
    ['Charts','Plotly.js','Charts','Interactive charts','Frontend chart candidate'],
    ['Charts','Observable Plot','Charts','Data visualizations','Frontend chart candidate'],

    ['Docs/Planning','GitHub Issues','Roadmap','Tasks/bugs/roadmap','Use in GitHub'],
    ['Docs/Planning','GitHub Projects','Roadmap','Kanban/project tracking','Use in GitHub'],
    ['Docs/Planning','Notion','Planning docs','Planning docs free tier','External docs'],
    ['Docs/Planning','Obsidian','Knowledge base','Local notes/knowledge base','Local companion'],
    ['Docs/Planning','Logseq','Knowledge graph','Local knowledge graph','Local companion'],
    ['Docs/Planning','MkDocs','Docs website','Documentation website','Docs build candidate'],
    ['Docs/Planning','Docusaurus','Docs website','Documentation site','Docs build candidate'],
    ['Docs/Planning','Mermaid','Diagrams','Markdown diagrams','Docs/UI candidate'],
    ['Docs/Planning','Excalidraw','Diagrams','Visual diagrams','External docs companion']
  ];

  function statusClass(status) {
    if (/Live|Active|Enable|Ready/i.test(status)) return 'hub-good';
    if (/planned|candidate|external|alternative|companion/i.test(status)) return 'hub-warn';
    return 'hub-neutral';
  }

  function addStyle() {
    const style = document.createElement('style');
    style.textContent = `.hub-controls{display:grid;grid-template-columns:1fr auto;gap:10px;margin:14px 0}.hub-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.hub-filters button{width:auto}.hub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-height:620px;overflow:auto;padding-right:4px}.hub-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}.hub-card strong{color:#4cc9f0}.hub-card p{color:#c7d4e5;margin:6px 0}.hub-tag{display:inline-flex;border-radius:999px;border:1px solid rgba(255,255,255,.16);padding:5px 8px;margin:2px 4px 2px 0;color:#d7e2f0;font-size:12px}.hub-good{border-left:4px solid #34d399}.hub-warn{border-left:4px solid #fbbf24}.hub-neutral{border-left:4px solid #4cc9f0}.hub-count{color:#a7f3d0}.hub-note{border-left:4px solid #a7f3d0;padding:10px 12px;background:rgba(255,255,255,.045);border-radius:14px;color:#d7e2f0}@media(max-width:860px){.hub-grid,.hub-controls{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function createShell() {
    if (document.getElementById('freeToolsHub')) return;
    const safety = document.querySelector('.safety');
    const section = document.createElement('section');
    section.id = 'freeToolsHub';
    section.className = 'panel';
    section.innerHTML = `
      <span class="label">Free Tool Setup Registry</span>
      <h3>What is live, setup-ready, or external</h3>
      <p class="muted">This registry separates working app features from tools that require accounts, API keys, local installs, browser extensions, desktop apps, or external services. It does not claim those external tools are connected until setup is complete.</p>
      <div class="hub-note"><strong>Rule:</strong> no hidden trades, no secret scraping, no fake integrations, no real-money execution without explicit adult/owner approval and configured broker credentials.</div>
      <div class="hub-controls"><input id="hubSearch" placeholder="Search tools, categories, status..." /><button id="hubExport" type="button">Export integration map</button></div>
      <div id="hubFilters" class="hub-filters"></div>
      <p class="muted"><span id="hubCount" class="hub-count"></span> tools shown.</p>
      <div id="hubGrid" class="hub-grid"></div>`;
    safety.parentNode.insertBefore(section, safety);
  }

  function categories() { return ['All', ...Array.from(new Set(tools.map((x) => x[0])))]; }
  let active = 'All';

  function renderFilters() {
    const box = document.getElementById('hubFilters');
    box.innerHTML = categories().map((cat) => `<button type="button" class="ghost" data-cat="${esc(cat)}">${esc(cat)}</button>`).join('');
    box.querySelectorAll('button').forEach((button) => button.onclick = () => { active = button.dataset.cat; render(); });
  }

  function render() {
    const q = String(document.getElementById('hubSearch')?.value || '').toLowerCase();
    const rows = tools.filter((t) => (active === 'All' || t[0] === active) && t.join(' ').toLowerCase().includes(q));
    document.getElementById('hubCount').textContent = `${rows.length}/${tools.length}`;
    document.getElementById('hubGrid').innerHTML = rows.map((t) => `<article class="hub-card ${statusClass(t[4])}"><strong>${esc(t[1])}</strong><p>${esc(t[3])}</p><span class="hub-tag">${esc(t[0])}</span><span class="hub-tag">${esc(t[2])}</span><span class="hub-tag">${esc(t[4])}</span></article>`).join('');
  }

  function exportMap() {
    const data = { exportedAt: new Date().toISOString(), warning: 'Setup registry only. Some tools require accounts, keys, installs, or separate setup before they are live.', tools: tools.map(([category, name, type, use, status]) => ({ category, name, type, use, status })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trader-free-tool-integration-map-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  addStyle();
  createShell();
  renderFilters();
  document.getElementById('hubSearch').addEventListener('input', render);
  document.getElementById('hubExport').addEventListener('click', exportMap);
  set('free_tools_registry', tools.map(([category, name, type, use, status]) => ({ category, name, type, use, status })));
  render();
})();
