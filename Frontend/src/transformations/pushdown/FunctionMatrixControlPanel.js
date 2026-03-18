import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Function Matrix Dev Control Panel
 *
 * React component for developers to:
 * - View current matrix configuration
 * - Toggle categories and functions on/off
 * - See statistics and coverage
 * - Generate reports
 */
import { useState, useEffect } from 'react';
import FunctionMatrixService from './FunctionMatrixService';
import FunctionMatrixDevTools from './FunctionMatrixDevTools';
const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'categories', label: 'Categories' },
    { id: 'technologies', label: 'Technologies' },
    { id: 'validation', label: 'Validation' },
    { id: 'coverage', label: 'Coverage' },
];
/**
 * Function Matrix Control Panel Component
 */
export const FunctionMatrixControlPanel = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [service] = useState(() => FunctionMatrixService.getInstance());
    const [devTools] = useState(() => new FunctionMatrixDevTools(service));
    const [stats, setStats] = useState(service.getStatistics());
    const [validation, setValidation] = useState(null);
    const [flags, setFlags] = useState(service.getFeatureFlags());
    const [categories, setCategories] = useState([]);
    useEffect(() => {
        // Update stats and flags when component mounts or service changes
        setStats(service.getStatistics());
        setFlags(service.getFeatureFlags());
        setCategories(service.getAllCategories());
        setValidation(devTools.validateMatrix());
    }, [service, devTools]);
    const handleToggleCategory = (category) => {
        devTools.toggleCategory(category);
        setStats(service.getStatistics());
        setFlags(service.getFeatureFlags());
        setValidation(devTools.validateMatrix());
    };
    const handleEnableAll = () => {
        devTools.enableAll();
        setStats(service.getStatistics());
        setFlags(service.getFeatureFlags());
        setValidation(devTools.validateMatrix());
    };
    const handleDisableAll = () => {
        devTools.disableAll();
        setStats(service.getStatistics());
        setFlags(service.getFeatureFlags());
        setValidation(devTools.validateMatrix());
    };
    const handleExportJSON = () => {
        const json = devTools.exportAsJSON();
        downloadFile(json, 'function-matrix.json', 'application/json');
    };
    const handleExportMarkdown = () => {
        const md = devTools.generateMarkdownReport();
        downloadFile(md, 'function-matrix-report.md', 'text/markdown');
    };
    const downloadFile = (content, filename, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs("div", { className: "p-6 bg-white rounded-lg shadow-lg max-w-6xl mx-auto", children: [_jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Function Matrix Developer Tools" }), _jsx("p", { className: "text-gray-600", children: "Configure and manage function matrix behavior during development" })] }), _jsx("div", { className: "mb-6 border-b border-gray-200", children: _jsx("div", { className: "flex space-x-1", children: TABS.map(tab => (_jsx("button", { onClick: () => setActiveTab(tab.id), className: `px-4 py-2 font-medium text-sm border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-900'}`, children: tab.label }, tab.id))) }) }), activeTab === 'overview' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsx(StatCard, { label: "Total Functions", value: stats.totalFunctions }), _jsx(StatCard, { label: "Enabled Functions", value: stats.enabledFunctions }), _jsx(StatCard, { label: "Categories", value: stats.totalCategories }), _jsx(StatCard, { label: "Coverage", value: `${Math.round((stats.enabledFunctions / stats.totalFunctions) * 100)}%` })] }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: handleEnableAll, className: "px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors", children: "Enable All" }), _jsx("button", { onClick: handleDisableAll, className: "px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors", children: "Disable All" }), _jsx("button", { onClick: handleExportJSON, className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors", children: "Export JSON" }), _jsx("button", { onClick: handleExportMarkdown, className: "px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors", children: "Export Markdown" })] })] })), activeTab === 'categories' && (_jsxs("div", { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-gray-600 mb-4", children: "Toggle function categories on/off to control which functions are available" }), categories.length === 0 ? (_jsx("p", { className: "text-gray-500 italic", children: "No categories loaded" })) : (_jsx("div", { className: "space-y-2", children: categories.map(category => {
                            const isEnabled = flags.byCategory[category] ?? true;
                            const count = stats.functionsByCategory[category] ?? 0;
                            return (_jsx(CategoryToggle, { category: category, isEnabled: isEnabled, functionCount: count, onToggle: () => handleToggleCategory(category) }, category));
                        }) }))] })), activeTab === 'technologies' && (_jsx("div", { className: "space-y-4", children: service.getAllTechnologies().map(tech => {
                    const functions = service.getFunctionsByTechnology(tech);
                    return (_jsx(TechnologyCard, { technology: tech, functionCount: functions.length, devTools: devTools }, tech));
                }) })), activeTab === 'validation' && validation && (_jsx("div", { className: "space-y-4", children: _jsx(ValidatorResult, { report: validation }) })), activeTab === 'coverage' && (_jsx("div", { className: "overflow-x-auto", children: _jsx(CoverageMatrix, { service: service, stats: stats }) }))] }));
};
/**
 * Stat Card Component
 */
