# ClawWrite — Architecture Document

> **Version:** 1.0.4
> **Last updated:** 2026-03-25
> **Platform:** Windows only (uses Win32 APIs and PowerShell)

---

## 1. What is ClawWrite?

ClawWrite is a **Windows system tray application** that provides AI-powered writing assistance to **any text field on the system**. The user selects text anywhere (Notepad, browser, Slack, etc.), presses a global hotkey, and a floating popup appears with preset rewrite actions and a custom prompt field. Results can be copied to clipboard or auto-pasted back into the originating application.

### Core User Flow

```
1. User selects text in any application
2. User presses Ctrl+Shift+Space (configurable)
3. ClawWrite captures the selected text via simulated Ctrl+C
4. A floating popup appears near the cursor with rewrite options
5. User picks a preset (Improve, Shorten, etc.) or types a custom instruction
6. Gemini AI rewrites the text
7. User clicks "Copy" or "Replace" (auto-pastes back into the original app)
```

---

## 2. Technology Stack

| Layer        | Technology                                  |
|------------- |---------------------------------------------|
| Runtime      | Electron 29                                 |
| Frontend     | React 19 + TypeScript 5.4                   |
| Build        | electron-vite 2.3.0 (Vite 5 under the hood)|
| AI Backend   | Google Gemini API (`gemini-3-flash-preview`) |
| Settings     | electron-store (JSON file on disk)           |
| Env Config   | dotenv (`.env` file for API key)             |
| OS Automation| PowerShell 5+ (Win32 P/Invoke via Add-Type) |
| Packaging    | electron-builder (NSIS installer, x64)      |

---

## 3. Project Structure

```
ClawWrite/
├── src/
│   ├── main/                      # Electron main process (Node.js)
│   │   ├── index.ts               # App lifecycle, tray setup, IPC handler registration
│   │   ├── hotkey.ts              # Global hotkey registration (Ctrl+Shift+Space)
│   │   ├── clipboard-monitor.ts   # Polling-based clipboard watcher (optional feature)
│   │   ├── popup-window.ts        # Frameless BrowserWindow creation and positioning
│   │   ├── gemini.ts              # Gemini API integration, preset definitions, system prompt
│   │   ├── paste.ts               # Text capture (Ctrl+C) and auto-replace (Ctrl+V) via PowerShell
│   │   ├── settings.ts            # electron-store schema, defaults, API key resolution
│   │   ├── history.ts             # Rewrite history CRUD operations
│   │   └── startup.ts             # Windows auto-start (login items) integration
│   ├── preload/
│   │   └── index.ts               # contextBridge IPC API exposed to renderer as window.clawwrite
│   └── renderer/                  # Electron renderer process (browser context)
│       ├── App.tsx                # React popup UI — all phases (idle, loading, result, settings, history)
│       ├── global.d.ts            # Global TypeScript interface for window.clawwrite
│       ├── main.tsx               # React root mount
│       ├── index.html             # HTML entry point
│       └── index.css              # Full design system — premium bold light theme
├── resources/
│   ├── icon.ico                   # App/installer icon
│   ├── icon.png                   # PNG variant
│   ├── tray-icon.png              # 16x16 system tray icon
│   └── tray-icon@2x.png           # 32x32 high-DPI tray icon
├── package.json                   # Dependencies, scripts, electron-builder config
├── electron.vite.config.ts        # Vite build config (main, preload, renderer targets)
├── tsconfig.json                  # Root TS config (references node + web)
├── tsconfig.node.json             # Main/preload TS compilation settings
├── tsconfig.web.json              # Renderer TS compilation settings
├── .env                           # Gemini API key (GEMINI_API_KEY=...) — NOT committed to git
└── .gitignore
```

---

## 4. Architecture Overview

