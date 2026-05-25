import assert from 'node:assert/strict';
import { test } from 'node:test';

// We test the internal parsing logic by re-exporting it through a thin harness
// that replaces the sqlite3 call with in-memory data.

import { readNewSessions } from '../src/adapters/codex-desktop.mjs';

// -------------------------------------------------------------------
// Helper: create a fake SQLite DB in a temp file populated with
// representative rows, then read it back through readNewSessions.
// -------------------------------------------------------------------
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function makeTempDb(rows) {
  const dir = await mkdtemp(join(tmpdir(), 'tt-codex-test-'));
  const dbPath = join(dir, 'logs.sqlite');

  const createTable = `
    CREATE TABLE logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      ts_nanos INTEGER NOT NULL DEFAULT 0,
      level TEXT NOT NULL DEFAULT 'INFO',
      target TEXT NOT NULL,
      feedback_log_body TEXT,
      thread_id TEXT,
      process_uuid TEXT DEFAULT 'test',
      estimated_bytes INTEGER NOT NULL DEFAULT 0
    );
  `;
  await execFileAsync('sqlite3', [dbPath, createTable]);

  for (const row of rows) {
    const escaped = (row.feedback_log_body ?? '').replace(/'/g, "''");
    const tid = row.thread_id ? `'${row.thread_id}'` : 'NULL';
    await execFileAsync('sqlite3', [dbPath, `
      INSERT INTO logs (ts, target, feedback_log_body, thread_id)
      VALUES (${row.ts}, '${row.target}', '${escaped}', ${tid});
    `]);
  }

  return { dbPath, cleanup: () => rm(dir, { recursive: true }) };
}

const THREAD = '019e5ea0-7ae1-7b51-ad4a-66ebd906412d';

test('detects a complete session with tokens and model', async () => {
  const { dbPath, cleanup } = await makeTempDb([
    {
      ts: 1000,
      thread_id: THREAD,
      target: 'codex_core::session::turn',
      feedback_log_body: `session_loop{thread_id=${THREAD}}:turn{model=gpt-5.5 cwd=/tmp/proj}: post sampling token usage total_usage_tokens=50000 auto_compact_scope_tokens=50000`,
    },
    {
      ts: 1001,
      thread_id: THREAD,
      target: 'codex_app_server::request_processors::thread_lifecycle',
      feedback_log_body: `thread ${THREAD} has no subscribers and is idle; shutting down`,
    },
  ]);

  try {
    const { sessions } = await readNewSessions(0, dbPath);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].thread_id, THREAD);
    assert.equal(sessions[0].model, 'gpt-5.5');
    assert.equal(sessions[0].cwd, '/tmp/proj');
    assert.equal(sessions[0].total_tokens, 50000);
    assert.equal(sessions[0].is_complete, true);
  } finally {
    await cleanup();
  }
});

test('ignores sessions without a shutdown event', async () => {
  const { dbPath, cleanup } = await makeTempDb([
    {
      ts: 1000,
      thread_id: THREAD,
      target: 'codex_core::session::turn',
      feedback_log_body: `session_loop{thread_id=${THREAD}}: total_usage_tokens=1000`,
    },
    // No lifecycle shutdown row
  ]);

  try {
    const { sessions } = await readNewSessions(0, dbPath);
    assert.equal(sessions.length, 0);
  } finally {
    await cleanup();
  }
});

test('tracks the max total_tokens across multiple turns', async () => {
  const { dbPath, cleanup } = await makeTempDb([
    {
      ts: 1000,
      thread_id: THREAD,
      target: 'codex_core::session::turn',
      feedback_log_body: `session_loop{thread_id=${THREAD}}: total_usage_tokens=30000`,
    },
    {
      ts: 1001,
      thread_id: THREAD,
      target: 'codex_core::session::turn',
      feedback_log_body: `session_loop{thread_id=${THREAD}}: total_usage_tokens=80000`,
    },
    {
      ts: 1002,
      thread_id: THREAD,
      target: 'codex_app_server::request_processors::thread_lifecycle',
      feedback_log_body: `thread ${THREAD} has no subscribers and is idle; shutting down`,
    },
  ]);

  try {
    const { sessions } = await readNewSessions(0, dbPath);
    assert.equal(sessions[0].total_tokens, 80000);
  } finally {
    await cleanup();
  }
});

