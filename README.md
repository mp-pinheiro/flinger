# Flinger

A [Decky Loader](https://decky.xyz/) plugin that lets you browse, search, and download [FLiNG Trainers](https://flingtrainer.com/) directly from Steam Deck Game Mode.

Downloaded trainers are saved to `~/FLiNG-Trainers/` where [CheatDeck](https://github.com/JustinLlowormo/CheatDeck) can select them per-game.

## Features

- Browse ~724 FLiNG trainers without leaving Game Mode
- Search with instant client-side filtering
- View trainer details (options count, game version, last updated)
- Download and extract trainers with one tap
- Manage downloaded trainers (view, delete)

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

The Python backend fetches trainer listings from flingtrainer.com, parses HTML with stdlib `HTMLParser`, and caches results for 5 minutes. Downloads are extracted from .zip files into `~/FLiNG-Trainers/{trainer-name}/`.

The React frontend communicates with the backend via Decky's `callable` API, providing a searchable list view and a detail view with download buttons.
