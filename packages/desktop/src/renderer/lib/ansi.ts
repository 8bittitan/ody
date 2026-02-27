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

/** Convert a string containing ANSI escape sequences into styled HTML. */
export const toAnsiHtml = (content: string) => {
  const pattern = new RegExp(String.raw`\u001b\[([0-9;]+)m`, 'g');
  let cursor = 0;
  let currentColor: string | null = null;
  let currentBold = false;
  let html = '';

  const appendSegment = (segment: string) => {
    if (segment.length === 0) {
      return;
    }

    const styles: string[] = [];

    if (currentColor) {
      styles.push(`color:${currentColor}`);
    }

    if (currentBold) {
      styles.push('font-weight:600');
    }

    const escaped = escapeHtml(segment);
    if (styles.length === 0) {
      html += escaped;
      return;
    }

    html += `<span style="${styles.join(';')}">${escaped}</span>`;
  };

  let match = pattern.exec(content);
  while (match) {
    const segment = content.slice(cursor, match.index);
    appendSegment(segment);

    const codes = (match[1] ?? '')
      .split(';')
      .map((code) => Number.parseInt(code, 10))
      .filter((code) => !Number.isNaN(code));

    if (codes.length === 0) {
      currentColor = null;
      currentBold = false;
    }

    for (const code of codes) {
      if (code === 0) {
        currentColor = null;
        currentBold = false;
        continue;
      }

      if (code === 1) {
        currentBold = true;
        continue;
      }

      if (code === 22) {
        currentBold = false;
        continue;
      }

      if (code === 39) {
        currentColor = null;
        continue;
      }

      const mapped = COLOR_MAP[code];
      if (mapped) {
        currentColor = mapped;
      }
    }

    cursor = match.index + match[0].length;
    match = pattern.exec(content);
  }

  appendSegment(content.slice(cursor));

  return html;
};

/** Strip all ANSI escape sequences, returning plain text. */
// eslint-disable-next-line no-control-regex
export const stripAnsi = (content: string) => content.replaceAll(/\u001b\[[0-9;]*m/g, '');
