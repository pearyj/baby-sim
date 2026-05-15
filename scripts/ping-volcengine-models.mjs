#!/usr/bin/env node
// Quick sanity check: do these volcengine model IDs respond at all?
// Run:  node scripts/ping-volcengine-models.mjs

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

const env = {
  ...loadDotenv(path.join(repoRoot, '.env.development')),
  ...loadDotenv(path.join(repoRoot, '.env.local')),
  ...loadDotenv(path.join(repoRoot, '.env')),
  ...process.env,
};
const KEY = env.VOLCENGINE_LLM_API_KEY || env.VITE_VOLCENGINE_LLM_API_KEY || env.ARK_API_KEY;
if (!KEY) { console.error('Missing volcengine key'); process.exit(1); }

const MODELS = [
  'doubao-seed-2-0-lite-260215',
  'doubao-seed-character-251128',
];

const URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

async function ping(model, extras = {}) {
  const started = Date.now();
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with one word: ping' }],
      temperature: 0.3,
      max_tokens: 16,
      ...extras,
    }),
  });
  const elapsed = Date.now() - started;
  const text = await res.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }
  return {
    model,
    status: res.status,
    elapsedMs: elapsed,
    content: parsed?.choices?.[0]?.message?.content ?? null,
    errorCode: parsed?.error?.code,
    errorMsg: parsed?.error?.message,
    snippet: text.slice(0, 400),
  };
}

(async () => {
  for (const m of MODELS) {
    console.log(`\n--- ${m} (default thinking) ---`);
    console.log(JSON.stringify(await ping(m), null, 2));

    console.log(`\n--- ${m} (thinking: disabled) ---`);
    console.log(JSON.stringify(await ping(m, { thinking: { type: 'disabled' } }), null, 2));

    console.log(`\n--- ${m} (thinking: auto) ---`);
    console.log(JSON.stringify(await ping(m, { thinking: { type: 'auto' } }), null, 2));
  }
})();
