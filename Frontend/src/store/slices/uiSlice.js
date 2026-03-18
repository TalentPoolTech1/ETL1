import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    leftRailVisible: true,
    leftRailWidth: 240,
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
        setLeftRailWidth: (state, action) => {
            state.leftRailWidth = Math.max(200, Math.min(400, action.payload));
        },
        toggleRightRail: (state) => {
            state.rightRailVisible = !state.rightRailVisible;
        },
        setRightRailWidth: (state, action) => {
            state.rightRailWidth = Math.max(300, Math.min(500, action.payload));
        },
        toggleBottomPanel: (state) => {
            state.bottomPanelVisible = !state.bottomPanelVisible;
        },
        setBottomPanelHeight: (state, action) => {
            state.bottomPanelHeight = Math.max(100, Math.min(600, action.payload));
        },
        toggleFocusMode: (state) => {
            state.focusMode = !state.focusMode;
        },
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        setDensity: (state, action) => {
            state.density = action.payload;
        },
        setCanvasZoom: (state, action) => {
            state.canvasZoom = Math.max(0.25, Math.min(4, action.payload));
        },
        setCanvasPan: (state, action) => {
            state.canvasPan = action.payload;
        },
        setSubTab: (state, action) => {
            state.subTabMap[action.payload.tabId] = action.payload.subTab;
        },
        removeSubTab: (state, action) => {
            delete state.subTabMap[action.payload];
        },
    },
});
export const { toggleLeftRail, setLeftRailWidth, toggleRightRail, setRightRailWidth, toggleBottomPanel, setBottomPanelHeight, toggleFocusMode, setTheme, setDensity, setCanvasZoom, setCanvasPan, setSubTab, removeSubTab, } = uiSlice.actions;
export default uiSlice.reducer;
