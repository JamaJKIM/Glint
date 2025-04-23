import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import * as path from 'path';
import fs from 'fs';
import { initialize, enable } from '@electron/remote/main';
import { captureScreen } from './services/screenshot';
import { config } from './config';
import { setupLogging } from './main/logging';
import { registerHotkey, SCREENSHOT_HOTKEY } from './main/hotkey';
import { analyzeImage } from './services/openai';
import { logger as appLogger } from './services/logger';
import { openai } from './services/openai';

// Initialize remote module
initialize();

// Create logs directory if it doesn't exist
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a logger function that writes to a file
const logFile = path.join(logsDir, 'app.log');
const logger = {
  log: (message: string, data?: any) => {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
      fs.appendFileSync(logFile, logMessage);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }
};

let mainWindow: Electron.BrowserWindow | null = null;
let overlayWindow: Electron.BrowserWindow | null = null;
let responseWindow: Electron.BrowserWindow | null = null;

function createOverlayWindow(): Electron.BrowserWindow {
  const point = screen.getCursorScreenPoint();
  const displayToUse = screen.getDisplayNearestPoint(point);
  const { width, height } = displayToUse.bounds;
  
  const window = new BrowserWindow({
    width,
    height,
    x: displayToUse.bounds.x,
    y: displayToUse.bounds.y,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true
    },
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    focusable: true,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    opacity: 1.0
  });

  // Platform-specific settings
  if (process.platform === 'darwin') {
    // macOS specific settings
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setAlwaysOnTop(true, 'screen-saver');
  } else if (process.platform === 'win32') {
    // Windows specific settings
    window.setAlwaysOnTop(true, 'normal');
  }

  // Initially set to ignore mouse events, but allow clicking through
  window.setIgnoreMouseEvents(true, { forward: true });

  const htmlPath = path.join(__dirname, '../public/overlay.html');
  window.loadFile(htmlPath).catch((err) => {
    console.error('Failed to load overlay HTML:', err);
    appLogger.log('Failed to load overlay HTML', err);
  });

  window.on('closed', () => {
    overlayWindow = null;
  });

  overlayWindow = window;
  return window;
}

function activateOverlayWindow() {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.moveTop();
    // Enable mouse events for the overlay
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.webContents?.send('activate-overlay');
  } else {
    const window = createOverlayWindow();
    window.webContents.once('did-finish-load', () => {
      if (overlayWindow) {
        overlayWindow.show();
        overlayWindow.focus();
        overlayWindow.moveTop();
        // Enable mouse events for the overlay
        overlayWindow.setIgnoreMouseEvents(false);
        overlayWindow.webContents?.send('activate-overlay');
      }
    });
  }
}

function createResponseWindow(content: string, mode: string, x: number, y: number) {
  try {
    if (responseWindow) {
      responseWindow.close();
      responseWindow = null;
    }

    // Create initial window with minimum size
    responseWindow = new BrowserWindow({
      width: 300,
      height: 150,
      x: Math.floor(x),  // Ensure coordinates are integers
      y: Math.floor(y),  // Ensure coordinates are integers
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: false,
      resizable: true,
      movable: true,
      minWidth: 250,
      minHeight: 100,
      maxWidth: 800,
      maxHeight: 600
    });

    responseWindow.loadFile('public/response-window.html');
    
    responseWindow.webContents.on('did-finish-load', () => {
      if (responseWindow && !responseWindow.isDestroyed()) {
        // Ensure content is a string and mode is valid
        const safeContent = String(content).trim();
        const safeMode = String(mode).trim();
        
        responseWindow.webContents.send('update-content', {
          content: safeContent,
          mode: safeMode
        });
      }
    });

    // Handle content size updates from renderer
    ipcMain.on('update-content-size', (event, { width, height }) => {
      if (responseWindow && !responseWindow.isDestroyed()) {
        // Ensure dimensions are integers
        const finalWidth = Math.min(800, Math.floor(width + 32));
        const finalHeight = Math.min(600, Math.floor(height + 60));
        responseWindow.setSize(finalWidth, finalHeight);
        responseWindow.show();
      }
    });

    // Handle window resizing
    ipcMain.on('resize-window', (event, factor) => {
      if (responseWindow && !responseWindow.isDestroyed()) {
        const [width, height] = responseWindow.getSize();
        const newWidth = Math.max(250, Math.min(800, Math.floor(width * factor)));
        const newHeight = Math.max(100, Math.min(600, Math.floor(height * factor)));
        responseWindow.setSize(newWidth, newHeight);
      }
    });

    responseWindow.on('closed', () => {
      // Clean up the handlers
      ipcMain.removeHandler('update-content-size');
      ipcMain.removeHandler('resize-window');
      responseWindow = null;
    });
  } catch (error) {
    console.error('Error creating response window:', error);
    // Clean up if window creation fails
    if (responseWindow && !responseWindow.isDestroyed()) {
      responseWindow.destroy();
      responseWindow = null;
    }
  }
}

