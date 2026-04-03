/**
 * PipelineCanvas — Enterprise-grade dark-theme pipeline designer.
 * SVG canvas with typed nodes, bezier edges, zoom/pan, drag-to-connect.
 * Double-clicking a node opens the NodeConfigPanel.
 *
 * BUG-005 FIXED: Fit button now calculates node bounds and fits to viewport.
 * BUG-006 FIXED: Drag dispatches buffered via requestAnimationFrame — no per-mousemove Redux dispatch.
 */
import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  addNode, selectNode, clearSelection, updateNode, addEdge, deleteEdge, deleteNode,
  undo, redo, copySelected, pasteClipboard,
} from '@/store/slices/pipelineSlice';
import type { Node, Edge } from '@/types';
import { v4 as uuid } from 'uuid';
import api from '@/services/api';

// ─── Node visual config ───────────────────────────────────────────────────────
const NODE_W = 220;
const NODE_H = 72;
const HEADER_H = 22;
const PORT_R = 7;

interface NodeMeta {
  label: string;
  headerColor: string;
  bodyColor: string;
  borderColor: string;
  icon: string;
  portColor: string;
}
const NODE_META: Record<string, NodeMeta> = {
  source:    { label: 'Source',     headerColor: '#1e40af', bodyColor: '#1e2a4a', borderColor: '#60a5fa', icon: '⬇', portColor: '#60a5fa' },
  target:    { label: 'Target',     headerColor: '#166534', bodyColor: '#1a3326', borderColor: '#4ade80', icon: '⬆', portColor: '#4ade80' },
  transform: { label: 'Transform',  headerColor: '#b45309', bodyColor: '#2e2010', borderColor: '#fbbf24', icon: '⚙', portColor: '#fbbf24' },
  filter:    { label: 'Filter',     headerColor: '#c2410c', bodyColor: '#2e1a0f', borderColor: '#fb923c', icon: '⊘', portColor: '#fb923c' },
  join:      { label: 'Join',       headerColor: '#6d28d9', bodyColor: '#251a3e', borderColor: '#c084fc', icon: '⋈', portColor: '#c084fc' },
  aggregate: { label: 'Aggregate',  headerColor: '#0e7490', bodyColor: '#0e2630', borderColor: '#22d3ee', icon: 'Σ', portColor: '#22d3ee' },
  union:     { label: 'Union',      headerColor: '#0369a1', bodyColor: '#0f2035', borderColor: '#38bdf8', icon: '∪', portColor: '#38bdf8' },
  custom_sql:    { label: 'Custom SQL',    headerColor: '#7e22ce', bodyColor: '#21133a', borderColor: '#e879f9', icon: '⌨', portColor: '#e879f9' },
  scd1:          { label: 'SCD Type 1',   headerColor: '#9f1239', bodyColor: '#2e0f1e', borderColor: '#fb7185', icon: 'S1', portColor: '#fb7185' },
  scd2:          { label: 'SCD Type 2',   headerColor: '#881337', bodyColor: '#2e0f18', borderColor: '#f43f5e', icon: 'S2', portColor: '#f43f5e' },
  window:        { label: 'Window',       headerColor: '#1d4ed8', bodyColor: '#0f1e3a', borderColor: '#818cf8', icon: '⊡', portColor: '#818cf8' },
  select:        { label: 'Select',       headerColor: '#065f46', bodyColor: '#0d2820', borderColor: '#34d399', icon: '☑', portColor: '#34d399' },
  cast_rename_drop: { label: 'Cast/Rename', headerColor: '#78350f', bodyColor: '#2a1a08', borderColor: '#fcd34d', icon: '↔', portColor: '#fcd34d' },
  derive:        { label: 'Derive',       headerColor: '#4c1d95', bodyColor: '#1e1038', borderColor: '#a78bfa', icon: 'ƒ', portColor: '#a78bfa' },
  pivot:         { label: 'Pivot',        headerColor: '#164e63', bodyColor: '#0a2030', borderColor: '#67e8f9', icon: '⊞', portColor: '#67e8f9' },
  data_quality:  { label: 'Data Quality', headerColor: '#14532d', bodyColor: '#0a2218', borderColor: '#86efac', icon: '✓', portColor: '#86efac' },
  mask:          { label: 'Mask',         headerColor: '#1e1b4b', bodyColor: '#0f0e28', borderColor: '#6366f1', icon: '◉', portColor: '#6366f1' },
  lookup:        { label: 'Lookup',       headerColor: '#0c4a6e', bodyColor: '#071c2a', borderColor: '#7dd3fc', icon: '⌕', portColor: '#7dd3fc' },
  surrogate_key: { label: 'Surrogate Key',headerColor: '#422006', bodyColor: '#1c0f03', borderColor: '#fdba74', icon: '⚷', portColor: '#fdba74' },
  case_when:     { label: 'Case/When',    headerColor: '#365314', bodyColor: '#172008', borderColor: '#a3e635', icon: '?:', portColor: '#a3e635' },
  dedup:         { label: 'Dedup',        headerColor: '#44403c', bodyColor: '#1c1917', borderColor: '#a8a29e', icon: '⊟', portColor: '#a8a29e' },
  sort:          { label: 'Sort',         headerColor: '#44403c', bodyColor: '#1c1917', borderColor: '#d6d3d1', icon: '↕', portColor: '#d6d3d1' },
  limit:         { label: 'Limit',        headerColor: '#44403c', bodyColor: '#1c1917', borderColor: '#e7e5e4', icon: '⊣', portColor: '#e7e5e4' },
  sample:        { label: 'Sample',       headerColor: '#44403c', bodyColor: '#1c1917', borderColor: '#78716c', icon: '⊂', portColor: '#78716c' },
  cache:         { label: 'Cache',        headerColor: '#134e4a', bodyColor: '#0a2220', borderColor: '#2dd4bf', icon: '⚡', portColor: '#2dd4bf' },
  repartition:   { label: 'Repartition',  headerColor: '#134e4a', bodyColor: '#0a2220', borderColor: '#5eead4', icon: '⊗', portColor: '#5eead4' },
  fillna:        { label: 'Fill NA',      headerColor: '#1e3a5f', bodyColor: '#0e1e30', borderColor: '#93c5fd', icon: '∅→', portColor: '#93c5fd' },
  dropna:        { label: 'Drop NA',      headerColor: '#1e3a5f', bodyColor: '#0e1e30', borderColor: '#60a5fa', icon: '∅✗', portColor: '#60a5fa' },
};
const defaultMeta: NodeMeta = { label: 'Node', headerColor: '#475569', bodyColor: '#252836', borderColor: '#94a3b8', icon: '◆', portColor: '#94a3b8' };
const getMeta = (type: string): NodeMeta => NODE_META[type] ?? defaultMeta;

