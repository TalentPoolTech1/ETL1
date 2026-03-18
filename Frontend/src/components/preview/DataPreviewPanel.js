import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';
import api from '@/services/api';
const ITEM_HEIGHT = 32;
const VISIBLE_ITEMS = 15;
export function DataPreviewPanel() {
    const selectedNodeIds = useAppSelector(s => s.pipeline.selectedNodeIds);
    const selectedNodeId = selectedNodeIds[0] ?? null;
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState(null);
    const [filterText, setFilterText] = useState('');
    const [scrollTop, setScrollTop] = useState(0);
    const [showExportModal, setShowExportModal] = useState(false);
    const scrollContainerRef = useRef(null);
    const loadPreview = useCallback(async () => {
        if (!selectedNodeId)
            return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.getPreview(selectedNodeId, { limit: 1000 });
            const data = res.data.data ?? res.data;
            setRows(data.rows ?? data ?? []);
        }
        catch (err) {
            setError(err?.response?.data?.userMessage ?? 'Failed to load preview');
            setRows([]);
        }
        finally {
            setLoading(false);
        }
    }, [selectedNodeId]);
    useEffect(() => {
        if (selectedNodeId)
            loadPreview();
        else
            setRows([]);
    }, [selectedNodeId, loadPreview]);
    const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const filteredData = useMemo(() => {
        let result = [...rows];
        if (filterText) {
            result = result.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(filterText.toLowerCase())));
        }
        if (sortBy) {
            result.sort((a, b) => {
                const aVal = a[sortBy.column];
                const bVal = b[sortBy.column];
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortBy.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                const na = Number(aVal), nb = Number(bVal);
                return sortBy.direction === 'asc' ? na - nb : nb - na;
            });
        }
        return result;
    }, [rows, sortBy, filterText]);
    const startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
    const endIndex = startIndex + VISIBLE_ITEMS;
    const visibleData = filteredData.slice(startIndex, endIndex);
    const offsetY = startIndex * ITEM_HEIGHT;
    const handleScroll = (e) => {
        setScrollTop(e.target.scrollTop);
    };
    const handleColumnSort = (col) => {
        setSortBy(prev => prev?.column === col
            ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
            : { column: col, direction: 'asc' });
    };
    const exportData = (format) => {
        let content = '';
        if (format === 'csv') {
            content = [allColumns.join(','), ...filteredData.map(row => allColumns.map(col => String(row[col] ?? '')).join(','))].join('\n');
        }
        else {
            content = JSON.stringify(filteredData, null, 2);
        }
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `preview.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        setShowExportModal(false);
    };
    return (_jsxs("div", { className: "h-full bg-white border-t border-neutral-200 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "h-10 border-b border-neutral-200 flex items-center justify-between px-4 bg-neutral-50 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h3", { className: "text-sm font-medium text-neutral-900", children: "Data Preview" }), selectedNodeId && (_jsx("div", { className: "text-xs text-neutral-500", children: loading ? 'Loading…' : error ? _jsx("span", { className: "text-red-500", children: error }) : `${filteredData.length} rows` })), !selectedNodeId && _jsx("div", { className: "text-xs text-neutral-400", children: "Select a node to preview data" })] }), _jsx("div", { className: "flex items-center gap-2", children: selectedNodeId && (_jsxs(_Fragment, { children: [_jsx("input", { type: "text", placeholder: "Search\u2026", value: filterText, onChange: e => setFilterText(e.target.value), className: "px-2 py-1 border border-neutral-300 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-primary-400" }), _jsx("button", { onClick: loadPreview, title: "Refresh", className: "text-xs text-neutral-500 hover:text-neutral-700", children: "\u27F3" }), _jsx("button", { onClick: () => setShowExportModal(true), title: "Export", className: "text-xs text-neutral-500 hover:text-neutral-700", children: "\uD83D\uDCE5" })] })) })] }), !selectedNodeId && (_jsx("div", { className: "flex-1 flex items-center justify-center text-neutral-400 text-sm", children: "Select a canvas node to preview its output data." })), selectedNodeId && loading && (_jsx("div", { className: "flex-1 flex items-center justify-center text-neutral-400 text-sm", children: "Loading preview\u2026" })), selectedNodeId && !loading && error && (_jsx("div", { className: "flex-1 flex items-center justify-center text-red-400 text-sm", children: error })), selectedNodeId && !loading && !error && rows.length === 0 && (_jsx("div", { className: "flex-1 flex items-center justify-center text-neutral-400 text-sm", children: "No preview data available for this node." })), selectedNodeId && !loading && !error && rows.length > 0 && (_jsxs("div", { className: "flex-1 overflow-hidden flex flex-col", children: [_jsx("div", { className: "bg-neutral-50 border-b border-neutral-200 flex h-8 flex-shrink-0", children: allColumns.map(col => (_jsxs("div", { className: "flex-1 min-w-32 px-4 py-1.5 text-left text-xs font-semibold text-neutral-700 border-r border-neutral-200 flex items-center cursor-pointer hover:bg-neutral-100", onClick: () => handleColumnSort(col), children: [_jsx("span", { children: col }), _jsx("span", { className: "ml-1 text-neutral-400", children: sortBy?.column === col ? (sortBy.direction === 'asc' ? '▲' : '▼') : '' })] }, col))) }), _jsx("div", { ref: scrollContainerRef, onScroll: handleScroll, className: "flex-1 overflow-y-auto", style: { height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px` }, children: _jsx("div", { style: { height: `${filteredData.length * ITEM_HEIGHT}px`, position: 'relative' }, children: _jsx("div", { style: { transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, right: 0 }, children: visibleData.map((row, idx) => (_jsx("div", { className: "flex h-8 border-b border-neutral-100 hover:bg-neutral-50", children: allColumns.map(col => (_jsx("div", { className: "flex-1 min-w-32 px-4 py-1.5 text-xs text-neutral-700 border-r border-neutral-100 overflow-hidden text-ellipsis whitespace-nowrap", children: String(row[col] ?? '').substring(0, 80) }, col))) }, startIndex + idx))) }) }) })] })), showExportModal && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-lg p-6 w-80", children: [_jsx("h3", { className: "text-base font-semibold text-neutral-900 mb-4", children: "Export Preview Data" }), _jsxs("div", { className: "space-y-2 mb-4", children: [_jsx("button", { onClick: () => exportData('csv'), className: "w-full px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700", children: "\uD83D\uDCC4 Export as CSV" }), _jsxs("button", { onClick: () => exportData('json'), className: "w-full px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700", children: ['{ }', " Export as JSON"] })] }), _jsx("button", { onClick: () => setShowExportModal(false), className: "w-full px-4 py-2 bg-neutral-200 text-neutral-900 rounded-md text-sm hover:bg-neutral-300", children: "Cancel" })] }) }))] }));
}
