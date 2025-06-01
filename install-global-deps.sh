#!/bin/bash

# Global Dependencies Installation for Claude Code Graph
set -e

echo "🔧 Installing Claude Code Graph global dependencies..."

# Install Python dependencies globally  
echo "🐍 Installing Python dependencies globally..."
pip3 install --user pyan3==1.1.1 watchdog networkx psutil aiofiles || {
    echo "⚠️ Python dependencies install failed - trying with sudo..."
    sudo pip3 install pyan3==1.1.1 watchdog networkx psutil aiofiles || {
        echo "❌ Failed to install Python dependencies"
        echo "💡 Try: pip3 install --user pyan3==1.1.1 watchdog networkx psutil aiofiles"
    }
}

# Install Node.js global dependencies
echo "📦 Installing Node.js global dependencies..."
npm install -g tree-sitter-cli || echo "⚠️ tree-sitter-cli install failed (optional)"

# Test installations
echo "🧪 Testing installations..."

if python3 -m pyan --help > /dev/null 2>&1; then
    echo "✅ pyan3: Working"
else
    echo "❌ pyan3: Not working"
fi

if command -v tree-sitter > /dev/null 2>&1; then
    echo "✅ tree-sitter: Working"
else
    echo "⚠️ tree-sitter: Not available (optional)"
fi

if command -v madge > /dev/null 2>&1; then
    echo "✅ madge: Working"
else
    echo "❌ madge: Not available - install with: npm install -g madge"
fi

echo ""
echo "🎉 Global dependencies installation complete!"
echo "💡 Now you can use 'ccg init' in any project without local Python setup"