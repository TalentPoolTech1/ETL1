/**
 * Pushdown Strategy Integration Example
 * 
 * Complete example showing how to integrate all push-down components:
 * - Eligibility analysis
 * - Execution point selection
 * - Function availability filtering
 * - Issue resolution
 * 
 * This demonstrates the intended usage pattern for the entire system.
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Triangle,
  BarChart3,
  AlertCircle,
  Settings,
} from 'lucide-react';

// Pushdown components
import { ExecutionPointPanel } from './pushdown/ExecutionPointPanel';
import { IssueResolutionBanner } from './pushdown/IssueResolutionBanner';
import { TransformPalette } from './pushdown/TransformPalette';

// Hooks
import { usePushdownStrategy } from '../../hooks/usePushdownStrategy';

// Types
import { TransformSequence, TransformStep } from '../../transformations/ir';
import { SourceTableInfo } from '../../transformations/pushdown/PushdownEligibilityEngine';

interface PushdownStrategyEditorProps {
  sequence: TransformSequence;
  sourceTables: SourceTableInfo[];
  onStrategyChange?: (strategy: any) => void;
}

/**
 * Integration example: Complete pushdown strategy editor
 */
export function PushdownStrategyEditor({
  sequence,
  sourceTables,
  onStrategyChange,
}: PushdownStrategyEditorProps) {
  const pushdown = usePushdownStrategy();
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);

  // Analyze on mount or when input changes
  useEffect(() => {
    pushdown.analyzeEligibility(sourceTables, sequence);
  }, [sequence, sourceTables]);

  // Notify parent of changes
  useEffect(() => {
    if (onStrategyChange && pushdown.state.analysis) {
      onStrategyChange(pushdown.exportStrategy());
    }
  }, [pushdown.state.analysis, pushdown.state.executionPoints]);

  const issueCount = pushdown.getIssueCount();
  const functionPalette = selectedStep ? pushdown.getFunctionPalette(selectedStep) : null;

  if (pushdown.state.isAnalyzing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Triangle className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Analyzing pushdown eligibility...</p>
        </div>
      </div>
    );
  }

  if (!pushdown.state.analysis) {
    return (
      <div className="p-6 text-center bg-gray-50 rounded-lg">
        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">Select a pipeline to analyze push-down eligibility</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Issue Banner */}
      {bannerVisible && pushdown.hasIssues() && (
        <IssueResolutionBanner
          analysis={pushdown.state.analysis}
          sequence={sequence}
          isVisible={bannerVisible}
          onDismiss={() => setBannerVisible(false)}
          onNavigate={(stepId) => setSelectedStep(stepId)}
          functionFilter={pushdown.functionFilter}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex gap-4 p-6 overflow-hidden">
        {/* Left side: Pipeline visualization + function palette */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto">
          {/* Pipeline overview */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">Pipeline Segments</h2>
            </div>

            <div className="space-y-2">
              {pushdown.state.analysis.segments.map((segment) => {
                const execPoint = pushdown.executionPointManager.getExecutionPoint(
                  segment.segmentId
                );
                const color =
                  execPoint === 'source'
                    ? 'bg-blue-50 border-blue-200'
                    : execPoint === 'pyspark'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200';

                return (
                  <div
                    key={segment.segmentId}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${color}`}
                  >
                    <div className="font-medium text-gray-900">{segment.stepRange}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {segment.sourceTechnologies.join(', ')}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-1 rounded font-medium ${
                          segment.eligible
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {segment.eligible ? '✓ Eligible' : '✗ Not eligible'}
                      </span>
                      <span className="text-gray-500">
                        {execPoint === 'source' ? '🔵 Pushdown' : '🟠 PySpark'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Function palette (if step selected) */}
          {selectedStep && functionPalette && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-amber-600" />
                <h2 className="font-bold text-gray-900">Function Availability</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Selected step: <span className="font-medium">{selectedStep}</span>
              </p>
              <TransformPalette
                sourceTechnology={functionPalette.sourceTechnology}
                executionPoint={functionPalette.executionPoint}
                onSelectFunction={(funcId) => {
                  console.log('Selected function:', funcId, 'for step:', selectedStep);
                }}
                filter={pushdown.functionFilter}
                allowUnavailable={functionPalette.executionPoint === 'pyspark'}
              />
            </div>
          )}
        </div>

        {/* Right side: Execution Point Panel */}
        {panelOpen && (
          <ExecutionPointPanel
            analysis={pushdown.state.analysis}
            stateManager={pushdown.executionPointManager}
            sequence={sequence}
            onExecutionPointChange={(stepId, newPoint) => {
              pushdown.changeExecutionPoint(stepId, newPoint);
            }}
            isOpen={panelOpen}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </div>

      {/* Bottom action bar */}
      <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
          >
            {panelOpen ? 'Hide' : 'Show'} Execution Strategy
          </button>

          {pushdown.hasIssues() && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 text-sm rounded">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">{issueCount} issue(s)</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => pushdown.reset()}
            className="px-4 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => {
              const config = pushdown.exportStrategy();
              console.log('Exported strategy:', config);
              // In a real app, you'd save this to the backend
            }}
            disabled={!pushdown.state.isValid}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export Strategy
          </button>
        </div>
      </div>
    </div>
  );
}

export default PushdownStrategyEditor;
