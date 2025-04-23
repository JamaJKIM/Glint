import { ipcMain } from 'electron';
import { captureScreen } from '../services/screenshot';
import { CaptureRegion, ScreenshotResult } from '../types/screenshot';

export function setupScreenshotHandlers() {
  ipcMain.handle('screenshot:capture', async (_event, region?: CaptureRegion): Promise<ScreenshotResult> => {
    try {
      return await captureScreen(region);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture screenshot'
      };
    }
  });
} 