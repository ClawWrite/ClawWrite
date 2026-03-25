import { contextBridge, ipcRenderer } from 'electron';
import type { AnyPreset } from '../main/gemini.js';
import type { HistoryEntry } from '../main/settings.js';

contextBridge.exposeInMainWorld('clawwrite', {
  // Initialization
  getPresets: (): Promise<AnyPreset[]> =>
    ipcRenderer.invoke('get-presets'),

  getHistory: (): Promise<HistoryEntry[]> =>
    ipcRenderer.invoke('get-history'),

  // Core action
  rewrite: (text: string, instruction: string, presetId: string | null): Promise<{
    success: boolean;
    result?: string;
    error?: string;
  }> => ipcRenderer.invoke('rewrite', text, instruction, presetId),

  // Result delivery
  copyResult: (text: string): Promise<boolean> =>
    ipcRenderer.invoke('copy-result', text),

  replaceText: (text: string): Promise<boolean> =>
    ipcRenderer.invoke('replace-text', text),

  // Popup lifecycle
  closePopup: (): void => { ipcRenderer.invoke('close-popup'); },
  recaptureText: (): Promise<boolean> => ipcRenderer.invoke('recapture-text'),

  // Settings
  setApiKey: (key: string): Promise<boolean> =>
    ipcRenderer.invoke('set-api-key', key),

  toggleClipboardMonitor: (): Promise<boolean> =>
    ipcRenderer.invoke('toggle-clipboard-monitor'),

  // Custom presets
  addCustomPreset: (preset: { label: string; prompt: string }): Promise<AnyPreset[]> =>
    ipcRenderer.invoke('add-custom-preset', preset),

  deleteCustomPreset: (id: string): Promise<AnyPreset[]> =>
    ipcRenderer.invoke('delete-custom-preset', id),

  // MOM Customization
  setMomPrompt: (prompt: string): Promise<boolean> =>
    ipcRenderer.invoke('set-mom-prompt', prompt),

  getMomPrompt: (): Promise<string> =>
    ipcRenderer.invoke('get-mom-prompt'),

  // Main → Renderer events
  onInitText: (cb: (text: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, text: string): void => cb(text);
    ipcRenderer.on('init-text', handler);
    return () => { ipcRenderer.removeListener('init-text', handler); };
  },
});

// TypeScript declaration for renderer
declare global {
  interface Window {
    clawwrite: {
      getPresets: () => Promise<AnyPreset[]>;
      getHistory: () => Promise<HistoryEntry[]>;
      rewrite: (text: string, instruction: string, presetId: string | null) => Promise<{
        success: boolean;
        result?: string;
        error?: string;
      }>;
      copyResult: (text: string) => Promise<boolean>;
      replaceText: (text: string) => Promise<boolean>;
      closePopup: () => void;
      recaptureText: () => Promise<boolean>;
      setApiKey: (key: string) => Promise<boolean>;
      toggleClipboardMonitor: () => Promise<boolean>;
      addCustomPreset: (preset: { label: string; prompt: string }) => Promise<AnyPreset[]>;
      deleteCustomPreset: (id: string) => Promise<AnyPreset[]>;
      deleteHistoryEntry: (id: string) => Promise<boolean>;
      setMomPrompt: (prompt: string) => Promise<boolean>;
      getMomPrompt: () => Promise<string>;
      onInitText: (cb: (text: string) => void) => () => void;
    };
  }
}
