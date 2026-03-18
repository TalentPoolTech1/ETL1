/**
 * Execution Point Panel Component
 *
 * Displays segment eligibility, allows users to switch execution points,
 * and shows impact preview before changes.
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { ChevronRight, Lock, AlertCircle, Zap, Database, SlackIcon as Spark, } from 'lucide-react';
/**
 * Execution Point choice button
 */
function ExecutionPointButton({ point, isSelected, isForcedLocked, onClick, disabled, }) {
    const getButtonContent = () => {
        switch (point) {
            case 'source':
                return {
                    icon: _jsx(Database, { className: "w-4 h-4" }),
                    label: 'Source DB',
                    desc: 'Execute in source database (fast)',
                };
            case 'pyspark':
                return {
                    icon: _jsx(Spark, { className: "w-4 h-4" }),
                    label: 'PySpark',
                    desc: 'Execute in PySpark cluster (flexible)',
                };
            case 'forced_pyspark':
                return {
                    icon: _jsx(Lock, { className: "w-4 h-4" }),
                    label: 'Locked (PySpark)',
                    desc: 'Cannot be changed',
                };
        }
    };
    const content = getButtonContent();
    return (_jsxs("button", { onClick: onClick, disabled: disabled || isForcedLocked, className: `
        flex-1 p-3 rounded-lg border-2 transition-all
        flex flex-col items-center gap-1 text-sm
        ${isSelected
            ? 'border-blue-500 bg-blue-50 text-blue-900'
            : disabled || isForcedLocked
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'}
      `, children: [content.icon, _jsx("div", { className: "font-medium", children: content.label }), _jsx("div", { className: "text-xs text-gray-500", children: content.desc })] }));
}
/**
 * Impact preview card
 */
function ImpactPreview({ impact, onConfirm, onCancel, }) {
    return (_jsxs("div", { className: "mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg", children: [_jsxs("div", { className: "flex items-start gap-3 mb-3", children: [_jsx(AlertCircle, { className: "w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" }), _jsxs("div", { children: [_jsx("h4", { className: "font-medium text-amber-900", children: "Impact Preview" }), _jsx("p", { className: "text-sm text-amber-800 mt-1", children: impact.dataMovementRequired
                                    ? 'This change will require moving data from source to PySpark cluster.'
                                    : 'Review the changes below before confirming.' })] })] }), impact.affectedSteps.length > 0 && (_jsxs("div", { className: "mb-3 p-2 bg-white rounded border border-amber-100", children: [_jsx("div", { className: "text-sm font-medium text-gray-700 mb-2", children: "Affected steps:" }), _jsx("ul", { className: "text-sm text-gray-600 space-y-1", children: impact.affectedSteps.map((stepId, idx) => (_jsxs("li", { className: "pl-4 flex items-center gap-2", children: [_jsx(ChevronRight, { className: "w-3 h-3" }), stepId] }, idx))) })] })), impact.warnings.length > 0 && (_jsxs("div", { className: "mb-3 p-2 bg-white rounded border border-amber-100", children: [_jsx("div", { className: "text-sm font-medium text-gray-700 mb-2", children: "Warnings:" }), _jsx("ul", { className: "text-sm text-amber-700 space-y-1", children: impact.warnings.map((warning, idx) => (_jsxs("li", { className: "pl-4 flex items-center gap-2", children: [_jsx("span", { className: "text-amber-500", children: "\u26A0" }), warning] }, idx))) })] })), impact.estimatedPerformanceImpact && (_jsxs("div", { className: "mb-3 p-2 bg-white rounded border border-amber-100", children: [_jsx("div", { className: "text-sm font-medium text-gray-700 mb-1", children: "Performance impact:" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Zap, { className: `w-4 h-4 ${impact.estimatedPerformanceImpact === 'high'
                                    ? 'text-red-500'
                                    : impact.estimatedPerformanceImpact === 'medium'
                                        ? 'text-amber-500'
                                        : 'text-green-500'}` }), _jsx("span", { className: "text-sm text-gray-600", children: impact.estimatedPerformanceImpact })] })] })), _jsxs("div", { className: "flex gap-2 pt-3 border-t border-amber-100", children: [_jsx("button", { onClick: onConfirm, className: "flex-1 px-3 py-2 bg-amber-600 text-white text-sm font-medium rounded hover:bg-amber-700 transition-colors", children: "Confirm Change" }), _jsx("button", { onClick: onCancel, className: "flex-1 px-3 py-2 bg-white border border-amber-200 text-amber-700 text-sm font-medium rounded hover:bg-amber-50 transition-colors", children: "Cancel" })] })] }));
}
/**
 * Segment eligibility card
 */
