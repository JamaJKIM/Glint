import { ipcRenderer } from 'electron';
import { CaptureRegion, ScreenshotError, ScreenshotResult } from '../types/screenshot';

let isCapturing = false;
let startX = 0;
let startY = 0;
let overlay: HTMLDivElement | null = null;
let selectionBox: HTMLDivElement | null = null;

export const initializeScreenshotCapture = () => {
  document.addEventListener('keydown', handleHotkey);
  
  // Listen for screenshot overlay request from main process
  ipcRenderer.on('show-screenshot-overlay', () => {
    startScreenshotCapture();
  });
};

const handleHotkey = (event: KeyboardEvent) => {
  // Check for Command+Shift+Control+Space on Mac or Ctrl+Shift+Alt+Space on Windows/Linux
  const isMac = process.platform === 'darwin';
  const modifier = isMac ? event.metaKey : event.ctrlKey;
  const altKey = isMac ? event.ctrlKey : event.altKey;
  
  if (modifier && event.shiftKey && altKey && event.code === 'Space') {
    event.preventDefault();
    startScreenshotCapture();
  }
};

const startScreenshotCapture = () => {
  if (isCapturing) return;
  isCapturing = true;

  // Create overlay
  overlay = document.createElement('div');
  overlay.className = 'screenshot-overlay';
  document.body.appendChild(overlay);

  // Create selection box
  selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  overlay.appendChild(selectionBox);

  // Add event listeners
  overlay.addEventListener('mousedown', handleMouseDown);
  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('mouseup', handleMouseUp);
  document.addEventListener('keydown', handleEscape);
};

const handleMouseDown = (event: MouseEvent) => {
  startX = event.clientX;
  startY = event.clientY;
  if (selectionBox) {
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
  }
};

const handleMouseMove = (event: MouseEvent) => {
  if (!selectionBox || !isCapturing) return;

  const currentX = event.clientX;
  const currentY = event.clientY;

  const width = currentX - startX;
  const height = currentY - startY;

  selectionBox.style.width = `${Math.abs(width)}px`;
  selectionBox.style.height = `${Math.abs(height)}px`;
  selectionBox.style.left = `${width > 0 ? startX : currentX}px`;
  selectionBox.style.top = `${height > 0 ? startY : currentY}px`;
};

const handleMouseUp = async () => {
  if (!selectionBox || !overlay) return;

  const region: CaptureRegion = {
    x: parseInt(selectionBox.style.left),
    y: parseInt(selectionBox.style.top),
    width: parseInt(selectionBox.style.width),
    height: parseInt(selectionBox.style.height)
  };

  try {
    const result = await ipcRenderer.invoke('capture-screen', region);
    console.log('Screenshot saved:', result.filepath);
  } catch (error) {
    const screenshotError = error as ScreenshotError;
    console.error('Screenshot capture failed:', screenshotError.message);
  }

  cleanup();
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    cleanup();
  }
};

const cleanup = () => {
  if (overlay) {
    overlay.removeEventListener('mousedown', handleMouseDown);
    overlay.removeEventListener('mousemove', handleMouseMove);
    overlay.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('keydown', handleEscape);
    document.body.removeChild(overlay);
  }
  overlay = null;
  selectionBox = null;
  isCapturing = false;
};

export const captureScreenshot = async (region: CaptureRegion): Promise<ScreenshotResult> => {
  try {
    const result = await ipcRenderer.invoke('take-screenshot', region);
    return result;
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    throw error;
  }
};

export function initializeScreenshotListeners() {
  // Add any renderer-specific screenshot initialization here
  console.log('Screenshot listeners initialized in renderer process');
} 