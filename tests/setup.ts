/**
 * Test Setup and Utilities
 * 
 * Common utilities, mocks, and helpers for Sora test suite.
 */

import { beforeAll, afterAll, mock } from 'bun:test'

// Environment setup for tests
beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test'

    // Disable console output during tests (optional - comment out for debugging)
    // console.log = mock(() => {})
    // console.info = mock(() => {})
    // console.debug = mock(() => {})
})

afterAll(() => {
    // Cleanup after all tests
})

/**
 * Create a mock HTTP request object
 */
export function createMockRequest(options: {
    method?: string
    url?: string
    headers?: Record<string, string>
    body?: any
    params?: Record<string, string>
}) {
    return {
        method: options.method || 'GET',
        url: options.url || '/',
        headers: options.headers || {},
        body: options.body || null,
        params: options.params || {},
    }
}

/**
 * Create a mock HTTP response object
 */
export function createMockResponse() {
    const response: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: null,

        status(code: number) {
            this.statusCode = code
            return this
        },

        set(key: string, value: string) {
            this.headers[key] = value
            return this
        },

        type(contentType: string) {
            this.headers['Content-Type'] = contentType
            return this
        },

        json(data: any) {
            this.headers['Content-Type'] = 'application/json'
            this.body = data
            return this
        },

        send(data: any) {
            this.body = data
            return this
        },
    }

    return response
}

/**
 * Sample game data for testing
 */
export const sampleGameData = {
    games: [
        {
            id: 'test-game-1',
            name: 'Test Game Alpha',
            description: 'A test game for unit testing',
            banner: '/assets/images/games/test.jpg',
            servers: [
                {
                    name: 'Global',
                    timezone: 'UTC',
                    offset: 0,
                    dailyReset: '00:00'
                },
                {
                    name: 'Asia',
                    timezone: 'JST',
                    offset: 9,
                    dailyReset: '05:00'
                }
            ]
        },
        {
            id: 'test-game-2',
            name: 'Test Game Beta',
            description: 'Another test game',
            banner: '/assets/images/games/test2.jpg',
            servers: [
                {
                    name: 'NA',
                    timezone: 'PST',
                    offset: -8,
                    dailyReset: '04:00'
                }
            ]
        }
    ]
}

/**
 * Wait for a specified duration
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Validate HTTP response structure
 */
export function isValidJsonResponse(body: any): boolean {
    return body !== null && typeof body === 'object'
}

/**
 * Constants for testing
 */
export const TEST_PORT = 3001
export const BASE_URL = `http://localhost:${TEST_PORT}`
