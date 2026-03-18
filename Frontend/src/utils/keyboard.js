export const KEYBOARD_SHORTCUTS = {
    // Global
    COMMAND_PALETTE: { keys: ['Control', 'Meta'], key: 'k', description: 'Command palette' },
    SEARCH_TREE: { keys: ['Control', 'Meta'], key: 'Shift+F', description: 'Search metadata tree' },
    HELP: { keys: ['Control', 'Meta'], key: '?', description: 'Show help' },
    // Tabs
    SAVE: { keys: ['Control', 'Meta'], key: 's', description: 'Save' },
    CLOSE_TAB: { keys: ['Control', 'Meta'], key: 'w', description: 'Close tab' },
    NEXT_TAB: { keys: ['Control', 'Meta'], key: 'Tab', description: 'Next tab' },
    PREV_TAB: { keys: ['Control', 'Meta'], key: 'Shift+Tab', description: 'Previous tab' },
    PIN_TAB: { keys: ['Control', 'Meta'], key: 'p', description: 'Pin tab' },
    // Undo/Redo
    UNDO: { keys: ['Control', 'Meta'], key: 'z', description: 'Undo' },
    REDO: { keys: ['Control', 'Meta'], key: 'Shift+Z', description: 'Redo' },
    // Canvas
    RUN_NODE: { keys: ['Control', 'Meta'], key: 'Enter', description: 'Run selected node' },
    RUN_PIPELINE: { keys: ['Control', 'Meta'], key: 'Shift+Enter', description: 'Run pipeline' },
    DELETE_NODE: { keys: [], key: 'Delete', description: 'Delete selected node' },
    RENAME_NODE: { keys: [], key: 'F2', description: 'Rename node' },
    DUPLICATE_NODE: { keys: ['Control', 'Meta'], key: 'd', description: 'Duplicate node' },
    ZOOM_IN: { keys: ['Control', 'Meta'], key: '+', description: 'Zoom in' },
    ZOOM_OUT: { keys: ['Control', 'Meta'], key: '-', description: 'Zoom out' },
    FIT_TO_SCREEN: { keys: ['Control', 'Meta'], key: '0', description: 'Fit to screen' },
    // Panels
    TOGGLE_PROPERTIES: { keys: ['Alt'], key: 'p', description: 'Toggle properties panel' },
    TOGGLE_LEFT_PANEL: { keys: ['Alt'], key: 'l', description: 'Toggle left panel' },
    TOGGLE_PREVIEW: { keys: ['Alt'], key: 'd', description: 'Toggle data preview' },
    // Focus mode
    FOCUS_MODE: { keys: [], key: 'F11', description: 'Toggle focus mode' },
};
export function getShortcutLabel(shortcut) {
    const { keys, key } = shortcut;
    const prefix = keys.length > 0 ? keys.join('+') + '+' : '';
    return `${prefix}${key}`;
}
export function isShortcutPressed(e, shortcut) {
    const { keys, key } = shortcut;
    // Check modifiers
    const ctrlOrCmd = keys.includes('Control') || keys.includes('Meta');
    const alt = keys.includes('Alt');
    const shift = keys.includes('Shift');
    const isCtrlOrCmdPressed = e.ctrlKey || e.metaKey;
    const isAltPressed = e.altKey;
    const isShiftPressed = e.shiftKey;
    if (ctrlOrCmd && !isCtrlOrCmdPressed)
        return false;
    if (alt && !isAltPressed)
        return false;
    if (shift && !isShiftPressed)
        return false;
    return e.key.toLowerCase() === key.toLowerCase();
}
