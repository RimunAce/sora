/**
 * Integration Tests for API Routes
 * 
 * Tests for API endpoints in src/app/routes/index.ts
 * - GET /api/games
 * - GET /api/games/:id
 * - GET /health
 * - GET /api/status
 * - POST /api/game-request (validation)
 * - POST /api/report-issue (validation)
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createApp } from '../../src/app'
import { Game } from '../../src/core/data/gamesLoader'

describe('API Routes', () => {
    let server: any
    const PORT = 3099
    const BASE_URL = `http://localhost:${PORT}`

    beforeAll(async () => {
        const app = createApp()
        server = app.listen(PORT)
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 100))
    })

    afterAll(() => {
        if (server) {
            server.close()
        }
    })

    describe('GET /api/games', () => {
        test('should return array of games', async () => {
            const response = await fetch(`${BASE_URL}/api/games`)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(Array.isArray(data)).toBe(true)
        })

        test('should return games with correct structure', async () => {
            const response = await fetch(`${BASE_URL}/api/games`)
            const games = await response.json() as Game[]

            if (games.length > 0) {
                const game = games[0]
                expect(game).toHaveProperty('id')
                expect(game).toHaveProperty('name')
                expect(game).toHaveProperty('description')
                expect(game).toHaveProperty('banner')
                expect(game).toHaveProperty('servers')
            }
        })

        test('should return Content-Type as application/json', async () => {
            const response = await fetch(`${BASE_URL}/api/games`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('application/json')
        })
    })

    describe('GET /api/games/:id', () => {
        test('should return specific game by ID', async () => {
            // First get list of games
            const gamesResponse = await fetch(`${BASE_URL}/api/games`)
            const games = await gamesResponse.json() as Game[]

            if (games.length > 0) {
                const gameId = games[0].id
                const response = await fetch(`${BASE_URL}/api/games/${gameId}`)
                const game = await response.json() as Game

                expect(response.status).toBe(200)
                expect(game.id).toBe(gameId)
            }
        })

        test('should return 404 for non-existent game', async () => {
            const response = await fetch(`${BASE_URL}/api/games/non-existent-game-12345`)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data).toHaveProperty('error')
        })
    })

    describe('GET /health', () => {
        test('should return health status', async () => {
            const response = await fetch(`${BASE_URL}/health`)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data).toHaveProperty('status', 'healthy')
            expect(data).toHaveProperty('timestamp')
            expect(data).toHaveProperty('uptime')
        })

        test('uptime should be a positive number', async () => {
            const response = await fetch(`${BASE_URL}/health`)
            const data = await response.json() as { uptime: number }

            expect(typeof data.uptime).toBe('number')
            expect(data.uptime).toBeGreaterThanOrEqual(0)
        })
    })

    describe('GET /api/status', () => {
        test('should return service status', async () => {
            const response = await fetch(`${BASE_URL}/api/status`)
            const data = await response.json()

            expect(response.status).toBe(200)
            expect(data).toHaveProperty('service', 'Sora')
            expect(data).toHaveProperty('status', 'operational')
            expect(data).toHaveProperty('version')
            expect(data).toHaveProperty('timestamp')
        })
    })

    describe('POST /api/game-request', () => {
        test('should reject request without required fields', async () => {
            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data).toHaveProperty('error', 'Bad Request')
        })

        test('should reject request with partial fields', async () => {
            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameName: 'Test Game' })
            })
            const data = await response.json()

            expect(response.status).toBe(400)
        })

        test('should require gameName, gameRegion, and resetTime', async () => {
            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameName: 'Test',
                    gameRegion: 'Global'
                    // missing resetTime
                })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('POST /api/report-issue', () => {
        test('should reject report without required fields', async () => {
            const response = await fetch(`${BASE_URL}/api/report-issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            })
            const data = await response.json()

            expect(response.status).toBe(400)
            expect(data).toHaveProperty('error', 'Bad Request')
        })

        test('should require gameName, gameId, and issueDescription', async () => {
            const response = await fetch(`${BASE_URL}/api/report-issue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameName: 'Test Game',
                    gameId: 'test-id'
                    // missing issueDescription
                })
            })

            expect(response.status).toBe(400)
        })
    })

    describe('404 Handling', () => {
        test('should return 404 for unknown routes', async () => {
            const response = await fetch(`${BASE_URL}/unknown-route-12345`)
            const data = await response.json()

            expect(response.status).toBe(404)
            expect(data).toHaveProperty('error', 'Not Found')
        })

        test('should return JSON error for unknown API routes', async () => {
            const response = await fetch(`${BASE_URL}/api/unknown`)
            const contentType = response.headers.get('Content-Type')

            expect(response.status).toBe(404)
            expect(contentType).toContain('application/json')
        })
    })
})
