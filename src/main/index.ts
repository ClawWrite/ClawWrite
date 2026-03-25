import {
  app, Tray, Menu, nativeImage, ipcMain, clipboard, shell
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { store, getApiKey } from './settings.js';
import { rewriteText, getAllPresets, DEFAULT_MOM_PROMPT } from './gemini.js';
import { clipboardMonitor } from './clipboard-monitor.js';
import { registerHotkey, unregisterHotkey } from './hotkey.js';
import { initPopup, createAndShowPopup, destroyPopup, hidePopup } from './popup-window.js';
import { recordPreviousWindow, autoReplace, recaptureFromWindow } from './paste.js';
import { addHistoryEntry, getHistory, clearHistory, deleteHistoryEntry } from './history.js';
import { setAutoStart, getAutoStartEnabled } from './startup.js';
import { sendMOMEmail } from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;

// ─────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Single instance lock — prevent multiple ClawWrite processes
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  if (!getApiKey()) {
    console.warn('[ClawWrite] No Gemini API key found — rewrites will fail until one is set.');
  }

  // Migrate old model name if encountered
  const currentModel = store.get('geminiModel');
  if (currentModel === 'gemini-2.0-flash' || currentModel === 'gemini-2.5-flash') {
    store.set('geminiModel', 'gemini-3-flash-preview');
  }

  setupTray();
  initPopup();
  registerHotkey();
  setupIPC();
  setupClipboardMonitor();
});

app.on('will-quit', () => {
  unregisterHotkey();
  clipboardMonitor.stop();
  tray?.destroy();
});

// Keep app running when all windows are closed (tray app behaviour)
app.on('window-all-closed', (e: Event) => e.preventDefault());

// Second instance opened — show tray menu instead
app.on('second-instance', () => {
  tray?.popUpContextMenu();
});

// ─────────────────────────────────────────────────────────────
// Tray setup
// ─────────────────────────────────────────────────────────────