const StatCard = ({ label, value, }) => (_jsxs("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200", children: [_jsx("p", { className: "text-sm text-gray-600 mb-1", children: label }), _jsx("p", { className: "text-3xl font-bold text-blue-600", children: value })] }));
/**
 * Category Toggle Component
 */
const CategoryToggle = ({ category, isEnabled, functionCount, onToggle }) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors", children: [_jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-gray-900", children: category.replace(/_/g, ' ') }), _jsxs("div", { className: "text-sm text-gray-600", children: [functionCount, " functions"] })] }), _jsx("button", { onClick: onToggle, className: `px-4 py-2 rounded font-medium transition-colors ${isEnabled
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`, children: isEnabled ? 'Enabled' : 'Disabled' })] }));
/**
 * Technology Card Component
 */
const TechnologyCard = ({ technology, functionCount, devTools }) => (_jsxs("div", { className: "bg-gray-50 rounded-lg p-4 border border-gray-200", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: technology.charAt(0).toUpperCase() + technology.slice(1) }), _jsx("div", { className: "grid grid-cols-3 gap-4 text-center", children: _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-gray-900", children: functionCount }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "Functions" })] }) })] }));
/**
 * Coverage Matrix Component
 */
const CoverageMatrix = ({ service, stats }) => {
    const categories = service.getAllCategories();
    const technologies = service.getAllTechnologies();
    return (_jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-100 border-b border-gray-300", children: [_jsx("th", { className: "px-4 py-2 text-left font-semibold text-gray-900", children: "Category" }), technologies.map(tech => (_jsx("th", { className: "px-4 py-2 text-center font-semibold text-gray-900 text-sm", children: tech }, tech)))] }) }), _jsx("tbody", { children: categories.map((cat, idx) => (_jsxs("tr", { className: `border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`, children: [_jsx("td", { className: "px-4 py-2 font-medium text-gray-900", children: cat.replace(/_/g, ' ') }), technologies.map(tech => {
                            const functions = service.getFunctionsByCategoryAndTech(cat, tech);
                            return (_jsx("td", { className: "px-4 py-2 text-center text-gray-600", children: functions.length }, tech));
                        })] }, cat))) })] }));
};
/**
 * Validator Result Component
 */
const ValidatorResult = ({ report, }) => (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: `p-4 rounded-lg ${report.isValid
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'}`, children: _jsx("p", { className: `font-semibold ${report.isValid ? 'text-green-900' : 'text-red-900'}`, children: report.isValid ? '✓ Valid Configuration' : '✗ Configuration Issues Found' }) }), report.errors.length > 0 && (_jsxs("div", { className: "bg-red-50 border border-red-200 rounded-lg p-4", children: [_jsx("h3", { className: "font-semibold text-red-900 mb-2", children: "Errors" }), _jsx("ul", { className: "space-y-1", children: report.errors.map((err, idx) => (_jsxs("li", { className: "text-red-700 text-sm", children: ["\u2022 ", err] }, idx))) })] })), report.warnings.length > 0 && (_jsxs("div", { className: "bg-yellow-50 border border-yellow-200 rounded-lg p-4", children: [_jsx("h3", { className: "font-semibold text-yellow-900 mb-2", children: "Warnings" }), _jsx("ul", { className: "space-y-1", children: report.warnings.map((warn, idx) => (_jsxs("li", { className: "text-yellow-700 text-sm", children: ["\u2022 ", warn] }, idx))) })] })), _jsxs("div", { className: "grid grid-cols-4 gap-3", children: [_jsxs("div", { className: "bg-blue-50 rounded p-3 text-center", children: [_jsx("p", { className: "text-2xl font-bold text-blue-600", children: report.stats.totalFunctions }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "Total Functions" })] }), _jsxs("div", { className: "bg-green-50 rounded p-3 text-center", children: [_jsx("p", { className: "text-2xl font-bold text-green-600", children: report.stats.enabledFunctions }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "Enabled" })] }), _jsxs("div", { className: "bg-purple-50 rounded p-3 text-center", children: [_jsx("p", { className: "text-2xl font-bold text-purple-600", children: report.stats.totalCategories }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "Categories" })] }), _jsxs("div", { className: "bg-indigo-50 rounded p-3 text-center", children: [_jsx("p", { className: "text-2xl font-bold text-indigo-600", children: Object.keys(report.stats.technologyCoverage).length }), _jsx("p", { className: "text-xs text-gray-600 mt-1", children: "Technologies" })] })] })] }));
export default FunctionMatrixControlPanel;
