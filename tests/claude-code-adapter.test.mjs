import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observeClaudeCodeLine, parseClaudeCodeJsonLine } from '../src/adapters/claude-code.mjs';

test('parseClaudeCodeJsonLine returns null for plain text', () => {
  assert.equal(parseClaudeCodeJsonLine('plain terminal text'), null);
  assert.equal(parseClaudeCodeJsonLine(''), null);
});

test('observeClaudeCodeLine extracts token usage from result event', () => {
  const line = JSON.stringify({
    type: 'result',
    subtype: 'success',
    total_cost_usd: 0.004,
    num_turns: 3,
    session_id: 'sess_abc123',
    usage: {
      input_tokens: 5,
      cache_read_input_tokens: 43677,
      cache_creation_input_tokens: 22336,
      output_tokens: 271
    }
  });

  assert.deepEqual(observeClaudeCodeLine(line), [
    {
      type: 'usage.tokens',
      input_tokens: 5,
      cached_input_tokens: 66013,
      output_tokens: 271,
      reasoning_output_tokens: 0,
      total_tokens: 66289
    },
    { type: 'usage.cost', cost_usd: 0.004 },
    { type: 'session.turns', num_turns: 3, session_id: 'sess_abc123' }
  ]);
});

test('observeClaudeCodeLine returns no usage when tokens are zero', () => {
  const line = JSON.stringify({
    type: 'result',
    subtype: 'success',
    total_cost_usd: 0,
    num_turns: 1,
    session_id: 'sess_x',
    usage: { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  });

  const obs = observeClaudeCodeLine(line);
  assert.equal(obs.find(o => o.type === 'usage.tokens'), undefined);
});

test('observeClaudeCodeLine extracts Bash tool calls from stream-json assistant events', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'Running tests...' },
        { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }
      ]
    }
  });

  assert.deepEqual(observeClaudeCodeLine(line), [
    { type: 'tool.command', command: 'npm test', exit_code: null }
  ]);
});

test('observeClaudeCodeLine extracts file operations from stream-json assistant events', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', name: 'Read', input: { file_path: 'src/index.mjs' } },
        { type: 'tool_use', name: 'Write', input: { file_path: 'out.txt' } },
        { type: 'tool_use', name: 'Edit', input: { file_path: 'src/util.mjs' } }
      ]
    }
  });

  assert.deepEqual(observeClaudeCodeLine(line), [
    { type: 'file.read', path: 'src/index.mjs', bytes: null },
    { type: 'file.read', path: 'out.txt', bytes: null },
    { type: 'file.read', path: 'src/util.mjs', bytes: null }
  ]);
});

test('observeClaudeCodeLine ignores non-JSON lines', () => {
  assert.deepEqual(observeClaudeCodeLine('> Building project...'), []);
  assert.deepEqual(observeClaudeCodeLine(''), []);
});
