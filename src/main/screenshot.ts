import { ipcMain, desktopCapturer, screen } from 'electron';
import { CaptureRegion, ScreenshotResult, ScreenshotError } from '../types/screenshot';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export function initializeScreenshotHandlers() {
  ipcMain.handle('capture-screenshot', async (_event, region: CaptureRegion): Promise<ScreenshotResult> => {
    try {
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();

      // Get all sources
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: primaryDisplay.size.width,
          height: primaryDisplay.size.height
        }
      });

      if (!sources || sources.length === 0) {
        throw new ScreenshotError('No screen sources found');
      }

      // Get the primary display source
      const source = sources.find(s => s.display_id === primaryDisplay.id.toString()) || sources[0];
      
      if (!source.thumbnail) {
        throw new ScreenshotError('Failed to capture screen thumbnail');
      }

      // Create screenshots directory if it doesn't exist
      const screenshotsDir = path.join(app.getPath('userData'), 'screenshots');
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(screenshotsDir, filename);

      // Save the screenshot
      fs.writeFileSync(filepath, source.thumbnail.toPNG());

      return { 
        success: true,
        data: source.thumbnail.toPNG().toString('base64')
      };
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      throw new ScreenshotError(error instanceof Error ? error.message : 'Failed to capture screenshot');
    }
  });
} 