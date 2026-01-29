type AvailableBackend = {
  label: string;
  value: string;
};

export const getAvailableBackends = (): AvailableBackend[] => {
  let backends: AvailableBackend[] = [];

  if (Bun.which('opencode')) {
    backends.push({
      label: 'OpenCode',
      value: 'opencode',
    });
  }

  if (Bun.which('claude')) {
    backends.push({
      label: 'Claude Code',
      value: 'claude',
    });
  }

  if (Bun.which('codex')) {
    backends.push({
      label: 'Codex',
      value: 'codex',
    });
  }

  return backends;
};
