import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Pipeline, Node, Edge } from '@/types';
import { v4 as uuid } from 'uuid';

interface PipelineState {
  activePipeline: Pipeline | null;
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  selectedNodeIds: string[];
  unsavedChanges: boolean;
}

const initialState: PipelineState = {
  activePipeline: null,
  nodes: {},
  edges: {},
  selectedNodeIds: [],
  unsavedChanges: false,
};

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
    },
    
    addNode: (state, action: PayloadAction<Node>) => {
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
      delete state.nodes[action.payload];
      // Remove connected edges
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
      state.edges[action.payload.id] = action.payload;
      state.unsavedChanges = true;
    },
    
    deleteEdge: (state, action: PayloadAction<string>) => {
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
  },
});

export const {
  setPipeline,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdge,
  selectNode,
  clearSelection,
  markSaved,
} = pipelineSlice.actions;

export default pipelineSlice.reducer;
