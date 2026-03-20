-include .deck

DECK_HOST ?= deck@steamdeck.lan
PLUGIN_DIR = /home/deck/homebrew/plugins/Flinger

.PHONY: build deploy test clean

build:
	pnpm run build

deploy: build
	ssh $(DECK_HOST) 'mkdir -p $(PLUGIN_DIR)'
	scp plugin.json package.json main.py $(DECK_HOST):$(PLUGIN_DIR)/
	scp -r dist $(DECK_HOST):$(PLUGIN_DIR)/
	ssh $(DECK_HOST) 'sudo systemctl restart plugin_loader'
	@echo "Deployed. Open the QAM to verify."

test:
	python3 test_backend.py

clean:
	rm -rf dist
