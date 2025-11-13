import { App } from '@tinyhttp/app'
import { json } from 'milliparsec'
import { registerRoutes } from './routes'
import { requestLoggerMiddleware } from './middleware/requestLogger'
import { logger } from '../core/logger'

// Extend the Response interface to include our custom method
declare module '@tinyhttp/app' {
  interface Response {
    sendCompressed?: (data: Buffer | string) => void
  }
}

export const createApp = (): App => {
  const app = new App()

  // Add JSON body parser middleware
  app.use(json())
  
  // Add compression middleware for better performance
  app.use(async (req, res, next) => {
    const acceptEncoding = req.headers['accept-encoding'] as string
    if (acceptEncoding && acceptEncoding.includes('gzip')) {
      const { gzipSync } = await import('zlib')
      res.sendCompressed = (data: Buffer | string) => {
        if (typeof data === 'string') {
          data = Buffer.from(data)
        }
        const compressed = gzipSync(data)
        res.set('Content-Encoding', 'gzip')
        res.set('Content-Length', compressed.length.toString())
        res.send(compressed)
      }
    }
    if (next) next()
  })
  
  app.use(requestLoggerMiddleware)

  registerRoutes(app)

  app.use('*', (req, res) => {
    logger.warn('404 - Route not found', { url: req.url, method: req.method })
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.url} not found`,
      timestamp: new Date().toISOString()
    })
  })

  return app
}