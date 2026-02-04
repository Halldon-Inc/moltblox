/**
 * Game Compiler
 *
 * Compiles TypeScript game code to WASM using AssemblyScript.
 * Validates that games implement the UnifiedGameInterface.
 */

import CryptoJS from 'crypto-js';
import type { CompilationResult, ValidationResult } from '../sandbox/WasmSandbox';

// =============================================================================
// Types
// =============================================================================

export interface CompilerConfig {
  /** Enable optimization */
  optimize: boolean;

  /** Generate source maps */
  sourceMap: boolean;

  /** Maximum allowed code size in bytes */
  maxCodeSize: number;

  /** Strict mode - fail on warnings */
  strict: boolean;
}

export interface StaticAnalysisResult {
  safe: boolean;
  issues: StaticAnalysisIssue[];
  metrics: CodeMetrics;
}

export interface StaticAnalysisIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  column?: number;
}

export interface CodeMetrics {
  lineCount: number;
  functionCount: number;
  classCount: number;
  complexity: number;
  estimatedMemory: number;
}

// =============================================================================
// Forbidden Patterns (Security)
// =============================================================================

const FORBIDDEN_PATTERNS = [
  // Network access attempts
  { pattern: /fetch\s*\(/g, message: 'Network access (fetch) is forbidden' },
  { pattern: /XMLHttpRequest/g, message: 'Network access (XMLHttpRequest) is forbidden' },
  { pattern: /WebSocket/g, message: 'WebSocket is forbidden' },

  // Eval and dynamic code
  { pattern: /eval\s*\(/g, message: 'eval() is forbidden' },
  { pattern: /new\s+Function\s*\(/g, message: 'new Function() is forbidden' },
  { pattern: /Function\s*\(\s*['"]/g, message: 'Function constructor is forbidden' },

  // File system
  { pattern: /require\s*\(\s*['"]fs['"]\s*\)/g, message: 'File system access is forbidden' },
  { pattern: /import\s+.*from\s+['"]fs['"]/g, message: 'File system access is forbidden' },

  // Process/child process
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/g, message: 'Child process is forbidden' },
  { pattern: /process\./g, message: 'Process access is forbidden' },

  // Timers that could cause non-determinism
  { pattern: /setTimeout\s*\(/g, message: 'setTimeout is forbidden - use tick()' },
  { pattern: /setInterval\s*\(/g, message: 'setInterval is forbidden - use tick()' },
  { pattern: /Date\.now\s*\(\s*\)/g, message: 'Date.now() is forbidden - use provided tick' },
  { pattern: /new\s+Date\s*\(/g, message: 'new Date() is forbidden - use provided tick' },

  // Random (must use deterministic version)
  { pattern: /Math\.random\s*\(\s*\)/g, message: 'Math.random() is forbidden - use provided random' },

  // Global mutations
  { pattern: /globalThis\s*\[/g, message: 'Global mutation is forbidden' },
  { pattern: /window\s*\[/g, message: 'Window access is forbidden' },
];

// =============================================================================
// Required Interface Methods
// =============================================================================

const REQUIRED_INTERFACE = {
  properties: [
    { name: 'gameType', type: 'string' },
    { name: 'maxPlayers', type: 'number' },
    { name: 'turnBased', type: 'boolean' },
    { name: 'tickRate', type: 'number' },
  ],
  methods: [
    { name: 'initialize', params: ['playerIds', 'seed?'] },
    { name: 'reset', params: [] },
    { name: 'destroy', params: [] },
    { name: 'getState', params: [] },
    { name: 'getStateForPlayer', params: ['playerId'] },
    { name: 'getValidActions', params: ['playerId'] },
    { name: 'validateAction', params: ['playerId', 'action'] },
    { name: 'applyAction', params: ['playerId', 'action'] },
    { name: 'tick', params: ['deltaTime'] },
    { name: 'isTerminal', params: [] },
    { name: 'getResult', params: [] },
    { name: 'serialize', params: [] },
    { name: 'deserialize', params: ['data'] },
  ],
};

// =============================================================================
// Game Compiler
// =============================================================================

export class GameCompiler {
  private config: CompilerConfig;

  constructor(config: Partial<CompilerConfig> = {}) {
    this.config = {
      optimize: true,
      sourceMap: false,
      maxCodeSize: 1024 * 1024, // 1MB
      strict: true,
      ...config,
    };
  }

  /**
   * Perform static analysis on game code
   */
  analyzeCode(code: string): StaticAnalysisResult {
    const issues: StaticAnalysisIssue[] = [];

    // Check code size
    if (code.length > this.config.maxCodeSize) {
      issues.push({
        severity: 'error',
        message: `Code exceeds maximum size (${code.length} > ${this.config.maxCodeSize})`,
      });
    }

    // Check for forbidden patterns
    for (const { pattern, message } of FORBIDDEN_PATTERNS) {
      const matches = code.match(pattern);
      if (matches) {
        issues.push({
          severity: 'error',
          message: `Security violation: ${message}`,
        });
      }
    }

    // Check for interface implementation
    const interfaceIssues = this.validateInterface(code);
    issues.push(...interfaceIssues);

    // Calculate metrics
    const metrics = this.calculateMetrics(code);

    // Check complexity
    if (metrics.complexity > 100) {
      issues.push({
        severity: 'warning',
        message: `High complexity score (${metrics.complexity}). Consider simplifying.`,
      });
    }

    return {
      safe: !issues.some((i) => i.severity === 'error'),
      issues,
      metrics,
    };
  }

  /**
   * Validate that code implements UnifiedGameInterface
   */
  private validateInterface(code: string): StaticAnalysisIssue[] {
    const issues: StaticAnalysisIssue[] = [];

    // Check for class extending BaseGame or implementing interface
    const hasBaseGame = /extends\s+BaseGame/.test(code);
    const hasInterface = /implements\s+UnifiedGameInterface/.test(code);

    if (!hasBaseGame && !hasInterface) {
      issues.push({
        severity: 'warning',
        message: 'Game should extend BaseGame or implement UnifiedGameInterface',
      });
    }

    // Check for required properties
    for (const prop of REQUIRED_INTERFACE.properties) {
      const propPattern = new RegExp(
        `(readonly\\s+)?${prop.name}\\s*(:|=)`,
        'g'
      );
      if (!propPattern.test(code)) {
        issues.push({
          severity: 'error',
          message: `Missing required property: ${prop.name} (${prop.type})`,
        });
      }
    }

    // Check for required methods
    for (const method of REQUIRED_INTERFACE.methods) {
      const methodPattern = new RegExp(
        `${method.name}\\s*\\(`,
        'g'
      );
      if (!methodPattern.test(code)) {
        issues.push({
          severity: 'error',
          message: `Missing required method: ${method.name}(${method.params.join(', ')})`,
        });
      }
    }

    return issues;
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(code: string): CodeMetrics {
    // Line count
    const lineCount = code.split('\n').length;

    // Function count (methods + standalone functions)
    const functionMatches = code.match(/(function\s+\w+|=>\s*{|\w+\s*\([^)]*\)\s*{)/g);
    const functionCount = functionMatches?.length || 0;

    // Class count
    const classMatches = code.match(/class\s+\w+/g);
    const classCount = classMatches?.length || 0;

    // Cyclomatic complexity estimate
    const ifCount = (code.match(/if\s*\(/g) || []).length;
    const forCount = (code.match(/for\s*\(/g) || []).length;
    const whileCount = (code.match(/while\s*\(/g) || []).length;
    const caseCount = (code.match(/case\s+/g) || []).length;
    const catchCount = (code.match(/catch\s*\(/g) || []).length;
    const ternaryCount = (code.match(/\?.*:/g) || []).length;
    const complexity = 1 + ifCount + forCount + whileCount + caseCount + catchCount + ternaryCount;

    // Estimated memory (rough heuristic)
    const estimatedMemory = code.length * 2 + functionCount * 1000;

    return {
      lineCount,
      functionCount,
      classCount,
      complexity,
      estimatedMemory,
    };
  }

  /**
   * Compile TypeScript game code to WASM
   *
   * Note: Full compilation requires AssemblyScript toolchain.
   * This method performs analysis and returns compilation metadata.
   */
  async compile(code: string): Promise<CompilationResult> {
    // First, run static analysis
    const analysis = this.analyzeCode(code);

    if (!analysis.safe) {
      return {
        success: false,
        errors: analysis.issues
          .filter((i) => i.severity === 'error')
          .map((i) => i.message),
      };
    }

    // In strict mode, warnings are also errors
    if (this.config.strict && analysis.issues.some((i) => i.severity === 'warning')) {
      return {
        success: false,
        errors: analysis.issues
          .filter((i) => i.severity === 'warning' || i.severity === 'error')
          .map((i) => i.message),
      };
    }

    try {
      // Generate a placeholder WASM module
      // In production, this would use AssemblyScript compiler
      const wasmBytes = await this.compileToWasm(code);
      const wasmHash = this.hashWasm(wasmBytes);

      return {
        success: true,
        wasmBytes,
        wasmHash,
        sourceMap: this.config.sourceMap ? this.generateSourceMap(code) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Compile TypeScript to WASM using AssemblyScript
   *
   * Note: This is a simplified placeholder. Real implementation would:
   * 1. Parse TypeScript AST
   * 2. Transform to AssemblyScript-compatible code
   * 3. Invoke AssemblyScript compiler
   * 4. Return optimized WASM bytecode
   */
  private async compileToWasm(code: string): Promise<Uint8Array> {
    // Placeholder: Generate minimal valid WASM module
    // Real implementation would use AssemblyScript
    const wasmModule = new Uint8Array([
      // WASM magic number
      0x00, 0x61, 0x73, 0x6d,
      // Version 1
      0x01, 0x00, 0x00, 0x00,
      // Type section (minimal)
      0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
      // Function section
      0x03, 0x02, 0x01, 0x00,
      // Export section with required functions
      0x07, 0x5e, 0x08,
      // initialize
      0x0a, 0x69, 0x6e, 0x69, 0x74, 0x69, 0x61, 0x6c, 0x69, 0x7a, 0x65, 0x00, 0x00,
      // getState
      0x08, 0x67, 0x65, 0x74, 0x53, 0x74, 0x61, 0x74, 0x65, 0x00, 0x00,
      // getStateForPlayer
      0x11, 0x67, 0x65, 0x74, 0x53, 0x74, 0x61, 0x74, 0x65, 0x46, 0x6f, 0x72, 0x50, 0x6c, 0x61, 0x79, 0x65, 0x72, 0x00, 0x00,
      // applyAction
      0x0b, 0x61, 0x70, 0x70, 0x6c, 0x79, 0x41, 0x63, 0x74, 0x69, 0x6f, 0x6e, 0x00, 0x00,
      // tick
      0x04, 0x74, 0x69, 0x63, 0x6b, 0x00, 0x00,
      // isTerminal
      0x0a, 0x69, 0x73, 0x54, 0x65, 0x72, 0x6d, 0x69, 0x6e, 0x61, 0x6c, 0x00, 0x00,
      // getResult
      0x09, 0x67, 0x65, 0x74, 0x52, 0x65, 0x73, 0x75, 0x6c, 0x74, 0x00, 0x00,
      // serialize
      0x09, 0x73, 0x65, 0x72, 0x69, 0x61, 0x6c, 0x69, 0x7a, 0x65, 0x00, 0x00,
      // Code section
      0x0a, 0x04, 0x01, 0x02, 0x00, 0x0b,
    ]);

    return wasmModule;
  }

  /**
   * Generate source map for debugging
   */
  private generateSourceMap(code: string): string {
    // Placeholder - would generate proper source map
    return JSON.stringify({
      version: 3,
      sources: ['game.ts'],
      names: [],
      mappings: '',
    });
  }

  /**
   * Hash WASM bytecode
   */
  private hashWasm(wasmBytes: Uint8Array): string {
    const wordArray = CryptoJS.lib.WordArray.create(wasmBytes as any);
    return CryptoJS.SHA256(wordArray).toString();
  }

  /**
   * Verify a WASM module matches its hash
   */
  verifyHash(wasmBytes: Uint8Array, expectedHash: string): boolean {
    const actualHash = this.hashWasm(wasmBytes);
    return actualHash === expectedHash;
  }
}

// =============================================================================
// Export
// =============================================================================

export default GameCompiler;
