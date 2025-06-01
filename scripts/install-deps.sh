#!/bin/bash

set -e

echo "🔧 Installing claude-code-graph dependencies..."

# Create scripts directory if it doesn't exist
mkdir -p scripts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install package based on OS
install_package() {
    local package=$1
    
    if command_exists brew; then
        echo "Installing $package with brew..."
        brew install "$package"
    elif command_exists apt-get; then
        echo "Installing $package with apt..."
        sudo apt-get update && sudo apt-get install -y "$package"
    elif command_exists pacman; then
        echo "Installing $package with pacman..."
        sudo pacman -S "$package"
    else
        echo -e "${RED}❌ No supported package manager found. Please install $package manually.${NC}"
        return 1
    fi
}

echo "📦 Checking system dependencies..."

# Check and install system dependencies
SYSTEM_DEPS=("graphviz" "ripgrep")

for dep in "${SYSTEM_DEPS[@]}"; do
    if command_exists "$dep"; then
        echo -e "${GREEN}✅ $dep is already installed${NC}"
    else
        echo -e "${YELLOW}⚠️ Installing $dep...${NC}"
        case "$dep" in
            "ripgrep")
                if command_exists brew; then
                    brew install ripgrep
                elif command_exists apt-get; then
                    sudo apt-get update && sudo apt-get install -y ripgrep
                else
                    echo -e "${RED}❌ Please install ripgrep manually${NC}"
                fi
                ;;
            *)
                install_package "$dep"
                ;;
        esac
    fi
done

# Check for clangd (optional for C/C++ projects)
if command_exists clangd; then
    echo -e "${GREEN}✅ clangd is available${NC}"
else
    echo -e "${YELLOW}⚠️ clangd not found (optional for C/C++ analysis)${NC}"
    echo "To install clangd:"
    if command_exists brew; then
        echo "  brew install llvm"
    elif command_exists apt-get; then
        echo "  sudo apt-get install clangd"
    fi
fi

# Check for watchman (optional, for better file watching)
if command_exists watchman; then
    echo -e "${GREEN}✅ watchman is available${NC}"
else
    echo -e "${YELLOW}⚠️ watchman not found (optional for enhanced file watching)${NC}"
    echo "To install watchman:"
    if command_exists brew; then
        echo "  brew install watchman"
    elif command_exists apt-get; then
        echo "  sudo apt-get install watchman"
    fi
fi

echo "🐍 Checking Python dependencies..."

# Check Python and pip
if command_exists python3; then
    echo -e "${GREEN}✅ Python 3 is available${NC}"
    python3 --version
else
    echo -e "${RED}❌ Python 3 is required${NC}"
    exit 1
fi

if command_exists pip3; then
    echo -e "${GREEN}✅ pip3 is available${NC}"
else
    echo -e "${RED}❌ pip3 is required${NC}"
    exit 1
fi

# Install Python dependencies
echo "Installing Python packages..."
pip3 install --user watchdog networkx psutil aiofiles

# Check for pyan3 (install if not available)
if python3 -c "import pyan" 2>/dev/null; then
    echo -e "${GREEN}✅ pyan3 is available${NC}"
else
    echo -e "${YELLOW}⚠️ Installing pyan3...${NC}"
    pip3 install --user pyan3
fi

echo "🟢 Node.js dependencies..."

# Check Node.js and npm
if command_exists node; then
    echo -e "${GREEN}✅ Node.js is available${NC}"
    node --version
else
    echo -e "${RED}❌ Node.js is required${NC}"
    exit 1
fi

if command_exists npm; then
    echo -e "${GREEN}✅ npm is available${NC}"
else
    echo -e "${RED}❌ npm is required${NC}"
    exit 1
fi

# Check for tree-sitter (install globally if not available)
if command_exists tree-sitter; then
    echo -e "${GREEN}✅ tree-sitter is available${NC}"
else
    echo -e "${YELLOW}⚠️ Installing tree-sitter globally...${NC}"
    npm install -g tree-sitter-cli
fi

# Install madge for JavaScript dependency analysis
if command_exists madge; then
    echo -e "${GREEN}✅ madge is available${NC}"
else
    echo -e "${YELLOW}⚠️ Installing madge globally...${NC}"
    npm install -g madge
fi

echo "🎉 Dependency installation complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm install' to install Node.js project dependencies"
echo "2. Run 'npm run doctor' to verify the installation"
echo "3. Run 'npm run init' to set up a project"