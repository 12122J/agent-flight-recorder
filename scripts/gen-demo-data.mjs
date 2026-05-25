#!/usr/bin/env node
// Generates realistic fake run data for screenshots/demos
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEMO_DIR = join(process.env.HOME, '.tokentrace-demo', 'runs');

const SESSIONS = [
  {
    id: 'demo-001',
    agent: 'claude',
    source: 'hook',
    model: 'claude-sonnet-4-6',
    description: 'Refactor auth middleware to use JWT instead of sessions',
    started_at: '2026-05-25T09:12:00.000Z',
    completed_at: '2026-05-25T09:46:23.000Z',
    duration_ms: 2063000,
    usage: { input_tokens: 214820, cached_input_tokens: 180000, cache_creation_tokens: 12400, cache_read_tokens: 180000, output_tokens: 8241, total_tokens: 223061, cost_usd: 1.43 },
    diff: { files_changed: 7 },
    transcript: '[user]\nRefactor the auth middleware to use JWT tokens instead of server-side sessions. Make sure tests still pass.\n\n[assistant]\nI\'ll refactor the auth middleware to use JWT. Let me start by reading the current implementation...',
  },
  {
    id: 'demo-002',
    agent: 'claude',
    source: 'hook',
    model: 'claude-sonnet-4-6',
    description: 'Add dark mode support to the settings page',
    started_at: '2026-05-24T14:30:00.000Z',
    completed_at: '2026-05-24T14:58:10.000Z',
    duration_ms: 1690000,
    usage: { input_tokens: 98230, cached_input_tokens: 72000, cache_creation_tokens: 9100, cache_read_tokens: 72000, output_tokens: 5812, total_tokens: 104042, cost_usd: 0.71 },
    diff: { files_changed: 4 },
    transcript: '[user]\nAdd dark mode to the settings page using Tailwind CSS.\n\n[assistant]\nI\'ll add dark mode support. Let me check the current settings page structure...',
  },
  {
    id: 'demo-003',
    agent: 'codex',
    source: null,
    model: 'gpt-5.5',
    description: 'Fix race condition in the queue processor',
    started_at: '2026-05-24T11:00:00.000Z',
    completed_at: '2026-05-24T11:22:45.000Z',
    duration_ms: 1365000,
    usage: { input_tokens: 44120, cached_input_tokens: 3200, output_tokens: 312, total_tokens: 44432, cost_usd: 0.23 },
    diff: { files_changed: 2 },
    transcript: '[user]\nFix the race condition in queue.processor.ts — tasks are sometimes processed twice.\n\n[assistant]\nI can see the issue. The lock acquisition isn\'t atomic...',
  },
  {
    id: 'demo-004',
    agent: 'codex',
    source: 'codex-desktop',
    model: 'gpt-5.5',
    description: 'Write unit tests for the billing module',
    started_at: '2026-05-23T16:20:00.000Z',
    completed_at: '2026-05-23T17:05:30.000Z',
    duration_ms: 2730000,
    usage: { total_tokens: 89200, input_tokens: null, output_tokens: null, cost_usd: null },
    diff: { files_changed: 5 },
    transcript: '[user]\nWrite comprehensive unit tests for billing/invoice.ts\n\n[user]\nAlso add edge cases for failed payment retries',
  },
  {
    id: 'demo-005',
    agent: 'claude',
    source: 'hook',
    model: 'claude-opus-4-7',
    description: 'Migrate Postgres schema to add multi-tenancy',
    started_at: '2026-05-22T10:00:00.000Z',
    completed_at: '2026-05-22T11:34:18.000Z',
    duration_ms: 5658000,
    usage: { input_tokens: 512400, cached_input_tokens: 448000, cache_creation_tokens: 32200, cache_read_tokens: 448000, output_tokens: 18940, total_tokens: 531340, cost_usd: 11.24 },
    diff: { files_changed: 12 },
    transcript: '[user]\nWe need to add multi-tenancy to the Postgres schema. All tables need a tenant_id column and RLS policies.\n\n[assistant]\nThis is a significant migration. Let me plan it carefully before touching any files...',
  },
  {
    id: 'demo-006',
    agent: 'claude',
    source: 'hook',
    model: 'claude-sonnet-4-6',
    description: 'Debug why CI is failing on the payment integration tests',
    started_at: '2026-05-21T09:15:00.000Z',
    completed_at: '2026-05-21T09:41:55.000Z',
    duration_ms: 1615000,
    usage: { input_tokens: 78900, cached_input_tokens: 60000, cache_creation_tokens: 8400, cache_read_tokens: 60000, output_tokens: 4120, total_tokens: 83020, cost_usd: 0.58 },
    diff: { files_changed: 1 },
    transcript: '[user]\nCI is failing on payment integration tests since yesterday. Need to fix before the release.\n\n[assistant]\nLet me check the recent test failures...',
  },
  {
    id: 'demo-007',
    agent: 'codex',
    source: 'codex-desktop',
    model: 'gpt-5.5',
    description: 'Implement retry logic for the email sender',
    started_at: '2026-05-20T15:30:00.000Z',
    completed_at: '2026-05-20T16:02:14.000Z',
    duration_ms: 1934000,
    usage: { total_tokens: 62100, input_tokens: null, output_tokens: null, cost_usd: null },
    diff: { files_changed: 3 },
    transcript: '[user]\nAdd exponential backoff retry to the email sender with a max of 3 retries',
  },
];

async function main() {
  await mkdir(DEMO_DIR, { recursive: true });

  for (const s of SESSIONS) {
    const dir = join(DEMO_DIR, s.id);
    await mkdir(dir, { recursive: true });

    const run = {
      id: s.id,
      schema_version: 1,
      command: s.agent === 'claude' ? ['claude'] : ['codex'],
      cwd: '/Users/demo/my-saas-app',
      agent: s.agent,
      source: s.source,
      label: null,
      description: s.description,
      model: s.model,
      started_at: s.started_at,
      completed_at: s.completed_at,
      duration_ms: s.duration_ms,
      exit_code: 0,
      success: true,
      git: { branch: 'main', after: { available: true, branch: 'main', commit: Math.random().toString(16).slice(2, 10), dirty: false } },
      usage: s.usage,
      session: { session_id: s.id },
      tools: { command_count: 0, commands: [] },
      files: { read_count: 0, reads: [] },
      diff: s.diff,
      artifacts: { events: 'events.jsonl', transcript: 'transcript.txt', diff: 'diff.patch', summary: 'summary.md', report: 'report.html' },
    };

    await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2) + '\n');
    await writeFile(join(dir, 'transcript.txt'), s.transcript || '');
    await writeFile(join(dir, 'diff.patch'), '');
  }

  console.log(`Demo data written to ${DEMO_DIR}`);
  console.log(`Run: TOKENTRACE_RUNS_DIR=${DEMO_DIR} node dashboard/server.mjs`);
}

main().catch(console.error);
