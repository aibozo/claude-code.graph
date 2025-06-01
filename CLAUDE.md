# Claude Code Graph Instructions

This project uses claude-code-graph for intelligent code navigation and todo-graph integration.

## Graph Intelligence

The codebase is automatically analyzed and compressed into semantic clusters. Use these commands for navigation:

- `/clusters` - Show cluster overview
- `/cluster <id>` - Expand specific cluster details  
- `/csearch <query>` - Search across clusters
- `/cfile <path>` - Get detailed file information

## Todo-Graph Integration

**IMPORTANT**: When creating todos, include specific file paths to enable graph integration:

### ✅ Good Todo Examples:
```
"Fix performance issue in src/graph/GraphClustering.js around line 145"
"Update cluster c2 to include better file organization" 
"Add tests to tests/graph/clustering.test.js and GraphService.js"
"Debug import issue in ./tools/fast-treesitter.js"
"Refactor graph/ClusterTools.js methods for better readability"
```

### ❌ Avoid Vague Todos:
```
"Fix the bug" (no context)
"Update the code" (no files specified)
"Make it faster" (no target location)
"Add more tests" (no specific areas)
```

### File Path Formats That Work:
- **Absolute paths**: `src/graph/GraphService.js`
- **Relative paths**: `./tools/codegraph.sh`
- **Directory paths**: `tests/integration/`
- **Cluster references**: `cluster c2`, `c0 modules`
- **With line numbers**: `index.js:42`, `GraphTool.js:100-120`

## Benefits of Good Todo Practices

When you include file paths in todos:
- **Graph integration**: Todos automatically link to code clusters
- **Context awareness**: I can understand task-code relationships
- **Impact analysis**: See which code areas have pending work
- **Better navigation**: Jump directly to relevant files/clusters
- **Progress tracking**: Visual todo-graph connections for debugging

## Project Architecture

This codebase is organized into these clusters:
- **c0**: Core modules and main functionality
- **c1**: Graph processing and tool selection  
- **c2**: Graph generation and clustering tools
- **c3**: Testing and cluster utilities
- **misc**: Build tools, config, and Python scripts

Use cluster references in todos to target architectural areas effectively.

## Commands & Scripts

- `npm run build` - Build and compile project
- `npm test` - Run test suite
- `ccg start` - Launch with graph intelligence
- `ccg doctor` - Check system health
- `ccg status` - Show current graph status

## Performance Notes

- Graph building takes 2-5 minutes for large codebases (optimized from 30+ minutes)
- Clustering provides 100x compression for navigation efficiency
- Live daemon updates graphs as you modify files
- Tree-sitter parsing with smart filtering for multi-language support