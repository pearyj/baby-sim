#!/usr/bin/env node
// Verify volcengine streams correctly when response_format=json_object AND
// thinking=disabled are both set. Some providers buffer the full response in
// JSON mode, defeating streaming.
//
// Reports: first-byte latency, total latency, number of chunks received.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function loadDotenv(p) {
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
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

async function run(label, extras) {
  console.log(`\n=== ${label} ===`);
  const t0 = Date.now();
  let firstChunkAt = null;
  let chunkCount = 0;
  let totalBytes = 0;
  let assembled = '';

  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'doubao-seed-2-0-lite-260215',
      stream: true,
      temperature: 0.7,
      max_tokens: 512,
      top_p: 0.8,
      messages: [
        { role: 'system', content: 'Return a valid JSON object only.' },
        { role: 'user', content: 'Produce {"question":"a 1-sentence parenting question","options":[{"id":"A","text":"opt","financeDelta":1,"maritalDelta":0}]}' },
      ],
      ...extras,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log(`status=${res.status} body=${text.slice(0, 400)}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstChunkAt === null) firstChunkAt = Date.now();
    chunkCount += 1;
    totalBytes += value.length;
    const chunk = decoder.decode(value, { stream: true });
    // Extract delta content for assembled output
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) assembled += delta;
      } catch {}
    }
  }
  const total = Date.now() - t0;
  const firstByte = firstChunkAt ? firstChunkAt - t0 : null;
  console.log(`first-byte: ${firstByte}ms | total: ${total}ms | chunks: ${chunkCount} | bytes: ${totalBytes}`);
  console.log(`assembled (${assembled.length} chars): ${assembled.slice(0, 240)}${assembled.length > 240 ? '…' : ''}`);
  const isStreaming = chunkCount > 3; // more than a couple of chunks = real streaming
  console.log(isStreaming ? '✓ streaming works' : '✗ NOT streaming (single-shot)');
}

(async () => {
  await run('thinking=disabled + response_format=json_object', {
    thinking: { type: 'disabled' },
    response_format: { type: 'json_object' },
  });
  await run('thinking=disabled only', {
    thinking: { type: 'disabled' },
  });
})();
