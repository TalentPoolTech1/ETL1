/**
 * MetadataPreviewPanel — Bottom panel showing top 50 rows from a catalog dataset.
 * Opened by clicking the Eye icon on a table row in the Metadata Catalog sidebar.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeMetadataPreview } from '@/store/slices/uiSlice';
import api from '@/services/api';

export function MetadataPreviewPanel() {
  const dispatch = useAppDispatch();
  const datasetId   = useAppSelector(s => s.ui.metadataPreviewDatasetId);
  const datasetName = useAppSelector(s => s.ui.metadataPreviewDatasetName);

  const [columns, setColumns]       = useState<string[]>([]);
  const [rows, setRows]             = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    setUnsupported(false);
    setColumns([]);
    setRows([]);
    api.previewDataset(datasetId, 50)
      .then(res => {
        const d = res.data?.data ?? res.data;
        if (d?.unsupported) { setUnsupported(true); return; }
        setColumns((d?.columns ?? []) as string[]);
        setRows((d?.rows ?? []) as Array<Record<string, unknown>>);
      })
      .catch((err: unknown) => {
        setError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load preview');
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (!datasetId) return null;

  return (
    <div className="flex flex-col h-full bg-[#0a0c15] border-t border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/60 border-b border-slate-800 flex-shrink-0">
        <span className="text-[12px] text-slate-300 font-semibold">
          Preview — <span className="font-mono text-violet-300">{datasetName}</span>
          {!loading && rows.length > 0 && (
            <span className="ml-2 text-[11px] text-slate-500 font-normal">{rows.length} rows</span>
          )}
        </span>
        <button
          onClick={() => dispatch(closeMetadataPreview())}
          className="text-slate-600 hover:text-slate-400 transition-colors"
          title="Close preview"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading preview…
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-red-400">{error}</div>
      ) : unsupported ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-slate-500 italic">
          Live preview not available for this format — ORC requires Spark/Hive cluster execution
        </div>
      ) : columns.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[12px] text-slate-600 italic">No data available</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="text-[11px] border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-slate-900">
              <tr>
                {columns.map(col => (
                  <th
                    key={col}
                    className="px-3 py-1.5 text-left text-slate-400 font-mono font-medium border-b border-r border-slate-800 bg-slate-900"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#0a0c15]' : 'bg-slate-900/20'}>
                  {columns.map(col => (
                    <td
                      key={col}
                      className="px-3 py-1 text-slate-300 font-mono border-b border-r border-slate-800/40 max-w-[220px] truncate"
                      title={String(row[col] ?? '')}
                    >
                      {row[col] === null || row[col] === undefined
                        ? <span className="text-slate-600 italic">null</span>
                        : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
