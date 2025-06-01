# Graph Daemon (codegraphd)

The Graph Daemon (`codegraphd.py`) provides **real-time graph updates** by watching for file changes and incrementally updating graph data.

## Features

- 🔄 **Real-time Updates**: Watches source files and updates graphs automatically
- ⚡ **Incremental Processing**: Only processes changed files for fast updates  
- 🧠 **Smart Analysis**: Determines which analyzers to run based on file types
- 📊 **Performance Monitoring**: Tracks update times and error rates
- 🛡️ **Signal Handling**: Graceful shutdown and manual refresh via signals
- 📝 **Comprehensive Logging**: Detailed logs for debugging

## Quick Start

```bash
# Start the daemon
npm run graph:daemon:start

# Check status  
npm run status

# Stop the daemon
npm run graph:daemon:stop

# Restart the daemon
npm run graph:daemon:restart

# Trigger manual refresh
npm run graph:refresh
```

## Daemon Lifecycle

### Starting the Daemon

```bash
# Method 1: NPM script (recommended)
npm run graph:daemon

# Method 2: Direct execution
source .venv/bin/activate && python tools/codegraphd.py

# Method 3: Background process
nohup npm run graph:daemon > .graph/daemon.log 2>&1 &
```

### Checking Status

```bash
ccg status
# Shows:
# - Daemon running status (PID)
# - Update statistics
# - Graph metrics
# - Language breakdown
```

### Stopping the Daemon

```bash
# Graceful stop
npm run graph:daemon:stop

# Or send signal directly
pkill -TERM -f codegraphd

# Force stop if needed
pkill -KILL -f codegraphd
```

## How It Works

### 1. File Watching

The daemon monitors source files for changes:

```python
# Watched file patterns
patterns = ["*.py", "*.js", "*.ts", "*.jsx", "*.tsx", "*.c", "*.cpp", "*.h", "*.hpp"]

# Ignored patterns  
ignore_patterns = [
    "*/node_modules/*", "*/.git/*", "*/.venv/*", 
    "*/.graph/*", "*/dist/*", "*/build/*"
]
```

### 2. Change Detection

When files change, the daemon:

1. **Queues Changes**: Batches multiple changes together
2. **Delays Processing**: Waits 0.5s to catch rapid changes
3. **Determines Analyzers**: Chooses which tools to run based on file types
4. **Updates Incrementally**: Only processes affected parts of the graph

### 3. Incremental Updates

Based on changed file types:

| File Types | Analyzers Run |
|------------|---------------|
| `*.py` | Python call graph (pyan3) + Tree-sitter |
| `*.js, *.ts` | JavaScript modules (madge) + Tree-sitter |
| `*.c, *.cpp` | Tree-sitter (C++ analyzer planned) |

### 4. Performance Optimization

- **Batching**: Processes up to 10 files per batch
- **Concurrency**: Runs analyzers in parallel when possible
- **Caching**: Avoids redundant analysis
- **Memory Monitoring**: Tracks memory usage and warns on high usage

## Configuration

### Environment Variables

```bash
# Enable debug logging
DEBUG=1 npm run graph:daemon

# Custom update delay (seconds)
UPDATE_DELAY=1.0 python tools/codegraphd.py
```

### Performance Settings

In `tools/codegraphd.py`:

```python
# Batch processing
UPDATE_BATCH_SIZE = 10        # Files per batch
UPDATE_DELAY = 0.5           # Seconds to wait before processing
MAX_QUEUE_SIZE = 100         # Maximum queued changes

# Health monitoring  
MEMORY_THRESHOLD = 500       # MB memory warning threshold
HEALTH_CHECK_INTERVAL = 60   # Seconds between health checks
```

## Signal Handling

The daemon responds to UNIX signals:

| Signal | Action |
|--------|--------|
| `SIGTERM` | Graceful shutdown |
| `SIGINT` | Graceful shutdown (Ctrl+C) |
| `SIGUSR1` | Manual graph refresh |

