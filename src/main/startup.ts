import { app } from 'electron';
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
