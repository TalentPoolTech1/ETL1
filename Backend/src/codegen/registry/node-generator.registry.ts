import { INodeGenerator, INodeGeneratorRegistry } from '../core/interfaces/engine.interfaces';
import { PipelineNode } from '../core/types/pipeline.types';

// ─── Node Generator Registry ───────────────────────────────────────────────────
// Each engine has its own instance of this registry (injected per-technology).

export class NodeGeneratorRegistry implements INodeGeneratorRegistry {
  private readonly generators = new Map<string, INodeGenerator>();

  /** key = nodeType:subType  e.g. "source:jdbc" | "transformation:filter" */
  private static key(nodeType: string, subType: string): string {
    return `${nodeType}:${subType}`;
  }

  register(generator: INodeGenerator): void {
    const k = NodeGeneratorRegistry.key(generator.nodeType, generator.subType);
    this.generators.set(k, generator);
  }

  registerMany(generators: INodeGenerator[]): void {
    generators.forEach(g => this.register(g));
  }

  getFor(node: PipelineNode): INodeGenerator | undefined {
    const subType = node.sourceType ?? node.transformationType ?? node.sinkType ?? '';
    const k = NodeGeneratorRegistry.key(node.type, subType);
    return this.generators.get(k);
  }

  getOrFail(node: PipelineNode): INodeGenerator {
    const gen = this.getFor(node);
    if (!gen) {
      const subType = node.sourceType ?? node.transformationType ?? node.sinkType ?? 'unknown';
      throw new Error(
        `No generator registered for node type "${node.type}:${subType}" ` +
        `(node id: ${node.id}, name: "${node.name}")`
      );
    }
    return gen;
  }

  listAll(): INodeGenerator[] {
    return [...this.generators.values()];
  }

  has(nodeType: string, subType: string): boolean {
    return this.generators.has(NodeGeneratorRegistry.key(nodeType, subType));
  }
}
