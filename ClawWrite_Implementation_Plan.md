# ClawWrite — Complete Implementation Plan
## System-Wide AI Writing Assistant for Windows

> **Handoff Document** — This plan is complete and self-contained. Build each phase in order, run the TypeScript check after every phase, and follow the constraints at the bottom without deviation.

---

## What Is ClawWrite?

ClawWrite is a lightweight Windows tray application that brings AI-powered writing assistance to every text field on the system — not just browsers or Office apps. The user selects text anywhere, presses a hotkey (or copies to clipboard), and a floating popup appears with one-click rewrite actions and a custom prompt field. The result can be copied or pasted back into the originating app automatically.

**Design philosophy:** Invisible until needed. Zero friction. Works in every app.

---

## Key Design Decisions

| Decision | Answer |
|---|---|
| Platform | Windows 11 (primary), Windows 10 compatible |
| Framework | Electron + React + TypeScript via `electron-vite` |
| AI backend | Google Gemini API — direct call from Electron main process |
| Trigger methods | Global hotkey (`Ctrl+Shift+Space`) + optional clipboard monitor toggle |
| Minimum text length to trigger | 10 characters (hotkey), 15 characters (clipboard monitor) |
| Popup position | Near mouse cursor, constrained to screen bounds |
| Result delivery | Show in editable popup with Copy button and Replace (auto-paste) button |
| Persistence | `electron-store` for settings, no database |
| Auto-start | Optional Windows startup shortcut (user opt-in from tray menu) |
| Distribution | Standalone `.exe` installer via `electron-builder` |
| API key storage | `.env` file in app root (dev), electron-store encrypted (production) |
| Gemini model | `gemini-2.5-flash` (fast, cheap, sufficient for rewrites) |
| Window style | Frameless, transparent background, rounded corners, always-on-top |
| Max popup height | 540px — scrollable result area if content is long |
| Custom presets | User can add/remove presets from tray menu settings panel |
| History | Last 20 rewrites stored in electron-store, accessible from tray |

---

## Project Structure

```
ClawWrite/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .env                              # GEMINI_API_KEY=...
├── .gitignore
├── README.md
├── resources/
│   ├── tray-icon.png                 # 16x16 PNG — white/light claw or sparkle icon
│   ├── tray-icon@2x.png              # 32x32 for high-DPI
│   └── icon.ico                      # App icon for installer (256x256)
├── scripts/
│   └── create-startup-shortcut.ps1  # PowerShell to add to Windows startup
└── src/
    ├── main/
    │   ├── index.ts                  # Entry point — app lifecycle, tray, IPC wiring
    │   ├── hotkey.ts                 # Global shortcut registration + text capture
    │   ├── clipboard-monitor.ts      # Polling-based clipboard watcher
    │   ├── popup-window.ts           # Frameless BrowserWindow creation + positioning
    │   ├── gemini.ts                 # Gemini API calls + preset definitions
    │   ├── paste.ts                  # Auto-paste via PowerShell + window focus restore
    │   ├── settings.ts               # electron-store schema + defaults + .env loader
    │   ├── history.ts                # Rewrite history management (last 20)
    │   └── startup.ts                # Windows startup shortcut management
    ├── preload/
    │   └── index.ts                  # contextBridge — exposes safe IPC to renderer
    └── renderer/
        ├── index.html
        ├── main.tsx                  # React root
        ├── App.tsx                   # Popup UI — all phases rendered here
        ├── components/
        │   ├── Header.tsx            # Drag region + logo + close button
        │   ├── SourcePreview.tsx     # Selected text preview (truncated)
        │   ├── PresetGrid.tsx        # 8 preset action buttons
        │   ├── CustomPromptRow.tsx   # Free-form instruction input
        │   ├── ResultView.tsx        # Editable result + Copy/Replace buttons
        │   └── LoadingSpinner.tsx    # Animated dots while waiting for Gemini
        └── index.css                 # Full design system
```

---

## Phase 1 — Project Bootstrap

### Prerequisites

```bash
node --version   # must be v20+
npm --version    # must be v9+
```

### `package.json`

```json
{
  "name": "clawwrite",
  "version": "1.0.0",
  "description": "System-wide AI writing assistant for Windows",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron .",
    "dist": "npm run build && electron-builder",
    "dist:dir": "npm run build && electron-builder --dir"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "electron-store": "^8.2.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "electron": "^29.0.0",
    "electron-vite": "^2.3.0",
    "electron-builder": "^24.9.0",
    "@vitejs/plugin-react": "^4.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  },
  "build": {
    "appId": "com.clawwrite.app",
    "productName": "ClawWrite",
    "icon": "resources/icon.ico",
    "win": {
      "target": [{ "target": "nsis", "arch": ["x64"] }],
      "requestedExecutionLevel": "asInvoker"
    },
    "nsis": {
      "oneClick": true,
      "installerIcon": "resources/icon.ico",
      "uninstallerIcon": "resources/icon.ico",
      "deleteAppDataOnUninstall": false
    },
    "files": ["dist/**/*", "resources/**/*", ".env"],
    "extraResources": [{ "from": "resources", "to": "resources" }]
  }
}
```

### `electron.vite.config.ts`

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      lib: { entry: resolve(__dirname, 'src/main/index.ts') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      lib: { entry: resolve(__dirname, 'src/preload/index.ts') }
    }
  },
  renderer: {
    plugins: [react()],
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') }
      }
    }
  }
});
```

### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist/main",
    "baseUrl": ".",
    "paths": { "@main/*": ["src/main/*"] }
  },
  "include": ["src/main/**/*", "src/preload/**/*"]
}
```

