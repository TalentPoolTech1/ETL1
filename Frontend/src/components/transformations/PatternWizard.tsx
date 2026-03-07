/**
 * Pattern Wizard Component
 * 
 * Interactive UI for building regular expression patterns with live testing.
 * Helps users construct regex without needing deep regex knowledge.
 * 
 * Features:
 * - Template patterns for common use cases
 * - Live test against sample data
 * - Visual highlighting of matches
 * - Capture group selector
 */

import React, { useState, useMemo } from 'react';

export interface PatternWizardResult {
  pattern: string;
  groupIndex: number;
  caseSensitive: boolean;
  multiline: boolean;
  dotMatchesNewline: boolean;
}

interface PatternWizardProps {
  onComplete: (result: PatternWizardResult) => void;
  sampleData?: string[];
  onCancel?: () => void;
}

const PATTERN_TEMPLATES = [
  {
    category: 'Common Patterns',
    patterns: [
      {
        label: 'Email address',
        value: '([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
        description: 'Extracts email addresses',
      },
      {
        label: 'Phone number (US)',
        value: '(\\d{3}[-.]\\d{3}[-.]\\d{4})',
        description: 'Matches xxx-xxx-xxxx, xxx.xxx.xxxx, or xxxxxxxxxx',
      },
      {
        label: 'URL',
        value: '(https?://[^\\s]+)',
        description: 'Extracts HTTP/HTTPS URLs',
      },
      {
        label: 'Date (MM/DD/YYYY)',
        value: '(\\d{2}/\\d{2}/\\d{4})',
        description: 'Matches MM/DD/YYYY format',
      },
      {
        label: 'Numbers only',
        value: '(\\d+)',
        description: 'Extracts digit sequences',
      },
      {
        label: 'Uppercase letters',
        value: '([A-Z]+)',
        description: 'Extracts all-caps character sequences',
      },
    ],
  },
  {
    category: 'Text Extraction',
    patterns: [
      {
        label: 'Text between markers',
        value: 'START(.*)END',
        description: 'Extract text between START and END',
      },
      {
        label: 'Word after keyword',
        value: 'keyword\\s+([\\w]+)',
        description: 'Get the word following "keyword"',
      },
      {
        label: 'Text in parentheses',
        value: '\\(([^)]+)\\)',
        description: 'Extract content between ( and )',
      },
    ],
  },
];

/**
 * Test a pattern against sample data and return matches
 */
function testPattern(pattern: string, data: string[], flags: string): Array<{ original: string; matches: string[]; highlighted: string }> {
  try {
    const regex = new RegExp(pattern, flags);
    return data.map(original => {
      const match = regex.exec(original);
      if (!match) {
        return { original, matches: [], highlighted: original };
      }

      const matches = match.slice(1); // Exclude full match (group 0)
      let highlighted = original;

      // Highlight all groups
      match.slice(1).forEach((group, idx) => {
        if (group) {
          highlighted = highlighted.replace(
            group,
            `<mark class="bg-yellow-200 font-mono">${group}</mark>`
          );
        }
      });

      return { original, matches, highlighted };
    });
  } catch {
    return data.map(original => ({
      original,
      matches: [],
      highlighted: '<span class="text-red-600">Invalid pattern</span>',
    }));
  }
}

/**
 * Pattern Wizard Modal Component
 */
export const PatternWizard: React.FC<PatternWizardProps> = ({
  onComplete,
  sampleData = ['example_value_1', 'test_data', 'sample123'],
  onCancel,
}) => {
  const [step, setStep] = useState<'template' | 'test' | 'options'>('template');
  const [pattern, setPattern] = useState('');
  const [groupIndex, setGroupIndex] = useState(1);
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [multiline, setMultiline] = useState(false);
  const [dotMatches, setDotMatches] = useState(false);
  const [useTemplate, setUseTemplate] = useState(false);

  const flags = useMemo(() => {
    let f = '';
    if (caseInsensitive) f += 'i';
    if (multiline) f += 'm';
    if (dotMatches) f += 's';
    return f || 'g';
  }, [caseInsensitive, multiline, dotMatches]);

  const testResults = useMemo(() => {
    if (!pattern) return [];
    return testPattern(pattern, sampleData, flags);
  }, [pattern, sampleData, flags]);

  const captureGroupCount = useMemo(() => {
    try {
      const regex = new RegExp(pattern, flags);
      const match = regex.exec(sampleData[0] || 'test');
      return match ? match.length - 1 : 0;
    } catch {
      return 0;
    }
  }, [pattern, sampleData, flags]);

  const handleTemplateSelect = (templatePattern: string) => {
    setPattern(templatePattern);
    setUseTemplate(true);
    setStep('test');
  };

  const handleComplete = () => {
    onComplete({
      pattern,
      groupIndex,
      caseSensitive: !caseInsensitive,
      multiline,
      dotMatchesNewline: dotMatches,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {step === 'template' && 'Choose a Pattern Template'}
            {step === 'test' && 'Test Your Pattern'}
            {step === 'options' && 'Pattern Options'}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'template' && (
            <div className="space-y-4">
              {PATTERN_TEMPLATES.map((category, idx) => (
                <div key={idx}>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2">{category.category}</h3>
                  <div className="space-y-2">
                    {category.patterns.map((tmpl, pidx) => (
                      <button
                        key={pidx}
                        onClick={() => handleTemplateSelect(tmpl.value)}
                        className="w-full text-left p-3 border border-gray-300 rounded-md hover:bg-blue-50 hover:border-blue-500 transition"
                      >
                        <div className="font-medium text-sm">{tmpl.label}</div>
                        <div className="text-xs text-gray-600">{tmpl.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="border-t pt-4 mt-4">
                <button
                  onClick={() => setStep('test')}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Or enter a custom pattern →
                </button>
              </div>
            </div>
          )}

          {step === 'test' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pattern (Regular Expression)
                </label>
                <textarea
                  value={pattern}
                  onChange={e => setPattern(e.target.value)}
                  placeholder="Enter regex pattern here"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                <h4 className="font-semibold text-sm mb-3">Live Test Results</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {testResults.length === 0 ? (
                    <p className="text-sm text-gray-500">Enter a pattern to see results</p>
                  ) : (
                    testResults.map((result, idx) => (
                      <div key={idx} className="p-2 bg-white border border-gray-200 rounded text-sm font-mono">
                        <div className="text-gray-700">{result.original}</div>
                        {result.matches.length > 0 ? (
                          <div className="text-green-600 mt-1">
                            ✓ Matches: {result.matches.map((m, i) => `[${i + 1}]: ${m}`).join(', ')}
                          </div>
                        ) : (
                          <div className="text-gray-400 mt-1">- No match</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => setStep('options')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={!pattern}
              >
                Next: Configure Options →
              </button>
            </div>
          )}

          {step === 'options' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                <p className="text-sm text-blue-900 font-mono">Pattern: {pattern}</p>
                <p className="text-xs text-blue-800 mt-1">Found {captureGroupCount} capture group(s)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Which capture group to use?
                </label>
                <select
                  value={groupIndex}
                  onChange={e => setGroupIndex(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {Array.from({ length: Math.max(captureGroupCount, 1) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Group {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 border-t pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={caseInsensitive}
                    onChange={e => setCaseInsensitive(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Case insensitive</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={multiline}
                    onChange={e => setMultiline(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Multiline mode</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dotMatches}
                    onChange={e => setDotMatches(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm">Dot matches newline</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>

          {step !== 'template' && (
            <button
              onClick={() => setStep(step === 'test' ? 'template' : 'test')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              ← Back
            </button>
          )}

          {step === 'options' && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
