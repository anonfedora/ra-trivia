#!/bin/bash

# Install Chrome for Puppeteer on Render
echo "Installing Chrome for Puppeteer..."

# Note: Render doesn't allow sudo, so we rely on Puppeteer's built-in Chrome
echo "Note: Render doesn't allow sudo access, using Puppeteer's downloaded Chrome"

# Install Puppeteer browsers (this is what actually works on Render)
npx puppeteer browsers install chrome

echo "Chrome installation completed!"
