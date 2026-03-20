# Changelog

## 0.8.0

- Fix Y button (not X) triggering search focus on browse tab
- Add deleting state guard to prevent double-press on delete in TrainerDetail and MyTrainerDetail
- Redesign About section: drop Field columnar layout, use full-width Focusable blocks with DialogButton links
- Add version footer to About tabs and QAM panel
- Add About section to QAM panel with CheatDeck and GitHub links via NavigateToExternalWeb
- Fix GitHub buttons in About not reachable (DialogButton was nested inside onActivate Focusable)

## 0.7.0

- Use Tabs component for native Steam scroll on browse and detail pages
- Remove pagination, render full trainer list with native dpad scrolling
- Move downloaded badge and delete button inline per download item
- Remove separate Actions section from trainer detail

## 0.6.0

- Move browse and detail views to full-screen routed pages
- Add pagination to browse list (5 per page) and downloads (2 per page)
- Persist browse page position when navigating back from detail
- Add top padding to clear Steam system bar
- Track per-download status with trainer meta

## 0.5.0

- Replace ButtonItem with Field component for proper gamepad focusability
- Add visual hierarchy with styled badges, section headers, and download items
- Add redownload button for already-downloaded trainers
- Improve downloaded trainer detection with helper functions
- Style downloaded trainers with green accent in the list

## 0.4.0

- Filter "My Trainers Archive" from trainer list (not actual trainer content)

## 0.3.0

- Fix SSL certificate verification using certifi instead of hardcoded CA paths

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
