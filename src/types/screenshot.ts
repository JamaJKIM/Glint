export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotResult {
  success: boolean;
  data?: string; // Base64 encoded image data
  error?: string;
}

export interface ScreenshotOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  onCapture: (region: CaptureRegion) => void;
}

export class ScreenshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreenshotError';
  }
}

export interface ScreenshotWindow {
  captureScreen: (region: CaptureRegion) => Promise<string>;
} 