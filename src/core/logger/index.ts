import { cyan, green, red, yellow, magenta } from './colors'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any[]
  context?: Record<string, any>
}

class CentralizedLogger {
  private isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production'
  }

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = cyan(`[${entry.timestamp}]`)
    const level = this.getColoredLevel(entry.level)
    const message = this.getColoredMessage(entry.message, entry.level)

    let formatted = `${timestamp} ${level} ${message}`

    if (entry.data && entry.data.length > 0) {
      formatted += ' ' + JSON.stringify(entry.data, null, 2)
    }

    if (entry.context) {
      formatted += ' ' + JSON.stringify(entry.context, null, 2)
    }

    return formatted
  }

  private getColoredLevel(level: LogLevel): string {
    const levelMap = {
      debug: magenta('[DEBUG]'),
      info: green('[INFO]'),
      warn: yellow('[WARN]'),
      error: red('[ERROR]')
    }
    return levelMap[level]
  }

  private getColoredMessage(message: string, level: LogLevel): string {
    const colorMap = {
      debug: magenta,
      info: cyan,
      warn: yellow,
      error: red
    }
    return colorMap[level](message)
  }

  private log(level: LogLevel, message: string, ...data: any[]): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      ...(data.length > 0 && { data })
    }

    console.log(this.formatMessage(entry))
  }

  private logWithContext(level: LogLevel, message: string, context: Record<string, any>, ...data: any[]): void {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      context,
      ...(data.length > 0 && { data })
    }

    console.log(this.formatMessage(entry))
  }

  debug(message: string, ...data: any[]): void {
    if (this.isDevelopment) {
      this.log('debug', message, ...data)
    }
  }

  info(message: string, ...data: any[]): void {
    this.log('info', message, ...data)
  }

  warn(message: string, ...data: any[]): void {
    this.log('warn', message, ...data)
  }

  error(message: string, ...data: any[]): void {
    this.log('error', message, ...data)
  }

  debugContext(message: string, context: Record<string, any>, ...data: any[]): void {
    if (this.isDevelopment) {
      this.logWithContext('debug', message, context, ...data)
    }
  }

  infoContext(message: string, context: Record<string, any>, ...data: any[]): void {
    this.logWithContext('info', message, context, ...data)
  }

  warnContext(message: string, context: Record<string, any>, ...data: any[]): void {
    this.logWithContext('warn', message, context, ...data)
  }

  errorContext(message: string, context: Record<string, any>, ...data: any[]): void {
    this.logWithContext('error', message, context, ...data)
  }

  time(label: string): void {
    console.time(`[${this.formatTimestamp()}] [PERF] ${label}`)
  }

  timeEnd(label: string): void {
    console.timeEnd(`[${this.formatTimestamp()}] [PERF] ${label}`)
  }

  request(method: string, url: string, statusCode: number, responseTime: number): void {
    const context = {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`
    }

    if (statusCode >= 400) {
      this.warnContext('HTTP Request', context)
    } else {
      this.infoContext('HTTP Request', context)
    }
  }
}

export const logger = new CentralizedLogger()

export { CentralizedLogger }