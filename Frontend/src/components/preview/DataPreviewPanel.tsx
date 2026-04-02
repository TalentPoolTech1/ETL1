import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';

interface PreviewRow { [key: string]: unknown; }
interface PreviewEnvelope {
  rows?: PreviewRow[];
  previewAvailable?: boolean;
  availabilityReason?: string;
}

const ITEM_HEIGHT = 32;
const VISIBLE_ITEMS = 15;

interface DataPreviewPanelProps {
  embedded?: boolean;
}

export function DataPreviewPanel({ embedded = false }: DataPreviewPanelProps) {
  // Defensive guard: the old global app-shell preview should never render for
  // pipeline node selection anymore. Only the embedded designer preview is valid.
  if (!embedded) return null;

  const selectedNodeIds = useAppSelector(s => s.pipeline.selectedNodeIds);
  const selectedNodeId = selectedNodeIds[0] ?? null;

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [filterText, setFilterText] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadPreview = useCallback(async () => {
    if (!selectedNodeId) return;
    setLoading(true);
    setError(null);
    setRows([]);
    setUnavailableMessage('Row-level data preview is coming soon for this workspace.');
    setLoading(false);
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedNodeId) loadPreview();
    else {
      setRows([]);
      setUnavailableMessage(null);
      setError(null);
    }
  }, [selectedNodeId, loadPreview]);

  const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

  const filteredData = useMemo(() => {
    let result = [...rows];
    if (filterText) {
      result = result.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(filterText.toLowerCase()))
      );
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

  const handleScroll = (e: React.UIEvent) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  };

  const handleColumnSort = (col: string) => {
    setSortBy(prev => prev?.column === col
      ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { column: col, direction: 'asc' }
    );
  };

  const exportData = (format: 'csv' | 'json') => {
    let content = '';
    if (format === 'csv') {
      content = [allColumns.join(','), ...filteredData.map(row => allColumns.map(col => String(row[col] ?? '')).join(','))].join('\n');
    } else {
      content = JSON.stringify(filteredData, null, 2);
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `preview.${format}`; a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  return (
    <div className="h-full bg-[#0a0c15] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/60 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-100">Data Preview</h3>
          {selectedNodeId && (
            <div className="text-xs text-slate-400">
              {loading
                ? 'Loading…'
                : error
                ? <span className="text-red-400">{error}</span>
                : unavailableMessage
                ? unavailableMessage
                : `${filteredData.length} rows`}
            </div>
          )}
          {!selectedNodeId && <div className="text-xs text-slate-500">Select a node to preview data</div>}
        </div>
        <div className="flex items-center gap-2">
          {selectedNodeId && (
            <>
              {!unavailableMessage && (
                <>
                  <input type="text" placeholder="Search…" value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="px-2 py-1 border border-slate-700 bg-[#131826] rounded text-xs w-32 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500" />
                  <button onClick={loadPreview} title="Refresh"
                    className="text-xs text-slate-500 hover:text-slate-200">⟳</button>
                  <button onClick={() => setShowExportModal(true)} title="Export"
                    className="text-xs text-slate-500 hover:text-slate-200">📥</button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!selectedNodeId && (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          Select a canvas node to preview its output data.
        </div>
      )}

      {/* Loading */}
      {selectedNodeId && loading && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading preview…</div>
      )}

      {/* Error */}
      {selectedNodeId && !loading && error && (
        <div className="flex-1 flex items-center justify-center text-red-400 text-sm">{error}</div>
      )}

      {/* Unavailable */}
      {selectedNodeId && !loading && !error && unavailableMessage && (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
          {unavailableMessage}
        </div>
      )}

      {/* No data */}
      {selectedNodeId && !loading && !error && !unavailableMessage && rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          No preview data available for this node.
        </div>
      )}

      {/* Table */}
      {selectedNodeId && !loading && !error && !unavailableMessage && rows.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-slate-950/80 border-b border-slate-800 flex h-8 flex-shrink-0">
            {allColumns.map(col => (
              <div key={col}
                className="flex-1 min-w-32 px-4 py-1.5 text-left text-xs font-semibold text-slate-300 border-r border-slate-800 flex items-center cursor-pointer hover:bg-slate-900"
                onClick={() => handleColumnSort(col)}>
                <span>{col}</span>
                <span className="ml-1 text-slate-500">
                  {sortBy?.column === col ? (sortBy.direction === 'asc' ? '▲' : '▼') : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Virtual rows */}
          <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto"
            style={{ height: `${VISIBLE_ITEMS * ITEM_HEIGHT}px` }}>
            <div style={{ height: `${filteredData.length * ITEM_HEIGHT}px`, position: 'relative' }}>
              <div style={{ transform: `translateY(${offsetY}px)`, position: 'absolute', top: 0, left: 0, right: 0 }}>
                {visibleData.map((row, idx) => (
                  <div key={startIndex + idx} className="flex h-8 border-b border-slate-900 hover:bg-slate-900/60">
                    {allColumns.map(col => (
                      <div key={col} className="flex-1 min-w-32 px-4 py-1.5 text-xs text-slate-300 border-r border-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                        {String(row[col] ?? '').substring(0, 80)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#101524] border border-slate-700 rounded-lg shadow-lg p-6 w-80">
            <h3 className="text-base font-semibold text-slate-100 mb-4">Export Preview Data</h3>
            <div className="space-y-2 mb-4">
              <button onClick={() => exportData('csv')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-500">
                📄 Export as CSV
              </button>
              <button onClick={() => exportData('json')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-500">
                {'{ }'} Export as JSON
              </button>
            </div>
            <button onClick={() => setShowExportModal(false)}
              className="w-full px-4 py-2 bg-slate-800 text-slate-200 rounded-md text-sm hover:bg-slate-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
