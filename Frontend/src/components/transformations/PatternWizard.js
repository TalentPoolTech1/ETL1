import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * Pattern Wizard Component
 *
 * Interactive UI for building regular expression patterns with live testing.
 * Helps users construct regex without needing deep regex knowledge.
 *
 * Features:
 * - Template patterns for common use cases
 * - Live test against sample data
 * - Visual highlighting of matches
 * - Capture group selector
 */
import { useState, useMemo } from 'react';
const PATTERN_TEMPLATES = [
    {
        category: 'Common Patterns',
        patterns: [
            {
                label: 'Email address',
                value: '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
                description: 'Extracts email addresses',
            },
            {
                label: 'Phone number (US)',
                value: '(\\d{3}[-.]\\d{3}[-.]\\d{4})',
                description: 'Matches xxx-xxx-xxxx, xxx.xxx.xxxx, or xxxxxxxxxx',
            },
            {
                label: 'URL',
                value: '(https?://[^\\s]+)',
                description: 'Extracts HTTP/HTTPS URLs',
            },
            {
                label: 'Date (MM/DD/YYYY)',
                value: '(\\d{2}/\\d{2}/\\d{4})',
                description: 'Matches MM/DD/YYYY format',
            },
            {
                label: 'Numbers only',
                value: '(\\d+)',
                description: 'Extracts digit sequences',
            },
            {
                label: 'Uppercase letters',
                value: '([A-Z]+)',
                description: 'Extracts all-caps character sequences',
            },
        ],
    },
    {
        category: 'Text Extraction',
        patterns: [
            {
                label: 'Text between markers',
                value: 'START(.*)END',
                description: 'Extract text between START and END',
            },
            {
                label: 'Word after keyword',
                value: 'keyword\\s+([\\w]+)',
                description: 'Get the word following "keyword"',
            },
            {
                label: 'Text in parentheses',
                value: '\\(([^)]+)\\)',
                description: 'Extract content between ( and )',
            },
        ],
    },
];
/**
 * Test a pattern against sample data and return matches
 */
function testPattern(pattern, data, flags) {
    try {
        const regex = new RegExp(pattern, flags);
        return data.map(original => {
            const match = regex.exec(original);
            if (!match) {
                return { original, matches: [], highlighted: original };
            }
            const matches = match.slice(1); // Exclude full match (group 0)
            let highlighted = original;
            // Highlight all groups
            match.slice(1).forEach((group, idx) => {
                if (group) {
                    highlighted = highlighted.replace(group, `<mark class="bg-yellow-200 font-mono">${group}</mark>`);
                }
            });
            return { original, matches, highlighted };
        });
    }
    catch {
        return data.map(original => ({
            original,
            matches: [],
            highlighted: '<span class="text-red-600">Invalid pattern</span>',
        }));
    }
}
/**
 * Pattern Wizard Modal Component
 */
