import Store from 'electron-store';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
  hotkey: string;
  defaultMode: 'search' | 'assignment';
  openaiApiKey: string;
  windowPreferences: {
    width: number;
    height: number;
  };
}

const store = new Store<Config>({
  defaults: {
    hotkey: process.platform === 'darwin' ? 'Command+Shift+Control+Space' : 'Ctrl+Shift+Alt+Space',
    defaultMode: 'search',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    windowPreferences: {
      width: 400,
      height: 300
    }
  }
});

export const config = {
  get: <T extends keyof Config>(key: T): Config[T] => {
    const value = store.get(key);
    // Special handling for API key to ensure it's always loaded from env if available
    if (key === 'openaiApiKey' && process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_API_KEY as Config[T];
    }
    return value;
  },
  set: <T extends keyof Config>(key: T, value: Config[T]): void => store.set(key, value),
  reset: (): void => store.clear()
};

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Alt+Space';
export const SUPPORTED_MODES = ['search', 'assignment'] as const; 