function SegmentCard({ segment, currentExecutionPoint, onExecutionPointChange, stateManager, sequence, }) {
    const [previewPoint, setPreviewPoint] = useState(null);
    const [showImpact, setShowImpact] = useState(false);
    const previewImpact = useMemo(() => {
        if (!previewPoint)
            return null;
        return stateManager.previewSwitch(segment.segmentId, previewPoint, sequence);
    }, [previewPoint]);
    const handlePointSelect = (point) => {
        if (currentExecutionPoint === 'forced_pyspark') {
            // Can't change forced
            return;
        }
        setPreviewPoint(point);
        setShowImpact(true);
    };
    const handleConfirmChange = () => {
        if (previewPoint && previewImpact?.valid) {
            onExecutionPointChange(previewPoint);
            setShowImpact(false);
            setPreviewPoint(null);
        }
    };
    return (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4 mb-4", children: [_jsxs("div", { className: "flex items-start justify-between mb-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: segment.stepRange }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: segment.sourceTechnologies.join(', ') || 'Unknown source' })] }), _jsx("div", { className: "flex items-center gap-2", children: segment.eligible ? (_jsx("span", { className: "inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded", children: "\u2713 Eligible" })) : (_jsx("span", { className: "inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded", children: "\u2717 Not eligible" })) })] }), segment.reasons.length > 0 && (_jsxs("div", { className: "mb-3 p-2 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800", children: [_jsx("div", { className: "font-medium mb-1", children: "Why this is eligible:" }), _jsx("ul", { className: "list-disc list-inside space-y-0.5", children: segment.reasons.map((reason, idx) => (_jsx("li", { children: reason }, idx))) })] })), segment.ineligibilityReasons && segment.ineligibilityReasons.length > 0 && (_jsxs("div", { className: "mb-3 p-2 bg-red-50 border border-red-100 rounded text-sm text-red-800", children: [_jsx("div", { className: "font-medium mb-1", children: "Why it cannot be pushed down:" }), _jsx("ul", { className: "list-disc list-inside space-y-0.5", children: segment.ineligibilityReasons.map((reason, idx) => (_jsx("li", { children: reason }, idx))) })] })), _jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Execution Point:" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(ExecutionPointButton, { point: "source", isSelected: currentExecutionPoint === 'source', isForcedLocked: currentExecutionPoint === 'forced_pyspark', onClick: () => handlePointSelect('source'), disabled: !segment.eligible }), _jsx(ExecutionPointButton, { point: "pyspark", isSelected: currentExecutionPoint === 'pyspark', isForcedLocked: currentExecutionPoint === 'forced_pyspark', onClick: () => handlePointSelect('pyspark'), disabled: false }), currentExecutionPoint === 'forced_pyspark' && (_jsx(ExecutionPointButton, { point: "forced_pyspark", isSelected: true, isForcedLocked: true, onClick: () => { }, disabled: true }))] })] }), segment.affectedColumns.length > 0 && (_jsxs("div", { className: "mb-3 text-sm", children: [_jsx("div", { className: "font-medium text-gray-700 mb-1", children: "Affected columns:" }), _jsxs("div", { className: "flex flex-wrap gap-1", children: [segment.affectedColumns.slice(0, 5).map((col, idx) => (_jsx("span", { className: "px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded font-mono", children: col }, idx))), segment.affectedColumns.length > 5 && (_jsxs("span", { className: "px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded", children: ["+", segment.affectedColumns.length - 5, " more"] }))] })] })), showImpact && previewImpact && (_jsx(ImpactPreview, { impact: previewImpact, onConfirm: handleConfirmChange, onCancel: () => {
                    setShowImpact(false);
                    setPreviewPoint(null);
                } }))] }));
}
/**
 * Execution Point Panel Component
 */
export function ExecutionPointPanel({ analysis, stateManager, sequence, onExecutionPointChange, isOpen = true, onClose, }) {
    const summary = stateManager.getSummary();
    if (!isOpen) {
        return null;
    }
    return (_jsxs("div", { className: "w-96 border-l border-gray-200 bg-white overflow-y-auto", children: [_jsxs("div", { className: "sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-bold text-gray-900", children: "Execution Strategy" }), _jsx("p", { className: "text-sm text-gray-500 mt-1", children: "Configure where each segment executes" })] }), onClose && (_jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-gray-600", children: "\u2715" }))] }), _jsx("div", { className: "p-4 bg-gray-50 border-b border-gray-200", children: _jsxs("div", { className: "grid grid-cols-3 gap-2 text-center", children: [_jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: summary.pushdownCount }), _jsx("div", { className: "text-xs text-gray-600", children: "Source DB" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-amber-600", children: summary.pysparkCount }), _jsx("div", { className: "text-xs text-gray-600", children: "PySpark" })] }), _jsxs("div", { children: [_jsx("div", { className: "text-2xl font-bold text-red-600", children: summary.forcedCount }), _jsx("div", { className: "text-xs text-gray-600", children: "Locked" })] })] }) }), _jsx("div", { className: "p-4 space-y-4", children: analysis.segments.map((segment) => {
                    const currentPoint = stateManager.getExecutionPoint(segment.segmentId);
                    return (_jsx(SegmentCard, { segment: segment, currentExecutionPoint: currentPoint, onExecutionPointChange: (newPoint) => {
                            const result = stateManager.applyExecutionPointChange(segment.segmentId, newPoint, sequence);
                            if (result.success && onExecutionPointChange) {
                                onExecutionPointChange(segment.segmentId, newPoint);
                            }
                        }, stateManager: stateManager, sequence: sequence }, segment.segmentId));
                }) }), _jsx("div", { className: "sticky bottom-0 p-4 border-t border-gray-200 bg-gray-50", children: _jsx("button", { onClick: () => {
                        const config = stateManager.exportConfiguration();
                        console.log('Exported execution point configuration:', config);
                    }, className: "w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors", children: "Export Configuration" }) })] }));
}
export default ExecutionPointPanel;
