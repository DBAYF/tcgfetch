import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logFile: string;
  private logStream: fs.WriteStream;

  constructor(logDir: string = 'logs') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `download-${timestamp}.log`;
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    this.logFile = path.join(logDir, logFileName);
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  info(message: string) {
    const formatted = this.formatMessage('INFO', message);
    console.log(formatted);
    this.logStream.write(formatted + '\n');
  }

  error(message: string, error?: Error) {
    const formatted = this.formatMessage('ERROR', message);
    console.error(formatted);
    this.logStream.write(formatted + '\n');
    
    if (error) {
      const errorDetails = `${error.name}: ${error.message}\n${error.stack}`;
      console.error(errorDetails);
      this.logStream.write(errorDetails + '\n');
    }
  }

  warn(message: string) {
    const formatted = this.formatMessage('WARN', message);
    console.warn(formatted);
    this.logStream.write(formatted + '\n');
  }

  success(message: string) {
    const formatted = this.formatMessage('SUCCESS', message);
    console.log(`\x1b[32m${formatted}\x1b[0m`);
    this.logStream.write(formatted + '\n');
  }

  close() {
    this.logStream.end();
  }
}

