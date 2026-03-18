import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Tab } from '@/types';

interface TabsState {
  allTabs: Tab[];
  activeTabId: string | null;
  lastClosedTab: Tab | null;
}

const initialState: TabsState = {
  allTabs: [],
  activeTabId: null,
  lastClosedTab: null,
};

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    openTab: (state, action: PayloadAction<Tab>) => {
      const existing = state.allTabs.find(
        t => t.objectId === action.payload.objectId && t.type === action.payload.type
      );
      if (!existing) {
        state.allTabs.push(action.payload);
      } else {
        // Update name/path in case it changed
        existing.objectName = action.payload.objectName;
        if (action.payload.hierarchyPath) existing.hierarchyPath = action.payload.hierarchyPath;
      }
      state.activeTabId = existing ? existing.id : action.payload.id;
    },

    closeTab: (state, action: PayloadAction<string>) => {
      const idx = state.allTabs.findIndex(t => t.id === action.payload);
      if (idx === -1) return;
      const removed = state.allTabs[idx];
      if (removed?.isPinned) return; // pinned tabs cannot be closed
      state.lastClosedTab = removed ?? null;
      state.allTabs.splice(idx, 1);
      if (state.activeTabId === action.payload) {
        state.activeTabId =
          state.allTabs[idx - 1]?.id ?? state.allTabs[0]?.id ?? null;
      }
    },

    closeOthers: (state, action: PayloadAction<string>) => {
      state.allTabs = state.allTabs.filter(
        t => t.id === action.payload || t.isPinned
      );
      if (!state.allTabs.find(t => t.id === state.activeTabId)) {
        state.activeTabId = action.payload;
      }
    },

    closeAll: (state) => {
      state.allTabs = state.allTabs.filter(t => t.isPinned);
      if (!state.allTabs.find(t => t.id === state.activeTabId)) {
        state.activeTabId = state.allTabs[0]?.id ?? null;
      }
    },

    setActiveTab: (state, action: PayloadAction<string>) => {
      if (state.allTabs.some(t => t.id === action.payload)) {
        state.activeTabId = action.payload;
      }
    },

    markTabUnsaved: (state, action: PayloadAction<string>) => {
      const tab = state.allTabs.find(t => t.id === action.payload);
      if (tab) { tab.unsaved = true; tab.isDirty = true; }
    },

    markTabSaved: (state, action: PayloadAction<string>) => {
      const tab = state.allTabs.find(t => t.id === action.payload);
      if (tab) { tab.unsaved = false; tab.isDirty = false; }
    },

    pinTab: (state, action: PayloadAction<string>) => {
      const tab = state.allTabs.find(t => t.id === action.payload);
      if (tab) tab.isPinned = true;
    },

    unpinTab: (state, action: PayloadAction<string>) => {
      const tab = state.allTabs.find(t => t.id === action.payload);
      if (tab) tab.isPinned = false;
    },

    restoreLastClosed: (state) => {
      if (!state.lastClosedTab) return;
      const already = state.allTabs.find(t => t.id === state.lastClosedTab!.id);
      if (!already) state.allTabs.push(state.lastClosedTab);
      state.activeTabId = state.lastClosedTab.id;
      state.lastClosedTab = null;
    },

    updateTab: (state, action: PayloadAction<{ id: string; name?: string; hierarchyPath?: string }>) => {
      const tab = state.allTabs.find(t => t.id === action.payload.id);
      if (!tab) return;
      if (action.payload.name !== undefined) tab.objectName = action.payload.name;
      if (action.payload.hierarchyPath !== undefined) tab.hierarchyPath = action.payload.hierarchyPath;
    },
  },
});

export const {
  openTab,
  closeTab,
  closeOthers,
  closeAll,
  setActiveTab,
  markTabUnsaved,
  markTabSaved,
  pinTab,
  unpinTab,
  restoreLastClosed,
  updateTab,
} = tabsSlice.actions;

export default tabsSlice.reducer;
