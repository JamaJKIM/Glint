import { platform } from 'os';
import { globalShortcut } from 'electron';
import { BrowserWindow } from 'electron';

// Define the hotkey based on platform
export const SCREENSHOT_HOTKEY = platform() === 'darwin' 
  ? 'Command+Shift+X'  // macOS
  : 'Control+Shift+X'; // Windows/Linux

let registeredShortcuts: string[] = [];

export function registerHotkey(win: BrowserWindow, callback: () => void) {
  console.log('Starting hotkey registration process...');
  console.log('Window state:', {
    isDestroyed: win.isDestroyed(),
    isVisible: win.isVisible(),
    isFocused: win.isFocused()
  });
  
  // Unregister any existing shortcuts first
  unregisterHotkeys();
  
  const platform = process.platform;
  const shortcut = platform === 'darwin' ? 'Command+Shift+X' : 'Control+Shift+X';
  console.log('Platform:', platform);
  console.log('Using shortcut:', shortcut);

  try {
    console.log('Attempting to register global shortcut...');
    const success = globalShortcut.register(shortcut, () => {
      console.log('Hotkey triggered:', shortcut);
      console.log('Window state at trigger:', {
        isDestroyed: win.isDestroyed(),
        isVisible: win.isVisible(),
        isFocused: win.isFocused()
      });
      
      if (!win.isDestroyed()) {
        console.log('Executing hotkey callback...');
        callback();
        console.log('Hotkey callback executed successfully');
      } else {
        console.log('Window was destroyed, cannot execute hotkey callback');
      }
    });

    if (success) {
      console.log('Hotkey registered successfully');
      registeredShortcuts.push(shortcut);
    } else {
      console.error('Failed to register hotkey - globalShortcut.register returned false');
    }
  } catch (error) {
    console.error('Error registering hotkey:', error);
  }
}

export function unregisterHotkeys() {
  console.log('Unregistering hotkeys:', registeredShortcuts);
  registeredShortcuts.forEach(shortcut => {
    try {
      globalShortcut.unregister(shortcut);
      console.log('Unregistered hotkey:', shortcut);
    } catch (error) {
      console.error('Error unregistering hotkey:', shortcut, error);
    }
  });
  registeredShortcuts = [];
} 