function createWindow() {
  if (mainWindow) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    backgroundColor: '#00000000',
  });

  // Enable remote module for the window
  enable(mainWindow.webContents);

  // Determine the correct path to index.html
  const isDev = process.env.NODE_ENV === 'development';
  const htmlPath = isDev
    ? path.join(__dirname, '../public/index.html')
    : path.join(__dirname, '../public/index.html');

  console.log('Loading HTML from:', htmlPath);
  
  mainWindow.loadFile(htmlPath).catch((err) => {
    console.error('Failed to load HTML:', err);
    appLogger.log('Failed to load HTML', err);
    // Try alternative path if first attempt fails
    const altPath = path.join(__dirname, 'public/index.html');
    console.log('Trying alternative path:', altPath);
    return mainWindow?.loadFile(altPath);
  });

  mainWindow.once('ready-to-show', () => {
    // Don't show the window automatically
    // mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('blur', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  setupLogging();
  createWindow();
  
  try {
    registerHotkey(SCREENSHOT_HOTKEY, () => {
      console.log('Hotkey pressed, activating overlay window');
      activateOverlayWindow();
    });
  } catch (error) {
    console.error('Failed to register hotkey:', error);
    appLogger.log('Failed to register hotkey', error);
  }
}).catch(error => {
  console.error('Failed to initialize app:', error);
  appLogger.log('Failed to initialize app', error);
});

// Handle screenshot request
ipcMain.on('take-screenshot', async (event) => {
  try {
    console.log('Screenshot requested');
    activateOverlayWindow();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error handling screenshot request:', errorMessage);
    appLogger.log('Error handling screenshot request', errorMessage);
    event.reply('screenshot-error', errorMessage);
  }
});

// Handle screenshot capture
ipcMain.on('capture-screenshot', async (event, region) => {
  try {
    console.log('Capturing screenshot for region:', region);
    
    // Validate region
    if (!region || typeof region.x !== 'number' || typeof region.y !== 'number' || 
        typeof region.width !== 'number' || typeof region.height !== 'number' ||
        region.width <= 0 || region.height <= 0) {
      throw new Error('Invalid screenshot region');
    }

    const screenshot = await captureScreen(region);
    
    if (!screenshot.success) {
      throw new Error(screenshot.error || 'Failed to capture screenshot');
    }

    if (!screenshot.data) {
      throw new Error('No screenshot data received');
    }

    console.log('Screenshot captured successfully, analyzing with OpenAI...');
    const response = await analyzeImage(screenshot.data, 'search');
    
    // Ensure response is a string
    if (typeof response !== 'string') {
      throw new Error('Invalid response format from OpenAI');
    }

    // Log the response we're about to send
    console.log('Sending response to renderer:', response);

    // Calculate position to be under the screenshot area
    const screenPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(screenPoint);
    
    // Ensure the window appears below the screenshot area but stays within screen bounds
    const x = Math.min(Math.max(region.x, 0), display.bounds.width - 400);
    const y = Math.min(region.y + region.height + 20, display.bounds.height - 300);

    try {
      // Create response window with the OpenAI response
      createResponseWindow(response, 'search', x, y);
      
      // Clean up the overlay window after a short delay to ensure smooth transition
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.hide();
          overlayWindow.destroy();
          overlayWindow = null;
        }
      }, 100);
    } catch (error) {
      console.error('Error creating response window:', error);
      // If we fail to create the response window, make sure we clean up
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.destroy();
        overlayWindow = null;
      }
    }
  } catch (error) {
    console.error('Error handling screenshot:', error);
    if (overlayWindow) {
      overlayWindow.webContents.send('screenshot-analyzed', {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process screenshot'
      });
    }
  }
});

