import type { Handler } from '@tinyhttp/app'
import { logger } from '../../core/logger'

export const requestLoggerMiddleware: Handler = (req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const responseTime = Date.now() - start
    const method = (req as any).method || 'GET'
    const statusCode = (res as any).statusCode || 200
    const url = (req as any).url || req.url || '/'
    logger.request(method, url, statusCode, responseTime)
  })

  if (typeof next === 'function') {
    next()
  }
}