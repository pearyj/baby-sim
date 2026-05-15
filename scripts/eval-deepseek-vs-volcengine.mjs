#!/usr/bin/env node
// Eval: current default (Volcengine deepseek-v3-250324) vs deepseek-v4-flash via official DeepSeek API.
// Replays a representative ~5-turn playthrough mirroring src/services/promptService.ts + src/i18n/prompts/en.json.
// Same system prompt, same per-turn user prompts, same fixed choice sequence — so any output diff is the model.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function loadDotenv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const raw of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadDotenv(path.join(repoRoot, '.env.development')), ...process.env };
const VOLCENGINE_KEY = env.VOLCENGINE_LLM_API_KEY || env.VITE_VOLCENGINE_LLM_API_KEY || env.ARK_API_KEY;
const DEEPSEEK_KEY = env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY;

if (!VOLCENGINE_KEY) { console.error('Missing VOLCENGINE_LLM_API_KEY / VITE_VOLCENGINE_LLM_API_KEY / ARK_API_KEY'); process.exit(1); }
if (!DEEPSEEK_KEY) { console.error('Missing DEEPSEEK_API_KEY / VITE_DEEPSEEK_API_KEY'); process.exit(1); }

const ALL_PROVIDERS = {
  volcengine_deepseek_v3: {
    label: 'Volcengine (deepseek-v3-250324)',
    model: 'deepseek-v3-250324',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: VOLCENGINE_KEY,
  },
  // Officially recommended replacements after deepseek-v3-250324 was deprecated.
  volcengine_doubao_seed_lite: {
    label: 'Volcengine (doubao-seed-2-0-lite-260215, thinking=enabled)',
    model: 'doubao-seed-2-0-lite-260215',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: VOLCENGINE_KEY,
  },
  volcengine_doubao_seed_lite_nothink: {
    label: 'Volcengine (doubao-seed-2-0-lite-260215, thinking=disabled)',
    model: 'doubao-seed-2-0-lite-260215',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: VOLCENGINE_KEY,
    extras: { thinking: { type: 'disabled' } },
  },
  volcengine_doubao_seed_lite_nothink_json: {
    label: 'Volcengine (doubao-seed-2-0-lite-260215, thinking=disabled, response_format=json_object)',
    model: 'doubao-seed-2-0-lite-260215',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: VOLCENGINE_KEY,
    extras: { thinking: { type: 'disabled' }, response_format: { type: 'json_object' } },
  },
  volcengine_doubao_seed_character: {
    label: 'Volcengine (doubao-seed-character-251128)',
    model: 'doubao-seed-character-251128',
    apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: VOLCENGINE_KEY,
  },
  deepseek_v4_flash: {
    label: 'DeepSeek API (deepseek-v4-flash)',
    model: 'deepseek-v4-flash',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: DEEPSEEK_KEY,
  },
  deepseek_chat: {
    label: 'DeepSeek API (deepseek-chat)',
    model: 'deepseek-chat',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: DEEPSEEK_KEY,
  },
  deepseek_reasoner: {
    label: 'DeepSeek API (deepseek-reasoner)',
    model: 'deepseek-reasoner',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: DEEPSEEK_KEY,
  },
};

// Allow CLI to filter: `node eval... deepseek_chat deepseek_reasoner`
const argFilter = process.argv.slice(2);
const PROVIDERS = argFilter.length
  ? Object.fromEntries(Object.entries(ALL_PROVIDERS).filter(([k]) => argFilter.includes(k)))
  : ALL_PROVIDERS;

// ─── Prompts copied verbatim from src/i18n/prompts/en.json ──────────────────
const SYSTEM_PROMPT = `A fun and intriguing narrative game called "Baby Simulator" that simulates the experience of raising a child. The goal is to let players make choices with trade-offs, immerse themselves in the bittersweet experiences of parenting until the child is 18, ultimately loving their child and deeply reflecting on their choices.

Your generated language should be plain, EXTREMELY EASY TO READ with paragraph breaks, CONCISE (outcomes ≤150 words, questions ≤120 words), realistic, non-preachy, balanced with details. Your generated story has consistency in details and does not hallucinate.

Return valid and clean JSON objects directly, rules:
- Do not use markdown format (do not use \`\`\`json or any other format wrapping)
- Do not include any control or special characters in the text
- Ensure all quotes (") are properly escaped as single quotation marks (\\")

At the beginning of the game, the player provided special requirements: A first-time parent in their late 20s, urban professional, average income.`;

