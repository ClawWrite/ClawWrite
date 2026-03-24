import { store } from './settings.js';
import type { HistoryEntry } from './settings.js';

const MAX_SOURCE_PREVIEW = 200;

export function addHistoryEntry(
  sourceText: string,
  instruction: string,
  result: string,
  presetId: string | null
): void {
  const entry: HistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sourceText: sourceText.slice(0, MAX_SOURCE_PREVIEW),
    instruction,
    result,
    timestamp: new Date().toISOString(),
    presetId,
  };

  const history = store.get('history');
  const maxEntries = store.get('maxHistoryEntries');
  const updated = [entry, ...history].slice(0, maxEntries);
  store.set('history', updated);
}

export function getHistory(): HistoryEntry[] {
  return store.get('history');
}

export function clearHistory(): void {
  store.set('history', []);
}

export function deleteHistoryEntry(id: string): void {
  store.set('history', store.get('history').filter(e => e.id !== id));
}