### `tsconfig.web.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@renderer/*": ["src/renderer/*"] }
  },
  "include": ["src/renderer/**/*"]
}
```

### `.env`

```env
GEMINI_API_KEY=your_key_here
```

### `.gitignore`

```
node_modules/
dist/
.env
out/
```

**✅ Run: `npm install` — zero errors required before proceeding.**

---

## Phase 2 — Settings & Types

### `src/main/settings.ts`

This is the single source of truth for all configuration. Load `.env` here — nowhere else.

```typescript
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
}

export const store = new Store<Settings>({
  name: 'clawwrite-settings',
  defaults: {
    clipboardMonitorEnabled: false,
    hotkey: 'CommandOrControl+Shift+Space',
    geminiModel: 'gemini-2.5-flash',
    geminiApiKey: '',
    customPresets: [],
    history: [],
    autoStartEnabled: false,
    popupOpacity: 0.96,
    maxHistoryEntries: 20,
  }
});

// API key resolution order: electron-store (user set) → .env → empty string
export function getApiKey(): string {
  return store.get('geminiApiKey') || process.env.GEMINI_API_KEY || '';
}
```

---

## Phase 3 — Gemini Integration

### `src/main/gemini.ts`

The system prompt enforces that Gemini returns **only** the rewritten text — no preamble, no explanation, no quotes. This is the most important instruction.

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { store, getApiKey } from './settings.js';

// ─────────────────────────────────────────────────────────────
// Built-in preset definitions
// These are hardcoded — users can ADD custom presets but cannot
// modify or delete the built-in ones.
// ─────────────────────────────────────────────────────────────

export interface PresetAction {
  id: string;
  label: string;
  prompt: string;
  isBuiltIn: true;
}

export interface CustomPresetAction {
  id: string;
  label: string;
  prompt: string;
  isBuiltIn: false;
}

export type AnyPreset = PresetAction | CustomPresetAction;

export const BUILT_IN_PRESETS: PresetAction[] = [
  {
    id: 'improve',
    label: '✨ Improve',
    isBuiltIn: true,
    prompt: 'Improve the writing quality, clarity, and flow. Fix any awkward phrasing. Return only the improved text, nothing else.'
  },
  {
    id: 'formal',
    label: '📋 Make Formal',
    isBuiltIn: true,
    prompt: 'Rewrite in a professional, formal tone suitable for business communication. Return only the rewritten text, nothing else.'
  },
  {
    id: 'casual',
    label: '😊 Make Casual',
    isBuiltIn: true,
    prompt: 'Rewrite in a friendly, conversational, approachable tone. Return only the rewritten text, nothing else.'
  },
  {
    id: 'shorten',
    label: '✂️ Shorten',
    isBuiltIn: true,
    prompt: 'Make this significantly more concise without losing the key information. Cut unnecessary words and filler. Return only the shortened text, nothing else.'
  },
  {
    id: 'expand',
    label: '📝 Expand',
    isBuiltIn: true,
    prompt: 'Expand this with more relevant detail, context, and supporting points. Keep it coherent and useful. Return only the expanded text, nothing else.'
  },
  {
    id: 'grammar',
    label: '✅ Fix Grammar',
    isBuiltIn: true,
    prompt: 'Fix all grammar, spelling, and punctuation errors. Do not change the style or meaning. Return only the corrected text, nothing else.'
  },
  {
    id: 'bullets',
    label: '• Bullet Points',
    isBuiltIn: true,
    prompt: 'Convert this into clear, concise bullet points. Each bullet should be a distinct point. Return only the bullet points, nothing else.'
  },
  {
    id: 'summarise',
    label: '📌 Summarise',
    isBuiltIn: true,
    prompt: 'Summarise this in 1–2 sentences capturing the key point. Return only the summary, nothing else.'
  },
];

// ─────────────────────────────────────────────────────────────
// System prompt — the most important instruction
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a writing assistant embedded in a desktop app.
The user will provide text and an instruction for how to rewrite it.

CRITICAL RULES:
1. Return ONLY the rewritten text. Nothing else.
2. No preamble like "Here is the improved text:" or "Sure, here's..."
3. No explanation of what you changed.
4. No quotes around your output.
5. If the instruction asks for bullet points, use markdown "- " syntax.
6. Preserve the original language and any technical terms unless the instruction says otherwise.
7. If the text is very short (under 10 words), still fulfill the instruction faithfully.
8. Never add sign-offs, greetings, or closings unless they were in the original text.`;

// ─────────────────────────────────────────────────────────────
// Rewrite function
// ─────────────────────────────────────────────────────────────

export async function rewriteText(
  sourceText: string,
  instruction: string
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Right-click the tray icon → Settings to add your key.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: store.get('geminiModel'),
    systemInstruction: SYSTEM_PROMPT,
  });

  const prompt = `INSTRUCTION: ${instruction}\n\nTEXT TO REWRITE:\n${sourceText}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) throw new Error('Gemini returned an empty response. Please try again.');
  return text;
}

// ─────────────────────────────────────────────────────────────
// Returns all presets: built-in first, then user custom presets
// ─────────────────────────────────────────────────────────────

export function getAllPresets(): AnyPreset[] {
  const customPresets = store.get('customPresets').map(p => ({
    ...p,
    isBuiltIn: false as const
  }));
  return [...BUILT_IN_PRESETS, ...customPresets];
}
```

---

## Phase 4 — Clipboard Monitor

