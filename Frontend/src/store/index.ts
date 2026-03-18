import { configureStore } from '@reduxjs/toolkit';
import pipelineReducer from './slices/pipelineSlice';
import uiReducer from './slices/uiSlice';
import tabsReducer from './slices/tabsSlice';
import monitorReducer from './slices/monitorSlice';
import projectsReducer from './slices/projectsSlice';
import connectionsReducer from './slices/connectionsSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    pipeline: pipelineReducer,
    ui: uiReducer,
    tabs: tabsReducer,
    monitor: monitorReducer,
    projects: projectsReducer,
    connections: connectionsReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
