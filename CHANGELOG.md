# Changelog

## 0.2.0

- Fix html.parser import removed (unavailable in Decky sandbox), replaced with regex-based parsing
- Fix download link regex to be attribute-order independent (was returning 0 downloads)
- Add make logs target reading plugin.log directly
- Add frontend log() callable routing frontend events to plugin.log
- Add full traceback logging on all backend errors

## 0.1.0

- Fix trainer list parser for absolute URLs
- Handle exe downloads in addition to zip files
- Add backend test suite and Makefile
- Initial implementation of Flinger Decky plugin
- Python backend: trainer list fetching, detail parsing, zip download/extraction
- React frontend: search, paginated list, detail view with download buttons
- In-memory cache with 5-min TTL for trainer list
- Downloaded trainers saved to ~/FLiNG-Trainers/ for CheatDeck integration
