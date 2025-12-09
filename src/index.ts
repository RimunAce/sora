import 'dotenv/config'
import { logger } from './core/logger'
import { createApp } from './app'

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000

logger.info(`Starting Sora v1.4.0 on port ${PORT}`)
logger.debug(`Environment: ${process.env.NODE_ENV || 'development'}`)

const app = createApp()

app.listen(PORT, () => {
  logger.info(`Server Running at ${PORT}`)
  logger.info(`Visit: http://localhost:${PORT}`)
  logger.debug('Server finished starting')
})