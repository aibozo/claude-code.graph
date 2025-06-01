# Claude Code Graph

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) ![](https://img.shields.io/badge/Python-3.8%2B-blue?style=flat-square) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Claude Code with intelligent code graphs for large codebases**

Claude Code Graph enhances Claude Code with live structural analysis of your codebase. It builds and maintains graphs of your code's architecture, dependencies, and relationships - giving Claude deep contextual understanding of even the largest projects.

## 🚀 Quick Start

### Prerequisites

Make sure you have Claude Code installed first:
```bash
npm install -g @anthropic-ai/claude-code
```

### Installation

1. **Install Claude Code Graph globally:**
   ```bash
   npm install -g claude-code-graph
   ```

2. **Navigate to your project and start coding:**
   ```bash
   cd your-project/
   ccg start
   ```

That's it! The first run will automatically:
- Initialize graph structures
- Build code analysis graphs
- Start the live update daemon  
- Launch Claude Code with graph intelligence

## 🎯 What It Does

Claude Code Graph provides Claude with:

- **Dependency Analysis**: Understand how files and modules relate to each other
- **Call Graph Mapping**: Track function calls and inheritance chains across languages
- **AST Structure**: Deep understanding of code syntax and semantics
- **Architecture Overview**: High-level view of your codebase organization
- **Live Updates**: Graphs stay current as you code

### Supported Languages

- **JavaScript/TypeScript**: Module dependencies via madge
- **Python**: Call graphs via pyan3, import analysis
- **C/C++**: Include dependencies, symbol analysis  
- **Universal**: AST parsing with tree-sitter for all languages

## 📋 Commands

| Command | Description |
|---------|-------------|
| `ccg start` | Launch Claude Code with graph intelligence (auto-setup) |
| `ccg doctor` | Check system health and dependencies |
| `ccg status` | Show current graph and daemon status |
| `ccg build` | Manually rebuild all graphs |
| `ccg daemon start/stop` | Manage live graph update daemon |
| `ccg init` | Initialize graphs in new project (manual setup) |

## 🔧 Advanced Setup

### Manual Workflow (if needed)

```bash
# 1. Initialize in your project
ccg init

# 2. Check dependencies 
ccg doctor

# 3. Build graphs
ccg build

# 4. Start daemon for live updates
ccg daemon start

# 5. Launch Claude Code
ccg start
```

### Dependencies

**Required:**
- Node.js 18+
- Python 3.8+
- madge (for JS/TS analysis)

**Optional (improves analysis):**
- tree-sitter-cli: `npm install -g tree-sitter-cli`
- pyan3: `pip install pyan3`
- Python packages: `pip install watchdog networkx psutil aiofiles`

**Check with:** `ccg doctor`

## 📊 Performance

Claude Code Graph is optimized for large codebases:

- **Smart Filtering**: Skips `node_modules`, build directories, etc.
- **File Limits**: Processes up to 500 files for tree-sitter, 200 for C++, 50 for Python
- **Incremental Updates**: Only processes changed files via daemon
- **Caching**: Intelligent caching for faster subsequent runs

For projects with 1000+ files, initial graph building takes 2-5 minutes instead of 30+ minutes.

## 📁 Project Structure

```
your-project/
├── .graph/                 # Graph data (auto-created)
│   ├── js.json            # JavaScript/TypeScript modules  
│   ├── py.dot             # Python call graph
│   ├── cpp.json           # C++ dependencies
│   ├── ts.json            # Tree-sitter AST
│   ├── metrics.json       # Graph statistics
│   └── daemon.lock        # Daemon status
├── .gitignore             # Updated to exclude .graph/
└── your code...
```

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/aibozo/claude-code.graph.git
cd claude-code-graph

# Install dependencies
npm install

# Build tools
npm run build

# Install globally for testing
npm install -g .

# Run tests
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request

## 📝 License

MIT License - see [LICENSE.md](LICENSE.md) for details.

## 🐛 Issues & Support

- Report bugs: [GitHub Issues](https://github.com/aibozo/claude-code.graph/issues)
- For Claude Code issues: Use `/bug` command or [Claude Code Issues](https://github.com/anthropics/claude-code/issues)

## 🔗 Links

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Claude Code Repository](https://github.com/anthropics/claude-code)
- [Anthropic Website](https://www.anthropic.com)

---

**Made with ❤️ for better AI-assisted coding**