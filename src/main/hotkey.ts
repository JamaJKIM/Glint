import { globalShortcut } from 'electron';

export function registerHotkey(accelerator: string, callback: () => void): void {
  // Unregister any existing registration of the accelerator
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator);
  }

  // Register the new hotkey
  const success = globalShortcut.register(accelerator, callback);
  
  if (!success) {
    console.error(`Failed to register hotkey: ${accelerator}`);
  } else {
    console.log(`Successfully registered hotkey: ${accelerator}`);
  }
}

export function unregisterHotkey(accelerator: string): void {
  if (globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator);
    console.log(`Unregistered hotkey: ${accelerator}`);
  }
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
  console.log('Unregistered all hotkeys');
}

// Define platform-specific hotkey
export const SCREENSHOT_HOTKEY = process.platform === 'darwin' 
  ? 'Command+Shift+Control+Space'
  : 'Ctrl+Shift+Alt+Space'; 