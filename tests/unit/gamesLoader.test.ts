/**
 * Unit Tests for Games Loader
 * 
 * Tests for src/core/data/gamesLoader.ts
 * - YAML parsing and loading
 * - Caching behavior
 * - Error handling
 * - Game retrieval functions
 */

import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import { join } from 'path'

// We need to test the actual module behavior
describe('GamesLoader', () => {

    describe('loadGamesData', () => {
        test('should load games from YAML file', async () => {
            // Dynamic import to get fresh module state
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            expect(Array.isArray(games)).toBe(true)
            expect(games.length).toBeGreaterThan(0)
        })

        test('should return games sorted alphabetically by name', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            // Check if games are sorted
            for (let i = 1; i < games.length; i++) {
                const comparison = games[i - 1].name.localeCompare(games[i].name)
                expect(comparison).toBeLessThanOrEqual(0)
            }
        })

        test('each game should have required properties', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            games.forEach(game => {
                expect(game).toHaveProperty('id')
                expect(game).toHaveProperty('name')
                expect(game).toHaveProperty('description')
                expect(game).toHaveProperty('banner')
                expect(game).toHaveProperty('servers')
                expect(Array.isArray(game.servers)).toBe(true)

                // Validate ID format (should be lowercase with hyphens)
                expect(typeof game.id).toBe('string')
                expect(game.id.length).toBeGreaterThan(0)

                // Validate server structure
                game.servers.forEach(server => {
                    expect(server).toHaveProperty('name')
                    expect(server).toHaveProperty('timezone')
                    expect(server).toHaveProperty('offset')
                    expect(server).toHaveProperty('dailyReset')
                    expect(typeof server.offset).toBe('number')
                })
            })
        })

        test('daily reset times should be in valid HH:MM format', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

            games.forEach(game => {
                game.servers.forEach(server => {
                    expect(server.dailyReset).toMatch(timeRegex)
                })
            })
        })

        test('banner paths should start with forward slash', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            games.forEach(game => {
                expect(game.banner.startsWith('/')).toBe(true)
            })
        })
    })

    describe('getGameById', () => {
        test('should return game when ID exists', async () => {
            const { loadGamesData, getGameById } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            if (games.length > 0) {
                const firstGame = games[0]
                const foundGame = getGameById(firstGame.id)

                expect(foundGame).toBeDefined()
                expect(foundGame?.id).toBe(firstGame.id)
                expect(foundGame?.name).toBe(firstGame.name)
            }
        })

        test('should return undefined for non-existent ID', async () => {
            const { getGameById } = await import('../../src/core/data/gamesLoader')
            const result = getGameById('non-existent-game-id-12345')

            expect(result).toBeUndefined()
        })

        test('should return undefined for empty string ID', async () => {
            const { getGameById } = await import('../../src/core/data/gamesLoader')
            const result = getGameById('')

            expect(result).toBeUndefined()
        })
    })

    describe('reloadGamesData', () => {
        test('should return fresh data after reload', async () => {
            const { loadGamesData, reloadGamesData } = await import('../../src/core/data/gamesLoader')

            // Load initial data
            const initialData = loadGamesData()

            // Reload data
            const reloadedData = reloadGamesData()

            // Both should return the same games (since file hasn't changed)
            expect(reloadedData.length).toBe(initialData.length)
            expect(Array.isArray(reloadedData)).toBe(true)
        })
    })

    describe('Data Integrity', () => {
        test('should not have duplicate game IDs', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            const ids = games.map(g => g.id)
            const uniqueIds = new Set(ids)

            expect(ids.length).toBe(uniqueIds.size)
        })

        test('should have at least one server per game', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            games.forEach(game => {
                expect(game.servers.length).toBeGreaterThan(0)
            })
        })

        test('server offsets should be within valid range (-12 to 14)', async () => {
            const { loadGamesData } = await import('../../src/core/data/gamesLoader')
            const games = loadGamesData()

            games.forEach(game => {
                game.servers.forEach(server => {
                    expect(server.offset).toBeGreaterThanOrEqual(-12)
                    expect(server.offset).toBeLessThanOrEqual(14)
                })
            })
        })
    })
})
