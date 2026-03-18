import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '@/services/api';
import { connectorCache } from '@/utils/connectorCache';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ConnectorSummary {
  connectorId: string;
  connectorDisplayName: string;
  connectorTypeCode: string;
  connSslMode: string;
  healthStatusCode: string;
  updatedDtm: string;
  technologyId?: string | null;
}

export interface ConnectorType {
  typeCode: string;
  displayName: string;
  category: string;
  configSchema: { required?: string[]; properties?: Record<string, unknown> };
  secretsSchema: { required?: string[]; properties?: Record<string, unknown> };
  defaultPort?: number;
}

export interface TechnologyType {
  techId: string;
  techCode: string;
  displayName: string;
  category: string;
  iconName: string | null;
  techDesc: string | null;
}

// Per-technology lazy slot kept in Redux (metadata only — raw rows in connectorCache)
export interface TechConnectorSlot {
  /** Number of items currently in connectorCache for this techCode. */
  count: number;
  nextCursor: string | null;   // null = no more pages
  isLoading: boolean;
  error: string | null;
}

interface ConnectionsState {
  // Per-technology lazy slots — keyed by techCode
  connectorsByTech: Record<string, TechConnectorSlot>;
  connectorTypes: ConnectorType[];
  technologies: TechnologyType[];
  isLoading: boolean;        // for technologies list
  error: string | null;
  createConnectionOpen: boolean;
  preselectedTechCode: string | null;
}

const emptySlot = (): TechConnectorSlot => ({
  count: 0,
  nextCursor: null,
  isLoading: false,
  error: null,
});