### `src/main/clipboard-monitor.ts`

Polls the clipboard every 600ms. Only fires when the new text is meaningfully different from the last seen text and meets the minimum length threshold. The monitor is off by default — the user must explicitly enable it from the tray menu.

```typescript
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
```

---

## Phase 5 — Paste & Focus Restore

### `src/main/paste.ts`

The hardest part of the whole app. The flow is: record foreground window HWND before showing popup → after user clicks Replace → write to clipboard → destroy popup (focus returns) → PowerShell sends Ctrl+V to the now-focused window.

The 200ms delay after focus restore is required — without it, `SendKeys` fires before the target app has focus.

```typescript
import { exec } from 'child_process';
import { clipboard } from 'electron';
import { promisify } from 'util';

const execAsync = promisify(exec);

let previousWindowHandle: string | null = null;

// ─────────────────────────────────────────────────────────────
// Record the foreground window BEFORE showing the popup.
// Called from hotkey handler and clipboard monitor handler.
// ─────────────────────────────────────────────────────────────

export async function recordPreviousWindow(): Promise<void> {
  try {
    const script = `
Add-Type -Name WinAPI -Namespace Win32 -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();'
[Win32.WinAPI]::GetForegroundWindow().ToInt64()
    `.trim();
    const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
    previousWindowHandle = stdout.trim();
  } catch {
    previousWindowHandle = null;
  }
}

// ─────────────────────────────────────────────────────────────
// Auto-paste flow:
// 1. Write result to clipboard
// 2. The caller (IPC handler) destroys the popup — focus returns
// 3. Wait 200ms for focus restoration to complete
// 4. Send Ctrl+V to the now-focused window
// ─────────────────────────────────────────────────────────────

export async function autoReplace(newText: string): Promise<void> {
  clipboard.writeText(newText);

  const script = previousWindowHandle
    ? `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocusAPI {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
[WinFocusAPI]::SetForegroundWindow([IntPtr]${previousWindowHandle})
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("^v")
    `.trim()
    : `
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("^v")
    `.trim();

  // Inline the script safely — collapse newlines, escape quotes
  const inlined = script.replace(/\r?\n/g, '; ').replace(/"/g, '\\"');
  await execAsync(`powershell -NoProfile -NonInteractive -Command "${inlined}"`);
}

// ─────────────────────────────────────────────────────────────
// Simulate Ctrl+C on the currently selected text (hotkey flow).
// Called before showing the popup so we capture the selection.
// ─────────────────────────────────────────────────────────────

export async function captureSelectedText(): Promise<string> {
  const before = clipboard.readText();

  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("^c")
  `.trim();
  const inlined = script.replace(/\r?\n/g, '; ').replace(/"/g, '\\"');
  await execAsync(`powershell -NoProfile -NonInteractive -Command "${inlined}"`);

  // Wait for clipboard to update
  await new Promise(r => setTimeout(r, 180));

  const after = clipboard.readText().trim();
  // If clipboard didn't change, no text was selected
  return after !== before.trim() ? after : '';
}
```

---

## Phase 6 — History Manager

### `src/main/history.ts`

```typescript
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
```

---

## Phase 7 — Startup Manager

### `src/main/startup.ts`

```typescript
import { app } from 'electron';
import { exec } from 'child_process';
import { store } from './settings.js';

export function setAutoStart(enabled: boolean): void {
  store.set('autoStartEnabled', enabled);

  if (app.isPackaged) {
    // Production: use Electron's built-in login items API
    app.setLoginItemSettings({
      openAtLogin: enabled,
      name: 'ClawWrite',
    });
  } else {
    // Dev mode: skip — login items don't work for non-packaged apps
    console.log(`[Startup] Dev mode — auto-start set to ${enabled} in settings only`);
  }
}

export function getAutoStartEnabled(): boolean {
  return store.get('autoStartEnabled');
}
```

---

## Phase 8 — Popup Window

### `src/main/popup-window.ts`

The popup is a frameless, transparent, always-on-top window. It appears near the cursor and is constrained to stay within the screen boundaries. A new window is created on every trigger — no persistent hidden window. This keeps memory usage low when idle.

```typescript
import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { is } from '@electron-toolkit/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 540;
const CURSOR_OFFSET = 14; // pixels from cursor

let popupWindow: BrowserWindow | null = null;

export function isPopupOpen(): boolean {
  return popupWindow !== null && !popupWindow.isDestroyed() && popupWindow.isVisible();
}

export function createAndShowPopup(sourceText: string): void {
  // Destroy any existing popup before creating new one
  destroyPopup();

  const { x, y } = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint({ x, y });
  const { bounds } = display;

  // Calculate position — prefer below-right of cursor, constrain to screen
  let posX = x + CURSOR_OFFSET;
  let posY = y + CURSOR_OFFSET;
  if (posX + POPUP_WIDTH > bounds.x + bounds.width)   posX = x - POPUP_WIDTH - CURSOR_OFFSET;
  if (posY + POPUP_HEIGHT > bounds.y + bounds.height) posY = y - POPUP_HEIGHT - CURSOR_OFFSET;
  // Hard clamp to screen bounds
  posX = Math.max(bounds.x, Math.min(posX, bounds.x + bounds.width  - POPUP_WIDTH));
  posY = Math.max(bounds.y, Math.min(posY, bounds.y + bounds.height - POPUP_HEIGHT));

  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,          // allow dragging via header
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    popupWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    popupWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  popupWindow.once('ready-to-show', () => {
    popupWindow?.show();
    popupWindow?.webContents.send('init-text', sourceText);
    popupWindow?.focus();
  });

  // Close popup if it loses focus (user clicked away)
  popupWindow.on('blur', () => {
    // Small delay — without this, clicking a button inside the popup
    // can briefly lose focus and trigger premature close
    setTimeout(() => {
      if (popupWindow && !popupWindow.isDestroyed()) {
        destroyPopup();
      }
    }, 150);
  });
}

export function destroyPopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
  }
  popupWindow = null;
}