test('extracts user messages from handler logs', async () => {
  const { dbPath, cleanup } = await makeTempDb([
    {
      ts: 1000,
      thread_id: THREAD,
      target: 'codex_core::session::handlers',
      feedback_log_body: `session_loop{thread_id=${THREAD}}: Submission sub=Submission { id: "abc", op: UserInput { items: [Text { text: "hello world", text_elements: [] }] } }`,
    },
    {
      ts: 1001,
      thread_id: THREAD,
      target: 'codex_app_server::request_processors::thread_lifecycle',
      feedback_log_body: `thread ${THREAD} has no subscribers and is idle; shutting down`,
    },
  ]);

  try {
    const { sessions } = await readNewSessions(0, dbPath);
    assert.equal(sessions[0].user_messages.length, 1);
    assert.equal(sessions[0].user_messages[0], 'hello world');
  } finally {
    await cleanup();
  }
});

test('extracts assistant text messages, skips function calls', async () => {
  const assistantMsg = JSON.stringify({
    type: 'response.output_item.done',
    item: {
      id: 'msg_abc',
      type: 'message',
      status: 'completed',
      content: [{ type: 'output_text', text: 'Here is the answer.' }],
    },
  });
  const functionCall = JSON.stringify({
    type: 'response.output_item.done',
    item: {
      id: 'fc_xyz',
      type: 'function_call',
      status: 'completed',
      name: 'exec_command',
      arguments: '{"cmd":"ls"}',
    },
  });

  const { dbPath, cleanup } = await makeTempDb([
    {
      ts: 1000,
      thread_id: THREAD,
      target: 'log',
      feedback_log_body: `Received message ${assistantMsg}`,
    },
    {
      ts: 1001,
      thread_id: THREAD,
      target: 'log',
      feedback_log_body: `Received message ${functionCall}`,
    },
    {
      ts: 1002,
      thread_id: THREAD,
      target: 'codex_app_server::request_processors::thread_lifecycle',
      feedback_log_body: `thread ${THREAD} has no subscribers and is idle; shutting down`,
    },
  ]);

  try {
    const { sessions } = await readNewSessions(0, dbPath);
    assert.equal(sessions[0].assistant_messages.length, 1);
    assert.equal(sessions[0].assistant_messages[0], 'Here is the answer.');
  } finally {
    await cleanup();
  }
});

test('respects sinceId cursor — skips already-seen rows', async () => {
  const { dbPath, cleanup } = await makeTempDb([
    {
      ts: 1000,
      thread_id: THREAD,
      target: 'codex_core::session::turn',
      feedback_log_body: `total_usage_tokens=1000`,
    },
    {
      ts: 1001,
      thread_id: THREAD,
      target: 'codex_app_server::request_processors::thread_lifecycle',
      feedback_log_body: `thread ${THREAD} has no subscribers and is idle; shutting down`,
    },
  ]);

  try {
    // Get the max id from the db so we can pass it as sinceId
    const { execFileAsync: runSql } = { execFileAsync };
    const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, 'SELECT MAX(id) as m FROM logs']);
    const maxId = JSON.parse(stdout)[0].m;

    const { sessions, maxId: newMax } = await readNewSessions(maxId, dbPath);
    assert.equal(sessions.length, 0, 'should see no new sessions when sinceId is current');
    assert.equal(newMax, maxId);
  } finally {
    await cleanup();
  }
});

test('returns empty result when DB does not exist', async () => {
  const { sessions, maxId } = await readNewSessions(0, '/tmp/does-not-exist-tt-test.sqlite');
  assert.equal(sessions.length, 0);
  assert.equal(maxId, 0);
});
