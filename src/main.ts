import { app, BrowserWindow, globalShortcut, ipcMain, screen, dialog } from 'electron';
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

// Check if running under Wine
const isWine = process.platform === 'win32' && process.env.WINEPREFIX;

function showWineNotSupportedDialog() {
  const { dialog } = require('electron');
  dialog.showMessageBox({
    type: 'warning',
    title: 'Platform Not Supported',
    message: 'Running under Wine is not supported',
    detail: 'This application is designed to run natively on Windows or macOS. Please use the appropriate version for your operating system.',
    buttons: ['OK'],
    defaultId: 0
  }).then(() => {
    app.quit();
  });
}

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
    // Windows-specific settings
    ...(process.platform === 'win32' ? {
      thickFrame: false,
      roundedCorners: false,
      visualEffectState: 'inactive',
      backgroundMaterial: 'none',
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 0, y: 0 }
    } : {})
  });

  // Platform-specific settings
  if (process.platform === 'darwin') {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setAlwaysOnTop(true, 'screen-saver');
  } else {
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setMenu(null); // Remove menu bar on Windows
  }

  // For Windows, we need to ensure proper transparency
  if (process.platform === 'win32') {
    window.setBackgroundColor('#00000000');
    window.setOpacity(0.99); // Slight opacity to ensure proper rendering
  }

  // Initially set to ignore mouse events, but allow clicking through
  window.setIgnoreMouseEvents(true, { forward: true });

  const htmlPath = path.join(__dirname, '..', 'public', 'overlay.html').replace(/\\/g, '/');
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

function showLog(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(logMessage);
  // Show in a dialog for critical messages
  if (message.includes('error') || message.includes('failed')) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Glint Error',
      message: logMessage,
      buttons: ['OK']
    });
  }
}

function createResponseWindow(content: string, mode: string, x: number, y: number) {
  try {
    showLog('Starting response window creation...');
    if (responseWindow) {
      showLog('Closing existing response window');
      responseWindow.close();
      responseWindow = null;
    }

    // Create initial window with minimum size
    showLog('Creating new BrowserWindow with position:', { x, y });
    responseWindow = new BrowserWindow({
      width: 500,
      height: 300,
      x: Math.floor(x),
      y: Math.floor(y),
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      show: true,
      resizable: true,
      movable: true,
      minWidth: 300,
      minHeight: 150,
      maxWidth: 800,
      maxHeight: 600,
      backgroundColor: '#ffffff',
      // Windows-specific settings
      ...(process.platform === 'win32' ? {
        thickFrame: false,
        roundedCorners: false,
        visualEffectState: 'inactive',
        backgroundMaterial: 'none',
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 0, y: 0 }
      } : {})
    });

    showLog('Response window created, loading HTML...');
    const htmlPath = path.join(__dirname, '..', 'public', 'response-window.html').replace(/\\/g, '/');
    showLog('Loading HTML from:', htmlPath);
    
    responseWindow.loadFile(htmlPath).catch((err) => {
      showLog('Failed to load response window HTML:', err);
    });
    
    responseWindow.webContents.on('did-finish-load', () => {
      showLog('Response window HTML loaded, sending content...');
      if (responseWindow && !responseWindow.isDestroyed()) {
        const safeContent = String(content).trim();
        const safeMode = String(mode).trim();
        
        responseWindow.webContents.send('update-content', {
          content: safeContent,
          mode: safeMode
        });
        showLog('Content sent to response window');

        // Force show and focus the window
        showLog('Forcing window visibility...');
        responseWindow.show();
        responseWindow.focus();
        responseWindow.moveTop();
        showLog('Response window shown, focused, and moved to top');
      } else {
        showLog('Response window destroyed before content could be sent');
      }
    });

    // Handle window closing
    responseWindow.on('closed', () => {
      showLog('Response window closed');
      responseWindow = null;
    });

  } catch (error) {
    showLog('Error in createResponseWindow:', error);
    if (responseWindow && !responseWindow.isDestroyed()) {
      responseWindow.destroy();
      responseWindow = null;
    }
    throw error;
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

  console.log('Creating main window...');
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
    // Windows-specific settings
    ...(process.platform === 'win32' ? {
      thickFrame: false,
      roundedCorners: false,
      visualEffectState: 'active',
      backgroundMaterial: 'acrylic',
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 0, y: 0 }
    } : {})
  });

  // Windows-specific window behavior
  if (process.platform === 'win32') {
    mainWindow.setMenu(null); // Remove menu bar on Windows
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  console.log('Main window created, enabling remote module...');
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
    console.log('Main window is ready to show');
    // Don't show the window automatically
    // mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });

  mainWindow.on('blur', () => {
    console.log('Main window lost focus');
    if (mainWindow) {
      mainWindow.hide();
    }
  });
}

app.whenReady().then(() => {
  console.log('Application is ready');
  // Check for Wine first
  if (isWine) {
    console.log('Running under Wine, showing not supported dialog');
    showWineNotSupportedDialog();
    return;
  }

  console.log('Setting up logging...');
  setupLogging();
  console.log('Creating main window...');
  createWindow();
  
  try {
    if (mainWindow) {
      console.log('Registering hotkey...');
      registerHotkey(mainWindow, () => {
        console.log('Hotkey pressed, activating overlay window');
        activateOverlayWindow();
      });
    } else {
      console.error('Main window not available for hotkey registration');
    }
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
      console.error('Invalid screenshot region:', region);
      throw new Error('Invalid screenshot region');
    }

    const screenshot = await captureScreen(region);
    console.log('Screenshot captured:', screenshot.success);
    
    if (!screenshot.success) {
      console.error('Screenshot capture failed:', screenshot.error);
      throw new Error(screenshot.error || 'Failed to capture screenshot');
    }

    if (!screenshot.data) {
      console.error('No screenshot data received');
      throw new Error('No screenshot data received');
    }

    console.log('Screenshot captured successfully, sending to OpenAI...');
    const response = await analyzeImage(screenshot.data, 'search');
    console.log('OpenAI response received, length:', response.length);
    
    // Calculate position for response window
    const screenPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(screenPoint);
    console.log('Display bounds:', display.bounds);
    
    // Position response window below the selection with some padding
    const padding = 30; // Increased padding from 20 to 30
    const windowWidth = 500;
    const windowHeight = 300;
    
    // Center the window horizontally relative to the selection
    const x = Math.max(0, Math.min(
      region.x + (region.width - windowWidth) / 2,
      display.bounds.width - windowWidth
    ));
    
    // Position below the selection with padding
    const y = Math.min(
      region.y + region.height + padding,
      display.bounds.height - windowHeight
    );
    
    console.log('Response window position:', { x, y, region });

    try {
      // Create response window with the OpenAI response
      console.log('Creating response window...');
      createResponseWindow(response, 'search', x, y);
      console.log('Response window creation initiated');
      
      // Clean up the overlay window after a short delay
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.hide();
          overlayWindow.destroy();
          overlayWindow = null;
          console.log('Overlay window cleaned up');
        }
      }, 100);
    } catch (error) {
      console.error('Error creating response window:', error);
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
      model: "gpt-4-vision-preview",
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