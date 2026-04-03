/**
 * Pipeline > Code sub-tab — Generated SQL / PySpark code viewer
 */
import React, { useState, useCallback } from 'react';
import { Copy, Download, RefreshCw, CheckCircle2, Code2, Share2 } from 'lucide-react';
import api from '@/services/api';

type CodeLang = 'pyspark' | 'scala' | 'sql';

interface GeneratedCode {
  language: CodeLang;
  code: string;
  generatedAt: string;
  version: string;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
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

  // Syntax highlighting — process line-by-line to avoid cascading regex corruption
  const highlighted = code.split('\n').map(rawLine => {
    const line = rawLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Whole-line comments
    if (/^\s*#/.test(line)) return `\x02comment\x03${line}\x04`;
    // Tokenise with placeholder markers so we never re-process injected HTML
    const tokenised = line
      .replace(/\b(def|class|import|from|return|if|else|elif|for|while|with|as|in|not|and|or|True|False|None|SELECT|FROM|WHERE|JOIN|ON|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|DROP|WITH|UNION|ALL|DISTINCT)\b/g,
        '\x02kw\x03$1\x04')
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '\x02str\x03$1\x04')
      .replace(/\b(\d+\.?\d*)\b/g, '\x02num\x03$1\x04');
    return tokenised;
  }).join('\n')
    .replace(/\x02comment\x03(.*?)\x04/g, '<span class="text-slate-400">$1</span>')
    .replace(/\x02kw\x03(.*?)\x04/g, '<span class="text-violet-400">$1</span>')
    .replace(/\x02str\x03(.*?)\x04/g, '<span class="text-emerald-400">$1</span>')
    .replace(/\x02num\x03(.*?)\x04/g, '<span class="text-amber-400">$1</span>');

  return (
    <div className="flex flex-col flex-1 overflow-hidden border border-slate-800 rounded-lg">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a0c15] border-b border-slate-800 flex-shrink-0">
        <span className="text-[12px] text-slate-300 font-mono uppercase">{language}</span>
        <div className="flex items-center gap-1">
          <button onClick={copy}
            className="flex items-center gap-1 h-6 px-2 text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
            {copied ? <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
          <button onClick={download}
            className="flex items-center gap-1 h-6 px-2 text-[12px] text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors">
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 bg-[#0a0c15]">
        <pre className="text-[12px] font-mono text-slate-300 whitespace-pre leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  );
}

export function PipelineCodeSubTab({ pipelineId }: { pipelineId: string }) {
  const [target, setTarget]         = useState<CodeLang>('pyspark');
  const [generated, setGenerated]   = useState<GeneratedCode | null>(null);
  const [isGenerating, setGenerating] = useState(false);
  const [isExporting, setExporting]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // F-17: Export pipeline IR as JSON download
  const handleExport = useCallback(async (fmt: 'json' | 'yaml') => {
    if (!pipelineId || isExporting) return;
    setExporting(true);
    try {
      const res = await api.exportPipeline(pipelineId, fmt);
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `pipeline.${fmt}` });
      a.click(); URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError((e as any)?.response?.data?.userMessage ?? `Export failed`);
    } finally { setExporting(false); }
  }, [pipelineId, isExporting]);

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
    } catch (err: unknown) {
      setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Code generation failed');
    } finally { setGenerating(false); }
  }, [pipelineId, target]);

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-3 bg-[#0d0f1a]">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-slate-300">Target</label>
          <select value={target} onChange={e => setTarget(e.target.value as CodeLang)}
            className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
            <option value="pyspark">PySpark 3.5</option>
            <option value="scala">Scala Spark 3.5</option>
            <option value="sql">Spark SQL</option>
          </select>
        </div>
        <button onClick={generate} disabled={isGenerating}
          className="flex items-center gap-1.5 h-7 px-3 bg-violet-700 hover:bg-violet-600 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-60">
          {isGenerating ? <><RefreshCw className="w-3 h-3 animate-spin" /> Generating…</> : <><Code2 className="w-3 h-3" /> Generate Code</>}
        </button>
        {generated && (
          <span className="text-[12px] text-slate-400">Generated {generated.generatedAt} · v{generated.version}</span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-slate-400">Export IR:</span>
          <button onClick={() => handleExport('json')} disabled={isExporting}
            className="flex items-center gap-1 h-7 px-2.5 bg-[#1e2035] border border-slate-700 hover:border-slate-500 text-slate-300 rounded text-[12px] transition-colors disabled:opacity-50">
            <Share2 className="w-3 h-3" /> JSON
          </button>
          <button onClick={() => handleExport('yaml')} disabled={isExporting}
            className="flex items-center gap-1 h-7 px-2.5 bg-[#1e2035] border border-slate-700 hover:border-slate-500 text-slate-300 rounded text-[12px] transition-colors disabled:opacity-50">
            <Share2 className="w-3 h-3" /> YAML
          </button>
        </div>
      </div>

      {/* Code output */}
      {error && (
        <div className="text-[12px] text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2 flex-shrink-0">{error}</div>
      )}

      {!generated && !error && (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
          <Code2 className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Click "Generate Code" to produce the Spark code for this pipeline.</p>
          <p className="text-[12px] mt-1">Code is generated from the current designer canvas. Unsaved changes are not included.</p>
        </div>
      )}

      {generated && <CodeBlock code={generated.code} language={generated.language} />}
    </div>
  );
}