const INIT_USER = `Generate simple and easy-to-read initial settings for the game, including two parts:

1. Player "you" information: gender, age, and detailed background, including wealth, social status, occupation, family situation, partner relationship, and all other information related to raising a child

2. Baby information: gender, name, background including personality traits, health status, and all other information related to their future growth

Consider these special requirements:
A first-time parent in their late 20s, urban professional, average income.

Return directly in the following format, using descriptive text rather than JSON format:

{
  "player": {
    "gender": "male/female/nonBinary",
    "age": number
  },
  "child": {
    "name": "name",
    "gender": "male/female",
    "age": 1
  },
  "playerDescription": "Complete detailed player background description...",
  "childDescription": "Complete detailed baby background description...",
  "finance": number,
  "isSingleParent": true/false
}

For numeric and boolean values:
- finance: 1 = poor, 10 = very wealthy
- isSingleParent: true if the player is raising the child alone (divorced, widowed, single by choice, IVF, etc.), false if they have a partner

IMPORTANT: Keep initialization sharp, concise and interesting to read. Limit the combined prose of playerDescription and childDescription to no more than 200 words.`;

function fmtHistory(history) {
  if (!history.length) return '';
  return '\nChoice history:\n' + history.map(h =>
    `At ${h.age} years old: ${h.question}\nChoice: ${h.choice}\nResult: ${h.outcome ?? '(pending)'}`
  ).join('\n\n');
}

function buildQuestionPrompt(state, nextAge) {
  const header = `[F${state.finance}/M${state.isSingleParent ? 0 : 5}] `;
  const pg = state.player.gender === 'male' ? 'Father' : state.player.gender === 'female' ? 'Mother' : 'Parent';
  const cg = state.child.gender === 'male' ? 'Boy' : 'Girl';
  return `${header}Based on the following:
Player: ${pg} (${state.player.age} years old)
Player background: ${state.playerDescription}
Child: ${state.child.name} (${cg}, ${state.child.age} years old)
Child background: ${state.childDescription}

${fmtHistory(state.history)}

Generate a realistic parenting question for when the child is ${nextAge} years old.
IMPORTANT: The scenario, tone and details must strongly showcase the realistic style. The question should:
1. Reflect real challenges that is unique for a parent for a child at this age, with a challenge that are very different from earlier patterns.
2. Provide 4 options each valid choice without an obvious "correct" answer. Each option should include "financeDelta" and "maritalDelta" attributes (integers strictly within -2 to +2). financeDelta is the cost relative to the current financial situation (-2 = recurrent spending that is a significant financial burden, +2 = earning that can visibly improve family wealth). maritalDelta affects relationship with partner (negative = strains relationship, positive = improves relationship). Consider realistic impacts.
3. Ensure the people are consistent with previous personality and behavior, considering the child's personality development trajectory and changes in family circumstances

IMPORTANT: Keep the question under 120 words. Keep each option to one sentence.

Return format must strictly follow this JSON structure:

{
  "question": "Question description",
  "options": [
    {"id": "A", "text": "Option A", "financeDelta": 0, "maritalDelta": 0},
    {"id": "B", "text": "Option B", "financeDelta": -2, "maritalDelta": 0},
    {"id": "C", "text": "Option C", "financeDelta": -1, "maritalDelta": 0},
    {"id": "D", "text": "Option D", "financeDelta": 1, "maritalDelta": 0}
  ],
  "isExtremeEvent": true/false
}`;
}

