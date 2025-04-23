export function setupLogging() {
  // Override console.log to add timestamps
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    const timestamp = new Date().toISOString();
    originalConsoleLog.apply(console, [`[${timestamp}]`, ...args]);
  };

  // Override console.error to add timestamps
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const timestamp = new Date().toISOString();
    originalConsoleError.apply(console, [`[${timestamp}]`, ...args]);
  };

  // Log uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });

  // Log unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
} 