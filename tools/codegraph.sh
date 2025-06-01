#!/bin/bash

# claude-code-graph: One-shot graph builder
# Builds initial graph files if they don't exist or are outdated

set -e

GRAPH_DIR=".graph"
ROOT_DIR="$(pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Building code graph for $(basename $ROOT_DIR)...${NC}"

# Create graph directory if it doesn't exist
mkdir -p "$GRAPH_DIR/cache"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if file is newer than target
is_newer() {
    local source="$1"
    local target="$2"
    
    if [ ! -f "$target" ]; then
        return 0  # Target doesn't exist, source is "newer"
    fi
    
    if [ "$source" -nt "$target" ]; then
        return 0  # Source is newer
    fi
    
    return 1  # Target is newer or same age
}

# Function to get file count for language
count_files() {
    local pattern="$1"
    find . -name "$pattern" -not -path "./node_modules/*" -not -path "./.graph/*" -not -path "./dist/*" | wc -l
}

echo "📊 Analyzing project structure..."

# Count files by language
JS_COUNT=$(count_files "*.js")
TS_COUNT=$(count_files "*.ts")
PY_COUNT=$(count_files "*.py")
C_COUNT=$(count_files "*.c")
CPP_COUNT=$(count_files "*.cpp")

echo "   JavaScript/TypeScript: $((JS_COUNT + TS_COUNT)) files"
echo "   Python: $PY_COUNT files"
echo "   C/C++: $((C_COUNT + CPP_COUNT)) files"

# Build Tree-sitter graph (if tree-sitter is available)
if command_exists tree-sitter; then
    echo -e "${YELLOW}🌳 Building Tree-sitter AST graph...${NC}"
    
    # Check if we need to rebuild
    NEED_REBUILD=false
    
    # Check if any source files are newer than the graph
    for ext in "*.js" "*.ts" "*.py" "*.c" "*.cpp" "*.h" "*.hpp"; do
        if find . -name "$ext" -not -path "./node_modules/*" -not -path "./.graph/*" -newer "$GRAPH_DIR/ts.json" 2>/dev/null | grep -q .; then
            NEED_REBUILD=true
            break
        fi
    done
    
    if [ "$NEED_REBUILD" = true ] || [ ! -f "$GRAPH_DIR/ts.json" ]; then
        # Initialize tree-sitter if needed
        if [ ! -f ".tree-sitter/config.json" ]; then
            echo "   Initializing tree-sitter..."
            tree-sitter init-config
        fi
        
        # Query and build graph
        echo "   Generating AST graph..."
        tree-sitter query . --captures > "$GRAPH_DIR/ts.json" 2>/dev/null || {
            echo "   Using fallback method..."
            find . -name "*.js" -o -name "*.ts" -o -name "*.py" | head -1000 > "$GRAPH_DIR/file-list.txt"
            echo '{"nodes": [], "edges": [], "metadata": {"tool": "fallback", "timestamp": "'$(date -Iseconds)'"}}' > "$GRAPH_DIR/ts.json"
        }
        echo -e "   ${GREEN}✅ Tree-sitter graph updated${NC}"
    else
        echo -e "   ${GREEN}✅ Tree-sitter graph is up to date${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️ tree-sitter not found, using file list fallback${NC}"
    find . -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.c" -o -name "*.cpp" | \
        grep -v node_modules | grep -v .graph > "$GRAPH_DIR/file-list.txt"
fi

# Build Python call graph (if pyan3 is available and Python files exist)
if [ "$PY_COUNT" -gt 0 ]; then
    if command_exists pyan3; then
        echo -e "${YELLOW}🐍 Building Python call graph...${NC}"
        
        # Find Python files
        PY_FILES=$(find . -name "*.py" -not -path "./node_modules/*" -not -path "./.graph/*" -not -path "./venv/*" -not -path "./.venv/*" -not -path "./tools/codegraphd.py" | head -100)
        
        if [ -n "$PY_FILES" ]; then
            # Use virtual environment if available, fallback to system python
            if [ -f ".venv/bin/activate" ]; then
                source .venv/bin/activate
                echo "$PY_FILES" | xargs python -m pyan --dot --colored --grouped > "$GRAPH_DIR/py.dot" 2>/dev/null || {
                    echo '# Python call graph (fallback)' > "$GRAPH_DIR/py.dot"
                    echo "digraph G { rankdir=LR; }" >> "$GRAPH_DIR/py.dot"
                }
            else
                # Try python3.12 first, then python3
                echo "$PY_FILES" | xargs python3.12 -m pyan --dot --colored --grouped > "$GRAPH_DIR/py.dot" 2>/dev/null || \
                echo "$PY_FILES" | xargs python3 -m pyan --dot --colored --grouped > "$GRAPH_DIR/py.dot" 2>/dev/null || {
                    echo '# Python call graph (fallback)' > "$GRAPH_DIR/py.dot"
                    echo "digraph G { rankdir=LR; }" >> "$GRAPH_DIR/py.dot"
                }
            fi
            echo -e "   ${GREEN}✅ Python call graph generated${NC}"
        else
            echo -e "   ${YELLOW}⚠️ No Python files found${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️ pyan3 not found, skipping Python analysis${NC}"
    fi