function buildOutcomePrompt(state, question, choice, nextAge) {
  const header = `[F${state.finance}/M${state.isSingleParent ? 0 : 5}] `;
  const pg = state.player.gender === 'male' ? 'Father' : state.player.gender === 'female' ? 'Mother' : 'Parent';
  const cg = state.child.gender === 'male' ? 'Boy' : 'Girl';
  return `${header}Based on the following information:
Player: ${pg} (${state.player.age} years old)
Player background at the beginning of the game: ${state.playerDescription}
Child: ${state.child.name} (${cg}, ${state.child.age} years old)
Child background at birth: ${state.childDescription}

${fmtHistory(state.history)}

the player has been raising ${state.child.name} for ${state.child.age} years and the Current situation: "${question}"
Player chose: "${choice}"

Generate a realistic result of this choice, clearly considering the player INTENT as the player made this choice, describing the impact on the child's growth and family. The family should be growing together with the child too.
IMPORTANT: The narrative style must clearly embody the realistic tone.
IMPORTANT LENGTH CONSTRAINT: Keep the outcome concise and easy to read — no more than 150 words, split into 2-3 short paragraphs. Keep each option text to one sentence. Do NOT write essays.

Then, generate a parenting scenario, child update and question for when the child is ${nextAge} years old.

Return format:
{
  "outcome": "Detailed description of the current choice's results...",
  "nextQuestion": {
    "question": "Next question description",
    "options": [
      {"id": "A", "text": "Option A", "financeDelta": 0, "maritalDelta": 0},
      {"id": "B", "text": "Option B", "financeDelta": -1, "maritalDelta": 1},
      {"id": "C", "text": "Option C", "financeDelta": -2, "maritalDelta": 0},
      {"id": "D", "text": "Option D", "financeDelta": 1, "maritalDelta": -2}
    ],
    "isExtremeEvent": true/false
  }
}`;
}

// ─── HTTP ───────────────────────────────────────────────────────────────────
async function callProvider(provider, messages) {
  const body = {
    model: provider.model,
    messages,
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 0.8,
    ...(provider.extras || {}),
  };
  const t0 = Date.now();
  let resp, text;
  try {
    resp = await fetch(provider.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify(body),
    });
    text = await resp.text();
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: String(e) };
  }
  const latencyMs = Date.now() - t0;
  if (!resp.ok) return { ok: false, latencyMs, status: resp.status, error: text.slice(0, 500) };
  let json;
  try { json = JSON.parse(text); } catch { return { ok: false, latencyMs, error: 'response not JSON', raw: text.slice(0, 500) }; }
  return {
    ok: true,
    latencyMs,
    content: json?.choices?.[0]?.message?.content ?? '',
    finish: json?.choices?.[0]?.finish_reason,
    usage: json?.usage ?? null,
  };
}

