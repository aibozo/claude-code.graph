#!/bin/bash

# Claude Code Graph Installation Script
set -e

echo "🧠 Installing Claude Code Graph..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please install Python 3.8+ first."
    exit 1
fi

# Install global dependencies
echo "📦 Installing global dependencies..."
npm install -g tree-sitter-cli || echo "⚠️ tree-sitter-cli install failed (optional)"

# Install Python dependencies
echo "🐍 Installing Python dependencies..."
pip3 install pyan3==1.1.1 watchdog networkx psutil aiofiles

# Install claude-code-graph
echo "🚀 Installing claude-code-graph..."
npm install -g .

echo "✅ Installation complete!"
echo ""
echo "🎯 Quick start:"
echo "  ccg init          # Initialize in your project"
echo "  ccg doctor        # Check health"
echo "  ccg start         # Launch Claude Code with graphs"
echo ""
echo "📖 More info: https://github.com/aibozo/claude-code.graph"