### Manual Refresh

Trigger a full graph rebuild:

```bash
# Method 1: NPM script
npm run graph:refresh

# Method 2: Send signal directly  
pkill -USR1 -f codegraphd

# Method 3: Kill and restart
npm run graph:daemon:restart
```

## Monitoring & Debugging

### Log Files

```bash
# View real-time logs
tail -f .graph/daemon.log

# Check for errors
grep ERROR .graph/daemon.log

# View performance metrics
cat .graph/metrics.json | jq .daemon
```

### Performance Metrics

The daemon tracks:

- **Update Count**: Total number of graph updates
- **Error Count**: Failed update attempts
- **Average Time**: Mean update duration
- **Memory Usage**: Current memory consumption
- **Last Update**: Timestamp of most recent update

### Health Monitoring

Built-in health checks every minute:

- Memory usage monitoring
- Process health verification  
- Update frequency analysis
- Error rate tracking

## Troubleshooting

### Common Issues

**Daemon won't start:**
```bash
# Check Python dependencies
source .venv/bin/activate && python -c "import watchdog, networkx, psutil"

# Check virtual environment
ls -la .venv/bin/python

# Check permissions
ls -la tools/codegraphd.py
```

**High memory usage:**
```bash
# Check metrics
ccg status

# Restart daemon
npm run graph:daemon:restart

# Reduce batch size in codegraphd.py
```

**Updates not working:**
```bash
# Check if daemon is running
ccg status

# Check logs for errors
tail -f .graph/daemon.log

# Manual refresh
npm run graph:refresh
```

**Stale lock file:**
```bash
# Status command automatically cleans stale locks
ccg status

# Or manually remove
rm .graph/daemon.lock
```

### Debug Mode

Run with debug logging:

```bash
DEBUG=1 npm run graph:daemon
```

This shows:
- File change events
- Analyzer selection logic
- Update timing details
- Memory usage statistics

## Integration with Claude Code

The daemon integrates seamlessly with Claude Code:

### Hooks Configuration

In `.claude/code.yml`:

```yaml
hooks:
  post_apply:
    - "pkill -USR1 -f codegraphd"  # Refresh after edits

index:
  always_include:
    - ".graph/metrics.json"        # Include latest metrics
```

### Real-time Benefits

1. **Always Fresh**: Graphs reflect latest code changes
2. **Fast Updates**: Incremental processing keeps updates under 100ms
3. **No Manual Work**: Automatic updates as you code
4. **Context Aware**: Claude always has current graph data

## Advanced Usage

### Custom Analyzers

Extend the daemon with custom analyzers:

```python
async def run_analyzer(self, analyzer: str, changed_files: Set[Path]):
    if analyzer == 'custom':
        await self.update_custom_graph(changed_files)
    # ... existing analyzers
```

### Integration Testing

Test daemon functionality:

```bash
# Start daemon in background
npm run graph:daemon &
DAEMON_PID=$!

# Make a test change
echo "# Test change" >> src/test.py

# Wait for update
sleep 2

# Check if graph was updated
ls -la .graph/

# Clean up
kill $DAEMON_PID
```

### Production Deployment

For production environments:

```bash
# Use process manager (systemd, pm2, etc.)
pm2 start npm --name "codegraphd" -- run graph:daemon

# Or systemd service
sudo systemctl start codegraphd
```

## Performance Characteristics

### Typical Performance

- **Cold Start**: 2-5 seconds to initialize
- **File Change Detection**: < 50ms
- **Small Updates**: 100-500ms (1-5 files)
- **Large Updates**: 1-5s (10+ files)
- **Memory Usage**: 50-100MB typical

### Scaling Guidelines

| Repository Size | Expected Performance |
|----------------|---------------------|
| < 1k files | Updates < 100ms |
| 1k-10k files | Updates < 500ms |
| 10k-50k files | Updates < 2s |
| > 50k files | Consider batch limits |

The daemon is optimized for repositories up to 50k files with excellent performance.