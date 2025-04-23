import { contextBridge, ipcRenderer } from 'electron';
import { CaptureRegion } from '../types/screenshot';

async function captureScreen(region: CaptureRegion): Promise<string> {
  try {
    const screenshotPath = await ipcRenderer.invoke('capture-screen', region);
    return screenshotPath;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
}

contextBridge.exposeInMainWorld('screenshot', {
  captureScreen,
  
  onScreenshotComplete: (callback: (path: string) => void) => {
    ipcRenderer.on('screenshot:complete', (_event, path) => callback(path));
    return () => {
      ipcRenderer.removeAllListeners('screenshot:complete');
    };
  },
  
  onScreenshotError: (callback: (error: Error) => void) => {
    ipcRenderer.on('screenshot:error', (_event, error) => callback(error));
    return () => {
      ipcRenderer.removeAllListeners('screenshot:error');
    };
  }
}); 