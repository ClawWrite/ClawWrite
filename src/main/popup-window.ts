import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { is } from '@electron-toolkit/utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 540;
const CURSOR_OFFSET = 14; // pixels from cursor

let popupWindow: BrowserWindow | null = null;

/**
 * Initializes the popup window in a hidden state so it's ready to show instantly.
 */
export function initPopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) return;

  const { x, y } = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint({ x, y });

  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    show: false, // Start hidden
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: false,
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

  // Popup stays open until explicitly closed (Escape, Copy, Replace, or close button).
  // This lets the user alt-tab to other apps and come back.
}

export function isPopupOpen(): boolean {
  return popupWindow !== null && !popupWindow.isDestroyed() && popupWindow.isVisible();
}

export function createAndShowPopup(sourceText: string, focus: boolean = true): void {
  if (!popupWindow || popupWindow.isDestroyed()) {
    initPopup();
  }

  const { x, y } = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint({ x, y });
  const { bounds } = display;

  // Calculate position
  let posX = x + CURSOR_OFFSET;
  let posY = y + CURSOR_OFFSET;
  if (posX + POPUP_WIDTH > bounds.x + bounds.width) posX = x - POPUP_WIDTH - CURSOR_OFFSET;
  if (posY + POPUP_HEIGHT > bounds.y + bounds.height) posY = y - POPUP_HEIGHT - CURSOR_OFFSET;
  
  posX = Math.max(bounds.x, Math.min(posX, bounds.x + bounds.width - POPUP_WIDTH));
  posY = Math.max(bounds.y, Math.min(posY, bounds.y + bounds.height - POPUP_HEIGHT));

  if (popupWindow) {
    popupWindow.setPosition(posX, posY);

    if (focus) {
      // Temporarily set alwaysOnTop to force the window to the foreground
      // on Windows (otherwise it just blinks in the taskbar).
      popupWindow.setAlwaysOnTop(true);
      if (!popupWindow.isVisible()) popupWindow.show();
      popupWindow.focus();
      setTimeout(() => {
        if (popupWindow && !popupWindow.isDestroyed()) {
          popupWindow.setAlwaysOnTop(false);
        }
      }, 300);
    } else {
      if (!popupWindow.isVisible()) popupWindow.showInactive();
    }

    if (sourceText !== undefined) {
      popupWindow.webContents.send('init-text', sourceText);
    }
  }
}

export function hidePopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
  }
}

export function destroyPopup(): void {
  hidePopup(); // Consistency: for the rest of the app, "destroy" now just hides
}

export function getPopupWindow(): BrowserWindow | null {
  return popupWindow;
}
