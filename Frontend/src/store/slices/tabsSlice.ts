import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Tab } from '@/types';

interface TabsState {
  allTabs: Tab[];
  activeTabId: string | null;
}

const initialState: TabsState = {
  allTabs: [],
  activeTabId: null,
};

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    openTab: (state, action: PayloadAction<Tab>) => {
      const existingTab = state.allTabs.find(
        t => t.objectId === action.payload.objectId && t.type === action.payload.type
      );
      
      if (!existingTab) {
        state.allTabs.push(action.payload);
      }
      
      state.activeTabId = action.payload.id;
    },
    
    closeTab: (state, action: PayloadAction<string>) => {
      const tabIndex = state.allTabs.findIndex(t => t.id === action.payload);
      if (tabIndex === -1) return;
      
      state.allTabs.splice(tabIndex, 1);
      
      if (state.activeTabId === action.payload) {
        state.activeTabId = state.allTabs[tabIndex - 1]?.id || state.allTabs[0]?.id || null;
      }
    },
    
    setActiveTab: (state, action: PayloadAction<string>) => {
      if (state.allTabs.some(t => t.id === action.payload)) {
        state.activeTabId = action.payload;
      }
    },
    
    markTabUnsaved: (state, action: PayloadAction<string>) => {
      const tab = state.allTabs.find(t => t.id === action.payload);
      if (tab) {
        tab.unsaved = true;
        tab.isDirty = true;
      }
    },
    
    markTabSaved: (state, action: PayloadAction<string>) => {
      const tab = state.allTabs.find(t => t.id === action.payload);
      if (tab) {
        tab.unsaved = false;
      }
    },
  },
});

export const { openTab, closeTab, setActiveTab, markTabUnsaved, markTabSaved } = tabsSlice.actions;

export default tabsSlice.reducer;
