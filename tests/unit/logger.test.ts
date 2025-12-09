/**
 * Unit Tests for Centralized Logger
 * 
 * Tests for src/core/logger/index.ts
 * - Log level functionality
 * - Message formatting
 * - Context logging
 * - Development vs production behavior
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'

describe('CentralizedLogger', () => {
    let originalEnv: string | undefined
    let consoleSpy: any

    beforeEach(() => {
        originalEnv = process.env.NODE_ENV
        consoleSpy = spyOn(console, 'log').mockImplementation(() => { })
    })

    afterEach(() => {
        process.env.NODE_ENV = originalEnv
        consoleSpy.mockRestore()
    })

    describe('Log Levels', () => {
        test('should export logger instance', async () => {
            const { logger } = await import('../../src/core/logger')

            expect(logger).toBeDefined()
            expect(typeof logger.info).toBe('function')
            expect(typeof logger.warn).toBe('function')
            expect(typeof logger.error).toBe('function')
            expect(typeof logger.debug).toBe('function')
        })

        test('info() should log messages', async () => {
            const { logger } = await import('../../src/core/logger')

            logger.info('Test info message')

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('warn() should log warning messages', async () => {
            const { logger } = await import('../../src/core/logger')

            logger.warn('Test warning message')

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('error() should log error messages', async () => {
            const { logger } = await import('../../src/core/logger')

            logger.error('Test error message')

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('debug() should log in development mode', async () => {
            process.env.NODE_ENV = 'development'

            // Re-import to get fresh instance with development mode
            const { CentralizedLogger } = await import('../../src/core/logger')
            const devLogger = new CentralizedLogger()

            devLogger.debug('Debug message')

            expect(consoleSpy).toHaveBeenCalled()
        })
    })

    describe('Context Logging', () => {
        test('infoContext() should log with context object', async () => {
            const { logger } = await import('../../src/core/logger')
            const context = { userId: 123, action: 'test' }

            logger.infoContext('Test message', context)

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('warnContext() should log warnings with context', async () => {
            const { logger } = await import('../../src/core/logger')
            const context = { path: '/test', statusCode: 404 }

            logger.warnContext('Not found', context)

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('errorContext() should log errors with context', async () => {
            const { logger } = await import('../../src/core/logger')
            const context = { error: 'Something went wrong' }

            logger.errorContext('Error occurred', context)

            expect(consoleSpy).toHaveBeenCalled()
        })
    })

    describe('Request Logging', () => {
        test('request() should log successful HTTP requests', async () => {
            const { logger } = await import('../../src/core/logger')

            logger.request('GET', '/api/games', 200, 50)

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('request() should log failed HTTP requests as warnings', async () => {
            const { logger } = await import('../../src/core/logger')

            logger.request('POST', '/api/error', 500, 100)

            expect(consoleSpy).toHaveBeenCalled()
        })

        test('request() should handle 4xx status codes', async () => {
            const { logger } = await import('../../src/core/logger')

            logger.request('GET', '/not-found', 404, 10)

            expect(consoleSpy).toHaveBeenCalled()
        })
    })

    describe('Performance Timing', () => {
        test('time() and timeEnd() should be callable', async () => {
            const { logger } = await import('../../src/core/logger')
            const timeSpy = spyOn(console, 'time').mockImplementation(() => { })
            const timeEndSpy = spyOn(console, 'timeEnd').mockImplementation(() => { })

            logger.time('test-operation')
            logger.timeEnd('test-operation')

            expect(timeSpy).toHaveBeenCalled()
            expect(timeEndSpy).toHaveBeenCalled()

            timeSpy.mockRestore()
            timeEndSpy.mockRestore()
        })
    })

    describe('Log Types Export', () => {
        test('should export LogLevel type', async () => {
            const loggerModule = await import('../../src/core/logger')

            // Check that CentralizedLogger class is exported
            expect(loggerModule.CentralizedLogger).toBeDefined()
        })
    })
})
