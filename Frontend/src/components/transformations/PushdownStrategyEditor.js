/**
 * Pushdown Strategy Integration Example
 *
 * Complete example showing how to integrate all push-down components:
 * - Eligibility analysis
 * - Execution point selection
 * - Function availability filtering
 * - Issue resolution
 *
 * This demonstrates the intended usage pattern for the entire system.
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Triangle, BarChart3, AlertCircle, Settings, } from 'lucide-react';
// Pushdown components
import { ExecutionPointPanel } from './pushdown/ExecutionPointPanel';
import { IssueResolutionBanner } from './pushdown/IssueResolutionBanner';
import { TransformPalette } from './pushdown/TransformPalette';
// Hooks
import { usePushdownStrategy } from '../../hooks/usePushdownStrategy';
/**
 * Integration example: Complete pushdown strategy editor
 */
export function PushdownStrategyEditor({ sequence, sourceTables, onStrategyChange, }) {
    const pushdown = usePushdownStrategy();
    const [panelOpen, setPanelOpen] = useState(true);
    const [selectedStep, setSelectedStep] = useState(null);
    const [bannerVisible, setBannerVisible] = useState(true);
    // Analyze on mount or when input changes
    useEffect(() => {
        pushdown.analyzeEligibility(sourceTables, sequence);
    }, [sequence, sourceTables]);
    // Notify parent of changes
    useEffect(() => {
        if (onStrategyChange && pushdown.state.analysis) {
            onStrategyChange(pushdown.exportStrategy());
        }
    }, [pushdown.state.analysis, pushdown.state.executionPoints]);
    const issueCount = pushdown.getIssueCount();
    const functionPalette = selectedStep ? pushdown.getFunctionPalette(selectedStep) : null;
    if (pushdown.state.isAnalyzing) {
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsxs("div", { className: "text-center", children: [_jsx(Triangle, { className: "w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" }), _jsx("p", { className: "text-gray-600", children: "Analyzing pushdown eligibility..." })] }) }));
    }
    if (!pushdown.state.analysis) {
        return (_jsxs("div", { className: "p-6 text-center bg-gray-50 rounded-lg", children: [_jsx(AlertCircle, { className: "w-8 h-8 text-gray-400 mx-auto mb-2" }), _jsx("p", { className: "text-gray-600", children: "Select a pipeline to analyze push-down eligibility" })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full bg-white", children: [bannerVisible && pushdown.hasIssues() && (_jsx(IssueResolutionBanner, { analysis: pushdown.state.analysis, sequence: sequence, isVisible: bannerVisible, onDismiss: () => setBannerVisible(false), onNavigate: (stepId) => setSelectedStep(stepId), functionFilter: pushdown.functionFilter })), _jsxs("div", { className: "flex-1 flex gap-4 p-6 overflow-hidden", children: [_jsxs("div", { className: "flex-1 flex flex-col gap-6 overflow-y-auto", children: [_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(BarChart3, { className: "w-5 h-5 text-blue-600" }), _jsx("h2", { className: "font-bold text-gray-900", children: "Pipeline Segments" })] }), _jsx("div", { className: "space-y-2", children: pushdown.state.analysis.segments.map((segment) => {
                                            const execPoint = pushdown.executionPointManager.getExecutionPoint(segment.segmentId);
                                            const color = execPoint === 'source'
                                                ? 'bg-blue-50 border-blue-200'
                                                : execPoint === 'pyspark'
                                                    ? 'bg-amber-50 border-amber-200'
                                                    : 'bg-red-50 border-red-200';
                                            return (_jsxs("div", { className: `p-3 border rounded-lg cursor-pointer transition-all ${color}`, children: [_jsx("div", { className: "font-medium text-gray-900", children: segment.stepRange }), _jsx("div", { className: "text-sm text-gray-600 mt-1", children: segment.sourceTechnologies.join(', ') }), _jsxs("div", { className: "mt-2 flex items-center gap-2 text-xs", children: [_jsx("span", { className: `px-2 py-1 rounded font-medium ${segment.eligible
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-red-100 text-red-700'}`, children: segment.eligible ? '✓ Eligible' : '✗ Not eligible' }), _jsx("span", { className: "text-gray-500", children: execPoint === 'source' ? '🔵 Pushdown' : '🟠 PySpark' })] })] }, segment.segmentId));
                                        }) })] }), selectedStep && functionPalette && (_jsxs("div", { className: "bg-white border border-gray-200 rounded-lg p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx(Settings, { className: "w-5 h-5 text-amber-600" }), _jsx("h2", { className: "font-bold text-gray-900", children: "Function Availability" })] }), _jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["Selected step: ", _jsx("span", { className: "font-medium", children: selectedStep })] }), _jsx(TransformPalette, { sourceTechnology: functionPalette.sourceTechnology, executionPoint: functionPalette.executionPoint, onSelectFunction: (funcId) => {
                                            console.log('Selected function:', funcId, 'for step:', selectedStep);
                                        }, filter: pushdown.functionFilter, allowUnavailable: functionPalette.executionPoint === 'pyspark' })] }))] }), panelOpen && (_jsx(ExecutionPointPanel, { analysis: pushdown.state.analysis, stateManager: pushdown.executionPointManager, sequence: sequence, onExecutionPointChange: (stepId, newPoint) => {
                            pushdown.changeExecutionPoint(stepId, newPoint);
                        }, isOpen: panelOpen, onClose: () => setPanelOpen(false) }))] }), _jsxs("div", { className: "border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("button", { onClick: () => setPanelOpen(!panelOpen), className: "px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors", children: [panelOpen ? 'Hide' : 'Show', " Execution Strategy"] }), pushdown.hasIssues() && (_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 text-sm rounded", children: [_jsx(AlertCircle, { className: "w-4 h-4" }), _jsxs("span", { className: "font-medium", children: [issueCount, " issue(s)"] })] }))] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => pushdown.reset(), className: "px-4 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-medium rounded hover:bg-gray-50 transition-colors", children: "Reset" }), _jsx("button", { onClick: () => {
                                    const config = pushdown.exportStrategy();
                                    console.log('Exported strategy:', config);
                                    // In a real app, you'd save this to the backend
                                }, disabled: !pushdown.state.isValid, className: "px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors", children: "Export Strategy" })] })] })] }));
}
export default PushdownStrategyEditor;
