import { PipelineNode } from '../core/types/pipeline.types';

// ─── Topological Sort ─────────────────────────────────────────────────────────
// Returns nodes in execution order (sources first, sinks last).
// Assumes the graph has been validated (no cycles, no dangling refs).

export function topologicalSort(nodes: PipelineNode[]): PipelineNode[] {
  const nodeMap = new Map<string, PipelineNode>(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));

  // Build adjacency: for each node, which nodes depend on it (outgoing edges)
  const dependents = new Map<string, string[]>(nodes.map(n => [n.id, []]));

  nodes.forEach(n => {
    n.inputs.forEach(inputId => {
      // n depends on inputId → inputId has n as a dependent
      dependents.get(inputId)?.push(n.id);
      inDegree.set(n.id, (inDegree.get(n.id) ?? 0) + 1);
    });
  });

  // Kahn's algorithm
  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });

  const sorted: PipelineNode[] = [];
  while (queue.length > 0) {
    // Sort queue to get deterministic output (sources first by type)
    queue.sort((a, b) => {
      const na = nodeMap.get(a)!;
      const nb = nodeMap.get(b)!;
      const order: Record<string, number> = { source: 0, transformation: 1, sink: 2 };
      return (order[na.type] ?? 1) - (order[nb.type] ?? 1);
    });

    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    dependents.get(id)?.forEach(depId => {
      const newDegree = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) queue.push(depId);
    });
  }

  if (sorted.length !== nodes.length) {
    throw new Error('Cycle detected during topological sort — pipeline DAG is invalid.');
  }

  return sorted;
}

/**
 * Get all upstream dependencies of a node (transitive).
 */
export function getUpstreamNodes(nodeId: string, nodes: PipelineNode[]): string[] {
  const nodeMap = new Map<string, PipelineNode>(nodes.map(n => [n.id, n]));
  const visited = new Set<string>();

  const dfs = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    nodeMap.get(id)?.inputs.forEach(dfs);
  };

  nodeMap.get(nodeId)?.inputs.forEach(dfs);
  return [...visited];
}
