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
import { X, ChevronLeft, Loader2, Eye, EyeOff, Search, CheckCircle2, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import apiClient from '@/services/api';

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

function findConnectorTypeForTechCode(types: ConnectorType[], techCode: string): ConnectorType | null {
  const normalized = techCode.trim().toUpperCase();
  if (!normalized) return null;

  return types.find(t => t.typeCode.toUpperCase() === normalized)
    ?? types.find(t => t.typeCode.toUpperCase() === `FILE_${normalized}`)
    ?? types.find(t => t.typeCode.toUpperCase() === `JDBC_${normalized}`)
    ?? types.find(t => t.typeCode.toUpperCase().endsWith(`_${normalized}`))
    ?? types.find(t => t.displayName.trim().toUpperCase() === normalized)
    ?? types.find(t => t.displayName.toUpperCase().includes(normalized))
    ?? null;
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
          <Search className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search technologies…"
            className="flex-1 bg-transparent text-[13px] text-slate-200 placeholder-slate-500 outline-none min-w-0"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {cats.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">No technologies match "{search}"</div>
        )}
        {cats.map(cat => {
          const p = pal(cat);
          return (
            <div key={cat}>
              <p className="text-[12px] uppercase tracking-widest text-slate-400 font-semibold mb-2">{cat}</p>
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
                    <span className={`text-[12px] font-medium text-center leading-tight line-clamp-2 ${p.text}`}>
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

// SSL cert fields — only visible when ssl_mode != DISABLE
const SSL_CERT_KEYS = new Set(['jdbc_ssl_ca_cert', 'jdbc_ssl_client_cert', 'jdbc_ssl_client_key']);
// SSH child fields — only visible when ssh_tunnel_enabled = true
const SSH_CHILD_KEYS = new Set(['ssh_host', 'ssh_port', 'ssh_username', 'ssh_private_key']);
// Advanced / performance fields — collapsed by default
const ADVANCED_KEYS = new Set(['jdbc_url_params', 'jdbc_connection_timeout_sec', 'jdbc_socket_timeout_sec', 'jdbc_fetch_size']);

function FormField({
  def, value, onChange, disabled = false,
}: {
  def: FieldDef; value: string; onChange: (v: string) => void; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const s = def.schema as any;
  const label = s.title ?? def.key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const isBoolean = s.type === 'boolean';
  const inputType = def.isSecret && !show ? 'password' : (s.type === 'integer' || s.type === 'number' ? 'number' : 'text');

  if (isBoolean) {
    const checked = value === 'true';
    return (
      <div className={`flex items-center justify-between py-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <label className="text-xs font-medium text-slate-300">{label}</label>
        <button
          type="button"
          onClick={() => onChange(checked ? 'false' : 'true')}
          className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#161b25] shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
        {label}
        {def.required && <span className="text-red-400">*</span>}
        {def.isSecret && (
          <span className="px-1.5 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 text-[12px] rounded">secret</span>
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
            {(s.enum as string[]).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input
            type={inputType}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={s.default != null ? String(s.default) : (s.description ?? '')}
            className="w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100
              placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all pr-8"
          />
        )}
        {def.isSecret && !s.enum && (
          <button type="button" onClick={() => setShow(v => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-300">
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {s.description && !s.enum && (
        <p className="text-[12px] text-slate-400 leading-tight">{s.description}</p>
      )}
    </div>
  );
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

function ConfigForm({ type, onBack, onSave, saving, error }: {
  type: ConnectorType;
  onBack: () => void;
  onSave: (displayName: string, config: Record<string, string>, secrets: Record<string, string>) => void;
  saving: boolean;
  error: string | null;
}) {
  const [displayName, setDisplayName] = useState('');
  const [config,  setConfig]  = useState<Record<string, string>>({});
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [advOpen, setAdvOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMsg,    setTestMsg]    = useState('');

  const setConf = useCallback((k: string, v: string) => setConfig(p => ({ ...p, [k]: v })), []);
  const setSec  = useCallback((k: string, v: string) => setSecrets(p => ({ ...p, [k]: v })), []);

  const p = pal(type.category ?? '');

  // Derive all fields from schemas
  const configReq  = new Set(type.configSchema?.required  ?? []);
  const secretsReq = new Set(type.secretsSchema?.required ?? []);
  const allConfig: FieldDef[]  = Object.entries(type.configSchema?.properties  ?? {}).map(([k, v]) => ({ key: k, schema: v, required: configReq.has(k),  isSecret: false }));
  const allSecrets: FieldDef[] = Object.entries(type.secretsSchema?.properties ?? {}).map(([k, v]) => ({ key: k, schema: v, required: secretsReq.has(k), isSecret: true  }));

  // SSL state: derive from current config value
  const sslMode      = config['jdbc_ssl_mode'] ?? '';
  const sslEnabled   = sslMode !== '' && sslMode !== 'DISABLE';
  // SSL cert secrets — only relevant when ssl enabled
  const sslCertFields = allSecrets.filter(f => SSL_CERT_KEYS.has(f.key));
  // SSH state
  const sshEnabled = config['ssh_tunnel_enabled'] === 'true';

  // Group fields:
  // Core required config (not SSL cert, not SSH child, not advanced)
  const coreConfig   = allConfig.filter(f => f.required && !ADVANCED_KEYS.has(f.key) && !SSH_CHILD_KEYS.has(f.key));
  // Core required secrets (not SSL cert, not SSH)
  const coreSecrets  = allSecrets.filter(f => f.required && !SSL_CERT_KEYS.has(f.key));
  // SSL mode field (always show in its own section)
  const sslModeField = allConfig.find(f => f.key === 'jdbc_ssl_mode');
  // SSH tunnel toggle + child fields
  const sshToggle    = allConfig.find(f => f.key === 'ssh_tunnel_enabled');
  const sshChildren  = [...allConfig.filter(f => SSH_CHILD_KEYS.has(f.key) && f.key !== 'ssh_private_key'),
                        ...allSecrets.filter(f => f.key === 'ssh_private_key')];
  // Advanced
  const advFields    = allConfig.filter(f => ADVANCED_KEYS.has(f.key));

  const handleTest = async () => {
    setTestStatus('testing');
    setTestMsg('');
    try {
      const res = await apiClient.testConnection({
        connectorTypeCode: type.typeCode,
        config,
        secrets,
      });
      const d = (res.data as any)?.data;
      setTestStatus('ok');
      setTestMsg(d?.message ?? 'Connection successful');
    } catch (err: any) {
      setTestStatus('fail');
      setTestMsg(err?.response?.data?.message ?? err?.message ?? 'Connection failed');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(displayName.trim(), config, secrets);
  };

  return (
    <form onSubmit={submit} className="flex flex-col max-h-[600px]">
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">

        {/* Technology badge */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${p.border} ${p.bg}`}>
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${p.bg} ${p.text} border ${p.border} flex-shrink-0`}>
            {initials(type.displayName)}
          </span>
          <div>
            <div className={`text-sm font-semibold ${p.text}`}>{type.displayName}</div>
            <div className="text-[12px] text-slate-300">{type.category}</div>
          </div>
          {type.defaultPort && (
            <div className="ml-auto text-[12px] text-slate-300">Default port: <span className="text-slate-300 font-mono">{type.defaultPort}</span></div>
          )}
        </div>

        {/* ── Connection Name ─────────────────────────────────────── */}
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
              placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>

        {/* ── Core connection details ──────────────────────────────── */}
        {coreConfig.length > 0 && (
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-widest text-slate-400 font-semibold">Connection Details</p>
            {/* host + port side by side when both present */}
            {coreConfig.find(f => f.key === 'jdbc_host') && coreConfig.find(f => f.key === 'jdbc_port') ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <FormField def={coreConfig.find(f => f.key === 'jdbc_host')!} value={config['jdbc_host'] ?? ''} onChange={v => setConf('jdbc_host', v)} />
                  </div>
                  <div>
                    <FormField def={coreConfig.find(f => f.key === 'jdbc_port')!} value={config['jdbc_port'] ?? ''} onChange={v => setConf('jdbc_port', v)} />
                  </div>
                </div>
                {coreConfig.filter(f => f.key !== 'jdbc_host' && f.key !== 'jdbc_port').map(f => (
                  <FormField key={f.key} def={f} value={config[f.key] ?? ''} onChange={v => setConf(f.key, v)} />
                ))}
              </>
            ) : (
              coreConfig.map(f => (
                <FormField key={f.key} def={f} value={config[f.key] ?? ''} onChange={v => setConf(f.key, v)} />
              ))
            )}
          </div>
        )}

        {/* ── Credentials ──────────────────────────────────────────── */}
        {coreSecrets.length > 0 && (
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-widest text-slate-400 font-semibold">Credentials</p>
            <p className="text-[12px] text-amber-400/80 -mt-1">Encrypted at rest via pgcrypto. Cannot be viewed after saving — only replaced.</p>
            {coreSecrets.map(f => (
              <FormField key={f.key} def={f} value={secrets[f.key] ?? ''} onChange={v => setSec(f.key, v)} />
            ))}
          </div>
        )}

        {/* ── SSL ──────────────────────────────────────────────────── */}
        {sslModeField && (
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-widest text-slate-400 font-semibold">SSL / TLS</p>
            <FormField def={sslModeField} value={config['jdbc_ssl_mode'] ?? ''} onChange={v => setConf('jdbc_ssl_mode', v)} />
            {sslCertFields.map(f => (
              <div key={f.key} className={`transition-all ${sslEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <FormField def={f} value={secrets[f.key] ?? ''} onChange={v => setSec(f.key, v)} />
              </div>
            ))}
            {!sslEnabled && sslCertFields.length > 0 && (
              <p className="text-[12px] text-slate-400 -mt-2">SSL certificate fields are only required when SSL mode is not DISABLE.</p>
            )}
          </div>
        )}

        {/* ── SSH Tunnel ───────────────────────────────────────────── */}
        {sshToggle && (
          <div className="space-y-3">
            <p className="text-[12px] uppercase tracking-widest text-slate-400 font-semibold">SSH Tunnel</p>
            <FormField def={sshToggle} value={config['ssh_tunnel_enabled'] ?? 'false'} onChange={v => setConf('ssh_tunnel_enabled', v)} />
            {sshChildren.map(f => (
              <div key={f.key} className={`transition-all ${sshEnabled ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <FormField
                  def={f}
                  value={f.isSecret ? (secrets[f.key] ?? '') : (config[f.key] ?? '')}
                  onChange={v => f.isSecret ? setSec(f.key, v) : setConf(f.key, v)}
                />
              </div>
            ))}
            {!sshEnabled && sshChildren.length > 0 && (
              <p className="text-[12px] text-slate-400 -mt-2">SSH tunnel fields are only required when SSH tunnel is enabled.</p>
            )}
          </div>
        )}

        {/* ── Advanced (collapsible) ───────────────────────────────── */}
        {advFields.length > 0 && (
          <div>
            <button type="button" onClick={() => setAdvOpen(o => !o)}
              className="flex items-center gap-1.5 text-[12px] uppercase tracking-widest text-slate-400 hover:text-slate-400 font-semibold transition-colors">
              {advOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Advanced Options
            </button>
            {advOpen && (
              <div className="mt-3 space-y-3 pl-3 border-l border-slate-800">
                {advFields.map(f => (
                  <FormField key={f.key} def={f} value={config[f.key] ?? ''} onChange={v => setConf(f.key, v)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Test result banner ───────────────────────────────────── */}
        {testStatus === 'ok' && (
          <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-md px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> {testMsg}
          </div>
        )}
        {testStatus === 'fail' && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2">
            <X className="w-3.5 h-3.5 flex-shrink-0" /> {testMsg}
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2">{error}</p>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-5 py-4 border-t border-slate-800 flex-shrink-0">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1.5 px-3 h-9 text-sm text-slate-400 border border-slate-700/60 rounded-md
            hover:bg-slate-800 hover:text-slate-200 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Back
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testStatus === 'testing' || saving}
          className="flex items-center gap-1.5 px-4 h-9 text-sm border rounded-md transition-colors
            border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {testStatus === 'testing'
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…</>
            : <><Zap className="w-3.5 h-3.5" /> Test</>}
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
      const match = findConnectorTypeForTechCode(connectorTypes, preselectedTechCode);
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
    // Resolve technologyId: exact match first, then substring (e.g. JDBC_POSTGRESQL contains POSTGRESQL)
    const typeUpper = selected.typeCode.toUpperCase();
    const tech = technologies.find(t => t.techCode.toUpperCase() === typeUpper)
               ?? technologies.find(t => typeUpper.includes(t.techCode.toUpperCase()));
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

  const pendingPreselected = !selected && preselectedTechCode
    ? findConnectorTypeForTechCode(connectorTypes, preselectedTechCode)
    : null;
  const title    = selected
    ? `Configure ${selected.displayName}`
    : pendingPreselected
    ? `Configure ${pendingPreselected.displayName}`
    : 'New Connection';
  const subtitle = selected
    ? 'Enter connection details and credentials'
    : pendingPreselected
    ? 'Loading the selected technology…'
    : 'Select the target technology';

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
            <p className="text-[12px] text-slate-300 mt-0.5">{subtitle}</p>
          </div>
          <button onClick={() => dispatch(closeCreateConnection())}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-300 hover:bg-slate-700/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {!selected ? (
          pendingPreselected ? (
            <div className="flex items-center justify-center h-48 gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading {pendingPreselected.displayName}…
            </div>
          ) :
          typesLoading ? (
            <div className="flex items-center justify-center h-48 gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading technologies…
            </div>
          ) : connectorTypes.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
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
