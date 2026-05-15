#!/usr/bin/env node
// Diagnose what kind of rate-limit error volcengine returns under load.
// Strategy:
//   1) Single baseline call — confirms key/model work and shows happy-path latency.
//   2) Fan-out: fire 12 concurrent calls — should trigger 429 if any per-minute
//      limit (RPM/TPM/IPM/etc.) is being hit during normal usage. Each non-2xx
//      response is fully decoded so we can see the error.code, which maps to a
//      specific limit type (RateLimitExceeded.EndpointRPMExceeded, etc.).
//   3) Repeat once WITH the X-Ark-Max-Wait-Timeout-Ms queue header to confirm
//      the queue feature actually helps.
//
// Run:  node scripts/diagnose-volcengine-429.mjs

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
const VOLCENGINE_KEY = env.VOLCENGINE_LLM_API_KEY || env.VITE_VOLCENGINE_LLM_API_KEY || env.ARK_API_KEY;
if (!VOLCENGINE_KEY) {
  console.error('Missing VOLCENGINE_LLM_API_KEY / VITE_VOLCENGINE_LLM_API_KEY / ARK_API_KEY in env');
  process.exit(1);
}

const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MODEL = 'deepseek-v3-250324';

async function callOnce({ queueWaitMs } = {}) {
  const started = Date.now();
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VOLCENGINE_KEY}`,
      ...(queueWaitMs ? { 'X-Ark-Max-Wait-Timeout-Ms': String(queueWaitMs) } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with exactly one word: ping' }],
      temperature: 0.7,
      max_tokens: 16,
    }),
  });
  const elapsedMs = Date.now() - started;
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  const errorCode = parsed?.error?.code ?? parsed?.error?.type ?? parsed?.code;
  const errorMsg = parsed?.error?.message ?? parsed?.message;
  return {
    status: res.status,
    ok: res.ok,
    elapsedMs,
    errorCode,
    errorMsg,
    snippet: text.slice(0, 300),
  };
}

function summarise(label, results) {
  console.log(`\n=== ${label} ===`);
  const byStatus = new Map();
  for (const r of results) {
    const key = r.ok ? '200' : `${r.status} ${r.errorCode ?? 'unknown-code'}`;
    byStatus.set(key, (byStatus.get(key) ?? 0) + 1);
  }
  console.log('Counts:', Object.fromEntries(byStatus));
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    const avg = Math.round(results.reduce((a, r) => a + r.elapsedMs, 0) / results.length);
    console.log(`All ${results.length} succeeded. Avg latency: ${avg}ms.`);
  } else {
    // Show the first distinct error per (status, code) pair.
    const seen = new Set();
    for (const r of failed) {
      const k = `${r.status}:${r.errorCode}`;
      if (seen.has(k)) continue;
      seen.add(k);
      console.log(`Example failure (${k}):`);
      console.log(`  status=${r.status} code=${r.errorCode} msg=${r.errorMsg ?? '(none)'}`);
      console.log(`  raw: ${r.snippet}`);
    }
  }
}

(async () => {
  console.log('Volcengine 429 diagnostic');
  console.log(`Model: ${MODEL}`);
  console.log(`Key fingerprint: ${VOLCENGINE_KEY.slice(0, 6)}…${VOLCENGINE_KEY.slice(-4)}`);

  // 1) Baseline
  console.log('\n[1/3] Baseline single call (no queue header)…');
  const baseline = await callOnce();
  console.log(JSON.stringify(baseline, null, 2));

  // 2) Concurrent fan-out without queue header
  console.log('\n[2/3] 12 concurrent calls WITHOUT queue header…');
  const fanout = await Promise.all(Array.from({ length: 12 }, () => callOnce()));
  summarise('No queue header', fanout);

  // 3) Same fan-out WITH queue header
  console.log('\n[3/3] 12 concurrent calls WITH X-Ark-Max-Wait-Timeout-Ms=60000…');
  const fanoutQueued = await Promise.all(
    Array.from({ length: 12 }, () => callOnce({ queueWaitMs: 60_000 })),
  );
  summarise('With queue header (60s wait)', fanoutQueued);

  console.log('\nDone.');
})().catch((err) => {
  console.error('Diagnostic crashed:', err);
  process.exit(1);
});