// ─── Toolbar node types ───────────────────────────────────────────────────────
const TOOLBAR_NODES: Array<{ type: Node['type']; label: string; icon: string; color: string }> = [
  { type: 'source',     label: 'Source',     icon: '⬇', color: '#60a5fa' },
  { type: 'target',     label: 'Target',     icon: '⬆', color: '#4ade80' },
  { type: 'transform',  label: 'Transform',  icon: '⚙', color: '#fbbf24' },
  { type: 'filter',     label: 'Filter',     icon: '⊘', color: '#fb923c' },
  { type: 'join',       label: 'Join',       icon: '⋈', color: '#c084fc' },
  { type: 'aggregate',  label: 'Aggregate',  icon: 'Σ',  color: '#22d3ee' },
  { type: 'union',      label: 'Union',      icon: '∪',  color: '#38bdf8' },
  { type: 'custom_sql',         label: 'SQL',        icon: '⌨', color: '#e879f9' },
  { type: 'scd1',             label: 'SCD 1',       icon: 'S1', color: '#fb7185' },
  { type: 'scd2',             label: 'SCD 2',       icon: 'S2', color: '#f43f5e' },
  { type: 'window',           label: 'Window',      icon: '⊡', color: '#818cf8' },
  { type: 'select',           label: 'Select',      icon: '☑', color: '#34d399' },
  { type: 'cast_rename_drop', label: 'Cast/Rename', icon: '↔', color: '#fcd34d' },
  { type: 'derive',           label: 'Derive',      icon: 'ƒ', color: '#a78bfa' },
  { type: 'pivot',            label: 'Pivot',       icon: '⊞', color: '#67e8f9' },
  { type: 'data_quality',     label: 'DQ',          icon: '✓', color: '#86efac' },
  { type: 'mask',             label: 'Mask',        icon: '◉', color: '#6366f1' },
  { type: 'lookup',           label: 'Lookup',      icon: '⌕', color: '#7dd3fc' },
  { type: 'surrogate_key',    label: 'Surr. Key',   icon: '⚷', color: '#fdba74' },
  { type: 'case_when',        label: 'Case/When',   icon: '?:', color: '#a3e635' },
  { type: 'dedup',            label: 'Dedup',       icon: '⊟', color: '#a8a29e' },
  { type: 'sort',             label: 'Sort',        icon: '↕', color: '#d6d3d1' },
  { type: 'limit',            label: 'Limit',       icon: '⊣', color: '#e7e5e4' },
  { type: 'sample',           label: 'Sample',      icon: '⊂', color: '#78716c' },
  { type: 'cache',            label: 'Cache',       icon: '⚡', color: '#2dd4bf' },
  { type: 'repartition',      label: 'Repartition', icon: '⊗', color: '#5eead4' },
  { type: 'fillna',           label: 'Fill NA',     icon: '∅→', color: '#93c5fd' },
  { type: 'dropna',           label: 'Drop NA',     icon: '∅✗', color: '#60a5fa' },
];

type PortCoords = Record<string, { input: { x: number; y: number }; output: { x: number; y: number } }>;

interface DraggedMetadataItem {
  id: string; label: string; type: string; connectorId?: string; schema?: string;
}

interface Props {
  onNodeDoubleClick?: (nodeId: string) => void;
  onPreviewNode?: (nodeId: string) => void;
  pipelineId?: string;
}

// ─── Inline code preview overlay ─────────────────────────────────────────────
type CodeLang = 'pyspark' | 'scala' | 'sql';