fi

# Build JavaScript/TypeScript module graph (if madge is available)
if [ "$((JS_COUNT + TS_COUNT))" -gt 0 ]; then
    if command_exists madge; then
        echo -e "${YELLOW}📦 Building JavaScript/TypeScript module graph...${NC}"
        
        # Find JS/TS entry points
        ENTRY_POINTS=""
        for entry in "src/index.js" "src/index.ts" "index.js" "index.ts" "src/main.js" "src/main.ts"; do
            if [ -f "$entry" ]; then
                ENTRY_POINTS="$entry"
                break
            fi
        done
        
        if [ -n "$ENTRY_POINTS" ]; then
            madge "$ENTRY_POINTS" --json > "$GRAPH_DIR/js.json" 2>/dev/null || {
                # Fallback: analyze src directory
                madge src/ --json > "$GRAPH_DIR/js.json" 2>/dev/null || {
                    echo '{}' > "$GRAPH_DIR/js.json"
                }
            }
            echo -e "   ${GREEN}✅ JavaScript/TypeScript module graph generated${NC}"
        else
            echo -e "   ${YELLOW}⚠️ No JS/TS entry point found${NC}"
            echo '{}' > "$GRAPH_DIR/js.json"
        fi
    else
        echo -e "   ${YELLOW}⚠️ madge not found, skipping JS/TS analysis${NC}"
    fi
fi

# Build C/C++ dependency graph (if clangd or tree-sitter available)
if [ "$((C_COUNT + CPP_COUNT))" -gt 0 ]; then
    echo -e "${YELLOW}🔧 Building C/C++ dependency graph...${NC}"
    
    # Find C/C++ files
    CPP_FILES=$(find . -name "*.cpp" -o -name "*.cc" -o -name "*.cxx" -o -name "*.c" -o -name "*.h" -o -name "*.hpp" | \
                grep -v node_modules | grep -v .graph | grep -v .venv | head -500)
    
    if [ -n "$CPP_FILES" ]; then
        # Method 1: Try clangd-based analysis (if available)
        if command_exists clangd; then
            echo "   Using clangd for symbol analysis..."
            # Create a simple include graph
            {
                echo "digraph CppGraph {"
                echo "  rankdir=LR;"
                echo "  node [shape=box];"
                
                # Extract #include relationships
                for file in $CPP_FILES; do
                    if [ -f "$file" ]; then
                        # Get includes from this file
                        includes=$(grep "^#include" "$file" 2>/dev/null | grep -E '["<][^">]*[">]' | \
                                 sed 's/.*[<"]\([^">]*\)[">].*/\1/' | head -20)
                        
                        if [ -n "$includes" ]; then
                            base_file=$(basename "$file")
                            echo "  \"$base_file\" [label=\"$base_file\"];"
                            
                            for inc in $includes; do
                                # Only include local headers (not system headers)
                                if echo "$CPP_FILES" | grep -q "$inc\|$(basename "$inc" .h).cpp\|$(basename "$inc" .hpp).cpp"; then
                                    echo "  \"$base_file\" -> \"$inc\";"
                                fi
                            done
                        fi
                    fi
                done
                
                echo "}"
            } > "$GRAPH_DIR/cpp.dot" 2>/dev/null || {
                echo '# C++ dependency graph (fallback)' > "$GRAPH_DIR/cpp.dot"
                echo "digraph CppGraph { rankdir=LR; }" >> "$GRAPH_DIR/cpp.dot"
            }
            echo -e "   ${GREEN}✅ C++ dependency graph generated${NC}"
            
        # Method 2: Basic include analysis (fallback)
        else
            echo "   Using basic include analysis..."
            {
                echo "{"
                echo "  \"nodes\": ["
                
                first=true
                for file in $CPP_FILES; do
                    if [ -f "$file" ]; then
                        [ "$first" = true ] && first=false || echo ","
                        rel_path=$(echo "$file" | sed 's|^\./||')
                        echo "    {\"id\": \"$rel_path\", \"type\": \"file\", \"language\": \"cpp\"}"
                    fi
                done
                
                echo "  ],"
                echo "  \"edges\": ["
                
                first=true
                for file in $CPP_FILES; do
                    if [ -f "$file" ]; then
                        rel_path=$(echo "$file" | sed 's|^\./||')
                        includes=$(grep "^#include" "$file" 2>/dev/null | grep -E '["<][^">]*[">]' | \
                                 sed 's/.*[<"]\([^">]*\)[">].*/\1/' | head -10)
                        
                        for inc in $includes; do
                            target_file=""
                            # Try to find the included file in our file list
                            for candidate in $CPP_FILES; do
                                if echo "$candidate" | grep -q "$inc"; then
                                    target_file=$(echo "$candidate" | sed 's|^\./||')
                                    break
                                fi
                            done
                            
                            if [ -n "$target_file" ] && [ "$target_file" != "$rel_path" ]; then
                                [ "$first" = true ] && first=false || echo ","
                                echo "    {\"from\": \"$rel_path\", \"to\": \"$target_file\", \"type\": \"includes\"}"
                            fi
                        done
                    fi
                done
                
                echo "  ],"
                echo "  \"metadata\": {\"tool\": \"include_analysis\", \"timestamp\": \"$(date -Iseconds)\"}"
                echo "}"
            } > "$GRAPH_DIR/cpp.json" 2>/dev/null || {
                echo '{"nodes": [], "edges": [], "metadata": {"tool": "fallback", "timestamp": "'$(date -Iseconds)'"}}' > "$GRAPH_DIR/cpp.json"
            }
            echo -e "   ${GREEN}✅ C++ include graph generated${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️ No C/C++ files found${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️ No C/C++ files to analyze${NC}"
