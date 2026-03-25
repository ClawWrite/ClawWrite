import Store from 'electron-store';
import * as dotenv from 'dotenv';
import path from 'path';
import { app } from 'electron';

// Load .env — works in both dev (project root) and production (app resources dir)
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

export interface CustomPreset {
  id: string;       // nanoid — e.g. "abc123"
  label: string;    // shown on button — e.g. "MSP Ticket Note"
  prompt: string;   // full instruction sent to Gemini
}

export interface HistoryEntry {
  id: string;
  sourceText: string;       // original selected text (first 200 chars stored)
  instruction: string;      // what was asked
  result: string;           // AI output
  timestamp: string;        // ISO string
  presetId: string | null;  // null if custom prompt
}

export interface Settings {
  clipboardMonitorEnabled: boolean;
  hotkey: string;
  geminiModel: string;
  geminiApiKey: string;       // overrides .env if set by user in settings UI
  customPresets: CustomPreset[];
  history: HistoryEntry[];
  autoStartEnabled: boolean;
  popupOpacity: number;       // 0.88–1.0 — user preference
  maxHistoryEntries: number;
  momOverridePrompt: string;
}

export const store = new Store<Settings>({
  name: 'clawwrite-settings',
  defaults: {
    clipboardMonitorEnabled: false,
    hotkey: 'CommandOrControl+Shift+Space',
    geminiModel: 'gemini-3-flash-preview',
    geminiApiKey: '',
    customPresets: [],
    history: [],
    autoStartEnabled: false,
    popupOpacity: 0.96,
    maxHistoryEntries: 20,
    momOverridePrompt: '',
  }
});

// API key resolution order: electron-store (user set) → .env → empty string
export function getApiKey(): string {
  return store.get('geminiApiKey') || process.env.GEMINI_API_KEY || '';
}
