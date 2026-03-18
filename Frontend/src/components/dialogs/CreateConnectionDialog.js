import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeCreateConnection, fetchConnectorTypes, createConnector } from '@/store/slices/connectionsSlice';
import { X, ChevronLeft, Loader2, Eye, EyeOff, Search, CheckCircle2 } from 'lucide-react';
// ─── Category colour map ─────────────────────────────────────────────────────
const CAT_PALETTE = {
    'Cloud Storage': { bg: 'bg-sky-500/10', text: 'text-sky-300', border: 'border-sky-500/20' },
    'Cloud Warehouse': { bg: 'bg-violet-500/10', text: 'text-violet-300', border: 'border-violet-500/20' },
    'JDBC': { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/20' },
    'File': { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/20' },
    'Streaming': { bg: 'bg-pink-500/10', text: 'text-pink-300', border: 'border-pink-500/20' },
};
const DEFAULT_PAL = { bg: 'bg-slate-700/50', text: 'text-slate-300', border: 'border-slate-600' };
function pal(cat) {
    return CAT_PALETTE[cat] ?? DEFAULT_PAL;
}
// Abbreviate long type display names for tile labels
function shortName(name) {
    return name
        .replace('PostgreSQL', 'PostgreSQL')
        .replace('Microsoft SQL Server', 'SQL Server')
        .replace('SAP HANA', 'SAP HANA')
        .replace('Amazon ', 'AWS ')
        .replace('Google ', 'GCP ')
        .replace('Azure ', 'Azure ');
}
// Get initials for the tile icon (2 chars)
function initials(name) {
    const clean = name.replace(/[()]/g, '').trim();
    const words = clean.split(/\s+/);
    if (words.length === 1)
        return clean.slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}
// ─── Step 1: Technology grid ─────────────────────────────────────────────────
function TechPicker({ types, onSelect }) {
    const [search, setSearch] = useState('');
    // Group by category
    const groups = {};
    for (const t of types) {
        const cat = t.category ?? 'Other';
        (groups[cat] ?? (groups[cat] = [])).push(t);
    }
    const filtered = search.trim()
        ? Object.entries(groups).reduce((acc, [cat, items]) => {
            const hits = items.filter(t => t.displayName.toLowerCase().includes(search.toLowerCase()) ||
                t.typeCode.toLowerCase().includes(search.toLowerCase()));
            if (hits.length)
                acc[cat] = hits;
            return acc;
        }, {})
        : groups;
    const cats = Object.keys(filtered).sort();
    return (_jsxs("div", { className: "flex flex-col max-h-[520px]", children: [_jsx("div", { className: "px-5 py-3 border-b border-slate-800 flex-shrink-0", children: _jsxs("div", { className: "flex items-center gap-2 h-8 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3", children: [_jsx(Search, { className: "w-3.5 h-3.5 text-slate-500 flex-shrink-0" }), _jsx("input", { autoFocus: true, type: "text", value: search, onChange: e => setSearch(e.target.value), placeholder: "Search technologies\u2026", className: "flex-1 bg-transparent text-[13px] text-slate-200 placeholder-slate-600 outline-none min-w-0" })] }) }), _jsxs("div", { className: "flex-1 overflow-y-auto px-5 py-4 space-y-5", children: [cats.length === 0 && (_jsxs("div", { className: "text-center text-slate-600 text-sm py-8", children: ["No technologies match \"", search, "\""] })), cats.map(cat => {
                        const p = pal(cat);
                        return (_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-2", children: cat }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: (filtered[cat] ?? []).map(t => (_jsxs("button", { onClick: () => onSelect(t), className: `flex flex-col items-center gap-2 p-3 rounded-lg border ${p.border} ${p.bg}
                      hover:brightness-125 hover:scale-[1.03] active:scale-100
                      text-slate-400 transition-all group`, children: [_jsx("span", { className: `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${p.bg} ${p.text} border ${p.border}`, children: initials(t.displayName) }), _jsx("span", { className: `text-[10px] font-medium text-center leading-tight line-clamp-2 ${p.text}`, children: shortName(t.displayName) })] }, t.typeCode))) })] }, cat));
                    })] })] }));
}
function buildFields(type) {
    const fields = [];
    const configReq = new Set(type.configSchema?.required ?? []);
    const secretsReq = new Set(type.secretsSchema?.required ?? []);
    for (const [k, v] of Object.entries(type.configSchema?.properties ?? {}))
        fields.push({ key: k, schema: v, required: configReq.has(k), isSecret: false });
    for (const [k, v] of Object.entries(type.secretsSchema?.properties ?? {}))
        fields.push({ key: k, schema: v, required: secretsReq.has(k), isSecret: true });
    return fields;
}
function FormField({ def, value, onChange }) {
    const [show, setShow] = useState(false);
    const s = def.schema;
    const label = s.title ?? def.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const inputType = def.isSecret && !show ? 'password' : (s.type === 'integer' || s.type === 'number' ? 'number' : 'text');
    return (_jsxs("div", { children: [_jsxs("label", { className: "flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5", children: [label, def.required && _jsx("span", { className: "text-red-400", children: "*" }), def.isSecret && (_jsx("span", { className: "px-1.5 py-0.5 bg-amber-900/30 border border-amber-700/40 text-amber-400 text-[10px] rounded", children: "secret" }))] }), _jsxs("div", { className: "relative", children: [s.enum ? (_jsxs("select", { value: value, onChange: e => onChange(e.target.value), className: "w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100\n              focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all appearance-none", children: [_jsx("option", { value: "", children: "\u2014 Select \u2014" }), s.enum.map((v) => _jsx("option", { value: v, children: v }, v))] })) : (_jsx("input", { type: inputType, value: value, onChange: e => onChange(e.target.value), placeholder: s.default != null ? String(s.default) : (s.description ?? ''), className: "w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100\n              placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all pr-8" })), def.isSecret && !s.enum && (_jsx("button", { type: "button", onClick: () => setShow(v => !v), className: "absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300", children: show ? _jsx(EyeOff, { className: "w-3.5 h-3.5" }) : _jsx(Eye, { className: "w-3.5 h-3.5" }) }))] }), s.description && !s.enum && (_jsx("p", { className: "mt-1 text-[11px] text-slate-600", children: s.description }))] }));
}
function ConfigForm({ type, onBack, onSave, saving, error }) {
    const [displayName, setDisplayName] = useState('');
    const [config, setConfig] = useState({});
    const [secrets, setSecrets] = useState({});
    const fields = buildFields(type);
    const configFields = fields.filter(f => !f.isSecret);
    const secretsFields = fields.filter(f => f.isSecret);
    const setConf = useCallback((k, v) => setConfig(p => ({ ...p, [k]: v })), []);
    const setSec = useCallback((k, v) => setSecrets(p => ({ ...p, [k]: v })), []);
    const p = pal(type.category ?? '');
    const submit = (e) => {
        e.preventDefault();
        onSave(displayName.trim(), config, secrets);
    };
    return (_jsxs("form", { onSubmit: submit, className: "flex flex-col max-h-[560px]", children: [_jsxs("div", { className: "flex-1 overflow-y-auto px-5 py-4 space-y-4", children: [_jsxs("div", { className: `flex items-center gap-3 p-3 rounded-lg border ${p.border} ${p.bg}`, children: [_jsx("span", { className: `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${p.bg} ${p.text} border ${p.border} flex-shrink-0`, children: initials(type.displayName) }), _jsxs("div", { children: [_jsx("div", { className: `text-sm font-semibold ${p.text}`, children: type.displayName }), _jsx("div", { className: "text-[11px] text-slate-500", children: type.category })] }), type.defaultPort && (_jsxs("div", { className: "ml-auto text-[11px] text-slate-500", children: ["Default port: ", _jsx("span", { className: "text-slate-300 font-mono", children: type.defaultPort })] }))] }), _jsxs("div", { children: [_jsxs("label", { className: "block text-xs font-medium text-slate-400 mb-1.5", children: ["Connection name ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("input", { autoFocus: true, type: "text", value: displayName, onChange: e => setDisplayName(e.target.value), placeholder: `e.g. Production ${type.displayName}`, className: "w-full h-9 px-3 bg-slate-800/60 border border-slate-700/60 rounded-md text-sm text-slate-100\n              placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all" })] }), configFields.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[10px] uppercase tracking-widest text-slate-600 font-semibold pt-1", children: "Connection Details" }), configFields.map(f => (_jsx(FormField, { def: f, value: config[f.key] ?? '', onChange: v => setConf(f.key, v) }, f.key)))] })), secretsFields.length > 0 && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[10px] uppercase tracking-widest text-slate-600 font-semibold pt-1", children: "Credentials" }), _jsx("p", { className: "text-[11px] text-amber-400/80 -mt-2", children: "Credentials are encrypted at rest using pgcrypto. They cannot be viewed after saving \u2014 only replaced." }), secretsFields.map(f => (_jsx(FormField, { def: f, value: secrets[f.key] ?? '', onChange: v => setSec(f.key, v) }, f.key)))] })), error && (_jsx("p", { className: "text-xs text-red-400 bg-red-950/40 border border-red-900/30 rounded-md px-3 py-2", children: error }))] }), _jsxs("div", { className: "flex gap-2 px-5 py-4 border-t border-slate-800 flex-shrink-0", children: [_jsxs("button", { type: "button", onClick: onBack, className: "flex items-center gap-1.5 px-3 h-9 text-sm text-slate-400 border border-slate-700/60 rounded-md\n            hover:bg-slate-800 hover:text-slate-200 transition-colors", children: [_jsx(ChevronLeft, { className: "w-3.5 h-3.5" }), " Back"] }), _jsx("button", { type: "submit", disabled: saving || !displayName.trim(), className: "flex-1 h-9 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-500\n            disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2", children: saving ? _jsxs(_Fragment, { children: [_jsx(Loader2, { className: "w-3.5 h-3.5 animate-spin" }), " Creating\u2026"] }) : _jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5" }), " Create Connection"] }) })] })] }));
}
// ─── Root dialog ─────────────────────────────────────────────────────────────
export function CreateConnectionDialog() {
    const dispatch = useAppDispatch();
    const { connectorTypes } = useAppSelector(s => s.connections);
    const [typesLoading, setTypesLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (connectorTypes.length === 0) {
            setTypesLoading(true);
            dispatch(fetchConnectorTypes()).finally(() => setTypesLoading(false));
        }
    }, [dispatch, connectorTypes.length]);
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                if (selected) {
                    setSelected(null);
                    setError(null);
                }
                else
                    dispatch(closeCreateConnection());
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [dispatch, selected]);
    const handleSave = async (displayName, config, secrets) => {
        if (!selected)
            return;
        setSaving(true);
        setError(null);
        try {
            await dispatch(createConnector({
                connectorDisplayName: displayName,
                connectorTypeCode: selected.typeCode,
                connConfig: config,
                connSecrets: secrets,
            })).unwrap();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : (err?.userMessage ?? 'Failed to create connection'));
            setSaving(false);
        }
    };
    const title = selected ? `Configure ${selected.displayName}` : 'New Connection';
    const subtitle = selected ? 'Enter connection details and credentials' : 'Select the target technology';
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center", onClick: () => dispatch(closeCreateConnection()), children: [_jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }), _jsxs("div", { className: "relative bg-[#1a1d27] border border-slate-700/60 rounded-xl shadow-2xl w-full max-w-[560px] mx-4 overflow-hidden", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800 flex-shrink-0", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h2", { className: "text-sm font-semibold text-slate-100", children: title }), _jsx("p", { className: "text-[11px] text-slate-500 mt-0.5", children: subtitle })] }), _jsx("button", { onClick: () => dispatch(closeCreateConnection()), className: "w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors", children: _jsx(X, { className: "w-4 h-4" }) })] }), !selected ? (typesLoading ? (_jsxs("div", { className: "flex items-center justify-center h-48 gap-2 text-slate-600 text-sm", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), " Loading technologies\u2026"] })) : connectorTypes.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-48 text-slate-600 text-sm", children: "No technologies available \u2014 is the backend running?" })) : (_jsx(TechPicker, { types: connectorTypes, onSelect: setSelected }))) : (_jsx(ConfigForm, { type: selected, onBack: () => { setSelected(null); setError(null); }, onSave: handleSave, saving: saving, error: error }))] })] }));
}
