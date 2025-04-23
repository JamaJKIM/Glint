import { desktopCapturer, screen, Rectangle } from 'electron';
import { ScreenshotResult } from '../types/screenshot';
import sharp from 'sharp';
import { logger } from './logger';

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Track if a capture is in progress to prevent race conditions
let isCapturing = false;

export async function captureScreen(region?: CaptureRegion): Promise<ScreenshotResult> {
  if (isCapturing) {
    logger.warn('Screenshot capture already in progress, ignoring request');
    return {
      success: false,
      error: 'A screenshot capture is already in progress'
    };
  }

  try {
    isCapturing = true;
    
    // Get the primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    const scaleFactor = primaryDisplay.scaleFactor || 1;

    // If no region is specified, capture the entire screen
    const captureRegion: Rectangle = region || { x: 0, y: 0, width, height };

    logger.info('Capturing screen with region', { region: captureRegion, scaleFactor });

    // Validate region bounds before capture
    if (captureRegion.x < 0 || captureRegion.y < 0 || 
        captureRegion.width <= 0 || captureRegion.height <= 0 ||
        captureRegion.x + captureRegion.width > width ||
        captureRegion.y + captureRegion.height > height) {
      throw new Error(`Invalid region bounds: ${JSON.stringify(captureRegion)}`);
    }

    // Capture the screen with scaled dimensions
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor)
      }
    });

    if (!sources.length) {
      throw new Error('No screen sources found');
    }

    const source = sources[0];
    if (!source.thumbnail) {
      throw new Error('Failed to capture screen thumbnail');
    }

    // Get the image buffer and verify it's not empty
    const imageBuffer = source.thumbnail.toPNG();
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Screenshot capture produced empty buffer');
    }

    logger.info('Successfully captured screenshot', { bufferSize: imageBuffer.length });

    // If a region is specified, crop the image
    if (region) {
      // Scale the region coordinates for Retina displays
      const scaledRegion = {
        left: Math.round(region.x * scaleFactor),
        top: Math.round(region.y * scaleFactor),
        width: Math.round(region.width * scaleFactor),
        height: Math.round(region.height * scaleFactor)
      };

      logger.info('Cropping with scaled region', { region: scaledRegion });

      try {
        const croppedImage = await sharp(imageBuffer)
          .extract(scaledRegion)
          .toBuffer();

        if (!croppedImage || croppedImage.length === 0) {
          throw new Error('Failed to crop screenshot - empty buffer after crop');
        }
        
        logger.info('Successfully cropped screenshot', { bufferSize: croppedImage.length });
        
        return {
          success: true,
          data: croppedImage.toString('base64')
        };
      } catch (cropError) {
        logger.error('Error cropping screenshot', { error: cropError });
        throw new Error(`Failed to crop screenshot: ${cropError instanceof Error ? cropError.message : 'Unknown error'}`);
      }
    }

    // If no region specified, return the full screenshot
    logger.info('Returning full screenshot', { bufferSize: imageBuffer.length });
    return {
      success: true,
      data: imageBuffer.toString('base64')
    };
  } catch (error) {
    logger.error('Error capturing screenshot', { error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to capture screenshot'
    };
  } finally {
    isCapturing = false;
  }
}

export function calculateRegion(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): CaptureRegion {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  return { x, y, width, height };
} 