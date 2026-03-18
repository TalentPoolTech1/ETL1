import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Pipeline > Code sub-tab — Generated SQL / PySpark code viewer
 */
import { useState, useCallback } from 'react';
import { Copy, Download, RefreshCw, CheckCircle2, Code2 } from 'lucide-react';
import api from '@/services/api';
function CodeBlock({ code, language }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const download = () => {
        const ext = language === 'sql' ? 'sql' : language === 'scala' ? 'scala' : 'py';
        const blob = new Blob([code], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `pipeline_code.${ext}`;
        a.click();
    };
    // Minimal syntax highlighting via regex replacements
    const highlighted = code
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/(#[^\n]*)/g, '<span class="text-slate-500">$1</span>')
        .replace(/\b(def|class|import|from|return|if|else|elif|for|while|with|as|in|not|and|or|True|False|None|SELECT|FROM|WHERE|JOIN|ON|GROUP BY|ORDER BY|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|DROP|WITH|UNION|ALL|DISTINCT)\b/g, '<span class="text-violet-400">$1</span>')
        .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="text-emerald-400">$1</span>')
        .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-400">$1</span>');
    return (_jsxs("div", { className: "flex flex-col flex-1 overflow-hidden border border-slate-800 rounded-lg", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-1.5 bg-[#0a0c15] border-b border-slate-800 flex-shrink-0", children: [_jsx("span", { className: "text-[11px] text-slate-500 font-mono uppercase", children: language }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: copy, className: "flex items-center gap-1 h-6 px-2 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors", children: copied ? _jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "w-3 h-3 text-emerald-400" }), " Copied"] }) : _jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3 h-3" }), " Copy"] }) }), _jsxs("button", { onClick: download, className: "flex items-center gap-1 h-6 px-2 text-[11px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors", children: [_jsx(Download, { className: "w-3 h-3" }), " Download"] })] })] }), _jsx("div", { className: "flex-1 overflow-auto p-4 bg-[#0a0c15]", children: _jsx("pre", { className: "text-[12px] font-mono text-slate-300 whitespace-pre leading-relaxed", dangerouslySetInnerHTML: { __html: highlighted } }) })] }));
}
export function PipelineCodeSubTab({ pipelineId }) {
    const [target, setTarget] = useState('pyspark');
    const [generated, setGenerated] = useState(null);
    const [isGenerating, setGenerating] = useState(false);
    const [error, setError] = useState(null);
    const generate = useCallback(async () => {
        setGenerating(true);
        setError(null);
        try {
            const res = await api.generateCode(pipelineId, { technology: target });
            const d = res.data?.data ?? res.data;
            const content = d.artifact?.files?.[0]?.content ?? d.generatedCode ?? d.code ?? '# No code returned';
            setGenerated({
                language: target,
                code: content,
                generatedAt: new Date().toLocaleString(),
                version: d.version ?? '—',
            });
        }
        catch (err) {
            setError(err?.response?.data?.userMessage ?? 'Code generation failed');
        }
        finally {
            setGenerating(false);
        }
    }, [pipelineId, target]);
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden p-4 gap-3 bg-[#0d0f1a]", children: [_jsxs("div", { className: "flex items-center gap-3 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-[11px] text-slate-500", children: "Target" }), _jsxs("select", { value: target, onChange: e => setTarget(e.target.value), className: "h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500", children: [_jsx("option", { value: "pyspark", children: "PySpark 3.5" }), _jsx("option", { value: "scala", children: "Scala Spark 3.5" }), _jsx("option", { value: "sql", children: "Spark SQL" })] })] }), _jsx("button", { onClick: generate, disabled: isGenerating, className: "flex items-center gap-1.5 h-7 px-3 bg-violet-700 hover:bg-violet-600 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-60", children: isGenerating ? _jsxs(_Fragment, { children: [_jsx(RefreshCw, { className: "w-3 h-3 animate-spin" }), " Generating\u2026"] }) : _jsxs(_Fragment, { children: [_jsx(Code2, { className: "w-3 h-3" }), " Generate Code"] }) }), generated && (_jsxs("span", { className: "text-[11px] text-slate-600", children: ["Generated ", generated.generatedAt, " \u00B7 v", generated.version] }))] }), error && (_jsx("div", { className: "text-[12px] text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2 flex-shrink-0", children: error })), !generated && !error && (_jsxs("div", { className: "flex flex-col items-center justify-center flex-1 text-slate-600", children: [_jsx(Code2, { className: "w-10 h-10 mb-3 opacity-30" }), _jsx("p", { className: "text-sm", children: "Click \"Generate Code\" to produce the Spark code for this pipeline." }), _jsx("p", { className: "text-[11px] mt-1", children: "Code is generated from the current designer canvas. Unsaved changes are not included." })] })), generated && _jsx(CodeBlock, { code: generated.code, language: generated.language })] }));
}
