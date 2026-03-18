/**
 * ConnectionWorkspace — tab content for a Connection object.
 * Sub-tabs: Properties | Authentication | Connectivity | Usage | History | Permissions | Security
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Save, TestTube2, RefreshCw, Eye, EyeOff, CheckCircle2,
  XCircle, Loader2, AlertTriangle, Clock,
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { markTabUnsaved, markTabSaved } from '@/store/slices/tabsSlice';
import { SubTabBar } from '@/components/shared/SubTabBar';
import { ObjectHeader } from '@/components/shared/ObjectHeader';
import { ObjectHistoryGrid } from '@/components/shared/ObjectHistoryGrid';
import { ObjectPermissionsGrid } from '@/components/shared/ObjectPermissionsGrid';
import type { ConnectionSubTab } from '@/types';
import api from '@/services/api';

const SUB_TABS = [
  { id: 'properties',    label: 'Properties',    shortcut: '1' },
  { id: 'authentication',label: 'Authentication', shortcut: '2' },
  { id: 'connectivity',  label: 'Connectivity',  shortcut: '3' },
  { id: 'usage',         label: 'Usage',         shortcut: '4' },
  { id: 'history',       label: 'History',       shortcut: '5' },
  { id: 'permissions',   label: 'Permissions',   shortcut: '6' },
  { id: 'security',      label: 'Security',      shortcut: '7' },
] satisfies { id: ConnectionSubTab; label: string; shortcut: string }[];

type FD = Record<string, unknown>;

function Field({ label, field, value, onChange, ro, secret, placeholder }: {
  label: string; field: string; value: string; onChange?: (f: string, v: string) => void;
  ro?: boolean; secret?: boolean; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">{label}</label>
      <div className="relative">
        {ro ? (
          <div className="h-8 flex items-center px-3 bg-slate-900/50 border border-slate-800 rounded text-[12px] text-slate-500 font-mono">{value || '—'}</div>
        ) : (
          <input
            type={secret && !show ? 'password' : 'text'}
            value={value}
            onChange={e => onChange?.(field, e.target.value)}
            placeholder={placeholder}
            className="w-full h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 pr-8"
          />
        )}
        {secret && !ro && (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Properties sub-tab ───────────────────────────────────────────────────

function PropertiesTab({ data, onChange }: { data: FD; onChange: (f: string, v: string) => void }) {
  const F = (p: { label: string; field: string; ro?: boolean; placeholder?: string }) => (
    <Field label={p.label} field={p.field} value={String(data[p.field] ?? '')} onChange={onChange} ro={p.ro} placeholder={p.placeholder} />
  );
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <F label="Connection ID" field="connectionId" ro />
        <F label="Connection Name *" field="name" />
        <div className="grid grid-cols-2 gap-4">
          <F label="Technology Type" field="technologyType" />
          <F label="Vendor / Platform" field="vendor" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Category" field="category" />
          <F label="Environment" field="environment" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Host / Endpoint" field="host" placeholder="hostname or IP" />
          <F label="Port" field="port" placeholder="5432" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Database / Bucket / Container" field="database" />
          <F label="Region" field="region" />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Description</label>
          <textarea rows={2} value={String(data.description ?? '')} onChange={e => onChange('description', e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 resize-none" />
        </div>
        <F label="Tags (comma separated)" field="tags" />
        <div className="border-t border-slate-800 pt-4 grid grid-cols-2 gap-4">
          <F label="Owner" field="owner" />
          <F label="Status" field="status" ro />
          <F label="Created By" field="createdBy" ro />
          <F label="Created On" field="createdOn" ro />
          <F label="Updated By" field="updatedBy" ro />
          <F label="Updated On" field="updatedOn" ro />
        </div>
      </div>
    </div>
  );
}

// ─── Authentication sub-tab ───────────────────────────────────────────────

function AuthenticationTab({ data, onChange }: { data: FD; onChange: (f: string, v: string) => void }) {
  const authMode = String(data.authMode ?? 'username_password');
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl space-y-4">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Authentication Mode</label>
          <select
            value={authMode}
            onChange={e => onChange('authMode', e.target.value)}
            className="h-8 px-3 bg-slate-800 border border-slate-700 rounded text-[12px] text-slate-200 outline-none focus:border-blue-500 w-full"
          >
            <option value="username_password">Username / Password</option>
            <option value="key_file">Key File</option>
            <option value="oauth">OAuth 2.0</option>
            <option value="iam_role">IAM Role</option>
            <option value="service_account">Service Account</option>
            <option value="no_auth">No Authentication</option>
          </select>
        </div>

        {(authMode === 'username_password' || authMode === 'key_file') && (
          <Field label="Username" field="username" value={String(data.username ?? '')} onChange={onChange} />
        )}

        {authMode === 'username_password' && (
          <Field label="Password" field="password" value={String(data.password ?? '')} onChange={onChange} secret placeholder="Stored securely — not displayed" />
        )}

        {authMode === 'key_file' && (
          <Field label="Key File Reference" field="keyFileRef" value={String(data.keyFileRef ?? '')} onChange={onChange} placeholder="vault:// or secret:// reference" />
        )}

        {authMode === 'oauth' && (
          <>
            <Field label="Client ID" field="oauthClientId" value={String(data.oauthClientId ?? '')} onChange={onChange} />
            <Field label="Client Secret" field="oauthClientSecret" value={String(data.oauthClientSecret ?? '')} onChange={onChange} secret />
            <Field label="Token Endpoint" field="oauthTokenEndpoint" value={String(data.oauthTokenEndpoint ?? '')} onChange={onChange} />
            <div className="bg-slate-800/40 border border-slate-700 rounded p-3 text-[12px]">
              <span className="text-slate-500">Token Expiry: </span>
              <span className="text-slate-300">{String(data.tokenExpiry ?? 'Unknown')}</span>
            </div>
          </>
        )}

        {authMode === 'service_account' && (
          <Field label="Service Account JSON Path" field="serviceAccountPath" value={String(data.serviceAccountPath ?? '')} onChange={onChange} />
        )}

        <div className="border-t border-slate-800 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="ssl" checked={Boolean(data.sslEnabled)} onChange={e => onChange('sslEnabled', String(e.target.checked))} className="w-3.5 h-3.5 accent-blue-500" />
            <label htmlFor="ssl" className="text-[12px] text-slate-300">SSL / TLS Enabled</label>
          </div>
          {data.sslEnabled && (
            <Field label="Certificate Alias" field="certAlias" value={String(data.certAlias ?? '')} onChange={onChange} placeholder="Optional — leave blank for default" />
          )}
        </div>

        <div className="bg-amber-900/20 border border-amber-700/40 rounded p-3 text-[11px] text-amber-300/80">
          Sensitive values are stored encrypted. Existing secrets cannot be viewed after save — only replaced.
        </div>
      </div>
    </div>
  );
}

// ─── Connectivity sub-tab ─────────────────────────────────────────────────

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

function ConnectivityTab({ connectionId }: { connectionId: string }) {
  const [status, setStatus]     = useState<TestStatus>('idle');
  const [lastResult, setResult] = useState<{ testedBy: string; testedOn: string; responseMs?: number; error?: string } | null>(null);

  const runTest = useCallback(async () => {
    setStatus('testing');
    try {
      const res = await api.testConnectionById(connectionId);
      const d = res.data?.data ?? res.data;
      setStatus('success');
      setResult({ testedBy: 'You', testedOn: new Date().toLocaleString(), responseMs: d?.responseMs });
    } catch (err: unknown) {
      setStatus('failed');
      setResult({ testedBy: 'You', testedOn: new Date().toLocaleString(), error: (err as { response?: { data?: { userMessage?: string } } })?.response?.data?.userMessage ?? 'Connection failed' });
    }
  }, [connectionId]);

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg space-y-4">
        <button
          onClick={runTest}
          disabled={status === 'testing'}
          className="flex items-center gap-2 h-9 px-5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-60"
        >
          {status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
          {status === 'testing' ? 'Testing…' : 'Test Connection'}
        </button>

        {status === 'success' && lastResult && (
          <div className="flex items-start gap-3 p-4 bg-emerald-900/30 border border-emerald-700/50 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-medium text-emerald-300">Connection Successful</div>
              {lastResult.responseMs !== undefined && (
                <div className="text-[12px] text-slate-400 mt-0.5">Response time: {lastResult.responseMs}ms</div>
              )}
              <div className="text-[11px] text-slate-500 mt-1">Tested by {lastResult.testedBy} · {lastResult.testedOn}</div>
            </div>
          </div>
        )}

        {status === 'failed' && lastResult && (
          <div className="flex items-start gap-3 p-4 bg-red-900/30 border border-red-700/50 rounded-lg">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-medium text-red-300">Connection Failed</div>
              <div className="text-[12px] text-slate-400 mt-0.5">{lastResult.error}</div>
              <div className="text-[11px] text-slate-500 mt-1">Tested by {lastResult.testedBy} · {lastResult.testedOn}</div>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div className="text-[12px] text-slate-600 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" /> Click "Test Connection" to verify connectivity.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Usage sub-tab ────────────────────────────────────────────────────────

function UsageTab() {
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-2xl">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-3">Used By</div>
        <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-slate-800 rounded-lg">
          <RefreshCw className="w-6 h-6 mb-2 opacity-40" />
          <p className="text-sm">Usage data will be loaded once the connection is saved and in use.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Security sub-tab ─────────────────────────────────────────────────────

function SecurityTab({ data }: { data: FD }) {
  const rows = [
    { label: 'Secret Source',     value: String(data.secretSource ?? 'Platform Vault') },
    { label: 'Rotation Policy',   value: String(data.rotationPolicy ?? 'Manual') },
    { label: 'Last Rotated On',   value: String(data.lastRotatedOn ?? '—') },
    { label: 'Rotation Owner',    value: String(data.rotationOwner ?? '—') },
    { label: 'Masking Status',    value: String(data.maskingStatus ?? 'Enabled') },
  ];
  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="max-w-lg bg-slate-800/30 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide mb-2">Security Configuration</div>
        {rows.map(r => (
          <div key={r.label} className="flex items-center text-[12px]">
            <span className="text-slate-500 w-40 flex-shrink-0">{r.label}</span>
            <span className="text-slate-300">{r.value}</span>
          </div>
        ))}
        <div className="pt-2 border-t border-slate-700">
          <div className="text-[11px] text-slate-500 mb-1">Restricted Fields</div>
          <div className="flex flex-wrap gap-1">
            {['password', 'secret', 'token', 'key'].map(f => (
              <span key={f} className="px-2 py-0.5 bg-red-900/30 border border-red-700/40 text-red-300 text-[11px] rounded">{f}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 text-[12px] text-amber-300/80 max-w-lg">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        Secret fields are masked by default. Only users with Manage Secrets permission can modify secret references.
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────

export function ConnectionWorkspace({ tabId }: { tabId: string }) {
  const dispatch       = useAppDispatch();
  const tab            = useAppSelector(s => s.tabs.allTabs.find(t => t.id === tabId));
  const subTab         = (useAppSelector(s => s.ui.subTabMap[tabId]) ?? 'properties') as ConnectionSubTab;
  const connectionId   = tab?.objectId ?? '';
  const connectionName = tab?.objectName ?? 'Connection';

  const [formData, setFormData] = useState<FD>({
    connectionId,
    name: connectionName,
    technologyType: '',
    vendor: '',
    category: '',
    environment: 'Development',
    host: '', port: '', database: '', region: '',
    description: '', tags: '', owner: '',
    authMode: 'username_password',
    username: '', password: '', sslEnabled: false, certAlias: '',
    status: 'active',
    createdBy: '—', createdOn: '—', updatedBy: '—', updatedOn: '—',
    secretSource: 'Platform Vault', rotationPolicy: 'Manual', maskingStatus: 'Enabled',
  });
  const [isDirty, setIsDirty]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!connectionId) return;
    api.getConnection(connectionId).then(res => {
      const d = res.data?.data ?? res.data;
      if (d) setFormData(prev => ({ ...prev, ...d }));
    }).catch(() => {/* use defaults */});
  }, [connectionId]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    dispatch(markTabUnsaved(tabId));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateConnection(connectionId, formData);
      setIsDirty(false);
      dispatch(markTabSaved(tabId));
    } catch { /* noop */ }
    finally { setIsSaving(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0f1a]">
      <ObjectHeader
        type="connection"
        name={String(formData.name ?? connectionName)}
        hierarchyPath={tab?.hierarchyPath ?? `Connections → ${connectionName}`}
        status="published"
        isDirty={isDirty}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => api.testConnectionById(connectionId)}
              className="flex items-center gap-1.5 h-7 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[12px] font-medium transition-colors"
            >
              <TestTube2 className="w-3.5 h-3.5" /> Test
            </button>
            {isDirty && (
              <button
                onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-1.5 h-7 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded text-[12px] font-medium transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        }
      />
      <SubTabBar tabId={tabId} tabs={SUB_TABS} defaultTab="properties" />

      {subTab === 'properties'     && <PropertiesTab data={formData} onChange={handleChange} />}
      {subTab === 'authentication' && <AuthenticationTab data={formData} onChange={handleChange} />}
      {subTab === 'connectivity'   && <ConnectivityTab connectionId={connectionId} />}
      {subTab === 'usage'          && <UsageTab />}
      {subTab === 'history'        && <div className="flex-1 overflow-hidden"><ObjectHistoryGrid rows={[]} /></div>}
      {subTab === 'permissions'    && <div className="flex-1 overflow-hidden"><ObjectPermissionsGrid rows={[]} /></div>}
      {subTab === 'security'       && <SecurityTab data={formData} />}
    </div>
  );
}
