#!/bin/bash

# RTK Query Navigator Extension - Build and Install Script

set -e

echo "🔨 Building RTK Query Navigator extension..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Compile TypeScript
echo "⚙️  Compiling TypeScript..."
npm run compile

# Package extension
echo "📦 Packaging extension..."
npm run package

# Find the VSIX file
VSIX_FILE=$(ls *.vsix | head -1)
if [ -z "$VSIX_FILE" ]; then
  echo "❌ Error: No .vsix file found"
  exit 1
fi

VSIX_PATH="$(pwd)/$VSIX_FILE"

echo "✅ Extension packaged successfully!"
echo ""
echo "📦 Package created: $VSIX_FILE"
echo ""

# Try to install using code command
if command -v code &> /dev/null; then
  echo "🚀 Installing extension..."
  code --install-extension "$VSIX_PATH" --force
  echo ""
  echo "✅ RTK Query Navigator installed successfully!"
else
  echo "⚠️  'code' command not found in PATH"
  echo ""
  echo "📋 Manual Installation Instructions:"
  echo ""
  echo "Option 1 - Via VSCode:"
  echo "  1. Open VSCode"
  echo "  2. Press Cmd+Shift+P"
  echo "  3. Type: 'Extensions: Install from VSIX...'"
  echo "  4. Select: $VSIX_PATH"
  echo ""
  echo "Option 2 - Add 'code' to PATH:"
  echo "  1. Open VSCode"
  echo "  2. Press Cmd+Shift+P"
  echo "  3. Type: 'Shell Command: Install 'code' command in PATH'"
  echo "  4. Then run: ./install.sh again"
  echo ""
fi

echo "🎯 To activate:"
echo "  1. Reload VSCode window (Cmd+Shift+P -> 'Developer: Reload Window')"
echo "  2. Try Opt+Click on any RTK Query hook!"

