import { configureStore } from '@reduxjs/toolkit';
import pipelineReducer from './slices/pipelineSlice';
import uiReducer from './slices/uiSlice';
import tabsReducer from './slices/tabsSlice';
import monitorReducer from './slices/monitorSlice';

export const store = configureStore({
  reducer: {
    pipeline: pipelineReducer,
    ui: uiReducer,
    tabs: tabsReducer,
    monitor: monitorReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
