/**
 * Node Factory
 * 
 * Factory functions for creating different types of pipeline nodes with
 * automatic positioning, validation setup, and sensible defaults.
 */

import { v4 as uuid } from 'uuid';
import { Node } from '@/types';

export interface NodeFactoryOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Creates a source node for reading data
 */
export function createSourceNode(
  connectorId: string,
  schema: string,
  table: string,
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name: `${table} (${connectorId})`,
    type: 'source',
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      connectionId: connectorId,
      schema,
      table,
      selectAll: true,
    },
    isDragging: false,
  };
}

/**
 * Creates a transform/filter node for data processing
 */
export function createTransformNode(
  name: string = 'Transform',
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name,
    type: 'transform',
    x: opts.x ?? 400,
    y: opts.y ?? 100,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      expression: '',
      columnMappings: [],
      cacheResults: false,
    },
    isDragging: false,
  };
}

/**
 * Creates an aggregation node for GROUP BY operations
 */
export function createAggregationNode(
  groupByColumns: string[] = [],
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name: 'Aggregation',
    type: 'aggregation',
    x: opts.x ?? 400,
    y: opts.y ?? 200,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      groupByColumns,
      aggregations: [],
    },
    isDragging: false,
  };
}

/**
 * Creates a join node
 */
export function createJoinNode(
  leftTable: string = '',
  rightTable: string = '',
  joinType: string = 'INNER',
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name: `${joinType} Join`,
    type: 'join',
    x: opts.x ?? 400,
    y: opts.y ?? 300,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      leftTable,
      rightTable,
      joinType,
      joinCondition: '',
      isMultipleInputsAllowed: true,
    },
    isDragging: false,
  };
}

/**
 * Creates a target/sink node for writing data
 */
export function createTargetNode(
  connectorId: string,
  table: string,
  writeMode: string = 'OVERWRITE',
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name: `Write to ${table}`,
    type: 'target',
    x: opts.x ?? 700,
    y: opts.y ?? 100,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      connectionId: connectorId,
      table,
      writeMode,
      partitionColumns: [],
      bucketColumns: [],
    },
    isDragging: false,
  };
}

/**
 * Creates a union node (combine multiple datasets)
 */
export function createUnionNode(
  unionType: string = 'UNION',
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name: 'Union',
    type: 'union',
    x: opts.x ?? 400,
    y: opts.y ?? 400,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      unionType, // UNION, UNION ALL, INTERSECT, EXCEPT
      isMultipleInputsAllowed: true,
    },
    isDragging: false,
  };
}

/**
 * Creates a custom SQL node for raw SQL execution
 */
export function createCustomSQLNode(
  sql: string = '',
  opts: NodeFactoryOptions = {}
): Node {
  return {
    id: uuid(),
    name: 'Custom SQL',
    type: 'custom_sql',
    x: opts.x ?? 400,
    y: opts.y ?? 500,
    width: opts.width ?? 180,
    height: opts.height ?? 60,
    version: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inputs: [],
    outputs: [],
    config: {
      sql,
      readOnly: false,
    },
    isDragging: false,
  };
}

/**
 * Gets suggested next node type based on current node type
 */
export function getNextNodeType(currentType: string): string[] {
  const nextMap: Record<string, string[]> = {
    source: ['transform', 'aggregation', 'join', 'target'],
    transform: ['aggregation', 'join', 'target', 'union'],
    aggregation: ['transform', 'target', 'union'],
    join: ['transform', 'aggregation', 'target', 'union'],
    target: [],
    union: ['transform', 'aggregation', 'join', 'target'],
    custom_sql: ['transform', 'aggregation', 'join', 'target', 'union'],
  };

  return nextMap[currentType] || [];
}

/**
 * Calculates auto position for next node based on existing nodes
 */
export function calculateAutoPosition(
  existingNodes: Node[]
): { x: number; y: number } {
  if (existingNodes.length === 0) {
    return { x: 100, y: 100 };
  }

  const sourceNodes = existingNodes.filter(n => n.type === 'source');
  const targetNodes = existingNodes.filter(n => n.type === 'target');

  if (sourceNodes.length > 0 && targetNodes.length === 0) {
    // Position transform to the right of sources
    const rightmost = Math.max(...sourceNodes.map(n => n.x + n.width));
    return { x: rightmost + 100, y: sourceNodes[0].y };
  }

  if (targetNodes.length > 0) {
    // Position new nodes between transforms and targets
    const rightmost = Math.max(
      ...existingNodes.filter(n => n.type !== 'target').map(n => n.x + n.width)
    );
    return { x: rightmost + 100, y: 100 };
  }

  // Default
  return { x: 100, y: 100 };
}

/**
 * Creates node from dragged metadata item
 */
export function createNodeFromMetadataItem(
  item: { id: string; label: string; type: string; parent?: string },
  connectorId?: string,
  schema?: string,
  position?: { x: number; y: number }
): Node | null {
  if (item.type !== 'table') {
    return null;
  }

  // Source node from table
  return createSourceNode(connectorId || item.parent || '', schema || 'default', item.label, {
    x: position?.x || 100,
    y: position?.y || 100,
  });
}
