import { clipboard } from 'electron';
import { EventEmitter } from 'events';

export class ClipboardMonitor extends EventEmitter {
  private lastText = '';
  private interval: NodeJS.Timeout | null = null;
  private readonly POLL_MS = 600;
  private readonly MIN_LENGTH = 15;  // ignore tiny clips (passwords, codes, etc.)
  private readonly MAX_LENGTH = 8000; // ignore massive clipboard dumps

  start(): void {
    if (this.interval) return;
    // Seed with current clipboard so we don't fire immediately on start
    this.lastText = clipboard.readText().trim();
    this.interval = setInterval(() => this.check(), this.POLL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  isRunning(): boolean {
    return this.interval !== null;
  }

  // Called after a Replace action — update the seed so we don't
  // re-trigger on the result text we just pasted back.
  updateLastSeen(text: string): void {
    this.lastText = text.trim();
  }

  private check(): void {
    const current = clipboard.readText().trim();
    if (
      current &&
      current !== this.lastText &&
      current.length >= this.MIN_LENGTH &&
      current.length <= this.MAX_LENGTH
    ) {
      this.lastText = current;
      this.emit('new-text', current);
    }
  }
}

export const clipboardMonitor = new ClipboardMonitor();
