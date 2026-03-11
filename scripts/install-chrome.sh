#!/bin/bash

# Install Chrome for Puppeteer on Render
echo "Installing Chrome for Puppeteer..."

# Note: Render doesn't allow sudo, so we rely on Puppeteer's built-in Chrome
echo "Note: Render doesn't allow sudo access, using Puppeteer's downloaded Chrome"

# Install Puppeteer browsers (this is what actually works on Render)
npx puppeteer browsers install chrome

# Find the installed Chrome path and make it executable
CHROME_PATH=$(find /opt/render/.cache/puppeteer -name chrome -type f 2>/dev/null | head -n 1)

if [ -n "$CHROME_PATH" ]; then
    echo "Chrome found at: $CHROME_PATH"
    chmod +x "$CHROME_PATH" 2>/dev/null || echo "Could not chmod (may not have permissions)"
    export PUPPETEER_EXECUTABLE_PATH="$CHROME_PATH"
    echo "Set PUPPETEER_EXECUTABLE_PATH=$CHROME_PATH"
else
    echo "Warning: Chrome binary not found in cache"
fi

echo "Chrome installation completed!"