export function getPopupWindow(): BrowserWindow | null {
  return popupWindow;
}
```

---

## Phase 9 — Hotkey Handler

### `src/main/hotkey.ts`

```typescript
import { globalShortcut } from 'electron';
import { store } from './settings.js';
import { recordPreviousWindow, captureSelectedText } from './paste.js';
import { createAndShowPopup, destroyPopup, isPopupOpen } from './popup-window.js';

export function registerHotkey(): boolean {
  const hotkey = store.get('hotkey');

  const registered = globalShortcut.register(hotkey, async () => {
    // Toggle: if popup is already open, close it
    if (isPopupOpen()) {
      destroyPopup();
      return;
    }

    // Record the window that was focused before we do anything
    await recordPreviousWindow();

    // Simulate Ctrl+C to copy current selection, then read clipboard
    const text = await captureSelectedText();

    if (!text || text.length < 10) {
      // Nothing selected or too short — do nothing silently
      return;
    }

    createAndShowPopup(text);
  });

  if (!registered) {
    console.error(`[Hotkey] Failed to register ${hotkey} — likely taken by another app`);
  }

  return registered;
}

export function unregisterHotkey(): void {
  globalShortcut.unregisterAll();
}

export function reregisterHotkey(newHotkey: string): boolean {
  globalShortcut.unregisterAll();
  store.set('hotkey', newHotkey);
  return registerHotkey();
}
```

---

## Phase 10 — Main Entry Point

### `src/main/index.ts`

```typescript
import {
  app, Tray, Menu, nativeImage, ipcMain, clipboard, shell
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { store, getApiKey } from './settings.js';
import { rewriteText, getAllPresets } from './gemini.js';
import { clipboardMonitor } from './clipboard-monitor.js';
import { registerHotkey, unregisterHotkey } from './hotkey.js';
import { createAndShowPopup, destroyPopup } from './popup-window.js';
import { recordPreviousWindow, autoReplace } from './paste.js';
import { addHistoryEntry, getHistory, clearHistory, deleteHistoryEntry } from './history.js';
import { setAutoStart, getAutoStartEnabled } from './startup.js';

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

  setupTray();
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
    await autoReplace(text);
    return true;
  });

  // Renderer signals it wants to close
  ipcMain.handle('close-popup', () => {
    destroyPopup();
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
}
```

---

## Phase 11 — Preload Bridge

### `src/preload/index.ts`

The preload is the only bridge between the sandboxed renderer and the main process. Everything exposed here is explicitly typed and intentional — no open pipes.

```typescript
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

  // History
  deleteHistoryEntry: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-history-entry', id),

  // Main → Renderer events
  onInitText: (cb: (text: string) => void): void => {
    ipcRenderer.on('init-text', (_, text: string) => cb(text));
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
      setApiKey: (key: string) => Promise<boolean>;
      toggleClipboardMonitor: () => Promise<boolean>;
      addCustomPreset: (preset: { label: string; prompt: string }) => Promise<AnyPreset[]>;
      deleteCustomPreset: (id: string) => Promise<AnyPreset[]>;
      deleteHistoryEntry: (id: string) => Promise<boolean>;
      onInitText: (cb: (text: string) => void) => void;
    };
  }
}
```

---

## Phase 12 — Renderer UI

### `src/renderer/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ClawWrite</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

### `src/renderer/main.tsx`

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### `src/renderer/App.tsx`

The popup has four phases:
- `idle` — presets + custom input visible, waiting for user action
- `loading` — AI call in progress, animated loading indicator
- `result` — AI output shown in editable textarea, Copy + Replace buttons
- `settings` — inline settings panel (API key, clipboard monitor toggle, custom presets)