function CodePreviewOverlay({ pipelineId, onClose }: { pipelineId: string; onClose: () => void }) {
  const pipelineName = useAppSelector(s => s.pipeline.activePipeline?.name ?? 'Current Pipeline');
  const [lang, setLang]     = useState<CodeLang>('pyspark');
  const [code, setCode]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [meta, setMeta]     = useState<{
    generatedAt: string;
    version: string;
    fileName: string;
    lineCount: number;
    sizeLabel: string;
  } | null>(null);

  const [size, setSize] = useState({ w: 70, h: 80 });
  const [pos,  setPos]  = useState({ x: 15, y: 8 });
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayDragRef = useRef<{ type: 'move' | 'resize-e' | 'resize-s' | 'resize-se'; startX: number; startY: number; startW: number; startH: number; startPX: number; startPY: number } | null>(null);

  const startOverlayDrag = (type: NonNullable<typeof overlayDragRef.current>['type'], e: React.MouseEvent) => {
    e.preventDefault();
    overlayDragRef.current = { type, startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, startPX: pos.x, startPY: pos.y };
    const parent = panelRef.current?.parentElement;
    if (!parent) return;
    const pw = parent.offsetWidth, ph = parent.offsetHeight;
    const onMove = (me: MouseEvent) => {
      if (!overlayDragRef.current) return;
      const dx = ((me.clientX - overlayDragRef.current.startX) / pw) * 100;
      const dy = ((me.clientY - overlayDragRef.current.startY) / ph) * 100;
      const { type: t, startW, startH, startPX, startPY } = overlayDragRef.current;
      if (t === 'move') setPos({ x: Math.max(0, Math.min(startPX + dx, 100 - size.w)), y: Math.max(0, Math.min(startPY + dy, 100 - size.h)) });
      else if (t === 'resize-e') setSize(s => ({ ...s, w: Math.max(30, Math.min(startW + dx, 100 - pos.x)) }));
      else if (t === 'resize-s') setSize(s => ({ ...s, h: Math.max(25, Math.min(startH + dy, 100 - pos.y)) }));
      else setSize({ w: Math.max(30, Math.min(startW + dx, 100 - pos.x)), h: Math.max(25, Math.min(startH + dy, 100 - pos.y)) });
    };
    const onUp = () => { overlayDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const techLabel = (l: CodeLang) => (l === 'pyspark' ? 'PySpark 3.5' : l === 'scala' ? 'Scala Spark 3.5' : 'Spark SQL');

  const selectArtifactFile = (files: Array<{ fileName?: string; content?: string; isEntryPoint?: boolean }> | undefined, l: CodeLang) => {
    if (!Array.isArray(files) || files.length === 0) return null;
    const preferredExt = l === 'sql' ? '.sql' : l === 'scala' ? '.scala' : '.py';
    return files.find(file => file.fileName?.endsWith(preferredExt))
      ?? files.find(file => file.isEntryPoint)
      ?? files[0]
      ?? null;
  };

  const generate = useCallback(async (l: CodeLang) => {
    setLoading(true); setError(null); setCode(null); setMeta(null);
    try {
      const res = await api.generateCode(pipelineId, { technology: l });
      const d = res.data?.data ?? res.data;
      const artifactFile = selectArtifactFile(d.artifact?.files, l);
      const content = artifactFile?.content ?? d.generatedCode ?? d.code ?? '# No code returned';
      const generatedAt = d.artifact?.metadata?.generatedAt
        ? new Date(d.artifact.metadata.generatedAt).toLocaleString()
        : new Date().toLocaleString();
      setCode(content);
      setMeta({
        generatedAt,
        version: d.version ?? '—',
        fileName: artifactFile?.fileName ?? `generated.${l === 'sql' ? 'sql' : l === 'scala' ? 'scala' : 'py'}`,
        lineCount: content.split('\n').length,
        sizeLabel: `${(content.length / 1024).toFixed(1)} KB`,
      });
    } catch (e: unknown) {
      setError((e as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Code generation failed');
    } finally { setLoading(false); }
  }, [pipelineId]);

  useEffect(() => { generate('pyspark'); }, []);

  const handleLangChange = (l: CodeLang) => { setLang(l); generate(l); };

  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    if (!code) return;
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([code], { type: 'text/plain' })),
      download: meta?.fileName ?? `generated.${lang === 'sql' ? 'sql' : lang === 'scala' ? 'scala' : 'py'}`,
    });
    a.click();
  };

  return (
    <div ref={panelRef}
      className="absolute z-50 flex flex-col bg-[#0e1022] rounded-xl border border-slate-600/70 shadow-2xl overflow-hidden"
      style={{ fontFamily: 'system-ui, sans-serif', left: `${pos.x}%`, top: `${pos.y}%`, width: `${size.w}%`, height: `${size.h}%` }}
      onWheel={e => e.stopPropagation()}>
      <div className="bg-[#080a18] border-b border-slate-600/50 px-4 py-3 shrink-0 cursor-move select-none"
        onMouseDown={e => startOverlayDrag('move', e)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-blue-300">Code Preview</div>
            <div className="mt-1 text-[15px] font-semibold text-slate-100 truncate">{pipelineName}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-700 text-slate-400 hover:text-white text-lg transition-colors">×</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#111320] px-3 py-2">
            <span className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Runtime</span>
            <select
              value={lang}
              onChange={e => handleLangChange(e.target.value as CodeLang)}
              disabled={loading}
              onMouseDown={e => e.stopPropagation()}
              className="min-w-[10rem] bg-transparent text-[12px] font-semibold text-slate-100 focus:outline-none"
            >
              <option value="pyspark">PySpark 3.5</option>
              <option value="scala">Scala Spark 3.5</option>
              <option value="sql">Spark SQL</option>
            </select>
          </div>
          {meta && (
            <div className="text-[12px] text-slate-400 truncate">
              {techLabel(lang)} · Generated {meta.generatedAt}
            </div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={copy} disabled={!code} onMouseDown={e => e.stopPropagation()} className="flex items-center gap-1.5 h-8 px-3 rounded border border-slate-600 bg-slate-700/70 hover:bg-slate-600 text-slate-200 text-[12px] font-medium transition-colors disabled:opacity-40">{copied ? 'Copied' : 'Copy'}</button>
            <button onClick={download} disabled={!code} onMouseDown={e => e.stopPropagation()} className="flex items-center gap-1.5 h-8 px-3 rounded border border-slate-600 bg-slate-700/70 hover:bg-slate-600 text-slate-200 text-[12px] font-medium transition-colors disabled:opacity-40">Download</button>
            <button onClick={() => generate(lang)} disabled={loading} onMouseDown={e => e.stopPropagation()} className="flex items-center gap-1.5 h-8 px-3 rounded bg-blue-700 hover:bg-blue-600 text-white text-[12px] font-semibold transition-colors disabled:opacity-50">{loading ? 'Generating…' : 'Regenerate'}</button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col px-4 py-3">
        {loading && (
          <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-[13px] font-medium">Generating {lang === 'pyspark' ? 'PySpark' : lang === 'scala' ? 'Scala' : 'SQL'} code…</span>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-950/60 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-[13px] flex gap-2">
            <span className="text-red-400 font-bold shrink-0">✕</span>{error}
          </div>
        )}
        {code && !loading && (
          <div className="flex-1 overflow-hidden rounded-lg border border-slate-700 flex flex-col">
            <div className="bg-[#080a18] border-b border-slate-700 px-3 py-2.5 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-slate-100 truncate">{meta?.fileName ?? `generated.${lang === 'sql' ? 'sql' : lang === 'scala' ? 'scala' : 'py'}`}</div>
                  <div className="mt-0.5 text-[12px] text-slate-300">
                    {techLabel(lang)} · v{meta?.version ?? '—'}
                  </div>
                </div>
                {meta && (
                  <div className="text-[12px] text-slate-400 font-mono whitespace-nowrap">
                    {meta.lineCount} lines · {meta.sizeLabel}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#0a0c15] flex">
              <div className="select-none text-right pr-4 pl-3 text-[12px] text-slate-200 font-mono border-r border-slate-800/50 pt-3 pb-3 leading-5 shrink-0">
                {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
              </div>
              <pre className="flex-1 text-[12px] font-mono text-slate-200 whitespace-pre leading-5 pl-4 pr-4 pt-3 pb-3 overflow-visible">{code}</pre>
            </div>
          </div>
        )}
        <div className="absolute right-0 top-4 bottom-4 w-1.5 cursor-ew-resize hover:bg-blue-500/40 transition-colors rounded-r" onMouseDown={e => startOverlayDrag('resize-e', e)} />
        <div className="absolute bottom-0 left-4 right-4 h-1.5 cursor-ns-resize hover:bg-blue-500/40 transition-colors rounded-b" onMouseDown={e => startOverlayDrag('resize-s', e)} />
        <div className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/60 transition-colors rounded-br-xl" onMouseDown={e => startOverlayDrag('resize-se', e)} />
      </div>
    </div>
  );
}

export function PipelineCanvas({ onNodeDoubleClick, onPreviewNode, pipelineId }: Props) {
  const dispatch = useAppDispatch();
  const { nodes, edges, selectedNodeIds } = useAppSelector(s => s.pipeline);
  const canvasRef    = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarScrollRef = useRef<HTMLDivElement>(null);

  const [draggingNode, setDraggingNode]     = useState<string | null>(null);
  const [dragOffset, setDragOffset]         = useState({ x: 0, y: 0 });
  const [zoom, setZoom]                     = useState(1);
  const [pan, setPan]                       = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning]           = useState(false);
  const [panStart, setPanStart]             = useState({ x: 0, y: 0 });
  const [connecting, setConnecting]         = useState<{ fromNodeId: string } | null>(null);
  const [mousePos, setMousePos]             = useState({ x: 0, y: 0 });
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [toolbarCanScrollLeft, setToolbarCanScrollLeft] = useState(false);
  const [toolbarCanScrollRight, setToolbarCanScrollRight] = useState(false);

  // BUG-006: Buffer drag position — dispatch only via RAF, not every mousemove
  const pendingDrag = useRef<{ id: string; x: number; y: number } | null>(null);
  const rafId       = useRef<number | null>(null);

  const flushDrag = useCallback(() => {
    if (pendingDrag.current) {
      dispatch(updateNode(pendingDrag.current));
      pendingDrag.current = null;
    }
    rafId.current = null;
  }, [dispatch]);

  const scheduleDrag = useCallback((id: string, x: number, y: number) => {
    pendingDrag.current = { id, x, y };
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(flushDrag);
    }
  }, [flushDrag]);

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafId.current) cancelAnimationFrame(rafId.current); }, []);

  const nodeList = Object.values(nodes);
  const edgeList = Object.values(edges);

  const updateToolbarScrollState = useCallback(() => {
    const el = toolbarScrollRef.current;
    if (!el) return;
    setToolbarCanScrollLeft(el.scrollLeft > 4);
    setToolbarCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollToolbarBy = useCallback((delta: number) => {
    toolbarScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = toolbarScrollRef.current;
    if (!el) return;
    updateToolbarScrollState();
    const onResize = () => updateToolbarScrollState();
    const onScroll = () => updateToolbarScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [updateToolbarScrollState]);

  // BUG-005: Fit button — calculate node bounds and center in viewport
  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || nodeList.length === 0) {
      setZoom(1); setPan({ x: 0, y: 0 }); return;
    }
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    const PADDING = 60;
    const minX = Math.min(...nodeList.map(n => n.x));
    const minY = Math.min(...nodeList.map(n => n.y));
    const maxX = Math.max(...nodeList.map(n => n.x + NODE_W));
    const maxY = Math.max(...nodeList.map(n => n.y + NODE_H));
    const contentW = maxX - minX + PADDING * 2;
    const contentH = maxY - minY + PADDING * 2;
    const newZoom  = Math.min(cw / contentW, ch / contentH, 1.5);
    const newPanX  = (cw  - (maxX - minX) * newZoom) / 2 - minX * newZoom;
    const newPanY  = (ch  - (maxY - minY) * newZoom) / 2 - minY * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [nodeList]);

  // Keyboard — Delete, Ctrl+Z/Y, Ctrl+C/V
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); dispatch(undo()); return;
      }
      // Redo: Ctrl+Y / Cmd+Y / Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); dispatch(redo()); return;
      }
      // Copy: Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !inInput) {
        dispatch(copySelected()); return;
      }
      // Paste: Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !inInput) {
        dispatch(pasteClipboard()); return;
      }

      if (inInput) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (selectedEdgeId) { dispatch(deleteEdge(selectedEdgeId)); setSelectedEdgeId(null); }
      else if (selectedNodeIds.length > 0) selectedNodeIds.forEach(id => dispatch(deleteNode(id)));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeIds, selectedEdgeId, dispatch]);

  const portCoords = useMemo<PortCoords>(() => {
    const c: PortCoords = {};
    Object.values(nodes).forEach(n => {
      const cy = n.y + NODE_H / 2;
      c[n.id] = { input: { x: n.x, y: cy }, output: { x: n.x + NODE_W, y: cy } };
    });
    return c;
  }, [nodes]);

  const svgPoint = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current && !(e.target as Element).classList.contains('canvas-bg')) return;
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as Element).classList.contains('canvas-bg') || e.target === canvasRef.current) {
      dispatch(clearSelection()); setSelectedEdgeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const raw = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMousePos(raw);
    if (isPanning) { setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); return; }
    if (draggingNode) {
      const x = Math.round(((e.clientX - rect.left - pan.x) / zoom - dragOffset.x) / 24) * 24;
      const y = Math.round(((e.clientY - rect.top  - pan.y) / zoom - dragOffset.y) / 24) * 24;
      // BUG-006: Schedule RAF-buffered dispatch instead of direct dispatch
      scheduleDrag(draggingNode, Math.max(0, x), Math.max(0, y));
    }
  };

  const handleMouseUp = () => {
    // BUG-006: Flush any pending drag position on mouseUp
    if (pendingDrag.current) { dispatch(updateNode(pendingDrag.current)); pendingDrag.current = null; }
    if (rafId.current) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    setDraggingNode(null); setConnecting(null); setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.detail >= 2) {
      onNodeDoubleClick?.(nodeId);
      return;
    }
    setSelectedEdgeId(null);
    if (connecting) return;
    dispatch(selectNode({ id: nodeId, multiSelect: e.ctrlKey || e.metaKey }));
    const pt = svgPoint(e);
    const node = nodes[nodeId];
    if (!node) return;
    setDragOffset({ x: pt.x - node.x, y: pt.y - node.y });
    setDraggingNode(nodeId);
  };

  const handleNodeClick = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch(selectNode({ id: nodeId, multiSelect: e.ctrlKey || e.metaKey }));

    // Fallback path for platforms where SVG onDoubleClick can be inconsistent.
    if (e.detail >= 2) {
      onNodeDoubleClick?.(nodeId);
    }
  };

  const handleOutputPortDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation(); setConnecting({ fromNodeId: nodeId }); setDraggingNode(null);
  };

  const handleInputPortUp = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connecting && connecting.fromNodeId !== nodeId) {
      dispatch(addEdge({ id: uuid(), source: connecting.fromNodeId, target: nodeId, sourcePort: 'output', targetPort: 'input' }));
      setConnecting(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOverCanvas(false);
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left - pan.x) / zoom - NODE_W / 2) / 24) * 24;
    const y = Math.round(((e.clientY - rect.top  - pan.y) / zoom - NODE_H / 2) / 24) * 24;
    try {
      // F-01: toolbar node drag-to-canvas
      const toolbarType = e.dataTransfer.getData('application/etl-node-type') as Node['type'] | '';
      if (toolbarType) {
        const meta = getMeta(toolbarType);
        const id = uuid();
        const newNode: Node = {
          id, type: toolbarType, name: `${meta.label} ${nodeList.length + 1}`,
          x: Math.max(0, x), y: Math.max(0, y), width: NODE_W, height: NODE_H, config: {},
          inputs:  toolbarType !== 'source' ? [{ id: uuid(), name: 'input',  type: 'any' }] : [],
          outputs: toolbarType !== 'target' ? [{ id: uuid(), name: 'output', type: 'any' }] : [],
          version: 1,
        };
        dispatch(addNode(newNode));
        dispatch(selectNode({ id, multiSelect: false }));
        onNodeDoubleClick?.(id);
        return;
      }
      // Metadata catalog drag (table → source node)
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const item: DraggedMetadataItem = JSON.parse(raw);
      if (item.type !== 'table') return;
      const newNode: Node = {
        id: uuid(), type: 'source', name: item.label,
        x: Math.max(0, x), y: Math.max(0, y), width: NODE_W, height: NODE_H,
        config: { connectionId: item.connectorId ?? '', schema: item.schema ?? '', table: item.label },
        inputs: [], outputs: [{ id: uuid(), name: 'output', type: 'any' }], version: 1,
      };
      dispatch(addNode(newNode));
      dispatch(selectNode({ id: newNode.id, multiSelect: false }));
      onNodeDoubleClick?.(newNode.id);
    } catch { /* ignore */ }
  };

  const addNewNode = (type: Node['type']) => {
    const meta = getMeta(type);
    const id = uuid();
    const centerX = Math.round((300 + Math.random() * 200) / 24) * 24;
    const centerY = Math.round((200 + Math.random() * 150) / 24) * 24;
    const newNode: Node = {
      id, type, name: `${meta.label} ${nodeList.length + 1}`,
      x: centerX, y: centerY, width: NODE_W, height: NODE_H, config: {},
      inputs:  type !== 'source' ? [{ id: uuid(), name: 'input',  type: 'any' }] : [],
      outputs: type !== 'target' ? [{ id: uuid(), name: 'output', type: 'any' }] : [],
      version: 1,
    };
    dispatch(addNode(newNode));
    dispatch(selectNode({ id, multiSelect: false }));
    onNodeDoubleClick?.(id);
  };

  const bezier = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  const getNodeSubtitle = (node: Node): string => {
    const c = node.config as Record<string, string>;
    if (node.type === 'source' || node.type === 'target') {
      const parts = [c.schema, c.table].filter(Boolean);
      return parts.length ? parts.join('.') : 'Click to configure';
    }
    if (node.type === 'filter')    return c.expression    ? 'WHERE configured'  : 'Click to configure';
    if (node.type === 'join')      return c.joinType      ? c.joinType + ' JOIN': 'Click to configure';
    if (node.type === 'aggregate') return c.groupByColumns? 'Grouped'           : 'Click to configure';
    return c.expression ? 'Expression set' : 'Click to configure';
  };

  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max - 1) + '…' : s;

  const isConfigured = (node: Node): boolean => {
    const c = node.config as Record<string, string>;
    if (node.type === 'source' || node.type === 'target') return !!(c.connectionId && c.table);
    return !!(c.expression || c.joinType || c.groupByColumns);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1a1d2e] overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="h-11 bg-[#13152a] border-b border-slate-600/50 flex items-center gap-3 px-3 shrink-0 min-w-0">
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
          <button
            onClick={() => scrollToolbarBy(-260)}
            disabled={!toolbarCanScrollLeft}
            title="Scroll left"
            className="w-7 h-7 shrink-0 rounded border border-slate-600/50 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
          >
            ←
          </button>
          <div ref={toolbarScrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex items-center gap-1.5 min-w-max pr-2">
              <span className="text-[12px] text-slate-300 uppercase tracking-widest mr-1 font-bold">Add Node</span>
              <div className="w-px h-5 bg-slate-600 mx-1" />
              {TOOLBAR_NODES.map(n => (
                <button key={n.type}
                  onClick={() => addNewNode(n.type)}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/etl-node-type', n.type);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  title={`Click or drag to add ${n.label}`}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded text-[12px] font-semibold transition-all hover:scale-105 cursor-grab active:cursor-grabbing shrink-0"
                  style={{ color: '#0d0f1a', backgroundColor: n.color, boxShadow: `0 1px 4px ${n.color}66` }}>
                  <span className="text-[13px]">{n.icon}</span>{n.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => scrollToolbarBy(260)}
            disabled={!toolbarCanScrollRight}
            title="Scroll right"
            className="w-7 h-7 shrink-0 rounded border border-slate-600/50 text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 transition-colors"
          >
            →
          </button>
        </div>
        <div className="w-px h-6 bg-slate-600/70 shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          {/* F-21: Undo/Redo buttons */}
          <div className="flex items-center gap-1">
            <button onClick={() => dispatch(undo())} title="Undo (Ctrl+Z)"
              className="h-7 px-2 rounded text-[12px] text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-mono border border-slate-600/50">
              ↩
            </button>
            <button onClick={() => dispatch(redo())} title="Redo (Ctrl+Y)"
              className="h-7 px-2 rounded text-[12px] text-slate-300 hover:text-white hover:bg-slate-700 transition-colors font-mono border border-slate-600/50">
              ↪
            </button>
          </div>
          {pipelineId && (
            <button onClick={() => setShowCodePreview(true)}
              className="flex items-center gap-1.5 h-7 px-3 rounded text-[12px] font-semibold border border-violet-500/60 text-violet-300 hover:bg-violet-700 hover:text-white hover:border-violet-500 transition-colors">
              <span className="text-[13px]">{'</>'}</span> Preview Code
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-[#1e2035] rounded px-2 py-1 border border-slate-600/40">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
              className="w-5 h-5 rounded text-slate-200 hover:text-white hover:bg-slate-600 text-sm font-bold transition-colors">−</button>
            <span className="text-[12px] text-slate-200 w-10 text-center font-mono font-semibold">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="w-5 h-5 rounded text-slate-200 hover:text-white hover:bg-slate-600 text-sm font-bold transition-colors">+</button>
            <div className="w-px h-4 bg-slate-600 mx-0.5" />
            {/* BUG-005 FIXED: Fit button now fits node bounds into viewport */}
            <button onClick={fitToView}
              className="h-5 px-2 rounded text-[12px] text-slate-300 hover:text-white hover:bg-slate-600 transition-colors font-medium"
              title="Fit all nodes into view">
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* ── Canvas area ──────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden relative ${isDragOverCanvas ? 'ring-2 ring-inset ring-blue-500/40' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onDragOver={e => { e.preventDefault(); setIsDragOverCanvas(true); }}
        onDragLeave={() => setIsDragOverCanvas(false)}
        onDrop={handleDrop}
        style={{ cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : 'default' }}
      >
        <svg ref={canvasRef} className="w-full h-full" onClick={handleCanvasClick} onMouseDown={handleCanvasMouseDown} style={{ display: 'block' }}>
          <defs>
            <pattern id="smallGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#2e3250" strokeWidth="0.8" />
            </pattern>
            <pattern id="grid" width="120" height="120" patternUnits="userSpaceOnUse">
              <rect width="120" height="120" fill="url(#smallGrid)" />
              <path d="M 120 0 L 0 0 0 120" fill="none" stroke="#3d4270" strokeWidth="1.2" />
            </pattern>
            <marker id="arrow-blue" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#60a5fa" />
            </marker>
            <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#f87171" />
            </marker>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.6" />
            </filter>
            <filter id="shadow-selected" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3b82f6" floodOpacity="0.5" />
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" className="canvas-bg"
            transform={`translate(${pan.x},${pan.y}) scale(${zoom})`} style={{ transformOrigin: '0 0' }} />

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

            {/* Edges */}
            {edgeList.map(edge => {
              const s = portCoords[edge.source], t = portCoords[edge.target];
              if (!s || !t) return null;
              const isEdgeSel = selectedEdgeId === edge.id;
              const mx = (s.output.x + t.input.x) / 2, my = (s.output.y + t.input.y) / 2;
              return (
                <g key={edge.id}>
                  <path d={bezier(s.output.x, s.output.y, t.input.x, t.input.y)}
                    stroke={isEdgeSel ? '#f87171' : '#60a5fa'} strokeWidth={isEdgeSel ? 2.5 : 2} fill="none"
                    markerEnd={isEdgeSel ? 'url(#arrow-red)' : 'url(#arrow-blue)'} />
                  <path d={bezier(s.output.x, s.output.y, t.input.x, t.input.y)}
                    stroke="transparent" strokeWidth="14" fill="none" className="cursor-pointer"
                    onClick={ev => { ev.stopPropagation(); setSelectedEdgeId(isEdgeSel ? null : edge.id); dispatch(clearSelection()); }} />
                  {isEdgeSel && (
                    <g onClick={ev => { ev.stopPropagation(); dispatch(deleteEdge(edge.id)); setSelectedEdgeId(null); }} className="cursor-pointer">
                      <circle cx={mx} cy={my} r="10" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
                      <text x={mx} y={my} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="bold" fill="white" pointerEvents="none">×</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Connecting preview */}
            {connecting && portCoords[connecting.fromNodeId] && (() => {
              const from = portCoords[connecting.fromNodeId].output;
              const to = { x: (mousePos.x - pan.x) / zoom, y: (mousePos.y - pan.y) / zoom };
              return <path d={bezier(from.x, from.y, to.x, to.y)} stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="6,4" opacity="0.8" />;
            })()}

            {/* Nodes */}
            {nodeList.map(node => {
              const meta       = getMeta(node.type);
              const isSelected = selectedNodeIds.includes(node.id);
              const configured = isConfigured(node);
              const subtitle   = getNodeSubtitle(node);
              return (
                <g key={node.id}
                  filter={isSelected ? 'url(#shadow-selected)' : 'url(#shadow)'}
                  style={{ cursor: connecting ? 'crosshair' : 'pointer' }}
                  onClick={e => handleNodeClick(node.id, e)}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    onNodeDoubleClick?.(node.id);
                  }}
                  onMouseDown={e => handleNodeMouseDown(node.id, e)}
                >
                  {isSelected && (
                    <rect x={node.x - 3} y={node.y - 3} width={NODE_W + 6} height={NODE_H + 6}
                      rx="7" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.7" />
                  )}
                  {isSelected && (
                    <g onClick={e => { e.stopPropagation(); dispatch(deleteNode(node.id)); }} className="cursor-pointer" style={{ cursor: 'pointer' }}>
                      <circle cx={node.x + NODE_W + 8} cy={node.y - 8} r="10" fill="#ef4444" stroke="#fca5a5" strokeWidth="1.5" />
                      <text x={node.x + NODE_W + 8} y={node.y - 8} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="bold" fill="white" pointerEvents="none">×</text>
                    </g>
                  )}
                  <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx="5" fill={meta.bodyColor}
                    stroke={isSelected ? meta.borderColor : meta.borderColor + '66'} strokeWidth={isSelected ? 1.5 : 1} />
                  <rect x={node.x} y={node.y} width={NODE_W} height={HEADER_H} rx="5" fill={meta.headerColor} opacity="0.9" />
                  <rect x={node.x} y={node.y + HEADER_H - 5} width={NODE_W} height={5} fill={meta.headerColor} opacity="0.9" />
                  <text x={node.x + 8} y={node.y + 15} fontSize="10" fontWeight="700" fill="white" opacity="0.9"
                    fontFamily="system-ui, sans-serif" letterSpacing="0.05em" pointerEvents="none">
                    {meta.icon} {meta.label.toUpperCase()}
                  </text>
                  <circle cx={node.x + NODE_W - 10} cy={node.y + 11} r="4" fill={configured ? '#22c55e' : '#ef4444'} opacity="0.9" />
                  <text x={node.x + 10} y={node.y + HEADER_H + 17} fontSize="13" fontWeight="700" fill="#f1f5f9"
                    fontFamily="system-ui, sans-serif" pointerEvents="none">
                    {truncate(node.name, 22)}
                  </text>
                  <text x={node.x + 10} y={node.y + HEADER_H + 33} fontSize="11"
                    fill={configured ? '#cbd5e1' : '#fbbf24'} fontFamily="system-ui, sans-serif"
                    fontStyle={configured ? 'normal' : 'italic'} pointerEvents="none">
                    {truncate(subtitle, 26)}
                  </text>
                  {(node.type === 'source' || node.type === 'target') && (
                    <foreignObject x={node.x + NODE_W - 34} y={node.y + HEADER_H + 7} width="22" height="22">
                      <button
                        type="button"
                        title="Preview data"
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedEdgeId(null);
                          dispatch(selectNode({ id: node.id, multiSelect: false }));
                          onPreviewNode?.(node.id);
                        }}
                        className="flex h-[22px] w-[22px] items-center justify-center rounded border border-slate-600 bg-[#101629]/90 text-[11px] text-slate-200 transition-colors hover:border-blue-400 hover:text-white hover:bg-[#18213a]"
                      >
                        👁
                      </button>
                    </foreignObject>
                  )}
                  {node.type !== 'source' && (
                    <g>
                      <circle cx={node.x} cy={node.y + NODE_H / 2} r={PORT_R + 1}
                        fill="#13152a" stroke={meta.portColor} strokeWidth="2.5" className="cursor-pointer"
                        onMouseUp={e => handleInputPortUp(node.id, e)} />
                      <circle cx={node.x} cy={node.y + NODE_H / 2} r={3.5} fill={meta.portColor} pointerEvents="none" />
                    </g>
                  )}
                  {node.type !== 'target' && (
                    <g>
                      <circle cx={node.x + NODE_W} cy={node.y + NODE_H / 2} r={PORT_R + 1}
                        fill="#13152a" stroke={meta.portColor} strokeWidth="2.5" className="cursor-pointer"
                        onMouseDown={e => { e.stopPropagation(); handleOutputPortDown(node.id, e); }} />
                      <circle cx={node.x + NODE_W} cy={node.y + NODE_H / 2} r={3.5} fill={meta.portColor} pointerEvents="none" />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {nodeList.length === 0 && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
              fontSize="14" fill="#6b7db3" fontFamily="system-ui, sans-serif" fontWeight="500">
              Drag a table from the Metadata Browser — or click a node type in the toolbar above
            </text>
          )}
        </svg>

        {isDragOverCanvas && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-900/80 border-2 border-dashed border-blue-400 rounded-xl px-8 py-5 text-blue-200 text-sm font-medium">
              Drop table to create Source node
            </div>
          </div>
        )}

        {showCodePreview && pipelineId && (
          <CodePreviewOverlay pipelineId={pipelineId} onClose={() => setShowCodePreview(false)} />
        )}
      </div>
    </div>
  );
}
