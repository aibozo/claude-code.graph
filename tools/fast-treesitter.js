#!/usr/bin/env node

/**
 * Fast Tree-sitter Parser - Optimized for large codebases
 * Uses shallow import-only queries for 10-20x speedup
 */

import { spawn } from 'child_process';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Query files for different languages
const QUERIES = {
  '.py': 'python.scm',
  '.js': 'javascript.scm', 
  '.ts': 'javascript.scm',
  '.jsx': 'javascript.scm',
  '.tsx': 'javascript.scm',
  '.c': 'cpp.scm',
  '.cpp': 'cpp.scm',
  '.cc': 'cpp.scm',
  '.cxx': 'cpp.scm',
  '.h': 'cpp.scm',
  '.hpp': 'cpp.scm'
};

// Language mappings for tree-sitter
const LANGUAGES = {
  '.py': 'python',
  '.js': 'javascript',
  '.ts': 'typescript', 
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp', 
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp'
};

class FastTreeSitter {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.queriesDir = join(__dirname, 'queries');
  }

  /**
   * Main public API for parsing all files in a directory
   */
  async parseAllFiles(files) {
    return this.parseFiles(files);
  }

  /**
   * Parse files with shallow import-only queries
   */
  async parseFiles(files, options = {}) {
    const { 
      maxFiles = 1000,  // Increased from 100
      batchSize = 50,   // Process in batches
      timeout = 300000  // 5 minute timeout
    } = options;

    console.error(`🌳 Fast parsing ${Math.min(files.length, maxFiles)} files...`);
    
    // Limit files but be much more generous
    const filesToProcess = files.slice(0, maxFiles);
    const nodes = [];
    const edges = [];
    
    // Group files by language for batch processing
    const filesByLang = this.groupFilesByLanguage(filesToProcess);
    
    for (const [lang, langFiles] of Object.entries(filesByLang)) {
      if (langFiles.length === 0) continue;
      
      console.error(`   Processing ${langFiles.length} ${lang} files...`);
      
      try {
        // Try tree-sitter first, fallback to regex parsing
        let result;
        try {
          result = await this.parseLanguageBatch(lang, langFiles, { timeout });
        } catch (tsError) {
          console.error(`   Tree-sitter unavailable for ${lang}, using regex fallback...`);
          result = await this.parseWithRegex(lang, langFiles);
        }
        
        nodes.push(...result.nodes);
        edges.push(...result.edges);
      } catch (error) {
        console.warn(`   Failed to parse ${lang} files:`, error.message);
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        tool: 'fast-treesitter',
        timestamp: new Date().toISOString(),
        files_processed: nodes.length,
        total_files: filesToProcess.length,
        languages: Object.keys(filesByLang),
        query_type: 'import-only'
      }
    };
  }

  /**
   * Group files by language for efficient batch processing
   */
  groupFilesByLanguage(files) {
    const groups = {};
    
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const lang = LANGUAGES[ext];
      
      if (lang) {
        if (!groups[lang]) groups[lang] = [];
        groups[lang].push(file);
      }
    }
    
    return groups;
  }

  /**
   * Parse a batch of files for a specific language
   */
  async parseLanguageBatch(language, files, options = {}) {
    const queryFile = this.getQueryFile(language);
    if (!queryFile) {
      throw new Error(`No query file found for language: ${language}`);
    }

    const nodes = [];
    const edges = [];

    // Try a small test batch first to see if tree-sitter works
    const testBatch = files.slice(0, Math.min(3, files.length));
    let treeSitterWorks = false;
    
    try {
      const testResult = await this.runTreeSitterQuery(language, testBatch, queryFile, options);
      treeSitterWorks = true;
      nodes.push(...testResult.nodes);
      edges.push(...testResult.edges);
    } catch (error) {
      console.error(`   Tree-sitter failed for ${language}: ${error.message}`);
      console.error(`   Using regex fallback for all ${files.length} files...`);
      return await this.parseWithRegex(language, files);
    }

    // If tree-sitter works, process remaining files
    if (treeSitterWorks && files.length > testBatch.length) {
      const remainingFiles = files.slice(testBatch.length);
      const batchSize = 20;
      
      for (let i = 0; i < remainingFiles.length; i += batchSize) {
        const batch = remainingFiles.slice(i, i + batchSize);
        
        try {
          const result = await this.runTreeSitterQuery(language, batch, queryFile, options);
          nodes.push(...result.nodes);
          edges.push(...result.edges);
        } catch (error) {
          console.warn(`   Batch ${i}-${i + batch.length} failed, using regex for this batch...`);
          const fallbackResult = await this.parseWithRegex(language, batch);
          nodes.push(...fallbackResult.nodes);
          edges.push(...fallbackResult.edges);
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Get the appropriate query file for a language
   */
  getQueryFile(language) {
    // Map language to query file
    const queryMap = {
      'python': 'python.scm',
      'javascript': 'javascript.scm',
      'typescript': 'javascript.scm',  // TS uses JS query
      'c': 'cpp.scm',
      'cpp': 'cpp.scm'
    };

    const queryFileName = queryMap[language];
    if (!queryFileName) return null;

    const queryPath = join(this.queriesDir, queryFileName);
    return existsSync(queryPath) ? queryPath : null;
  }

  /**
   * Run tree-sitter query on a batch of files
   */
  async runTreeSitterQuery(language, files, queryFile, options = {}) {
    const { timeout = 30000 } = options;

    return new Promise((resolve, reject) => {
      // Build tree-sitter command with shallow query
      // Note: tree-sitter CLI syntax varies by version
      const args = [
        'query',
        queryFile,
        '--captures',
        ...files
      ];

      console.error(`   Debug: Running tree-sitter ${args.join(' ')}`);

      const child = spawn('tree-sitter', args, {
        cwd: this.rootPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => stdout += data);
      child.stderr.on('data', (data) => stderr += data);

      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Tree-sitter query timeout after ${timeout}ms`));
      }, timeout);

      child.on('close', (code) => {
        clearTimeout(timer);
        
        if (code === 0) {
          try {
            const result = this.parseTreeSitterOutput(stdout, files);
            console.error(`   Debug: Parsed ${result.nodes.length} nodes, ${result.edges.length} edges`);
            resolve(result);
          } catch (error) {
            console.error(`   Debug: Parse output error: ${error.message}`);
            reject(new Error(`Failed to parse tree-sitter output: ${error.message}`));
          }
        } else {
          console.error(`   Debug: Tree-sitter failed with code ${code}`);
          console.error(`   Debug: stderr: ${stderr}`);
          console.error(`   Debug: stdout: ${stdout}`);
          reject(new Error(`Tree-sitter failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Parse tree-sitter capture output into nodes and edges
   */
  parseTreeSitterOutput(output, files) {
    const nodes = [];
    const edges = [];
    const lines = output.trim().split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // Parse tree-sitter capture format: file:line:col: @capture.name "value"
        const match = line.match(/^(.+?):(\d+):(\d+):\s*@(\S+)\s+"(.+)"$/);
        if (!match) continue;

        const [, file, line, col, captureName, value] = match;
        
        // Create node for the import/include
        const nodeId = `${file}:${line}:${col}`;
        nodes.push({
          id: nodeId,
          type: this.getCaptureType(captureName),
          file: file,
          line: parseInt(line),
          column: parseInt(col),
          name: value,
          capture: captureName
        });

        // Create edge for the dependency relationship
        if (captureName.includes('import') || captureName.includes('include')) {
          edges.push({
            from: file,
            to: value,
            type: 'dependency',
            source_line: parseInt(line),
            capture_type: captureName
          });
        }

      } catch (error) {
        console.warn(`Failed to parse line: ${line}`, error.message);
      }
    }

    return { nodes, edges };
  }

  /**
   * Get semantic type from capture name
   */
  getCaptureType(captureName) {
    if (captureName.includes('import')) return 'import';
    if (captureName.includes('include')) return 'include';
    if (captureName.includes('require')) return 'require';
    return 'dependency';
  }

  /**
   * Fallback regex-based parsing when tree-sitter is unavailable
   */
  async parseWithRegex(language, files) {
    const nodes = [];
    const edges = [];

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const result = this.extractImportsWithRegex(content, file, language);
        nodes.push(...result.nodes);
        edges.push(...result.edges);
      } catch (error) {
        console.warn(`   Failed to read ${file}:`, error.message);
      }
    }

    return { nodes, edges };
  }

  /**
   * Extract imports using language-specific regex patterns
   */
  extractImportsWithRegex(content, filePath, language) {
    const nodes = [];
    const edges = [];
    const lines = content.split('\n');

    lines.forEach((line, lineNum) => {
      const trimmed = line.trim();
      let matches = [];

      switch (language) {
        case 'python':
          // import module
          matches = trimmed.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/);
          if (matches) {
            this.addImportNode(nodes, edges, filePath, lineNum + 1, matches[1], 'import');
          }
          
          // from module import ...
          matches = trimmed.match(/^from\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s+import/);
          if (matches) {
            this.addImportNode(nodes, edges, filePath, lineNum + 1, matches[1], 'from_import');
          }
          break;

        case 'javascript':
        case 'typescript':
          // import ... from 'module'
          matches = trimmed.match(/import\s+.*\s+from\s+['"']([^'"]+)['"']/);
          if (matches) {
            this.addImportNode(nodes, edges, filePath, lineNum + 1, matches[1], 'es6_import');
          }
          
          // require('module')
          matches = trimmed.match(/require\s*\(\s*['"']([^'"]+)['"']\s*\)/);
          if (matches) {
            this.addImportNode(nodes, edges, filePath, lineNum + 1, matches[1], 'require');
          }
          break;

        case 'c':
        case 'cpp':
          // #include "header.h"
          matches = trimmed.match(/^#include\s*[<"]([^>"]+)[>"]/);
          if (matches) {
            this.addImportNode(nodes, edges, filePath, lineNum + 1, matches[1], 'include');
          }
          break;
      }
    });

    return { nodes, edges };
  }

  /**
   * Add an import node and edge
   */
  addImportNode(nodes, edges, filePath, lineNum, importTarget, importType) {
    const nodeId = `${filePath}:${lineNum}`;
    
    nodes.push({
      id: nodeId,
      type: importType,
      file: filePath,
      line: lineNum,
      name: importTarget,
      capture: `regex_${importType}`
    });

    edges.push({
      from: filePath,
      to: importTarget,
      type: 'dependency',
      source_line: lineNum,
      capture_type: `regex_${importType}`
    });
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, rootPath, ...files] = process.argv;
  
  if (!rootPath || files.length === 0) {
    console.error('Usage: fast-treesitter.js <rootPath> <file1> [file2] ...');
    process.exit(1);
  }

  const parser = new FastTreeSitter(rootPath);
  
  try {
    const result = await parser.parseFiles(files);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Parse failed:', error.message);
    process.exit(1);
  }
}

export { FastTreeSitter };