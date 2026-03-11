#!/bin/bash

# Render-specific build script
echo "Starting Render build process..."

# Install Chrome dependencies first
echo "Installing Chrome dependencies..."
sudo apt-get update
sudo apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    libnss3-dev \
    libatk-bridge2.0-dev \
    libdrm2 \
    libxkbcommon-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libxrandr-dev \
    libgbm-dev \
    libxss-dev \
    libasound2-dev

# Install Chrome
echo "Installing Google Chrome..."
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install Puppeteer browsers
echo "Installing Puppeteer Chrome..."
npx puppeteer browsers install chrome --path /opt/render/.cache/puppeteer

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate --schema=../../packages/database/prisma/schema.prisma

# Build the application
echo "Building TypeScript application..."
npx tsc

echo "Render build completed successfully!"
