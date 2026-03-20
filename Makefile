-include .env
export

DECK_CONN = $(DECK_USER)@$(DECK_HOST)
PLUGIN_DIR = /home/deck/homebrew/plugins/Flinger
LOGS_DIR = /home/deck/homebrew/logs/Flinger

SSH_CMD = sshpass -p '$(DECK_PASSWORD)' ssh -o StrictHostKeyChecking=no $(DECK_CONN)
SCP_CMD = sshpass -p '$(DECK_PASSWORD)' scp -o StrictHostKeyChecking=no

.PHONY: build deploy test clean logs

build:
	pnpm run build

deploy: build
	$(SSH_CMD) 'echo '"'"'$(DECK_PASSWORD)'"'"' | sudo -S -p "" rm -rf $(PLUGIN_DIR) && echo '"'"'$(DECK_PASSWORD)'"'"' | sudo -S -p "" mkdir -p $(PLUGIN_DIR)'
	$(SSH_CMD) 'mkdir -p /tmp/flinger-deploy'
	$(SCP_CMD) plugin.json package.json main.py $(DECK_CONN):/tmp/flinger-deploy/
	$(SCP_CMD) -r dist $(DECK_CONN):/tmp/flinger-deploy/
	$(SSH_CMD) 'echo '"'"'$(DECK_PASSWORD)'"'"' | sudo -S -p "" cp -r /tmp/flinger-deploy/* $(PLUGIN_DIR)/ && rm -rf /tmp/flinger-deploy'
	-$(SSH_CMD) 'echo '"'"'$(DECK_PASSWORD)'"'"' | sudo -S -p "" systemctl restart plugin_loader'
	@echo "Deployed. Open the QAM to verify."

test:
	python3 test_backend.py

logs:
	$(SSH_CMD) 'cat $(LOGS_DIR)/plugin.log 2>/dev/null || echo "No log file found"'

clean:
	rm -rf dist
