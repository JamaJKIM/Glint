import { platform } from 'os';
import { globalShortcut } from 'electron';

// Define the hotkey based on platform
export const SCREENSHOT_HOTKEY = platform() === 'darwin' 
  ? 'Command+Shift+X'  // macOS
  : 'Control+Shift+X'; // Windows/Linux

export function registerHotkey(hotkey: string, callback: () => void): void {
  try {
    // Unregister any existing shortcuts first
    globalShortcut.unregisterAll();
    
    // Register the new hotkey
    const success = globalShortcut.register(hotkey, () => {
      console.log('Hotkey pressed:', hotkey);
      callback();
    });

    if (!success) {
      throw new Error(`Failed to register hotkey: ${hotkey}`);
    }

    console.log('Hotkey registered successfully:', hotkey);
  } catch (error) {
    console.error('Error registering hotkey:', error);
    throw error;
  }
}

// Cleanup function to unregister all hotkeys
export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll();
  console.log('Unregistered all hotkeys');
} 