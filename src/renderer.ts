import { ipcRenderer, desktopCapturer, DesktopCapturerSource } from 'electron';

// Listen for take-screenshot event
ipcRenderer.on('take-screenshot', () => {
  console.log('Renderer received take-screenshot event');
  try {
    desktopCapturer
      .getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } })
      .then(async (sources: DesktopCapturerSource[]) => {
        console.log('Got screen sources:', sources.length);
        // ... rest of the code ...
      })
      .catch((err: Error) => {
        console.error('Error getting screen sources:', err);
      });
  } catch (error) {
    console.error('Error in take-screenshot handler:', error);
  }
}); 