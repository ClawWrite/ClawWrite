# ClawWrite — Changelog

All notable changes to this project are documented in this file.

---

## [1.0.3] — 2026-03-24

### Fixes & Enhancements
- **Enterprise Network Compatibility**: Rewrote the underlying clipboard capture and text replacement engine to execute PowerShell instructions inline via base64 `-EncodedCommand`. This completely bypasses AppLocker execution policies and Antivirus blocks triggered by writing and executing temporary `.ps1` scripts from the Windows `%TEMP%` folder, significantly improving office network reliability.
- **Resilient Empty State**: When the global hotkey is pressed without any text selected (or if native text capture fails), the popup no longer crashes or force-closes. It now gracefully remains open. To support this seamlessly, the static "Capturing selection..." label has been replaced with an interactive editable `<textarea>`, allowing users to manually type or paste their source text directly into the popup.

---

## [1.0.2] — 2026-03-24

### Features
- **Recapture Button**: Added a "↻ Recapture" button in the source preview header. While the popup is open, the user can switch to another app, select different text, then click Recapture — ClawWrite focuses the original app via `SetForegroundWindow`, sends Ctrl+C, and reloads the popup with the new selection. No need to close and re-trigger the hotkey.

### Enhancements
- **Persistent Popup (Taskbar-Visible)**: The popup no longer closes when it loses focus. It now appears in the Windows taskbar (`skipTaskbar: false`) and supports alt-tab, so users can switch between apps and return to ClawWrite at any time.
- **Force-Foreground on Show**: On Windows, hidden Electron windows re-appear as a taskbar flash rather than coming to the foreground. Fixed by temporarily setting `alwaysOnTop: true` when showing the popup with focus, then reverting to `false` after 300ms.
- **Result Textarea Fills Available Space**: The result textarea now stretches to fill all remaining vertical space in the popup, leaving no wasted gap below it.

### Fixes
- **Branding: "CLAWWRITE" → "ClawWrite"**: Removed `text-transform: uppercase` from the `.logo` CSS rule. The header now displays the correct mixed-case brand name.
- **Removed Blur-to-Close and Capturing Lock**: Deleted the `blur` event handler, the `isCapturingText` flag, and the `setCapturingState()` export from `popup-window.ts`, and removed all call sites in `hotkey.ts`. These were only needed to suppress accidental closes — now moot since the popup no longer closes on blur.

---

## [1.0.1] — 2026-03-23

### Enhancements
- **Near-Instant Popup**: Redesigned the hotkey flow to show a "warm" popup instantly before text capture is fully complete, significantly reducing perceived latency.
- **Bold Light Theme**: Transitioned the app UI from a dark glassmorphism theme to a premium "#Bold Light" theme featuring solid white backgrounds, stronger borders, and vibrant purple accents for higher contrast and better readability in all environments.
- **Fetching State UI**: Added a subtle pulsing "Capturing selection..." animation to the source preview box while text is being parsed from the clipboard.

### Fixes
- **Improved Capture Reliability**: Slightly increased the internal clipboard read timeout to ensure reliability across slower applications.
- **Popup Disappearing Fix**: Implemented a capture-state lock, a delayed lock release timer, and an `isCapturingText` suppression flag to prevent stray focus "blur" events from accidentally closing the popup during the rapid multi-step capture flow.

---

## [1.0.0] — 2026-03-23

### Initial Release
First working version of ClawWrite — a system-wide AI writing assistant for Windows.

### Features

- **Global hotkey** (Ctrl+Shift+Space) to trigger rewrite popup from any application
- **8 built-in presets**: Improve, Make Formal, Make Casual, Shorten, Expand, Fix Grammar, Bullet Points, Summarise
- **Custom instruction input** for freeform rewrite requests
- **Copy** result to clipboard
- **Replace** — auto-paste result directly back into the originating application
- **Custom presets** — create and manage user-defined rewrite actions via Settings UI
- **Rewrite history** — view and reuse past rewrites (up to 20 entries)
- **Editable results** — modify AI output in the result textarea before copying/replacing
- **Clipboard monitor** (opt-in) — auto-show popup when text is copied
- **System tray** integration with context menu for settings and controls
- **Auto-start with Windows** support (production builds)
- **Settings UI** — API key management, custom preset CRUD
- **Glassmorphism dark theme** with purple accents
- **Google Gemini API** integration (`gemini-3-flash-preview`)

### Bug Fixes (pre-release)

- **Fixed: Hotkey sent "c" character into target app instead of copying text**
  - **Root cause**: `SendKeys::SendWait("^c")` was called while the user's Ctrl+Shift modifier keys from the hotkey were still physically held, causing Windows to interpret it as a bare "c" keypress.
  - **Fix**: Replaced `SendKeys` with `keybd_event()` (low-level Win32 key simulation) and added `GetAsyncKeyState()` polling to wait until all modifier keys are released before sending Ctrl+C.

- **Fixed: PowerShell here-string syntax broke when inlined**
  - **Root cause**: PowerShell scripts were executed as inline `-Command` strings by replacing newlines with `; `. This breaks `@'...'@` and `@"..."@` here-string blocks which require literal newlines.
  - **Fix**: Switched to writing temp `.ps1` files and executing with `-File` flag. Temp files are cleaned up after execution.

- **Fixed: Popup silently failed to appear for short text selections**
  - **Root cause**: `hotkey.ts` required selected text to be at least 10 characters. Shorter selections were silently ignored.
  - **Fix**: Removed the minimum length requirement. Any non-empty selection now triggers the popup.

- **Fixed: Event listener leak in React renderer**
  - **Root cause**: `onInitText` IPC listener was registered inside a `useEffect` with `[phase]` dependency, meaning a new listener was added every time the phase changed (5 possible states) with no cleanup. This caused duplicate state updates and memory leaks.
  - **Fix**: Split into two effects — a one-time effect (`[]`) for `onInitText`/presets/history, and a phase-dependent effect (`[phase]`) for the Escape key handler. Modified `onInitText` in the preload bridge to return an unsubscribe function for proper cleanup.

- **Fixed: Missing error handling in Replace flow**
  - **Root cause**: The `replace-text` IPC handler and `autoReplace()` function had no try-catch around PowerShell execution. If PowerShell failed (execution policy, invalid window handle, etc.), the error was unhandled, and the user got no feedback since the popup was already destroyed.
  - **Fix**: Added try-catch with console logging in both `autoReplace()` and the `replace-text` IPC handler.

- **Added: 10-second timeout on PowerShell execution**
  - Prevents the app from hanging indefinitely if a PowerShell process gets stuck.

### Technical Details

- **Runtime**: Electron 29 + React 19 + TypeScript 5.4
- **Build**: electron-vite 2.3.0
- **AI**: Google Gemini API via `@google/generative-ai` SDK
- **Packaging**: electron-builder with NSIS installer (Windows x64)
- **OS Integration**: PowerShell 5+ with Win32 P/Invoke (`user32.dll`)