function setupTray(): void {
  const iconPath = path.join(__dirname, '../../resources/tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('ClawWrite — AI Writing Assistant\nCtrl+Shift+Space to use');
  tray.on('double-click', () => tray?.popUpContextMenu());
  refreshTrayMenu();
}

function refreshTrayMenu(): void {
  const monitorEnabled = store.get('clipboardMonitorEnabled');
  const autoStart = getAutoStartEnabled();
  const hotkeyLabel = store.get('hotkey').replace('CommandOrControl', 'Ctrl');
  const hasApiKey = !!getApiKey();

  const menu = Menu.buildFromTemplate([
    { label: 'ClawWrite', enabled: false },
    { label: `Hotkey: ${hotkeyLabel}`, enabled: false },
    { label: hasApiKey ? '● API Key: configured' : '⚠ API Key: missing', enabled: false },
    { type: 'separator' },
    {
      label: `Clipboard Monitor: ${monitorEnabled ? 'ON ✓' : 'OFF'}`,
      toolTip: 'Auto-show popup whenever you copy text',
      click: () => {
        const next = !store.get('clipboardMonitorEnabled');
        store.set('clipboardMonitorEnabled', next);
        next ? clipboardMonitor.start() : clipboardMonitor.stop();
        refreshTrayMenu();
      }
    },
    {
      label: `Start with Windows: ${autoStart ? 'ON ✓' : 'OFF'}`,
      click: () => {
        setAutoStart(!autoStart);
        refreshTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Open Settings…',
      click: () => {
        // Future: open a dedicated settings window
        // For now, open the .env file location in Explorer
        shell.showItemInFolder(path.join(process.cwd(), '.env'));
      }
    },
    {
      label: 'Clear History',
      click: () => { clearHistory(); }
    },
    { type: 'separator' },
    { label: 'Quit ClawWrite', click: () => app.exit(0) }
  ]);

  tray!.setContextMenu(menu);
}

// ─────────────────────────────────────────────────────────────
// Clipboard monitor wiring
// ─────────────────────────────────────────────────────────────

function setupClipboardMonitor(): void {
  if (store.get('clipboardMonitorEnabled')) {
    clipboardMonitor.start();
  }

  clipboardMonitor.on('new-text', async (text: string) => {
    await recordPreviousWindow();
    createAndShowPopup(text);
  });
}

// ─────────────────────────────────────────────────────────────
// IPC handlers — all communication between renderer and main
// ─────────────────────────────────────────────────────────────

function setupIPC(): void {
  // Renderer requests initial data on mount
  ipcMain.handle('get-presets', () => getAllPresets());
  ipcMain.handle('get-history', () => getHistory());

  // Renderer requests a rewrite
  ipcMain.handle('rewrite', async (_, sourceText: string, instruction: string, presetId: string | null) => {
    try {
      const result = await rewriteText(sourceText, instruction);
      
      // If this was a "Minutes of Meeting" request, email it automatically
      if (presetId === 'mom') {
        sendMOMEmail(result).catch(err => {
          console.error('[MOM-Email] Background delivery failed:', err);
        });
      }

      // Save to history in background — don't await
      addHistoryEntry(sourceText, instruction, result, presetId);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message ?? 'Unknown error' };
    }
  });

  // Copy result to clipboard only (no paste)
  ipcMain.handle('copy-result', (_, text: string) => {
    clipboard.writeText(text);
    clipboardMonitor.updateLastSeen(text); // prevent re-triggering
    return true;
  });

  // Auto-paste result back into the originating app
  ipcMain.handle('replace-text', async (_, text: string) => {
    clipboardMonitor.updateLastSeen(text); // prevent re-triggering
    destroyPopup(); // destroy popup first so focus returns to previous app
    await new Promise(r => setTimeout(r, 100)); // let popup close
    try {
      await autoReplace(text);
    } catch (err) {
      console.error('[Replace] Error during auto-replace:', err);
    }
    return true;
  });

  // Renderer signals it wants to close
  ipcMain.handle('close-popup', () => {
    destroyPopup();
  });

  // Recapture: hide popup, focus the original app, send Ctrl+C, show popup with new text
  ipcMain.handle('recapture-text', async () => {
    hidePopup();
    const { text } = await recaptureFromWindow();
    createAndShowPopup(text || '', true);
    return true;
  });

  // History management
  ipcMain.handle('delete-history-entry', (_, id: string) => {
    deleteHistoryEntry(id);
    return true;
  });

  // Settings — API key update from UI
  ipcMain.handle('set-api-key', (_, key: string) => {
    store.set('geminiApiKey', key.trim());
    refreshTrayMenu();
    return true;
  });

  // Settings — toggle clipboard monitor from UI
  ipcMain.handle('toggle-clipboard-monitor', () => {
    const next = !store.get('clipboardMonitorEnabled');
    store.set('clipboardMonitorEnabled', next);
    next ? clipboardMonitor.start() : clipboardMonitor.stop();
    refreshTrayMenu();
    return next;
  });

  // Custom presets
  ipcMain.handle('add-custom-preset', (_, preset: { label: string; prompt: string }) => {
    const newPreset = {
      id: `custom_${Date.now()}`,
      label: preset.label.slice(0, 30),
      prompt: preset.prompt.slice(0, 500),
    };
    const presets = store.get('customPresets');
    store.set('customPresets', [...presets, newPreset]);
    return getAllPresets();
  });

  ipcMain.handle('delete-custom-preset', (_, id: string) => {
    store.set('customPresets', store.get('customPresets').filter(p => p.id !== id));
    return getAllPresets();
  });

  // MOM Prompt Customization
  ipcMain.handle('get-mom-prompt', () => {
    return store.get('momOverridePrompt') || DEFAULT_MOM_PROMPT;
  });

  ipcMain.handle('set-mom-prompt', (_, prompt: string) => {
    store.set('momOverridePrompt', prompt);
    return true;
  });
}
