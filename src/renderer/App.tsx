import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { LoadingSpinner } from './components/LoadingSpinner';
import './styles.css';
import { initializeScreenshotCapture } from './screenshot';

const App: React.FC = () => {
  const [isScreenshotMode, setIsScreenshotMode] = useState(false);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [mode, setMode] = useState<'assignment' | 'search'>('search');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const log = (message: string, data?: any) => {
    try {
      ipcRenderer.send('log', { message, data });
    } catch (err) {
      // Silently fail if logging fails
    }
  };

  useEffect(() => {
    log('Setting up event listeners...');
    
    const handleStartScreenshot = () => {
      console.log('Received show-screenshot-overlay event');
      setIsScreenshotMode(true);
      setError(null);
    };

    console.log('Setting up screenshot overlay listener');
    ipcRenderer.on('show-screenshot-overlay', handleStartScreenshot);
    log('Event listener attached');

    return () => {
      console.log('Cleaning up screenshot overlay listener');
      ipcRenderer.removeListener('show-screenshot-overlay', handleStartScreenshot);
    };
  }, []);

  // Add effect to handle window focus
  useEffect(() => {
    if (isScreenshotMode) {
      log('Screenshot mode activated, focusing window...');
      ipcRenderer.send('bring-to-front');
    }
  }, [isScreenshotMode]);

  useEffect(() => {
    initializeScreenshotCapture();
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isScreenshotMode) {
      log('Mouse down ignored - not in screenshot mode');
      return;
    }
    log('Starting selection...');
    const rect = e.currentTarget.getBoundingClientRect();
    setSelection({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: 0,
      height: 0
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScreenshotMode || !selection) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSelection({
      ...selection,
      width: e.clientX - rect.left - selection.x,
      height: e.clientY - rect.top - selection.y
    });
  };

  const handleMouseUp = async () => {
    if (!isScreenshotMode || !selection) {
      log('Mouse up ignored - not in screenshot mode or no selection');
      return;
    }
    
    log('Processing selection:', selection);
    
    try {
      setIsLoading(true);
      setError(null);
      
      log('Capturing screenshot...');
      const screenshot = await ipcRenderer.invoke('capture-screenshot', selection);
      
      log('Processing with AI...');
      const response = await ipcRenderer.invoke('process-screenshot', {
        image: screenshot,
        mode
      });
      
      log('Setting AI response...');
      setAiResponse(response);
    } catch (err) {
      log('Error processing screenshot:', err);
      setError('Failed to process screenshot. Please try again.');
    } finally {
      setIsLoading(false);
      setIsScreenshotMode(false);
      setSelection(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isScreenshotMode) {
      setIsScreenshotMode(false);
      setSelection(null);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScreenshotMode]);

  return (
    <div className="app-container">
      {isScreenshotMode && (
        <div
          className="screenshot-overlay"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {selection && (
            <div
              className="selection-box"
              style={{
                left: selection.x,
                top: selection.y,
                width: selection.width,
                height: selection.height
              }}
            />
          )}
        </div>
      )}
      
      {isLoading && <LoadingSpinner />}
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      {aiResponse && !isLoading && (
        <div className="ai-response">
          <div className="mode-selector">
            <button
              className={mode === 'search' ? 'active' : ''}
              onClick={() => setMode('search')}
            >
              Search Mode
            </button>
            <button
              className={mode === 'assignment' ? 'active' : ''}
              onClick={() => setMode('assignment')}
            >
              Assignment Mode
            </button>
          </div>
          <div className="response-content">{aiResponse}</div>
        </div>
      )}
    </div>
  );
};

export default App; 