```typescript
import { useState, useEffect, useRef } from 'react';
import type { AnyPreset } from '../main/gemini.js';
import type { HistoryEntry } from '../main/settings.js';

type Phase = 'idle' | 'loading' | 'result' | 'settings' | 'history';

export default function App() {
  const [sourceText, setSourceText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [result, setResult] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<AnyPreset[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeInstruction, setActiveInstruction] = useState('');
  const [newPresetLabel, setNewPresetLabel] = useState('');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.clawwrite.getPresets().then(setPresets);
    window.clawwrite.getHistory().then(setHistory);

    window.clawwrite.onInitText((text: string) => {
      setSourceText(text);
      setPhase('idle');
      setResult('');
      setError('');
      setActivePresetId(null);
    });

    // Escape closes popup or returns to idle from result
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'result' || phase === 'settings' || phase === 'history') {
          setPhase('idle');
        } else {
          window.clawwrite.closePopup();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const runRewrite = async (instruction: string, presetId: string | null) => {
    if (!sourceText.trim()) return;
    setPhase('loading');
    setError('');
    setActivePresetId(presetId);
    setActiveInstruction(instruction);

    const res = await window.clawwrite.rewrite(sourceText, instruction, presetId);

    if (res.success && res.result) {
      setResult(res.result);
      setPhase('result');
    } else {
      setError(res.error ?? 'Gemini returned no result. Try again.');
      setPhase('idle');
    }
  };

  const handleCopy = async () => {
    await window.clawwrite.copyResult(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReplace = () => {
    window.clawwrite.replaceText(result);
    // Popup will be destroyed by main process after paste
  };

  const handleRetry = () => {
    if (activeInstruction) runRewrite(activeInstruction, activePresetId);
  };

  const handleBack = () => {
    setPhase('idle');
    setResult('');
    setCopied(false);
    setError('');
  };

  const handleAddPreset = async () => {
    if (!newPresetLabel.trim() || !newPresetPrompt.trim()) return;
    const updated = await window.clawwrite.addCustomPreset({
      label: newPresetLabel,
      prompt: newPresetPrompt,
    });
    setPresets(updated);
    setNewPresetLabel('');
    setNewPresetPrompt('');
  };

  const handleDeletePreset = async (id: string) => {
    const updated = await window.clawwrite.deleteCustomPreset(id);
    setPresets(updated);
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  return (
    <div className="app">
      {/* ── Header ─────────────────────────── */}
      <div className="header drag-region">
        <span className="logo">✦ ClawWrite</span>
        <div className="header-actions no-drag">
          <button
            className={`header-btn ${phase === 'history' ? 'active' : ''}`}
            onClick={() => setPhase(phase === 'history' ? 'idle' : 'history')}
            title="Recent rewrites"
          >⟳</button>
          <button
            className={`header-btn ${phase === 'settings' ? 'active' : ''}`}
            onClick={() => setPhase(phase === 'settings' ? 'idle' : 'settings')}
            title="Settings"
          >⚙</button>
          <button className="close-btn" onClick={() => window.clawwrite.closePopup()}>✕</button>
        </div>
      </div>

      {/* ── Source preview (always visible unless in settings/history) ── */}
      {phase !== 'settings' && phase !== 'history' && (
        <div className="source-preview">
          <span className="source-label">Selected text</span>
          <p className="source-text">{truncate(sourceText, 140)}</p>
        </div>
      )}

      {/* ── Phase: idle ─────────────────────── */}
      {phase === 'idle' && (
        <div className="actions-section">
          <div className="preset-grid">
            {presets.map((p) => (
              <button
                key={p.id}
                className="preset-btn"
                onClick={() => runRewrite(p.prompt, p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="custom-row">
            <input
              ref={customInputRef}
              className="custom-input"
              placeholder="Custom instruction…"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customPrompt.trim()) {
                  runRewrite(customPrompt, null);
                }
              }}
            />
            <button
              className="custom-send-btn"
              onClick={() => customPrompt.trim() && runRewrite(customPrompt, null)}
              disabled={!customPrompt.trim()}
            >→</button>
          </div>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase: loading ──────────────────── */}
      {phase === 'loading' && (
        <div className="loading-section">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
          <p className="loading-label">Rewriting…</p>
        </div>
      )}

      {/* ── Phase: result ───────────────────── */}
      {phase === 'result' && (
        <div className="result-section">
          <div className="result-box">
            <textarea
              className="result-textarea"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="result-actions">
            <button className="btn-back" onClick={handleBack} title="Try a different action">← Back</button>
            <button className="btn-retry" onClick={handleRetry} title="Run the same action again">↺ Retry</button>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button className="btn-replace" onClick={handleReplace}>
              ⚡ Replace
            </button>
          </div>
          <p className="replace-hint">Replace pastes directly back into your app</p>
        </div>
      )}

      {/* ── Phase: settings ─────────────────── */}
      {phase === 'settings' && (
        <div className="settings-section">
          <h3 className="settings-title">Settings</h3>

          <div className="settings-group">
            <label className="settings-label">Gemini API Key</label>
            <div className="api-key-row">
              <input
                className="settings-input"
                type="password"
                placeholder="AIza…"
                onBlur={(e) => {
                  if (e.target.value) window.clawwrite.setApiKey(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="settings-group">
            <label className="settings-label">Custom Presets</label>
            <div className="custom-presets-list">
              {presets.filter(p => !p.isBuiltIn).map(p => (
                <div key={p.id} className="custom-preset-item">
                  <span className="custom-preset-label">{p.label}</span>
                  <button
                    className="custom-preset-delete"
                    onClick={() => handleDeletePreset(p.id)}
                  >✕</button>
                </div>
              ))}
              {presets.filter(p => !p.isBuiltIn).length === 0 && (
                <p className="empty-state">No custom presets yet</p>
              )}
            </div>
            <div className="add-preset-form">
              <input
                className="settings-input"
                placeholder="Button label (e.g. MSP Ticket)"
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
                maxLength={30}
              />
              <textarea
                className="settings-textarea"
                placeholder="Instruction sent to AI…"
                value={newPresetPrompt}
                onChange={(e) => setNewPresetPrompt(e.target.value)}
                rows={2}
                maxLength={500}
              />
              <button
                className="btn-add-preset"
                onClick={handleAddPreset}
                disabled={!newPresetLabel.trim() || !newPresetPrompt.trim()}
              >+ Add Preset</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: history ──────────────────── */}
      {phase === 'history' && (
        <div className="history-section">
          <h3 className="settings-title">Recent Rewrites</h3>
          {history.length === 0 ? (
            <p className="empty-state">No history yet</p>
          ) : (
            <div className="history-list">
              {history.map(entry => (
                <div key={entry.id} className="history-item">
                  <div className="history-item-header">
                    <span className="history-instruction">{truncate(entry.instruction, 40)}</span>
                    <button
                      className="history-delete-btn"
                      onClick={async () => {
                        await window.clawwrite.deleteHistoryEntry(entry.id);
                        setHistory(h => h.filter(e => e.id !== entry.id));
                      }}
                    >✕</button>
                  </div>
                  <p className="history-result">{truncate(entry.result, 100)}</p>
                  <button
                    className="history-use-btn"
                    onClick={() => {
                      setResult(entry.result);
                      setPhase('result');
                    }}
                  >Use this</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Phase 13 — CSS Design System

### `src/renderer/index.css`

Dark glassmorphism aesthetic. Primary accent: `#a78bfa` (violet). All measurements in px for pixel-perfect popup sizing. The window is 480×540 exactly.

