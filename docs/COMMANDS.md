# Claude Code Graph Commands

Claude Code Graph provides powerful slash commands for exploring and managing your codebase structure.

## Quick Reference

### 📊 Graph Analysis Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/graph-overview` | Show architecture overview | `/graph-overview` |
| `/find-related <file>` | Find files related to a specific file | `/find-related src/auth/login.js` |
| `/hot-paths` | Show most frequently used code paths | `/hot-paths --limit=5` |
| `/cycles` | Detect circular dependencies | `/cycles --language=javascript` |
| `/graph-stats` | Show graph statistics | `/graph-stats` |
| `/graph-health` | Check graph system health | `/graph-health` |

### 🤖 Daemon Control Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/dstart` | Start the graph update daemon | `/dstart --background` |
| `/dstop` | Stop the graph update daemon | `/dstop --force` |
| `/dstatus` | Show daemon status and metrics | `/dstatus` |
| `/gupdate` | Manually update all graphs | `/gupdate --force` |

## Detailed Usage

### Graph Analysis

#### `/graph-overview`
Shows a comprehensive overview of your codebase architecture:

```
/graph-overview
```

**Output includes:**
- Project metrics (file counts, languages)
- Module analysis per language
- Top connected components
- Hot paths preview
- Circular dependency warnings

#### `/find-related <filename>`
Discovers files related to a target file through imports, function calls, and inheritance:

```
/find-related src/components/Button.jsx
```

**Options:**
- `--depth=N` - Set relationship search depth (default: 3)
- `--limit=N` - Limit number of results (default: 20)

**Finds:**
- Files that import the target
- Files imported by the target
- Files with function calls to/from target
- Inheritance relationships

#### `/hot-paths`
Identifies the most frequently used code paths in your codebase:

```
/hot-paths --limit=10
```

**Shows:**
- High-traffic code paths
- Most connected components
- Critical dependency chains
- Potential refactoring targets

#### `/cycles`
Detects circular dependencies that could cause issues:

```
/cycles --language=python
```

**Options:**
- `--language=<lang>` - Filter by specific language

**Benefits:**
- Identifies problematic dependency loops
- Helps improve code architecture
- Suggests refactoring opportunities

### Daemon Management

#### `/dstart` - Start Daemon
Starts the live graph update daemon for real-time updates:

```
/dstart
/dstart --background
```

**Features:**
- Monitors file changes in real-time
- Updates graphs incrementally (< 100ms)
- Runs in background automatically
- Smart analyzer selection

#### `/dstop` - Stop Daemon
Gracefully stops the running daemon:

```
/dstop
/dstop --force
```

**Options:**
- `--force` - Force immediate termination

#### `/dstatus` - Daemon Status
Shows comprehensive daemon status and performance metrics:

```
/dstatus
```

**Displays:**
- Running status and PID
- Performance metrics (updates, errors, timing)
- Memory usage
- Graph statistics
- Control options

#### `/gupdate` - Manual Update
Triggers manual graph rebuild:

```
/gupdate
/gupdate --force
```

**Behavior:**
- If daemon running: Sends refresh signal (fast)
- If daemon stopped: Runs full rebuild (slower)
- `--force`: Always runs full rebuild

## Workflow Examples

### 🚀 Getting Started

1. **Initialize graphs:**
   ```
   /gupdate
   ```

2. **Start live updates:**
   ```
   /dstart
   ```

3. **Check system health:**
   ```
   /graph-health
   ```

### 🔍 Code Exploration

1. **Understand architecture:**
   ```
   /graph-overview
   ```

2. **Explore specific component:**
   ```
   /find-related src/components/Header.jsx
   ```

3. **Find performance hotspots:**
   ```
   /hot-paths
   ```

### 🛠️ Maintenance

1. **Check for circular dependencies:**
   ```
   /cycles
   ```

2. **Monitor daemon performance:**
   ```
   /dstatus
   ```

3. **Refresh after major changes:**
   ```
   /gupdate --force
   ```

## Integration with Claude Code

These commands integrate seamlessly with Claude Code's existing functionality:

### Enhanced File Discovery

When you ask Claude questions like:
- "Show me files related to authentication"
- "Find all components that use the Button component"
- "What files are connected to the database layer?"

Claude will automatically use graph data to provide more accurate and comprehensive results.

### Context-Aware Tool Selection

The graph system intelligently chooses the best tools:

- **Structural queries** → Graph search first
- **Related file exploration** → Targeted file reading
- **Broad searches** → Graph-guided grep
- **Architecture questions** → Graph analysis

### Real-Time Updates

With the daemon running:
- Graphs stay current as you edit code
- Claude always has fresh relationship data
- No manual rebuild needed
- Sub-100ms update times for small changes

## Performance Tips

### For Large Codebases

1. **Use language filters:**
   ```
   /cycles --language=javascript
   /find-related --depth=2 src/api/auth.js
   ```

2. **Limit result sets:**
   ```
   /hot-paths --limit=5
   /find-related --limit=10 src/utils/helpers.js
   ```

3. **Monitor daemon performance:**
   ```
   /dstatus
   ```

### Optimization

- Start daemon once per session: `/dstart`
- Use `/gupdate` only when needed
- Check `/graph-health` if performance degrades
- Restart daemon if memory usage high: `/dstop` then `/dstart`

## Troubleshooting

### Common Issues

**Graphs not updating:**
```
/graph-health
/gupdate --force
```

**Daemon not responding:**
```
/dstop --force
/dstart
```

**High memory usage:**
```
/dstatus
/dstop
/dstart
```

**Missing dependencies:**
```
/graph-health
# Then run: npm run doctor
```

### Debug Information

All commands provide detailed error messages and suggestions for resolution. Use `/graph-health` as your first diagnostic tool.

## Advanced Usage

### Custom Workflows

Create aliases or shortcuts for common command combinations:

```bash
# Quick health check
alias gcheck="/graph-health && /dstatus"

# Full refresh
alias grefresh="/dstop && /gupdate --force && /dstart"
```

### API Integration

These commands are also available programmatically:

```javascript
import { ClaudeCodeGraph } from 'claude-code-graph';

const ccg = new ClaudeCodeGraph('.');
const result = await ccg.executeGraphCommand('/graph-overview');
console.log(result.content);
```

## See Also

- [Daemon Documentation](./DAEMON.md) - Detailed daemon information
- [API Documentation](./API.md) - Programmatic usage
- [User Guide](./USER_GUIDE.md) - Complete usage guide