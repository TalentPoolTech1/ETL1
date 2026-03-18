/**
 * Transform Palette with Function Availability
 *
 * Enhanced transformation palette that shows:
 * - Available functions with green ✓
 * - Alternative functions with amber ⚠ and suggestions
 * - Unavailable functions with red ✗ and explanations
 * - One-click switches to alternative implementations
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { Check, AlertCircle, XCircle, ChevronRight, ZapOff, Info, } from 'lucide-react';
import { FunctionAvailabilityFilter, } from '../../../transformations/pushdown/FunctionAvailabilityFilter';
/**
 * Function availability badge
 */
function AvailabilityBadge({ result, }) {
    switch (result.availability) {
        case 'available':
            return (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded", children: [_jsx(Check, { className: "w-3 h-3" }), "Available"] }));
        case 'alternative':
            return (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded", children: [_jsx(AlertCircle, { className: "w-3 h-3" }), "Alternative"] }));
        case 'unavailable':
            return (_jsxs("div", { className: "flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded", children: [_jsx(XCircle, { className: "w-3 h-3" }), "Unavailable"] }));
    }
}
/**
 * Function card component
 */
function FunctionCard({ result, onSelect, isSelected, }) {
    const [showDetails, setShowDetails] = useState(false);
    const canAdd = result.availability === 'available' ||
        (result.availability === 'alternative') ||
        result.canAdd;
    return (_jsxs("div", { className: `
        border rounded-lg p-3 transition-all cursor-pointer
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
        ${!canAdd ? 'opacity-60 cursor-not-allowed' : ''}
      `, onClick: () => canAdd && onSelect(), children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "flex-1", children: [_jsx("h4", { className: "font-medium text-gray-900", children: result.label }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: result.functionId })] }), _jsx(AvailabilityBadge, { result: result })] }), result.sourceImplementation && (_jsxs("div", { className: "mb-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-gray-700", children: [_jsxs("span", { className: "font-medium", children: [result.sourceImplementation.sourceTech, ":"] }), ' ', _jsx("code", { className: "font-mono", children: result.sourceImplementation.implementation }), result.sourceImplementation.notes && (_jsx("p", { className: "mt-1 text-gray-600", children: result.sourceImplementation.notes }))] })), result.message && (_jsx("p", { className: "text-xs text-gray-600 mb-2", children: result.message })), result.alternativeSuggestion && (_jsxs("div", { className: "mb-2 p-2 bg-amber-50 border border-amber-100 rounded", children: [_jsxs("button", { onClick: (e) => {
                            e.stopPropagation();
                            setShowDetails(!showDetails);
                        }, className: "flex items-center gap-2 text-xs font-medium text-amber-700 hover:text-amber-800", children: [_jsx(Info, { className: "w-3 h-3" }), result.availability === 'alternative' ? 'See alternative' : 'Switch to alternative', _jsx(ChevronRight, { className: `w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}` })] }), showDetails && (_jsxs("div", { className: "mt-2 text-xs text-amber-700", children: [_jsxs("p", { className: "mb-1", children: [_jsx("strong", { children: "Alternative:" }), ' ', result.alternativeSuggestion.alternativeLabel] }), _jsx("p", { children: result.alternativeSuggestion.reason })] }))] })), !canAdd && (_jsxs("div", { className: "flex items-center gap-2 text-xs text-red-700 font-medium", children: [_jsx(ZapOff, { className: "w-3 h-3" }), result.message || 'Cannot be used with current settings'] }))] }));
}
/**
 * Category section
 */
function CategorySection({ title, functions, onSelect, selectedFunctionIds, }) {
    if (functions.length === 0) {
        return null;
    }
    return (_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide opacity-70", children: title }), _jsx("div", { className: "grid grid-cols-1 gap-2", children: functions.map((result) => (_jsx(FunctionCard, { result: result, onSelect: () => onSelect(result.functionId), isSelected: selectedFunctionIds.includes(result.functionId) }, result.functionId))) })] }));
}
/**
 * Transform Palette Component
 */
export function TransformPalette({ sourceTechnology, executionPoint, onSelectFunction, filter: externalFilter, selectedFunctionIds = [], allowUnavailable = false, }) {
    const filter = useMemo(() => externalFilter || new FunctionAvailabilityFilter(), [externalFilter]);
    const palette = useMemo(() => {
        return filter.filterFunctions(sourceTechnology, executionPoint);
    }, [filter, sourceTechnology, executionPoint]);
    return (_jsxs("div", { className: "w-full max-w-md mx-auto p-4", children: [_jsxs("div", { className: "mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg", children: [_jsx("h2", { className: "font-semibold text-gray-900", children: "Transform Functions" }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: ["Source: ", _jsx("span", { className: "font-medium", children: sourceTechnology }), " \u00B7 Execution:", ' ', _jsx("span", { className: "font-medium capitalize", children: executionPoint })] })] }), _jsxs("div", { className: "mb-6 grid grid-cols-3 gap-2 text-center", children: [_jsxs("div", { className: "p-2 bg-green-50 rounded", children: [_jsx("div", { className: "text-lg font-bold text-green-600", children: palette.available.length }), _jsx("div", { className: "text-xs text-green-700", children: "Available" })] }), _jsxs("div", { className: "p-2 bg-amber-50 rounded", children: [_jsx("div", { className: "text-lg font-bold text-amber-600", children: palette.alternatives.length }), _jsx("div", { className: "text-xs text-amber-700", children: "Alternative" })] }), _jsxs("div", { className: "p-2 bg-red-50 rounded", children: [_jsx("div", { className: "text-lg font-bold text-red-600", children: palette.unavailable.length }), _jsx("div", { className: "text-xs text-red-700", children: "Unavailable" })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(CategorySection, { title: "Available", functions: palette.available, onSelect: onSelectFunction, selectedFunctionIds: selectedFunctionIds }), palette.alternatives.length > 0 && (_jsx(CategorySection, { title: "With Alternatives", functions: palette.alternatives, onSelect: onSelectFunction, selectedFunctionIds: selectedFunctionIds })), allowUnavailable && palette.unavailable.length > 0 && (_jsxs("div", { className: "border-t pt-6", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide opacity-70", children: "Unavailable (PySpark only)" }), _jsxs("p", { className: "text-xs text-gray-600 mb-3", children: ["These functions are not supported in ", sourceTechnology, ". Switch to PySpark execution to use them."] }), _jsxs("div", { className: "space-y-2 opacity-50", children: [palette.unavailable.slice(0, 3).map((result) => (_jsxs("div", { className: "border border-gray-200 rounded p-2 bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-medium text-sm text-gray-700", children: result.label }), _jsx("span", { className: "text-xs text-gray-500", children: "Not available" })] }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: result.message })] }, result.functionId))), palette.unavailable.length > 3 && (_jsxs("p", { className: "text-xs text-gray-500 pt-2", children: ["+", palette.unavailable.length - 3, " more unavailable in PySpark"] }))] })] }))] }), _jsx("div", { className: "mt-6 p-3 bg-gray-50 rounded-lg border border-gray-200", children: _jsxs("p", { className: "text-xs text-gray-600", children: ["\uD83D\uDCA1 ", _jsx("strong", { children: "Tip:" }), " Available functions execute in ", sourceTechnology, " for better performance. Alternative functions work but may have different syntax. Unavailable functions require switching to PySpark."] }) })] }));
}
export default TransformPalette;
