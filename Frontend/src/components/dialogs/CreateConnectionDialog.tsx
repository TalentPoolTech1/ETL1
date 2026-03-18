/**
 * CreateConnectionDialog
 *
 * Step 1 — Technology picker: grouped grid of all connectors from
 *           GET /api/connections/types (ConnectorRegistry). Shows logo-style
 *           tile per technology. User picks the technology first.
 *
 * Step 2 — Purpose-built form: connection name + every field from that
 *           technology's configSchema + secretsSchema, rendered correctly
 *           (text, number, password, enum select). Secrets shown as masked
 *           password fields with reveal toggle.
 *
 * Step 3 — On submit: POST /api/connections → dispatches createConnector.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeCreateConnection, fetchConnectorTypes, createConnector } from '@/store/slices/connectionsSlice';
import type { ConnectorType } from '@/store/slices/connectionsSlice';
import { X, ChevronLeft, Loader2, Eye, EyeOff, Search, CheckCircle2 } from 'lucide-react';

// ─── Category colour map ─────────────────────────────────────────────────────

const CAT_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  'Cloud Storage':   { bg: 'bg-sky-500/10',     text: 'text-sky-300',    border: 'border-sky-500/20'    },
  'Cloud Warehouse': { bg: 'bg-violet-500/10',   text: 'text-violet-300', border: 'border-violet-500/20' },
  'JDBC':            { bg: 'bg-emerald-500/10',  text: 'text-emerald-300',border: 'border-emerald-500/20'},
  'File':            { bg: 'bg-amber-500/10',    text: 'text-amber-300',  border: 'border-amber-500/20'  },
  'Streaming':       { bg: 'bg-pink-500/10',     text: 'text-pink-300',   border: 'border-pink-500/20'   },
};
const DEFAULT_PAL = { bg: 'bg-slate-700/50', text: 'text-slate-300', border: 'border-slate-600' };

function pal(cat: string) {
  return CAT_PALETTE[cat] ?? DEFAULT_PAL;
}

// Abbreviate long type display names for tile labels
function shortName(name: string): string {
  return name
    .replace('PostgreSQL', 'PostgreSQL')
    .replace('Microsoft SQL Server', 'SQL Server')
    .replace('SAP HANA', 'SAP HANA')
    .replace('Amazon ', 'AWS ')
    .replace('Google ', 'GCP ')
    .replace('Azure ', 'Azure ');
}

// Get initials for the tile icon (2 chars)
function initials(name: string): string {
  const clean = name.replace(/[()]/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length === 1) return clean.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

// ─── Step 1: Technology grid ─────────────────────────────────────────────────

function TechPicker({ types, onSelect }: { types: ConnectorType[]; onSelect: (t: ConnectorType) => void }) {
  const [search, setSearch] = useState('');

  // Group by category
  const groups: Record<string, ConnectorType[]> = {};
  for (const t of types) {
    const cat = t.category ?? 'Other';
    (groups[cat] ??= []).push(t);
  }

  const filtered = search.trim()
    ? Object.entries(groups).reduce((acc, [cat, items]) => {
        const hits = items.filter(t =>
          t.displayName.toLowerCase().includes(search.toLowerCase()) ||
          t.typeCode.toLowerCase().includes(search.toLowerCase())
        );
        if (hits.length) acc[cat] = hits;
        return acc;
      }, {} as Record<string, ConnectorType[]>)
    : groups;

  const cats = Object.keys(filtered).sort();

  return (
    <div className="flex flex-col max-h-[520px]">
      {/* Search */}
      <div className="px-5 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 h-8 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3">
          <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search technologies…"
            className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder-slate-600 outline-none min-w-0"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {cats.length === 0 && (
          <div className="text-center text-slate-600 text-sm py-8">No technologies match "{search}"</div>
        )}
        {cats.map(cat => {
          const p = pal(cat);
          return (
            <div key={cat}>
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-2">{cat}</p>
              <div className="grid grid-cols-4 gap-2">
                {(filtered[cat] ?? []).map(t => (
                  <button
                    key={t.typeCode}
                    onClick={() => onSelect(t)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border ${p.border} ${p.bg}
                      hover:brightness-125 hover:scale-[1.03] active:scale-100
                      text-slate-400 transition-all group`}
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${p.bg} ${p.text} border ${p.border}`}>
                      {initials(t.displayName)}
                    </span>
                    <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${p.text}`}>
                      {shortName(t.displayName)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Connection config form ──────────────────────────────────────────

interface FieldDef {
  key: string;
  schema: any;
  required: boolean;
  isSecret: boolean;
}

function buildFields(type: ConnectorType): FieldDef[] {
  const fields: FieldDef[] = [];
  const configReq  = new Set(type.configSchema?.required ?? []);
  const secretsReq = new Set(type.secretsSchema?.required ?? []);

  for (const [k, v] of Object.entries(type.configSchema?.properties ?? {}))
    fields.push({ key: k, schema: v, required: configReq.has(k), isSecret: false });

  for (const [k, v] of Object.entries(type.secretsSchema?.properties ?? {}))
    fields.push({ key: k, schema: v, required: secretsReq.has(k), isSecret: true });

  return fields;
}

function FormField({ def, value, onChange }: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const s = def.schema as any;
  const label = s.title ?? def.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const inputType = def.isSecret && !show ? 'password' : (s.type === 'integer' || s.type === 'number' ? 'number' : 'text');

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {label}
        {def.required && <span className="text-red-400">*</span>}
        {def.isSecret && (
          <span className="px-1.5 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 text-[10px] rounded">secret</span>
        )}
      </label>
      <div className="relative">
        {s.enum ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100
              focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none"
          >
            <option value="">— Select —</option>
            {(s.enum as string[]).map((v: string) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <input
            type={inputType}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={s.default != null ? String(s.default) : (s.description ?? '')}
            className="w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100
              placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all pr-8"
          />
        )}
        {def.isSecret && !s.enum && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {s.description && !s.enum && (
        <p className="text-[10px] text-slate-600 leading-tight">{s.description}</p>
      )}
    </div>
  );
}

function ConfigForm({ type, onBack, onSave, saving, error }: {
  type: ConnectorType;
  onBack: () => void;
  onSave: (displayName: string, config: Record<string, string>, secrets: Record<string, string>) => void;
  saving: boolean;
  error: string | null;
}) {
  const [displayName, setDisplayName] = useState('');
  const [config,      setConfig]      = useState<Record<string, string>>({});
  const [secrets,     setSecrets]     = useState<Record<string, string>>({});

  const fields = buildFields(type);
  const configFields  = fields.filter(f => !f.isSecret);
  const secretsFields = fields.filter(f => f.isSecret);

  const setConf = useCallback((k: string, v: string) => setConfig(p => ({ ...p, [k]: v })), []);
  const setSec  = useCallback((k: string, v: string) => setSecrets(p => ({ ...p, [k]: v })), []);

  const p = pal(type.category ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(displayName.trim(), config, secrets);
  };

  return (
    <form onSubmit={submit} className="flex flex-col max-h-[560px]">
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">

        {/* Technology badge */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${p.border} ${p.bg}`}>
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${p.bg} ${p.text} border ${p.border} flex-shrink-0`}>
            {initials(type.displayName)}
          </span>
          <div>
            <div className={`text-sm font-semibold ${p.text}`}>{type.displayName}</div>
            <div className="text-[11px] text-slate-500">{type.category}</div>
          </div>
          {type.defaultPort && (
            <div className="ml-auto text-[11px] text-slate-500">Default port: <span className="text-slate-300 font-mono">{type.defaultPort}</span></div>
          )}
        </div>

        {/* Connection name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-400">
            Connection name <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={`e.g. Production ${type.displayName}`}
            className="w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100
              placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>

        {/* Config fields */}
        {configFields.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold pt-1">Connection Details</p>
            {configFields.map(f => (
              <FormField key={f.key} def={f} value={config[f.key] ?? ''} onChange={v => setConf(f.key, v)} />
            ))}
          </>
        )}

        {/* Secrets fields */}
        {secretsFields.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold pt-1">Credentials</p>
            <p className="text-[11px] text-amber-400/80 -mt-2">
              Credentials are encrypted at rest using pgcrypto. They cannot be viewed after saving — only replaced.
            </p>
            {secretsFields.map(f => (
              <FormField key={f.key} def={f} value={secrets[f.key] ?? ''} onChange={v => setSec(f.key, v)} />
            ))}
          </>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2">{error}</p>
        )}
      </div>

      <div className="flex gap-2 px-5 py-4 border-t border-slate-800 flex-shrink-0">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 px-3 h-9 text-sm text-slate-400 border border-slate-700/60 rounded-md
            hover:bg-slate-800 hover:text-slate-200 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <button type="submit" disabled={saving || !displayName.trim()}
          className="flex-1 h-9 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : <>
            <CheckCircle2 className="w-3.5 h-3.5" /> Create Connection
          </>}
        </button>
      </div>
    </form>
  );
}

// ─── Root dialog ─────────────────────────────────────────────────────────────

export function CreateConnectionDialog() {
  const dispatch          = useAppDispatch();
  const { connectorTypes, technologies, preselectedTechCode } = useAppSelector(s => s.connections);
  const [typesLoading, setTypesLoading] = useState(false);
  const [selected, setSelected]         = useState<ConnectorType | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    if (connectorTypes.length === 0) {
      setTypesLoading(true);
      dispatch(fetchConnectorTypes()).finally(() => setTypesLoading(false));
    }
  }, [dispatch, connectorTypes.length]);

  // Auto-select the technology when preselectedTechCode is provided
  useEffect(() => {
    if (preselectedTechCode && connectorTypes.length > 0 && !selected) {
      const match = connectorTypes.find(
        t => t.typeCode.toUpperCase() === preselectedTechCode.toUpperCase(),
      );
      if (match) setSelected(match);
    }
  }, [preselectedTechCode, connectorTypes, selected]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected) { setSelected(null); setError(null); }
        else dispatch(closeCreateConnection());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, selected]);

  const handleSave = async (
    displayName: string,
    config: Record<string, string>,
    secrets: Record<string, string>,
  ) => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    // Resolve technologyId from technologies list (match by techCode = typeCode)
    const tech = technologies.find(
      t => t.techCode.toUpperCase() === selected.typeCode.toUpperCase(),
    );
    try {
      await dispatch(createConnector({
        connectorDisplayName: displayName,
        connectorTypeCode:    selected.typeCode,
        config,
        secrets,
        technologyId: tech?.techId ?? null,
      })).unwrap();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : (err?.userMessage ?? 'Failed to create connection'));
      setSaving(false);
    }
  };

  const title    = selected ? `Configure ${selected.displayName}` : 'New Connection';
  const subtitle = selected ? 'Enter connection details and credentials' : 'Select the target technology';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => dispatch(closeCreateConnection())}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative bg-[#1a1d27] border border-slate-700/60 rounded-xl shadow-2xl w-full max-w-[560px] mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={() => dispatch(closeCreateConnection())}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {!selected ? (
          typesLoading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-slate-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading technologies…
            </div>
          ) : connectorTypes.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
              No technologies available — is the backend running?
            </div>
          ) : (
            <TechPicker types={connectorTypes} onSelect={setSelected} />
          )
        ) : (
          <ConfigForm
            type={selected}
            onBack={() => { setSelected(null); setError(null); }}
            onSave={handleSave}
            saving={saving}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
