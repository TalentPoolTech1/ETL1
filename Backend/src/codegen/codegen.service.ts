import { engineRegistry } from './registry/engine.registry';
import { GeneratedArtifact, GenerationOptions, ValidationResult } from './core/interfaces/engine.interfaces';
import { PipelineDefinition, TechnologyType } from './core/types/pipeline.types';
import { PySparkEngine } from './engines/spark/pyspark/pyspark.engine';
import { ScalaSparkEngine } from './engines/spark/scala/scala-spark.engine';

// ─── CodegenService ───────────────────────────────────────────────────────────
// The single entry point for all code generation.
// Engines self-register here at module load time.

class CodegenService {
  private initialized = false;

  /** Call once at app startup. */
  initialize(): void {
    if (this.initialized) return;

    // Register all engines
    engineRegistry.register(new PySparkEngine());
    engineRegistry.register(new ScalaSparkEngine());
    // Future: engineRegistry.register(new SqlEngine());
    // Future: engineRegistry.register(new PandasEngine());

    this.initialized = true;
  }

  /**
   * Generate code artifacts for a pipeline.
   * Throws if technology engine not registered or validation fails.
   */
  async generate(
    pipeline: PipelineDefinition,
    options?: GenerationOptions
  ): Promise<GeneratedArtifact> {
    this.ensureInitialized();

    const technology = pipeline.environment?.technology;
    if (!technology) {
      throw new Error('pipeline.environment.technology must be specified');
    }

    const engine = engineRegistry.getOrFail(technology);
    return engine.generate(pipeline, options);
  }

  /**
   * Validate a pipeline definition without generating code.
   */
  validate(pipeline: PipelineDefinition): ValidationResult {
    this.ensureInitialized();

    const technology = pipeline.environment?.technology;
    if (!technology) {
      return {
        valid: false,
        errors: [{ code: 'NO_TECHNOLOGY', message: 'pipeline.environment.technology must be specified' }],
        warnings: [],
      };
    }

    const engine = engineRegistry.getOrFail(technology);
    return engine.validate(pipeline);
  }

  /**
   * List all registered technologies.
   */
  listTechnologies(): TechnologyType[] {
    this.ensureInitialized();
    return engineRegistry.list();
  }

  /**
   * Check if a technology is supported.
   */
  supports(technology: TechnologyType): boolean {
    this.ensureInitialized();
    return engineRegistry.has(technology);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }
}

// Singleton export
export const codegenService = new CodegenService();

// Re-export types for consumer convenience
export type { GeneratedArtifact, GenerationOptions, ValidationResult, PipelineDefinition };
