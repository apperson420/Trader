function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8') || '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}

function clampText(value, max = 3000) {
  return String(value || '').slice(0, max);
}

function summarizeMemory(memory = {}) {
  const watchlist = Array.isArray(memory.watchlist) ? memory.watchlist.slice(0, 8) : [];
  const journal = Array.isArray(memory.journal) ? memory.journal.slice(-5) : [];
  const outcomes = Array.isArray(memory.outcomes) ? memory.outcomes : [];
  const playbooks = Array.isArray(memory.playbooks) ? memory.playbooks.slice(-5) : [];
  const wins = outcomes.filter((x) => x && x.result === 'Win').length;
  const losses = outcomes.filter((x) => x && x.result === 'Loss').length;
  const total = outcomes.length;
  const avgR = total ? outcomes.reduce((sum, x) => sum + Number(x.r || 0), 0) / total : 0;
  return { watchlist, journal, playbooks, totalOutcomes: total, wins, losses, avgR: Number(avgR.toFixed(2)) };
}

function localCoachReply(message, memory) {
  const m = summarizeMemory(memory);
  const lower = String(message || '').toLowerCase();
  const needsWatchlist = !m.watchlist.length;
  const needsOutcomes = m.totalOutcomes < 10;
  const negativeEdge = m.totalOutcomes >= 3 && m.avgR <= 0;
  let answer = '';
  if (lower.includes('what should') || lower.includes('next') || lower.includes('do')) {
    if (needsWatchlist) answer = 'Step 1: add 1 to 3 things to the Watchlist, like BTC or SPY. Step 2: run Market Intelligence. Step 3: run Smart Analyst. Step 4: save the idea in the journal. No real money yet.';
    else if (needsOutcomes) answer = `Your next mission is to collect paper evidence. You have ${m.totalOutcomes}/10 paper outcomes recorded. Pick one watchlist item, make a paper plan, and record the result.`;
    else if (negativeEdge) answer = `Your paper edge is not ready because average R is ${m.avgR}. Reduce risk, tighten the playbook, and stop any setup that keeps losing.`;
    else answer = 'Run Scenario Lab, review expectancy, and only keep setups with positive paper evidence. Real money still needs adult approval and strict risk limits.';
  } else if (lower.includes('buy') || lower.includes('sell') || lower.includes('trade now')) {
    answer = 'I will not tell you to buy or sell. I can help make a paper plan: check the quote, define entry, stop, target, risk 1% or less, run Smart Analyst, then journal the lesson.';
  } else if (lower.includes('money') || lower.includes('profit') || lower.includes('income')) {
    answer = 'The safest path toward income is boring on purpose: paper practice first, track at least 20 outcomes, prove positive expectancy, keep risk tiny, and require adult approval before real money. No app can guarantee profit.';
  } else if (lower.includes('explain') || lower.includes('7')) {
    answer = 'Kid-simple version: We are not pressing a magic money button. We are practicing like a game. Watch something, make a tiny plan, protect pretend money, write what happened, and learn.';
  } else {
    answer = 'I can coach the next safest step. Use this order: Watchlist → Market Intelligence → Smart Analyst → Scenario Lab → Paper result → Journal → Evolution Engine. That is how the system improves without hidden trades.';
  }
  const evolution = [];
  if (needsWatchlist) evolution.push('Ask the user to add watchlist symbols before judging any setup.');
  if (needsOutcomes) evolution.push('Prioritize outcome collection until at least 10 paper results exist.');
  if (negativeEdge) evolution.push('Tighten playbook filters because expectancy is not positive.');
  if (!evolution.length) evolution.push('Continue comparing playbooks and preserving only positive-expectancy paper setups.');
  return { answer, evolution, model: 'local-governed-coach', usedExternalAI: false };
}

async function openAIReply(message, memory) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const briefMemory = summarizeMemory(memory);
  const body = {
    model,
    input: [
      {
        role: 'system',
        content: 'You are the governed AI coach inside Trader Command Center. The user wants a 7-year-old-friendly autonomous trading learning system. You must be helpful, simple, and safety-first. Do not promise profit. Do not provide direct buy/sell instructions. Do not tell a child to trade real money. Recommend paper trading, journaling, risk limits, adult approval, and visible approval gates. Keep answers concise and actionable.'
      },
      {
        role: 'user',
        content: `User message: ${clampText(message, 1200)}\n\nCurrent app memory summary: ${JSON.stringify(briefMemory)}`
      }
    ],
    max_output_tokens: 450
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const data = await response.json();
  const answer = data.output_text || data.output?.flatMap((x) => x.content || []).map((c) => c.text || '').join('\n') || '';
  return { answer: clampText(answer, 2400), evolution: ['Use chat feedback to improve the local coaching plan.'], model, usedExternalAI: true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'POST only.' });
  try {
    const body = await readBody(req);
    const message = clampText(body.message, 1200);
    const memory = body.memory && typeof body.memory === 'object' ? body.memory : {};
    let reply = null;
    try { reply = await openAIReply(message, memory); } catch (error) { reply = null; }
    if (!reply) reply = localCoachReply(message, memory);
    json(res, 200, { ok: true, ...reply, safety: 'education_and_paper_trading_only' });
  } catch (error) {
    json(res, 200, { ok: false, answer: 'The AI coach had a safe failure. Use paper mode, keep risk tiny, and try again.', evolution: ['Improve error recovery.'], model: 'safe-fallback', usedExternalAI: false });
  }
}
