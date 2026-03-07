import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  leftRailVisible: boolean;
  leftRailWidth: number;
  rightRailVisible: boolean;
  rightRailWidth: number;
  bottomPanelVisible: boolean;
  bottomPanelHeight: number;
  focusMode: boolean;
  theme: 'light' | 'dark';
  density: 'normal' | 'compact';
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  /** Active sub-tab per workspace tab, keyed by Tab.id. */
  subTabMap: Record<string, string>;
}

const initialState: UIState = {
  leftRailVisible: true,
  leftRailWidth: 280,
  rightRailVisible: true,
  rightRailWidth: 360,
  bottomPanelVisible: true,
  bottomPanelHeight: 260,
  focusMode: false,
  theme: 'light',
  density: 'normal',
  canvasZoom: 1,
  canvasPan: { x: 0, y: 0 },
  subTabMap: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleLeftRail: (state) => {
      state.leftRailVisible = !state.leftRailVisible;
    },
    
    setLeftRailWidth: (state, action: PayloadAction<number>) => {
      state.leftRailWidth = Math.max(200, Math.min(400, action.payload));
    },
    
    toggleRightRail: (state) => {
      state.rightRailVisible = !state.rightRailVisible;
    },
    
    setRightRailWidth: (state, action: PayloadAction<number>) => {
      state.rightRailWidth = Math.max(300, Math.min(500, action.payload));
    },
    
    toggleBottomPanel: (state) => {
      state.bottomPanelVisible = !state.bottomPanelVisible;
    },
    
    setBottomPanelHeight: (state, action: PayloadAction<number>) => {
      state.bottomPanelHeight = Math.max(100, Math.min(600, action.payload));
    },
    
    toggleFocusMode: (state) => {
      state.focusMode = !state.focusMode;
    },
    
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    
    setDensity: (state, action: PayloadAction<'normal' | 'compact'>) => {
      state.density = action.payload;
    },
    
    setCanvasZoom: (state, action: PayloadAction<number>) => {
      state.canvasZoom = Math.max(0.25, Math.min(4, action.payload));
    },
    
    setCanvasPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.canvasPan = action.payload;
    },

    setSubTab: (state, action: PayloadAction<{ tabId: string; subTab: string }>) => {
      state.subTabMap[action.payload.tabId] = action.payload.subTab;
    },

    removeSubTab: (state, action: PayloadAction<string>) => {
      delete state.subTabMap[action.payload];
    },
  },
});

export const {
  toggleLeftRail,
  setLeftRailWidth,
  toggleRightRail,
  setRightRailWidth,
  toggleBottomPanel,
  setBottomPanelHeight,
  toggleFocusMode,
  setTheme,
  setDensity,
  setCanvasZoom,
  setCanvasPan,
  setSubTab,
  removeSubTab,
} = uiSlice.actions;

export default uiSlice.reducer;
