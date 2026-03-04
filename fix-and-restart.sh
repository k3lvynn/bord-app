#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Bord — Fix & Restart Script
# Run this from inside the bord-app folder:
#   cd ~/Desktop/bord-app
#   bash fix-and-restart.sh
# ─────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(pwd)"

echo ""
echo "🔧 Step 1 — Fix Watchman recrawl warning..."
watchman watch-del "$PROJECT_DIR" 2>/dev/null || true
watchman watch-project "$PROJECT_DIR"
echo "✅ Watchman reset"

echo ""
echo "🔧 Step 2 — Clear Metro bundler cache..."
npx expo start --clear --port 8081 &
EXPO_PID=$!
sleep 3
kill $EXPO_PID 2>/dev/null || true
echo "✅ Cache cleared"

echo ""
echo "🔧 Step 3 — Verify node_modules are up to date..."
npm install
echo "✅ Dependencies installed"

echo ""
echo "🚀 Starting Expo..."
echo "   Scan the QR code with your iPhone (Expo Go app)"
echo "   Or press 'i' for iOS simulator"
echo ""
npx expo start --clear
