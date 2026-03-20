# Flinger

A [Decky Loader](https://decky.xyz/) plugin that lets you browse, search, and download [FLiNG Trainers](https://flingtrainer.com/) directly from Steam Deck Game Mode.

> **Note:** All trainer data and downloads are fetched exclusively from `https://flingtrainer.com`. No third-party mirrors or repackaged files are used.

Downloaded trainers are saved to `~/FLiNG-Trainers/` where [CheatDeck](https://github.com/SheffeyG/CheatDeck) can select them per-game.

## Features

- Browse & search 700+ FLiNG trainers (search persists across navigation)
- Native D-pad navigation via Steam's Tabs component
- View trainer details (options, version, last updated, available downloads)
- Download and extract trainers (zip or exe)
- "My Trainers" tab showing only downloaded trainers
- Delete downloaded trainers with double-press guard
- QAM panel with download count, quick navigation, and links

## Building

```bash
pnpm install
pnpm run build
```

## Deploying to Steam Deck

Copy the plugin directory to your Deck:

```bash
scp -r . deck@steamdeck:~/homebrew/plugins/Flinger/
```

Then restart Decky Loader from the Quick Access Menu.

## Project Structure

```
flinger/
├── main.py            # Python backend (HTTP, parsing, downloads)
├── src/index.tsx       # React frontend (search, list, detail views)
├── plugin.json         # Decky plugin metadata
├── package.json        # Node dependencies
├── tsconfig.json       # TypeScript config
└── rollup.config.js    # Build config
```

## How It Works

The Python backend fetches trainer listings from flingtrainer.com, parses HTML with regex-based parsing, and caches results for 5 minutes. Downloads are extracted from .zip or .exe files into `~/FLiNG-Trainers/{trainer-name}/`.

The React frontend communicates with the backend via Decky's `callable` API, providing a searchable list view and a detail view with download buttons.
