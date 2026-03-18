/**
 * Issue Resolution Banner Component
 *
 * Sticky banner at top that lists incompatibilities and guides users to fixes.
 * Shows which steps have function/compatibility issues and offers one-click navigation.
 */
'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
/**
 * Analyze pipeline for issues
 */
function analyzeIssues(analysis, sequence, functionFilter) {
    const issues = [];
    // Check each segment for ineligibility reasons
    for (const segment of analysis.segments) {
        if (segment.ineligibilityReasons && segment.ineligibilityReasons.length > 0) {
            // Find the actual steps in this segment
            const stepRange = segment.stepRange.match(/(\d+)-?(\d+)?/);
            if (stepRange) {
                const startIdx = parseInt(stepRange[1], 10) - 1;
                const endIdx = stepRange[2] ? parseInt(stepRange[2], 10) - 1 : startIdx;
                for (let i = startIdx; i <= endIdx && i < sequence.steps.length; i++) {
                    const step = sequence.steps[i];
                    for (const reason of segment.ineligibilityReasons) {
                        let issueType = 'incompatible_function';
                        let severity = 'error';
                        if (reason.includes('cross') || reason.includes('source')) {
                            issueType = 'cross_source';
                        }
                        else if (reason.includes('Lineage') || reason.includes('PySpark')) {
                            issueType = 'lineage_break';
                        }
                        else if (reason.includes('not supported') || reason.includes('not natively')) {
                            issueType = 'unsupported_function';
                            severity = reason.includes('alternative') ? 'warning' : 'error';
                        }
                        issues.push({
                            type: issueType,
                            stepId: step.stepId,
                            stepLabel: step.metadata?.label || `${step.type} (${step.stepId})`,
                            severity,
                            message: reason,
                            suggestion: this.getSuggestion(issueType, reason),
                            canAutoFix: issueType !== 'cross_source',
                            fixAction: this.getFix(issueType, segment.sourceTechnologies[0]),
                        });
                    }
                }
            }
        }
    }
    // Detect cross-source joins
    for (const join of analysis.crossSourceJoins) {
        const joinStep = sequence.steps.find(s => s.stepId === join.stepId);
        if (joinStep) {
            issues.push({
                type: 'cross_source',
                stepId: join.stepId,
                stepLabel: joinStep.metadata?.label || `Join (${join.stepId})`,
                severity: 'error',
                message: `Cross-source join detected: joining tables from ${join.tech1} and ${join.tech2}`,
                suggestion: 'Data must be moved to PySpark for joining across sources',
                canAutoFix: true,
                fixAction: {
                    action: 'switch_execution',
                    details: 'Switch this segment to PySpark execution',
                },
            });
        }
    }
    return issues;
}
function getSuggestion(type, reason) {
    switch (type) {
        case 'incompatible_function':
            if (reason.includes('alternative')) {
                return 'Switch to the alternative function or use PySpark execution';
            }
            return 'Switch this step to PySpark execution to enable this function';
        case 'lineage_break':
            return 'This column was computed in PySpark and cannot be referenced in database pushdown. Change earlier steps to PySpark or use a different approach.';
        case 'cross_source':
            return 'Move this join and all dependent operations to PySpark execution for cross-source data combining';
        case 'unsupported_function':
            return 'This function is not available in the source database. Choose a different function or switch to PySpark execution.';
        default:
            return 'Resolve this issue by updating the step configuration';
    }
}
function getFix(type, sourceTech) {
    switch (type) {
        case 'incompatible_function':
            return {
                action: 'switch_execution',
                details: `Switch to ${sourceTech || 'source'} compatible function or use PySpark`,
            };
        case 'cross_source':
            return {
                action: 'switch_execution',
                details: 'Switch this segment to PySpark execution',
            };
        case 'lineage_break':
            return {
                action: 'switch_execution',
                details: 'Move upstream step to source DB execution if possible',
            };
        default:
            return undefined;
    }
}
/**
 * Issue card component
 */
function IssueCard({ issue, onNavigate, }) {
    const severityColor = issue.severity === 'error'
        ? 'bg-red-50 border-red-200 text-red-900'
        : 'bg-amber-50 border-amber-200 text-amber-900';
    const iconColor = issue.severity === 'error' ? 'text-red-600' : 'text-amber-600';
    return (_jsxs("div", { className: `flex gap-3 p-3 border rounded-lg ${severityColor} mb-2 last:mb-0`, children: [_jsx(AlertTriangle, { className: `w-5 h-5 flex-shrink-0 ${iconColor} mt-0.5` }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h4", { className: "font-medium text-sm mb-1", children: issue.stepLabel }), _jsx("p", { className: "text-sm opacity-90 mb-2", children: issue.message }), _jsx("p", { className: "text-xs opacity-75 mb-2", children: issue.suggestion }), _jsxs("button", { onClick: () => onNavigate(issue.stepId), className: `
            inline-flex items-center gap-1 text-xs font-medium
            px-2 py-1 rounded transition-colors
            ${issue.severity === 'error'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}
          `, children: ["Go to step ", _jsx(ChevronRight, { className: "w-3 h-3" })] })] })] }));
}
/**
 * Issue Resolution Banner Component
 */
export function IssueResolutionBanner({ analysis, sequence, isVisible = true, onDismiss, onNavigate, functionFilter, }) {
    const issues = useMemo(() => {
        return analyzeIssues(analysis, sequence, functionFilter);
    }, [analysis, sequence, functionFilter]);
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    if (!isVisible || issues.length === 0) {
        return null;
    }
    return (_jsx("div", { className: "fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-lg", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 py-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(AlertTriangle, { className: "w-5 h-5 text-red-600" }), _jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900", children: "Pipeline Issues Detected" }), _jsxs("p", { className: "text-sm text-gray-500 mt-0.5", children: [errorCount > 0 && (_jsxs("span", { children: [_jsxs("span", { className: "font-medium text-red-600", children: [errorCount, " error", errorCount !== 1 ? 's' : ''] }), warningCount > 0 && _jsx("span", { children: " \u00B7 " })] })), warningCount > 0 && (_jsx("span", { children: _jsxs("span", { className: "font-medium text-amber-600", children: [warningCount, " warning", warningCount !== 1 ? 's' : ''] }) }))] })] })] }), onDismiss && (_jsx("button", { onClick: onDismiss, className: "text-gray-400 hover:text-gray-600 transition-colors", "aria-label": "Dismiss", children: _jsx(X, { className: "w-5 h-5" }) }))] }), _jsx("div", { className: "bg-gray-50 rounded-lg p-3 mb-3 max-h-48 overflow-y-auto", children: issues.map((issue, idx) => (_jsx(IssueCard, { issue: issue, onNavigate: onNavigate || (() => { }) }, idx))) }), _jsxs("div", { className: "flex gap-2 text-sm", children: [errorCount > 0 && (_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "inline-block px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 font-medium", children: ["\u26A0 ", errorCount, " issue", errorCount !== 1 ? 's' : '', " must be resolved before generating code"] }) })), warningCount > 0 && errorCount === 0 && (_jsx("div", { className: "flex-1", children: _jsxs("div", { className: "inline-block px-3 py-2 bg-amber-50 border border-amber-200 rounded text-amber-700 font-medium", children: ["\u2139 ", warningCount, " warning", warningCount !== 1 ? 's' : '', " \u2014 review before generating code"] }) }))] })] }) }));
}
export default IssueResolutionBanner;
