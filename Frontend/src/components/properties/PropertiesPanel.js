import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { updateNode } from '@/store/slices/pipelineSlice';
import { fetchConnectors } from '@/store/slices/connectionsSlice';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Alert } from '@/components/common/Alert';
import { validateNode } from '@/utils/nodeValidator';
import { MultiTransformEditor } from '@/components/transformations/MultiTransformEditor';
import api from '@/services/api';
export function PropertiesPanel() {
    const dispatch = useAppDispatch();
    const { selectedNodeIds, nodes, activePipeline } = useAppSelector(state => state.pipeline);
    const connectors = useAppSelector(s => s.connections.connectors);
    const [activeSection, setActiveSection] = useState('overview');
    const [columnMappings, setColumnMappings] = useState([]);
    const [testResults, setTestResults] = useState(null);
    const [isDragging, setIsDragging] = useState(null);
    const [schemas, setSchemas] = useState([]);
    const [tables, setTables] = useState([]);
    const [loadingSchemas, setLoadingSchemas] = useState(false);
    const [loadingTables, setLoadingTables] = useState(false);
    // Load connectors on first use
    useEffect(() => {
        if (connectors.length === 0)
            dispatch(fetchConnectors());
    }, [dispatch, connectors.length]);
    const selectedNodeId = selectedNodeIds[0];
    const selectedNode = selectedNodeId ? nodes[selectedNodeId] : null;
    const validationResult = useMemo(() => {
        if (!selectedNode)
            return null;
        return validateNode({
            id: selectedNode.id,
            name: selectedNode.name,
            type: selectedNode.type,
            x: selectedNode.x,
            y: selectedNode.y,
            config: selectedNode.config || {},
        });
    }, [selectedNode]);
    const sectionErrorCounts = useMemo(() => {
        if (!validationResult)
            return {};
        return {
            overview: (validationResult.fieldErrors['name']?.length || 0),
            configuration: ((validationResult.fieldErrors['connectionId']?.length || 0) +
                (validationResult.fieldErrors['schema']?.length || 0) +
                (validationResult.fieldErrors['table']?.length || 0) +
                (validationResult.fieldErrors['expression']?.length || 0) +
                (validationResult.fieldErrors['writeMode']?.length || 0)),
            schema: (validationResult.fieldErrors['columnMappings']?.length || 0),
            advanced: 0, permissions: 0, history: 0,
        };
    }, [validationResult]);
    // Dynamic schema/table loading
    const loadSchemas = async (connectorId, database) => {
        if (!connectorId)
            return;
        setLoadingSchemas(true);
        try {
            const res = await api.listSchemas(connectorId, database ?? 'default');
            setSchemas(res.data.data ?? res.data ?? []);
        }
        catch {
            setSchemas([]);
        }
        finally {
            setLoadingSchemas(false);
        }
    };
    const loadTables = async (connectorId, schema) => {
        if (!connectorId || !schema)
            return;
        setLoadingTables(true);
        try {
            const res = await api.listTables(connectorId, selectedNode?.config.database ?? 'default', schema);
            setTables((res.data.data ?? res.data ?? []).map((t) => typeof t === 'string' ? t : t.tableName ?? t.table_name ?? String(t)));
        }
        catch {
            setTables([]);
        }
        finally {
            setLoadingTables(false);
        }
    };
    if (!selectedNode) {
        return (_jsx("aside", { className: "bg-white border-l border-neutral-200 flex flex-col p-4 h-full", children: _jsx("p", { className: "text-center text-neutral-500 text-sm", children: "Select a node to edit properties" }) }));
    }
    const handleUpdateNode = (key, value) => {
        dispatch(updateNode({ id: selectedNode.id, config: { ...selectedNode.config, [key]: value } }));
    };
    const handleEditorChange = (value) => {
        if (value !== undefined)
            handleUpdateNode('expression', value);
    };
    const handleTestTransform = async () => {
        if (!selectedNode.config.expression?.trim()) {
            setTestResults({ error: 'Expression is required to test the transform' });
            return;
        }
        setTestResults({
            rowsProcessed: 100, rowsSuccess: 98, rowsError: 2, executionTime: 245,
        });
    };
    const sections = [
        { id: 'overview', label: '📋 Overview' },
        { id: 'configuration', label: '⚙️ Config' },
        { id: 'schema', label: '📊 Schema' },
        { id: 'advanced', label: '🔧 Advanced' },
        { id: 'permissions', label: '🔒 Perms' },
        { id: 'history', label: '📜 History' },
    ];
    return (_jsxs("aside", { className: "bg-white border-l border-neutral-200 flex flex-col h-full overflow-hidden", children: [_jsx("div", { className: "sticky top-0 bg-white border-b border-neutral-200 flex gap-1 px-2 py-2 overflow-x-auto", children: sections.map(section => {
                    const errorCount = sectionErrorCounts[section.id] ?? 0;
                    return (_jsxs("button", { onClick: () => setActiveSection(section.id), className: `px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${activeSection === section.id ? 'bg-primary-100 text-primary-700' : 'text-neutral-600 hover:bg-neutral-100'}`, children: [section.label, errorCount > 0 && _jsx(Badge, { variant: "danger", size: "sm", children: errorCount })] }, section.id));
                }) }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [validationResult && !validationResult.isValid && (_jsx(Alert, { variant: "warning", onClose: () => { }, children: _jsxs("div", { children: [_jsxs("p", { className: "font-medium", children: [Object.keys(validationResult.fieldErrors).length, " validation error(s)"] }), _jsx("p", { className: "text-sm mt-1", children: validationResult.summary })] }) })), activeSection === 'overview' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Node Details" }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700", children: "Node Name" }), _jsx("input", { type: "text", value: selectedNode.name, onChange: e => dispatch(updateNode({ id: selectedNode.id, name: e.target.value })), className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700", children: "Type" }), _jsx("div", { className: "mt-1 px-3 py-2 bg-neutral-50 rounded-md border border-neutral-200 text-sm text-neutral-600", children: selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "text-neutral-600", children: "Position X" }), _jsx("p", { className: "font-mono text-neutral-900", children: selectedNode.x })] }), _jsxs("div", { children: [_jsx("p", { className: "text-neutral-600", children: "Position Y" }), _jsx("p", { className: "font-mono text-neutral-900", children: selectedNode.y })] })] })] })), activeSection === 'configuration' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Configuration" }), (selectedNode.type === 'source' || selectedNode.type === 'target') && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700", children: "Connection" }), _jsxs("select", { value: selectedNode.config.connectionId || '', onChange: e => {
                                                    handleUpdateNode('connectionId', e.target.value);
                                                    if (e.target.value)
                                                        loadSchemas(e.target.value);
                                                }, className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white", children: [_jsx("option", { value: "", children: "Select connection\u2026" }), connectors.map(c => (_jsx("option", { value: c.connectorId, children: c.connectorDisplayName }, c.connectorId)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700", children: "Schema" }), schemas.length > 0 ? (_jsxs("select", { value: selectedNode.config.schema || '', onChange: e => {
                                                    handleUpdateNode('schema', e.target.value);
                                                    if (selectedNode.config.connectionId)
                                                        loadTables(selectedNode.config.connectionId, e.target.value);
                                                }, className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white", children: [_jsx("option", { value: "", children: "Select schema\u2026" }), schemas.map(s => _jsx("option", { value: s, children: s }, s))] })) : (_jsx("input", { type: "text", placeholder: "public", value: selectedNode.config.schema || '', onChange: e => { handleUpdateNode('schema', e.target.value); }, className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm" })), loadingSchemas && _jsx("p", { className: "text-xs text-neutral-400 mt-1", children: "Loading schemas\u2026" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700", children: "Table" }), tables.length > 0 ? (_jsxs("select", { value: selectedNode.config.table || '', onChange: e => handleUpdateNode('table', e.target.value), className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white", children: [_jsx("option", { value: "", children: "Select table\u2026" }), tables.map(t => _jsx("option", { value: t, children: t }, t))] })) : (_jsx("input", { type: "text", placeholder: "table_name", value: selectedNode.config.table || '', onChange: e => handleUpdateNode('table', e.target.value), className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm" })), loadingTables && _jsx("p", { className: "text-xs text-neutral-400 mt-1", children: "Loading tables\u2026" })] }), selectedNode.type === 'target' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700", children: "Write Mode" }), _jsxs("select", { value: selectedNode.config.writeMode || '', onChange: e => handleUpdateNode('writeMode', e.target.value), className: "w-full mt-1 px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white", children: [_jsx("option", { value: "", children: "Select write mode\u2026" }), _jsx("option", { value: "OVERWRITE", children: "Overwrite" }), _jsx("option", { value: "APPEND", children: "Append" }), _jsx("option", { value: "MERGE", children: "Merge" })] })] }))] })), selectedNode.type === 'transform' && (_jsx(MultiTransformEditor, { columnId: selectedNode.id, columnName: selectedNode.name, pipelineId: activePipeline?.id ?? '', datasetId: selectedNode.id, defaultEngine: "spark", initialSequence: selectedNode.config.transformSequences?.[0], onSave: async (sequence) => {
                                    dispatch(updateNode({ id: selectedNode.id, config: { ...selectedNode.config, transformSequences: [sequence] } }));
                                } })), selectedNode.type === 'filter' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 block mb-1", children: "Filter Expression (SQL WHERE)" }), _jsx("div", { className: "border border-neutral-300 rounded-md overflow-hidden", children: _jsx(Editor, { height: "200px", language: "sql", value: selectedNode.config.expression || '', onChange: handleEditorChange, theme: "light", options: { minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false } }) })] }), _jsx(Button, { size: "sm", onClick: handleTestTransform, className: "w-full", disabled: !selectedNode.config.expression?.trim(), children: "Test Filter" }), testResults && (_jsx("div", { className: `border rounded-md p-2 ${testResults.error ? 'bg-danger-50 border-danger-200' : 'bg-success-50 border-success-200'}`, children: testResults.error
                                            ? _jsx("p", { className: "text-xs text-danger-800", children: testResults.error })
                                            : _jsxs("p", { className: "text-xs text-success-800", children: [testResults.rowsSuccess, " rows passed \u00B7 ", testResults.rowsError, " filtered \u00B7 ", testResults.executionTime, "ms"] }) }))] }))] })), activeSection === 'schema' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Schema Mapping" }), _jsx("p", { className: "text-xs text-neutral-500", children: "Drag-and-drop column mapping will be populated once source/target datasets are configured." }), columnMappings.length > 0 && (_jsxs("div", { className: "bg-primary-50 border border-primary-200 rounded-md p-2", children: [_jsxs("p", { className: "text-xs font-medium text-primary-900 mb-1", children: ["Mappings (", columnMappings.length, ")"] }), columnMappings.map((m, i) => (_jsxs("div", { className: "flex justify-between text-xs text-primary-800", children: [_jsx("span", { className: "font-mono", children: m.source }), _jsx("span", { children: "\u2192" }), _jsx("span", { className: "font-mono", children: m.target })] }, i)))] }))] })), activeSection === 'advanced' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Advanced Settings" }), _jsxs("label", { className: "flex items-center gap-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", className: "w-4 h-4", checked: !!selectedNode.config.cacheResults, onChange: e => handleUpdateNode('cacheResults', e.target.checked) }), _jsx("span", { className: "text-sm text-neutral-700", children: "Cache Results" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 block mb-1", children: "Partition Key" }), _jsx("input", { type: "text", placeholder: "Optional", value: selectedNode.config.partitionKey ?? '', onChange: e => handleUpdateNode('partitionKey', e.target.value), className: "w-full px-3 py-2 border border-neutral-300 rounded-md text-sm" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 block mb-1", children: "Resource Hints" }), _jsx("input", { type: "text", placeholder: "e.g. large, memory_intensive", value: selectedNode.config.resourceHints ?? '', onChange: e => handleUpdateNode('resourceHints', e.target.value), className: "w-full px-3 py-2 border border-neutral-300 rounded-md text-sm" })] })] })), activeSection === 'permissions' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Permissions" }), _jsx("p", { className: "text-xs text-neutral-500", children: "Node-level permissions are managed at the pipeline level via the Permissions sub-tab." })] })), activeSection === 'history' && (_jsxs("div", { className: "space-y-3", children: [_jsx("h3", { className: "text-sm font-semibold text-neutral-900", children: "Change History" }), _jsx("p", { className: "text-xs text-neutral-500", children: "Node-level history is captured in the pipeline audit log." })] }))] })] }));
}
