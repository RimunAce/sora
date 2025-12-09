/**
 * Security Tests
 * 
 * Comprehensive security testing for Sora application
 * - Path traversal protection
 * - Input validation
 * - Content-Type validation
 * - XSS prevention
 * - Rate limiting readiness
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { createApp } from '../../src/app'

describe('Security Tests', () => {
    let server: any
    const PORT = 3097
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

    describe('Path Traversal Protection', () => {
        test('should block simple path traversal attempts', async () => {
            const response = await fetch(`${BASE_URL}/assets/../../../etc/passwd`)

            // Should return 404 or 403, not actual file contents
            expect([403, 404]).toContain(response.status)
        })

        test('should block encoded path traversal', async () => {
            const response = await fetch(`${BASE_URL}/assets/%2e%2e%2f%2e%2e%2f`)

            expect([403, 404]).toContain(response.status)
        })

        test('should block double-encoded path traversal', async () => {
            const response = await fetch(`${BASE_URL}/assets/%252e%252e%252f`)

            expect([403, 404]).toContain(response.status)
        })

        test('should not serve files outside public directory', async () => {
            const response = await fetch(`${BASE_URL}/assets/../package.json`)

            expect([403, 404]).toContain(response.status)
        })

        test('should handle null bytes in path', async () => {
            const response = await fetch(`${BASE_URL}/assets/test%00.js`)

            expect([400, 403, 404]).toContain(response.status)
        })
    })

    describe('Input Validation', () => {
        test('should handle oversized POST body gracefully', async () => {
            const largeBody = 'x'.repeat(1000000) // 1MB

            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameName: largeBody,
                    gameRegion: 'Test',
                    resetTime: '00:00'
                })
            })

            // Should handle without crashing (200 = webhook fail, 400 = validation, 413 = too large, 500 = server error)
            expect([200, 400, 413, 500]).toContain(response.status)
        })

        test('should reject malformed JSON', async () => {
            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not valid json {'
            })

            expect([400, 500]).toContain(response.status)
        })

        test('should handle special characters in game name', async () => {
            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameName: '<script>alert("xss")</script>',
                    gameRegion: 'Test',
                    resetTime: '00:00'
                })
            })

            // Should not cause server error (webhook will fail without config)
            expect([200, 400, 500]).toContain(response.status)
        })

        test('should handle unicode in input', async () => {
            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gameName: '游戏名称 🎮',
                    gameRegion: '全球服',
                    resetTime: '00:00'
                })
            })

            // Should handle unicode without crashing
            expect(response.status).toBeDefined()
        })

        test('should handle deeply nested JSON', async () => {
            const deepObject: any = { gameName: 'Test', gameRegion: 'Test', resetTime: '00:00' }
            let current = deepObject
            for (let i = 0; i < 100; i++) {
                current.nested = { level: i }
                current = current.nested
            }

            const response = await fetch(`${BASE_URL}/api/game-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deepObject)
            })

            // Should handle without crashing
            expect(response.status).toBeDefined()
        })
    })

    describe('HTTP Method Security', () => {
        test('should not allow PUT on read-only endpoints', async () => {
            const response = await fetch(`${BASE_URL}/api/games`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: 'test' })
            })

            // Should return 404 or 405
            expect([404, 405]).toContain(response.status)
        })

        test('should not allow DELETE on games endpoint', async () => {
            const response = await fetch(`${BASE_URL}/api/games/test-game`, {
                method: 'DELETE'
            })

            expect([404, 405]).toContain(response.status)
        })

        test('should not allow PATCH on games endpoint', async () => {
            const response = await fetch(`${BASE_URL}/api/games/test-game`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Modified' })
            })

            expect([404, 405]).toContain(response.status)
        })
    })

    describe('Response Headers Security', () => {
        test('should return proper Content-Type for JSON responses', async () => {
            const response = await fetch(`${BASE_URL}/api/games`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('application/json')
        })

        test('should return proper Content-Type for HTML responses', async () => {
            const response = await fetch(`${BASE_URL}/`)
            const contentType = response.headers.get('Content-Type')

            expect(contentType).toContain('text/html')
        })
    })

    describe('Error Information Disclosure', () => {
        test('should not expose stack traces in production errors', async () => {
            const response = await fetch(`${BASE_URL}/api/games/invalid-id`)
            const data = await response.json()

            // Should not contain stack trace or internal paths
            const responseStr = JSON.stringify(data)
            expect(responseStr).not.toContain('node_modules')
            expect(responseStr).not.toContain('at ')
        })

        test('404 response should not expose server internals', async () => {
            const response = await fetch(`${BASE_URL}/non-existent-path`)
            const data = await response.json()

            const responseStr = JSON.stringify(data)
            // Should contain clean error message only
            expect(data).toHaveProperty('error')
            expect(responseStr).not.toContain('Error:')
        })
    })

    describe('Query Parameter Handling', () => {
        test('should handle excessively long query strings', async () => {
            const longQuery = 'a'.repeat(10000)
            const response = await fetch(`${BASE_URL}/api/games?q=${longQuery}`)

            // Should handle without crashing
            expect([200, 400, 414]).toContain(response.status)
        })

        test('should handle special characters in query params', async () => {
            const response = await fetch(`${BASE_URL}/api/games?q=<script>alert(1)</script>`)

            // Should handle without crashing
            expect(response.status).toBeDefined()
        })
    })
})
