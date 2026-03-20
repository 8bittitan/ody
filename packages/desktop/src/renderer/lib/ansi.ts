const COLOR_MAP: Record<number, string> = {
  30: 'var(--muted-foreground)',
  31: 'var(--red)',
  32: 'var(--green)',
  33: 'var(--amber)',
  34: 'var(--primary)',
  35: 'var(--primary)',
  36: 'var(--primary)',
  37: 'var(--foreground)',
  90: 'var(--muted-foreground)',
  91: 'var(--red)',
  92: 'var(--green)',
  93: 'var(--amber)',
  94: 'var(--primary)',
  95: 'var(--primary)',
  96: 'var(--primary)',
  97: 'var(--foreground)',
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export type AnsiRenderState = {
  currentColor: string | null;
  currentBold: boolean;
  pendingEscape: string;
};

const appendSegment = (segment: string, state: AnsiRenderState) => {
  if (segment.length === 0) {
    return '';
  }

  const styles: string[] = [];

  if (state.currentColor) {
    styles.push(`color:${state.currentColor}`);
  }

  if (state.currentBold) {
    styles.push('font-weight:600');
  }

  const escaped = escapeHtml(segment);
  if (styles.length === 0) {
    return escaped;
  }

  return `<span style="${styles.join(';')}">${escaped}</span>`;
};

export const createAnsiRenderState = (): AnsiRenderState => ({
  currentColor: null,
  currentBold: false,
  pendingEscape: '',
});

const applyCodes = (codes: number[], state: AnsiRenderState) => {
  if (codes.length === 0) {
    state.currentColor = null;
    state.currentBold = false;
    return;
  }

  for (const code of codes) {
    if (code === 0) {
      state.currentColor = null;
      state.currentBold = false;
      continue;
    }

    if (code === 1) {
      state.currentBold = true;
      continue;
    }

    if (code === 22) {
      state.currentBold = false;
      continue;
    }

    if (code === 39) {
      state.currentColor = null;
      continue;
    }

    const mapped = COLOR_MAP[code];
    if (mapped) {
      state.currentColor = mapped;
    }
  }
};

export const appendAnsiHtml = (content: string, previousState = createAnsiRenderState()) => {
  const source = `${previousState.pendingEscape}${content}`;
  const state: AnsiRenderState = {
    currentColor: previousState.currentColor,
    currentBold: previousState.currentBold,
    pendingEscape: '',
  };
  let html = '';
  let cursor = 0;

  while (cursor < source.length) {
    const escapeIndex = source.indexOf('\u001b', cursor);

    if (escapeIndex === -1) {
      html += appendSegment(source.slice(cursor), state);
      break;
    }

    html += appendSegment(source.slice(cursor, escapeIndex), state);

    if (source[escapeIndex + 1] !== '[') {
      html += appendSegment(source[escapeIndex], state);
      cursor = escapeIndex + 1;
      continue;
    }

    const endIndex = source.indexOf('m', escapeIndex + 2);
    if (endIndex === -1) {
      state.pendingEscape = source.slice(escapeIndex);
      break;
    }

    const codes = source
      .slice(escapeIndex + 2, endIndex)
      .split(';')
      .map((code) => Number.parseInt(code, 10))
      .filter((code) => !Number.isNaN(code));

    applyCodes(codes, state);
    cursor = endIndex + 1;
  }

  return { html, state };
};

/** Convert a string containing ANSI escape sequences into styled HTML. */
export const toAnsiHtml = (content: string) => appendAnsiHtml(content).html;

/** Strip all ANSI escape sequences, returning plain text. */
// eslint-disable-next-line no-control-regex
export const stripAnsi = (content: string) => content.replaceAll(/\u001b\[[0-9;]*m/g, '');