export const PatternWizard = ({ onComplete, sampleData = ['example_value_1', 'test_data', 'sample123'], onCancel, }) => {
    const [step, setStep] = useState('template');
    const [pattern, setPattern] = useState('');
    const [groupIndex, setGroupIndex] = useState(1);
    const [caseInsensitive, setCaseInsensitive] = useState(false);
    const [multiline, setMultiline] = useState(false);
    const [dotMatches, setDotMatches] = useState(false);
    const [useTemplate, setUseTemplate] = useState(false);
    const flags = useMemo(() => {
        let f = '';
        if (caseInsensitive)
            f += 'i';
        if (multiline)
            f += 'm';
        if (dotMatches)
            f += 's';
        return f || 'g';
    }, [caseInsensitive, multiline, dotMatches]);
    const testResults = useMemo(() => {
        if (!pattern)
            return [];
        return testPattern(pattern, sampleData, flags);
    }, [pattern, sampleData, flags]);
    const captureGroupCount = useMemo(() => {
        try {
            const regex = new RegExp(pattern, flags);
            const match = regex.exec(sampleData[0] || 'test');
            return match ? match.length - 1 : 0;
        }
        catch {
            return 0;
        }
    }, [pattern, sampleData, flags]);
    const handleTemplateSelect = (templatePattern) => {
        setPattern(templatePattern);
        setUseTemplate(true);
        setStep('test');
    };
    const handleComplete = () => {
        onComplete({
            pattern,
            groupIndex,
            caseSensitive: !caseInsensitive,
            multiline,
            dotMatchesNewline: dotMatches,
        });
    };
    return (_jsx("div", { className: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50", children: _jsxs("div", { className: "bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 flex flex-col", children: [_jsx("div", { className: "border-b px-6 py-4 flex justify-between items-center", children: _jsxs("h2", { className: "text-lg font-semibold", children: [step === 'template' && 'Choose a Pattern Template', step === 'test' && 'Test Your Pattern', step === 'options' && 'Pattern Options'] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-6", children: [step === 'template' && (_jsxs("div", { className: "space-y-4", children: [PATTERN_TEMPLATES.map((category, idx) => (_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-sm text-gray-700 mb-2", children: category.category }), _jsx("div", { className: "space-y-2", children: category.patterns.map((tmpl, pidx) => (_jsxs("button", { onClick: () => handleTemplateSelect(tmpl.value), className: "w-full text-left p-3 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-500 transition", children: [_jsx("div", { className: "font-medium text-sm", children: tmpl.label }), _jsx("div", { className: "text-xs text-gray-600", children: tmpl.description })] }, pidx))) })] }, idx))), _jsx("div", { className: "border-t pt-4 mt-4", children: _jsx("button", { onClick: () => setStep('test'), className: "w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Or enter a custom pattern \u2192" }) })] })), step === 'test' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Pattern (Regular Expression)" }), _jsx("textarea", { value: pattern, onChange: e => setPattern(e.target.value), placeholder: "Enter regex pattern here", rows: 3, className: "w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" })] }), _jsxs("div", { className: "bg-gray-50 p-4 rounded-md border border-gray-200", children: [_jsx("h4", { className: "font-semibold text-sm mb-3", children: "Live Test Results" }), _jsx("div", { className: "space-y-2 max-h-40 overflow-y-auto", children: testResults.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500", children: "Enter a pattern to see results" })) : (testResults.map((result, idx) => (_jsxs("div", { className: "p-2 bg-white border border-gray-200 rounded text-sm font-mono", children: [_jsx("div", { className: "text-gray-700", children: result.original }), result.matches.length > 0 ? (_jsxs("div", { className: "text-green-600 mt-1", children: ["\u2713 Matches: ", result.matches.map((m, i) => `[${i + 1}]: ${m}`).join(', ')] })) : (_jsx("div", { className: "text-gray-400 mt-1", children: "- No match" }))] }, idx)))) })] }), _jsx("button", { onClick: () => setStep('options'), className: "w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", disabled: !pattern, children: "Next: Configure Options \u2192" })] })), step === 'options' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "bg-blue-50 p-3 rounded-md border border-blue-200", children: [_jsxs("p", { className: "text-sm text-blue-900 font-mono", children: ["Pattern: ", pattern] }), _jsxs("p", { className: "text-xs text-blue-800 mt-1", children: ["Found ", captureGroupCount, " capture group(s)"] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Which capture group to use?" }), _jsx("select", { value: groupIndex, onChange: e => setGroupIndex(Number(e.target.value)), className: "w-full px-3 py-2 border border-gray-300 rounded-md", children: Array.from({ length: Math.max(captureGroupCount, 1) }, (_, i) => (_jsxs("option", { value: i + 1, children: ["Group ", i + 1] }, i + 1))) })] }), _jsxs("div", { className: "space-y-2 border-t pt-4", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: caseInsensitive, onChange: e => setCaseInsensitive(e.target.checked), className: "w-4 h-4 rounded" }), _jsx("span", { className: "text-sm", children: "Case insensitive" })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: multiline, onChange: e => setMultiline(e.target.checked), className: "w-4 h-4 rounded" }), _jsx("span", { className: "text-sm", children: "Multiline mode" })] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: dotMatches, onChange: e => setDotMatches(e.target.checked), className: "w-4 h-4 rounded" }), _jsx("span", { className: "text-sm", children: "Dot matches newline" })] })] })] }))] }), _jsxs("div", { className: "border-t px-6 py-4 flex justify-end gap-2", children: [_jsx("button", { onClick: onCancel, className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "Cancel" }), step !== 'template' && (_jsx("button", { onClick: () => setStep(step === 'test' ? 'template' : 'test'), className: "px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300", children: "\u2190 Back" })), step === 'options' && (_jsx("button", { onClick: handleComplete, className: "px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700", children: "Done" }))] })] }) }));
};