fi

# Generate metrics
echo -e "${YELLOW}📈 Generating graph metrics...${NC}"

TOTAL_FILES=$((JS_COUNT + TS_COUNT + PY_COUNT + C_COUNT + CPP_COUNT))
TIMESTAMP=$(date -Iseconds)

cat > "$GRAPH_DIR/metrics.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "project": "$(basename $ROOT_DIR)",
  "total_files": $TOTAL_FILES,
  "by_language": {
    "javascript": $JS_COUNT,
    "typescript": $TS_COUNT,
    "python": $PY_COUNT,
    "c": $C_COUNT,
    "cpp": $CPP_COUNT
  },
  "analyzers": {
    "tree_sitter": $(command_exists tree-sitter && echo "true" || echo "false"),
    "pyan3": $(command_exists pyan3 && echo "true" || echo "false"),
    "madge": $(command_exists madge && echo "true" || echo "false"),
    "clangd": $(command_exists clangd && echo "true" || echo "false")
  },
  "graph_files": {
    "ast": "$([ -f "$GRAPH_DIR/ts.json" ] && echo "true" || echo "false")",
    "python": "$([ -f "$GRAPH_DIR/py.dot" ] && echo "true" || echo "false")",
    "cpp": "$([ -f "$GRAPH_DIR/cpp.json" ] || [ -f "$GRAPH_DIR/cpp.dot" ] && echo "true" || echo "false")",
    "javascript": "$([ -f "$GRAPH_DIR/js.json" ] && echo "true" || echo "false")"
  }
}
EOF

echo -e "${GREEN}🎉 Graph build complete!${NC}"
echo ""
echo "Generated files:"
[ -f "$GRAPH_DIR/ts.json" ] && echo "  📄 $GRAPH_DIR/ts.json (AST graph)"
[ -f "$GRAPH_DIR/py.dot" ] && echo "  📄 $GRAPH_DIR/py.dot (Python calls)"
[ -f "$GRAPH_DIR/js.json" ] && echo "  📄 $GRAPH_DIR/js.json (JS/TS modules)"
echo "  📄 $GRAPH_DIR/metrics.json (metrics)"
echo ""
echo "Next: Start the graph daemon with 'npm run graph:daemon'"