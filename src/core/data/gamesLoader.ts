import { readFileSync, statSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import { logger } from '../logger'

// Game data types
export interface GameServer {
    name: string
    timezone: string
    offset: number
    dailyReset: string
}

export interface Game {
    id: string
    name: string
    description: string
    banner: string
    servers: GameServer[]
}

interface GamesData {
    games: Game[]
}

// Path to games data file
const GAMES_DATA_PATH = join(process.cwd(), 'src', 'data', 'games.yaml')

// Cache for loaded games data
let gamesCache: Game[] | null = null
let lastModifiedTime: number | null = null

/**
 * Load games data from YAML file
 * @returns Array of game objects
 */
export function loadGamesData(): Game[] {
    try {
        // Check if file has been modified
        const stats = statSync(GAMES_DATA_PATH)
        const currentModifiedTime = stats.mtime.getTime()
        
        // If cache exists and file hasn't been modified, return cached data
        if (gamesCache && lastModifiedTime && currentModifiedTime <= lastModifiedTime) {
            return gamesCache
        }
        
        // Clear cache and reload
        gamesCache = null
        lastModifiedTime = currentModifiedTime
    } catch (error) {
        // If we can't check file stats, proceed with normal loading
    }

    try {
        // Read and parse YAML file
        const fileContent = readFileSync(GAMES_DATA_PATH, 'utf-8')
        const data = yaml.load(fileContent) as GamesData

        // Validate data structure
        if (!data || !Array.isArray(data.games)) {
            throw new Error('Invalid games data structure')
        }

        // Sort games alphabetically by name for consistent ordering
        const sortedGames = [...data.games].sort((a, b) => a.name.localeCompare(b.name))

        // Cache the sorted data
        gamesCache = sortedGames
        logger.info('Games data loaded successfully', { count: gamesCache.length })

        return gamesCache
    } catch (error) {
        logger.error('Failed to load games data', { error, path: GAMES_DATA_PATH })
        // Return empty array on error
        return []
    }
}

/**
 * Get a specific game by ID
 * @param id Game ID
 * @returns Game object or undefined
 */
export function getGameById(id: string): Game | undefined {
    const games = loadGamesData()
    return games.find(game => game.id === id)
}

/**
 * Reload games data from file (clears cache)
 */
export function reloadGamesData(): Game[] {
    gamesCache = null
    lastModifiedTime = null
    logger.info('Games data cache cleared, reloading...')
    return loadGamesData()
}