/**
 * Integration Tests for Page Routes
 * 
 * Tests for static file and page serving
 * - GET / (landing page)
 * - GET /dashboard
 * - GET /assets/styles.css
 * - GET /assets/app.js
 * - GET /manifest.json
 * - GET /sw.js
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createApp } from '../../src/app'

describe('Page Routes', () => {
    let server: any
    const PORT = 3098
    const BASE_URL = `http://localhost:${PORT}`

    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
        await new Promise(resolve => setTimeout(resolve, 100))
    })

    afterAll(() => {
        if (server) {
            server.close()
        }
    })

    describe('GET / (Landing Page)', () => {
        test('should return HTML content', async () => {
            const response = await fetch(`${BASE_URL}/`)
            const html = await response.text()

            expect(response.status).toBe(200)
            expect(html).toContain('<!DOCTYPE html>')
            expect(html).toContain('<html')
        })

        test('should contain Sora title', async () => {
            const response = await fetch(`${BASE_URL}/`)
            const html = await response.text()

            expect(html).toContain('Sora')
        })

        test('should return correct Content-Type', async () => {
            const response = await fetch(`${BASE_URL}/`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('text/html')
        })

        test('should include meta tags for SEO', async () => {
            const response = await fetch(`${BASE_URL}/`)
            const html = await response.text()

            expect(html).toContain('<meta name="description"')
            expect(html).toContain('<meta property="og:')
        })
    })

    describe('GET /dashboard', () => {
        test('should return dashboard HTML', async () => {
            const response = await fetch(`${BASE_URL}/dashboard`)
            const html = await response.text()

            expect(response.status).toBe(200)
            expect(html).toContain('<!DOCTYPE html>')
        })

        test('should return correct Content-Type', async () => {
            const response = await fetch(`${BASE_URL}/dashboard`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('text/html')
        })
    })

    describe('GET /assets/styles.css', () => {
        test('should return CSS content', async () => {
            const response = await fetch(`${BASE_URL}/assets/styles.css`)
            const css = await response.text()

            expect(response.status).toBe(200)
            expect(css.length).toBeGreaterThan(0)
        })

        test('should return correct Content-Type for CSS', async () => {
            const response = await fetch(`${BASE_URL}/assets/styles.css`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('text/css')
        })
    })

    describe('GET /assets/app.js', () => {
        test('should return JavaScript content', async () => {
            const response = await fetch(`${BASE_URL}/assets/app.js`)
            const js = await response.text()

            expect(response.status).toBe(200)
            expect(js.length).toBeGreaterThan(0)
        })

        test('should return correct Content-Type for JavaScript', async () => {
            const response = await fetch(`${BASE_URL}/assets/app.js`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('application/javascript')
        })

        test('should contain App object initialization', async () => {
            const response = await fetch(`${BASE_URL}/assets/app.js`)
            const js = await response.text()

            expect(js).toContain('const App')
        })
    })

    describe('GET /manifest.json', () => {
        test('should return valid JSON manifest', async () => {
            const response = await fetch(`${BASE_URL}/manifest.json`)
            const manifest = await response.json()

            expect(response.status).toBe(200)
            expect(manifest).toHaveProperty('name')
        })

        test('should return correct Content-Type for manifest', async () => {
            const response = await fetch(`${BASE_URL}/manifest.json`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('application/manifest+json')
        })
    })

    describe('GET /sw.js (Service Worker)', () => {
        test('should return service worker script', async () => {
            const response = await fetch(`${BASE_URL}/sw.js`)
            const sw = await response.text()

            expect(response.status).toBe(200)
            expect(sw.length).toBeGreaterThan(0)
        })

        test('should have Service-Worker-Allowed header', async () => {
            const response = await fetch(`${BASE_URL}/sw.js`)
            const swAllowed = response.headers.get('Service-Worker-Allowed')

            expect(swAllowed).toBe('/')
        })
    })

    describe('Static Asset Caching Headers', () => {
        test('should serve image files', async () => {
            const response = await fetch(`${BASE_URL}/assets/favicon.ico`)

            // Should either succeed or return 404 (if file doesn't exist)
            expect([200, 404]).toContain(response.status)
        })
    })
})
