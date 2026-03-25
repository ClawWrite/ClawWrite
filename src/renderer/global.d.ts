import type { AnyPreset } from '../main/gemini.js';
import type { HistoryEntry } from '../main/settings.js';

declare global {
  interface Window {
    clawwrite: {
      // Initialization
      getPresets: () => Promise<AnyPreset[]>;
      getHistory: () => Promise<HistoryEntry[]>;

      // Core action
      rewrite: (text: string, instruction: string, presetId: string | null) => Promise<{
        success: boolean;
        result?: string;
        error?: string;
      }>;

      // Result delivery
      copyResult: (text: string) => Promise<boolean>;
      replaceText: (text: string) => Promise<boolean>;

      // Popup lifecycle
      closePopup: () => void;
      recaptureText: () => Promise<boolean>;

      // Settings
      setApiKey: (key: string) => Promise<boolean>;
      toggleClipboardMonitor: () => Promise<boolean>;

      // Custom presets
      addCustomPreset: (preset: { label: string; prompt: string }) => Promise<AnyPreset[]>;
      deleteCustomPreset: (id: string) => Promise<AnyPreset[]>;

      // History
      deleteHistoryEntry: (id: string) => Promise<boolean>;
      getMomPrompt: () => Promise<string>;
      setMomPrompt: (prompt: string) => Promise<boolean>;

      // Events
      onInitText: (cb: (text: string) => void) => () => void;
    };
  }
}