// Handle screenshot cancel
ipcMain.on('cancel-screenshot', () => {
  console.log('Canceling screenshot');
  if (overlayWindow) {
    try {
      overlayWindow.hide();
      overlayWindow.destroy();
      overlayWindow = null;
    } catch (error) {
      console.error('Error canceling screenshot:', error);
    }
  }
});

// Handle window hide request
ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// Handle overlay activation state
ipcMain.on('set-overlay-active', () => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(false);
  }
});

ipcMain.on('set-overlay-inactive', () => {
  if (overlayWindow) {
    // Ignore mouse events but allow interaction with response window
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  }
});

// Handle show response
ipcMain.on('show-response', (event, response) => {
  if (responseWindow) {
    responseWindow.close();
  }
  
  responseWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  responseWindow.loadFile('public/response-window.html');
  
  responseWindow.webContents.on('did-finish-load', () => {
    if (responseWindow) {
      responseWindow.webContents.send('update-content', {
        content: response,
        x: 0,
        y: 0
      });
    }
  });

  responseWindow.on('closed', () => {
    responseWindow = null;
  });
});

// Handle force exit overlay
ipcMain.on('force-exit-overlay', () => {
  console.log('Force exit overlay requested');
  if (overlayWindow) {
    try {
      overlayWindow.destroy();
      overlayWindow = null;
    } catch (error) {
      console.error('Error destroying overlay window:', error);
    }
  }
});

// Handle window dragging
ipcMain.on('start-window-drag', () => {
  if (responseWindow) {
    responseWindow.setMovable(true);
  }
});

// Handle close response window
ipcMain.on('close-response-window', () => {
  if (responseWindow) {
    responseWindow.close();
    responseWindow = null;
  }
});

// Handle response refinement
ipcMain.on('refine-response', async (event, { originalContent, refinementPrompt }) => {
  try {
    console.log('Refining response with prompt:', refinementPrompt);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a technical expert. Refine or modify the previous response based on the user's request. Keep the same formatting style but adjust the content as requested."
        },
        {
          role: "assistant",
          content: originalContent
        },
        {
          role: "user",
          content: refinementPrompt
        }
      ],
      max_tokens: 500
    });

    const refinedContent = response.choices[0]?.message?.content;
    if (!refinedContent) {
      throw new Error('No response content from refinement');
    }

    // Send the refined content back to the window
    if (responseWindow && !responseWindow.isDestroyed()) {
      responseWindow.webContents.send('update-content', {
        content: refinedContent.trim(),
        mode: 'search'  // Keep the same mode
      });
    }
  } catch (error) {
    console.error('Error refining response:', error);
    if (responseWindow && !responseWindow.isDestroyed()) {
      responseWindow.webContents.send('refinement-error', {
        error: error instanceof Error ? error.message : 'Failed to refine response'
      });
    }
  }
});

// Handle cleanup more gracefully
app.on('will-quit', () => {
  try {
    // Unregister all shortcuts
    globalShortcut.unregisterAll();
    
    // Clean up any remaining windows
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.destroy();
      }
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    appLogger.log('Error during cleanup', error);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  appLogger.log('Uncaught Exception', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  appLogger.log('Unhandled Rejection', { reason, promise });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});