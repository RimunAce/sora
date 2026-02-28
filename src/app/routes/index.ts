import type { App } from '@tinyhttp/app'
import { logger } from '../../core/logger'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { loadGamesData, getGameById } from '../../core/data/gamesLoader'

// Static file paths - support both src/ (dev) and dist/public/ (prod)
const DIST_PUBLIC_DIR = join(process.cwd(), 'dist', 'public')
const SRC_PUBLIC_DIR = join(process.cwd(), 'src', 'public')
const PUBLIC_DIR = existsSync(DIST_PUBLIC_DIR) ? DIST_PUBLIC_DIR : SRC_PUBLIC_DIR

const HTML_FILE = join(PUBLIC_DIR, 'index.html')
const DASHBOARD_HTML_FILE = join(PUBLIC_DIR, 'dashboard.html')
const OFFLINE_HTML_FILE = join(PUBLIC_DIR, 'offline.html')
const CSS_FILE = join(PUBLIC_DIR, 'assets', 'styles.css')
const JS_FILE = join(PUBLIC_DIR, 'assets', 'app.js')
const MANIFEST_FILE = join(PUBLIC_DIR, 'manifest.json')
const SW_FILE = join(PUBLIC_DIR, 'sw.js')

// MIME type mapping for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
}

export const registerRoutes = (app: App): void => {
  // Serve HTML landing page
  app.get('/', (req, res) => {
    try {
      const htmlContent = readFileSync(HTML_FILE, 'utf-8')
      logger.info('Landing page served')
      res.type('html').send(htmlContent)
    } catch (error) {
      logger.error('Failed to serve landing page', { error })
      res.status(500).send('<h1>Internal Server Error</h1>')
    }
  })

  // Serve Dashboard page
  app.get('/dashboard', (req, res) => {
    try {
      const htmlContent = readFileSync(DASHBOARD_HTML_FILE, 'utf-8')
      logger.info('Dashboard page served')
      res.type('html').send(htmlContent)
    } catch (error) {
      logger.error('Failed to serve dashboard page', { error })
      res.status(500).send('<h1>Internal Server Error</h1>')
    }
  })

  // Serve offline page
  app.get('/offline', (req, res) => {
    try {
      const offlineContent = readFileSync(OFFLINE_HTML_FILE, 'utf-8')
      logger.info('Offline page served')
      res.type('html').send(offlineContent)
    } catch (error) {
      logger.error('Failed to serve offline page', { error })
      res.status(500).send('<h1>Offline</h1><p>You are currently offline.</p>')
    }
  })

  // Serve PWA manifest
  app.get('/manifest.json', (req, res) => {
    try {
      const manifestContent = readFileSync(MANIFEST_FILE, 'utf-8')
      logger.debug('Manifest served')
      res.set('Content-Type', 'application/manifest+json')
      res.send(manifestContent)
    } catch (error) {
      logger.error('Failed to serve manifest', { error })
      res.status(404).json({ error: 'Manifest not found' })
    }
  })

  // Serve Service Worker
  app.get('/sw.js', (req, res) => {
    try {
      const swContent = readFileSync(SW_FILE, 'utf-8')
      logger.debug('Service worker served')
      res.set('Content-Type', 'application/javascript; charset=utf-8')
      res.set('Service-Worker-Allowed', '/')
      res.send(swContent)
    } catch (error) {
      logger.error('Failed to serve service worker', { error })
      res.status(404).send('// Service worker not found')
    }
  })

  // Serve CSS styles
  app.get('/assets/styles.css', (req, res) => {
    try {
      const cssContent = readFileSync(CSS_FILE, 'utf-8')
      logger.debug('CSS file served')
      res.type('css').send(cssContent)
    } catch (error) {
      logger.error('Failed to serve CSS file', { error })
      res.status(404).send('/* CSS file not found */')
    }
  })

  // Serve JavaScript
  app.get('/assets/app.js', (req, res) => {
    try {
      const jsContent = readFileSync(JS_FILE, 'utf-8')
      logger.debug('JavaScript file served')
      // Use correct MIME type for JS to avoid invalid media type error
      res.set('Content-Type', 'application/javascript; charset=utf-8')
      res.send(jsContent)
    } catch (error) {
      logger.error('Failed to serve JavaScript file', { error })
      res.status(404).send('// JavaScript file not found')
    }
  })

  // Serve static assets (images, fonts, etc.) from /assets
  app.get('/assets/*', (req, res) => {
    try {
      const requestPath = (req as any).path
      const filePath = join(PUBLIC_DIR, requestPath)

      // Security check: ensure the file is within PUBLIC_DIR
      if (!filePath.startsWith(PUBLIC_DIR)) {
        logger.warn('Attempted path traversal', { requestPath })
        res.status(403).send('Forbidden')
        return
      }

      // Check if file exists
      if (!existsSync(filePath)) {
        logger.warn('Static file not found', { filePath })
        res.status(404).json({
          error: 'Not Found',
          message: `File ${requestPath} not found`,
          timestamp: new Date().toISOString()
        })
        return
      }

      // Determine MIME type from file extension
      const ext = extname(filePath).toLowerCase()
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

      // Read and serve the file
      const fileContent = readFileSync(filePath)
      logger.debug('Static file served', { path: requestPath, mimeType })
      res.set('Content-Type', mimeType)
      res.send(fileContent)
    } catch (error) {
      logger.error('Failed to serve static file', { error, path: (req as any).path })
      res.status(500).send('Internal Server Error')
    }
  })

  // Keep the old simple root endpoint for fallback
  app.get('/simple', (req, res) => {
    logger.info('Simple root endpoint accessed')
    res.send('<h1>Hello World from Sora v1.5.0</h1>')
  })

  app.get('/page/:page', (req, res) => {
    const page = (req as any).params?.page || 'unknown'
    logger.info('Page endpoint accessed', { page })
    res.json({
      page,
      message: `Welcome to page ${page}`,
      timestamp: new Date().toISOString()
    })
  })

  app.get('/health', (req, res) => {
    logger.debug('Health check requested')
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  })

  // Games API endpoint
  app.get('/api/games', (req, res) => {
    try {
      const games = loadGamesData()
      logger.info('Games API requested', { count: games.length })
      res.json(games)
    } catch (error) {
      logger.error('Failed to load games', { error })
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to load games data'
      })
    }
  })

  // Individual game API endpoint
  app.get('/api/games/:id', (req, res) => {
    try {
      const gameId = (req as any).params?.id
      const game = getGameById(gameId)

      if (game) {
        logger.info(`Game details requested: ${gameId}`)
        res.json(game)
      } else {
        logger.warn(`Game not found: ${gameId}`)
        res.status(404).json({
          error: 'Game not found',
          message: `Game with ID ${gameId} not found`
        })
      }
    } catch (error) {
      logger.error('Failed to get game', { error })
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve game data'
      })
    }
  })

  app.get('/api/status', (req, res) => {
    const userAgent = (req as any).headers?.['user-agent'] || 'unknown'
    logger.infoContext('API status requested', { userAgent })
    res.json({
      service: 'Sora',
      version: '1.5.0',
      status: 'operational',
      timestamp: new Date().toISOString()
    })
  })

  // Game request submission endpoint (POST)
  app.post('/api/game-request', async (req, res) => {
    try {
      const { gameName, gameRegion, resetTime } = (req as any).body || {}

      // Validate required fields
      if (!gameName || !gameRegion || !resetTime) {
        logger.warn('Game request missing required fields', { gameName, gameRegion, resetTime })
        res.status(400).json({
          error: 'Bad Request',
          message: 'All fields are required: gameName, gameRegion, resetTime'
        })
        return
      }

      // Get webhook URL from environment variable
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL

      if (!webhookUrl) {
        logger.error('Discord webhook URL not configured')
        res.status(500).json({
          error: 'Configuration Error',
          message: 'Discord webhook is not configured'
        })
        return
      }

      // Prepare Discord webhook payload
      const webhookData = {
        embeds: [{
          title: '🎮 New Game Request',
          color: 6366321, // Primary color in decimal (#6366f1)
          fields: [
            {
              name: 'Game Name',
              value: gameName,
              inline: false
            },
            {
              name: 'Region & Timezone',
              value: gameRegion,
              inline: false
            },
            {
              name: 'Daily Reset Time',
              value: resetTime,
              inline: false
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Sora Game Request System'
          }
        }]
      }

      // Send to Discord webhook
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData)
      })

      if (webhookResponse.ok || webhookResponse.status === 204) {
        logger.info('Game request submitted successfully', { gameName, gameRegion, resetTime })
        res.status(200).json({
          success: true,
          message: 'Game request submitted successfully'
        })
      } else {
        const errorText = await webhookResponse.text()
        logger.error('Discord webhook failed', { status: webhookResponse.status, error: errorText })
        res.status(500).json({
          error: 'Webhook Error',
          message: 'Failed to send request to Discord'
        })
      }
    } catch (error) {
      logger.error('Failed to process game request', { error })
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process game request'
      })
    }
  })

  // Report issue submission endpoint (POST)
  app.post('/api/report-issue', async (req, res) => {
    try {
      const { gameName, gameId, issueDescription, timestamp, userAgent, url } = (req as any).body || {}

      // Validate required fields
      if (!gameName || !gameId || !issueDescription) {
        logger.warn('Report issue missing required fields', { gameName, gameId, hasDescription: !!issueDescription })
        res.status(400).json({
          error: 'Bad Request',
          message: 'All fields are required: gameName, gameId, issueDescription'
        })
        return
      }

      // Get webhook URL from environment variable
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL

      if (!webhookUrl) {
        logger.error('Discord webhook URL not configured')
        res.status(500).json({
          error: 'Configuration Error',
          message: 'Discord webhook is not configured'
        })
        return
      }

      // Prepare Discord webhook payload
      const webhookData = {
        embeds: [{
          title: '🚨 New Issue Report',
          color: 16711680, // Red color in decimal (#ff0000)
          fields: [
            {
              name: 'Game',
              value: gameName,
              inline: true
            },
            {
              name: 'Game ID',
              value: gameId,
              inline: true
            },
            {
              name: 'Issue Description',
              value: issueDescription,
              inline: false
            },
            {
              name: 'User Agent',
              value: userAgent || 'Unknown',
              inline: false
            },
            {
              name: 'Reported From',
              value: url || 'Unknown URL',
              inline: false
            }
          ],
          timestamp: timestamp || new Date().toISOString(),
          footer: {
            text: 'Sora Issue Report System'
          }
        }]
      }

      // Send to Discord webhook
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookData)
      })

      if (webhookResponse.ok || webhookResponse.status === 204) {
        logger.info('Issue report submitted successfully', { gameName, gameId })
        res.status(200).json({
          success: true,
          message: 'Issue report submitted successfully'
        })
      } else {
        const errorText = await webhookResponse.text()
        logger.error('Discord webhook failed for issue report', { status: webhookResponse.status, error: errorText })
        res.status(500).json({
          error: 'Webhook Error',
          message: 'Failed to send report to Discord'
        })
      }
    } catch (error) {
      logger.error('Failed to process issue report', { error })
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process issue report'
      })
    }
  })

  // Robots.txt for SEO
  app.get('/robots.txt', (req, res) => {
    const robotsContent = `# Sora - Gacha Game Reset Time Tracker
# Allow all search engines to crawl
User-agent: *
Allow: /

# Sitemap location
Sitemap: https://sora-time.xyz/sitemap.xml

# Crawl delay (optional, respectful crawling)
Crawl-delay: 1

# Disallow admin/private areas (if any in future)
Disallow: /api/
`
    logger.info('robots.txt served')
    res.type('text/plain').send(robotsContent)
  })

  // Sitemap.xml for SEO
  app.get('/sitemap.xml', (req, res) => {
    try {
      const games = loadGamesData()
      const baseUrl = 'https://sora-time.xyz'
      const lastmod = new Date().toISOString().split('T')[0]

      // Build sitemap XML
      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">

  <!-- Main Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/dashboard</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>

  <!-- Game Pages (deep links for each game) -->
`

      games.forEach(game => {
        const gameUrl = `${baseUrl}/?game=${game.id}`
        const gameNameEscaped = game.name.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
        sitemap += `  <url>
    <loc>${gameUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${gameUrl}"/>
  </url>
`
      })

      sitemap += `</urlset>`

      logger.info('sitemap.xml served', { gameCount: games.length })
      res.type('application/xml').send(sitemap)
    } catch (error) {
      logger.error('Failed to generate sitemap', { error })
      res.status(500).send('Failed to generate sitemap')
    }
  })
}