```css
/* ── Reset ───────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body { width: 480px; height: 540px; overflow: hidden; background: transparent; }

body {
  font-family: 'Segoe UI', -apple-system, system-ui, sans-serif;
  font-size: 13px;
  color: #e8e8f0;
  -webkit-font-smoothing: antialiased;
}

/* ── App container ─────────────────────── */
.app {
  width: 480px;
  height: 540px;
  background: rgba(14, 14, 22, 0.97);
  backdrop-filter: blur(32px) saturate(180%);
  -webkit-backdrop-filter: blur(32px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.03) inset,
    0 24px 64px rgba(0, 0, 0, 0.7),
    0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ── Header ────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  flex-shrink: 0;
  height: 42px;
  -webkit-app-region: drag;
}

.logo {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #a78bfa;
  text-transform: uppercase;
  -webkit-app-region: no-drag;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.no-drag { -webkit-app-region: no-drag; }

.header-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 14px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 5px;
  line-height: 1;
  transition: background 0.12s, color 0.12s;
}
.header-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.8); }
.header-btn.active { background: rgba(167,139,250,0.18); color: #a78bfa; }

.close-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.25);
  font-size: 13px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 5px;
  line-height: 1;
  transition: background 0.12s, color 0.12s;
  margin-left: 2px;
}
.close-btn:hover { background: rgba(239,68,68,0.2); color: #f87171; }

/* ── Source preview ────────────────────── */
.source-preview {
  padding: 9px 14px 8px;
  border-bottom: 1px solid rgba(255,255,255,0.045);
  flex-shrink: 0;
}

.source-label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: rgba(255,255,255,0.28);
  font-weight: 600;
  margin-bottom: 4px;
}

.source-text {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  line-height: 1.45;
  word-break: break-word;
}

/* ── Actions (idle phase) ──────────────── */
.actions-section {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.preset-btn {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  color: rgba(255,255,255,0.72);
  font-size: 12px;
  padding: 9px 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.14s, border-color 0.14s, color 0.14s;
  font-family: inherit;
  line-height: 1.3;
}
.preset-btn:hover {
  background: rgba(167,139,250,0.12);
  border-color: rgba(167,139,250,0.28);
  color: #c4b5fd;
}
.preset-btn:active { transform: scale(0.98); }

.custom-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.custom-input {
  flex: 1;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  color: #e8e8f0;
  font-size: 12.5px;
  padding: 9px 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.14s;
  height: 36px;
}
.custom-input:focus { border-color: rgba(167,139,250,0.5); }
.custom-input::placeholder { color: rgba(255,255,255,0.22); }

.custom-send-btn {
  width: 36px;
  height: 36px;
  background: #7c3aed;
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 17px;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.14s;
}
.custom-send-btn:hover { background: #6d28d9; }
.custom-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.25);
  border-radius: 7px;
  padding: 7px 10px;
  font-size: 11.5px;
  color: #fca5a5;
  gap: 8px;
}
.error-banner button {
  background: none; border: none;
  color: #fca5a5; cursor: pointer; font-size: 13px; flex-shrink: 0;
}

/* ── Loading ───────────────────────────── */
.loading-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.loading-dots {
  display: flex;
  gap: 6px;
}
.loading-dots span {
  width: 8px; height: 8px;
  background: #a78bfa;
  border-radius: 50%;
  animation: bounce-dot 1.3s ease-in-out infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce-dot {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-8px); opacity: 1; }
}

.loading-label {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  letter-spacing: 0.04em;
}

/* ── Result ────────────────────────────── */
.result-section {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.result-box {
  flex: 1;
  overflow: hidden;
  display: flex;
}

.result-textarea {
  width: 100%;
  height: 100%;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(167,139,250,0.18);
  border-radius: 8px;
  color: #e8e8f0;
  font-size: 12.5px;
  line-height: 1.55;
  padding: 10px 12px;
  resize: none;
  font-family: inherit;
  outline: none;
  transition: border-color 0.14s;
}
.result-textarea:focus { border-color: rgba(167,139,250,0.38); }

.result-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-back, .btn-retry {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  color: rgba(255,255,255,0.5);
  font-size: 12px;
  padding: 8px 10px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.14s;
  flex-shrink: 0;
}
.btn-back:hover, .btn-retry:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.8); }

.btn-copy {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 8px;
  color: rgba(255,255,255,0.72);
  font-size: 12px;
  padding: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.14s;
}
.btn-copy:hover { background: rgba(255,255,255,0.1); }

.btn-replace {
  flex: 2;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  padding: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.14s;
  box-shadow: 0 2px 10px rgba(124,58,237,0.4);
}
.btn-replace:hover { opacity: 0.9; }
.btn-replace:active { transform: scale(0.98); }

.replace-hint {
  font-size: 10px;
  color: rgba(255,255,255,0.18);
  text-align: center;
  flex-shrink: 0;
}

/* ── Settings ──────────────────────────── */
.settings-section {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.settings-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  margin-bottom: 2px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.settings-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.settings-input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 7px;
  color: #e8e8f0;
  font-size: 12px;
  padding: 8px 10px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.14s;
  width: 100%;
}
.settings-input:focus { border-color: rgba(167,139,250,0.45); }
.settings-input::placeholder { color: rgba(255,255,255,0.2); }

.settings-textarea {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 7px;
  color: #e8e8f0;
  font-size: 12px;
  padding: 8px 10px;
  font-family: inherit;
  outline: none;
  resize: none;
  width: 100%;
  transition: border-color 0.14s;
}
.settings-textarea:focus { border-color: rgba(167,139,250,0.45); }
.settings-textarea::placeholder { color: rgba(255,255,255,0.2); }

.custom-presets-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 80px;
  overflow-y: auto;
}

.custom-preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 6px;
  padding: 6px 10px;
}

.custom-preset-label { font-size: 12px; color: rgba(255,255,255,0.65); }

.custom-preset-delete {
  background: none; border: none;
  color: rgba(255,255,255,0.25); cursor: pointer; font-size: 11px;
  transition: color 0.12s;
}
.custom-preset-delete:hover { color: #f87171; }

.add-preset-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-add-preset {
  background: rgba(167,139,250,0.12);
  border: 1px solid rgba(167,139,250,0.22);
  border-radius: 7px;
  color: #c4b5fd;
  font-size: 12px;
  padding: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.14s;
}
.btn-add-preset:hover { background: rgba(167,139,250,0.2); }
.btn-add-preset:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── History ───────────────────────────── */
.history-section {
  flex: 1;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.history-item {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-instruction {
  font-size: 11px;
  font-weight: 600;
  color: #a78bfa;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.history-delete-btn {
  background: none; border: none;
  color: rgba(255,255,255,0.2); cursor: pointer; font-size: 10px;
  transition: color 0.12s;
}
.history-delete-btn:hover { color: #f87171; }

.history-result {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  line-height: 1.4;
  word-break: break-word;
}

.history-use-btn {
  background: none;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 5px;
  color: rgba(255,255,255,0.35);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  font-family: inherit;
  align-self: flex-start;
  transition: background 0.12s, color 0.12s;
}
.history-use-btn:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.7); }

/* ── Empty state ───────────────────────── */
.empty-state {
  font-size: 12px;
  color: rgba(255,255,255,0.2);
  text-align: center;
  padding: 12px 0;
}

/* ── Custom scrollbar ──────────────────── */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
```

