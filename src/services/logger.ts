import * as fs from 'fs';
import * as path from 'path';

const logFile = path.join(__dirname, '../../logs/app.log');

// Ensure logs directory exists
const logsDir = path.dirname(logFile);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const writeToLogFile = (level: string, message: string, data?: any) => {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
};

export const logger = {
  log: (message: string, data?: any) => {
    console.log(message, data ? data : '');
    writeToLogFile('LOG', message, data);
  },
  info: (message: string, data?: any) => {
    console.info(message, data ? data : '');
    writeToLogFile('INFO', message, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(message, data ? data : '');
    writeToLogFile('WARN', message, data);
  },
  error: (message: string, data?: any) => {
    console.error(message, data ? data : '');
    writeToLogFile('ERROR', message, data);
  }
}; 