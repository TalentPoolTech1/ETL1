import { ICodeEngine, IEngineRegistry } from '../core/interfaces/engine.interfaces';
import { TechnologyType } from '../core/types/pipeline.types';

// ─── Engine Registry ───────────────────────────────────────────────────────────
// Central registry for all technology code engines.
// Engines self-register at module load time.

class EngineRegistry implements IEngineRegistry {
  private readonly engines = new Map<TechnologyType, ICodeEngine>();

  register(engine: ICodeEngine): void {
    if (this.engines.has(engine.technology)) {
      throw new Error(`Engine already registered for technology: ${engine.technology}`);
    }
    this.engines.set(engine.technology, engine);
  }

  /** Silently overwrite — useful for testing or hot-reload. */
  registerOrReplace(engine: ICodeEngine): void {
    this.engines.set(engine.technology, engine);
  }

  get(technology: TechnologyType): ICodeEngine | undefined {
    return this.engines.get(technology);
  }

  getOrFail(technology: TechnologyType): ICodeEngine {
    const engine = this.engines.get(technology);
    if (!engine) {
      throw new Error(
        `No code engine registered for technology "${technology}". ` +
        `Available: [${[...this.engines.keys()].join(', ')}]`
      );
    }
    return engine;
  }

  list(): TechnologyType[] {
    return [...this.engines.keys()];
  }

  has(technology: TechnologyType): boolean {
    return this.engines.has(technology);
  }
}

// Singleton instance exported for the whole application
export const engineRegistry = new EngineRegistry();