---

## Phase 14 — Installer & Distribution

### `electron-builder` configuration

Already included in `package.json`. Run:

```bash
npm run dist
```

This produces:
- `dist/ClawWrite Setup 1.0.0.exe` — NSIS one-click installer
- Installs to `%LOCALAPPDATA%\Programs\ClawWrite\`
- Creates Start Menu shortcut
- Creates Desktop shortcut (optional, NSIS default)
- Does NOT require admin rights (`requestedExecutionLevel: asInvoker`)

### Required assets before building

| File | Spec |
|---|---|
| `resources/tray-icon.png` | 16×16 PNG, white icon on transparent background |
| `resources/tray-icon@2x.png` | 32×32 PNG, same design |
| `resources/icon.ico` | 256×256 ICO, used for installer + taskbar |

Generate these with any icon tool. The icon should be a simple sparkle (✦) or stylized claw.

---

## Phase 15 — Integration Tests

Run these manually after completing all phases. Every test must pass before considering the build complete.

### Test 1 — Hotkey + Replace (core flow)
1. Open Notepad, type "this is a bad sentance with erors"
2. Select all text
3. Press `Ctrl+Shift+Space`
4. Verify popup appears near cursor with source text preview
5. Click **✅ Fix Grammar**
6. Verify loading indicator appears
7. Verify result appears in editable textarea
8. Click **⚡ Replace**
9. Verify popup closes and Notepad now contains corrected text

### Test 2 — Copy button
1. Select text in any app, press hotkey
2. Click **✨ Improve**
3. When result appears, click **Copy**
4. Verify "✓ Copied" feedback appears briefly
5. Paste into another app — verify AI result is pasted

### Test 3 — Custom prompt
1. Select a paragraph of text, press hotkey
2. Type "rewrite this as a bullet-pointed FAQ" in the custom input
3. Press Enter
4. Verify result contains bullet points

### Test 4 — Clipboard monitor
1. Right-click tray → enable Clipboard Monitor
2. Select and copy a sentence (Ctrl+C) in any app
3. Verify popup appears automatically
4. Click **✕** to close, verify no paste occurred
5. Copy again — verify popup appears again
6. After Replace, copy something unrelated — verify it does NOT re-trigger on the pasted result

### Test 5 — Settings panel
1. Press hotkey, click ⚙ in popup header
2. Add a custom preset with label "MSP Ticket" and a relevant prompt
3. Return to idle (Escape)
4. Open popup again — verify new preset button appears in grid
5. Click Settings again, delete the preset — verify it disappears

### Test 6 — History
1. Perform 3 rewrites
2. Open popup, click ⟳
3. Verify 3 entries appear with truncated instruction and result
4. Click "Use this" on any entry — verify result view opens with that text
5. Delete one entry — verify it disappears immediately

### Test 7 — Escape behaviour
1. Hotkey → popup opens → press Escape → verify popup closes
2. Hotkey → click a preset → loading → press Escape → verify nothing happens during loading
3. Hotkey → complete a rewrite → press Escape → verify returns to idle (not closes)

### Test 8 — Screen edge constraint
1. Move cursor to bottom-right corner of screen
2. Press hotkey with text selected
3. Verify popup appears entirely within screen bounds (not partially off-screen)

### Test 9 — Second instance
1. Launch ClawWrite
2. Launch ClawWrite again
3. Verify only one tray icon exists and first instance is still running

### Test 10 — API key missing
1. Remove `GEMINI_API_KEY` from `.env`
2. Restart app
3. Select text, press hotkey
4. Click any preset
5. Verify user-friendly error message appears (not a raw crash)

### Test 11 — Very long text
1. Select 5000+ characters of text, press hotkey
2. Verify popup appears and source preview truncates cleanly
3. Click **✂️ Shorten**
4. Verify result is returned (Gemini handles large inputs)

### Test 12 — Auto-start toggle
1. Right-click tray → enable "Start with Windows"
2. Verify tray menu updates to show "ON ✓"
3. Restart Windows (or check `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`)
4. Verify ClawWrite appears in startup entries

---

## Known Limitations & Workarounds

| Limitation | Detail | Workaround |
|---|---|---|
| **Ctrl+C simulation** | `SendKeys` sometimes fails in apps with custom keyboard hooks (some games, terminals) | User can manually copy then use clipboard monitor mode |
| **Admin-elevated windows** | Cannot paste into apps running as Administrator (UAC boundary) | User must manually paste with Ctrl+V |
| **Non-Latin keyboard layouts** | `SendKeys` Ctrl+V works globally but Ctrl+C simulation may miss in some IME setups | Clipboard monitor mode is more reliable |
| **Very slow Gemini response** | No timeout on Gemini calls — could hang | Add 30s timeout to `generateContent` call in `gemini.ts` |
| **Clipboard monitor false positives** | Copying passwords or codes will trigger popup | 15-char minimum reduces but doesn't eliminate this — user should keep monitor OFF by default |

---

## Future Roadmap (do not build now)

These are planned extensions for future versions. Document them here but do not implement in v1.0.

| Feature | Version | Description |
|---|---|---|
| **Per-app context detection** | v1.1 | Detect foreground app (Outlook, Teams, Chrome) and auto-surface the most relevant preset |
| **Settings window** | v1.1 | Full dedicated settings window instead of inline popup panel — hotkey remapping, model selection, opacity |
| **Hotkey remapping** | v1.1 | UI to change the trigger hotkey without editing files |
| **Tone profiles** | v1.2 | Saved writing style profiles (e.g. "My company voice") that influence every rewrite |
| **Team presets** | v1.2 | Sync custom presets across a team via a shared JSON URL |
| **PersonalClaw bridge** | v1.3 | Optional setting to route rewrites through a running PersonalClaw instance — enables use of long-term memory and learned user style |
| **Auto-update** | v1.1 | `electron-updater` with a GitHub Releases feed |
| **Usage stats** | v1.2 | Local-only counter of rewrites per preset, surfaced in tray menu |

---

## Constraints for the Implementing Agent

These rules are non-negotiable. Follow them exactly.

1. **Run `npx tsc --noEmit` after every phase.** Zero TypeScript errors required before proceeding.
2. **Do not use `nodeIntegration: true`** in any BrowserWindow. All Node access goes through the preload.
3. **`sandbox: true` on the popup window.** The renderer has no direct system access.
4. **All PowerShell commands use `-NoProfile -NonInteractive`** to prevent hangs on profile load.
5. **`clipboardMonitor.updateLastSeen(text)` must be called after every Replace action** to prevent the replaced text from re-triggering the clipboard monitor.
6. **`recordPreviousWindow()` must be called before showing the popup.** If called after, the popup window itself will be recorded as the target and paste will fail.
7. **The popup `blur` event must have a 150ms delay** before `destroyPopup()`. Without it, button clicks inside the popup close it before the click handler fires.
8. **`autoReplace` must be called AFTER `destroyPopup()`**, not before. The sequence is: destroy popup → wait → send Ctrl+V. If the popup is still open when Ctrl+V fires, it pastes into the popup itself.
9. **Never store the full source text in history** — store only the first 200 characters. History entries accumulate and the electron-store file lives on disk.
10. **Use `app.requestSingleInstanceLock()`** to prevent multiple tray icons when launched twice.
11. **Built-in presets are hardcoded in `gemini.ts`** and never written to electron-store. Only custom presets go in the store.
12. **The `.env` file is not committed to git** (verify `.gitignore`). API key handling must work both with and without `.env` present (graceful degradation with an error message, not a crash).
13. **`electron-builder` target is Windows x64 only** for v1.0. Do not add macOS or Linux targets.
14. **Follow ESM import conventions** — `.js` extensions on all local TypeScript imports.
15. **Do not add `async/await` to the `blur` handler** — the 150ms timeout pattern is sufficient and adding async creates race conditions.

---

## Quick Start Commands

```bash
# Install
npm install

# Create .env
echo "GEMINI_API_KEY=your_key_here" > .env

# Add placeholder tray icon (replace with real icon)
mkdir resources
# Place tray-icon.png (16x16) and icon.ico (256x256) in resources/

# Development
npm run dev

# Production build
npm run build
npm start

# Create installer
npm run dist
# → dist/ClawWrite Setup 1.0.0.exe
```

---

*ClawWrite v1.0.0 — Implementation Plan*
*Authored for handoff to Gemini — March 2026*
