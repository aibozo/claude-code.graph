import { ClaudeCodeGraph } from '../../src/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testProjectRoot = path.join(__dirname, '../fixtures/test-project');

describe('Graph Integration Tests', () => {
  let claudeCodeGraph;
  
  beforeAll(async () => {
    // Create test project structure
    await setupTestProject();
    
    // Initialize ClaudeCodeGraph
    claudeCodeGraph = new ClaudeCodeGraph(testProjectRoot);
  });

  afterAll(async () => {
    // Clean up test project
    await cleanupTestProject();
  });

  describe('System Initialization', () => {
    test('should initialize graph system successfully', async () => {
      const initialized = await claudeCodeGraph.initialize();
      expect(initialized).toBe(true);
    });

    test('should report healthy status after initialization', async () => {
      const health = await claudeCodeGraph.checkGraphHealth();
      expect(health.healthy).toBe(true);
      expect(health.stats).toBeDefined();
      expect(health.issues).toHaveLength(0);
    });
  });

  describe('Graph Service Functionality', () => {
    test('should load and parse graph data', async () => {
      const stats = await claudeCodeGraph.graphTool.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalGraphs).toBeGreaterThan(0);
      expect(stats.totalNodes).toBeGreaterThan(0);
    });

    test('should find related files', async () => {
      const related = await claudeCodeGraph.findRelatedFiles('src/auth/login.js');
      
      expect(related).toBeInstanceOf(Array);
      // Should find at least auth-related files
      const authFiles = related.filter(r => r.path.includes('auth'));
      expect(authFiles.length).toBeGreaterThan(0);
    });

    test('should get architecture overview', async () => {
      const overview = await claudeCodeGraph.getArchitectureOverview();
      
      expect(overview).toBeDefined();
      expect(overview.modules).toBeDefined();
      expect(overview.metrics).toBeDefined();
    });
  });

  describe('Tool Selection Logic', () => {
    test('should prefer graph search for structural queries', async () => {
      const result = await claudeCodeGraph.handleQuery(
        'find all files related to authentication'
      );
      
      expect(result.enhanced).toBe(true);
      expect(result.strategy).toMatch(/graph/);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should use targeted search when graph shows manageable results', async () => {
      const result = await claudeCodeGraph.handleQuery(
        'show me login functions',
        { currentFile: 'src/auth/login.js' }
      );
      
      expect(result.enhanced).toBe(true);
      expect(['targeted_search', 'graph_guided']).toContain(result.strategy);
    });

    test('should fallback to traditional search when appropriate', async () => {
      const result = await claudeCodeGraph.handleQuery(
        'find todos in comments'
      );
      
      // This type of query should not use graph
      expect(result.tool).toBeDefined();
    });
  });

  describe('Graph Commands', () => {
    test('should execute /graph-overview command', async () => {
      const result = await claudeCodeGraph.executeGraphCommand('/graph-overview');
      
      expect(result.type).toBe('success');
      expect(result.content).toContain('Architecture Overview');
      expect(result.content).toContain('Project Metrics');
    });

    test('should execute /find-related command', async () => {
      const result = await claudeCodeGraph.executeGraphCommand(
        '/find-related', 
        ['src/auth/login.js']
      );
      
      expect(result.type).toBe('success');
      expect(result.content).toContain('Files Related to');
      expect(result.content).toContain('src/auth/login.js');
    });

    test('should execute /graph-stats command', async () => {
      const result = await claudeCodeGraph.executeGraphCommand('/graph-stats');
      
      expect(result.type).toBe('info');
      expect(result.content).toContain('Graph Statistics');
      expect(result.content).toContain('Total Graphs');
    });

    test('should execute /graph-health command', async () => {
      const result = await claudeCodeGraph.executeGraphCommand('/graph-health');
      
      expect(result.type).toBe('success');
      expect(result.content).toContain('Graph System Health');
      expect(result.content).toContain('✅ Healthy');
    });

    test('should handle invalid commands gracefully', async () => {
      const result = await claudeCodeGraph.executeGraphCommand('/invalid-command');
      
      expect(result.type).toBe('error');
      expect(result.content).toContain('Unknown command');
    });
  });

  describe('Search Context Enhancement', () => {
    test('should provide graph-enhanced search order', async () => {
      const result = await claudeCodeGraph.searchWithContext('handleLogin', {
        useGraph: true
      });
      
      expect(result.useGraph).toBe(true);
      expect(result.searchOrder).toBeInstanceOf(Array);
      // Should prioritize auth-related files
      const authFiles = result.searchOrder.filter(file => file.includes('auth'));
      expect(authFiles.length).toBeGreaterThan(0);
    });

    test('should work without graph when disabled', async () => {
      const result = await claudeCodeGraph.searchWithContext('handleLogin', {
        useGraph: false
      });
      
      expect(result.useGraph).toBe(false);
      expect(result.searchOrder).toHaveLength(0);
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle missing graph files gracefully', async () => {
      // Create instance with non-existent path
      const invalidGraph = new ClaudeCodeGraph('/non/existent/path');
      const initialized = await invalidGraph.initialize();
      
      expect(initialized).toBe(false);
      
      const health = await invalidGraph.checkGraphHealth();
      expect(health.healthy).toBe(false);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    test('should complete graph operations within reasonable time', async () => {
      const startTime = Date.now();
      
      await claudeCodeGraph.getArchitectureOverview();
      await claudeCodeGraph.findRelatedFiles('src/auth/login.js');
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});

// Test setup helpers

async function setupTestProject() {
  // Create test project directory structure
  await fs.mkdir(testProjectRoot, { recursive: true });
  await fs.mkdir(path.join(testProjectRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(testProjectRoot, 'src/auth'), { recursive: true });
  await fs.mkdir(path.join(testProjectRoot, 'src/utils'), { recursive: true });
  await fs.mkdir(path.join(testProjectRoot, '.graph'), { recursive: true });

  // Create sample source files
  await fs.writeFile(
    path.join(testProjectRoot, 'src/auth/login.js'),
    `
import { validateUser } from '../utils/validation.js';
import { hashPassword } from '../utils/crypto.js';

export class LoginService {
  async login(username, password) {
    if (!validateUser(username)) {
      throw new Error('Invalid user');
    }
    
    const hashed = await hashPassword(password);
    return this.authenticateUser(username, hashed);
  }
  
  authenticateUser(username, hashedPassword) {
    // Authentication logic
    return { success: true, user: username };
  }
}
`
  );

  await fs.writeFile(
    path.join(testProjectRoot, 'src/utils/validation.js'),
    `
export function validateUser(username) {
  return username && username.length > 2;
}

export function validateEmail(email) {
  return email.includes('@');
}
`
  );

  await fs.writeFile(
    path.join(testProjectRoot, 'src/utils/crypto.js'),
    `
export async function hashPassword(password) {
  // Mock hash function
  return 'hashed_' + password;
}

export function generateSalt() {
  return Math.random().toString(36);
}
`
  );

  // Create sample graph data
  const graphData = {
    nodes: [
      { id: 'login.js', type: 'module', file: 'src/auth/login.js' },
      { id: 'validation.js', type: 'module', file: 'src/utils/validation.js' },
      { id: 'crypto.js', type: 'module', file: 'src/utils/crypto.js' }
    ],
    edges: [
      { from: 'login.js', to: 'validation.js', type: 'imports' },
      { from: 'login.js', to: 'crypto.js', type: 'imports' }
    ],
    metadata: {
      tool: 'test',
      timestamp: new Date().toISOString()
    }
  };

  await fs.writeFile(
    path.join(testProjectRoot, '.graph/ts.json'),
    JSON.stringify(graphData, null, 2)
  );

  // Create JavaScript module graph (madge format)
  const jsGraph = {
    'src/auth/login.js': ['src/utils/validation.js', 'src/utils/crypto.js'],
    'src/utils/validation.js': [],
    'src/utils/crypto.js': []
  };

  await fs.writeFile(
    path.join(testProjectRoot, '.graph/js.json'),
    JSON.stringify(jsGraph, null, 2)
  );

  // Create Python graph (empty for this test)
  await fs.writeFile(
    path.join(testProjectRoot, '.graph/py.dot'),
    'digraph G { rankdir=LR; }'
  );

  // Create metrics
  const metrics = {
    timestamp: new Date().toISOString(),
    project: 'test-project',
    total_files: 3,
    by_language: {
      javascript: 3,
      python: 0
    },
    analyzers: {
      tree_sitter: true,
      madge: true,
      pyan3: false
    },
    graph_files: {
      ast: true,
      javascript: true,
      python: false
    }
  };

  await fs.writeFile(
    path.join(testProjectRoot, '.graph/metrics.json'),
    JSON.stringify(metrics, null, 2)
  );
}

async function cleanupTestProject() {
  try {
    await fs.rm(testProjectRoot, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}