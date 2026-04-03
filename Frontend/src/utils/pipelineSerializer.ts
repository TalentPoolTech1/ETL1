/**
 * Converts the frontend Redux pipeline state into the backend PipelineDefinition
 * format consumed by the code generation engine.
 *
 * Frontend Node types map to backend PipelineNode as follows:
 *   source  → type: 'source',         sourceType from node.config.sourceType
 *   transform → type: 'transformation', transformationType: 'multi_transform_sequence'
 *             (falls back to 'filter' with node.config.expression if no sequences)
 *   target  → type: 'sink',            sinkType from node.config.sinkType
 *   join    → type: 'transformation',  transformationType: 'join'
 *   aggregate → type: 'transformation', transformationType: 'aggregate'
 *   filter  → type: 'transformation',  transformationType: 'filter'
 *   custom  → type: 'transformation',  transformationType: 'custom_sql'
 */

type BackendNode = {
  id: string;
  name: string;
  type: 'source' | 'transformation' | 'sink';
  sourceType?: string;
  sinkType?: string;
  transformationType?: string;
  config: Record<string, any>;
  inputs: string[];
};

type PipelineDefinition = {
  id: string;
  name: string;
  version: string;
  description?: string;
  environment: {
    technology: 'pyspark' | 'scala-spark';
    sparkVersion: string;
  };
  sparkConfig: {
    appName: string;
  };
  nodes: BackendNode[];
};

interface FrontendNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, any>;
}

interface FrontendEdge {
  id: string;
  source: string;
  target: string;
}

interface SerializeOptions {
  sparkVersion?: string;
  technology?: 'pyspark' | 'scala-spark';
}

function normalizeFilterCondition(raw: unknown): string {
  if (typeof raw !== 'string') return 'true';
  const normalized = raw
    .replace(/^\s*where\b/i, '')
    .replace(/;+\s*$/, '')
    .trim();
  return normalized || 'true';
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function serializePipelineToDefinition(
  pipeline: { id: string; name: string; description?: string; version?: number },
  nodes: Record<string, FrontendNode>,
  edges: Record<string, FrontendEdge>,
  options: SerializeOptions = {}
): PipelineDefinition {
  // Build target-id → [source-id, ...] input map from edges
  const inputsMap: Record<string, string[]> = {};
  Object.values(edges).forEach(e => {
    if (!inputsMap[e.target]) inputsMap[e.target] = [];
    inputsMap[e.target]!.push(e.source);
  });

  const backendNodes: BackendNode[] = Object.values(nodes).map(n =>
    serializeNode(n, inputsMap[n.id] ?? [])
  );

  return {
    id: pipeline.id,
    name: pipeline.name,
    version: String(pipeline.version ?? 1),
    description: pipeline.description,
    environment: {
      technology: options.technology ?? 'pyspark',
      sparkVersion: (options.sparkVersion ?? '3.5') as any,
    },
    sparkConfig: {
      appName: pipeline.name,
    },
    nodes: backendNodes,
  };
}

function serializeNode(node: FrontendNode, inputs: string[]): BackendNode {
  const cfg = node.config;
  const normalizedTransformSequences = (() => {
    const raw = cfg.transformSequences;
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  switch (node.type) {
    case 'source':
      return {
        id: node.id,
        name: node.name,
        type: 'source',
        sourceType: firstNonEmptyString(
          cfg.sourceType,
          cfg.filePath ? 'file' : undefined,
          cfg.bootstrapServers ? 'kafka' : undefined,
          'jdbc',
        )!,
        config: cfg,
        inputs: [],
      };

    case 'transform': {
      const hasSequences = normalizedTransformSequences.length > 0;
      if (hasSequences) {
        return {
          id: node.id,
          name: node.name,
          type: 'transformation',
          transformationType: 'multi_transform_sequence',
          config: {
            transformSequences: normalizedTransformSequences,
            executionStrategy: cfg.executionStrategy,
            cacheResults: cfg.cacheResults ?? false,
          },
          inputs,
        };
      }
      // Fallback: bare expression → filter node
      return {
        id: node.id,
        name: node.name,
        type: 'transformation',
        transformationType: 'filter',
        config: {
          condition: normalizeFilterCondition(cfg.expression),
          mode: cfg.filterMode === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE',
          conditionLanguage: 'spark_sql',
        },
        inputs,
      };
    }

    case 'filter':
      return {
        id: node.id,
        name: node.name,
        type: 'transformation',
        transformationType: 'filter',
        config: {
          condition: normalizeFilterCondition(cfg.expression),
          mode: cfg.filterMode === 'EXCLUDE' ? 'EXCLUDE' : 'INCLUDE',
          conditionLanguage: 'spark_sql',
        },
        inputs,
      };

    case 'join':
      return {
        id: node.id,
        name: node.name,
        type: 'transformation',
        transformationType: 'join',
        config: {
          rightInput: cfg.rightInput ?? inputs[1] ?? '',
          type: cfg.joinType ?? 'inner',
          conditions: cfg.joinConditions ?? [],
        },
        inputs,
      };

    case 'aggregate':
      return {
        id: node.id,
        name: node.name,
        type: 'transformation',
        transformationType: 'aggregate',
        config: {
          groupBy: cfg.groupBy ?? [],
          aggregations: cfg.aggregations ?? [],
        },
        inputs,
      };

    case 'target':
      return {
        id: node.id,
        name: node.name,
        type: 'sink',
        sinkType: firstNonEmptyString(cfg.sinkType, 'file')!,
        config: cfg,
        inputs,
      };

    case 'custom':
    default:
      return {
        id: node.id,
        name: node.name,
        type: 'transformation',
        transformationType: 'custom_sql',
        config: { sql: cfg.sql ?? `-- ${node.name}` },
        inputs,
      };
  }
}
