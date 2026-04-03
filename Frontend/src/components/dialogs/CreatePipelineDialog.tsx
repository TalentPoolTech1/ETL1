import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createPipeline, closeCreatePipeline } from '@/store/slices/projectsSlice';
import { openTab } from '@/store/slices/tabsSlice';
import { X, Workflow, Loader2, Folder } from 'lucide-react';

export function CreatePipelineDialog() {
  const dispatch   = useAppDispatch();
  const isOpen     = useAppSelector(s => s.projects.createPipelineOpen);
  const projectId  = useAppSelector(s => s.projects.createPipelineProjectId);
  const folderId   = useAppSelector(s => s.projects.createPipelineFolderId);
  const project    = useAppSelector(s => s.projects.projects.find(p => p.projectId === projectId));

  // Find folder name for display (may be in any project's foldersByProject, or local FolderNode state)
  // We keep it simple: show folderId prefix when set but no name available
  const folderName = useAppSelector(s => {
    if (!folderId || !projectId) return null;
    return (s.projects.foldersByProject[projectId] ?? []).find(f => f.folderId === folderId)?.folderDisplayName ?? null;
  });

  const [name, setName]       = useState('');
  const [desc, setDesc]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') dispatch(closeCreatePipeline()); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch]);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await dispatch(createPipeline({
        projectId,
        pipelineDisplayName: name.trim(),
        pipelineDescText: desc.trim() || undefined,
        folderId: folderId ?? undefined,
      })).unwrap();
      dispatch(openTab({
        id: `pipeline-${result.pipeline.pipelineId}`,
        type: 'pipeline',
        objectId: result.pipeline.pipelineId,
        objectName: result.pipeline.pipelineDisplayName,
        unsaved: false,
        isDirty: false,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create pipeline');
      setSaving(false);
    }
  };

  // Context breadcrumb shown in the dialog subtitle
  const contextLabel = folderId
    ? folderName
      ? <>in folder <span className="text-slate-300">{folderName}</span></>
      : <>in a folder</>
    : project
      ? <>at root of <span className="text-slate-300">{project.projectDisplayName}</span></>
      : <><span className="text-blue-400 font-medium italic">Global scope</span></>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => dispatch(closeCreatePipeline())}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative bg-[#1a1d27] border border-slate-700/60 rounded-xl shadow-2xl w-full max-w-[420px] mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
            <Workflow className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">New Pipeline</h2>
            {contextLabel && (
              <p className="text-[12px] text-slate-300 mt-0.5 flex items-center gap-1 truncate">
                {folderId && <Folder className="w-3 h-3 flex-shrink-0" />}
                {contextLabel}
              </p>
            )}
          </div>
          <button
            onClick={() => dispatch(closeCreatePipeline())}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Pipeline name <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. ingest-customers"
              className="w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What does this pipeline do?"
              rows={2}
              className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => dispatch(closeCreatePipeline())}
              className="flex-1 h-9 text-sm text-slate-400 border border-slate-700/60 rounded-md hover:bg-slate-800 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 h-9 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Creating…' : 'Create Pipeline'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
