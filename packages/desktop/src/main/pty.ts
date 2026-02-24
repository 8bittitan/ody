import type { BrowserWindow } from 'electron';
import type * as pty from 'node-pty';

export class PtySession {
  private term: pty.IPty | null = null;

  isRunning() {
    return this.term !== null;
  }

  async start(win: BrowserWindow, cmd: string[], cwd: string) {
    const [bin, ...args] = cmd;

    if (!bin) {
      throw new Error('Cannot start PTY session: command is empty');
    }

    const ptyModule = await import('node-pty');

    this.kill();
    this.term = ptyModule.spawn(bin, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env: process.env,
    });

    this.term.onData((data) => {
      win.webContents.send('agent:output', data);
    });

    this.term.onExit(() => {
      this.term = null;
      win.webContents.send('agent:stopped');
    });
  }

  write(data: string) {
    if (!this.term || data.length === 0) {
      return;
    }

    this.term.write(data);
  }

  resize(cols: number, rows: number) {
    if (!this.term || cols <= 0 || rows <= 0) {
      return;
    }

    this.term.resize(cols, rows);
  }

  kill() {
    if (!this.term) {
      return;
    }

    this.term.kill();
    this.term = null;
  }
}
