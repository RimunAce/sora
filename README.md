# Sora - ~~Gacha~~ Game Server Tracker

Track server reset times for your favorite ~~gacha~~ games across different regions. That's pretty much it.

## Quick Start

```bash
# Clone and install
git clone https://github.com/RimunAce/sora
cd sora
bun install

# Run in development
bun run dev

# Build and start
bun run build
bun run start

# Run tests
bun test
```

## What's This?

Sora helps you keep track of when your gacha games reset their servers. No more missing daily rewards! It supports many major/minor/ever title.
It's expandable so it's easy to add more games in the future (or remove some)

Just load it up, select your timezone, and see countdown timers for each game server. Simple as that.

## Features

- Real-time countdowns to server resets
- Support for multiple timezones
- Mobile-friendly design (PWA installable)
- Easy to extend with more games
- Discord webhook - Request and Report
- Import/Export your favorites and settings
- Hide specific servers you don't play
- Customization: 24h toggle, seconds display, compact mode
- Dashboard with dailies tracking
- Favorites with compact mode view

## Testing

Sora uses Bun's built-in test runner:

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run with coverage report
bun test --coverage

# Run specific test files
bun test tests/unit/gamesLoader.test.ts
bun test tests/integration/api.test.ts
bun test tests/security/security.test.ts
```

### Test Categories

| Category | Description |
|----------|-------------|
| Unit Tests | Core functions: gamesLoader, logger |
| Integration Tests | API routes, page serving, static files |
| Security Tests | Path traversal, input validation, error disclosure |

## Privacy Policy

Sora operates on a **Local-First** model. All your data (favorites, settings, hidden servers) is stored entirely in your browser's `localStorage`. We do not track you, and your data never leaves your device unless you explicitly export it.

## Tech Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Framework**: TinyHTTP (lightweight web framework)
- **Language**: TypeScript
- **Config**: YAML-based game data
- **Testing**: Bun Test (built-in test runner)

## Adding Games

Want to add a new game? Just edit `src/data/games.yaml` and add your game with its server reset times. The format is pretty straightforward - just follow the existing examples.

```yaml
games:
    - id: unique-game-id
    name: Game Name
    description: Brief description of the game
    banner: /path/to/game/banner.jpg (usually in assets/images/games)
    servers:
        - name: Server Region Name
        timezone: Timezone abbreviation or UTC offset
        offset: Numeric UTC offset
        dailyReset: "HH:MM" (24-hour format)
```

## Contributing

Feel free to open issues, suggest games, or submit PRs. This is meant to be a community project for fellow gacha gamers.

## License

MIT License - feel free to use this however you want.

---

Just something taking inspiration from [Game-Time-Master](https://github.com/cicerakes/Game-Time-Master)

Also because I want to use TinyHTTP rather than Elysia/Hono/Nest