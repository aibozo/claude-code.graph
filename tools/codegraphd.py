#!/usr/bin/env python3
"""
CodeGraphD - Live graph update daemon for claude-code-graph
Watches for file changes and incrementally updates graph data
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
from pathlib import Path
from typing import Dict, Set, List
import subprocess
import tempfile
from datetime import datetime

# Use virtual environment if available
if os.path.exists('.venv/bin/activate'):
    # We're in a virtual environment context
    import watchdog
    import networkx as nx
    import psutil
    import aiofiles
else:
    # Fallback to system packages
    try:
        import watchdog
        import networkx as nx
        import psutil
        import aiofiles
    except ImportError as e:
        print(f"❌ Missing Python dependencies: {e}")
        print("💡 Run: source .venv/bin/activate && python tools/codegraphd.py")
        sys.exit(1)

from watchdog.observers import Observer
from watchdog.events import PatternMatchingEventHandler

# Configuration
GRAPH_DIR = Path(".graph")
REPO_ROOT = Path.cwd()
LOCK_FILE = GRAPH_DIR / "daemon.lock"
LOG_FILE = GRAPH_DIR / "daemon.log"
METRICS_FILE = GRAPH_DIR / "metrics.json"

# Performance settings
UPDATE_BATCH_SIZE = 10
UPDATE_DELAY = 0.5  # seconds to wait before processing changes
MAX_QUEUE_SIZE = 100

class GraphBuilder:
    """Handles incremental graph building and updates"""
    
    def __init__(self, root_path: Path):
        self.root = root_path
        self.graph_dir = root_path / ".graph"
        self.metrics = {
            "updates": 0,
            "errors": 0,
            "avg_time": 0,
            "last_update": None,
            "daemon_start": datetime.now().isoformat()
        }
        self.cache = {}
        
        # Ensure graph directory exists
        self.graph_dir.mkdir(exist_ok=True)
        
    async def rebuild_incremental(self, changed_files: Set[Path]):
        """Incrementally rebuild only affected parts of the graph"""
        start_time = time.time()
        
        try:
            # Determine which analyzers need to run
            analyzers = self.get_affected_analyzers(changed_files)
            
            logging.info(f"Processing {len(changed_files)} changed files with {len(analyzers)} analyzers")
            
            # Run analyzers for changed files
            tasks = []
            for analyzer in analyzers:
                task = self.run_analyzer(analyzer, changed_files)
                tasks.append(task)
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
            
            # Update metrics
            duration = time.time() - start_time
            await self.update_metrics(duration, success=True)
            
            logging.info(f"Graph update completed in {duration:.2f}s")
            
        except Exception as e:
            duration = time.time() - start_time
            logging.error(f"Graph rebuild failed: {e}")
            await self.update_metrics(duration, success=False)
            raise
            
    def get_affected_analyzers(self, files: Set[Path]) -> List[str]:
        """Determine which analyzers need to run based on changed files"""
        analyzers = []
        extensions = set(f.suffix.lower() for f in files)
        
        if any(ext in ['.py'] for ext in extensions):
            analyzers.append('python')
        if any(ext in ['.js', '.ts', '.jsx', '.tsx', '.mjs'] for ext in extensions):
            analyzers.append('javascript')
        if any(ext in ['.c', '.cpp', '.h', '.hpp', '.cc', '.cxx'] for ext in extensions):
            analyzers.append('cpp')
            
        # Always update tree-sitter for any source file changes
        if any(ext in ['.py', '.js', '.ts', '.jsx', '.tsx', '.c', '.cpp', '.h', '.hpp'] for ext in extensions):
            analyzers.append('tree_sitter')
            
        return list(set(analyzers))  # Remove duplicates
    
    async def run_analyzer(self, analyzer: str, changed_files: Set[Path]):
        """Run a specific analyzer on changed files"""
        try:
            if analyzer == 'python':
                await self.update_python_graph(changed_files)
            elif analyzer == 'javascript':
                await self.update_javascript_graph(changed_files)
            elif analyzer == 'cpp':
                await self.update_cpp_graph(changed_files)
            elif analyzer == 'tree_sitter':
                await self.update_tree_sitter_graph(changed_files)
        except Exception as e:
            logging.error(f"Analyzer {analyzer} failed: {e}")
            raise
    
    async def update_python_graph(self, changed_files: Set[Path]):
        """Update Python call graph incrementally"""
        python_files = [f for f in changed_files if f.suffix == '.py']
        if not python_files:
            return
            
        logging.debug(f"Updating Python graph for {len(python_files)} files")
        
        # Use virtual environment if available
        python_cmd = "python"
        env = os.environ.copy()
        if os.path.exists('.venv/bin/activate'):
            python_cmd = ".venv/bin/python"
        
        try:
            # Run pyan3 on changed files plus their dependencies
            all_py_files = await self.get_related_python_files(python_files)
            file_list = ' '.join(f'"{f}"' for f in all_py_files)
            
            cmd = f'{python_cmd} -m pyan {file_list} --dot --colored --grouped'
            
            result = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.root
            )
            
            stdout, stderr = await result.communicate()
            
            if result.returncode == 0:
                # Write updated graph
                async with aiofiles.open(self.graph_dir / "py.dot", "w") as f:
                    await f.write(stdout.decode())
                logging.debug("Python graph updated successfully")
            else:
                logging.warning(f"Python graph update failed: {stderr.decode()}")
                
        except Exception as e:
            logging.error(f"Python graph update error: {e}")
    
    async def update_javascript_graph(self, changed_files: Set[Path]):
        """Update JavaScript/TypeScript module graph incrementally"""
        js_files = [f for f in changed_files 
                   if f.suffix in ['.js', '.ts', '.jsx', '.tsx', '.mjs']]
        if not js_files:
            return
            
        logging.debug(f"Updating JavaScript graph for {len(js_files)} files")
        
        try:
            # Find entry points or use src directory
            entry_points = self.find_js_entry_points()
            if entry_points:
                entry_point = entry_points[0]
            else:
                entry_point = "src"
            
            cmd = f'madge "{entry_point}" --format json'
            
            result = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.root
            )
            
            stdout, stderr = await result.communicate()
            
            if result.returncode == 0:
                # Write updated graph
                async with aiofiles.open(self.graph_dir / "js.json", "w") as f:
                    await f.write(stdout.decode())
                logging.debug("JavaScript graph updated successfully")
            else:
                logging.warning(f"JavaScript graph update failed: {stderr.decode()}")
                
        except Exception as e:
            logging.error(f"JavaScript graph update error: {e}")
    
    async def update_cpp_graph(self, changed_files: Set[Path]):
        """Update C++ graph (placeholder for clangd integration)"""
        cpp_files = [f for f in changed_files 
                    if f.suffix in ['.c', '.cpp', '.h', '.hpp', '.cc', '.cxx']]
        if not cpp_files:
            return
            
        logging.debug(f"C++ graph update requested for {len(cpp_files)} files (not implemented)")
        # TODO: Implement clangd integration
    
    async def update_tree_sitter_graph(self, changed_files: Set[Path]):
        """Update tree-sitter AST graph"""
        logging.debug(f"Updating tree-sitter graph for {len(changed_files)} files")
        
        try:
            # For now, use a simple file list approach
            # TODO: Implement proper tree-sitter incremental parsing
            file_data = {
                "nodes": [],
                "edges": [], 
                "metadata": {
                    "tool": "codegraphd",
                    "timestamp": datetime.now().isoformat(),
                    "files": [str(f) for f in changed_files]
                }
            }
            
            async with aiofiles.open(self.graph_dir / "ts.json", "w") as f:
                await f.write(json.dumps(file_data, indent=2))
                
            logging.debug("Tree-sitter graph updated")
            
        except Exception as e:
            logging.error(f"Tree-sitter graph update error: {e}")
    
    async def get_related_python_files(self, changed_files: List[Path]) -> List[Path]:
        """Get Python files related to changed files through imports"""
        # For now, just return the changed files
        # TODO: Implement proper dependency analysis
        return changed_files
    
    def find_js_entry_points(self) -> List[str]:
        """Find JavaScript entry points"""
        candidates = [
            "src/index.js", "src/index.ts", "index.js", "index.ts",
            "src/main.js", "src/main.ts", "main.js", "main.ts"
        ]
        
        return [candidate for candidate in candidates 
                if (self.root / candidate).exists()]
    
    async def update_metrics(self, duration: float, success: bool):
        """Update performance metrics"""
        self.metrics["updates"] += 1
        if not success:
            self.metrics["errors"] += 1
        
        # Update average time (rolling average)
        if self.metrics["avg_time"] == 0:
            self.metrics["avg_time"] = duration
        else:
            self.metrics["avg_time"] = (self.metrics["avg_time"] * 0.8) + (duration * 0.2)
        
        self.metrics["last_update"] = datetime.now().isoformat()
        
        # Write metrics to file
        try:
            async with aiofiles.open(METRICS_FILE, "w") as f:
                # Read existing metrics if available
                existing_metrics = {}
                if METRICS_FILE.exists():
                    try:
                        with open(METRICS_FILE, "r") as rf:
                            existing_metrics = json.load(rf)
                    except:
                        pass
                
                # Merge daemon metrics with existing metrics
                existing_metrics["daemon"] = self.metrics
                await f.write(json.dumps(existing_metrics, indent=2))
        except Exception as e:
            logging.error(f"Failed to update metrics: {e}")


class FileChangeHandler(PatternMatchingEventHandler):
    """Handles file system events and queues graph updates"""
    
    def __init__(self, graph_builder: GraphBuilder):
        # Watch source code files
        patterns = ["*.py", "*.js", "*.ts", "*.jsx", "*.tsx", "*.c", "*.cpp", "*.h", "*.hpp"]
        ignore_patterns = [
            "*/node_modules/*", "*/.git/*", "*/.venv/*", "*/.graph/*", 
            "*/dist/*", "*/build/*", "*/__pycache__/*", "*.pyc"
        ]
        
        super().__init__(patterns=patterns, ignore_patterns=ignore_patterns)
        
        self.graph_builder = graph_builder
        self.pending_changes: Set[Path] = set()
        self.update_task = None
        self.lock = asyncio.Lock()
        
    def on_modified(self, event):
        if not event.is_directory:
            asyncio.create_task(self.queue_update(Path(event.src_path)))
    
    def on_created(self, event):
        if not event.is_directory:
            asyncio.create_task(self.queue_update(Path(event.src_path)))
    
    def on_deleted(self, event):
        if not event.is_directory:
            asyncio.create_task(self.queue_update(Path(event.src_path)))
    
    async def queue_update(self, file_path: Path):
        """Queue a file for graph update"""
        async with self.lock:
            self.pending_changes.add(file_path)
            
            # Cancel existing update task
            if self.update_task and not self.update_task.done():
                self.update_task.cancel()
            
            # Schedule new update with delay
            self.update_task = asyncio.create_task(self.process_updates())
    
    async def process_updates(self):
        """Process queued updates after a delay"""
        await asyncio.sleep(UPDATE_DELAY)
        
        async with self.lock:
            if not self.pending_changes:
                return
            
            changes = self.pending_changes.copy()
            self.pending_changes.clear()
            
            if len(changes) > MAX_QUEUE_SIZE:
                logging.warning(f"Too many changes ({len(changes)}), processing latest {MAX_QUEUE_SIZE}")
                changes = set(list(changes)[-MAX_QUEUE_SIZE:])
        
        try:
            await self.graph_builder.rebuild_incremental(changes)
            logging.info(f"Processed {len(changes)} file changes")
        except Exception as e:
            logging.error(f"Failed to process updates: {e}")


class CodeGraphDaemon:
    """Main daemon class for managing graph updates"""
    
    def __init__(self):
        self.observer = None
        self.graph_builder = GraphBuilder(REPO_ROOT)
        self.handler = FileChangeHandler(self.graph_builder)
        self.running = False
        self.pid = os.getpid()
        
        # Setup logging
        self.setup_logging()
        
    def setup_logging(self):
        """Setup logging configuration"""
        log_level = logging.DEBUG if os.getenv('DEBUG') else logging.INFO
        
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(LOG_FILE),
                logging.StreamHandler()
            ]
        )
        
        logging.info(f"CodeGraphD starting (PID: {self.pid})")
    
    async def start(self):
        """Start the daemon"""
        try:
            # Check for existing daemon
            if self.is_daemon_running():
                logging.error("Daemon already running")
                return False
            
            # Create lock file
            self.create_lock_file()
            
            # Setup signal handlers
            self.setup_signal_handlers()
            
            # Start file observer
            self.observer = Observer()
            self.observer.schedule(self.handler, str(REPO_ROOT), recursive=True)
            self.observer.start()
            
            self.running = True
            logging.info(f"CodeGraphD started, watching {REPO_ROOT}")
            
            # Main loop
            await self.main_loop()
            
        except Exception as e:
            logging.error(f"Daemon startup failed: {e}")
            return False
        finally:
            await self.cleanup()
        
        return True
    
    async def main_loop(self):
        """Main daemon loop"""
        try:
            while self.running:
                await asyncio.sleep(1)
                
                # Periodic health check
                if hasattr(self, '_last_health_check'):
                    if time.time() - self._last_health_check > 60:  # Every minute
                        await self.health_check()
                else:
                    await self.health_check()
                    
        except asyncio.CancelledError:
            logging.info("Main loop cancelled")
        except Exception as e:
            logging.error(f"Main loop error: {e}")
    
    async def health_check(self):
        """Perform periodic health check"""
        self._last_health_check = time.time()
        
        # Check memory usage
        process = psutil.Process()
        memory_mb = process.memory_info().rss / 1024 / 1024
        
        if memory_mb > 500:  # 500MB threshold
            logging.warning(f"High memory usage: {memory_mb:.1f}MB")
        
        logging.debug(f"Health check: Memory {memory_mb:.1f}MB, Updates: {self.graph_builder.metrics['updates']}")
    
    def setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            logging.info(f"Received signal {signum}, shutting down...")
            self.running = False
        
        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)
        
        # USR1 for manual graph refresh
        def refresh_handler(signum, frame):
            logging.info("Received USR1, triggering manual refresh")
            asyncio.create_task(self.manual_refresh())
        
        signal.signal(signal.SIGUSR1, refresh_handler)
    
    async def manual_refresh(self):
        """Manually refresh all graphs"""
        try:
            # Run the full graph builder script
            cmd = "./tools/codegraph.sh"
            result = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=REPO_ROOT
            )
            
            stdout, stderr = await result.communicate()
            
            if result.returncode == 0:
                logging.info("Manual graph refresh completed")
            else:
                logging.error(f"Manual refresh failed: {stderr.decode()}")
                
        except Exception as e:
            logging.error(f"Manual refresh error: {e}")
    
    def is_daemon_running(self) -> bool:
        """Check if daemon is already running"""
        if not LOCK_FILE.exists():
            return False
        
        try:
            with open(LOCK_FILE, 'r') as f:
                pid = int(f.read().strip())
            
            # Check if process with this PID exists
            return psutil.pid_exists(pid)
            
        except (ValueError, FileNotFoundError):
            # Invalid lock file
            LOCK_FILE.unlink(missing_ok=True)
            return False
    
    def create_lock_file(self):
        """Create daemon lock file"""
        with open(LOCK_FILE, 'w') as f:
            f.write(str(self.pid))
    
    async def cleanup(self):
        """Cleanup resources"""
        logging.info("Cleaning up daemon...")
        
        if self.observer:
            self.observer.stop()
            self.observer.join()
        
        # Remove lock file
        LOCK_FILE.unlink(missing_ok=True)
        
        logging.info("Daemon stopped")


async def main():
    """Main entry point"""
    daemon = CodeGraphDaemon()
    success = await daemon.start()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nDaemon interrupted")
        sys.exit(0)
    except Exception as e:
        print(f"Daemon failed: {e}")
        sys.exit(1)