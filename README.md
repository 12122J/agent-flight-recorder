# Agent Flight Recorder

Open telemetry for coding-agent runs.

Agent Flight Recorder (`afr`) wraps coding agents and shell commands, then writes
a local trace you can inspect, share, diff, or attach to an issue. It is built
for developers who want to know what an agent did before they trust the result.

```bash
node bin/afr.mjs run -- codex exec --json "explain this repo"
node bin/afr.mjs summarize
node bin/afr.mjs report .afr/runs/<run-id>
```

## Why

Coding agents are becoming normal development tools, but most runs still vanish
into terminal scrollback. Agent Flight Recorder turns a run into an auditable
artifact:

- what command ran
- what it printed
- what changed in git
- what token usage was reported
- what trust warnings should be reviewed

The trace is local by default. No hosted service is required.

## Status

This project is early. The current release is a working MVP with:

- generic shell-command recording
- Codex JSON token-usage parsing
- git state and patch capture, including untracked text files
- static Markdown and HTML reports
- zero runtime dependencies

## Install

Until the package is published, run it from a checkout:

```bash
git clone https://github.com/12122J/agent-flight-recorder.git
cd agent-flight-recorder
npm test
node bin/afr.mjs --help
```

When installed globally from npm in the future, the same commands will use
`afr` directly:

```bash
afr run -- node -e "console.log('hello from afr')"
```

## Try It in 30 Seconds

Clone, run one command, and see what gets recorded:

```bash
git clone https://github.com/12122J/agent-flight-recorder.git
cd agent-flight-recorder
node bin/afr.mjs run -- node -e "console.log('hello from afr')"
```

Terminal output:

```
hello from afr
Recorded run: .afr/runs/2026-05-24T075338439Z-0a37d9
```

Check the log summary:

```bash
node bin/afr.mjs summarize
```

```
2026-05-24T075338439Z-0a37d9   ok   tokens=-   changed=0   node -e console.log('hello from afr')
```

Open the full report:

```bash
open .afr/runs/2026-05-24T075338439Z-0a37d9/report.html
# or on Linux: xdg-open .afr/runs/*/report.html
```

The Markdown summary in `.afr/runs/<run-id>/summary.md` looks like:

```markdown
# Agent Flight Recorder Run

**Command**: `node -e console.log('hello from afr')`
**Duration**: 63ms
**Exit Code**: 0
**Total Tokens**: unknown
**Files Changed**: 0

## Warnings
- No token usage captured: This agent or command did not expose structured token usage.

## Artifacts
- Events: events.jsonl
- Transcript: transcript.txt
- Diff: diff.patch
- HTML Report: report.html
```

For a real agent run with token usage, use the Codex adapter:

```bash
node bin/afr.mjs run --agent codex -- codex exec --json "summarize this repository"
node bin/afr.mjs summarize
# Total Tokens will now be populated from the structured JSON output
```

## Quick Start

## Artifacts

Each run writes:

```text
.afr/runs/<run-id>/
  run.json        # stable metadata and aggregate observations
  events.jsonl    # chronological event stream
  transcript.txt  # stdout and stderr transcript
  diff.patch      # git patch captured after the run
  summary.md      # compact human-readable summary
  report.html     # standalone local report
```

See [docs/RUN_FORMAT.md](docs/RUN_FORMAT.md) for schema details and
[docs/EXAMPLES.md](docs/EXAMPLES.md) for example workflows.

## Trust Warnings

Reports call out conditions that deserve review:

- no token usage captured
- git metadata unavailable
- changed files with no recorded verification command
- non-zero command exit

Warnings are intentionally conservative. They are prompts to inspect, not proof
that a run is bad.

## Supported Adapters

| Adapter | Status | Notes |
| --- | --- | --- |
| Shell | Working | Records any command's transcript, exit code, git state, and diff. |
| Codex | Working | Parses `turn.completed` usage from JSON output. |
| Claude Code | Working | Parses `result` and `assistant` events from `--output-format json` / `stream-json`. |

**Claude Code usage:**

```bash
# Single-turn, flat JSON result (tokens + cost in one line)
node bin/afr.mjs run -- claude --output-format json -p "summarize this repository"

# Streaming JSON — also captures individual Bash and file tool calls
node bin/afr.mjs run -- claude --output-format stream-json -p "explain this repo"

# Check the recorded totals
node bin/afr.mjs summarize
```

The adapter auto-detects `claude` as the executable — no `--agent` flag needed.

## Development

```bash
npm run check
node bin/afr.mjs run -- node -e "console.log('sample')"
node bin/afr.mjs summarize
```

`npm run check` runs the test suite and `npm pack --dry-run` to verify the
package contents.

## Principles

- Local first: traces stay on your machine unless you share them.
- Agent neutral: the core format should work across tools.
- Portable: artifacts are plain JSON, JSONL, Markdown, HTML, and patch files.
- Honest: failed runs still produce artifacts.
- Small core: adapters add intelligence without making the recorder agent-specific.

## Contributing

Contributions are welcome once the project is public. Start with
[CONTRIBUTING.md](CONTRIBUTING.md), and please keep new features grounded in
portable traces rather than hosted assumptions.

## License

MIT
