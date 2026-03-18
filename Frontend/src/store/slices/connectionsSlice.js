import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';
const initialState = {
    connectors: [],
    connectorTypes: [],
    isLoading: false,
    error: null,
    createConnectionOpen: false,
};
function mapConnector(r) {
    return {
        connectorId: r.connector_id ?? r.connectorId,
        connectorDisplayName: r.connector_display_name ?? r.connectorDisplayName,
        connectorTypeCode: r.connector_type_code ?? r.connectorTypeCode,
        connSslMode: r.conn_ssl_mode ?? r.connSslMode ?? '',
        healthStatusCode: r.health_status_code ?? r.healthStatusCode ?? '',
        updatedDtm: r.updated_dtm ?? r.updatedDtm,
    };
}
export const fetchConnectors = createAsyncThunk('connections/fetchAll', async () => {
    const res = await api.getConnections();
    return (res.data.data ?? res.data).map(mapConnector);
});
export const fetchConnectorTypes = createAsyncThunk('connections/fetchTypes', async () => {
    const res = await api.getConnectionTypes();
    return (res.data.data ?? res.data);
});
export const createConnector = createAsyncThunk('connections/create', async (data) => {
    const res = await api.createConnection(data);
    return mapConnector(res.data.data ?? res.data);
});
export const updateConnector = createAsyncThunk('connections/update', async ({ id, data }) => {
    await api.updateConnection(id, data);
    const res = await api.getConnection(id); // refetch to get updated status
    return mapConnector(res.data.data ?? res.data);
});
export const deleteConnector = createAsyncThunk('connections/delete', async (id) => {
    await api.deleteConnection(id);
    return id;
});
export const testConnectorById = createAsyncThunk('connections/test', async (id, { dispatch }) => {
    await api.testConnectionById(id);
    // Reload connectors to update the health status
    dispatch(fetchConnectors());
});
const connectionsSlice = createSlice({
    name: 'connections',
    initialState,
    reducers: {
        openCreateConnection(state) {
            state.createConnectionOpen = true;
        },
        closeCreateConnection(state) {
            state.createConnectionOpen = false;
        },
    },
    extraReducers: builder => {
        builder
            .addCase(fetchConnectors.pending, state => { state.isLoading = true; state.error = null; })
            .addCase(fetchConnectors.fulfilled, (state, action) => {
            state.isLoading = false;
            state.connectors = action.payload;
        })
            .addCase(fetchConnectors.rejected, (state, action) => {
            state.isLoading = false;
            state.error = action.error.message ?? 'Failed to load connections';
        })
            .addCase(fetchConnectorTypes.fulfilled, (state, action) => {
            state.connectorTypes = action.payload;
        })
            .addCase(createConnector.fulfilled, (state, action) => {
            state.connectors.push(action.payload);
            state.createConnectionOpen = false;
        })
            .addCase(updateConnector.fulfilled, (state, action) => {
            const idx = state.connectors.findIndex(c => c.connectorId === action.payload.connectorId);
            if (idx >= 0)
                state.connectors[idx] = action.payload;
        })
            .addCase(deleteConnector.fulfilled, (state, action) => {
            state.connectors = state.connectors.filter(c => c.connectorId !== action.payload);
        });
    },
});
export const { openCreateConnection, closeCreateConnection } = connectionsSlice.actions;
export default connectionsSlice.reducer;