const initialState: ConnectionsState = {
  connectorsByTech: {},
  connectorTypes: [],
  technologies: [],
  isLoading: false,
  error: null,
  createConnectionOpen: false,
  preselectedTechCode: null,
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapConnector(r: any): ConnectorSummary {
  return {
    connectorId:          r.connector_id            ?? r.connectorId,
    connectorDisplayName: r.connector_display_name   ?? r.connectorDisplayName,
    connectorTypeCode:    r.connector_type_code      ?? r.connectorTypeCode,
    connSslMode:          r.conn_ssl_mode            ?? r.connSslMode         ?? '',
    healthStatusCode:     r.health_status_code       ?? r.healthStatusCode    ?? '',
    updatedDtm:           r.updated_dtm              ?? r.updatedDtm,
    technologyId:         r.technology_id            ?? r.technologyId        ?? null,
  };
}

// ─── Thunks ───────────────────────────────────────────────────────────────────

/**
 * Lazy-load connectors for a specific technology code.
 * Appends results on pagination (when after is provided).
 */
export const fetchConnectorsByTech = createAsyncThunk(
  'connections/fetchByTech',
  async ({ techCode, after }: { techCode: string; after?: string }) => {
    const res = await api.getConnections({ techCode, limit: 50, after });
    const items = ((res.data.data ?? []) as any[]).map(mapConnector);
    const nextCursor: string | null = res.data.nextCursor ?? null;
    return { techCode, items, nextCursor, append: !!after };
  },
);

/**
 * Kept for backwards compat — fetches all without tech filter.
 * Use fetchConnectorsByTech where possible.
 */
export const fetchConnectors = createAsyncThunk('connections/fetchAll', async () => {
  const res = await api.getConnections();
  const items = ((res.data.data ?? []) as any[]).map(mapConnector);
  const nextCursor: string | null = res.data.nextCursor ?? null;
  return { items, nextCursor };
});

export const fetchConnectorTypes = createAsyncThunk('connections/fetchTypes', async () => {
  const res = await api.getConnectionTypes();
  return (res.data.data ?? res.data) as ConnectorType[];
});

export const fetchTechnologies = createAsyncThunk('connections/fetchTechnologies', async () => {
  const res = await api.getTechnologies();
  return (res.data.data ?? res.data) as TechnologyType[];
});

export const createConnector = createAsyncThunk(
  'connections/create',
  async (data: {
    connectorDisplayName: string;
    connectorTypeCode: string;
    config: Record<string, string>;
    secrets: Record<string, string>;
    technologyId?: string | null;
  }) => {
    const res = await api.createConnection(data);
    return mapConnector(res.data.data ?? res.data);
  }
);

export const updateConnector = createAsyncThunk(
  'connections/update',
  async ({ id, data }: { id: string; data: unknown }) => {
    await api.updateConnection(id, data);
    const res = await api.getConnection(id);
    return mapConnector(res.data.data ?? res.data);
  }
);

export const deleteConnector = createAsyncThunk(
  'connections/delete',
  async (id: string) => {
    await api.deleteConnection(id);
    return id;
  }
);

export const testConnectorById = createAsyncThunk(
  'connections/test',
  async (id: string, { dispatch }) => {
    await api.testConnectionById(id);
    // Refresh the containing tech slot — find by connectorId across all slots
    dispatch(fetchConnectors());
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    openCreateConnection(state, action: PayloadAction<{ preselectedTechCode?: string } | undefined>) {
      state.createConnectionOpen = true;
      state.preselectedTechCode = action.payload?.preselectedTechCode ?? null;
    },
    closeCreateConnection(state) {
      state.createConnectionOpen = false;
      state.preselectedTechCode = null;
    },
    /** Drop the cached connector list for a technology (free memory on collapse). */
    evictTechSlot(state, action: PayloadAction<string>) {
      connectorCache.evict(action.payload);
      delete state.connectorsByTech[action.payload];
    },
  },
  extraReducers: builder => {
    builder
      // ── fetchConnectorsByTech ──────────────────────────────────────────────
      .addCase(fetchConnectorsByTech.pending, (state, { meta }) => {
        const code = meta.arg.techCode;
        if (!state.connectorsByTech[code]) state.connectorsByTech[code] = emptySlot();
        state.connectorsByTech[code]!.isLoading = true;
        state.connectorsByTech[code]!.error = null;
      })
      .addCase(fetchConnectorsByTech.fulfilled, (state, { payload }) => {
        // Store items in Arrow cache (outside Redux) — only metadata in Redux
        connectorCache.set(payload.techCode, payload.items, payload.append);
        const slot = state.connectorsByTech[payload.techCode] ?? emptySlot();
        slot.isLoading = false;
        slot.nextCursor = payload.nextCursor;
        slot.count = connectorCache.count(payload.techCode);
        state.connectorsByTech[payload.techCode] = slot;
      })
      .addCase(fetchConnectorsByTech.rejected, (state, action) => {
        const code = action.meta.arg.techCode;
        if (state.connectorsByTech[code]) {
          state.connectorsByTech[code]!.isLoading = false;
          state.connectorsByTech[code]!.error = action.error.message ?? 'Failed to load';
        }
      })

      // ── fetchConnectors (all) ──────────────────────────────────────────────
      .addCase(fetchConnectors.pending, state => { state.isLoading = true; state.error = null; })
      .addCase(fetchConnectors.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        connectorCache.set('__ALL__', payload.items, false);
        state.connectorsByTech['__ALL__'] = {
          count: connectorCache.count('__ALL__'),
          nextCursor: payload.nextCursor,
          isLoading: false,
          error: null,
        };
      })
      .addCase(fetchConnectors.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to load connections';
      })

      // ── Other ──────────────────────────────────────────────────────────────
      .addCase(fetchConnectorTypes.fulfilled, (state, action) => {
        state.connectorTypes = action.payload;
      })
      .addCase(fetchTechnologies.pending, state => { state.isLoading = true; })
      .addCase(fetchTechnologies.fulfilled, (state, action) => {
        state.isLoading = false;
        state.technologies = action.payload;
      })
      .addCase(fetchTechnologies.rejected, state => { state.isLoading = false; })

      // ── CRUD mutations — evict Arrow cache so next expand re-fetches ─────────
      .addCase(createConnector.fulfilled, state => {
        state.createConnectionOpen = false;
        // Evict all cached slots — next expand will re-fetch with correct data
        connectorCache.evictAll();
        state.connectorsByTech = {};
      })
      .addCase(updateConnector.fulfilled, (state, { payload }) => {
        // Update in whichever cached slot contains this connector
        for (const techCode of Object.keys(state.connectorsByTech)) {
          const items = connectorCache.get(techCode);
          const idx = items.findIndex(c => c.connectorId === payload.connectorId);
          if (idx >= 0) {
            items[idx] = payload;
            connectorCache.set(techCode, items, false);
            break;
          }
        }
      })
      .addCase(deleteConnector.fulfilled, (state, { payload: id }) => {
        for (const techCode of Object.keys(state.connectorsByTech)) {
          const items = connectorCache.get(techCode);
          const filtered = items.filter(c => c.connectorId !== id);
          if (filtered.length !== items.length) {
            connectorCache.set(techCode, filtered, false);
            state.connectorsByTech[techCode]!.count = filtered.length;
          }
        }
      });
  },
});

export const { openCreateConnection, closeCreateConnection, evictTechSlot } = connectionsSlice.actions;
export default connectionsSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────

/** Returns all connectors across all tech slots (flattened, deduplicated). Reads from Arrow cache. */
export function selectAllConnectors(connectorsByTech: Record<string, TechConnectorSlot>): ConnectorSummary[] {
  const seen = new Set<string>();
  const result: ConnectorSummary[] = [];
  for (const techCode of Object.keys(connectorsByTech)) {
    for (const c of connectorCache.get(techCode)) {
      if (!seen.has(c.connectorId)) {
        seen.add(c.connectorId);
        result.push(c);
      }
    }
  }
  return result;
}