ClawWrite follows Electron's **three-process model** with strict isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                             │
│  (Node.js — full system access)                                 │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐  │
│  │ index.ts │  │ popup-win.ts │  │ gemini.ts │  │ paste.ts  │  │
│  │ (tray +  │  │ (BrowserWin  │  │ (API call │  │ (PS1 text │  │
│  │  IPC hub)│  │  lifecycle)  │  │  + presets│  │  capture + │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  │  replace) │  │
│       │               │                │         └─────┬─────┘  │
│  ┌────┴─────┐  ┌──────┴───────┐  ┌─────┴──────┐       │        │
│  │hotkey.ts │  │clipboard-    │  │settings.ts │       │        │
│  │(global   │  │monitor.ts   │  │(store +    │       │        │
│  │ shortcut)│  │(polling)     │  │ .env)      │       │        │
│  └──────────┘  └──────────────┘  └────────────┘       │        │
│                                                       │        │
│  PowerShell execution ←───────────────────────────────┘        │
│  (Base64 -EncodedCommand with Win32 P/Invoke)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ IPC (ipcMain.handle / ipcRenderer.invoke)
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                     PRELOAD PROCESS                              │
│  (preload/index.ts — contextBridge)                              │
│                                                                  │
│  Exposes window.clawwrite = {                                    │
│    getPresets, getHistory, rewrite, copyResult, replaceText,     │
│    closePopup, recaptureText, setApiKey, toggleClipboardMonitor, │
│    addCustomPreset, deleteCustomPreset, deleteHistoryEntry,      │
│    onInitText (returns unsubscribe function)                     │
│  }                                                               │
│  (Fully typed via global.d.ts in the renderer process)           │
└────────────────────────┬─────────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                     RENDERER PROCESS                             │
│  (React 19 — sandboxed, no Node.js access)                       │
│                                                                  │
│  App.tsx — single component with 5 phases:                       │
│    idle     → preset grid + custom input                         │
│    loading  → animated dots                                      │
│    result   → editable textarea + Copy/Replace buttons           │
│    settings → API key input, custom preset management            │
│    history  → list of past rewrites with "Use this" action       │
└──────────────────────────────────────────────────────────────────┘
```

### Security Model

- `contextIsolation: true` — renderer cannot access Node.js APIs directly
- `nodeIntegration: false` — no `require()` in renderer
- `sandbox: true` — renderer runs in Chromium sandbox
- All main↔renderer communication goes through `contextBridge` via IPC invoke/handle pattern

---

## 5. Module Details

### 5.1 `main/index.ts` — Application Entry Point

**Responsibilities:**
- App lifecycle management (`app.whenReady`, `will-quit`, `window-all-closed`)
- Single instance lock (prevents duplicate processes)
- System tray setup with context menu
- IPC handler registration (all `ipcMain.handle` calls)
- Clipboard monitor wiring
- Model migration logic (old model names → current)

**IPC Channels Registered:**

| Channel                  | Direction       | Purpose                                 |
|--------------------------|-----------------|---------------------------------------- |
| `get-presets`            | renderer → main | Fetch all presets (built-in + custom)    |
| `get-history`            | renderer → main | Fetch rewrite history                    |
| `rewrite`                | renderer → main | Send text + instruction to Gemini        |
| `copy-result`            | renderer → main | Write result to clipboard                |
| `replace-text`           | renderer → main | Auto-paste result into original app      |
| `close-popup`            | renderer → main | Destroy popup window                     |
| `set-api-key`            | renderer → main | Update API key in store                  |
| `toggle-clipboard-monitor` | renderer → main | Toggle clipboard watching              |
| `add-custom-preset`      | renderer → main | Create a new custom preset               |
| `delete-custom-preset`   | renderer → main | Delete a custom preset by ID             |
| `delete-history-entry`   | renderer → main | Delete a history entry by ID             |
| `recapture-text`         | renderer → main | Focus original app, send Ctrl+C, reload  |
| `init-text`              | main → renderer | Push captured text to popup on open      |

### 5.2 `main/hotkey.ts` — Global Hotkey

- Registers `Ctrl+Shift+Space` (configurable via `store.hotkey`) using Electron's `globalShortcut`
- On trigger: toggles popup if already open, otherwise calls `captureContext()` then `createAndShowPopup()`
- Shows popup only if text was captured (non-empty)

### 5.3 `main/paste.ts` — Text Capture & Auto-Replace

This is the most platform-specific module. It uses **PowerShell scripts executed via Base64 `-EncodedCommand`** to interact with the Windows desktop seamlessly, bypassing enterprise AppLocker/AV restrictions on temporary disk files.

**`runPowerShell(script)`** — Helper that:
1. Converts the supplied script payload to UTF-16LE Base64 format
2. Executes it securely in-memory using `-ExecutionPolicy Bypass -EncodedCommand`
3. Bypasses standard restrictions on temporary disk execution
4. Has a 10-second timeout to prevent hangs

**`captureContext()`** — Captures selected text using a "True Capture" strategy:
1. **Cache & Clear**: Reads the current clipboard content into a local variable, then explicitly clears the system clipboard.
2. **PowerShell Trigger**: Calls PowerShell via `-EncodedCommand` to:
   - Get the foreground window handle via `GetForegroundWindow()`.
   - Wait for modifier keys (Ctrl, Shift, Space) to be released (up to 2000ms).
   - Send `Ctrl+C` via `keybd_event()`.
3. **Verify & Detect**: Waits 250ms, then reads the clipboard. Since the clipboard was cleared, any text found is guaranteed to be the new selection (even if it's identical to the previous clipboard state).
4. **Resilient Restoration**: If no text is found (nothing was selected), it restores the original cached clipboard content to prevent data loss.
5. Returns the captured text and stores the HWND for `autoReplace()`.

**`autoReplace(newText)`** — Pastes result back:
1. Writes new text to clipboard
2. If a window handle was captured, focuses that window via `SetForegroundWindow()`
3. Sends Ctrl+V via `SendKeys::SendWait()`

**`recaptureFromWindow()`** — Recaptures selected text from the original app without closing the popup:
1. Clears clipboard so a fresh copy can be detected
2. Calls PowerShell to focus the stored window handle via `SetForegroundWindow()`
3. Sends Ctrl+C via `keybd_event()`
4. Waits 250ms then reads clipboard
5. Returns the captured text (no before/after comparison — always returns what's on clipboard)

**Why `-EncodedCommand` instead of temp `.ps1` files or inline commands?**
Earlier versions used temporary `.ps1` files, but this frequently triggered stringent Antivirus and AppLocker restrictions on corporate networks (especially when dumped to the `%TEMP%` folder). Transitioning to inline base64 encoded strings entirely avoids disk drops, while retaining exact formatting for here-strings (`@'...'@`) that would otherwise break when manually escaping standard inline parameters.

### 5.4 `main/gemini.ts` — AI Integration

- Uses `@google/generative-ai` SDK
- Model: configurable via store, defaults to `gemini-3-flash-preview`
- System prompt enforces "return only rewritten text, no preamble"
- 9 built-in presets: Improve, Make Formal, Make Casual, Shorten, Expand, Fix Grammar, Bullet Points, Summarise, Minutes Of Meeting
- Users can add custom presets (stored in electron-store), which can be deleted from Settings or the main grid.

### 5.5 `main/settings.ts` — Configuration Store

- Uses `electron-store` (JSON file at `%APPDATA%/clawwrite-settings.json`)
- API key resolution order: `electron-store` → `.env` file → empty string
- `.env` path resolves to project root in dev, `process.resourcesPath` in production

**Settings Schema:**

| Key                      | Type              | Default                        |
|--------------------------|-------------------|---------------------------------|
| `clipboardMonitorEnabled`| boolean           | `false`                         |
| `hotkey`                 | string            | `CommandOrControl+Shift+Space`  |
| `geminiModel`            | string            | `gemini-3-flash-preview`        |
| `geminiApiKey`           | string            | `""` (empty)                    |
| `customPresets`          | CustomPreset[]    | `[]`                            |
| `history`                | HistoryEntry[]    | `[]`                            |
| `autoStartEnabled`       | boolean           | `false`                         |
| `popupOpacity`           | number            | `0.96`                          |
| `maxHistoryEntries`      | number            | `20`                            |

### 5.6 `main/clipboard-monitor.ts` — Clipboard Watcher

- Polls system clipboard every 600ms
- Emits `new-text` event when clipboard content changes
- Ignores text < 15 chars or > 8000 chars
- Seeds with current clipboard on start to prevent immediate false trigger
- `updateLastSeen()` prevents re-triggering on text that ClawWrite itself placed

### 5.7 `main/popup-window.ts` — Popup Window

- Creates a frameless, transparent `BrowserWindow` (480x540px)
- The window is initialized at startup and kept "warm" (hidden) for faster display.
- Positions near cursor with screen-edge clamping
- Sends `init-text` event to renderer once window is ready
- **Stays open until explicitly closed** — no blur-to-close. The popup remains visible when the user switches to other apps.
- **Visible in taskbar** (`skipTaskbar: false`) — supports alt-tab navigation back to the popup.
- **Force-foreground on show**: temporarily sets `alwaysOnTop: true` when showing with focus to bring the window to the foreground on Windows (avoids the taskbar-flash problem), then reverts after 300ms.

### 5.8 `main/history.ts` — History Management

- Stores up to `maxHistoryEntries` (default 20) rewrites
- Each entry: source text (truncated to 200 chars), instruction, result, timestamp, preset ID
- IDs are generated as `hist_{timestamp}_{random}`
- FIFO — newest entries first, oldest trimmed

### 5.9 `main/startup.ts` — Auto-Start

- Uses Electron's `app.setLoginItemSettings()` in production
- No-op in dev mode (login items don't work for non-packaged apps)

### 5.10 `preload/index.ts` — Bridge API

Exposes `window.clawwrite` to the renderer with these methods:

- All IPC calls use `ipcRenderer.invoke()` (async, returns Promise)
- `onInitText()` returns an **unsubscribe function** for proper cleanup
- Full TypeScript declarations via `declare global { interface Window { ... } }`

### 5.11 `renderer/App.tsx` — UI Component

Single React component managing 5 phases via state:

| Phase     | UI                                                        |
|-----------|-----------------------------------------------------------|
| `idle`    | Editable source text textarea, preset grid, custom input  |
| `loading` | Animated bouncing dots, "Rewriting..." label              |
| `result`  | Editable textarea, Back/Retry/Copy/Replace buttons        |
| `settings`| API key input, custom preset list + add form              |
| `history` | Scrollable list of past rewrites with Use/Delete actions  |

**Effect structure:**
- `useEffect([], ...)` — One-time: fetch presets, fetch history, subscribe to `init-text` (with cleanup)
- `useEffect([phase], ...)` — Escape key handler (phase-aware: back vs close)

### 5.12 `renderer/index.css` — Design System

- Bold Light Theme (`rgba(255, 255, 255, 0.94)` background with subtle blur)
- Purple accent color (`#7c3aed` / vibrant gradient) with strong slate borders
- Segoe UI font family (Windows native)
- Custom 6px scrollbars
- CSS-only loading animations (bouncing dots, pulsing "capturing" text)
- Draggable header region via `-webkit-app-region: drag`

---

## 6. Data Flow Diagrams

### Hotkey → Rewrite → Replace Flow

```
User selects text in Notepad
        │
        ▼
User presses Ctrl+Shift+Space
        │
        ▼
hotkey.ts: globalShortcut fires
        │
        ▼
hotkey.ts: show "warm" popup immediately (inactive/background)
        │
        ▼
paste.ts: captureContext()
  ├─ PowerShell: GetForegroundWindow() → save HWND
  ├─ PowerShell: wait for modifier keys released
  ├─ PowerShell: keybd_event Ctrl+C
  └─ Read clipboard → return { text }
        │
        ▼
hotkey.ts: activate popup
  ├─ Send 'init-text' event with captured text
  └─ Show window active and focus it (temporarily alwaysOnTop to force foreground)
        │
        ▼
App.tsx: receives text via onInitText → phase='idle'
        │
        ▼
User clicks "Improve" preset
        │
        ▼
App.tsx: runRewrite() → phase='loading'
        │
        ▼
IPC 'rewrite' → gemini.ts: rewriteText()
  ├─ Build prompt: INSTRUCTION + TEXT TO REWRITE
  ├─ Call Gemini API with system prompt
  └─ Return rewritten text
        │
        ▼
App.tsx: phase='result', show editable textarea
        │
        ▼
User clicks "Replace"
        │
        ▼
IPC 'replace-text' → index.ts:
  ├─ Update clipboard monitor seed
  ├─ Destroy popup window
  ├─ Wait 100ms for window close
  └─ paste.ts: autoReplace()
       ├─ Write new text to clipboard
       ├─ PowerShell: SetForegroundWindow(saved HWND)
       └─ PowerShell: SendKeys Ctrl+V
```

### Recapture Flow

```
Popup is open with previously captured text
        │
        ▼
User switches to another app, selects different text
        │
        ▼
User alt-tabs back to ClawWrite, clicks "↻ Recapture"
        │
        ▼
IPC 'recapture-text' → index.ts:
  └─ paste.ts: recaptureFromWindow()
       ├─ Clear clipboard
       ├─ PowerShell: SetForegroundWindow(saved HWND) → focus original app
       ├─ PowerShell: keybd_event Ctrl+C
       └─ Read clipboard → return { text }
        │
        ▼
createAndShowPopup(newText) → Send 'init-text' → App.tsx resets to phase='idle'
```

---

## 7. Build & Development

### Commands

| Command             | Purpose                                            |
|---------------------|----------------------------------------------------|
| `npm run dev`       | Launch in dev mode with hot-reload (electron-vite)  |
| `npm run build`     | Compile TypeScript to dist/ (main, preload, renderer)|
| `npm run start`     | Run pre-built app from dist/                        |
| `npm run dist`      | Build + package NSIS installer (x64)                |
| `npm run dist:dir`  | Build + package unpacked directory (for testing)    |

### Build Output

```
dist/
├── main/index.js          # Compiled main process
├── preload/index.js        # Compiled preload script
└── renderer/
    ├── index.html          # React app entry
    ├── assets/             # Bundled JS + CSS
    └── ...
```

### Environment Variables

| Variable         | Source            | Purpose                    |
|------------------|-------------------|----------------------------|
| `GEMINI_API_KEY` | `.env` file       | Google Gemini API key       |

The API key can also be set at runtime via the Settings UI (stored in electron-store, takes priority over `.env`).

---

## 8. Key Design Decisions

1. **EncodedCommand over Temp Files**: PowerShell here-strings easily break when newlines are replaced with semicolons. Dumping temporary `.ps1` script blocks into the `%TEMP%` folder reliably triggers enterprise Security mechanisms. Standardizing on `-EncodedCommand` perfectly solves both issues, ensuring raw scripts pass into memory quietly and safely bypassing corporate AV blockers.

2. **keybd_event over SendKeys for Ctrl+C**: When the global hotkey fires, the user's modifier keys (Ctrl+Shift) may still be physically held. `SendKeys` conflicts with held modifiers. `keybd_event` sends raw virtual key events at the OS level, avoiding this.

3. **Modifier key release polling**: Before sending Ctrl+C, the app polls `GetAsyncKeyState` for Shift (0x10), Ctrl (0x11), and Space (0x20) to be released, with a 1.5s timeout. This prevents key interference.

4. **Single React component**: The popup is lightweight and short-lived. A single component with phase-based rendering avoids unnecessary complexity.

5. **Warm Window**: The popup `BrowserWindow` is initialized once at startup and re-used for every request. This shaves hundreds of milliseconds off the perceived latency.

6. **Persistent popup with taskbar visibility**: The popup no longer closes on blur. `skipTaskbar: false` makes it appear in the taskbar for alt-tab access. To bring the window to the foreground on Windows (which otherwise just flashes the taskbar), it temporarily sets `alwaysOnTop: true` on show and reverts after 300ms.

7. **Recapture uses SetForegroundWindow, not GetForegroundWindow**: During a recapture, the popup has focus so `GetForegroundWindow` would return the ClawWrite window itself. Instead, the stored HWND from the original capture is used with `SetForegroundWindow` to explicitly focus the correct target app before sending Ctrl+C. The clipboard is also cleared first to avoid returning stale content.

8. **True Capture via Clipboard Clearing**: To avoid the common bug where captures fail if the selected text is identical to the current clipboard content, ClawWrite temporarily clears the clipboard before sending `Ctrl+C`. This makes detection deterministic. The original clipboard is automatically restored if the capture returns empty.

9. **Clipboard monitor as opt-in**: Clipboard polling is disabled by default because it's aggressive — it watches everything you copy. Users can enable it via the tray menu.

---

## 9. Dependencies

### Runtime
- `@google/generative-ai` — Google Gemini SDK for Node.js
- `dotenv` — Load `.env` files
- `electron-store` — Persistent JSON settings storage

### Development
- `electron` 29 — Desktop app framework
- `electron-vite` — Vite-based build tooling for Electron
- `electron-builder` — Packaging and installer creation
- `@electron-toolkit/utils` — Helpers (dev detection)
- `@vitejs/plugin-react` — React JSX/TSX support in Vite
- `react` + `react-dom` 19 — UI framework
- `typescript` 5.4 — Type checking
- `vite` 5 — Build tool

---

## 10. Known Limitations

- **Windows only**: All OS automation uses PowerShell and Win32 APIs. No macOS/Linux support.
- **PowerShell dependency**: Requires PowerShell 5+ with access to `user32.dll` (standard on Windows 10/11).
- **No offline mode**: Requires internet access for Gemini API calls.
- **Single AI provider**: Currently hardcoded to Google Gemini. No provider abstraction.
- **No test suite**: No unit or integration tests exist yet.
- **Popup is single-component**: All UI lives in one React component (`App.tsx`). May need splitting as features grow.
