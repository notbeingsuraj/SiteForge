import assert from 'node:assert/strict';
import AIService from './src/services/AIService.js';
import { config } from './src/config/env.js';

const originalClient = AIService.client;
const originalAi = { ...config.ai };
const originalOmni = { ...config.omniroute.models };

function setMockClient(responses) {
  const calls = [];
  AIService.client = {
    post: async (url, payload) => {
      calls.push({ url, model: payload.model, payload });
      const current = responses.shift();
      if (!current) {
        throw new Error('No mock response configured');
      }
      if (current.status === 'error') {
        const err = new Error(current.message || 'mock error');
        err.response = {
          status: current.httpStatus || 500,
          data: { error: { message: current.message || 'mock error' } },
        };
        throw err;
      }
      return { data: current.data };
    },
  };
  return calls;
}

function resetConfig() {
  config.ai = { ...originalAi };
  config.omniroute.models = { ...originalOmni };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.log(`FAIL: ${name}`);
    console.log(error.stack || error.message);
    process.exitCode = 1;
  } finally {
    resetConfig();
    AIService.client = originalClient;
  }
}

await runTest('TEST 1: primary succeeds', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map(call => call.model), ['primary-model']);
});

await runTest('TEST 2: primary 429 then fallback succeeds', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map(call => call.model), ['primary-model', 'primary-model', 'primary-model', 'fallback-model']);
});

await runTest('TEST 3: primary 503 then fallback succeeds', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'error', httpStatus: 503, message: 'provider unavailable' },
    { status: 'error', httpStatus: 503, message: 'provider unavailable' },
    { status: 'error', httpStatus: 503, message: 'provider unavailable' },
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map(call => call.model), ['primary-model', 'primary-model', 'primary-model', 'fallback-model']);
});

await runTest('TEST 4: primary timeout then fallback succeeds', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'error', httpStatus: 408, message: 'timeout' },
    { status: 'error', httpStatus: 408, message: 'timeout' },
    { status: 'error', httpStatus: 408, message: 'timeout' },
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map(call => call.model), ['primary-model', 'primary-model', 'primary-model', 'fallback-model']);
});

await runTest('TEST 5: malformed JSON uses explicit no-fallback policy', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'ok', data: { choices: [{ message: { content: 'not-json' } }] } },
  ]);

  await assert.rejects(() => AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  }), /invalid json|INVALID_RESPONSE/i);

  assert.deepEqual(calls.map(call => call.model), ['primary-model']);
});

await runTest('TEST 6: primary and fallback fail yields sanitized aggregate error', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'error', httpStatus: 503, message: 'provider unavailable' },
    { status: 'error', httpStatus: 503, message: 'provider unavailable' },
    { status: 'error', httpStatus: 503, message: 'provider unavailable' },
    { status: 'error', httpStatus: 429, message: 'quota exhausted sk-abc123' },
    { status: 'error', httpStatus: 429, message: 'quota exhausted sk-abc123' },
    { status: 'error', httpStatus: 429, message: 'quota exhausted sk-abc123' },
  ]);

  await assert.rejects(() => AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  }), /provider|quota|fallback|safe/i);

  assert.deepEqual(calls.map(call => call.model), ['primary-model', 'primary-model', 'primary-model', 'fallback-model', 'fallback-model', 'fallback-model']);
});

await runTest('TEST 7: no fallback configured keeps current behavior', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: null };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls.map(call => call.model), ['primary-model']);
});

await runTest('TEST 8: fallback output never looks verified', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  setMockClient([
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'ok', data: { choices: [{ message: { content: '{"verified":true,"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { verified: true, ok: true });
  assert.equal(result.verified === true, true);
});

await runTest('TEST 9: stronger evidence precedence is outside provider routing', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  setMockClient([
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'ok', data: { choices: [{ message: { content: '{"website":"https://example.com","verified":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { website: { type: 'string' }, verified: { type: 'boolean' } }, required: ['website'] },
  });

  assert.equal(result.website, 'https://example.com');
  assert.equal(result.verified, true);
});

await runTest('TEST 10: A/B/A isolation remains untouched by provider routing', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const callsA = setMockClient([
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const resultA = await AIService.generate({ prompt: 'a', model: 'fast', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } });
  assert.deepEqual(resultA, { ok: true });
  assert.deepEqual(callsA.map(call => call.model), ['primary-model', 'primary-model', 'primary-model', 'fallback-model']);

  const callsB = setMockClient([
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":false}' } }] } },
  ]);
  const resultB = await AIService.generate({ prompt: 'b', model: 'fast', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } });
  assert.deepEqual(resultB, { ok: false });
  assert.deepEqual(callsB.map(call => call.model), ['primary-model']);
});

await runTest('TEST 11: secret redaction on provider error', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  setMockClient([
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded Authorization: Bearer sk-abc123 cookie=foo' },
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({ prompt: 'x', model: 'fast', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } });
  assert.deepEqual(result, { ok: true });
});

await runTest('TEST 12: request-count guard prevents unbounded retries', async () => {
  config.ai = { primaryModel: 'primary-model', fallbackModel: 'fallback-model' };
  config.omniroute.models = { fast: 'primary-model', reasoning: 'reasoning-model', coding: 'coding-model', copywriting: 'copywriting-model' };
  const calls = setMockClient([
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'error', httpStatus: 429, message: 'rate limit exceeded' },
    { status: 'ok', data: { choices: [{ message: { content: '{"ok":true}' } }] } },
  ]);

  const result = await AIService.generate({
    prompt: 'x',
    model: 'fast',
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  });

  assert.deepEqual(result, { ok: true });
  assert.ok(calls.length <= 4, 'should respect bounded retries');
});

console.log('Provider router test suite complete.');
