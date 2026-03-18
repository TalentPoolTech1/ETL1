import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTheme, setDensity } from '@/store/slices/uiSlice';
import { Toggle } from '@/components/common/Toggle';
export function ThemeSettings() {
    const dispatch = useAppDispatch();
    const { theme, density } = useAppSelector(state => state.ui);
    return (_jsxs("div", { className: "space-y-4 p-4 bg-white rounded-lg border border-neutral-200", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900 mb-2", children: "Appearance" }), _jsx(Toggle, { enabled: theme === 'dark', onChange: enabled => dispatch(setTheme(enabled ? 'dark' : 'light')), label: "Dark Mode" })] }), _jsxs("div", { className: "border-t border-neutral-200 pt-4", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900 mb-2", children: "Display Density" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "radio", checked: density === 'normal', onChange: () => dispatch(setDensity('normal')), className: "w-4 h-4" }), _jsx("span", { className: "text-sm text-neutral-700", children: "Normal" })] }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "radio", checked: density === 'compact', onChange: () => dispatch(setDensity('compact')), className: "w-4 h-4" }), _jsx("span", { className: "text-sm text-neutral-700", children: "Compact" })] })] })] })] }));
}
