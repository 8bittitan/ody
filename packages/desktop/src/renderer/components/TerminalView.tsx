import { api } from '@/lib/api';
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

import 'xterm/css/xterm.css';

type TerminalViewProps = {
  initialOutput: string;
};

export const TerminalView = ({ initialOutput }: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const styles = getComputedStyle(document.documentElement);
    const color = (name: string, fallback: string) =>
      styles.getPropertyValue(name).trim() || fallback;

    const fitAddon = new FitAddon();
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      lineHeight: 1.3,
      theme: {
        background: color('--panel', '#141520'),
        foreground: color('--light', '#c4c6d6'),
        cursor: color('--primary', '#00f5d4'),
        cursorAccent: color('--panel', '#141520'),
        selectionBackground: color('--accent-bg', 'rgba(0, 245, 212, 0.15)'),
        black: color('--background', '#0d0e14'),
        red: color('--red', '#f87171'),
        green: color('--green', '#4ade80'),
        yellow: color('--amber', '#f5a623'),
        blue: color('--blue', '#60a5fa'),
        magenta: color('--primary', '#00f5d4'),
        cyan: color('--primary', '#00f5d4'),
        white: color('--light', '#c4c6d6'),
        brightBlack: color('--dim', '#6b6d84'),
        brightRed: color('--red', '#f87171'),
        brightGreen: color('--green', '#4ade80'),
        brightYellow: color('--amber', '#f5a623'),
        brightBlue: color('--blue', '#60a5fa'),
        brightMagenta: color('--accent-hover', '#33f7de'),
        brightCyan: color('--accent-hover', '#33f7de'),
        brightWhite: color('--bright', '#e8e9f0'),
      },
    });

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(container);

    fitAddon.fit();
    void api.pty.resize({ cols: terminal.cols, rows: terminal.rows });

    if (initialOutput.length > 0) {
      terminal.write(initialOutput);
    }

    const onDataDispose = terminal.onData((data) => {
      void api.pty.input(data);
    });

    const unbindOutput = api.agent.onOutput((chunk) => {
      terminal.write(chunk);
    });

    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      void api.pty.resize({ cols: terminal.cols, rows: terminal.rows });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      unbindOutput();
      onDataDispose.dispose();
      terminal.dispose();
    };
  }, [initialOutput]);

  return <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-3" />;
};
