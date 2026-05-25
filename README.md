# TokenTrace

Know what your coding agent actually did — and what it cost.

`tt` records supported coding-agent sessions and CLI runs, then writes a local
trace — transcript, git diff, token usage, cost — as plain files you can
inspect, share, or attach to a PR.
No hosted service. No signup. Zero runtime dependencies.

```bash
npm install -g @j___avi/tokentrace
tt install
# Claude Code CLI sessions are now recorded automatically when they end

tt summarize
# 2026-05-25   ok   tokens=1,762,228   cost=$37.9232   changed=4   claude
```

## Why

Agent runs disappear into terminal scrollback. You either trust the result or
you don't, with nothing in between. `tt` gives you the evidence:

- what command ran and whether it succeeded
- the full stdout/stderr transcript
- what changed in git, as a patch
- how many tokens were used and what it cost
- trust warnings for runs that look incomplete

The trace stays on your machine. You decide what to share.

## Use Cases

**Track what you're actually spending.** Claude Code sessions can quietly run up large token counts. `tt summarize` gives you a line per session — tokens, cost, files changed, date — so you can see where your usage goes.

```
2026-05-25   ok   tokens=1,762,228   cost=$37.9232   changed=4   claude
2026-05-24   ok   tokens=452,104     cost=$3.1210    changed=7   codex
2026-05-22   ok   tokens=892,041     cost=$1.0204    changed=0   claude
```

**Attach evidence to a PR.** When an agent writes or refactors code, reviewers are often asked to trust the result blindly. Drop `summary.md` or `diff.patch` into the PR description so reviewers can see the transcript and what actually changed.

**Debug a session that went wrong.** If an agent made unexpected changes or exited badly, the transcript and diff tell you exactly what happened — without relying on terminal scrollback that's already gone.

**Spot sessions that need a second look.** Trust warnings flag sessions where files changed but no tests ran, or where token usage is missing. A quick `tt summarize` shows you which sessions are worth reviewing before you ship.

## Getting Started

```bash
npm install -g @j___avi/tokentrace
tt install
```

`tt install` adds a Stop hook to `~/.claude/settings.json`. From that point on, Claude Code CLI sessions are automatically recorded when they end — no wrapper command needed.

After your next Claude Code session:

```bash
tt summarize
```

```
2026-05-25T10:20Z   ok   tokens=1762228   cost=$37.9232   changed=4   claude
```

Open the full report:

```bash
open ~/.tokentrace/runs/<session-id>/report.html
```

Sessions are stored in `~/.tokentrace/runs/` — one folder per session, named by session ID.

## Dashboard

Run the local dashboard to browse sessions, compare cost over time, inspect transcripts and diffs, set an EU VAT rate, and add your own labels.

```bash
tt serve
```

![TokenTrace dashboard overview](docs/assets/dashboard-overview.svg)

Each session includes an estimated pricing breakdown. Cache reads are displayed separately because they can be huge across long agent sessions, but they are not counted as "total tokens" in the dashboard.

![TokenTrace session cost breakdown](docs/assets/session-breakdown-sample.svg)

## Current Limitations

TokenTrace is early and intentionally honest about what it can see today.

| Surface | Current support |
| --- | --- |
| Claude Code CLI | Automatic after `tt install`. |
| Claude Code Desktop | Automatic after `tt install` — same hook file as CLI. |
| Codex Desktop app | Automatic after `tt install` — reads `~/.codex/logs_2.sqlite` every 30 s via a macOS LaunchAgent. |
| Codex CLI | Automatic after `tt install` if `codex` is in PATH — a shell shim wraps it transparently. |
| Shell commands | Works when launched through `tt run -- <command>`. |
| VS Code / IDE integrations | Not captured automatically yet. |
| Browser-based agent sessions | Not captured automatically yet. |

**Codex Desktop transcript note:** The SQLite log database does not store full per-thread assistant message content for all sessions. User messages are always captured; assistant message text is captured when available in the logs (usually for recent sessions). Token count and model are always captured.

TokenTrace is not a global activity monitor for IDE plugins or browser sessions — those surfaces need dedicated integrations.

## Automatic Recording via `tt install`

`tt install` sets up three integrations at once:

1. **Claude Code hook** — writes a Stop hook to `~/.claude/settings.json`. Both the CLI and the Desktop app read this file, so both surfaces are covered.
2. **Codex CLI shim** — if `codex` is in PATH, adds a shell function to `~/.zshrc` (or `~/.bashrc`) that wraps every `codex exec` call transparently. Restart your shell once after install.
3. **Codex Desktop watcher** (macOS only) — installs a LaunchAgent at `~/Library/LaunchAgents/io.tokentrace.codex-watcher.plist` that runs `tt watch-codex --once` every 30 seconds. Completed Codex Desktop sessions are recorded automatically.

