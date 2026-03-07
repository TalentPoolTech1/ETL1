import React, { useState } from 'react';

/**
 * Lineage Visualization component showing data flow and column-level lineage
 */
interface LineageNode {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'target';
  columns: string[];
}

interface LineageLink {
  source: string;
  target: string;
  columns: Array<{ from: string; to: string }>;
}

interface LineageVisualizerProps {
  nodes: LineageNode[];
  links: LineageLink[];
  selectedColumn?: string;
}

export function LineageVisualizer({
  nodes,
  links,
  selectedColumn,
}: LineageVisualizerProps) {
  const [expandedColumn, setExpandedColumn] = useState<string | null>(selectedColumn || null);

  // Find upstream and downstream nodes
  const getUpstream = (nodeId: string): string[] => {
    const upstream: string[] = [];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      links
        .filter(link => link.target === id)
        .forEach(link => {
          upstream.push(link.source);
          traverse(link.source);
        });
    };

    traverse(nodeId);
    return upstream;
  };

  const getDownstream = (nodeId: string): string[] => {
    const downstream: string[] = [];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      links
        .filter(link => link.source === id)
        .forEach(link => {
          downstream.push(link.target);
          traverse(link.target);
        });
    };

    traverse(nodeId);
    return downstream;
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">Data Lineage</h3>

      {/* Lineage graph */}
      <div className="bg-neutral-50 rounded-lg p-4 h-64 border border-neutral-200 overflow-auto">
        <div className="space-y-3">
          {nodes.map(node => (
            <div
              key={node.id}
              className="bg-white rounded-md p-3 border border-neutral-200 hover:border-primary-500"
            >
              <p className="text-sm font-medium text-neutral-900">{node.name}</p>

              {/* Columns */}
              <div className="mt-2 space-y-1">
                {node.columns.map(col => (
                  <div
                    key={col}
                    className={`
                      text-xs px-2 py-1 rounded cursor-pointer
                      ${expandedColumn === `${node.id}.${col}` ? 'bg-primary-100 text-primary-900' : 'bg-neutral-100 text-neutral-700'}
                    `}
                    onClick={() =>
                      setExpandedColumn(
                        expandedColumn === `${node.id}.${col}` ? null : `${node.id}.${col}`
                      )
                    }
                  >
                    📝 {col}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lineage details */}
      {expandedColumn && (
        <div className="bg-primary-50 rounded-lg p-3 border border-primary-200">
          <p className="text-sm font-medium text-primary-900 mb-2">
            Lineage for {expandedColumn}
          </p>
          <div className="text-xs text-primary-800 space-y-1">
            <p>Upstream sources: {getUpstream(expandedColumn.split('.')[0]).length}</p>
            <p>Downstream targets: {getDownstream(expandedColumn.split('.')[0]).length}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Undo/Redo timeline
 */
interface HistoryState {
  id: string;
  timestamp: Date;
  description: string;
  snapshot: any;
}

interface UndoRedoTimelineProps {
  history: HistoryState[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export function UndoRedoTimeline({
  history,
  currentIndex,
  onSelect,
}: UndoRedoTimelineProps) {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">Change History</h3>

      <div className="space-y-2">
        {history.map((state, idx) => (
          <button
            key={state.id}
            onClick={() => onSelect(idx)}
            className={`
              w-full text-left px-3 py-2 rounded-md text-sm transition-colors
              ${idx === currentIndex ? 'bg-primary-100 text-primary-900 font-medium' : 'hover:bg-neutral-100 text-neutral-700'}
            `}
          >
            <div className="flex items-center justify-between">
              <span>{state.description}</span>
              <span className="text-xs text-neutral-500">
                {state.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Data Quality Dashboard
 */
interface QualityMetric {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
}

interface DataQualityDashboardProps {
  metrics: QualityMetric[];
}

export function DataQualityDashboard({ metrics }: DataQualityDashboardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-success-700 bg-success-50';
      case 'warning':
        return 'text-warning-700 bg-warning-50';
      case 'critical':
        return 'text-danger-700 bg-danger-50';
      default:
        return 'text-neutral-700 bg-neutral-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return '✓';
      case 'warning':
        return '⚠';
      case 'critical':
        return '✕';
      default:
        return '?';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">Data Quality</h3>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map(metric => (
          <div key={metric.name} className={`p-3 rounded-lg ${getStatusColor(metric.status)}`}>
            <p className="text-xs font-medium mb-1">{metric.name}</p>
            <div className="flex items-end justify-between">
              <p className="text-lg font-bold">{metric.value}%</p>
              <span className="text-lg">{getStatusIcon(metric.status)}</span>
            </div>
            <div className="mt-2 w-full bg-neutral-300 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${metric.status === 'good' ? 'bg-success-600' : metric.status === 'warning' ? 'bg-warning-600' : 'bg-danger-600'}`}
                style={{ width: `${metric.value}%` }}
              />
            </div>
            <p className="text-xs text-neutral-600 mt-1">Target: {metric.target}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
