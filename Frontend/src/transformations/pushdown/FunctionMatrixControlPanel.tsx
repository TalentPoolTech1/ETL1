/**
 * Function Matrix Dev Control Panel
 * 
 * React component for developers to:
 * - View current matrix configuration
 * - Toggle categories and functions on/off
 * - See statistics and coverage
 * - Generate reports
 */

import React, { useState, useEffect } from 'react';
import FunctionMatrixService from './FunctionMatrixService';
import FunctionMatrixDevTools, { MatrixValidationReport } from './FunctionMatrixDevTools';
import { FunctionCategory, SourceTechnology } from './FunctionMatrixTypes';

interface TabType {
  id: string;
  label: string;
}

const TABS: TabType[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'categories', label: 'Categories' },
  { id: 'technologies', label: 'Technologies' },
  { id: 'validation', label: 'Validation' },
  { id: 'coverage', label: 'Coverage' },
];

/**
 * Function Matrix Control Panel Component
 */
export const FunctionMatrixControlPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [service] = useState(() => FunctionMatrixService.getInstance());
  const [devTools] = useState(() => new FunctionMatrixDevTools(service));
  const [stats, setStats] = useState(service.getStatistics());
  const [validation, setValidation] = useState<MatrixValidationReport | null>(null);
  const [flags, setFlags] = useState(service.getFeatureFlags());
  const [categories, setCategories] = useState<FunctionCategory[]>([]);

  useEffect(() => {
    // Update stats and flags when component mounts or service changes
    setStats(service.getStatistics());
    setFlags(service.getFeatureFlags());
    setCategories(service.getAllCategories());
    setValidation(devTools.validateMatrix());
  }, [service, devTools]);

  const handleToggleCategory = (category: FunctionCategory) => {
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

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 bg-[#161b25] rounded-lg shadow-lg max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">
          Function Matrix Developer Tools
        </h1>
        <p className="text-slate-300">
          Configure and manage function matrix behavior during development
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-800">
        <div className="flex space-x-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Functions" value={stats.totalFunctions} />
            <StatCard label="Enabled Functions" value={stats.enabledFunctions} />
            <StatCard label="Categories" value={stats.totalCategories} />
            <StatCard
              label="Coverage"
              value={`${Math.round(
                (stats.enabledFunctions / stats.totalFunctions) * 100
              )}%`}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleEnableAll}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Enable All
            </button>
            <button
              onClick={handleDisableAll}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Disable All
            </button>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={handleExportMarkdown}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Export Markdown
            </button>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 mb-4">
            Toggle function categories on/off to control which functions are available
          </p>
          {categories.length === 0 ? (
            <p className="text-slate-300 italic">No categories loaded</p>
          ) : (
            <div className="space-y-2">
              {categories.map(category => {
                const isEnabled = flags.byCategory[category] ?? true;
                const count = stats.functionsByCategory[category] ?? 0;
                return (
                  <CategoryToggle
                    key={category}
                    category={category}
                    isEnabled={isEnabled}
                    functionCount={count}
                    onToggle={() => handleToggleCategory(category)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Technologies Tab */}
      {activeTab === 'technologies' && (
        <div className="space-y-4">
          {service.getAllTechnologies().map(tech => {
            const functions = service.getFunctionsByTechnology(tech);
            return (
              <TechnologyCard
                key={tech}
                technology={tech}
                functionCount={functions.length}
                devTools={devTools}
              />
            );
          })}
        </div>
      )}

      {/* Validation Tab */}
      {activeTab === 'validation' && validation && (
        <div className="space-y-4">
          <ValidatorResult report={validation} />
        </div>
      )}

      {/* Coverage Tab */}
      {activeTab === 'coverage' && (
        <div className="overflow-x-auto">
          <CoverageMatrix service={service} stats={stats} />
        </div>
      )}
    </div>
  );
};

/**
 * Stat Card Component
 */
const StatCard: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
    <p className="text-sm text-slate-300 mb-1">{label}</p>
    <p className="text-3xl font-bold text-blue-600">{value}</p>
  </div>
);

/**
 * Category Toggle Component
 */
const CategoryToggle: React.FC<{
  category: FunctionCategory;
  isEnabled: boolean;
  functionCount: number;
  onToggle: () => void;
}> = ({ category, isEnabled, functionCount, onToggle }) => (
  <div className="flex items-center justify-between p-3 bg-[#0d0f1a] rounded border border-slate-800 hover:bg-[#111827] transition-colors">
    <div className="flex-1">
      <div className="font-medium text-white">
        {category.replace(/_/g, ' ')}
      </div>
      <div className="text-sm text-slate-300">{functionCount} functions</div>
    </div>
    <button
      onClick={onToggle}
      className={`px-4 py-2 rounded font-medium transition-colors ${
        isEnabled
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-gray-300 text-slate-200 hover:bg-gray-400'
      }`}
    >
      {isEnabled ? 'Enabled' : 'Disabled'}
    </button>
  </div>
);

/**
 * Technology Card Component
 */
const TechnologyCard: React.FC<{
  technology: SourceTechnology;
  functionCount: number;
  devTools: FunctionMatrixDevTools;
}> = ({ technology, functionCount, devTools }) => (
  <div className="bg-[#0d0f1a] rounded-lg p-4 border border-slate-800">
    <h3 className="font-semibold text-white mb-3">
      {technology.charAt(0).toUpperCase() + technology.slice(1)}
    </h3>
    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <p className="text-2xl font-bold text-white">{functionCount}</p>
        <p className="text-xs text-slate-300 mt-1">Functions</p>
      </div>
    </div>
  </div>
);

/**
 * Coverage Matrix Component
 */
const CoverageMatrix: React.FC<{
  service: FunctionMatrixService;
  stats: ReturnType<FunctionMatrixService['getStatistics']>;
}> = ({ service, stats }) => {
  const categories = service.getAllCategories();
  const technologies = service.getAllTechnologies();

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-[#111827] border-b border-slate-700">
          <th className="px-4 py-2 text-left font-semibold text-white">
            Category
          </th>
          {technologies.map(tech => (
            <th
              key={tech}
              className="px-4 py-2 text-center font-semibold text-white text-sm"
            >
              {tech}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((cat, idx) => (
          <tr
            key={cat}
            className={`border-b border-slate-800 ${
              idx % 2 === 0 ? 'bg-[#161b25]' : 'bg-[#0d0f1a]'
            }`}
          >
            <td className="px-4 py-2 font-medium text-white">
              {cat.replace(/_/g, ' ')}
            </td>
            {technologies.map(tech => {
              const functions = service.getFunctionsByCategoryAndTech(cat, tech);
              return (
                <td key={tech} className="px-4 py-2 text-center text-slate-300">
                  {functions.length}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * Validator Result Component
 */
const ValidatorResult: React.FC<{ report: MatrixValidationReport }> = ({
  report,
}) => (
  <div className="space-y-4">
    <div
      className={`p-4 rounded-lg ${
        report.isValid
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      }`}
    >
      <p className={`font-semibold ${report.isValid ? 'text-green-900' : 'text-red-900'}`}>
        {report.isValid ? '✓ Valid Configuration' : '✗ Configuration Issues Found'}
      </p>
    </div>

    {report.errors.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="font-semibold text-red-900 mb-2">Errors</h3>
        <ul className="space-y-1">
          {report.errors.map((err, idx) => (
            <li key={idx} className="text-red-700 text-sm">
              • {err}
            </li>
          ))}
        </ul>
      </div>
    )}

    {report.warnings.length > 0 && (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3>
        <ul className="space-y-1">
          {report.warnings.map((warn, idx) => (
            <li key={idx} className="text-yellow-700 text-sm">
              • {warn}
            </li>
          ))}
        </ul>
      </div>
    )}

    <div className="grid grid-cols-4 gap-3">
      <div className="bg-blue-50 rounded p-3 text-center">
        <p className="text-2xl font-bold text-blue-600">
          {report.stats.totalFunctions}
        </p>
        <p className="text-xs text-slate-300 mt-1">Total Functions</p>
      </div>
      <div className="bg-green-50 rounded p-3 text-center">
        <p className="text-2xl font-bold text-green-600">
          {report.stats.enabledFunctions}
        </p>
        <p className="text-xs text-slate-300 mt-1">Enabled</p>
      </div>
      <div className="bg-purple-50 rounded p-3 text-center">
        <p className="text-2xl font-bold text-purple-600">
          {report.stats.totalCategories}
        </p>
        <p className="text-xs text-slate-300 mt-1">Categories</p>
      </div>
      <div className="bg-indigo-50 rounded p-3 text-center">
        <p className="text-2xl font-bold text-indigo-600">
          {Object.keys(report.stats.technologyCoverage).length}
        </p>
        <p className="text-xs text-slate-300 mt-1">Technologies</p>
      </div>
    </div>
  </div>
);

export default FunctionMatrixControlPanel;