```bash
npm install -g @j___avi/tokentrace
tt install
# ✓ Claude Code hook installed → ~/.claude/settings.json
# ✓ Codex CLI shim installed → ~/.zshrc
# ✓ Codex Desktop watcher installed → ~/Library/LaunchAgents/io.tokentrace.codex-watcher.plist
```

To see all recorded sessions:

```bash
tt summarize
# 2026-05-25T10:20Z   ok   tokens=1762228   cost=$37.9232   changed=4   claude
# 2026-05-24T18:43Z   ok   tokens=452104    cost=$3.1210    changed=7   codex
```

To open the HTML report for a session:

```bash
open ~/.tokentrace/runs/<session-id>/report.html
```

To uninstall, remove the tokentrace entry from the `hooks.Stop` array in `~/.claude/settings.json`.

## Ask Claude About Your Sessions

`tt` ships an MCP server so Claude can query your recorded sessions directly. Once wired up, you can ask things like:

- *"how much have I spent on tokens this week?"*
- *"what did I change in my last session?"*
- *"show me the diff from yesterday"*

**Setup (one time):** add this to `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "tokentrace": {
      "command": "npx",
      "args": ["-y", "-p", "@j___avi/tokentrace", "tokentrace-mcp"]
    }
  }
}
```

Restart Claude Code and just ask. No commands needed — Claude pulls the data from `~/.tokentrace/runs/` automatically.

The MCP server exposes four tools Claude can call:

| Tool | What it does |
| --- | --- |
| `list_sessions` | Recent sessions — tokens, cost, files changed, status |
| `get_session` | Full metadata + transcript for one session |
| `get_diff` | Git patch from a session |
| `get_token_usage` | Aggregate cost and token totals, with optional date range |

## What You Get

Each run writes six files:

```
.tokentrace/runs/<run-id>/
  run.json        # structured metadata: command, exit code, usage, git state
  events.jsonl    # chronological event stream
  transcript.txt  # full stdout and stderr
  diff.patch      # git patch captured after the run
  summary.md      # human-readable summary
  report.html     # standalone HTML report, openable offline
```

Example `summary.md`:

```markdown
**Command**: `claude --output-format json -p "list the files in this repo"`
**Duration**: 13.33s
**Exit Code**: 0
**Total Tokens**: 66289
**Files Changed**: 0
```

See [docs/RUN_FORMAT.md](docs/RUN_FORMAT.md) for full schema details.

## Supported Agents

| Agent | Status | Notes |
| --- | --- | --- |
| Shell | Working | Any command — transcript, exit code, git state, diff. |
| Claude Code CLI | Automatic | Stop hook fires when any session ends. |
| Claude Code Desktop | Automatic | Same Stop hook — Desktop reads `~/.claude/settings.json`. |
| Codex CLI | Automatic | Shell shim installed by `tt install` wraps `codex exec` transparently. |
| Codex Desktop | Automatic (macOS) | LaunchAgent polls `~/.codex/logs_2.sqlite` every 30 s for completed sessions. |
| VS Code / IDE plugins | Planned | Needs a dedicated integration. |

**Claude Code** (auto-detected when running `claude`):

```bash
# Tokens + cost captured from the result event
tt run -- claude --output-format json -p "your prompt"

# Also captures individual Bash and file tool calls
tt run -- claude --output-format stream-json -p "your prompt"
```

**Codex:**

```bash
tt run -- codex exec --json "your prompt"
```

Codex runs are not automatic yet. If Codex is started from the desktop app, VS Code, or directly as `codex exec ...` without `tt run`, TokenTrace will not record that session today.

**Any shell command** (no token usage, but transcript + git diff still recorded):

```bash
tt run -- npm test
tt run -- ./scripts/deploy.sh
```

## Trust Warnings

Reports flag runs that deserve a second look:

- no token usage captured
- git metadata unavailable
- files changed with no recorded verification command
- non-zero exit code

Warnings are conservative — they prompt inspection, not rejection.

## Principles

- **Local first** — traces stay on your machine unless you share them.
- **Agent neutral** — the format works across tools.
- **Portable** — plain JSON, JSONL, Markdown, HTML, and patch files.
- **Honest** — failed runs still produce artifacts.
- **Small core** — adapters add intelligence without coupling the recorder to any one agent.

## Development

```bash
npm run check   # runs tests + npm pack --dry-run
tt run -- node -e "console.log('sample')"
tt summarize
```

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) and
keep new features grounded in portable traces rather than hosted assumptions.

## License

MIT