function tryParseGameJSON(content) {
  let s = (content || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try { return { ok: true, value: JSON.parse(s) }; } catch (e) { return { ok: false, error: String(e).slice(0, 200) }; }
}

// ─── Playthrough simulator ──────────────────────────────────────────────────
async function runPlaythrough(providerKey, provider, choiceSeq, ages) {
  console.log(`\n=== ${provider.label} ===`);
  const transcript = [];
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  // Step 0: init
  messages.push({ role: 'user', content: INIT_USER });
  const initRes = await callProvider(provider, messages);
  const initParsed = initRes.ok ? tryParseGameJSON(initRes.content) : { ok: false, error: 'no response' };
  transcript.push({ step: 'init', request: INIT_USER, response: initRes, parsed: initParsed });
  console.log(`  [init] ${initRes.ok ? `OK ${initRes.latencyMs}ms ${initRes.usage?.total_tokens ?? '?'} tok parse=${initParsed.ok}` : `FAIL ${initRes.status ?? ''} ${(initRes.error || '').slice(0, 80)}`}`);
  if (!initRes.ok || !initParsed.ok) return transcript;
  messages.push({ role: 'assistant', content: initRes.content });

  const state = initParsed.value;
  state.history = [];
  // sanity: required fields
  if (!state.player || !state.child || typeof state.finance !== 'number') {
    transcript[0].schemaError = 'init missing required fields';
    return transcript;
  }

  // Turn 0 = first question for child's current age
  // Subsequent turns = outcome+next pattern advancing to next age
  for (let i = 0; i < ages.length; i++) {
    const targetAge = ages[i];
    const isFirst = (i === 0);
    const userMsg = isFirst
      ? buildQuestionPrompt(state, targetAge)
      : buildOutcomePrompt(state, state.history[state.history.length - 1].question, state.history[state.history.length - 1].choice, targetAge);
    messages.push({ role: 'user', content: userMsg });
    const res = await callProvider(provider, messages);
    const parsed = res.ok ? tryParseGameJSON(res.content) : { ok: false, error: 'no response' };
    const stepLabel = isFirst ? `q_age${targetAge}` : `out+q_age${targetAge}`;
    transcript.push({ step: stepLabel, age: targetAge, request: userMsg, response: res, parsed });
    console.log(`  [${stepLabel}] ${res.ok ? `OK ${res.latencyMs}ms ${res.usage?.total_tokens ?? '?'} tok parse=${parsed.ok}` : `FAIL ${res.status ?? ''} ${(res.error || '').slice(0, 80)}`}`);
    if (!res.ok || !parsed.ok) break;
    messages.push({ role: 'assistant', content: res.content });

    let q, options;
    if (isFirst) {
      q = parsed.value.question;
      options = parsed.value.options || [];
    } else {
      const last = state.history[state.history.length - 1];
      last.outcome = parsed.value.outcome;
      const next = parsed.value.nextQuestion || {};
      q = next.question;
      options = next.options || [];
    }
    if (!q || !options.length) {
      transcript[transcript.length - 1].schemaError = 'missing question/options in response';
      break;
    }
    const wantedId = choiceSeq[i] || 'B';
    const chosen = options.find(o => o.id === wantedId) || options[0];
    state.history.push({ age: targetAge, question: q, choice: chosen.text, outcome: null });
    state.child.age = targetAge;
  }
  return transcript;
}

// ─── Main ───────────────────────────────────────────────────────────────────
const CHOICE_SEQ = ['B', 'C', 'A', 'D', 'B'];
const AGES = [1, 4, 7, 10, 13];

(async () => {
  const results = {};
  for (const [key, provider] of Object.entries(PROVIDERS)) {
    try {
      results[key] = {
        provider: provider.label,
        model: provider.model,
        transcript: await runPlaythrough(key, provider, CHOICE_SEQ, AGES),
      };
    } catch (e) {
      results[key] = { provider: provider.label, model: provider.model, fatalError: String(e) };
      console.error(`  FATAL: ${e}`);
    }
  }

  // Aggregate stats
  for (const [key, r] of Object.entries(results)) {
    if (!r.transcript) continue;
    const stats = { turns: 0, ok: 0, parseOk: 0, totalLatencyMs: 0, totalTokens: 0, promptTokens: 0, completionTokens: 0 };
    for (const t of r.transcript) {
      stats.turns++;
      if (t.response?.ok) {
        stats.ok++;
        stats.totalLatencyMs += t.response.latencyMs;
        stats.totalTokens += t.response.usage?.total_tokens || 0;
        stats.promptTokens += t.response.usage?.prompt_tokens || 0;
        stats.completionTokens += t.response.usage?.completion_tokens || 0;
      }
      if (t.parsed?.ok) stats.parseOk++;
    }
    r.stats = stats;
  }

  const outDir = path.join(repoRoot, 'scripts', 'eval-output');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `eval-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));

  // Also write a compact markdown for the grader
  const mdPath = path.join(outDir, `eval-${ts}-for-grader.md`);
  let md = `# Eval transcripts\n\nChoice sequence: ${CHOICE_SEQ.join(',')} | Ages: ${AGES.join(',')}\n\n`;
  for (const [key, r] of Object.entries(results)) {
    md += `## ${r.provider}\n\n**Model:** \`${r.model}\`\n\n**Stats:** ${JSON.stringify(r.stats || {})}\n\n`;
    for (const t of (r.transcript || [])) {
      md += `### ${t.step}\n\n`;
      const resp = t.response;
      md += `- latency: ${resp?.latencyMs ?? '?'} ms\n- tokens: ${JSON.stringify(resp?.usage || {})}\n- parse: ${t.parsed?.ok ? 'ok' : 'FAIL ' + (t.parsed?.error || '')}\n- finish: ${resp?.finish || '?'}\n\n`;
      md += `**Response:**\n\n\`\`\`\n${(resp?.content || resp?.error || '').slice(0, 4000)}\n\`\`\`\n\n`;
    }
  }
  fs.writeFileSync(mdPath, md);

  console.log(`\nFull JSON: ${outPath}`);
  console.log(`Grader-ready markdown: ${mdPath}`);
  console.log('\n=== Aggregate stats ===');
  for (const [key, r] of Object.entries(results)) {
    console.log(`${key}: ${JSON.stringify(r.stats || r.fatalError || {})}`);
  }
})();
