export function parseClaudeCodeJsonLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try { return JSON.parse(trimmed); } catch { return null; }
}

export function observeClaudeCodeLine(line) {
  const payload = parseClaudeCodeJsonLine(line);
  if (!payload) return [];

  const observations = [];

  if (payload.type === 'result') {
    const u = payload.usage ?? {};
    const input = numberOrZero(u.input_tokens);
    const cachedRead = numberOrZero(u.cache_read_input_tokens);
    const cachedCreate = numberOrZero(u.cache_creation_input_tokens);
    const output = numberOrZero(u.output_tokens);
    const total = input + cachedRead + cachedCreate + output;

    if (total > 0) {
      observations.push({
        type: 'usage.tokens',
        input_tokens: input,
        cached_input_tokens: cachedRead + cachedCreate,
        output_tokens: output,
        reasoning_output_tokens: 0,
        total_tokens: total
      });
    }
    const cost = payload.total_cost_usd ?? payload.cost_usd;
    if (typeof cost === 'number') {
      observations.push({ type: 'usage.cost', cost_usd: cost });
    }
    if (typeof payload.num_turns === 'number') {
      observations.push({
        type: 'session.turns',
        num_turns: payload.num_turns,
        session_id: payload.session_id ?? null
      });
    }
  }

  // stream-json tool_use blocks inside assistant messages
  if (payload.type === 'assistant' && Array.isArray(payload.message?.content)) {
    for (const block of payload.message.content) {
      if (block.type !== 'tool_use') continue;
      if (block.name === 'Bash') {
        observations.push({
          type: 'tool.command',
          command: block.input?.command ?? '',
          exit_code: null
        });
      } else if (block.name === 'Read' || block.name === 'Write' || block.name === 'Edit') {
        observations.push({
          type: 'file.read',
          path: block.input?.file_path ?? block.input?.path ?? '',
          bytes: null
        });
      }
    }
  }

  return observations;
}

function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
