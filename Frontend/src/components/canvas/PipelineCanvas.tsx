import React, { useRef, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addNode,
  selectNode,
  clearSelection,
  updateNode,
  addEdge,
  deleteEdge,
} from '@/store/slices/pipelineSlice';
import { Node, Edge } from '@/types';
import { v4 as uuid } from 'uuid';
import { createSourceNode, createTargetNode } from '@/utils/nodeFactory';

interface PortCoordinates {
  [nodeId: string]: { input: { x: number; y: number }; output: { x: number; y: number } };
}

interface DraggedMetadataItem {
  id: string;
  label: string;
  type: string;
  connectorId?: string;
  schema?: string;
}

export function PipelineCanvas() {
  const dispatch = useAppDispatch();
  const { nodes, edges, selectedNodeIds } = useAppSelector(state => state.pipeline);
  const canvasRef = useRef<SVGSVGElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ fromNodeId: string; fromPort: 'output' } | null>(
    null
  );
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showToolbar, setShowToolbar] = useState(false);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  const nodeList = Object.values(nodes);
  const edgeList = Object.values(edges);

  // Calculate port coordinates
  const portCoordinates = useMemo<PortCoordinates>(() => {
    const coords: PortCoordinates = {};
    Object.values(nodes).forEach(node => {
      coords[node.id] = {
        input: { x: node.x, y: node.y + node.height / 2 },
        output: { x: node.x + node.width, y: node.y + node.height / 2 },
      };
    });
    return coords;
  }, [nodes]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      dispatch(clearSelection());
      setShowToolbar(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverCanvas(false);

    try {
      // Parse dragged metadata item
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;

      const draggedItem: DraggedMetadataItem = JSON.parse(dataStr);

      // Only accept table items
      if (draggedItem.type !== 'table') return;

      if (!canvasRef.current) return;

      const svg = canvasRef.current;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;

      // Create source node
      const newNode = createSourceNode(
        draggedItem.connectorId || 'unknown',
        draggedItem.schema || 'default',
        draggedItem.label,
        { x: Math.max(0, x - 90), y: Math.max(0, y - 30) }
      );

      dispatch(addNode(newNode));
      dispatch(selectNode({ id: newNode.id, multiSelect: false }));
    } catch (error) {
      console.error('Failed to create node from dropped item:', error);
    }
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(selectNode({ id: nodeId, multiSelect: e.ctrlKey }));
    setShowToolbar(selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1);

    if (canvasRef.current) {
      const svg = canvasRef.current;
      const rect = svg.getBoundingClientRect();
      const nodeElement = svg.querySelector(`[data-node-id="${nodeId}"]`) as SVGElement;

      if (nodeElement) {
        const currentX = parseFloat(nodeElement.getAttribute('x') || '0');
        const currentY = parseFloat(nodeElement.getAttribute('y') || '0');
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setDragOffset({
          x: mouseX - currentX,
          y: mouseY - currentY,
        });
        setDraggingNode(nodeId);
      }
    }
  };

  const handlePortMouseDown = (
    nodeId: string,
    port: 'input' | 'output',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (port === 'output') {
      setConnecting({ fromNodeId: nodeId, fromPort: 'output' });
    }
  };

  const handlePortMouseUp = (nodeId: string, port: 'input' | 'output', e: React.MouseEvent) => {
    e.stopPropagation();
    if (connecting && connecting.fromNodeId !== nodeId && port === 'input') {
      dispatch(
        addEdge({
          id: uuid(),
          source: connecting.fromNodeId,
          target: nodeId,
          sourcePort: 'output',
          targetPort: 'input',
        })
      );
      setConnecting(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    if (draggingNode && canvasRef.current) {
      const svg = canvasRef.current;
      const rect = svg.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - dragOffset.x) / 24) * 24;
      const y = Math.round((e.clientY - rect.top - dragOffset.y) / 24) * 24;

      // Update all selected nodes if multiple selected
      selectedNodeIds.forEach(nodeId => {
        const node = nodes[nodeId];
        if (nodeId === draggingNode) {
          dispatch(
            updateNode({
              id: draggingNode,
              x: Math.max(0, x),
              y: Math.max(0, y),
            })
          );
        }
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
    setConnecting(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.8 : 1.2;
    setZoom(prev => Math.max(0.5, Math.min(3, prev * delta)));
  };

  const addNewNode = (type: Node['type']) => {
    const newNode: Node = {
      id: uuid(),
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeList.length + 1}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 160,
      height: 56,
      config: {},
      inputs: type !== 'source' ? [{ id: uuid(), name: 'input', type: 'any' }] : [],
      outputs: type !== 'target' ? [{ id: uuid(), name: 'output', type: 'any' }] : [],
      version: 1,
    };

    dispatch(addNode(newNode));
  };

  const alignNodes = (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedNodeIds.length < 2) return;

    const selectedNodes = selectedNodeIds.map(id => nodes[id]);
    const positions = selectedNodes.map(n => ({ x: n.x, y: n.y, width: n.width, height: n.height }));

    let alignment: Partial<Node> = {};

    if (direction === 'left') {
      const minX = Math.min(...positions.map(p => p.x));
      selectedNodeIds.forEach(id => dispatch(updateNode({ id, x: minX })));
    } else if (direction === 'center') {
      const minX = Math.min(...positions.map(p => p.x));
      const maxX = Math.max(...positions.map(p => p.x + p.width));
      const center = (minX + maxX) / 2;
      selectedNodeIds.forEach(id => {
        const node = nodes[id];
        dispatch(updateNode({ id, x: center - node.width / 2 }));
      });
    } else if (direction === 'right') {
      const maxX = Math.max(...positions.map(p => p.x + p.width));
      selectedNodeIds.forEach(id => {
        const node = nodes[id];
        dispatch(updateNode({ id, x: maxX - node.width }));
      });
    } else if (direction === 'top') {
      const minY = Math.min(...positions.map(p => p.y));
      selectedNodeIds.forEach(id => dispatch(updateNode({ id, y: minY })));
    } else if (direction === 'middle') {
      const minY = Math.min(...positions.map(p => p.y));
      const maxY = Math.max(...positions.map(p => p.y + p.height));
      const middle = (minY + maxY) / 2;
      selectedNodeIds.forEach(id => {
        const node = nodes[id];
        dispatch(updateNode({ id, y: middle - node.height / 2 }));
      });
    } else if (direction === 'bottom') {
      const maxY = Math.max(...positions.map(p => p.y + p.height));
      selectedNodeIds.forEach(id => {
        const node = nodes[id];
        dispatch(updateNode({ id, y: maxY - node.height }));
      });
    }
  };

  const colorMap: Record<string, string> = {
    source: '#E6F4FF',
    target: '#E8FFF0',
    transform: '#FFF7E6',
    join: '#FFF7E6',
    aggregate: '#FFF7E6',
    filter: '#FFF7E6',
    custom: '#F3E8FF',
  };

  // Bezier curve helper
  const bezierPath = (x1: number, y1: number, x2: number, y2: number) => {
    const cp1x = x1 + (x2 - x1) / 3;
    const cp2x = x2 - (x2 - x1) / 3;
    return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="h-12 bg-neutral-50 border-b border-neutral-200 flex items-center gap-2 px-4 justify-between">
        <div className="flex gap-2">
          {(['source', 'transform', 'target'] as const).map(type => (
            <button
              key={type}
              onClick={() => addNewNode(type)}
              className="px-3 py-1.5 bg-white border border-neutral-200 rounded-md text-sm hover:bg-neutral-50 active:bg-primary-50"
            >
              + {type}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-600">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
            className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-sm hover:bg-neutral-50"
          >
            −
          </button>
          <button
            onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
            className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-sm hover:bg-neutral-50"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 bg-white border border-neutral-200 rounded-md text-sm hover:bg-neutral-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className={`flex-1 overflow-hidden relative ${
          isDragOverCanvas ? 'bg-primary-50 border-2 border-dashed border-primary-300' : 'bg-white'
        }`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onClick={handleCanvasClick}
          style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
        >
          {/* Grid background */}
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#f0f0f0" strokeWidth="0.5" />
            </pattern>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#0B66FF" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edgeList.map(edge => {
            const sourceCoords = portCoordinates[edge.source];
            const targetCoords = portCoordinates[edge.target];
            if (!sourceCoords || !targetCoords) return null;

            const x1 = sourceCoords.output.x;
            const y1 = sourceCoords.output.y;
            const x2 = targetCoords.input.x;
            const y2 = targetCoords.input.y;

            return (
              <g key={edge.id}>
                <path
                  d={bezierPath(x1, y1, x2, y2)}
                  stroke="#0B66FF"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
                {/* Hover for delete */}
                <path
                  d={bezierPath(x1, y1, x2, y2)}
                  stroke="transparent"
                  strokeWidth="8"
                  fill="none"
                  className="hover:stroke-danger-300 cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    dispatch(deleteEdge(edge.id));
                  }}
                />
              </g>
            );
          })}

          {/* Connecting preview */}
          {connecting && (
            <path
              d={bezierPath(
                portCoordinates[connecting.fromNodeId]?.output.x || 0,
                portCoordinates[connecting.fromNodeId]?.output.y || 0,
                mousePos.x,
                mousePos.y
              )}
              stroke="#666"
              strokeWidth="2"
              fill="none"
              strokeDasharray="5,5"
            />
          )}

          {/* Nodes */}
          {nodeList.map(node => (
            <g key={node.id} data-node-id={node.id}>
              {/* Node body */}
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx="4"
                fill={colorMap[node.type] || '#F3E8FF'}
                stroke={selectedNodeIds.includes(node.id) ? '#0B66FF' : '#E6E9EE'}
                strokeWidth={selectedNodeIds.includes(node.id) ? 2 : 1}
                onMouseDown={e => handleNodeMouseDown(node.id, e)}
                style={{ cursor: 'move' }}
              />

              {/* Input port */}
              {node.type !== 'source' && (
                <circle
                  cx={node.x}
                  cy={node.y + node.height / 2}
                  r="5"
                  fill="#0B66FF"
                  stroke="white"
                  strokeWidth="2"
                  className="hover:r-6 cursor-pointer"
                  onMouseDown={e => handlePortMouseDown(node.id, 'input', e)}
                  onMouseUp={e => handlePortMouseUp(node.id, 'input', e)}
                />
              )}

              {/* Output port */}
              {node.type !== 'target' && (
                <circle
                  cx={node.x + node.width}
                  cy={node.y + node.height / 2}
                  r="5"
                  fill="#0B66FF"
                  stroke="white"
                  strokeWidth="2"
                  className="hover:r-6 cursor-pointer"
                  onMouseDown={e => handlePortMouseDown(node.id, 'output', e)}
                />
              )}

              {/* Node label */}
              <text
                x={node.x + 8}
                y={node.y + 24}
                fontSize="13"
                fontWeight="600"
                fill="#111827"
                pointerEvents="none"
              >
                {node.name}
              </text>
              <text
                x={node.x + 8}
                y={node.y + 40}
                fontSize="11"
                fill="#6B7280"
                pointerEvents="none"
              >
                {node.type}
              </text>
            </g>
          ))}
        </svg>

        {/* Floating alignment toolbar */}
        {selectedNodeIds.length > 1 && (
          <div className="absolute bottom-4 left-4 bg-white border border-neutral-200 rounded-lg shadow-sm p-2 flex gap-1">
            <button
              onClick={() => alignNodes('left')}
              title="Align left"
              className="p-2 text-sm hover:bg-neutral-100 rounded-md"
            >
              ⬅️
            </button>
            <button
              onClick={() => alignNodes('center')}
              title="Align center horizontal"
              className="p-2 text-sm hover:bg-neutral-100 rounded-md"
            >
              ↔️
            </button>
            <button
              onClick={() => alignNodes('right')}
              title="Align right"
              className="p-2 text-sm hover:bg-neutral-100 rounded-md"
            >
              ➡️
            </button>
            <div className="border-l border-neutral-200" />
            <button
              onClick={() => alignNodes('top')}
              title="Align top"
              className="p-2 text-sm hover:bg-neutral-100 rounded-md"
            >
              ⬆️
            </button>
            <button
              onClick={() => alignNodes('middle')}
              title="Align middle vertical"
              className="p-2 text-sm hover:bg-neutral-100 rounded-md"
            >
              ↕️
            </button>
            <button
              onClick={() => alignNodes('bottom')}
              title="Align bottom"
              className="p-2 text-sm hover:bg-neutral-100 rounded-md"
            >
              ⬇️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
