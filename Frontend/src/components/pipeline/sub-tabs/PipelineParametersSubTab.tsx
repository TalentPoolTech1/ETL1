/**
 * Pipeline > Parameters sub-tab
 */
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Lock, Save, Loader2 } from 'lucide-react';
import api from '@/services/api';

interface Param {
  id: string;
  name: string;
  dataType: string;
  required: boolean;
  defaultValue: string;
  isSensitive: boolean;
  description: string;
  scope: string;
}

const DATA_TYPES = ['STRING', 'INTEGER', 'LONG', 'DECIMAL', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'LIST', 'MAP'];

export function PipelineParametersSubTab({ pipelineId, onDirty }: { pipelineId: string; onDirty?: () => void }) {
  const [params, setParams] = useState<Param[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const loadParameters = () => {
    setIsLoading(true);
    setLoadError(null);
    api.getPipelineParameters(pipelineId)
      .then(res => {
        setParams(res.data.data ?? []);
        setIsDirtyLocal(false);
      })
      .catch((err: unknown) => {
        setParams([]);
        setLoadError((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to load parameters');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadParameters();
  }, [pipelineId]);

  const markDirty = () => {
    setIsDirtyLocal(true);
    onDirty?.();
  };

  const handleSave = async () => {
    if (isSaving || !isDirtyLocal) return;
    setIsSaving(true);
    try {
      await api.savePipelineParameters(pipelineId, params);
      setIsDirtyLocal(false);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Failed to save parameters');
    } finally {
      setIsSaving(false);
    }
  };

  const addParam = () => {
    const id = crypto.randomUUID();
    setParams(prev => [...prev, { id, name: 'new_param', dataType: 'STRING', required: false, defaultValue: '', isSensitive: false, description: '', scope: 'pipeline' }]);
    setEditingId(id);
    onDirty?.();
  };

  const removeParam = (id: string) => {
    setParams(prev => prev.filter(p => p.id !== id));
    markDirty();
  };

  const updateParam = (id: string, field: keyof Param, value: string | boolean) => {
    setParams(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    markDirty();
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading parameters...</div>;
  }

  if (params.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-5">
        {loadError && (
          <div className="mb-3 rounded border border-red-800 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
            {loadError}
          </div>
        )}
        <p className="text-sm mb-3">No parameters defined for this pipeline.</p>
        <div className="flex items-center gap-2">
          {loadError && (
            <button onClick={loadParameters}
              className="flex items-center gap-1.5 h-7 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded text-[12px] font-medium transition-colors">
              Retry Load
            </button>
          )}
          <button onClick={addParam}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors">
            <Plus className="w-3 h-3" /> Add Parameter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
        <span className="text-[12px] text-slate-400 font-medium">{params.length} parameter{params.length !== 1 ? 's' : ''}</span>
        {loadError && (
          <span className="ml-3 text-[12px] text-red-300">{loadError}</span>
        )}
        
        <div className="ml-auto flex items-center gap-2">
          {isDirtyLocal && (
            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-1.5 h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Parameters
            </button>
          )}
          <button onClick={addParam}
            className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors">
            <Plus className="w-3 h-3" /> Add Parameter
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-[#0a0c15] z-10">
            <tr className="text-left text-[12px] text-slate-300 border-b border-slate-800">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Required</th>
              <th className="px-3 py-2 font-medium">Default Value</th>
              <th className="px-3 py-2 font-medium">Sensitive</th>
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {params.map(p => (
              <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="px-2 py-1.5">
                  <input value={p.name} onChange={e => updateParam(p.id, 'name', e.target.value)}
                    className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 font-mono" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={p.dataType} onChange={e => updateParam(p.id, 'dataType', e.target.value)}
                    className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
                    {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input type="checkbox" checked={p.required} onChange={e => updateParam(p.id, 'required', e.target.checked)} className="accent-blue-500" />
                </td>
                <td className="px-2 py-1.5">
                  {p.isSensitive ? (
                    <div className="flex items-center gap-1 text-slate-400 text-[12px]"><Lock className="w-3 h-3" /> Hidden</div>
                  ) : (
                    <input value={p.defaultValue} onChange={e => updateParam(p.id, 'defaultValue', e.target.value)}
                      className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input type="checkbox" checked={p.isSensitive} onChange={e => updateParam(p.id, 'isSensitive', e.target.checked)} className="accent-red-500" />
                </td>
                <td className="px-2 py-1.5">
                  <select value={p.scope} onChange={e => updateParam(p.id, 'scope', e.target.value)}
                    className="h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500">
                    <option value="pipeline">Pipeline</option>
                    <option value="execution">Execution</option>
                    <option value="global">Global</option>
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input value={p.description} onChange={e => updateParam(p.id, 'description', e.target.value)}
                    className="w-full h-7 px-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500" />
                </td>
                <td className="px-2 py-1.5">
                  <button onClick={() => removeParam(p.id)}
                    className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-400 hover:bg-red-900/30 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
