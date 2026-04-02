import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Pipeline, Node, Edge } from '@/types';
import { v4 as uuid } from 'uuid';

interface CanvasSnapshot { nodes: Record<string, Node>; edges: Record<string, Edge>; }

interface PipelineState {
  activePipeline: Pipeline | null;
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  selectedNodeIds: string[];
  unsavedChanges: boolean;
  // F-21: undo/redo history (ring-buffer of max 50 snapshots)
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
  // F-22: copy/paste clipboard
  clipboard: Node[];
}

const MAX_HISTORY = 50;

const initialState: PipelineState = {
  activePipeline: null,
  nodes: {},
  edges: {},
  selectedNodeIds: [],
  unsavedChanges: false,
  past: [],
  future: [],
  clipboard: [],
};

function snapshot(state: PipelineState): CanvasSnapshot {
  return { nodes: { ...state.nodes }, edges: { ...state.edges } };
}

function pushHistory(state: PipelineState) {
  state.past.push(snapshot(state));
  if (state.past.length > MAX_HISTORY) state.past.shift();
  state.future = [];
}

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState,
  reducers: {
    setPipeline: (state, action: PayloadAction<Pipeline>) => {
      state.activePipeline = action.payload;
      state.nodes = action.payload.nodes.reduce(
        (acc, node) => ({ ...acc, [node.id]: node }),
        {}
      );
      state.edges = action.payload.edges.reduce(
        (acc, edge) => ({ ...acc, [edge.id]: edge }),
        {}
      );
      state.unsavedChanges = false;
      state.past = [];
      state.future = [];
    },

    updateActivePipeline: (state, action: PayloadAction<Partial<Pipeline>>) => {
      if (state.activePipeline) {
        state.activePipeline = { ...state.activePipeline, ...action.payload };
        state.unsavedChanges = true;
      }
    },

    addNode: (state, action: PayloadAction<Node>) => {
      pushHistory(state);
      state.nodes[action.payload.id] = action.payload;
      state.unsavedChanges = true;
    },

    updateNode: (state, action: PayloadAction<Partial<Node> & { id: string }>) => {
      const { id, ...updates } = action.payload;
      if (state.nodes[id]) {
        state.nodes[id] = { ...state.nodes[id], ...updates };
        state.unsavedChanges = true;
      }
    },

    deleteNode: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      delete state.nodes[action.payload];
      Object.keys(state.edges).forEach(edgeId => {
        const edge = state.edges[edgeId];
        if (edge.source === action.payload || edge.target === action.payload) {
          delete state.edges[edgeId];
        }
      });
      state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== action.payload);
      state.unsavedChanges = true;
    },

    addEdge: (state, action: PayloadAction<Edge>) => {
      pushHistory(state);
      state.edges[action.payload.id] = action.payload;
      state.unsavedChanges = true;
    },

    deleteEdge: (state, action: PayloadAction<string>) => {
      pushHistory(state);
      delete state.edges[action.payload];
      state.unsavedChanges = true;
    },

    selectNode: (state, action: PayloadAction<{ id: string; multiSelect?: boolean }>) => {
      const { id, multiSelect } = action.payload;
      if (multiSelect) {
        if (state.selectedNodeIds.includes(id)) {
          state.selectedNodeIds = state.selectedNodeIds.filter(nid => nid !== id);
        } else {
          state.selectedNodeIds.push(id);
        }
      } else {
        state.selectedNodeIds = [id];
      }
    },

    clearSelection: (state) => {
      state.selectedNodeIds = [];
    },

    markSaved: (state) => {
      state.unsavedChanges = false;
    },

    // F-21: Undo — restore previous snapshot
    undo: (state) => {
      if (state.past.length === 0) return;
      state.future.unshift(snapshot(state));
      const prev = state.past.pop()!;
      state.nodes = prev.nodes;
      state.edges = prev.edges;
      state.selectedNodeIds = [];
      state.unsavedChanges = true;
    },

    // F-21: Redo — restore next snapshot
    redo: (state) => {
      if (state.future.length === 0) return;
      state.past.push(snapshot(state));
      const next = state.future.shift()!;
      state.nodes = next.nodes;
      state.edges = next.edges;
      state.selectedNodeIds = [];
      state.unsavedChanges = true;
    },

    // F-22: Copy selected nodes to clipboard
    copySelected: (state) => {
      state.clipboard = state.selectedNodeIds
        .map(id => state.nodes[id])
        .filter(Boolean);
    },

    // F-22: Paste clipboard nodes offset by 40px
    pasteClipboard: (state) => {
      if (state.clipboard.length === 0) return;
      pushHistory(state);
      const newIds: string[] = [];
      state.clipboard.forEach(node => {
        const newId = uuid();
        state.nodes[newId] = {
          ...node,
          id: newId,
          x: node.x + 40,
          y: node.y + 40,
          name: node.name + ' (copy)',
          inputs:  node.inputs.map(p => ({ ...p, id: uuid() })),
          outputs: node.outputs.map(p => ({ ...p, id: uuid() })),
        };
        newIds.push(newId);
      });
      state.selectedNodeIds = newIds;
      state.unsavedChanges = true;
    },
  },
});

export const {
  setPipeline,
  updateActivePipeline,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdge,
  selectNode,
  clearSelection,
  markSaved,
  undo,
  redo,
  copySelected,
  pasteClipboard,
} = pipelineSlice.actions;

export default pipelineSlice.reducer;
