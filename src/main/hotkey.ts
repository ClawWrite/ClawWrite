import { globalShortcut } from 'electron';
import { store } from './settings.js';
import { captureContext } from './paste.js';
import { createAndShowPopup, destroyPopup, isPopupOpen } from './popup-window.js';

let hotkeyLock = false;

export function registerHotkey(): boolean {
  const hotkey = store.get('hotkey');

  const registered = globalShortcut.register(hotkey, async () => {
    if (hotkeyLock) return;
    
    // Toggle: if popup is already open and visible, close it
    if (isPopupOpen()) {
      destroyPopup();
      return;
    }

    hotkeyLock = true;
    try {
      // 1. Show "warm" popup immediately at cursor location but without focus
      // This gives near-instant visual feedback.
      createAndShowPopup('', false);

      // 2. Start capturing context (gets HWND + polls for key release + sends Ctrl+C)
      const { text } = await captureContext();

      // 3. Final show: update text and take focus
      createAndShowPopup(text || '', true);
    } finally {
      // Small cooldown to prevent debounce-like flickering on fast repeat
      setTimeout(() => { hotkeyLock = false; }, 400);
    }
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
