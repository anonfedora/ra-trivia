#!/bin/bash

# Install Chrome for Puppeteer on Render
echo "Installing Chrome for Puppeteer..."

# Update package list
sudo apt-get update

# Install dependencies required by Chrome
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

# Download and install Chrome
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# Install Puppeteer browsers
npx puppeteer browsers install chrome

echo "Chrome installation completed!"
